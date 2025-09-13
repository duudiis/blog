"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SITE_NAME } from "@/lib/site";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useModal } from "@/components/Modal";
import Spinner from "@/components/Spinner";
import { useParams } from "next/navigation";

type Post = {
  id: number;
  slug: string;
  title: string;
  content_html: string;
  cover_image?: string | null;
  published: number;
  created_at: string;
  updated_at: string;
};

function relativeTime(iso: string) {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - now) / 1000);
  const absSec = Math.abs(diffSec);
  const map: [Intl.RelativeTimeFormatUnit, number][] = [["year",31536000],["month",2592000],["week",604800],["day",86400],["hour",3600],["minute",60]];
  for (const [unit, sec] of map) { if (absSec >= sec) return rtf.format(Math.round(diffSec / sec), unit); }
  return rtf.format(diffSec, "second");
}

function formatFullDate(iso: string) {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const daySuffix = (() => {
    const j = day % 10;
    const k = day % 100;
    if (k >= 11 && k <= 13) return "th";
    if (j === 1) return "st";
    if (j === 2) return "nd";
    if (j === 3) return "rd";
    return "th";
  })();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${month} ${day}${daySuffix}, ${year} @ ${hours}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
}

export default function PostPage() {
  const params = useParams<{ slug: string | string[] }>();
  const slugParam = params.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : (slugParam ?? "");
  const [post, setPost] = useState<Post | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [shouldShowSpinner, setShouldShowSpinner] = useState(false);
  const spinnerShownAtRef = useRef<number | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [comments, setComments] = useState<Array<{ id: number; author_email?: string; author_name?: string; author_picture?: string; content: string; created_at: string; _new?: boolean; _deleting?: boolean }>>([]);
  const [newComment, setNewComment] = useState<string>("");
  const [isPosting, setIsPosting] = useState(false);
  const [user, setUser] = useState<{ email?: string; name?: string; picture?: string } | null>(null);
  const { confirm, alert } = useModal();

  // Scroll to top when navigating between posts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        window.scrollTo(0, 0);
      }
    }
  }, [slug]);

  const readTime = useMemo(() => {
    if (!post?.content_html) return "";
    const text = post.content_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = text ? text.split(" ").length : 0;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
  }, [post?.content_html]);

  useEffect(() => {
    async function load() {
      setHasLoaded(false);
      setHasError(false);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try {
        const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`, { headers });
        if (!res.ok) {
          setHasLoaded(true);
          if (res.status === 404) {
            setPost(null);
            setHasError(false);
          } else {
            setPost(null);
            setHasError(true);
          }
          return;
        }
        const p = await res.json();
        setPost(p);
        setHasLoaded(true);
      } catch {
        setPost(null);
        setHasError(true);
        setHasLoaded(true);
      }
    }
    load();
  }, [slug]);

  async function refreshAuth() {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!t) { setIsAdmin(false); setUser(null); return; }
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const info = await res.json();
        setIsAdmin(!!info?.isAdmin);
        setUser(info);
      } else {
        setIsAdmin(false);
        setUser(null);
      }
    } catch {
      setIsAdmin(false);
      setUser(null);
    }
  }

  // Keep auth-derived UI (edit icon, user) in sync and react to global updates
  useEffect(() => {
    refreshAuth();
    const onChanged = () => refreshAuth();
    if (typeof window !== 'undefined') window.addEventListener('posts:changed', onChanged);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('posts:changed', onChanged); };
  }, []);

  // Load comments
  useEffect(() => {
    async function loadComments() {
      try {
        const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers = t ? { Authorization: `Bearer ${t}` } : undefined;
        const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/comments`, { headers });
        if (!res.ok) { setComments([]); return; }
        const list = await res.json();
        setComments(Array.isArray(list) ? list : []);
      } catch { setComments([]); }
    }
    if (slug) loadComments();
  }, [slug]);

  async function submitComment() {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!t) return;
    const content = newComment.trim();
    if (!content) return;
    if (isPosting) return;
    setIsPosting(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ content }) });
      if (res.ok) {
        const created = await res.json();
        setComments((prev) => [...prev, { ...created, _new: true }]);
        setNewComment("");
        // Remove the _new flag after the entrance animation completes
        setTimeout(() => {
          setComments((prev) => prev.map((c) => c.id === created.id ? { ...c, _new: false } : c));
        }, 500);
        setIsPosting(false);
        await alert({ title: 'Comment posted', message: 'Your comment has been added.' });
      } else {
        let msg = 'There was an issue posting your comment.';
        try { const data = await res.json(); if (data?.error) msg = data.error; } catch {}
        setIsPosting(false);
        await alert({ title: 'Post failed', message: msg, danger: true });
      }
    } catch {
      setIsPosting(false);
      await alert({ title: 'Network error', message: 'Could not post your comment. Please try again.', danger: true });
    }
  }

  function onLogout() {
    try { localStorage.removeItem('token'); } catch {}
    setUser(null);
    setIsAdmin(false);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('posts:changed'));
  }

  // Avoid spinner flicker on fast loads: delay showing it slightly (100ms)
  useEffect(() => {
    let showTimer: number | null = null;
    if (!hasLoaded) {
      showTimer = window.setTimeout(() => {
        spinnerShownAtRef.current = Date.now();
        setShouldShowSpinner(true);
      }, 100);
    }
    return () => {
      if (showTimer) window.clearTimeout(showTimer);
    };
  }, [hasLoaded, slug]);

  const isShowingLoading = !hasLoaded || shouldShowSpinner;

  // Set document title while loading and after load as a fallback to metadata
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isShowingLoading) {
      try { document.title = `Loading • ${SITE_NAME}`; } catch {}
      return;
    }
    if (post?.title) {
      try { document.title = `${post.title} • ${SITE_NAME}`; } catch {}
    }
  }, [isShowingLoading, post?.title]);

  // Ensure spinner, once shown, stays for at least 500ms
  useEffect(() => {
    if (!shouldShowSpinner) return;
    if (!hasLoaded) return; // still loading, keep spinner
    const shownAt = spinnerShownAtRef.current ?? Date.now();
    if (spinnerShownAtRef.current == null) spinnerShownAtRef.current = shownAt;
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(0, 500 - elapsed);
    const hideTimer = window.setTimeout(() => {
      setShouldShowSpinner(false);
      spinnerShownAtRef.current = null;
    }, remaining);
    return () => { window.clearTimeout(hideTimer); };
  }, [hasLoaded, shouldShowSpinner]);

  // Ensure all links in post content open in a new tab and are safe
  useEffect(() => {
    if (!post?.content_html) return;
    if (typeof window === 'undefined') return;
    try {
      const container = document.querySelector('.post-content');
      if (!container) return;
      const anchors = container.querySelectorAll('a[href]');
      anchors.forEach((el) => {
        const a = el as HTMLAnchorElement;
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
    } catch {}
  }, [post?.content_html]);

  // Delegated click handler to enforce opening links in a new tab
  useEffect(() => {
    if (!post?.content_html) return;
    if (typeof window === 'undefined') return;
    const container = document.querySelector('.post-content');
    if (!container) return;
    const onClick: EventListener = (evt) => {
      const e = evt as unknown as MouseEvent;
      const target = (e.target as HTMLElement | null);
      if (!target) return;
      const anchor = target.closest ? (target.closest('a[href]') as HTMLAnchorElement | null) : null;
      if (!anchor) return;
      // Allow modifier/middle clicks to behave naturally
      if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
      try { e.preventDefault(); } catch {}
      try { window.open(anchor.href, '_blank', 'noopener,noreferrer'); }
      catch { anchor.setAttribute('target', '_blank'); anchor.setAttribute('rel', 'noopener noreferrer'); }
    };
    container.addEventListener('click', onClick);
    return () => { container.removeEventListener('click', onClick); };
  }, [post?.content_html]);

  const notFoundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 22 22" version="1.1" aria-hidden="true">
  <title>file_missing_plus</title>
  <desc>Missing file icon</desc>
  <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
    <g id="Dribbble-Light-Preview" transform="translate(-98.000000, -1479.000000)" fill="currentColor">
      <g id="icons" transform="translate(56.000000, 160.000000)">
        <path d="M63,1329.05522 C62.448,1329.05522 62,1329.501 62,1330.05027 C62,1330.59954 62.448,1331.04533 63,1331.04533 C63.552,1331.04533 64,1330.59954 64,1330.05027 C64,1329.501 63.552,1329.05522 63,1329.05522 L63,1329.05522 Z M55,1337.01566 C54.448,1337.01566 54,1337.46145 54,1338.01072 C54,1338.55999 54.448,1339.00578 55,1339.00578 C55.552,1339.00578 56,1338.55999 56,1338.01072 C56,1337.46145 55.552,1337.01566 55,1337.01566 L55,1337.01566 Z M59,1337.01566 C58.448,1337.01566 58,1337.46145 58,1338.01072 C58,1338.55999 58.448,1339.00578 59,1339.00578 C59.552,1339.00578 60,1338.55999 60,1338.01072 C60,1337.46145 59.552,1337.01566 59,1337.01566 L59,1337.01566 Z M63,1337.01566 C62.448,1337.01566 62,1337.46145 62,1338.01072 C62,1338.55999 62.448,1339.00578 63,1339.00578 C63.552,1339.00578 64,1338.55999 64,1338.01072 C64,1337.46145 63.552,1337.01566 63,1337.01566 L63,1337.01566 Z M47,1336.91118 L46,1336.91118 L46,1336.02061 C46,1335.47134 45.552,1335.02555 45,1335.02555 C44.448,1335.02555 44,1335.47134 44,1336.02061 L44,1336.91118 L43,1336.91118 C42.452,1336.91118 42.01,1337.40175 42.003,1337.94505 C42.01,1338.48835 42.452,1338.9013 43,1338.9013 L44,1338.9013 L44,1340.00083 C44,1340.5501 44.448,1340.99589 45,1340.99589 C45.552,1340.99589 46,1340.5501 46,1340.00083 L46,1338.9013 L47,1338.9013 C47.552,1338.9013 48,1338.50825 48,1337.95898 L48,1337.93211 C48,1337.38284 47.552,1336.91118 47,1336.91118 L47,1336.91118 Z M42,1337.95898 C42,1337.954 42.003,1337.95002 42.003,1337.94505 C42.003,1337.94107 42,1337.93709 42,1337.93211 L42,1337.95898 Z M45,1321.09477 C45.552,1321.09477 46,1320.64899 46,1320.09972 C46,1319.55044 45.552,1319.10466 45,1319.10466 C44.448,1319.10466 44,1319.55044 44,1320.09972 C44,1320.64899 44.448,1321.09477 45,1321.09477 L45,1321.09477 Z M63,1333.03544 C62.448,1333.03544 62,1333.48123 62,1334.0305 C62,1334.57977 62.448,1335.02555 63,1335.02555 C63.552,1335.02555 64,1334.57977 64,1334.0305 C64,1333.48123 63.552,1333.03544 63,1333.03544 L63,1333.03544 Z M49,1319.10466 C48.448,1319.10466 48,1319.55044 48,1320.09972 C48,1320.64899 48.448,1321.09477 49,1321.09477 C49.552,1321.09477 50,1320.64899 50,1320.09972 C50,1319.55044 49.552,1319.10466 49,1319.10466 L49,1319.10466 Z M53,1319.10466 C52.448,1319.10466 52,1319.55044 52,1320.09972 C52,1320.64899 52.448,1321.09477 53,1321.09477 C53.552,1321.09477 54,1320.64899 54,1320.09972 C54,1319.55044 53.552,1319.10466 53,1319.10466 L53,1319.10466 Z M45,1325.07499 C45.552,1325.07499 46,1324.62921 46,1324.07994 C46,1323.53067 45.552,1323.08488 45,1323.08488 C44.448,1323.08488 44,1323.53067 44,1324.07994 C44,1324.62921 44.448,1325.07499 45,1325.07499 L45,1325.07499 Z M45,1333.03544 C45.552,1333.03544 46,1332.58966 46,1332.04039 C46,1331.49111 45.552,1331.04533 45,1331.04533 C44.448,1331.04533 44,1331.49111 44,1332.04039 C44,1332.58966 44.448,1333.03544 45,1333.03544 L45,1333.03544 Z M51,1337.01566 C50.448,1337.01566 50,1337.46145 50,1338.01072 C50,1338.55999 50.448,1339.00578 51,1339.00578 C51.552,1339.00578 52,1338.55999 52,1338.01072 C52,1337.46145 51.552,1337.01566 51,1337.01566 L51,1337.01566 Z M63.707,1324.78344 L58.293,1319.34347 C57.878,1318.93152 57.596,1319.00018 57,1319.00018 C56.448,1319.00018 56,1319.55044 56,1320.09972 L56,1325.07499 C56,1326.17354 56.895,1326.96063 58,1326.96063 L63,1326.96063 C63.552,1326.96063 64,1326.61932 64,1326.07005 C64,1325.54864 64.067,1325.14166 63.707,1324.78344 L63.707,1324.78344 Z M44,1328.06016 C44,1327.51089 44.448,1327.06511 45,1327.06511 C45.552,1327.06511 46,1327.51089 46,1328.06016 C46,1328.60943 45.552,1329.05522 45,1329.05522 C44.448,1329.05522 44,1328.60943 44,1328.06016 L44,1328.06016 Z" id="file_missing_plus-[#1710]"></path>
      </g>
    </g>
  </g>
</svg>`;

  const errorSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M7.493 0.015 C 7.442 0.021,7.268 0.039,7.107 0.055 C 5.234 0.242,3.347 1.208,2.071 2.634 C 0.660 4.211,-0.057 6.168,0.009 8.253 C 0.124 11.854,2.599 14.903,6.110 15.771 C 8.169 16.280,10.433 15.917,12.227 14.791 C 14.017 13.666,15.270 11.933,15.771 9.887 C 15.943 9.186,15.983 8.829,15.983 8.000 C 15.983 7.171,15.943 6.814,15.771 6.113 C 14.979 2.878,12.315 0.498,9.000 0.064 C 8.716 0.027,7.683 -0.006,7.493 0.015 M8.853 1.563 C 9.967 1.707,11.010 2.136,11.944 2.834 C 12.273 3.080,12.920 3.727,13.166 4.056 C 13.727 4.807,14.142 5.690,14.330 6.535 C 14.544 7.500,14.544 8.500,14.330 9.465 C 13.916 11.326,12.605 12.978,10.867 13.828 C 10.239 14.135,9.591 14.336,8.880 14.444 C 8.456 14.509,7.544 14.509,7.120 14.444 C 5.172 14.148,3.528 13.085,2.493 11.451 C 2.279 11.114,1.999 10.526,1.859 10.119 C 1.618 9.422,1.514 8.781,1.514 8.000 C 1.514 6.961,1.715 6.075,2.160 5.160 C 2.500 4.462,2.846 3.980,3.413 3.413 C 3.980 2.846,4.462 2.500,5.160 2.160 C 6.313 1.599,7.567 1.397,8.853 1.563 M7.706 4.290 C 7.482 4.363,7.355 4.491,7.293 4.705 C 7.257 4.827,7.253 5.106,7.259 6.816 C 7.267 8.786,7.267 8.787,7.325 8.896 C 7.398 9.033,7.538 9.157,7.671 9.204 C 7.803 9.250,8.197 9.250,8.329 9.204 C 8.462 9.157,8.602 9.033,8.675 8.896 C 8.733 8.787,8.733 8.786,8.741 6.816 C 8.749 4.664,8.749 4.662,8.596 4.481 C 8.472 4.333,8.339 4.284,8.040 4.276 C 7.893 4.272,7.743 4.278,7.706 4.290 M7.786 10.530 C 7.597 10.592,7.410 10.753,7.319 10.932 C 7.249 11.072,7.237 11.325,7.294 11.495 C 7.388 11.780,7.697 12.000,8.000 12.000 C 8.303 12.000,8.612 11.780,8.706 11.495 C 8.763 11.325,8.751 11.072,8.681 10.932 C 8.616 10.804,8.460 10.646,8.333 10.580 C 8.217 10.520,7.904 10.491,7.786 10.530 " stroke="none" fill-rule="evenodd" fill="currentColor"/>
</svg>`;

  return (
    <article className="post">
      {!isShowingLoading && post?.cover_image ? (
        /* eslint-disable @next/next/no-img-element */
        <img src={post.cover_image} className="post-cover fade-in" alt="" />
      ) : null}
      {!isShowingLoading && post ? (
        <h1 id="title" className="post-title fade-in" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <span>{post.title}</span>
          {isAdmin ? (
            <a href={`/editor/${encodeURIComponent(post.slug)}`} title="Edit post" aria-label="Edit post" className="title-edit-link" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg className="title-icon-edit" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" clipRule="evenodd" d="M15.198 3.52a1.612 1.612 0 012.223 2.336L6.346 16.421l-2.854.375 1.17-3.272L15.197 3.521zm3.725-1.322a3.612 3.612 0 00-5.102-.128L3.11 12.238a1 1 0 00-.253.388l-1.8 5.037a1 1 0 001.072 1.328l4.8-.63a1 1 0 00.56-.267L18.8 7.304a3.612 3.612 0 00.122-5.106zM12 17a1 1 0 100 2h6a1 1 0 100-2h-6z" />
              </svg>
            </a>
          ) : null}
        </h1>
      ) : null}
      {!isShowingLoading && post ? (
        <div id="meta" className="post-meta post-date fade-in">
          <span title={formatFullDate(post.created_at)}>{relativeTime(post.created_at)}</span>
          {readTime ? (<>
            <span aria-hidden style={{ margin: '0 6px' }}>·</span>
            {readTime}
          </>) : null}
          {post.published !== 1 ? (
            <>
              <span aria-hidden style={{ margin: '0 6px' }}>·</span>
              {post.published === 2 ? (
                <>
                  <svg className="meta-icon-unlisted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M370.999774,3133 L369.999774,3133 C367.662774,3133 365.786774,3130.985 366.019774,3128.6 C366.221774,3126.522 368.089774,3125 370.177774,3125 L370.999774,3125 C371.551774,3125 371.999774,3124.552 371.999774,3124 C371.999774,3123.448 371.551774,3123 370.999774,3123 L370.251774,3123 C366.965774,3123 364.100774,3125.532 364.002774,3128.815 C363.900774,3132.213 366.624774,3135 369.999774,3135 L370.999774,3135 C371.551774,3135 371.999774,3134.552 371.999774,3134 C371.999774,3133.448 371.551774,3133 370.999774,3133 M377.747774,3123 L376.999774,3123 C376.447774,3123 375.999774,3123.448 375.999774,3124 C375.999774,3124.552 376.447774,3125 376.999774,3125 L377.821774,3125 C379.909774,3125 381.777774,3126.522 381.979774,3128.6 C382.212774,3130.985 380.336774,3133 377.999774,3133 L376.999774,3133 C376.447774,3133 375.999774,3133.448 375.999774,3134 C375.999774,3135.104 376.999774,3135 377.999774,3135 C381.374774,3135 384.098774,3132.213 383.996774,3128.815 C383.898774,3125.532 381.033774,3123 377.747774,3123 M368.999774,3128 L378.999774,3128 C379.551774,3128 379.999774,3128.448 379.999774,3129 C379.999774,3130.346 379.210774,3130 368.999774,3130 C368.447774,3130 367.999774,3129.552 367.999774,3129 C367.999774,3128.448 368.447774,3128 368.999774,3128" transform="translate(-364,-3123)" />
                  </svg>
                  <span style={{ marginLeft: 6 }}>Unlisted</span>
                </>
              ) : (
                <>
                  <svg className="meta-icon-private" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" clipRule="evenodd" d="M19.7071 5.70711C20.0976 5.31658 20.0976 4.68342 19.7071 4.29289C19.3166 3.90237 18.6834 3.90237 18.2929 4.29289L14.032 8.55382C13.4365 8.20193 12.7418 8 12 8C9.79086 8 8 9.79086 8 12C8 12.7418 8.20193 13.4365 8.55382 14.032L4.29289 18.2929C3.90237 18.6834 3.90237 19.3166 4.29289 19.7071C4.68342 20.0976 5.31658 20.0976 5.70711 19.7071L9.96803 15.4462C10.5635 15.7981 11.2582 16 12 16C14.2091 16 16 14.2091 16 12C16 11.2582 15.7981 10.5635 15.4462 9.96803L19.7071 5.70711ZM12.518 10.0677C12.3528 10.0236 12.1792 10 12 10C10.8954 10 10 10.8954 10 12C10 12.1792 10.0236 12.3528 10.0677 12.518L12.518 10.0677ZM11.482 13.9323L13.9323 11.482C13.9764 11.6472 14 11.8208 14 12C14 13.1046 13.1046 14 12 14C11.8208 14 11.6472 13.9764 11.482 13.9323ZM15.7651 4.8207C14.6287 4.32049 13.3675 4 12 4C9.14754 4 6.75717 5.39462 4.99812 6.90595C3.23268 8.42276 2.00757 10.1376 1.46387 10.9698C1.05306 11.5985 1.05306 12.4015 1.46387 13.0302C1.92276 13.7326 2.86706 15.0637 4.21194 16.3739L5.62626 14.9596C4.4555 13.8229 3.61144 12.6531 3.18002 12C3.6904 11.2274 4.77832 9.73158 6.30147 8.42294C7.87402 7.07185 9.81574 6 12 6C12.7719 6 13.5135 6.13385 14.2193 6.36658L15.7651 4.8207ZM12 18C11.2282 18 10.4866 17.8661 9.78083 17.6334L8.23496 19.1793C9.37136 19.6795 10.6326 20 12 20C14.8525 20 17.2429 18.6054 19.002 17.0941C20.7674 15.5772 21.9925 13.8624 22.5362 13.0302C22.947 12.4015 22.947 11.5985 22.5362 10.9698C22.0773 10.2674 21.133 8.93627 19.7881 7.62611L18.3738 9.04043C19.5446 10.1771 20.3887 11.3469 20.8201 12C20.3097 12.7726 19.2218 14.2684 17.6986 15.5771C16.1261 16.9282 14.1843 18 12 18Z" />
                  </svg>
                  <span style={{ marginLeft: 6 }}>Private</span>
                </>
              )}
            </>
          ) : null}
        </div>
      ) : null}
      {isShowingLoading ? (
        <div className="post-content" aria-busy="true">
          {shouldShowSpinner ? (
            <div className="fade-in">
              <Spinner size={32} stroke={3} />
            </div>
          ) : null}
        </div>
      ) : post ? (
        <div id="content" className="post-content fade-in" dangerouslySetInnerHTML={{ __html: post.content_html }} />
      ) : (
        <div className="empty-state fade-in" role="status" aria-live="polite">
          <div className="empty-icon" dangerouslySetInnerHTML={{ __html: hasError ? errorSvg : notFoundSvg }} />
          <h2 className="empty-title">{hasError ? "Something went wrong" : "Post not found"}</h2>
          <p className="empty-desc">
            {hasError ? "Our API sneezed. Please refresh or try again in a moment." : "This post wandered off. Maybe it's hiding behind another slug."}
          </p>
        </div>
      )}
      {!isShowingLoading && post ? (
        <section className="comments" style={{ marginTop: 40, marginBottom: 28 }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '32px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 className="post-title" style={{ fontSize: 20, margin: 0 }}>
              Comments{' '}
              <span className="post-meta" style={{ fontSize: 14, opacity: 0.8 }}>
                ({comments.length})
              </span>
            </h2>
            {user ? (
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, boxShadow: 'none' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M21 12L13 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18 15L20.913 12.087V12.087C20.961 12.039 20.961 11.961 20.913 11.913V11.913L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 5V4.5V4.5C16 3.67157 15.3284 3 14.5 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H14.5C15.3284 21 16 20.3284 16 19.5V19.5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : null}
          </div>
          {user ? (
            <div className="comment-form" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: 20, marginBottom: 20, borderRadius: 12 }}>
              {user.picture ? (
                <img src={user.picture} alt="" width={40} height={40} style={{ borderRadius: '50%' }} />
              ) : null}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <strong>{user.name || user.email || 'User'}</strong>
                </div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows={3}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: 12, outline: 'none', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={submitComment}
                    disabled={!newComment.trim() || isPosting}
                    aria-busy={isPosting}
                    style={{ padding: '8px 14px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: isPosting ? 0.7 : undefined, pointerEvents: isPosting ? 'none' : undefined }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M11.5003 12H5.41872M5.24634 12.7972L4.24158 15.7986C3.69128 17.4424 3.41613 18.2643 3.61359 18.7704C3.78506 19.21 4.15335 19.5432 4.6078 19.6701C5.13111 19.8161 5.92151 19.4604 7.50231 18.7491L17.6367 14.1886C19.1797 13.4942 19.9512 13.1471 20.1896 12.6648C20.3968 12.2458 20.3968 11.7541 20.1896 11.3351C19.9512 10.8529 19.1797 10.5057 17.6367 9.81135L7.48483 5.24303C5.90879 4.53382 5.12078 4.17921 4.59799 4.32468C4.14397 4.45101 3.77572 4.78336 3.60365 5.22209C3.40551 5.72728 3.67772 6.54741 4.22215 8.18767L5.24829 11.2793C5.34179 11.561 5.38855 11.7019 5.407 11.8459C5.42338 11.9738 5.42321 12.1032 5.40651 12.231C5.38768 12.375 5.34057 12.5157 5.24634 12.7972Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{isPosting ? 'Posting...' : 'Post comment'}</span>
                    {isPosting ? <span style={{ marginLeft: 8 }}><Spinner size={14} /></span> : null}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ margin: '24px 0', padding: '0', borderRadius: 12 }}>
              <GoogleSignInButton onCredential={async (cred) => {
                const res = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: cred }) });
                if (!res.ok) return;
                const info = await res.json();
                localStorage.setItem('token', info.token);
                setUser({ email: info.email, name: info.name, picture: info.picture });
                if (typeof window !== 'undefined') window.dispatchEvent(new Event('posts:changed'));
                refreshAuth();
              }} />
            </div>
          )}
          <div aria-hidden style={{ height: 1, width: '100%', background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--border), var(--text) 8%), transparent)', margin: '32px 0' }} />
          <ul className="comment-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 32, marginTop: "48px" }}>
            {comments.map((c) => (
              <li key={c.id} className={c._new ? 'slide-up' : undefined} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {c.author_picture ? (
                  <img src={c.author_picture} alt="" width={40} height={40} style={{ borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--muted)', display: 'grid', placeItems: 'center', fontSize: 13 }} aria-hidden>
                    {c.author_name ? c.author_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className={c._deleting ? 'breathing' : undefined} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
                      <strong>{c.author_name || c.author_email || 'User'}</strong>
                      <span className="post-meta" style={{ fontSize: 12 }} title={formatFullDate(c.created_at)}>{relativeTime(c.created_at)}</span>
                    </div>
                    {(isAdmin || (user?.email && c.author_email && user.email.toLowerCase() === c.author_email.toLowerCase())) ? (
                      <button
                        type="button"
                        title="Delete comment"
                        onClick={async () => {
                          const ok = await confirm({ title: 'Delete comment', message: 'Delete this comment? This cannot be undone.', confirmText: 'Delete', danger: true });
                          if (!ok) return;
                          if (!post) return;
                          const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                          if (!t) return;
                          setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, _deleting: true } : x));
                          try {
                            const startedAt = Date.now();
                            const res = await fetch(`/api/posts/${encodeURIComponent(post.slug)}/comments/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
                            const elapsed = Date.now() - startedAt;
                            const remaining = Math.max(0, 2000 - elapsed);
                            if (res.ok) {
                              if (remaining) await new Promise((r) => setTimeout(r, remaining));
                              setComments((prev) => prev.filter((x) => x.id !== c.id));
                            } else {
                              let msg = 'Could not delete the comment.';
                              try { const data = await res.json(); if (data?.error) msg = data.error; } catch {}
                              await alert({ title: 'Delete failed', message: msg, danger: true });
                              if (remaining) await new Promise((r) => setTimeout(r, remaining));
                              setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, _deleting: false } : x));
                            }
                          } catch {
                            await alert({ title: 'Network error', message: 'Could not delete the comment. Please try again.', danger: true });
                            // Ensure at least one full cycle shown
                            await new Promise((r) => setTimeout(r, 1200));
                            setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, _deleting: false } : x));
                          }
                        }}
                        style={{ padding: 0, borderRadius: 8, color: 'var(--muted)', background: 'transparent', boxShadow: 'none' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M6 7H12H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <p style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{c.content}</p>
                </div>
              </li>
            ))}
            {comments.length === 0 ? (
              <li className="fade-in" style={{ opacity: 0.9, display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 20 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden style={{ width: 32, height: 32, display: 'block' }}>
                    <g clipPath="url(#cmt_clip)">
                      <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.4876 3.36093 14.891 4 16.1272L3 21L7.8728 20C9.10904 20.6391 10.5124 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="cmt_clip"><rect width="24" height="24" fill="white"/></clipPath>
                    </defs>
                  </svg>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>No comments yet</div>
                    <div className="post-meta" style={{ fontSize: 12 }}>Be the first one to comment!</div>
                  </div>
                </div>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </article>
  );
}


