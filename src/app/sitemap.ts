import type { MetadataRoute } from 'next';

type Post = { slug: string; updated_at: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const urls: MetadataRoute.Sitemap = [
    { url: '/', changeFrequency: 'weekly', priority: 1 },
    { url: '/admin', changeFrequency: 'monthly', priority: 0.3 },
  ];
  try {
    const res = await fetch(`${base}/api/posts`, { next: { revalidate: 300 } });
    if (res.ok) {
      const posts: Post[] = await res.json();
      for (const p of posts) {
        urls.push({ url: `/posts/${p.slug}`, changeFrequency: 'weekly', lastModified: p.updated_at });
      }
    }
  } catch {}
  return urls;
}


