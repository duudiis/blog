import { NextResponse } from 'next/server';

export async function POST() {
	return NextResponse.json({ error: 'Username/password login disabled. Use Google.' }, { status: 400 });
}
