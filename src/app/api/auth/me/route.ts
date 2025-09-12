import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';

export const GET = withAuth(async (_req, { auth }) => {
	if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
	const isAdmin = !!(adminEmail && (auth.email || '').toLowerCase() === adminEmail);
	return NextResponse.json({
		username: auth.username,
		email: auth.email,
		name: auth.name,
		picture: auth.picture,
		isAdmin: typeof auth.isAdmin === 'boolean' ? auth.isAdmin : isAdmin,
	});
});
