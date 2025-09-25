// app/blog/[slug]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

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
  comments: Comment[];
};

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadPost() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/blog/posts/${slug}/`
        );
        if (!res.ok) throw new Error("Ошибка загрузки поста");
        const data = await res.json();
        setPost(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [slug]);

  async function handleAddComment() {
    if (!comment.trim() || !name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/blog/posts/${slug}/add_comment/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, content: comment }),
        }
      );
      if (!res.ok) throw new Error("Ошибка добавления комментария");
      const newComment = await res.json();
      setPost((prev) =>
        prev ? { ...prev, comments: [...prev.comments, newComment] } : prev
      );
      setComment("");
      setName("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground p-20">Загрузка...</p>;
  }
  if (!post) {
    return <p className="text-muted-foreground p-20">Пост не найден.</p>;
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-20">
      {post.featured_image && (
        <motion.img
          src={post.featured_image}
          alt={post.title}
          className="w-full h-72 object-cover rounded-xl mb-8"
        />
      )}

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold mb-4"
      >
        {post.title}
      </motion.h1>

      <p className="text-sm text-muted-foreground mb-6">
        Опубликовано {new Date(post.published_at).toLocaleDateString("ru-RU")}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {post.categories.map((cat) => (
          <Badge key={cat.id} variant="default">
            {cat.title}
          </Badge>
        ))}
        {post.tags.map((tag) => (
          <Badge key={tag.id} variant="secondary">
            #{tag.title}
          </Badge>
        ))}
      </div>

      <article
        className="prose prose-lg dark:prose-invert max-w-none mb-12"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* Комментарии */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold mb-6">Комментарии</h2>

        {post.comments.length === 0 ? (
          <p className="text-muted-foreground">Комментариев пока нет.</p>
        ) : (
          <div className="space-y-6">
            {post.comments.map((c) => (
              <CommentItem key={c.id} comment={c} />
            ))}
          </div>
        )}

        {/* Форма */}
        <div className="mt-10 border-t pt-6">
          <h3 className="text-lg font-medium mb-4">Оставить комментарий</h3>
          <Input
            placeholder="Ваше имя"
            className="mb-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder="Ваш комментарий..."
            className="mb-3"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button disabled={submitting} onClick={handleAddComment}>
            {submitting ? "Отправка..." : "Отправить"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <Card className="p-4">
      <p className="font-semibold">{comment.name}</p>
      <p className="text-sm text-muted-foreground mb-2">
        {new Date(comment.created_at).toLocaleDateString("ru-RU")}
      </p>
      <p>{comment.content}</p>
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-6 mt-4 space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </Card>
  );
}
