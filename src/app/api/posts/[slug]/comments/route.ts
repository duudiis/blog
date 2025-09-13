import { NextRequest, NextResponse } from 'next/server';
import { all, get, initializeDatabase, run } from '@/lib/db';
import { withAuth } from '@/lib/api';
import { MAX_COMMENT_LENGTH } from '@/lib/site';

type CommentRow = { id: number; author_email?: string; author_name?: string; author_picture?: string; content: string; created_at: string };

export const GET = withAuth(async (_req, { params, auth }) => {
    await initializeDatabase();
    const { slug } = await params;
    const post = await get<{ id: number; published: number }>('SELECT id, published FROM posts WHERE slug = ?', [slug]);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Hide private posts' existence from non-admins
    if (post.published === 0 && !(auth && auth.isAdmin)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const rows = await all<CommentRow>(
        'SELECT id, author_email, author_name, author_picture, content, created_at FROM comments WHERE post_id = ? ORDER BY datetime(created_at) ASC',
        [post.id]
    );
    return NextResponse.json(rows);
});

export const POST = withAuth(async (req: NextRequest, { params, auth }) => {
    await initializeDatabase();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { slug } = await params;
    const post = await get<{ id: number; published: number }>('SELECT id, published FROM posts WHERE slug = ?', [slug]);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Private posts: only admins can interact, and we still respond with 404
    const isAdmin = !!auth.isAdmin;
    if (post.published === 0 && !isAdmin) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const content = (body.content || '').toString().trim();
    if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });
    // Enforce max comment length
    if (content.length > MAX_COMMENT_LENGTH) {
        return NextResponse.json({ error: `Comment is too long (max ${MAX_COMMENT_LENGTH} characters).` }, { status: 400 });
    }
    // Enforce max 3 comments per user per post (except admins)
    if (!isAdmin) {
        const authorEmail = (auth.email || '').toLowerCase();
        const existing = await get<{ count: number }>(
            'SELECT COUNT(1) AS count FROM comments WHERE post_id = ? AND LOWER(author_email) = ?'
            , [post.id, authorEmail]
        );
        if ((existing?.count || 0) >= 3) {
            return NextResponse.json({ error: 'You have reached the comment limit (3) for this post.' }, { status: 429 });
        }
    }
    const now = new Date().toISOString();
    await run(
        'INSERT INTO comments (post_id, author_email, author_name, author_picture, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [post.id, auth.email || '', auth.name || auth.username, auth.picture || '', content, now]
    );
    const created = await get<CommentRow>('SELECT id, author_email, author_name, author_picture, content, created_at FROM comments WHERE rowid = last_insert_rowid()');
    return NextResponse.json(created, { status: 201 });
}, { protected: true });


