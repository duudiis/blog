import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { withAuth } from '@/lib/api';

type CommentRow = { id: number; post_id: number; author_email: string | null };

export const DELETE = withAuth(async (_req, { params, auth }) => {
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { slug, id } = await params;
    const commentId = Number(id);
    if (!Number.isFinite(commentId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const post = await get<{ id: number }>('SELECT id FROM posts WHERE slug = ?', [slug]);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const comment = await get<CommentRow>('SELECT id, post_id, author_email FROM comments WHERE id = ?', [commentId]);
    if (!comment || comment.post_id !== post.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = !!(auth.email && comment.author_email && auth.email.toLowerCase() === comment.author_email.toLowerCase());
    const isAdmin = !!auth.isAdmin;
    if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await run('DELETE FROM comments WHERE id = ?', [commentId]);
    return NextResponse.json({ ok: true });
}, { protected: true });


