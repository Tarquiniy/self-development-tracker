// src/app/blog/[slug]/page.tsx
import { notFound } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";

/* -------------------------
   Types (internal use only)
   ------------------------- */
type Comment = {
  id: number;
  name: string;
  content: string;
  created_at: string;
  replies?: Comment[];
};

type Post = {
  id: number;
  title: string;
  slug: string;
  content: string;
  featured_image?: string | null;
  categories: { id: number; title: string; slug: string }[];
  tags: { id: number; title: string; slug: string }[];
  published_at: string;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
  comments: Comment[];
};

/* -------------------------
   Helpers
   ------------------------- */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

/** Fetch helper: keep Next ISR option but cast init to any to avoid TS complaining */
async function fetchJson(url: string) {
  const init = ({ cache: "no-store" } as any); // server-side always fresh (adjust if you prefer ISR)
  const res = await fetch(url, init);
  if (!res.ok) return null;
  return res.json();
}

async function getPost(slug: string): Promise<Post | null> {
  if (!API_BASE) return null;
  return fetchJson(`${API_BASE}/api/blog/posts/${encodeURIComponent(slug)}/`);
}

/* -------------------------
   SEO metadata (uses any to avoid PageProps generic issues)
   ------------------------- */
export async function generateMetadata({ params }: any): Promise<Metadata> {
  try {
    const post: Post | null = await getPost(params?.slug);
    if (!post) {
      return {
        title: "Пост не найден | Positive Theta",
        description: "Страница не найдена",
      };
    }

    const description =
      post.meta_description ||
      post.meta_title ||
      (post.content ? post.content.replace(/<[^>]+>/g, "").slice(0, 160) : "");

    const image = post.og_image || post.featured_image || `${SITE_URL}/default-og.jpg`;

    return {
      title: `${post.meta_title || post.title} | Positive Theta`,
      description: description || undefined,
      openGraph: {
        title: post.meta_title || post.title,
        description: description || undefined,
        url: `${SITE_URL}/blog/${post.slug}`,
        type: "article",
        images: image ? [image] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: post.meta_title || post.title,
        description: description || undefined,
        images: image ? [image] : [],
      },
    };
  } catch (e) {
    return { title: "Positive Theta" };
  }
}

/* -------------------------
   Page component — params typed as any to avoid PageProps constraint
   ------------------------- */
export default async function BlogPostPage({ params }: any) {
  const slug = params?.slug;
  if (!slug) return notFound();

  const post: Post | null = await getPost(slug);
  if (!post) return notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Edge-to-edge hero image */}
      {post.featured_image && (
        <header className="relative w-full h-[60vh] min-h-[320px] overflow-hidden">
          <Image
            src={post.featured_image}
            alt={post.title}
            fill
            priority
            sizes="100vw"
            className="object-cover transition-transform duration-700 will-change-transform hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-12 flex justify-center px-6">
            <div className="max-w-4xl text-center">
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-white drop-shadow-lg mb-3">
                {post.title}
              </h1>
              <p className="text-sm text-white/80">
                Опубликовано {new Date(post.published_at).toLocaleDateString("ru-RU")}
              </p>
            </div>
          </div>
        </header>
      )}

      {/* Content container */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-12">
        {/* Categories & tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {post.categories?.map((cat) => (
            <Badge
              key={cat.id}
              className="bg-slate-100 dark:bg-slate-800 text-sm px-3 py-1 rounded"
            >
              {cat.title}
            </Badge>
          ))}
          {post.tags?.map((t) => (
            <Badge
              key={t.id}
              className="bg-slate-50 dark:bg-slate-700 text-sm px-3 py-1 rounded"
            >
              #{t.title}
            </Badge>
          ))}
        </div>

        {/* Article */}
        <article
          className="prose prose-lg dark:prose-invert max-w-none mb-12"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Comments section (server-rendered initial list) */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold mb-6">Комментарии</h2>

          {(!post.comments || post.comments.length === 0) ? (
            <p className="text-muted-foreground">Комментариев пока нет.</p>
          ) : (
            <div className="space-y-6">
              {post.comments.map((c) => (
                <CommentItem key={c.id} comment={c} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* -------------------------
   CommentItem — recursive rendering (server side)
   ------------------------- */
function CommentItem({ comment }: { comment: Comment }) {
  return (
    <Card className="p-4">
      <p className="font-semibold">{comment.name}</p>
      <p className="text-sm text-muted-foreground mb-2">
        {new Date(comment.created_at).toLocaleDateString("ru-RU")}
      </p>
      <div className="whitespace-pre-wrap">{comment.content}</div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-6 mt-4 space-y-4">
          {comment.replies.map((r) => (
            <CommentItem key={r.id} comment={r} />
          ))}
        </div>
      )}
    </Card>
  );
}
