import type { MetadataRoute } from 'next';
import { all } from '@/lib/db';
import { SITE_URL } from '@/lib/site';

type Post = { slug: string; updated_at: string };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (SITE_URL || '').replace(/\/+$/, '');
  const toUrl = (path: string) => (base ? `${base}${path.startsWith('/') ? '' : '/'}${path}` : path);

  const urls: MetadataRoute.Sitemap = [
    { url: toUrl('/'), changeFrequency: 'weekly', priority: 1 },
  ];
  try {
    const postsPromise = all<Post>(
      `SELECT slug, updated_at FROM posts WHERE slug != 'home' AND published = 1 ORDER BY datetime(updated_at) DESC`
    );
    const timeout = new Promise<Post[]>((_, reject) => {
      setTimeout(() => reject(new Error('sitemap db query timeout')), 2000);
    });
    const posts = (await Promise.race([postsPromise, timeout])) as Post[];
    for (const p of posts) {
      const lastMod = new Date(p.updated_at);
      urls.push({
        url: toUrl(`/posts/${p.slug}`),
        changeFrequency: 'weekly',
        lastModified: isNaN(lastMod.getTime()) ? undefined : lastMod,
        priority: 0.7,
      });
    }
  } catch {}
  return urls;
}


