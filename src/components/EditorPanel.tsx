"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useModal } from "@/components/Modal";

type LoadedPost = {
  slug: string;
  title: string;
  content_html: string;
  cover_image?: string | null;
  published: number;
  created_at: string;
  updated_at: string;
} | null;

function relativeTime(isoOrDate: string | Date) {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const now = Date.now();
  const then = (isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)).getTime();
  const diffSec = Math.round((then - now) / 1000);
  const absSec = Math.abs(diffSec);
  const map: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, sec] of map) {
    if (absSec >= sec) return rtf.format(Math.round(diffSec / sec), unit);
  }
  return rtf.format(diffSec, 'second');
}

function formatFullDate(isoOrDate: string | Date) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (isNaN(date.getTime())) return String(isoOrDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const daySuffix = (() => {
    const j = day % 10;
    const k = day % 100;
    if (k >= 11 && k <= 13) return 'th';
    if (j === 1) return 'st';
    if (j === 2) return 'nd';
    if (j === 3) return 'rd';
    return 'th';
  })();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${month} ${day}${daySuffix}, ${year} @ ${hours}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
}

export default function EditorPanel() {
  const router = useRouter();
  const params = useParams<{ slug?: string | string[] }>();
  const routeSlug = params?.slug ? (Array.isArray(params.slug) ? params.slug[0] : String(params.slug)) : undefined;

  const [token, setToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string>("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  // 0 = private, 1 = public, 2 = unlisted
  const [visibility, setVisibility] = useState<0 | 1 | 2>(1);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState<string>("");
  const [loadedPost, setLoadedPost] = useState<LoadedPost>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [formatState, setFormatState] = useState<{ block: 'p' | 'h2' | 'h3' | 'blockquote' | 'pre' | null; bold: boolean; italic: boolean; underline: boolean; ul: boolean; ol: boolean; link: boolean; }>({ block: null, bold: false, italic: false, underline: false, ul: false, ol: false, link: false });
  const [now, setNow] = useState<Date>(new Date());
  const [isTitleActive, setIsTitleActive] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [readTime, setReadTime] = useState<string>("");
  const { confirm, alert } = useModal();
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const isHomePage = routeSlug === 'home';

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    if (t) setToken(t);
  }, []);

  // Ticking clock for new/unsaved post meta
  useEffect(() => {
    if (loadedPost) return; // Use real created_at when loaded
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [loadedPost, token, routeSlug]);

  // Compute read time from editor content
  useEffect(() => {
    function computeReadTime() {
      const el = editorRef.current;
      if (!el) { setReadTime(""); return; }
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      const words = text ? text.split(" ").length : 0;
      if (!words) { setReadTime(""); return; }
      const minutes = Math.max(1, Math.ceil(words / 200));
      setReadTime(`${minutes} min read`);
    }
    const el = editorRef.current;
    // Initial and deferred computations to catch programmatic DOM updates
    computeReadTime();
    const rafId = typeof window !== 'undefined' ? window.requestAnimationFrame(() => computeReadTime()) : 0;
    const timeoutId = typeof window !== 'undefined' ? window.setTimeout(() => computeReadTime(), 0) : 0;

    const handler = () => computeReadTime();
    const editorEl = el;
    editorEl?.addEventListener('input', handler);
    editorEl?.addEventListener('keyup', handler);
    editorEl?.addEventListener('paste', handler);

    // Observe DOM mutations (e.g., when content_html is set programmatically)
    let observer: MutationObserver | null = null;
    if (editorEl && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => computeReadTime());
      observer.observe(editorEl, { childList: true, subtree: true, characterData: true });
    }

    return () => {
      editorEl?.removeEventListener('input', handler);
      editorEl?.removeEventListener('keyup', handler);
      editorEl?.removeEventListener('paste', handler);
      if (observer) observer.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [loadedPost, token, routeSlug]);

  // Auto-load post when slug changes
  useEffect(() => {
    if (!token) return;
    if (!routeSlug) { setEditSlug(null); setIsLoadingContent(false); return; }
    if (editSlug === routeSlug) return;
    setIsLoadingContent(true);
    onEditBySlug(routeSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, routeSlug]);

  // Keep slug input in sync with the route when creating vs editing
  useEffect(() => {
    if (!routeSlug) {
      setSlugInput("");
    }
  }, [routeSlug]);

  // Track selection formatting state
  useEffect(() => {
    function updateFormatState() {
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      const node = sel?.anchorNode as Node | null;
      if (!node) { setFormatState({ block: null, bold: false, italic: false, underline: false, ul: false, ol: false, link: false }); return; }
      const title = titleRef.current; const editor = editorRef.current;
      const inEditable = Boolean((title && title.contains(node)) || (editor && editor.contains(node)));
      if (!inEditable) { setFormatState({ block: null, bold: false, italic: false, underline: false, ul: false, ol: false, link: false }); setIsTitleActive(false); return; }
      setIsTitleActive(Boolean(title && title.contains(node)));
      let el: HTMLElement | null = (node as HTMLElement).nodeType === 3 ? (node.parentElement as HTMLElement | null) : (node as HTMLElement);
      // Walk up to find the closest block
      let blockTag: 'p' | 'h2' | 'h3' | 'blockquote' | 'pre' | null = null;
      let ul = false; let ol = false; let link = false;
      while (el && el !== editor && el !== title && el.nodeName !== 'ARTICLE' && el.nodeName !== 'BODY') {
        const tag = el.tagName.toUpperCase();
        if (tag === 'H2') { blockTag = 'h2'; break; }
        if (tag === 'H3') { blockTag = 'h3'; break; }
        if (tag === 'P') { blockTag = 'p'; /* continue search in case inside LI */ }
        if (tag === 'BLOCKQUOTE') { blockTag = 'blockquote'; break; }
        if (tag === 'PRE') { blockTag = 'pre'; break; }
        if (tag === 'LI') { /* list item, keep walking to see UL/OL */ }
        if (tag === 'UL') { ul = true; break; }
        if (tag === 'OL') { ol = true; break; }
        if (tag === 'A') { link = true; }
        el = el.parentElement;
      }
      // inline states via queryCommandState may throw in some browsers
      let bold = false, italic = false, underline = false;
      try { bold = document.queryCommandState('bold'); } catch { bold = false; }
      try { italic = document.queryCommandState('italic'); } catch { italic = false; }
      try { underline = document.queryCommandState('underline'); } catch { underline = false; }
      setFormatState({ block: blockTag, bold, italic, underline, ul, ol, link });
    }
    const handler = () => requestAnimationFrame(updateFormatState);
    const editorEl = editorRef.current;
    const titleEl = titleRef.current;
    document.addEventListener('selectionchange', handler);
    editorEl?.addEventListener('keyup', handler);
    editorEl?.addEventListener('mouseup', handler);
    titleEl?.addEventListener('keyup', handler);
    titleEl?.addEventListener('mouseup', handler);
    return () => {
      document.removeEventListener('selectionchange', handler);
      editorEl?.removeEventListener('keyup', handler);
      editorEl?.removeEventListener('mouseup', handler);
      titleEl?.removeEventListener('keyup', handler);
      titleEl?.removeEventListener('mouseup', handler);
    };
  }, []);

  async function onGoogleSignIn(credential: string) {
    setLoginError("");
    const res = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: credential }) });
    if (!res.ok) { setLoginError('Google sign-in failed'); return; }
    const info = await res.json();
    localStorage.setItem('token', info.token);
    setToken(info.token);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('posts:changed'));
  }

  async function onSave(publish: boolean) {
    if (isSaving) return;
    setIsSaving(true);
    const payload = {
      title: (titleRef.current?.innerText || 'Untitled').trim(),
      coverImage: (coverUrl || '') || undefined,
      contentHtml: editorRef.current?.innerHTML || '',
      // Keep backward compat with API while adding tri-state
      published: publish ? true : (visibility === 1),
      publishedState: visibility,
      slug: slugInput?.trim() ? slugInput.trim() : undefined,
    };
    const method = editSlug ? 'PUT' : 'POST';
    const url = editSlug ? `/api/posts/${encodeURIComponent(editSlug)}` : '/api/posts';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (res.ok) {
      const saved = await res.json();
      const finalSlug = saved?.slug || editSlug || routeSlug || '';
      setEditSlug(finalSlug || null);
      setSlugInput(finalSlug || '');
      setLoadedPost(saved);
      setCoverUrl(saved?.cover_image || null);
      if (finalSlug && routeSlug !== finalSlug) {
        router.push(`/editor/${encodeURIComponent(finalSlug)}`);
      }
      // Notify sidebar to refresh list immediately
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('posts:changed'));
      await alert({ title: 'Saved', message: 'Your changes have been saved.' });
    } else {
      await alert({ title: 'Save failed', message: 'There was an issue saving your post.', danger: true });
    }
    setIsSaving(false);
  }

  async function onEditBySlug(slug: string) {
    try {
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`, { headers });
      if (!res.ok) { setEditSlug(null); setIsLoadingContent(false); return; }
      const full = await res.json();
      setLoadedPost(full);
      if (titleRef.current) {
        // Clear 'Untitled' to show placeholder in UI for brand-new posts
        const isUntitled = (full.title || '').trim().toLowerCase() === 'untitled';
        titleRef.current.innerText = isUntitled ? '' : (full.title || '');
      }
      const vis: 0 | 1 | 2 = (full.published === 0 || full.published === 1 || full.published === 2) ? full.published : (full.published ? 1 : 0);
      setVisibility(vis);
      setCoverUrl(full.cover_image || null);
      if (editorRef.current) {
        // Normalize minimal empty markup to truly empty so placeholder shows
        const html = (full.content_html || '').trim();
        if (html === '' || html === '<p><br></p>' || html === '<p></p>' || html === '<br>') {
          editorRef.current.innerHTML = '';
        } else {
          editorRef.current.innerHTML = full.content_html || '';
        }
      }
      setEditSlug(slug);
      // Prevent renaming of the Home page by keeping slug input empty
      setSlugInput(slug === 'home' ? '' : slug);
    } catch {
      // ignore
    } finally {
      setIsLoadingContent(false);
    }
  }

  async function onUpload() {
    const current = coverFileRef.current;
    if (!current) return;
    if (!current.files || current.files.length === 0) {
      current.click();
      current.onchange = () => onUpload();
      return;
    }
    const f = current.files[0];
    const fd = new FormData(); fd.append('image', f);
    setIsUploading(true);
    const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (!res.ok) { await alert({ title: 'Upload failed', message: 'Could not upload the image. Please try again.', danger: true }); setIsUploading(false); return; }
    const body = await res.json();
    setCoverUrl(body.url);
    setIsUploading(false);
  }

  if (!token) {
    return (
      <>
        <GoogleSignInButton onCredential={onGoogleSignIn} />
        {loginError ? <p className="error">{loginError}</p> : null}
      </>
    );
  }

  function isSelectionInEditable(): boolean {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    const node = sel?.anchorNode as Node | null;
    if (!node) return false;
    const title = titleRef.current;
    const editor = editorRef.current;
    return Boolean((title && title.contains(node)) || (editor && editor.contains(node)));
  }

  function ensureSelectionInEditable() {
    if (isSelectionInEditable()) return;
    const target = editorRef.current || titleRef.current;
    target?.focus();
  }

  function placeCaretAtEnd(el: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function ensureEditorSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    const node = sel?.anchorNode as Node | null;
    if (!node || !editor.contains(node)) {
      editor.focus();
      if (editor.innerHTML.trim() === "") {
        editor.innerHTML = "<p><br></p>";
      }
      placeCaretAtEnd(editor);
    }
  }

  function exec(command: string, value?: string) {
    ensureSelectionInEditable();
    try {
      document.execCommand(command, false, value);
    } catch {
      // ignore
    }
  }

  function applyFormatBlock(tag: 'p' | 'h2' | 'h3' | 'blockquote' | 'pre') {
    ensureEditorSelection();
    const attempts = [tag, tag.toUpperCase(), `<${tag}>`, `<${tag.toUpperCase()}>`];
    for (const v of attempts) {
      try {
        if (document.execCommand('formatBlock', false, v)) return;
      } catch {
        // continue
      }
    }

    // Fallback: manually wrap selection in the block element
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (!range) return;
    const block = document.createElement(tag);
    if (range.collapsed) {
      block.innerHTML = "<br>";
      range.insertNode(block);
      placeCaretAtEnd(block);
      return;
    }
    const contents = range.extractContents();
    block.appendChild(contents);
    range.insertNode(block);
    sel?.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(block);
    newRange.collapse(false);
    sel?.addRange(newRange);
  }

  function onLink() {
    const url = prompt('Enter URL');
    if (!url) return;
    exec('createLink', url);
  }

  function onUnlink() {
    exec('unlink');
  }

  function toggleBlock(tag: 'p' | 'h2' | 'h3' | 'blockquote' | 'pre') {
    if (formatState.block === tag) {
      applyFormatBlock('p');
    } else {
      applyFormatBlock(tag);
    }
  }

  function clearFormatting() {
    ensureEditorSelection();
    // Remove lists if active
    if (formatState.ul) { try { document.execCommand('insertUnorderedList'); } catch {} }
    if (formatState.ol) { try { document.execCommand('insertOrderedList'); } catch {} }
    // Convert blockquotes / pre to paragraph
    if (formatState.block === 'blockquote' || formatState.block === 'pre' || formatState.block === 'h2' || formatState.block === 'h3') {
      applyFormatBlock('p');
    }
    // Remove inline styles and links
    try { document.execCommand('removeFormat'); } catch {}
    try { document.execCommand('unlink'); } catch {}
  }

  return (
    <>
      <div key={`toolbar-${routeSlug || 'new'}`} className="floating-toolbar fade-in">
        <div className="toolbar" role="toolbar" aria-label="Formatting" style={isTitleActive ? { opacity: 0.5, pointerEvents: 'none', cursor: 'not-allowed' } : undefined}>
          <button type="button" title="Heading 2 (Ctrl+Alt+2)" aria-label="Heading 2" aria-pressed={formatState.block==='h2'} className={formatState.block==='h2'? 'is-active': ''} onClick={() => toggleBlock('h2')}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
              <text x="41.412" y="52.058" style={{fontFamily:'Roboto, Arial, sans-serif',fontWeight:500,fontSize:27.4,fill:'currentColor'}}>2</text>
              <text x="3.386" y="52.058" style={{fontFamily:'Roboto, Arial, sans-serif',fontSize:56.228,fill:'currentColor'}}>H</text>
            </svg>
          </button>
          <button type="button" title="Heading 3 (Ctrl+Alt+3)" aria-label="Heading 3" aria-pressed={formatState.block==='h3'} className={formatState.block==='h3'? 'is-active': ''} onClick={() => toggleBlock('h3')}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
              <text x="41.386" y="51.71" style={{fontFamily:'Roboto, Arial, sans-serif',fontWeight:500,fontSize:28.563,fill:'currentColor'}}>3</text>
              <text x="3.379" y="51.989" style={{fontFamily:'Roboto, Arial, sans-serif',fontSize:56.228,fill:'currentColor'}}>H</text>
            </svg>
          </button>
          <button type="button" data-kind="paragraph" title="Paragraph (Ctrl+Alt+0)" aria-label="Paragraph" aria-pressed={formatState.block==='p'} className={formatState.block==='p'? 'is-active': ''} onClick={() => toggleBlock('p')}>
            <span className="ti" aria-hidden="true">¶</span>
          </button>
          <span className="toolbar-sep" role="separator" />
          <button type="button" data-size="sm" title="Bold (Ctrl+B)" aria-label="Bold" aria-pressed={formatState.bold} className={formatState.bold? 'is-active': ''} onClick={() => exec('bold')}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M2 1H8.625C11.0412 1 13 2.95875 13 5.375C13 6.08661 12.8301 6.75853 12.5287 7.35243C13.4313 8.15386 14 9.32301 14 10.625C14 13.0412 12.0412 15 9.625 15H2V1ZM5.5 9.75V11.5H9.625C10.1082 11.5 10.5 11.1082 10.5 10.625C10.5 10.1418 10.1082 9.75 9.625 9.75H5.5ZM5.5 6.25H8.625C9.10825 6.25 9.5 5.85825 9.5 5.375C9.5 4.89175 9.10825 4.5 8.625 4.5H5.5V6.25Z" fill="currentColor"/></svg>
          </button>
          <button type="button" data-size="sm" title="Italic (Ctrl+I)" aria-label="Italic" aria-pressed={formatState.italic} className={formatState.italic? 'is-active': ''} onClick={() => exec('italic')}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M14 1H5V4H7.75219L5.08553 12H2V15H11V12H8.24781L10.9145 4H14V1Z" fill="currentColor"/></svg>
          </button>
          <button type="button" data-size="sm" title="Underline (Ctrl+U)" aria-label="Underline" aria-pressed={formatState.underline} className={formatState.underline? 'is-active': ''} onClick={() => exec('underline')}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1V7C3 9.76142 5.23858 12 8 12C10.7614 12 13 9.76142 13 7V1H10V7C10 8.10457 9.10457 9 8 9C6.89543 9 6 8.10457 6 7V1H3Z" fill="currentColor"/><path d="M14 16V14H2V16H14Z" fill="currentColor"/></svg>
          </button>
          <span className="toolbar-sep" role="separator" />
          <button type="button" title="Quote" aria-label="Quote" aria-pressed={formatState.block==='blockquote'} className={formatState.block==='blockquote'? 'is-active': ''} onClick={() => toggleBlock('blockquote')}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path d="M23,9c-2.8,0-5,2.2-5,5s2.2,5,5,5c0.3,0,0.7,0,1-0.1c-1.3,1.3-3,2.1-5,2.1c-0.6,0-1,0.4-1,1s0.4,1,1,1c5,0,9-4,9-9   C28,11.2,25.8,9,23,9z" fill="currentColor"/><path d="M9,9c-2.8,0-5,2.2-5,5s2.2,5,5,5c0.3,0,0.7,0,1-0.1C8.7,20.2,7,21,5,21c-0.6,0-1,0.4-1,1s0.4,1,1,1c5,0,9-4,9-9   C14,11.2,11.8,9,9,9z" fill="currentColor"/></svg>
          </button>
          <button type="button" title="Bulleted list (Ctrl+Shift+8)" aria-label="Bulleted list" aria-pressed={formatState.ul} className={formatState.ul? 'is-active': ''} onClick={() => { ensureEditorSelection(); exec('insertUnorderedList'); }}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6L21 6.00078M8 12L21 12.0008M8 18L21 18.0007M3 6.5H4V5.5H3V6.5ZM3 12.5H4V11.5H3V12.5ZM3 18.5H4V17.5H3V18.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button type="button" title="Numbered list (Ctrl+Shift+7)" aria-label="Numbered list" aria-pressed={formatState.ol} className={formatState.ol? 'is-active': ''} onClick={() => { ensureEditorSelection(); exec('insertOrderedList'); }}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L21 6.00066M10 12L21 12.0007M10 18L21 18.0007M3 5L5 4V10M5 10H3M5 10H7M7 20H3L6.41274 17.0139C6.78593 16.6873 7 16.2156 7 15.7197C7 14.7699 6.23008 14 5.28033 14H5C4.06808 14 3.28503 14.6374 3.06301 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button type="button" title="Code block" aria-label="Code block" aria-pressed={formatState.block==='pre'} className={formatState.block==='pre'? 'is-active': ''} onClick={() => toggleBlock('pre')}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.01005 0.858582L6.01005 14.8586L7.98995 15.1414L9.98995 1.14142L8.01005 0.858582Z" fill="currentColor"/><path d="M12.5 11.5L11.0858 10.0858L13.1716 8L11.0858 5.91422L12.5 4.5L16 8L12.5 11.5Z" fill="currentColor"/><path d="M2.82843 8L4.91421 10.0858L3.5 11.5L0 8L3.5 4.5L4.91421 5.91422L2.82843 8Z" fill="currentColor"/></svg>
          </button>
          <span className="toolbar-sep" role="separator" />
          <button type="button" title="Link (Ctrl+K)" aria-label="Link" aria-pressed={formatState.link} className={formatState.link? 'is-active': ''} onClick={onLink}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.1718 14.8288L14.8287 9.17192M7.05086 11.293L5.63664 12.7072C4.07455 14.2693 4.07409 16.8022 5.63619 18.3643C7.19829 19.9264 9.7317 19.9259 11.2938 18.3638L12.7065 16.9498M11.2929 7.05L12.7071 5.63579C14.2692 4.07369 16.8016 4.07397 18.3637 5.63607C19.9258 7.19816 19.9257 9.73085 18.3636 11.2929L16.9501 12.7071" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button type="button" title="Remove link (Ctrl+Shift+K)" aria-label="Remove link" onClick={onUnlink}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9.1718 14.8288L14.8287 9.17192" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.05086 11.293L5.63664 12.7072C4.07455 14.2693 4.07409 16.8022 5.63619 18.3643C7.19829 19.9264 9.7317 19.9259 11.2938 18.3638L12.7065 16.9498" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11.2929 7.05L12.7071 5.63579C14.2692 4.07369 16.8016 4.07397 18.3637 5.63607C19.9258 7.19816 19.9257 9.73085 18.3636 11.2929L16.9501 12.7071" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 4L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="toolbar-sep" role="separator" />
          <button type="button" title="Clear formatting" aria-label="Clear formatting" onClick={clearFormatting}>
            <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.837 10.163l-4.6 4.6L10 4h4l.777 2.223-2.144 2.144-.627-2.092-1.17 3.888zm5.495.506L19.244 19H15.82l-1.05-3.5H11.5L5 22l-1.5-1.5 17-17L22 5l-5.668 5.67zm-2.31 2.31l-.032.03.032-.01v-.02z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
      <article className="post fade-in is-editor">
        {coverUrl ? (
          <div style={{ position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} className="post-cover" alt="" onClick={() => onUpload()} />
            {isUploading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--bg), transparent 30%)', borderRadius: 12 }}>
                <Spinner size={20} />
              </div>
            ) : null}
          </div>
        ) : null}
        <h1 id="title" className="post-title" ref={titleRef} contentEditable suppressContentEditableWarning data-suppress-placeholder={isLoadingContent ? true : undefined}>
          {loadedPost?.title || ''}
        </h1>
        <div id="meta" className="post-meta post-date">
          <span title={formatFullDate(loadedPost ? loadedPost.created_at : now)}>{relativeTime(loadedPost ? loadedPost.created_at : now)}</span>
          {readTime ? (<>
            <span aria-hidden style={{ margin: '0 6px' }}>·</span>
            {readTime}
          </>) : null}
          {visibility !== 1 ? (
            <>
              <span aria-hidden style={{ margin: '0 6px' }}>·</span>
              {visibility === 2 ? (
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
        <div
          id="content"
          ref={editorRef}
          className="post-content"
          data-placeholder="Start writing your post..."
          data-suppress-placeholder={isLoadingContent ? true : undefined}
          contentEditable
          suppressContentEditableWarning
        />
        <input ref={coverFileRef} type="file" accept="image/*" hidden />
      </article>
      <div key={`bottombar-${routeSlug || 'new'}`} className="floating-bottombar fade-in">
        <div className="toolbar" role="toolbar" aria-label="Post actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            {isHomePage ? (
              <div className="slug-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 0' }}>
                <span className="prefix" title="This page is your site homepage">/ (home)</span>
              </div>
            ) : (
              <div className="slug-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 0' }}>
                <span className="prefix">/posts/</span>
                <input
                  type="text"
                  className="slug-inline"
                  placeholder="custom-slug"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                />
              </div>
            )}
            <span className="toolbar-sep" role="separator" />
            <div className="privacy-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <button type="button" aria-pressed={visibility===1} className={visibility===1 ? 'is-active' : ''} onClick={() => setVisibility(1)} title="Public">
                <svg className="ti" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M3 12H21M3 12C3 16.9706 7.02944 21 12 21M3 12C3 7.02944 7.02944 3 12 3M21 12C21 16.9706 16.9706 21 12 21M21 12C21 7.02944 16.9706 3 12 3M12 21C4.75561 13.08 8.98151 5.7 12 3M12 21C19.2444 13.08 15.0185 5.7 12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ marginLeft: 6 }}>Public</span>
              </button>
              <button type="button" aria-pressed={visibility===2} className={visibility===2 ? 'is-active' : ''} onClick={() => setVisibility(2)} title="Unlisted">
                <svg className="ti ti-unlisted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d="M370.999774,3133 L369.999774,3133 C367.662774,3133 365.786774,3130.985 366.019774,3128.6 C366.221774,3126.522 368.089774,3125 370.177774,3125 L370.999774,3125 C371.551774,3125 371.999774,3124.552 371.999774,3124 C371.999774,3123.448 371.551774,3123 370.999774,3123 L370.251774,3123 C366.965774,3123 364.100774,3125.532 364.002774,3128.815 C363.900774,3132.213 366.624774,3135 369.999774,3135 L370.999774,3135 C371.551774,3135 371.999774,3134.552 371.999774,3134 C371.999774,3133.448 371.551774,3133 370.999774,3133 M377.747774,3123 L376.999774,3123 C376.447774,3123 375.999774,3123.448 375.999774,3124 C375.999774,3124.552 376.447774,3125 376.999774,3125 L377.821774,3125 C379.909774,3125 381.777774,3126.522 381.979774,3128.6 C382.212774,3130.985 380.336774,3133 377.999774,3133 L376.999774,3133 C376.447774,3133 375.999774,3133.448 375.999774,3134 C375.999774,3135.104 376.999774,3135 377.999774,3135 C381.374774,3135 384.098774,3132.213 383.996774,3128.815 C383.898774,3125.532 381.033774,3123 377.747774,3123 M368.999774,3128 L378.999774,3128 C379.551774,3128 379.999774,3128.448 379.999774,3129 C379.999774,3130.346 379.210774,3130 368.999774,3130 C368.447774,3130 367.999774,3129.552 367.999774,3129 C367.999774,3128.448 368.447774,3128 368.999774,3128" transform="translate(-364,-3123)" />
                </svg>
                <span style={{ marginLeft: 6 }}>Unlisted</span>
              </button>
              <button type="button" aria-pressed={visibility===0} className={visibility===0 ? 'is-active' : ''} onClick={() => setVisibility(0)} title="Private">
                <svg className="ti" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" clipRule="evenodd" d="M19.7071 5.70711C20.0976 5.31658 20.0976 4.68342 19.7071 4.29289C19.3166 3.90237 18.6834 3.90237 18.2929 4.29289L14.032 8.55382C13.4365 8.20193 12.7418 8 12 8C9.79086 8 8 9.79086 8 12C8 12.7418 8.20193 13.4365 8.55382 14.032L4.29289 18.2929C3.90237 18.6834 3.90237 19.3166 4.29289 19.7071C4.68342 20.0976 5.31658 20.0976 5.70711 19.7071L9.96803 15.4462C10.5635 15.7981 11.2582 16 12 16C14.2091 16 16 14.2091 16 12C16 11.2582 15.7981 10.5635 15.4462 9.96803L19.7071 5.70711ZM12.518 10.0677C12.3528 10.0236 12.1792 10 12 10C10.8954 10 10 10.8954 10 12C10 12.1792 10.0236 12.3528 10.0677 12.518L12.518 10.0677ZM11.482 13.9323L13.9323 11.482C13.9764 11.6472 14 11.8208 14 12C14 13.1046 13.1046 14 12 14C11.8208 14 11.6472 13.9764 11.482 13.9323ZM15.7651 4.8207C14.6287 4.32049 13.3675 4 12 4C9.14754 4 6.75717 5.39462 4.99812 6.90595C3.23268 8.42276 2.00757 10.1376 1.46387 10.9698C1.05306 11.5985 1.05306 12.4015 1.46387 13.0302C1.92276 13.7326 2.86706 15.0637 4.21194 16.3739L5.62626 14.9596C4.4555 13.8229 3.61144 12.6531 3.18002 12C3.6904 11.2274 4.77832 9.73158 6.30147 8.42294C7.87402 7.07185 9.81574 6 12 6C12.7719 6 13.5135 6.13385 14.2193 6.36658L15.7651 4.8207ZM12 18C11.2282 18 10.4866 17.8661 9.78083 17.6334L8.23496 19.1793C9.37136 19.6795 10.6326 20 12 20C14.8525 20 17.2429 18.6054 19.002 17.0941C20.7674 15.5772 21.9925 13.8624 22.5362 13.0302C22.947 12.4015 22.947 11.5985 22.5362 10.9698C22.0773 10.2674 21.133 8.93627 19.7881 7.62611L18.3738 9.04043C19.5446 10.1771 20.3887 11.3469 20.8201 12C20.3097 12.7726 19.2218 14.2684 17.6986 15.5771C16.1261 16.9282 14.1843 18 12 18Z" />
                </svg>
                <span style={{ marginLeft: 6 }}>Private</span>
              </button>
            </div>
            <span className="toolbar-sep" role="separator" />
            <button
              type="button"
              onClick={async () => {
                if (!editSlug || isDeleting || isHomePage) return;
                const ok = await confirm({ title: 'Delete post', message: 'Delete this post? This cannot be undone.', confirmText: 'Delete', danger: true });
                if (!ok) return;
                setIsDeleting(true);
                const res = await fetch(`/api/posts/${encodeURIComponent(editSlug)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                  // Notify sidebar and go back to empty editor
                  if (typeof window !== 'undefined') window.dispatchEvent(new Event('posts:changed'));
                  setIsDeleting(false);
                  router.push('/editor');
                } else {
                  await alert({ title: 'Delete failed', message: 'Could not delete the post.', danger: true });
                  setIsDeleting(false);
                }
              }}
              title={isHomePage ? 'Home page cannot be deleted' : 'Delete'}
              disabled={!editSlug || isDeleting || isHomePage}
              style={!editSlug || isHomePage ? { opacity: 0.5, cursor: 'not-allowed' } : (isDeleting ? { opacity: 0.7, pointerEvents: 'none' } : undefined)}
            >
              <svg className="ti" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 3H15M4 7H20M18 7L17 21H7L6 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ marginLeft: 8 }}>{isHomePage ? 'Delete' : (isDeleting ? 'Deleting...' : 'Delete')}</span>
              {isDeleting ? <span style={{ marginLeft: 8 }}><Spinner size={14} /></span> : null}
            </button>
            <span className="toolbar-sep" role="separator" />
            <button type="button" onClick={() => onSave(false)} title="Save" disabled={isSaving} style={isSaving ? { opacity: 0.7, pointerEvents: 'none' } : undefined}>
              <svg className="ti ti-save" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path fillRule="evenodd" clipRule="evenodd" d="M18.1716 1C18.702 1 19.2107 1.21071 19.5858 1.58579L22.4142 4.41421C22.7893 4.78929 23 5.29799 23 5.82843V20C23 21.6569 21.6569 23 20 23H4C2.34315 23 1 21.6569 1 20V4C1 2.34315 2.34315 1 4 1H18.1716ZM4 3C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21L5 21L5 15C5 13.3431 6.34315 12 8 12L16 12C17.6569 12 19 13.3431 19 15V21H20C20.5523 21 21 20.5523 21 20V6.82843C21 6.29799 20.7893 5.78929 20.4142 5.41421L18.5858 3.58579C18.2107 3.21071 17.702 3 17.1716 3H17V5C17 6.65685 15.6569 8 14 8H10C8.34315 8 7 6.65685 7 5V3H4ZM17 21V15C17 14.4477 16.5523 14 16 14L8 14C7.44772 14 7 14.4477 7 15L7 21L17 21ZM9 3H15V5C15 5.55228 14.5523 6 14 6H10C9.44772 6 9 5.55228 9 5V3Z" fill="currentColor"/>
              </svg>
              <span style={{ marginLeft: 8 }}>{isSaving ? 'Saving...' : 'Save'}</span>
              {isSaving ? <span style={{ marginLeft: 8 }}><Spinner size={14} /></span> : null}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


