"use client";

import { Sidebar } from "@/components/Sidebar";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import Spinner from "@/components/Spinner";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug?: string | string[] }>();
  const slug = params?.slug ? (Array.isArray(params.slug) ? params.slug[0] : String(params.slug)) : undefined;
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ email?: string; name?: string; username?: string; picture?: string; isAdmin?: boolean } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function recheck() {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!t) { setAllowed(false); setUser(null); return; }
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) { setAllowed(false); setUser(null); return; }
      const info = await res.json();
      setUser(info);
      setAllowed(!!info?.isAdmin);
    } catch {
      setAllowed(false);
      setUser(null);
    }
  }

  useEffect(() => {
    recheck();
  }, []);

  useEffect(() => {
    const onToggle = () => setDrawerOpen((v) => !v);
    const onClose = () => setDrawerOpen(false);
    window.addEventListener('drawer:toggle', onToggle as EventListener);
    window.addEventListener('drawer:close', onClose as EventListener);
    return () => {
      window.removeEventListener('drawer:toggle', onToggle as EventListener);
      window.removeEventListener('drawer:close', onClose as EventListener);
    };
  }, []);

  useEffect(() => {
    if (drawerOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.classList.add('drawer-open');
    } else {
      document.documentElement.style.overflow = '';
      document.documentElement.classList.remove('drawer-open');
    }
  }, [drawerOpen]);

  // Close drawer when switching to desktop view
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 860px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) setDrawerOpen(false);
    };
    // Ensure closed if already desktop on mount
    if (!mql.matches && drawerOpen) setDrawerOpen(false);
    if ('addEventListener' in mql) {
      mql.addEventListener('change', onChange);
    } else if ('addListener' in mql) {
      // @ts-expect-error: legacy MediaQueryList has addListener
      mql.addListener(onChange);
    }
    return () => {
      if ('removeEventListener' in mql) {
        mql.removeEventListener('change', onChange);
      } else if ('removeListener' in mql) {
        // @ts-expect-error: legacy MediaQueryList has removeListener
        mql.removeListener(onChange);
      }
    };
  }, [drawerOpen]);

  return (
    <main className={`container layout${drawerOpen ? ' has-drawer' : ''}`}>
      <aside className={`sidebar drawer${drawerOpen ? ' is-open' : ''}`} id="mobile-sidebar" aria-hidden={!drawerOpen}>
        <Sidebar editorMode activeSlug={slug} />
      </aside>
      <section className="content">
        {allowed === null ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
            <div className="fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <Spinner size={28} stroke={3} />
              <span className="post-meta">Checking access…</span>
            </div>
          </div>
        ) : allowed ? (
          children
        ) : (
          <div className="empty-state fade-in" role="status" aria-live="polite" style={{ maxWidth: 520, margin: '0 auto', paddingTop: 60 }}>
            <div style={{ display: 'grid', placeItems: 'center', marginBottom: 28, color: 'var(--muted-foreground)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 20 20" aria-hidden="true">
                <rect x="0" fill="none" width="20" height="20" />
                <g>
                  <path fill="currentColor" d="M16.95 2.58c1.96 1.95 1.96 5.12 0 7.07-1.51 1.51-3.75 1.84-5.59 1.01l-1.87 3.31-2.99.31L5 18H2l-1-2 7.95-7.69c-.92-1.87-.62-4.18.93-5.73 1.95-1.96 5.12-1.96 7.07 0zm-2.51 3.79c.74 0 1.33-.6 1.33-1.34 0-.73-.59-1.33-1.33-1.33-.73 0-1.33.6-1.33 1.33 0 .74.6 1.34 1.33 1.34z" />
                </g>
              </svg>
            </div>
            {user ? (
              <div style={{ display: 'grid', gap: 12, marginBottom: 28, justifyItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {user.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.picture} alt={(user.name || user.username || user.email || 'User') + ' avatar'} width={42} height={42} style={{ borderRadius: 9999, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 42, height: 42, borderRadius: 9999, background: '#e5e7eb', display: 'grid', placeItems: 'center', fontWeight: 600 }}>
                      {(user.name || user.username || user.email || '?').toString().slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div style={{ display: 'grid' }}>
                    <span className="post-meta">Currently signed in as</span>
                    <span className="empty-title" style={{ margin: 0, fontSize: 18 }}>{user.name || user.username || user.email}</span>
                  </div>
                </div>
                <p className="empty-desc" style={{ margin: 0, textAlign: 'center' }}>This account is not an admin. If this is unexpected, contact the site owner.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12, marginBottom: 28 }}>
                <h2 className="empty-title" style={{ margin: 0, textAlign: 'center' }}>Admin sign in required</h2>
                <p className="empty-desc" style={{ margin: 0, textAlign: 'center' }}>Sign in with Google to access the editor.</p>
              </div>
            )}
            <GoogleSignInButton onCredential={async (cred) => {
              try {
                const res = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: cred }) });
                if (!res.ok) { setAllowed(false); setUser(null); return; }
                const info = await res.json();
                try { localStorage.setItem('token', info.token); } catch {}
                if (typeof window !== 'undefined') window.dispatchEvent(new Event('posts:changed'));
                // Immediately re-validate access (requires admin email match server-side)
                await recheck();
              } catch {
                setAllowed(false);
                setUser(null);
              }
            }} />
          </div>
        )}
      </section>
      <button
        className={`drawer-overlay${drawerOpen ? ' is-visible' : ''}`}
        aria-hidden={!drawerOpen}
        aria-label="Close menu"
        onClick={() => setDrawerOpen(false)}
      />
    </main>
  );
}


