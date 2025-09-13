"use client";

import { useEffect } from "react";
import { SITE_NAME } from "@/lib/site";

export default function LoadingEditorIndex() {
  useEffect(() => {
    try { document.title = `Loading • ${SITE_NAME}`; } catch {}
  }, []);
  return (
    <article className="post fade-in" aria-busy="true">
      <div className="spinner" />
    </article>
  );
}


