export type SqlRunInfo = { lastID?: number; changes?: number };

import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'blog.db');

function ensureDirs() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
}

export const db = new sqlite3.Database(DB_PATH);

export function run(sql: string, params: unknown[] = []): Promise<SqlRunInfo> {
	return new Promise((resolve, reject) => {
		db.run(sql, params, function (err) {
			if (err) return reject(err);
			resolve({ lastID: this.lastID, changes: this.changes });
		});
	});
}

export function get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
	return new Promise((resolve, reject) => {
		db.get(sql, params, (err, row) => {
			if (err) return reject(err);
			resolve(row as T | undefined);
		});
	});
}

export function all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
	return new Promise((resolve, reject) => {
		db.all(sql, params, (err, rows) => {
			if (err) return reject(err);
			resolve(rows as T[]);
		});
	});
}

export async function initializeDatabase() {
	ensureDirs();
	await run(`CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL
	)`);
	await run(`CREATE TABLE IF NOT EXISTS posts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		slug TEXT UNIQUE NOT NULL,
		title TEXT NOT NULL,
		content_md TEXT NOT NULL,
		content_html TEXT NOT NULL,
		cover_image TEXT,
		published INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`);

	await run(`CREATE TABLE IF NOT EXISTS comments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		post_id INTEGER NOT NULL,
		author_email TEXT,
		author_name TEXT,
		author_picture TEXT,
		content TEXT NOT NULL,
		created_at TEXT NOT NULL,
		FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
	)`);

	// Seed admin user if none exists
	const row = await get<{ count: number }>('SELECT COUNT(1) as count FROM users');
	if (!row || row.count === 0) {
		const username = process.env.ADMIN_USERNAME || 'admin';
		const password = process.env.ADMIN_PASSWORD || 'admin';
		const passwordHash = await bcrypt.hash(password, 10);
		await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
	}

	// Ensure a special Home page exists
	const home = await get<{ id: number }>('SELECT id FROM posts WHERE slug = ? LIMIT 1', ['home']);
	if (!home) {
		const now = new Date().toISOString();
		await run(
			'INSERT INTO posts (slug, title, content_md, content_html, cover_image, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			['home', 'Home', '', '', null, 1, now, now]
		);
	}
}
