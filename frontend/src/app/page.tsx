// frontend/src/app/page.tsx
import Header from "@/components/Header";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen flex flex-col justify-center items-center text-center px-4">
        <h1 className="text-5xl font-heading mb-6">Добро пожаловать на Положительная Тета</h1>
        <p className="text-lg text-muted max-w-lg mb-8">
          Здесь вы найдете вдохновение, статьи по саморазвитию и многое другое.
        </p>
        <div className="flex gap-4">
          <a href="/blog" className="btn btn-primary">Перейти в блог</a>
          <a href="/about" className="btn btn-ghost">О нас</a>
        </div>
      </main>
    </>
  );
}
