// frontend/src/components/ArticleMeta.tsx
export default function ArticleMeta({ author, date, tags }: { author?: any, date?: string, tags?: any[] }) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center">
          <span className="text-xs font-semibold text-muted">{(author?.name || "A").slice(0,1)}</span>
        </div>
        <div>
          <div className="text-sm text-text">{author?.name ?? "Автор"}</div>
          <div className="text-xs text-muted">{date ? new Date(date).toLocaleDateString() : ""}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {tags?.slice?.(0,4).map((t:any)=> (<span key={t.id||t.title} className="text-xs px-2 py-1 rounded-md bg-neutral-100 text-muted">{t.title}</span>))}
      </div>
    </div>
  );
}
