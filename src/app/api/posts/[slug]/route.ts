import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { withAuth } from '@/lib/api';
import { markdownToHtml, sanitizeHtml } from '@/lib/content';

type PostRow = {
	id: number;
	slug: string;
	title: string;
	content_md: string;
	content_html: string;
	cover_image: string | null;
	published: number;
	created_at: string;
	updated_at: string;
};

export const GET = withAuth(async (_req, { params, auth }) => {
	const { slug } = await params;
	const post = await get<PostRow>('SELECT * FROM posts WHERE slug = ?', [slug]);
	if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
	// Access rules: 1=public, 2=unlisted (viewable via link), 0=private (admin only)
	if (post.published === 0) {
		if (!auth || !auth.isAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
	}
	return NextResponse.json(post);
});

export const PUT = withAuth(async (req, { params, auth }) => {
	if (!auth || !auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const { slug } = await params;
	const current = await get<PostRow>('SELECT * FROM posts WHERE slug = ?', [slug]);
	if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
	if (slug === 'home') {
		// Home page: allow editing title/content/cover/published, but do not allow renaming slug
		const body = await req.json().catch(() => ({}));
		const { title, contentMd, contentHtml, published, visibility, publishedState, coverImage } = body || {};
		const newTitle = title ?? current.title;
		const newHtml = contentHtml ? sanitizeHtml(contentHtml) : (contentMd ? markdownToHtml(contentMd) : current.content_html);
		const newMd = contentMd ?? (contentHtml ? newHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : current.content_md);
		const newCover = coverImage === undefined ? current.cover_image : coverImage;
		let newPublished: number;
		if (typeof publishedState === 'number' && [0,1,2].includes(publishedState)) newPublished = publishedState; else
		if (typeof visibility === 'string') { const map: Record<string, number> = { public: 1, private: 0, unlisted: 2 }; newPublished = map[visibility] ?? (typeof published === 'boolean' ? (published ? 1 : 0) : current.published); }
		else if (typeof published === 'boolean') newPublished = published ? 1 : 0; else newPublished = current.published;
		const now = new Date().toISOString();
		await run(`UPDATE posts SET title = ?, content_md = ?, content_html = ?, cover_image = ?, published = ?, updated_at = ? WHERE id = ?`, [newTitle, newMd, newHtml, newCover, newPublished, now, current.id]);
		const updated = await get<PostRow>('SELECT * FROM posts WHERE id = ?', [current.id]);
		return NextResponse.json(updated);
	}
	const body = await req.json().catch(() => ({}));
	const { title, slug: newSlugRaw, contentMd, contentHtml, published, coverImage, visibility, publishedState } = body || {};
	const newTitle = title ?? current.title;
	const newSlug = newSlugRaw ? newSlugRaw.toString().trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 100) : current.slug;
	const newHtml = contentHtml ? sanitizeHtml(contentHtml) : (contentMd ? markdownToHtml(contentMd) : current.content_html);
	const newMd = contentMd ?? (contentHtml ? newHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : current.content_md);
	const newCover = coverImage === undefined ? current.cover_image : coverImage;
	let newPublished: number;
	if (typeof publishedState === 'number' && [0,1,2].includes(publishedState)) newPublished = publishedState; else
	if (typeof visibility === 'string') { const map: Record<string, number> = { public: 1, private: 0, unlisted: 2 }; newPublished = map[visibility] ?? (typeof published === 'boolean' ? (published ? 1 : 0) : current.published); }
	else if (typeof published === 'boolean') newPublished = published ? 1 : 0; else newPublished = current.published;
	const now = new Date().toISOString();
	try {
		await run(`UPDATE posts SET slug = ?, title = ?, content_md = ?, content_html = ?, cover_image = ?, published = ?, updated_at = ? WHERE id = ?`, [newSlug, newTitle, newMd, newHtml, newCover, newPublished, now, current.id]);
		const updated = await get<PostRow>('SELECT * FROM posts WHERE id = ?', [current.id]);
		return NextResponse.json(updated);
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes('UNIQUE constraint failed: posts.slug')) {
			return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
		}
		return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
	}
}, { protected: true });

export const DELETE = withAuth(async (_req, { params, auth }) => {
	if (!auth || !auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	const { slug } = await params;
	if (slug === 'home') return NextResponse.json({ error: 'Cannot delete home page' }, { status: 400 });
	const current = await get<PostRow>('SELECT * FROM posts WHERE slug = ?', [slug]);
	if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
	await run('DELETE FROM posts WHERE id = ?', [current.id]);
	return NextResponse.json({ ok: true });
}, { protected: true });
