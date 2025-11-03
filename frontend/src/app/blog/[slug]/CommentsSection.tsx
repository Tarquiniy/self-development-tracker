"use client";

import dynamic from "next/dynamic";

// ✅ Динамически импортируем CommentsClient, но теперь этот файл — клиентский,
// поэтому `ssr: false` разрешён.
const CommentsClient = dynamic(() => import("./CommentsClient"), {
  ssr: false,
});

export default function CommentsSection({
  postId,
  initialComments,
}: {
  postId: number;
  initialComments: any[];
}) {
  return <CommentsClient postId={postId} initialComments={initialComments} />;
}
