/**
 * Events — the first product surface built purely on the twin registry.
 *
 * An event is a Twin of kind EVENT: its time is the twin's validity interval,
 * its place is the twin's geometry, its organiser is a Stewardship row, and
 * everything else is facts. Nothing here required a schema change.
 *
 * Broadcast only, by design. There are no comments, likes or follows — that
 * is social media, and this is a noticeboard. A new broadcastable type is a
 * row in EVENT_CATEGORIES, not a feature.
 */
import { prisma } from './db'
import type { TenantContext } from './tenant'

export const EVENT_CATEGORIES = {
  community: { label: 'Community', blurb: 'Meetups, warm spaces, clubs and gatherings' },
  food: { label: 'Food', blurb: 'Surplus food, community meals, food banks' },
  sale: { label: 'Sales & offers', blurb: 'Local business sales, markets and offers' },
  volunteer: { label: 'Volunteering', blurb: 'A few hours that help' },
  learning: { label: 'Learning', blurb: 'Workshops, classes and repair cafés' },
  other: { label: 'Other', blurb: 'Everything else worth knowing about' },
} as const

export type EventCategory = keyof typeof EVENT_CATEGORIES
export const isEventCategory = (c: string): c is EventCategory => c in EVENT_CATEGORIES

export type EventRow = {
  id: string
  slug: string
  title: string
  startsAt: Date
  endsAt: Date | null
  category: string | null
  details: string | null
  link: string | null
  address: string | null
  organiser: string | null
  lng: number | null
  lat: number | null
}

const EVENT_SELECT = `
  SELECT t.id, t.slug, t."displayName" AS title,
         t."validFrom" AS "startsAt", t."validTo" AS "endsAt",
         ST_X(t.geom) AS lng, ST_Y(t.geom) AS lat,
         (SELECT f."valueText" FROM "TwinFact" f WHERE f."twinId" = t.id AND f."attributeKey" = 'event.category' AND f."redactedAt" IS NULL LIMIT 1) AS category,
         (SELECT f."valueText" FROM "TwinFact" f WHERE f."twinId" = t.id AND f."attributeKey" = 'event.details'  AND f."redactedAt" IS NULL LIMIT 1) AS details,
         (SELECT f."valueText" FROM "TwinFact" f WHERE f."twinId" = t.id AND f."attributeKey" = 'event.link'     AND f."redactedAt" IS NULL LIMIT 1) AS link,
         (SELECT f."valueText" FROM "TwinFact" f WHERE f."twinId" = t.id AND f."attributeKey" = 'event.address'  AND f."redactedAt" IS NULL LIMIT 1) AS address,
         (SELECT o."displayName" FROM "Stewardship" s JOIN "Twin" o ON o.id = s."stewardTwinId"
           WHERE s."twinId" = t.id AND s.during @> now() LIMIT 1) AS organiser
  FROM "Twin" t
  WHERE t.kind = 'EVENT' AND t.status = 'ACTIVE'
`

/** Upcoming and ongoing public events, soonest first. RLS scopes this to PUBLIC for anonymous callers. */
export function listUpcomingEvents(category?: string): Promise<EventRow[]> {
  const cat = category && isEventCategory(category) ? category : null
  return prisma.$queryRawUnsafe<EventRow[]>(
    `${EVENT_SELECT}
       AND coalesce(t."validTo", t."validFrom" + interval '3 hours') > now()
       AND ($1::text IS NULL OR EXISTS (
             SELECT 1 FROM "TwinFact" f WHERE f."twinId" = t.id
               AND f."attributeKey" = 'event.category' AND f."valueText" = $1))
     ORDER BY t."validFrom" ASC
     LIMIT 200`,
    cat,
  )
}

export async function getEvent(slug: string): Promise<EventRow | null> {
  const rows = await prisma.$queryRawUnsafe<EventRow[]>(
    `${EVENT_SELECT} AND t.slug = $1 LIMIT 1`,
    slug,
  )
  return rows[0] ?? null
}

/** GeoJSON of upcoming public events — the map's data, and a broadcast feed anyone may consume. */
export async function eventsGeoJSON() {
  const events = await listUpcomingEvents()
  return {
    type: 'FeatureCollection' as const,
    features: events
      .filter((e) => e.lng !== null && e.lat !== null)
      .map((e) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lng!, e.lat!] as [number, number] },
        properties: {
          slug: e.slug,
          title: e.title,
          startsAt: e.startsAt.toISOString(),
          category: e.category,
          organiser: e.organiser,
          address: e.address,
        },
      })),
  }
}

/** UK postcode → point, via postcodes.io (free, no key). Null when not found. */
export async function lookupPostcode(postcode: string): Promise<{ lng: number; lat: number } | null> {
  const clean = postcode.trim().replace(/\s+/g, '')
  if (!/^[A-Za-z]{1,2}\d[A-Za-z\d]?\d[A-Za-z]{2}$/.test(clean)) return null
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`, {
      next: { revalidate: 86_400 },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { result?: { longitude: number; latitude: number } }
    if (!body.result) return null
    return { lng: body.result.longitude, lat: body.result.latitude }
  } catch {
    return null
  }
}

function slugify(title: string, startsAt: Date) {
  const base = title.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
  const d = startsAt.toISOString().slice(0, 10)
  return `${base || 'event'}-${d}`
}

export type CreateEventInput = {
  title: string
  category: EventCategory
  startsAtLocal: string // 'YYYY-MM-DDTHH:mm' from datetime-local, Europe/London
  endsAtLocal?: string
  postcode: string
  address?: string
  details?: string
  link?: string
}

/**
 * Create an event stewarded by the tenant's organisation.
 *
 * Runs inside the tenant's transaction, so every insert is policy-checked as
 * the acting user: the twin insert, the stewardship claim and the facts all
 * succeed or fail together under RLS.
 */
export async function createEvent(tenant: TenantContext, input: CreateEventInput): Promise<string> {
  const point = await lookupPostcode(input.postcode)
  if (!point) throw new EventInputError('That postcode was not recognised.')

  const startsAt = new Date(input.startsAtLocal)
  if (Number.isNaN(startsAt.getTime())) throw new EventInputError('A start date and time is required.')
  const endsAt = input.endsAtLocal ? new Date(input.endsAtLocal) : null
  if (endsAt && endsAt <= startsAt) throw new EventInputError('The end must be after the start.')

  const orgTwin = await tenant.tx.twin.findUnique({ where: { organisationId: tenant.org.id }, select: { id: true } })
  if (!orgTwin) throw new EventInputError('This organisation has no twin yet — contact support.')

  const baseSlug = slugify(input.title, startsAt)
  for (let attempt = 1; attempt <= 20; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`
    const taken = await tenant.tx.twin.findFirst({ where: { kind: 'EVENT', slug }, select: { id: true } })
    if (taken) continue

    const [{ id }] = await tenant.tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "Twin"(kind, "displayName", slug, visibility, "validFrom", "validTo", geom, "updatedAt")
      VALUES ('EVENT', ${input.title.slice(0, 140)}, ${slug}, 'PUBLIC',
              (${input.startsAtLocal}::timestamp AT TIME ZONE 'Europe/London'),
              (${input.endsAtLocal ?? null}::timestamp AT TIME ZONE 'Europe/London'),
              ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326),
              now())
      RETURNING id`

    await tenant.tx.$executeRaw`
      INSERT INTO "Stewardship"("twinId", "stewardTwinId", role, "fromAt")
      VALUES (${id}::uuid, ${orgTwin.id}::uuid, 'OWNER', now())`

    const selfSource = await tenant.tx.source.findUnique({ where: { key: 'self' }, select: { id: true } })
    const facts: Array<[string, string | undefined]> = [
      ['event.category', input.category],
      ['event.details', input.details?.slice(0, 2000)],
      ['event.link', input.link],
      ['event.address', input.address?.slice(0, 200)],
    ]
    for (const [attributeKey, valueText] of facts) {
      if (!valueText) continue
      await tenant.tx.twinFact.create({
        data: { twinId: id, attributeKey, valueText, sourceId: selfSource!.id, visibility: 'PUBLIC' },
      })
    }
    return slug
  }
  throw new EventInputError('Could not allocate a unique event page — try a different title.')
}

export class EventInputError extends Error {}
