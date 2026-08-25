import type { Metadata } from 'next'
import Link from 'next/link'
import { listUpcomingEvents, EVENT_CATEGORIES, type EventRow } from '@/lib/events'
import { safeQuery } from '@/lib/db'

export const metadata: Metadata = {
  title: "What's on",
  description: 'Everything happening near you — community events, surplus food, local sales, volunteering. A noticeboard, not a feed.',
}
export const revalidate = 300

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

export default async function WhatsOn({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  const events = await safeQuery(() => listUpcomingEvents(c), [])

  const byDay = new Map<string, EventRow[]>()
  for (const e of events) {
    const day = dayFmt.format(e.startsAt)
    byDay.set(day, [...(byDay.get(day) ?? []), e])
  }

  return (
    <main className="container">
      <h1>What&rsquo;s on</h1>
      <p className="muted">
        A public noticeboard for your area — events, surplus food, local sales, volunteering.
        No comments, no likes, no algorithm: just what&rsquo;s happening, when, and who is running it.{' '}
        <Link href="/map">See it on the map →</Link>
      </p>
      <p className="tags">
        <Link className={`tag${!c ? ' badge' : ''}`} href="/whats-on">All</Link>
        {Object.entries(EVENT_CATEGORIES).map(([key, v]) => (
          <Link key={key} className={`tag${c === key ? ' badge' : ''}`} href={`/whats-on?c=${key}`}>{v.label}</Link>
        ))}
      </p>

      {events.length === 0 && (
        <div className="card">
          <p>Nothing listed{c ? ' in this category' : ''} yet.</p>
          <p className="muted">
            Organisations list events free from their dashboard — <Link href="/app">sign in</Link> or{' '}
            <Link href="/app/signup">create a listing</Link> to put yours on the board.
          </p>
        </div>
      )}

      {[...byDay.entries()].map(([day, dayEvents]) => (
        <section key={day}>
          <h2 style={{ marginTop: '1.5rem' }}>{day}</h2>
          <div className="grid">
            {dayEvents.map((e) => (
              <article key={e.id} className="card">
                <p className="muted" style={{ margin: 0 }}>
                  {timeFmt.format(e.startsAt)}
                  {e.endsAt && <> – {timeFmt.format(e.endsAt)}</>}
                  {e.category && EVENT_CATEGORIES[e.category as keyof typeof EVENT_CATEGORIES] && (
                    <> · <span className="tag">{EVENT_CATEGORIES[e.category as keyof typeof EVENT_CATEGORIES].label}</span></>
                  )}
                </p>
                <h3 style={{ margin: '0.25rem 0' }}><Link href={`/e/${e.slug}`}>{e.title}</Link></h3>
                <p className="muted" style={{ margin: 0 }}>
                  {e.address && <>{e.address} · </>}
                  {e.organiser ? <>by {e.organiser}</> : 'by a local organisation'}
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
