// frontend/src/app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Положительная тета",
  description: "Блог и сайт",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
      </body>
    </html>
  );
}
