// components/ClientDate.tsx
"use client";
type Props = { iso: string };
export default function ClientDate({ iso }: Props) {
  const d = new Date(iso);
  const str = d.toLocaleDateString(); // клиентская часть
  return <span>{str}</span>;
}
