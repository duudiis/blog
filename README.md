# Blog Platform (Next.js + SQLite)

A lightweight blog platform built with Next.js App Router, SQLite, and a minimal JWT-based auth layer with optional Google Sign-In. It includes a simple editor, post CRUD via API routes, image uploads, and a comments system.

## Features
- Posts stored in a local SQLite database (`data/blog.db`)
- Public, Private, and Unlisted visibility for posts
- JWT auth with Google Sign-In support and admin role via `ADMIN_EMAIL`
- Simple editor UI at `/editor` for creating and editing posts
- Comments with per-user rate limits and admin/owner deletion
- Image uploads to `public/uploads`
- Clean, responsive UI
- Ready-to-run Docker image with persistent volumes

## Quick start
1. Install dependencies:
   ```bash
   npm ci
   ```
2. Run the dev server (port 3001):
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3001`.

The database and tables are created on first API access. An initial admin user is seeded from `ADMIN_USERNAME`/`ADMIN_PASSWORD` (defaults to `admin`/`admin`). Admin capabilities in the app are determined by `ADMIN_EMAIL` when using Google Sign-In.

## Scripts
- `npm run dev` — Start Next.js dev server on port 3001
- `npm run build` — Build the production app
- `npm run start` — Start production server (uses `PORT`, default 3000)
- `npm run lint` — Run ESLint

## Environment variables
Set these in your shell or a `.env.local` file.

- `NEXT_PUBLIC_BASE_URL` — Site base URL (e.g. `https://example.com`); used for metadata and links
- `JWT_SECRET` — Secret used to sign JWTs (change in production!)
- `ADMIN_EMAIL` — Email that will be treated as the admin in the app UI and API
- `ADMIN_USERNAME` — Seed username for the initial local user (default `admin`)
- `ADMIN_PASSWORD` — Seed password for the initial local user (default `admin`)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_ID` — Google OAuth Client ID for One Tap / Sign-In
- `PORT` — Port for `npm run start` (default 3000)

## Data storage
- SQLite DB: `data/blog.db`
- Uploads: `public/uploads`

Both paths are persisted as Docker volumes in the provided image so you can bind host directories easily.

## Authentication overview
- Tokens are signed with `JWT_SECRET`. The token is expected in the `Authorization: Bearer <token>` header.
- Google Sign-In endpoint exchanges a Google ID token for a local JWT.
- The request helper attaches `auth` to the route context. If `options.protected` is set, unauthenticated requests return `401`.
- Admin status: any authenticated user whose email equals `ADMIN_EMAIL` is treated as admin.

## API
All routes live under `/api`. Request/response bodies are JSON unless otherwise noted. Include `Authorization: Bearer <token>` for endpoints marked Auth.

### Auth
- POST `/api/auth/google`
  - Body: `{ idToken: string }` (also supports `{ credential }` or `{ token }`)
  - Response: `{ token, email, name, picture, isAdmin }`
- POST `/api/auth/login`
  - Disabled; returns 400. Use Google Sign-In.
- GET `/api/auth/me` (Auth)
  - Response: `{ username, email, name, picture, isAdmin }`

### Posts
- GET `/api/posts`
  - Public: returns public and unlisted posts
  - Admin (Auth): returns all posts, including private
  - Response: `[{ id, slug, title, cover_image, published, created_at, updated_at }]`
- POST `/api/posts` (Admin)
  - Body:
    ```json
    {
      "title": "My post",
      "slug": "optional-custom-slug",
      "contentMd": "# markdown...",      // or provide contentHtml
      "contentHtml": "<p>html...</p>",
      "coverImage": "/uploads/...",
      "published": true,                  // legacy boolean
      "visibility": "public|private|unlisted", // optional
      "publishedState": 0|1|2             // 0=private,1=public,2=unlisted
    }
    ```
  - Response: full post row

- GET `/api/posts/[slug]`
  - Public: returns the post if public or unlisted
  - Private posts require admin (Auth)
  - Response: full post row

- PUT `/api/posts/[slug]` (Admin)
  - Update title, slug (except for `home`), content, cover, visibility
  - Accepts the same fields as POST

- DELETE `/api/posts/[slug]` (Admin)
  - Deletes the post (except the reserved `home` page)

Visibility rules
- `published`/`publishedState`: 0=private (admin only), 1=public, 2=unlisted (viewable via link)
- Slug `home` is reserved; it’s created on first init and cannot be deleted or renamed, but content can be edited.

### Comments
- GET `/api/posts/[slug]/comments`
  - List comments for a given post
- POST `/api/posts/[slug]/comments` (Auth)
  - Body: `{ content: string }`
  - Rate limit: max 3 comments per user per post (admins exempt)
- DELETE `/api/posts/[slug]/comments/[id]` (Auth)
  - Allowed for admins or the comment owner

### Uploads
- POST `/api/upload` (Admin)
  - Multipart form-data with field `image`
  - Accepts: `image/png`, `image/jpeg`, `image/gif`, `image/webp`
  - Response: `{ url: "/uploads/filename.ext" }`

## Editor
- Navigate to `/editor` (requires admin to create/edit)
- When viewing a post, admins see an Edit action linking to `/editor/[slug]`

## Content pipeline
- Markdown is converted to HTML and sanitized server-side. You may send raw HTML via `contentHtml`; it will be sanitized.
- The UI opens links in post content in new tabs and enforces `rel="noopener noreferrer"`.

## Running with Docker
A multi-stage Dockerfile is provided. The image exposes two volumes for persistence.

Build and run:
```bash
# Build
docker build -t blog-app .

# Run (bind data and uploads to host)
docker run -d \
  -p 3000:3000 \
  -e JWT_SECRET=change-me \
  -e ADMIN_EMAIL=you@example.com \
  -e NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/public/uploads:/app/public/uploads \
  --name blog-app \
  blog-app
```

On Windows PowerShell, replace `$(pwd)` with `${PWD}`.

## Deployment notes
- Set a strong `JWT_SECRET` and configure `ADMIN_EMAIL`.
- Bind-mount `data` and `public/uploads` or use external storage.
- Optionally set `NEXT_PUBLIC_BASE_URL` for correct absolute links.
- The app seeds the database on first API access; ensure the server can write to `data/`.

## Tech stack
- Next.js 15 (App Router)
- React 19
- SQLite via `sqlite3`
- JWT via `jsonwebtoken`
- Google Sign-In via `google-auth-library` on the server; client uses a simple `GoogleSignInButton` wrapper
- Markdown via `marked` and sanitization via `dompurify`/`jsdom`
- Styling via the project’s global CSS (Tailwind v4 PostCSS config present for future use)

## Development tips
- Dev server runs on `http://localhost:3001` (configured in `package.json`).
- Production server (Docker `CMD` or `npm start`) listens on `PORT` (default 3000).
- If you change auth settings, clear `localStorage.token` in the browser.

## License
MIT (or your preferred license).
