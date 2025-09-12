"use client";

import { useEffect, useState } from "react";

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

export default function HomePage() {
  const [home, setHome] = useState<Post | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoaded(false);
      setError(false);
      try {
        const res = await fetch('/api/posts/home');
        if (!res.ok) { setError(true); setLoaded(true); return; }
        const p = await res.json();
        setHome(p);
        setLoaded(true);
      } catch {
        setError(true);
        setLoaded(true);
      }
    }
    load();
  }, []);

  // Ensure links in home content open in new tab safely
  useEffect(() => {
    if (!home?.content_html) return;
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
  }, [home?.content_html]);

  // Delegated click handler to enforce opening links in a new tab
  useEffect(() => {
    if (!home?.content_html) return;
    if (typeof window === 'undefined') return;
    const container = document.querySelector('.post-content');
    if (!container) return;
    const onClick: EventListener = (evt) => {
      const e = evt as unknown as MouseEvent;
      const target = (e.target as HTMLElement | null);
      if (!target) return;
      const anchor = target.closest ? (target.closest('a[href]') as HTMLAnchorElement | null) : null;
      if (!anchor) return;
      if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
      try { e.preventDefault(); } catch {}
      try { window.open(anchor.href, '_blank', 'noopener,noreferrer'); }
      catch { anchor.setAttribute('target', '_blank'); anchor.setAttribute('rel', 'noopener noreferrer'); }
    };
    container.addEventListener('click', onClick);
    return () => { container.removeEventListener('click', onClick); };
  }, [home?.content_html]);

  if (!loaded) {
    return (
      <article className="post" aria-busy="true">
        <div className="spinner" />
      </article>
    );
  }

  if (error || !home) {
    return (
      <div className="fade-in">
        <h1>Welcome</h1>
        <p>Pick a post on the left.</p>
      </div>
    );
  }

  return (
    <article className="post fade-in mb-10">
      {home.cover_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={home.cover_image} className="post-cover" alt="" />
      ) : null}
      <h1 id="title" className="post-title" style={{ marginBottom: 28 }}>{home.title}</h1>
      <div id="content" className="post-content" dangerouslySetInnerHTML={{ __html: home.content_html }} />
    </article>
  );
}


