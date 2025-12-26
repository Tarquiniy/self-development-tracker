import Link from 'next/link'
import Image from 'next/image'

interface Category {
  title: string
  slug: string
}

interface Post {
  id: number
  slug: string
  title: string
  excerpt: string
  featured_image?: string
  og_image?: string
  published_at: string
  categories?: Category[]
  reading_time?: number
}

interface PostCardProps {
  post: Post
}

export default function PostCard({ post }: PostCardProps) {
  // Prefer featured_image (admin-selected), then og_image, then placeholder.
  // If featured_image is a relative path (starts with '/'), use as-is.
  // If it's empty, fallback to og_image or placeholder.
  const imageUrl = post.featured_image && post.featured_image !== ''
    ? post.featured_image
    : (post.og_image && post.og_image !== '' ? post.og_image : '/placeholder-article.jpg')

  const readingTime = post.reading_time || Math.max(1, Math.ceil((post.excerpt?.replace(/<[^>]*>/g, '').length || 0) / 200))

  return (
    <article className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="aspect-video relative overflow-hidden">
          <Image 
            src={imageUrl} 
            alt={post.title}
            fill
            className="object-cover hover:scale-105 transition-transform"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
          />
        </div>
        
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-wrap gap-2">
              {post.categories?.slice(0, 2).map((category) => (
                <span key={category.slug} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  {category.title}
                </span>
              ))}
            </div>
            <span className="text-gray-500 text-sm">{readingTime} мин</span>
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 hover:text-blue-600 transition-colors">
            {post.title}
          </h3>
          
          <p className="text-gray-600 line-clamp-3 mb-4">
            {post.excerpt.replace(/<[^>]*>/g, '')}
          </p>
          
          <div className="flex items-center justify-between text-sm text-gray-500">
            <time dateTime={post.published_at}>
              {new Date(post.published_at).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </time>
            <span className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
              Читать →
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
