// frontend/src/app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sdracker.onrender.com'

interface Category {
  title: string
  slug: string
}

interface Author {
  name: string
  email?: string
}

interface Post {
  id: number
  slug: string
  title: string
  content: string
  excerpt: string
  featured_image?: string
  og_image?: string
  published_at: string
  categories?: Category[]
  author?: Author
  meta_title?: string
  meta_description?: string
}

interface PageProps {
  params: Promise<{ slug: string }>
}

// Функция для очистки HTML
function cleanHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/style="[^"]*"/g, '')
    .replace(/class="[^"]*"/g, '')
    .replace(/align="[^"]*"/g, '')
    .replace(/<font[^>]*>/g, '')
    .replace(/<\/font>/g, '')
    .replace(/<span[^>]*>/g, '')
    .replace(/<\/span>/g, '')
}

function extractTextFromHtml(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').slice(0, 200) + '...'
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/blog/posts/${slug}/`, {
      next: { 
        revalidate: 3600,
        tags: [`post-${slug}`] // Тег для конкретного поста
      }
    })
    
    if (!res.ok) {
      return { title: 'Статья не найдена - Positive Theta' }
    }
    
    const post: Post = await res.json()
    
    return {
      title: post.meta_title || post.title,
      description: extractTextFromHtml(post.meta_description || post.excerpt || ''),
      openGraph: {
        title: post.title,
        description: extractTextFromHtml(post.excerpt || ''),
        images: post.og_image ? [post.og_image] : [],
        type: 'article',
        publishedTime: post.published_at,
      },
    }
  } catch (error) {
    return { title: 'Positive Theta - Блог' }
  }
}

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/blog/posts/?per_page=50`, {
      next: { 
        revalidate: 3600,
        tags: ['posts'] 
      }
    })
    
    if (!res.ok) return []
    
    const data = await res.json()
    const posts: Post[] = Array.isArray(data) ? data : data.results || []
    
    return posts.map((post) => ({ slug: post.slug }))
  } catch (error) {
    return []
  }
}

async function getPost(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/blog/posts/${slug}/`, {
      next: { 
        revalidate: 3600,
        tags: [`post-${slug}`] 
      }
    })
    
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    return null
  }
}

export default async function PostPage(props: PageProps) {
  const { slug } = await props.params
  const post = await getPost(slug)

  if (!post) notFound()

  const imageUrl = post.featured_image || post.og_image
  const readingTime = Math.ceil((post.content?.length || 0) / 200)
  const cleanContent = cleanHtml(post.content)
  const cleanExcerpt = extractTextFromHtml(post.excerpt)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">Θ</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Positive Theta</span>
            </Link>
            
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-gray-700 hover:text-blue-500 font-medium">Главная</Link>
              <Link href="/blog" className="text-gray-700 hover:text-blue-500 font-medium">Блог</Link>
              <Link href="/about" className="text-gray-700 hover:text-blue-500 font-medium">О нас</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow py-8">
        <article className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              {post.categories?.map((category) => (
                <span key={category.slug} className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded">
                  {category.title}
                </span>
              ))}
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
            
            <div className="flex items-center justify-between text-gray-600 mb-6">
              <div className="flex items-center space-x-4">
                {post.author && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {post.author.name?.charAt(0)?.toUpperCase() ?? 'A'}
                      </span>
                    </div>
                    <span>{post.author.name}</span>
                  </div>
                )}
                <time dateTime={post.published_at}>
                  {new Date(post.published_at).toLocaleDateString('ru-RU')}
                </time>
              </div>
              <span className="text-gray-500">{readingTime} мин чтения</span>
            </div>

            {cleanExcerpt && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                <p className="text-gray-700 italic">{cleanExcerpt}</p>
              </div>
            )}
          </div>

          {imageUrl && (
            <div className="mb-8">
              <div className="relative aspect-video rounded-lg overflow-hidden">
                <Image src={imageUrl} alt={post.title} fill className="object-cover" />
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div 
              className="prose prose-lg max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: cleanContent }} 
            />
            
            <div className="mt-8 pt-6 border-t border-gray-200">
              <Link href="/blog" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
                ← Вернуться к списку статей
              </Link>
            </div>
          </div>
        </article>
      </main>

      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">© {new Date().getFullYear()} Positive Theta</p>
        </div>
      </footer>
    </div>
  )
}