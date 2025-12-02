// frontend/src/components/DuplicateTableModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  visible: boolean;
  onClose: () => void;
  existingTable?: any | null;
  userId?: string | null;
};

export default function DuplicateTableModal({ visible, onClose, existingTable, userId }: Props) {
  const router = useRouter();

  const [fio, setFio] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [pages, setPages] = useState<number | "">("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);

  // justSent = пользователь только что отправил форму в этой сессии/инстансе компонента
  const [justSent, setJustSent] = useState(false);
  // submittedBefore = пользователь когда-то уже отправлял форму ранее (persisted in localStorage)
  const [submittedBefore, setSubmittedBefore] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // ключ локального хранилища (если userId есть — используем per-user key)
  const storageKey = `duplicate_table_submitted_${userId ?? "anon"}`;

  // при монтировании / при каждом открытии проверяем LF-флаг в localStorage
  useEffect(() => {
    if (!visible) return;
    try {
      const v = localStorage.getItem(storageKey);
      if (v) setSubmittedBefore(true);
      else setSubmittedBefore(false);
    } catch {
      setSubmittedBefore(false);
    }
    // также сбрасываем justSent при повторном открытии (чтобы корректно показать submittedBefore экран)
    setJustSent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, storageKey]);

  if (!visible) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        fio,
        phone,
        email,
        telegram,
        pages: pages === "" ? null : Number(pages),
        note,
      };

      const res = await fetch("/api/notify/duplicate-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => null);

      if (!res.ok) {
        setError(j?.detail ?? j?.error ?? "Не удалось отправить");
      } else {
        // пометим, что пользователь отправил (persistently)
        try {
          localStorage.setItem(storageKey, new Date().toISOString());
        } catch {
          // ignore
        }
        setJustSent(true); // показываем "Спасибо!" прямо сейчас
        setSubmittedBefore(true); // на будущее — показывать экран "заявка обрабатывается"
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  function handleContinueWithTable() {
    onClose();
    const existingId = existingTable?.id ?? existingTable?.table_id ?? null;
    if (existingId) {
      router.push(`/tables/${encodeURIComponent(existingId)}`);
    } else {
      router.refresh();
    }
  }

  // Экран, который должен показываться при повторном открытии (submittedBefore уже true, но это не только что отправлено)
  function ProcessingScreen() {
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>
        Вы уже оставили заявку, и мы свяжемся с вами в ближайшее время!
      </h3>

      <p style={{ marginTop: 0, color: "#475569", lineHeight: 1.45 }}>
        Пока ваша заявка обрабатывается, вы можете{" "}
        <a
          href="/blog"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#0f1724", fontWeight: 700 }}
        >
          почитать наш блог
        </a>{" "}
        или продолжить работать с вашей текущей таблице!
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button
          onClick={() => window.open("/blog", "_blank", "noopener")}
          style={btnGhost}
        >
          Перейти в блог
        </button>

        <button onClick={handleContinueWithTable} style={btnPrimary}>
          Продолжить с таблицей
        </button>

        <button onClick={onClose} style={btnGhost}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

  // Экран "Спасибо" сразу после отправки (justSent true)
  function ThankYouScreen() {
    return (
      <>
        <div style={{ color: "green", marginBottom: 12 }}>
          Спасибо! Мы свяжемся с вами в ближайшее время.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnPrimary}>
            Закрыть
          </button>
        </div>
      </>
    );
  }

  // Основная форма
  function FormScreen() {
    return (
      <form onSubmit={handleSend}>
        <label style={labelStyle}>
          ФИО
          <input value={fio} onChange={(e) => setFio(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Телефон
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Telegram
          <input value={telegram} onChange={(e) => setTelegram(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Количество страниц, которые вы желаете приобрести
          <input
            type="number"
            min={1}
            value={pages as any}
            onChange={(e) => setPages(e.target.value === "" ? "" : Number(e.target.value))}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Комментарий
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ ...inputStyle, minHeight: 80 }}
          />
        </label>

        {error && <div style={{ color: "crimson", marginBottom: 8 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={btnGhost}>
            Отмена
          </button>
          <button type="submit" disabled={loading} style={btnPrimary}>
            {loading ? "Отправляем..." : "Отправить заявку"}
          </button>
        </div>
      </form>
    );
  }

  // Логика отображения:
  // - если только что отправили (justSent) -> показываем ThankYouScreen
  // - иначе, если ранее отправлял(а) (submittedBefore) -> показываем ProcessingScreen
  // - иначе -> форма
  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        {!submittedBefore && !justSent && (
  <>
    <h3 style={{ marginTop: 0 }}>Создание новых таблиц недоступно бесплатно</h3>

    <p style={{ marginTop: 0, lineHeight: "1.45", color: "#475569" }}>
      В вашей учётной записи уже есть активная таблица.
      Чтобы создать дополнительные страницы, необходимо приобрести доступ.
      <br />
      Оставьте, пожалуйста, ваши контактные данные — мы свяжемся с вами и оформим заказ.
    </p>
  </>
)}


        {justSent ? (
          <ThankYouScreen />
        ) : submittedBefore ? (
          <ProcessingScreen />
        ) : (
          <FormScreen />
        )}
      </div>
    </div>
  );
}

/* Стили (как в вашем оригинале) */
const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const modalStyle: React.CSSProperties = {
  width: 640,
  maxWidth: "94%",
  background: "#fff",
  borderRadius: 12,
  padding: 20,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 12,
  fontSize: 14,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  marginTop: 4,
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#0f172a",
  color: "#fff",
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  cursor: "pointer",
};
