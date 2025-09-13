"use client";

import { useEffect } from "react";
import { SITE_NAME } from "@/lib/site";
import Spinner from "@/components/Spinner";

export default function LoadingPost() {
  useEffect(() => {
    try { document.title = `Loading • ${SITE_NAME}`; } catch {}
  }, []);
  return (
    <article className="post">
      <div className="post-content" aria-busy="true">
        <div className="fade-in">
          <Spinner size={32} stroke={3} />
        </div>
      </div>
    </article>
  );
}


