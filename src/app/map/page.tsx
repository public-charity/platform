import type { Metadata } from 'next'
import Link from 'next/link'
import { eventsGeoJSON } from '@/lib/events'
import { safeQuery } from '@/lib/db'
import EventsMap from '@/components/EventsMap'

export const metadata: Metadata = {
  title: 'Map',
  description: 'Everything happening near you, on one map.',
}
export const revalidate = 300

export default async function MapPage() {
  const collection = await safeQuery(() => eventsGeoJSON(), { type: 'FeatureCollection' as const, features: [] })
  return (
    <main className="container">
      <h1>The map</h1>
      <p className="muted">
        Upcoming events across the area. Prefer a list? <Link href="/whats-on">See what&rsquo;s on →</Link>
      </p>
      <EventsMap features={collection.features} />
      <p className="muted" style={{ marginTop: '0.75rem' }}>
        This map shows events and places — never people. The data behind it is an open feed at{' '}
        <a href="/api/geo/events">/api/geo/events</a>.
      </p>
    </main>
  )
}
