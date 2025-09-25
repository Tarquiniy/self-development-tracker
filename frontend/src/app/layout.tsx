import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Positive Theta - Блог саморазвития',
  description: 'Современный подход к саморазвитию и личностному росту',
  keywords: 'саморазвитие, психология, личностный рост, блог',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}