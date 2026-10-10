import type { Metadata, Viewport } from 'next'
import '../src/index.css'

export const metadata: Metadata = {
  title: 'GoingRoam — Bucket List Travel Planner',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-mist dark:bg-ink">{children}</body>
    </html>
  )
}
