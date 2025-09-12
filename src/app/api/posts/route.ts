import { NextResponse } from 'next/server';
import { all, get, initializeDatabase, run } from '@/lib/db';
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

export const GET = withAuth(async (_req, ctx) => {
	await initializeDatabase();
	const isAdmin = !!(ctx.auth && ctx.auth.isAdmin);
	const rows = await all(
		`SELECT id, slug, title, cover_image, published, created_at, updated_at FROM posts WHERE slug != 'home' ${isAdmin ? '' : 'AND published = 1'} ORDER BY datetime(created_at) DESC`
	);
	return NextResponse.json(rows);
});

export const POST = withAuth(async (req, ctx) => {
	if (!ctx.auth || !ctx.auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	await initializeDatabase();
	const body = await req.json().catch(() => ({}));
	const { title, slug, contentMd, contentHtml, published, coverImage, visibility, publishedState } = body || {};
	if (!title || (!contentMd && !contentHtml)) return NextResponse.json({ error: 'Missing title or content' }, { status: 400 });
	const finalSlug = (slug || title).toString().trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 100);
	if (finalSlug === 'home') return NextResponse.json({ error: 'Reserved slug' }, { status: 400 });
	const now = new Date().toISOString();
	const html = contentHtml ? sanitizeHtml(contentHtml) : markdownToHtml(contentMd);
	const md = contentMd ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
	// 0 = private, 1 = public, 2 = unlisted
	let publishedNum: number;
	if (typeof publishedState === 'number' && [0,1,2].includes(publishedState)) {
		publishedNum = publishedState;
	} else if (typeof visibility === 'string') {
		const map: Record<string, number> = { public: 1, private: 0, unlisted: 2 };
		publishedNum = map[visibility] ?? (published ? 1 : 0);
	} else if (typeof published === 'boolean') {
		publishedNum = published ? 1 : 0;
	} else {
		publishedNum = 0;
	}
	try {
		await run(
			`INSERT INTO posts (slug, title, content_md, content_html, cover_image, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[finalSlug, title, md, html, coverImage || null, publishedNum, now, now]
		);
		const row = await get<PostRow>('SELECT * FROM posts WHERE slug = ?', [finalSlug]);
		return NextResponse.json(row, { status: 201 });
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes('UNIQUE constraint failed: posts.slug')) {
			return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
		}
		return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
	}
}, { protected: true });
