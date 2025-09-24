import Link from "next/link";
import Image from "next/image";

interface Category {
  title: string;
  slug: string;
}

interface Post {
  slug: string;
  title: string;
  excerpt?: string;
  featured_image?: string;
  og_image?: string;
  published_at: string;
  categories?: Category[];
  reading_time?: number;
}

interface StyledPostCardProps {
  post: Post;
}

export default function StyledPostCard({ post }: StyledPostCardProps) {
  const imageUrl = post.featured_image || post.og_image || "/images/placeholder-article.jpg";
  const readingTime = post.reading_time || Math.ceil((post.excerpt?.length || 0) / 200);

  return (
    <article className="card group hover:scale-105 transition-all duration-500">
      <Link href={`/blog/${post.slug}`} className="block h-full">
        {/* Изображение */}
        <div className="relative h-64 overflow-hidden">
          <Image
            src={imageUrl}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Категории */}
          {post.categories && post.categories.length > 0 && (
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              {post.categories.slice(0, 2).map((category: Category) => (
                <span 
                  key={category.slug} 
                  className="tag-pill bg-white/90 backdrop-blur-sm text-neutral-700 text-xs font-medium"
                >
                  {category.title}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Контент */}
        <div className="p-6">
          {/* Мета-информация */}
          <div className="flex items-center justify-between text-sm text-neutral-500 mb-3">
            <time dateTime={post.published_at}>
              {new Date(post.published_at).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </time>
            <span className="flex items-center space-x-1">
              <span>⏱️</span>
              <span>{readingTime} мин.</span>
            </span>
          </div>

          {/* Заголовок */}
          <h3 className="font-heading font-bold text-xl text-neutral-900 mb-3 line-clamp-2 leading-tight group-hover:text-primary-600 transition-colors duration-200">
            {post.title}
          </h3>

          {/* Описание */}
          {post.excerpt && (
            <p className="text-neutral-600 text-sm leading-relaxed line-clamp-3 mb-4">
              {post.excerpt.replace(/<[^>]*>/g, '')}
            </p>
          )}

          {/* Читать далее */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <span className="text-primary-500 font-semibold text-sm group-hover:text-primary-600 transition-colors duration-200">
              Читать далее →
            </span>
            <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors duration-200">
              <span className="text-primary-500 text-lg">→</span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}