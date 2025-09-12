"use client";

import { useEffect, useRef } from "react";

type Props = {
  onCredential: (credential: string) => void;
};

export default function GoogleSignInButton({ onCredential }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Load Google Identity Services script if not present
    const id = "google-identity-services";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.id = id;
      s.onload = () => init();
      document.head.appendChild(s);
    } else {
      init();
    }

    function init() {
      const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
      if (!clientId) return;
      type GoogleId = {
        accounts: {
          id: {
            initialize: (opts: { client_id: string; callback: (resp: { credential?: string }) => void }) => void;
            renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          };
        };
      };
      const w = window as unknown as Window & { google?: GoogleId };
      if (w.google && w.google.accounts && divRef.current) {
        w.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: { credential?: string }) => {
            if (resp && resp.credential) onCredential(resp.credential);
          },
        });
        const render = () => {
          if (!divRef.current) return;
          const containerWidth = 320;
          const width = Math.max(240, containerWidth);
          divRef.current.innerHTML = "";
          w.google!.accounts.id.renderButton(divRef.current, {
            type: "standard",
            theme: "outline",
            text: "signin_with",
            size: "large",
            shape: "pill",
            logo_alignment: "left",
            width,
          });
        };
        render();
        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(() => render());
          ro.observe(divRef.current);
        } else {
          window.addEventListener('resize', render);
        }
      }
    }
  }, [onCredential]);

  return (
    <div style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"', width: '100%' }}>
      <div ref={divRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}


