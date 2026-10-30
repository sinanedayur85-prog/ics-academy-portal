import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { El_Messiri, Inter } from 'next/font/google'
import './globals.css'

const elMessiri = El_Messiri({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-el-messiri',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ICS Academy Manhappatta — Unified Digital Campus',
  description:
    'A unified digital campus for ICS Academy Manhappatta. Students, class leaders, teachers and the principal sign in to one secure portal.',
  generator: 'v0.app',
  icons: {
    icon: '/images/ics-mark-transparent.png',
    apple: '/images/ics-mark-transparent.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#081E21',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${elMessiri.variable} ${inter.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
