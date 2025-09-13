"use client";

import { useEffect } from "react";
import { SITE_NAME } from "@/lib/site";

export default function LoadingEditor() {
  useEffect(() => {
    try { document.title = `Loading • ${SITE_NAME}`; } catch {}
  }, []);
  return (
    <article className="post" aria-busy="true">
      <div className="spinner" />
    </article>
  );
}


