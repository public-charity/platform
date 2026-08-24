import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://public.charity'),
  title: { default: 'public.charity', template: '%s — public.charity' },
  description:
    'A free, open directory of charities — and free tools they can adopt when they are ready.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand">
              public<span>.charity</span>
            </Link>
            <nav className="site-nav" aria-label="Main">
              <Link href="/directory">Directory</Link>
              <Link href="/apps">Apps</Link>
              <Link href="/about">About</Link>
              <Link href="/app">Charity sign in</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">
            <p>
              public.charity is free for charities, forever. Donations always go directly to each
              charity — money never passes through this platform.
            </p>
            <p>
              <a href="https://github.com/public-charity/platform">Open source</a> · built to
              promote the efficiency and effectiveness of charities.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
