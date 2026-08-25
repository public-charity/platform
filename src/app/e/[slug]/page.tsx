import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEvent, EVENT_CATEGORIES } from '@/lib/events'

export const revalidate = 300

const whenFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
})
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const event = await getEvent(slug)
  return { title: event?.title ?? 'Event' }
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEvent(slug)
  if (!event) notFound()

  const category = event.category && EVENT_CATEGORIES[event.category as keyof typeof EVENT_CATEGORIES]

  return (
    <main className="container" style={{ maxWidth: '42rem' }}>
      <p className="muted"><Link href="/whats-on">← What&rsquo;s on</Link></p>
      <h1>{event.title}</h1>
      <p>
        <strong>{whenFmt.format(event.startsAt)}</strong>
        {event.endsAt && <> until {timeFmt.format(event.endsAt)}</>}
        {category && <> · <span className="tag">{category.label}</span></>}
      </p>
      {event.address && <p>{event.address}</p>}
      <p className="muted">Listed by {event.organiser ?? 'a local organisation'}.</p>
      {event.details && <p style={{ whiteSpace: 'pre-wrap' }}>{event.details}</p>}
      {event.link && (
        <p>
          <a className="btn" href={event.link} rel="noopener nofollow">More info / book ↗</a>
          <br />
          <span className="muted">Booking and payment happen on the organiser&rsquo;s own site — money never passes through this platform.</span>
        </p>
      )}
      {event.lng !== null && (
        <p>
          <a className="muted" href={`https://www.openstreetmap.org/?mlat=${event.lat}&mlon=${event.lng}#map=17/${event.lat}/${event.lng}`} rel="noopener">
            Open location in OpenStreetMap ↗
          </a>
        </p>
      )}
    </main>
  )
}
