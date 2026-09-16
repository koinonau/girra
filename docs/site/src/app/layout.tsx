import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { RootProvider } from 'fumadocs-ui/provider/next'
import './globals.css'

const siteUrl = 'https://www.onorca.dev'

export const metadata: Metadata = {
  title: 'Girra Docs',
  description: 'Product documentation for Girra — the worktree IDE for AI coding agents.',
  metadataBase: new URL(siteUrl),
  applicationName: 'Girra Docs',
  icons: {
    icon: '/docs/favicon.ico',
    shortcut: '/docs/favicon.ico'
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${siteUrl}/docs`,
    siteName: 'Girra',
    title: 'Girra Docs',
    description: 'Product documentation for Girra — the worktree IDE for AI coding agents.'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Girra Docs',
    description: 'Product documentation for Girra — the worktree IDE for AI coding agents.'
  },
  robots: {
    index: true,
    follow: true
  },
  alternates: {
    canonical: `${siteUrl}/docs`
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" className="bg-background text-foreground" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <RootProvider search={{ enabled: false }} theme={{ defaultTheme: 'dark' }}>
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
