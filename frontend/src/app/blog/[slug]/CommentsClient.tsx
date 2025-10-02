"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Comment = {
  id: number;
  name: string;
  content: string;
  created_at: string;
  replies?: Comment[];
};

export default function CommentsClient({
  slug,
  initialComments,
}: {
  slug: string;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      setComments((prev) => [...prev, newComment]);
      setComment("");
      setName("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-semibold mb-6">Комментарии</h2>

      {comments.length === 0 ? (
        <p className="text-muted-foreground">Комментариев пока нет.</p>
      ) : (
        <div className="space-y-6">
          {comments.map((c) => (
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
