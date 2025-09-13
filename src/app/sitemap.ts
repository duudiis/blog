import type { MetadataRoute } from 'next';
import { all, initializeDatabase } from '@/lib/db';
import { SITE_URL } from '@/lib/site';

type Post = { slug: string; updated_at: string };

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (SITE_URL || '').replace(/\/+$/, '');
  const toUrl = (path: string) => (base ? `${base}${path.startsWith('/') ? '' : '/'}${path}` : path);

  const urls: MetadataRoute.Sitemap = [
    { url: toUrl('/'), changeFrequency: 'weekly', priority: 1 },
  ];
  try {
    await initializeDatabase();
    const posts = await all<Post>(
      `SELECT slug, updated_at FROM posts WHERE slug != 'home' AND published = 1 ORDER BY datetime(updated_at) DESC`
    );
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


