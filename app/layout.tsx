// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MR DIY — Campaign Job Tracker',
  description: 'Campaign Job Tracker for MR DIY stores',
  icons: { icon: '/mrdiy.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
