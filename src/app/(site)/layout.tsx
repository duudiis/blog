"use client";

import { Sidebar } from "@/components/Sidebar";
import { useEffect, useState } from "react";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      // @ts-expect-error: `addListener` exists on older browsers' MediaQueryList
      mql.addListener(onChange);
    }
    return () => {
      if ('removeEventListener' in mql) {
        mql.removeEventListener('change', onChange);
      } else if ('removeListener' in mql) {
        // @ts-expect-error: `removeListener` exists on older browsers' MediaQueryList
        mql.removeListener(onChange);
      }
    };
  }, [drawerOpen]);

  return (
    <main className={`container layout${drawerOpen ? ' has-drawer' : ''}`}>
      <aside className={`sidebar drawer${drawerOpen ? ' is-open' : ''}`} id="mobile-sidebar" aria-hidden={!drawerOpen}>
        <Sidebar />
      </aside>
      <section className="content">
        {children}
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


