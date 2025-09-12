import { NextResponse } from 'next/server';
import { get, initializeDatabase } from '@/lib/db';

export async function GET(req: Request) {
    await initializeDatabase();
    // Prefer a truly random public post; fall back to latest public if needed
    const row = await get<{ slug: string }>(
        'SELECT slug FROM posts WHERE published = 1 ORDER BY RANDOM() LIMIT 1'
    );
    let targetSlug = row?.slug;
    if (!targetSlug) {
        const latest = await get<{ slug: string }>('SELECT slug FROM posts WHERE published = 1 ORDER BY datetime(created_at) DESC LIMIT 1');
        targetSlug = latest?.slug;
    }
    const url = new URL(req.url);
    const dest = targetSlug ? new URL(`/posts/${encodeURIComponent(targetSlug)}`, url) : new URL('/', url);
    return NextResponse.redirect(dest);
}


