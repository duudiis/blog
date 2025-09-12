import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import type { TokenPayload } from 'google-auth-library';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

export async function POST(req: NextRequest) {
    if (!clientId) return NextResponse.json({ error: 'Missing Google client id' }, { status: 500 });
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        body = {};
    }
    const maybeBody = body as Partial<{ idToken: string; credential: string; token: string }> | undefined;
    const idToken = maybeBody && typeof maybeBody.idToken === 'string' ? maybeBody.idToken
        : maybeBody && typeof maybeBody.credential === 'string' ? maybeBody.credential
        : maybeBody && typeof maybeBody.token === 'string' ? maybeBody.token
        : undefined;
    if (!idToken) return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });

    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(clientId);
    try {
        const ticket = await client.verifyIdToken({ idToken, audience: clientId });
        const payload = ticket.getPayload() as TokenPayload | undefined;
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        const email = (payload.email || '').toLowerCase();
        const name = payload.name || email || 'User';
        const picture = payload.picture || '';
        const sub = payload.sub || email || '';
        const isAdmin = !!(adminEmail && email === adminEmail);

        const token = signToken({
            id: String(sub),
            username: email || name,
            email,
            name,
            picture,
            isAdmin,
        });
        return NextResponse.json({ token, email, name, picture, isAdmin });
    } catch {
        return NextResponse.json({ error: 'Token verification failed' }, { status: 401 });
    }
}


