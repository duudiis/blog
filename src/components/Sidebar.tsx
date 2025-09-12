"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export type SidebarPost = {
	id: number;
	slug: string;
	title: string;
	published: number;
	created_at: string;
};

function relativeTime(iso: string) {
	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
	const now = Date.now();
	const then = new Date(iso).getTime();
	const diffSec = Math.round((then - now) / 1000);
	const absSec = Math.abs(diffSec);
	const map: [Intl.RelativeTimeFormatUnit, number][] = [["year",31536000],["month",2592000],["week",604800],["day",86400],["hour",3600],["minute",60]];
	for (const [unit, sec] of map) { if (absSec >= sec) return rtf.format(Math.round(diffSec / sec), unit); }
	return rtf.format(diffSec, "second");
}

export function Sidebar({ activeSlug, editorMode = false }: { activeSlug?: string; editorMode?: boolean; }) {
	const [posts, setPosts] = useState<SidebarPost[]>([]);
	const [isAdmin, setIsAdmin] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [hasEverLoaded, setHasEverLoaded] = useState(false);
	const [hasError, setHasError] = useState(false);
	const listRef = useRef<HTMLUListElement | null>(null);
	const hasAutoScrolledRef = useRef(false);
	const router = useRouter();
	const params = useParams<{ slug?: string | string[] }>();
	const derivedSlug = (() => {
		try {
			const raw = params?.slug;
			if (!raw) return undefined;
			return Array.isArray(raw) ? raw[0] : String(raw);
		} catch {
			return undefined;
		}
	})();
	const currentActiveSlug = activeSlug ?? derivedSlug;

	function createNewPost() {
		// Navigate to empty editor page; creation happens on first Save
		router.push('/editor');
	}

	useEffect(() => {
		async function load(showSkeleton: boolean) {
			const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
			let isAdminNow = false;
			if (token) {
				try {
					const me = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
					if (me.ok) {
						const info = await me.json();
						isAdminNow = !!info?.isAdmin;
					}
				} catch {}
			}
			const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
			if (showSkeleton && !hasEverLoaded) setIsLoading(true);
			setHasError(false);
			try {
				const res = await fetch('/api/posts', { headers });
				if (!res.ok) {
					if (!hasEverLoaded) setPosts([]);
					setHasError(true);
					if (showSkeleton && !hasEverLoaded) setIsLoading(false);
					setIsAdmin(isAdminNow);
					return;
				}
				const list = await res.json();
				if (!Array.isArray(list)) {
					if (!hasEverLoaded) setPosts([]);
					setHasError(true);
					if (showSkeleton && !hasEverLoaded) setIsLoading(false);
					setIsAdmin(isAdminNow);
					return;
				}
				setPosts(list);
				if (showSkeleton && !hasEverLoaded) setIsLoading(false);
				if (!hasEverLoaded) setHasEverLoaded(true);
				setIsAdmin(isAdminNow);
			} catch {
				if (!hasEverLoaded) setPosts([]);
				setHasError(true);
				if (showSkeleton && !hasEverLoaded) setIsLoading(false);
				setIsAdmin(isAdminNow);
			}
		}
		const onChanged = () => { load(false); };
		load(true);
		if (typeof window !== 'undefined') window.addEventListener('posts:changed', onChanged);
		return () => { if (typeof window !== 'undefined') window.removeEventListener('posts:changed', onChanged); };
	}, [hasEverLoaded]);

	useEffect(() => {
		if (hasAutoScrolledRef.current) return;
		if (isLoading) return;
		const container = listRef.current;
		if (!container || !currentActiveSlug) return;
		const activeEl = container.querySelector('.post-item.is-active') as HTMLElement | null;
		if (activeEl) {
			activeEl.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
			hasAutoScrolledRef.current = true;
		}
	}, [isLoading, currentActiveSlug]);

	const sidebarErrorSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21.707,3.707,5.414,20H9a1,1,0,0,1,0,2H3a1.01,1.01,0,0,1-.382-.077,1,1,0,0,1-.541-.541A1.01,1.01,0,0,1,2,21V15a1,1,0,0,1,2,0v3.586L20.293,2.293a1,1,0,1,1,1.414,1.414ZM2,6a4,4,0,1,1,4,4A4,4,0,0,1,2,6ZM4,6A2,2,0,1,0,6,4,2,2,0,0,0,4,6Zm17.707,9.293a1,1,0,0,0-1.414,0L18.5,17.086l-1.793-1.793a1,1,0,0,0-1.414,1.414L17.086,18.5l-1.793,1.793a1,1,0,1,0,1.414,1.414L18.5,19.914l1.793,1.793a1,1,0,0,0,1.414-1.414L19.914,18.5l1.793-1.793A1,1,0,0,0,21.707,15.293Z" fill="currentColor"/></svg>`;

	const noPostsSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56.724 56.724" fill="none" aria-hidden="true">
  <path d="M7.487,46.862c1.111,1.467,2.865,2.275,4.938,2.275h30.598c3.984,0,7.934-3.009,8.991-6.849   l4.446-16.136c0.55-1.997,0.237-3.904-0.88-5.371c-1.118-1.467-2.873-2.274-4.945-2.274h-3.044l-0.667-2.65   c-0.692-2.759-4.368-4.919-8.367-4.919h-11.24c-2.932,0-4.935-0.6-5.413-0.94c-1.259-2.292-6.867-2.41-8-2.41h-7.27   c-2.036,0-3.845,0.798-5.093,2.249c-1.248,1.45-1.769,3.356-1.448,5.467l6.338,29.047C6.572,45.268,6.926,46.122,7.487,46.862z    M53.193,22.599c0.537,0.705,0.669,1.684,0.374,2.756l-4.445,16.137c-0.693,2.518-3.486,4.646-6.099,4.646H12.425   c-1.112,0-2.016-0.386-2.547-1.086c-0.531-0.701-0.657-1.676-0.356-2.746l3.057-10.858c0.709-2.518,3.518-4.646,6.133-4.646h9.751   c3.51,0,7.461-1.271,8.219-3.695c0.196-0.479,2.256-1.6,5.359-1.6h8.593C51.749,21.507,52.657,21.895,53.193,22.599z M3.815,11.792   c0.669-0.777,1.671-1.206,2.82-1.206h7.27c2.932,0,4.935,0.6,5.413,0.941c1.26,2.292,6.866,2.41,7.999,2.41h11.241   c2.743,0,5.144,1.399,5.458,2.65l0.482,1.919h-2.456c-3.511,0-7.461,1.271-8.219,3.695c-0.197,0.479-2.257,1.6-5.359,1.6h-9.751   c-3.979,0-7.942,3.001-9.021,6.832l-1.793,6.371L3.042,14.758C2.871,13.623,3.146,12.569,3.815,11.792z" fill="currentColor"/>
</svg>`;

	return (
		<ul ref={listRef} className="post-list slide-in stagger-list">
			{editorMode ? (
				<li className={`post-item${currentActiveSlug === 'home' ? ' is-active' : ''}`} onClick={() => router.push('/editor/home')}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
						<strong style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
								<path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15C14.4477 21 14 20.5523 14 20V15C14 14.4477 13.5523 14 13 14H11C10.4477 14 10 14.4477 10 15V20C10 20.5523 9.55228 21 9 21H4C3.44772 21 3 20.5523 3 20V10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
							Home Page
						</strong>
					</div>
				</li>
			) : null}
			{editorMode ? (<li className="post-sep" aria-hidden />) : null}
			{editorMode ? (
				<li className={`post-item${!activeSlug ? ' is-active' : ''}`} onClick={() => createNewPost()}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
						<strong style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
								<path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
							</svg>
							New Post
						</strong>
					</div>
				</li>
			) : null}
			{editorMode ? (<li className="post-sep" aria-hidden />) : null}
			{isLoading ? (
				<>
					{Array.from({ length: 8 }).map((_, i) => (
						<li key={`sk-${i}`} className="post-item" aria-busy="true" style={{ animationDelay: `${i * 0.04}s` }}>
							<div className="skeleton skeleton-title" />
							<div className="skeleton skeleton-meta" />
						</li>
					))}
				</>
			) : null}
			{!isLoading && hasError ? (
				<li className="post-item is-static mt-5" style={{ padding: 0 }}>
					<div className="empty-state" role="status" aria-live="polite">
						<div className="empty-icon" dangerouslySetInnerHTML={{ __html: sidebarErrorSvg }} />
						<h2 className="empty-title">Couldn&apos;t load posts</h2>
						<p className="empty-desc">Sidebar had a tiny meltdown. Please refresh.</p>
					</div>
				</li>
			) : null}
			{!isLoading && !hasError && posts.length === 0 ? (
				<li className="post-item is-static mt-5" style={{ padding: 0 }}>
					<div className="empty-state" role="status" aria-live="polite">
						<div className="empty-icon" dangerouslySetInnerHTML={{ __html: noPostsSvg }} />
						<h2 className="empty-title">No posts yet</h2>
						<p className="empty-desc">Nothing to see here... yet.</p>
					</div>
				</li>
			) : null}
			{posts.map((p, i) => {
				const active = p.slug === currentActiveSlug ? ' is-active' : '';
				return (
					<li key={p.slug} className={`post-item${active}`} style={{ animationDelay: `${i * 0.04}s` }} onClick={(e) => {
						const t = e.target as HTMLElement;
						if (t.tagName.toLowerCase() === 'a') return;
						if (active) return;
						router.push(editorMode ? `/editor/${encodeURIComponent(p.slug)}` : `/posts/${encodeURIComponent(p.slug)}`);
						try { window.dispatchEvent(new CustomEvent('drawer:close')); } catch {}
					}}>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
							<Link href={editorMode ? `/editor/${encodeURIComponent(p.slug)}` : `/posts/${encodeURIComponent(p.slug)}`} onClick={() => { try { window.dispatchEvent(new CustomEvent('drawer:close')); } catch {} }}><strong>{p.title}</strong></Link>
						</div>
						<div className="post-meta">
							{isAdmin ? (
								<>
									<span className="meta" style={{ display: 'inline-flex', alignItems: 'center' }}>
										{p.published === 1 ? (
											<svg className="meta-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-label="Public"><path d="M3 12H21M3 12C3 16.9706 7.02944 21 12 21M3 12C3 7.02944 7.02944 3 12 3M21 12C21 16.9706 16.9706 21 12 21M21 12C21 7.02944 16.9706 3 12 3M12 21C4.75561 13.08 8.98151 5.7 12 3M12 21C19.2444 13.08 15.0185 5.7 12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
										) : p.published === 2 ? (
											<svg className="meta-icon meta-icon-unlisted" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-label="Unlisted"><path d="M370.999774,3133 L369.999774,3133 C367.662774,3133 365.786774,3130.985 366.019774,3128.6 C366.221774,3126.522 368.089774,3125 370.177774,3125 L370.999774,3125 C371.551774,3125 371.999774,3124.552 371.999774,3124 C371.999774,3123.448 371.551774,3123 370.999774,3123 L370.251774,3123 C366.965774,3123 364.100774,3125.532 364.002774,3128.815 C363.900774,3132.213 366.624774,3135 369.999774,3135 L370.999774,3135 C371.551774,3135 371.999774,3134.552 371.999774,3134 C371.999774,3133.448 371.551774,3133 370.999774,3133 M377.747774,3123 L376.999774,3123 C376.447774,3123 375.999774,3123.448 375.999774,3124 C375.999774,3124.552 376.447774,3125 376.999774,3125 L377.821774,3125 C379.909774,3125 381.777774,3126.522 381.979774,3128.6 C382.212774,3130.985 380.336774,3133 377.999774,3133 L376.999774,3133 C376.447774,3133 375.999774,3133.448 375.999774,3134 C375.999774,3135.104 376.999774,3135 377.999774,3135 C381.374774,3135 384.098774,3132.213 383.996774,3128.815 C383.898774,3125.532 381.033774,3123 377.747774,3123 M368.999774,3128 L378.999774,3128 C379.551774,3128 379.999774,3128.448 379.999774,3129 C379.999774,3130.346 379.210774,3130 368.999774,3130 C368.447774,3130 367.999774,3129.552 367.999774,3129 C367.999774,3128.448 368.447774,3128 368.999774,3128" transform="translate(-364,-3123)"/></svg>
										) : (
											<svg className="meta-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="Private"><path fillRule="evenodd" clipRule="evenodd" d="M19.7071 5.70711C20.0976 5.31658 20.0976 4.68342 19.7071 4.29289C19.3166 3.90237 18.6834 3.90237 18.2929 4.29289L14.032 8.55382C13.4365 8.20193 12.7418 8 12 8C9.79086 8 8 9.79086 8 12C8 12.7418 8.20193 13.4365 8.55382 14.032L4.29289 18.2929C3.90237 18.6834 3.90237 19.3166 4.29289 19.7071C4.68342 20.0976 5.31658 20.0976 5.70711 19.7071L9.96803 15.4462C10.5635 15.7981 11.2582 16 12 16C14.2091 16 16 14.2091 16 12C16 11.2582 15.7981 10.5635 15.4462 9.96803L19.7071 5.70711ZM12.518 10.0677C12.3528 10.0236 12.1792 10 12 10C10.8954 10 10 10.8954 10 12C10 12.1792 10.0236 12.3528 10.0677 12.518L12.518 10.0677ZM11.482 13.9323L13.9323 11.482C13.9764 11.6472 14 11.8208 14 12C14 13.1046 13.1046 14 12 14C11.8208 14 11.6472 13.9764 11.482 13.9323ZM15.7651 4.8207C14.6287 4.32049 13.3675 4 12 4C9.14754 4 6.75717 5.39462 4.99812 6.90595C3.23268 8.42276 2.00757 10.1376 1.46387 10.9698C1.05306 11.5985 1.05306 12.4015 1.46387 13.0302C1.92276 13.7326 2.86706 15.0637 4.21194 16.3739L5.62626 14.9596C4.4555 13.8229 3.61144 12.6531 3.18002 12C3.6904 11.2274 4.77832 9.73158 6.30147 8.42294C7.87402 7.07185 9.81574 6 12 6C12.7719 6 13.5135 6.13385 14.2193 6.36658L15.7651 4.8207ZM12 18C11.2282 18 10.4866 17.8661 9.78083 17.6334L8.23496 19.1793C9.37136 19.6795 10.6326 20 12 20C14.8525 20 17.2429 18.6054 19.002 17.0941C20.7674 15.5772 21.9925 13.8624 22.5362 13.0302C22.947 12.4015 22.947 11.5985 22.5362 10.9698C22.0773 10.2674 21.133 8.93627 19.7881 7.62611L18.3738 9.04043C19.5446 10.1771 20.3887 11.3469 20.8201 12C20.3097 12.7726 19.2218 14.2684 17.6986 15.5771C16.1261 16.9282 14.1843 18 12 18Z"/></svg>
										)}
										<span className="meta-label" style={{ marginLeft: 4 }}>{p.published === 1 ? 'Public' : (p.published === 2 ? 'Unlisted' : 'Private')}</span>
									</span>
									{' · '}
								</>
							) : null}
							{relativeTime(p.created_at)}
						</div>
					</li>
				);
			})}
		</ul>
	);
}


