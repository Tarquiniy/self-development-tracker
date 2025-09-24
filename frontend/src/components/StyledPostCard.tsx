import Link from "next/link";

type Post = {
  slug: string;
  title: string;
  excerpt?: string;
  og_image?: string;
  published_at: string;
  categories?: { title: string }[];
};

export default function StyledPostCard({ post }: { post: Post }) {
  const img = post.og_image || "/images/placeholder-article.jpg";
  return (
    <div className="card">
      <Link href={`/blog/${post.slug}`}>
        <div className="h-52 w-full overflow-hidden rounded-t-2xl">
          <img src={img} alt={post.title} className="w-full h-full object-cover"/>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="tag-pill">{post.categories?.[0]?.title || "Без категории"}</span>
            <span className="text-xs text-muted">
              {new Date(post.published_at).toLocaleDateString('ru-RU')}
            </span>
          </div>
          <h2 className="text-2xl font-heading text-text-primary mb-2">{post.title}</h2>
          <p className="text-sm text-muted line-clamp-3">{post.excerpt}</p>
        </div>
      </Link>
    </div>
  );
}
