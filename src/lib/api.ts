import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromHeader, verifyToken, JwtPayload } from '@/lib/auth';

export type AuthContext = { auth: JwtPayload | null };

type RouteParams = Record<string, string | string[]>;
type BasicRouteContext = { params: Promise<RouteParams> };

export type WithAuthHandler<C extends BasicRouteContext = BasicRouteContext> = (
	req: NextRequest,
	ctx: C & AuthContext
) => Promise<Response | NextResponse> | Response | NextResponse;

export type WithAuthOptions = {
	protected?: boolean;
};

export function withAuth<C extends BasicRouteContext = BasicRouteContext>(
	handler: WithAuthHandler<C>,
	options: WithAuthOptions = {}
) {
	return async (req: NextRequest, ctx: C) => {
		const authHeader = req.headers.get('authorization');
		const token = getTokenFromHeader(authHeader);
		const payload = token ? verifyToken(token) : null;
		const augmented = (() => {
			if (!payload) return null;
			try {
				const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
				const email = (payload.email || '').toLowerCase();
				return { ...payload, isAdmin: !!(adminEmail && email && email === adminEmail) } as JwtPayload;
			} catch {
				return payload;
			}
		})();

		if (options.protected && !augmented) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		return handler(req, Object.assign({}, ctx, { auth: augmented }));
	};
}


