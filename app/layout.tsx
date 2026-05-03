import type { Metadata } from 'next'
import { Google_Sans as GoogleSans } from 'next/font/google'
import './globals.css'

const googleSans = GoogleSans({
  variable: '--font-google-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Docs · Neon versions',
  description: 'Document editor with Neon branch history',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${googleSans.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
