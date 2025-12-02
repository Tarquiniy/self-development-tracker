// frontend/src/app/page.tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      {/* HERO */}
      <section
        className="hero"
        style={{
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 1.25rem",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center", padding: "36px 12px" }}>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", marginBottom: "0.75rem", color: "white", lineHeight: 1.05 }}
          >
            Платформа для саморазвития и роста
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            style={{
              maxWidth: "62ch",
              margin: "0 auto",
              textAlign: "center",
              fontSize: "1.125rem",
              lineHeight: "1.8",
              color: "rgba(255,255,255,0.95)",
              fontWeight: 500,
            }}
          >
            Платформа для саморазвития и роста. Мы верим, что каждый человек способен изменить свою жизнь,
            если будет ежедневно работать над собой. Читай, учись, развивайся — и шаг за шагом достигай большего.
          </motion.p>

          <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <Link href="/blog" className="btn btn-primary" style={{ textDecoration: "none" }}>
              Читай статьи
            </Link>
            <Link href="/tables" className="btn btn-secondary" style={{ textDecoration: "none" }}>
              Попробовать трекер
            </Link>
          </div>
        </div>
      </section>

      {/* Информационная секция — заголовок и текст теперь отцентрированы */}
      <section style={{ padding: "3rem 1.25rem", textAlign: "center" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem", lineHeight: 1.12 }}>
            Что такое саморазвитие?
          </h2>

          <p style={{ maxWidth: "72ch", margin: "0 auto 1.25rem auto", fontSize: "1.05rem", color: "rgba(15,23,36,0.85)" }}>
            Саморазвитие — это осознанная и системная работа над навыками, привычками и внутренними установками.
            Это не разовая попытка стать лучше, а постоянный процесс: маленькие ежедневные действия складываются в большие изменения.
          </p>

          <p style={{ maxWidth: "72ch", margin: "0 auto 1.25rem auto", fontSize: "1.02rem", color: "rgba(15,23,36,0.8)" }}>
            В нашем блоге мы публикуем практические статьи о продуктивности, привычках, эмоциональном интеллекте,
            целеполагании и методах самоанализа. Каждый материал — это сочетание науки, проверенных практик и личных историй,
            которые помогут вам планомерно улучшать жизнь.
          </p>

          <h3 style={{ marginTop: "0.75rem", marginBottom: "0.5rem", fontSize: "1.125rem" }}>
            PWA-трекер — ваш ежедневный помощник
          </h3>

          <p style={{ maxWidth: "72ch", margin: "0 auto 1rem auto", fontSize: "1.02rem", color: "rgba(15,23,36,0.8)" }}>
            Мы также разработали PWA-приложение для отслеживания ежедневных действий и привычек.
            Трекер помогает фиксировать прогресс, формировать привычки и визуализировать результаты —
            вы можете добавлять задачи, отмечать выполнение, смотреть статистику и получать напоминания.
          </p>

          <ul style={{ maxWidth: "72ch", margin: "0 auto 1.25rem auto", textAlign: "left", display: "inline-block", color: "rgba(15,23,36,0.8)" }}>
            <li><strong>Быстрая установка:</strong> PWA можно установить на телефон прямо из браузера.</li>
            <li><strong>Оффлайн-доступ:</strong> данные остаются доступны даже без интернета.</li>
            <li><strong>Ежедневная аналитика:</strong> визуализация прогресса и простые отчёты.</li>
            <li><strong>Мотивационные напоминания:</strong> настройте пуши и привычки под себя.</li>
          </ul>

          <p style={{ maxWidth: "72ch", margin: "1.25rem auto 0 auto", fontSize: "1.02rem" }}>
            Хотите попробовать? <Link href="/tables" style={{ color: "hsl(203 100% 56%)", textDecoration: "underline" }}>Запустите PWA-трекер</Link> и начните фиксировать первые шаги уже сегодня.
          </p>
        </div>
      </section>
    </main>
  );
}
