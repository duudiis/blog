import { marked } from 'marked';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const windowLike = new JSDOM('').window as unknown as Window & typeof globalThis;
const DOMPurify = createDOMPurify(windowLike);

export function markdownToHtml(md: string) {
	const raw = marked.parse(md || '');
	const sanitized = DOMPurify.sanitize(String(raw), { USE_PROFILES: { html: true } });
	return enforceLinkAttributes(sanitized);
}

export function sanitizeHtml(html: string) {
	const sanitized = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
	return enforceLinkAttributes(sanitized);
}

function enforceLinkAttributes(html: string): string {
	try {
		const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
		const { document } = dom.window;
		const anchors = document.querySelectorAll('a[href]');
		anchors.forEach((a) => {
			a.setAttribute('target', '_blank');
			const existing = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
			const needed = ['noopener', 'noreferrer'];
			const merged = Array.from(new Set([...existing, ...needed]));
			a.setAttribute('rel', merged.join(' '));
		});
		return document.body.innerHTML;
	} catch {
		return html;
	}
}
