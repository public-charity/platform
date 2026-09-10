import type { Metadata } from 'next'
import Link from 'next/link'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

/**
 * Reconciled with what was actually running in production.
 *
 * The deployed layout had drifted from this file and was never pushed. Recovering it from
 * the release image showed two deliberate editorial decisions worth keeping, neither of
 * which was in the repository:
 *
 *  - The nav had been cut from six links to three. Six was a site map; three is a choice.
 *  - "Charity" had become "organisation" throughout, because not everything that lists a
 *    warm space or surplus food is a registered charity.
 *
 * The footer is the deployed wording, which is more precise than the version here: it says
 * where bookings and donations actually happen, and that people are never shown on the map.
 *
 * What changed: the title said "What's happening near you", which described the events
 * timeline when the timeline WAS the homepage. It now lives at /whats-on, so the title
 * describes the platform, and the timeline gets a nav link so it is not orphaned.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://public.charity'),
  title: {
    default: 'public.charity — charity infrastructure, given away',
    template: '%s — public.charity',
  },
  description:
    'Digital things a neighbourhood needs and cannot usually afford, built by a charity and given away. A noticeboard and map for your area, and apps anyone can use. No accounts needed to look.',
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
              <Link href="/whats-on">What&rsquo;s on</Link>
              <Link href="/apps">Apps</Link>
              <Link href="/about">About</Link>
              <Link href="/app">Organisation sign in</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">
            <p>
              Free to list, free to browse. Bookings and donations happen on each
              organisation&rsquo;s own site &mdash; money never passes through this platform,
              and we never show people on the map.
            </p>
            <p>
              <Link href="/directory">Organisation directory</Link> ·{' '}
              <a href="/api/geo/events">Open data feed</a> ·{' '}
              <a href="https://github.com/public-charity/platform">Open source</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
