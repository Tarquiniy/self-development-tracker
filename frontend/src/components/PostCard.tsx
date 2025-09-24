import Link from "next/link";
import Image from "next/image";

interface Category {
  title: string;
  id?: string;
}

interface Post {
  slug: string;
  title: string;
  excerpt?: string;
  featured_image?: string;
  og_image?: string;
  published_at?: string;
  created_at?: string;
  categories?: Category[];
}

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const img = post.og_image || post.featured_image || "/images/placeholder-article.jpg";
  const date = post.published_at || post.created_at || new Date().toISOString();

  return (
    <article className="card overflow-hidden transition-shadow hover:shadow-lg">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="w-full h-44 bg-neutral-100 overflow-hidden">
          <Image 
            src={img} 
            alt={post.title} 
            width={400}
            height={176}
            className="w-full h-full object-cover" 
          />
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="tag-pill">
              {post.categories?.[0]?.title ?? "Статья"}
            </span>
            <span className="text-xs text-muted">
              {new Date(date).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-lg font-heading text-text mb-2">{post.title}</h3>
          <p 
            className="text-sm text-muted line-clamp-3" 
            dangerouslySetInnerHTML={{ __html: post.excerpt || "" }} 
          />
        </div>
      </Link>
    </article>
  );
}