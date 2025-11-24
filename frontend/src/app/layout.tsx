import "./global.css";
import type { Metadata } from "next";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import ClientBoundary from "@/components/ClientBoundary";

export const metadata: Metadata = {
  title: "Positive Theta",
  description: "Современный блог и платформа для саморазвития.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            {/* main получает отступ сверху, равный переменной --header-height */}
            <main className="flex-1" style={{ paddingTop: "var(--header-height)" }}>
              {/* Клиентский boundary — оборачиваем всё клиентское содержимое */}
              <ClientBoundary>{children}</ClientBoundary>
            </main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
