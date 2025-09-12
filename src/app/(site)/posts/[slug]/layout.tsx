import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { get, all } from "@/lib/db";

export const dynamic = 'force-dynamic';

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const { slug } = params;
    type PostRow = { id: number; slug: string; title: string; content_md: string; content_html: string; cover_image?: string | null; published: number; created_at: string; updated_at: string };
    const p = await get<PostRow>(`SELECT id, slug, title, content_md, content_html, cover_image, published, created_at, updated_at FROM posts WHERE slug = ?`, [slug]);
    if (!p) return { title: "Not found" };
    const title = p?.title || 'Post';
    const rawMd: string = (p?.content_md || "").toString();
    const fromHtml = (p?.content_html || "").toString().replace(/<[^>]+>/g, ' ');
    const description = (rawMd || fromHtml).replace(/\s+/g, ' ').trim().slice(0, 160);
    const image = p?.cover_image || undefined;
    const textForReadTime = (p?.content_html || "").toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = textForReadTime ? textForReadTime.split(' ').length : 0;
    const minutes = Math.max(1, Math.ceil(words / 200));
    const readTime = `${minutes} min read`;
    // Comments count
    let commentCount = 0;
    try {
      const rows = await all<{ id: number }>(`SELECT id FROM comments WHERE post_id = ?`, [p.id]);
      commentCount = rows.length;
    } catch {}
    const canonicalPath = `/posts/${slug}`;
    const isIndexable = p?.published === 1;
    return {
      title,
      description,
      alternates: { canonical: canonicalPath },
      openGraph: {
        title,
        description,
        url: canonicalPath,
        images: image ? [{ url: image }] : undefined,
        type: 'article',
        siteName: SITE_NAME,
        publishedTime: p?.created_at,
        modifiedTime: p?.updated_at,
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        images: image ? [image] : undefined,
      },
      robots: {
        index: isIndexable,
        follow: isIndexable,
      },
      other: {
        'article:published_time': p?.created_at || '',
        'article:modified_time': p?.updated_at || '',
        'og:site_name': SITE_NAME,
        'twitter:label1': 'Reading time',
        'twitter:data1': readTime,
        'twitter:label2': 'Comments',
        'twitter:data2': String(commentCount),
      },
    };
  } catch {
    return { title: 'Not found' };
  }
}


