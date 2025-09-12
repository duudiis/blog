import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { withAuth } from '@/lib/api';

export const runtime = 'nodejs';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

export const POST = withAuth(async (req) => {
	const form = await req.formData();
	const file = form.get('image');
	if (!file || !(file instanceof Blob)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
	const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
	// Blob in the edge/runtime may expose a `type` property at runtime but not in the TS lib
	// Prefer feature detection and narrow via `in` operator
	const mime = 'type' in file && typeof (file as Blob & { type?: string }).type === 'string'
		? (file as Blob & { type?: string }).type || 'application/octet-stream'
		: 'application/octet-stream';
	if (!allowed.includes(mime)) return NextResponse.json({ error: 'Only image uploads are allowed.' }, { status: 400 });
	const arrayBuffer = await file.arrayBuffer();
	fs.mkdirSync(UPLOADS_DIR, { recursive: true });
	const ext = mime === 'image/png' ? '.png' : mime === 'image/gif' ? '.gif' : mime === 'image/webp' ? '.webp' : '.jpg';
	const filename = `image-${Date.now()}${ext}`;
	const filepath = path.join(UPLOADS_DIR, filename);
	fs.writeFileSync(filepath, Buffer.from(arrayBuffer));
	const publicPath = `/uploads/${filename}`;
	return NextResponse.json({ url: publicPath }, { status: 201 });
}, { protected: true });
