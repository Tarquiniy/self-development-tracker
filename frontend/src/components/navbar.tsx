"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "Главная" },
  { href: "/blog", label: "Блог" },
  { href: "/about", label: "О проекте" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex h-16 items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          Positive <span className="text-primary">Theta</span>
        </Link>
        <nav className="flex gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition hover:text-primary ${
                pathname === link.href ? "text-primary" : "text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <ModeToggle />
      </div>
    </header>
  );
}
