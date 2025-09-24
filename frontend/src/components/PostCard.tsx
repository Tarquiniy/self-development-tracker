// frontend/src/components/PostCard.tsx
import Link from "next/link";

type Props = { post: any };

export default function PostCard({ post }: Props) {
  const img = post.og_image || post.featured_image || "/images/placeholder-article.jpg";

  return (
    <article className="card overflow-hidden transition-shadow hover:shadow-lg">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="w-full h-44 bg-neutral-100 overflow-hidden">
          <img src={img} alt={post.title} className="w-full h-full object-cover" />
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="tag-pill">{post.categories?.[0]?.title ?? "Статья"}</span>
            <span className="text-xs text-muted">{new Date(post.published_at || post.created_at || Date.now()).toLocaleDateString()}</span>
          </div>
          <h3 className="text-lg font-heading text-text mb-2">{post.title}</h3>
          <p className="text-sm text-muted line-clamp-3" dangerouslySetInnerHTML={{ __html: post.excerpt || "" }} />
        </div>
      </Link>
    </article>
  );
}
