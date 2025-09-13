"use client";

import { useEffect, useRef } from "react";

type Props = {
	onCredential: (credential: string) => void;
};

type ScriptWithLoaded = HTMLScriptElement & { _loaded?: boolean };

export default function GoogleSignInButton({ onCredential }: Props) {
	const divRef = useRef<HTMLDivElement>(null);
	const callbackRef = useRef(onCredential);
	const initializedRef = useRef(false);
	const lastWidthRef = useRef<number | null>(null);
	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	const resizeHandlerRef = useRef<(() => void) | null>(null);

	// Keep latest callback without retriggering the main effect
	useEffect(() => {
		callbackRef.current = onCredential;
	}, [onCredential]);

	useEffect(() => {
		const scriptId = "google-identity-services";

		const ensureScript = () =>
			new Promise<void>((resolve) => {
				const existing = document.getElementById(scriptId) as ScriptWithLoaded | null;
				if (existing && existing._loaded) {
					resolve();
					return;
				}
				if (existing) {
					existing.addEventListener("load", () => resolve(), { once: true });
					return;
				}
				const s = document.createElement("script") as ScriptWithLoaded;
				s.src = "https://accounts.google.com/gsi/client";
				s.async = true;
				s.defer = true;
				s.id = scriptId;
				s.addEventListener("load", () => {
					s._loaded = true;
					resolve();
				}, { once: true });
				document.head.appendChild(s);
			});

		let cancelled = false;

		function renderButton() {
			const container = divRef.current;
			if (!container) return;
			const containerWidth = container.clientWidth || container.offsetWidth || 0;
			const width = Math.max(240, Math.min(400, containerWidth || 0));
			if (lastWidthRef.current === width) return;
			lastWidthRef.current = width;
			container.innerHTML = "";
			const w = window as unknown as Window & {
				google?: {
					accounts: {
						id: {
							renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
						};
					};
				};
			};
			w.google?.accounts.id.renderButton(container, {
				type: "standard",
				theme: "outline",
				text: "signin_with",
				size: "large",
				shape: "pill",
				logo_alignment: "left",
				width,
			});
		}

		function initOnce() {
			if (initializedRef.current) {
				renderButton();
				return;
			}
			const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
			if (!clientId) return;
			type GoogleId = {
				accounts: {
					id: {
						initialize: (opts: { client_id: string; callback: (resp: { credential?: string }) => void }) => void;
					};
				};
			};
			const w = window as unknown as Window & { google?: GoogleId };
			if (!w.google?.accounts?.id || !divRef.current) return;
			w.google.accounts.id.initialize({
				client_id: clientId,
				callback: (resp: { credential?: string }) => {
					if (resp?.credential) callbackRef.current(resp.credential);
				},
			});
			initializedRef.current = true;
			renderButton();
			// Observe size changes only once
			if (typeof ResizeObserver !== "undefined" && divRef.current) {
				resizeObserverRef.current?.disconnect();
				resizeObserverRef.current = new ResizeObserver(() => renderButton());
				resizeObserverRef.current.observe(divRef.current);
			} else {
				const handler = () => renderButton();
				if (resizeHandlerRef.current) {
					window.removeEventListener("resize", resizeHandlerRef.current);
				}
				resizeHandlerRef.current = handler;
				window.addEventListener("resize", handler);
			}
		}

		ensureScript().then(() => {
			if (!cancelled) initOnce();
		});

		return () => {
			cancelled = true;
			resizeObserverRef.current?.disconnect();
			resizeObserverRef.current = null;
			if (resizeHandlerRef.current) {
				window.removeEventListener("resize", resizeHandlerRef.current);
				resizeHandlerRef.current = null;
			}
		};
	}, []);

	return (
		<div style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"', width: '100%' }}>
			<div ref={divRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
		</div>
	);
}


