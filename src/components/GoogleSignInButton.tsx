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
      s.onerror = () => {
        if (divRef.current) {
          divRef.current.textContent = "Google sign-in script failed to load.";
        }
        try { console.warn("[GIS] Failed to load https://accounts.google.com/gsi/client"); } catch {}
      };
      document.head.appendChild(s);
    } else {
      init();
    }

    function init() {
      const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
      try { console.debug("[GIS] clientId present:", !!clientId); } catch {}
      if (!clientId) {
        if (divRef.current) {
          divRef.current.setAttribute('data-gsi-status', 'no-client-id');
          divRef.current.textContent = "Sign in unavailable.";
        }
        return;
      }
      type GoogleId = {
        accounts: {
          id: {
            initialize: (opts: { client_id: string; callback: (resp: { credential?: string }) => void }) => void;
            renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          };
        };
      };
      const w = window as unknown as Window & { google?: GoogleId };
      const tryRender = (attemptsLeft: number) => {
        if (!divRef.current) return;
        if (w.google && w.google.accounts && w.google.accounts.id && typeof w.google.accounts.id.renderButton === 'function') {
          try { divRef.current.setAttribute('data-gsi-status', 'rendering'); } catch {}
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
            try { divRef.current.setAttribute('data-gsi-status', 'rendered'); } catch {}
          };
          render();
          if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => render());
            ro.observe(divRef.current);
          } else {
            window.addEventListener('resize', render);
          }
        } else if (attemptsLeft > 0) {
          try { console.debug("[GIS] window.google not ready, retrying...", { attemptsLeft }); } catch {}
          setTimeout(() => tryRender(attemptsLeft - 1), 300);
        } else {
          if (divRef.current) {
            divRef.current.setAttribute('data-gsi-status', 'google-not-ready');
            divRef.current.textContent = "Google sign-in unavailable.";
          }
        }
      };
      tryRender(10);
    }
  }, [onCredential]);

  return (
    <div style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"', width: '100%' }}>
      <div ref={divRef} data-gsi="container" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}


