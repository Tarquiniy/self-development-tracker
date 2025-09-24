// frontend/src/components/ArticleMeta.tsx
interface Tag {
  title: string;
}

interface Author {
  name?: string;
}

interface ArticleMetaProps {
  author?: Author;
  date?: string;
  tags?: Tag[];
}

export default function ArticleMeta({ author, date, tags }: ArticleMetaProps) {
  return (
    <div className="flex items-center gap-4 text-sm text-neutral-500 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-primary-600 font-semibold">
            {(author?.name || "A").slice(0, 1)}
          </span>
        </div>
        <div>
          <div className="font-medium text-neutral-900">{author?.name ?? "Автор"}</div>
          <div className="text-neutral-500">
            {date ? new Date(date).toLocaleDateString('ru-RU') : ""}
          </div>
        </div>
      </div>
      
      {tags && tags.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">•</span>
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="text-xs px-2 py-1 rounded-md bg-neutral-100 text-neutral-600">
                {tag.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}