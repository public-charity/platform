import { eventsGeoJSON } from '@/lib/events'

// The broadcast feed: upcoming public events as GeoJSON. Deliberately open —
// anyone may consume and re-display it. RLS scopes it to PUBLIC twins.
export async function GET() {
  const collection = await eventsGeoJSON()
  return Response.json(collection, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  })
}
