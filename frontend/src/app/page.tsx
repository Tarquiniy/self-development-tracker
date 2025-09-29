// frontend/src/app/page.tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      {/* HERO */}
      <section className="hero">
        <div className="container">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Positive Theta
          </motion.h1>
          <p className="hero-sub">
            Платформа для саморазвития и роста.  
            Мы верим, что каждый человек способен изменить свою жизнь,  
            если будет ежедневно работать над собой.  
            Читай, учись, развивайся — и шаг за шагом достигай большего.
          </p>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <Link href="/blog">
              <a className="btn btn-primary">Начать читать блог →</a>
            </Link>
          </div>
        </div>
      </section>

      {/* ABOUT SELF-DEVELOPMENT */}
      <section className="container" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <h2 style={{ textAlign: "center", marginBottom: 32 }}>
          Что такое саморазвитие?
        </h2>
        <p style={{ maxWidth: "60ch", margin: "0 auto", textAlign: "center", fontSize: "1.125rem", lineHeight: "1.8" }}>
          Саморазвитие — это процесс постоянного обучения,  
          расширения кругозора и улучшения своих навыков.  
          Это путь к осознанной и наполненной жизни.  
          На нашей платформе ты найдёшь статьи, практики и материалы,  
          которые помогут тебе двигаться вперёд и раскрывать свой потенциал.
        </p>
      </section>
    </main>
  );
}
