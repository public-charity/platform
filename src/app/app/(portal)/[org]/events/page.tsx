import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { withTenant } from '@/lib/tenant'
import { audit } from '@/lib/audit'
import { createEvent, EventInputError, EVENT_CATEGORIES, isEventCategory } from '@/lib/events'

export default async function OrgEvents({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const { org } = await params
  const { done, error } = await searchParams

  const events = await withTenant(org, (tenant) =>
    tenant.tx.$queryRaw<{ slug: string; title: string; startsAt: Date }[]>`
      SELECT t.slug, t."displayName" AS title, t."validFrom" AS "startsAt"
        FROM "Twin" t
        JOIN "Stewardship" s ON s."twinId" = t.id
        JOIN "Twin" o ON o.id = s."stewardTwinId"
       WHERE t.kind = 'EVENT' AND o."organisationId" = ${tenant.org.id}
       ORDER BY t."validFrom" DESC LIMIT 50`,
  )

  async function submit(formData: FormData) {
    'use server'
    const category = String(formData.get('category') ?? '')
    if (!isEventCategory(category)) redirect(`/app/${org}/events?error=invalid`)
    try {
      const slug = await withTenant(org, async (tenant) => {
        tenant.require('EDITOR')
        const created = await createEvent(tenant, {
          title: String(formData.get('title') ?? '').trim(),
          category,
          startsAtLocal: String(formData.get('startsAt') ?? ''),
          endsAtLocal: String(formData.get('endsAt') ?? '') || undefined,
          postcode: String(formData.get('postcode') ?? ''),
          address: String(formData.get('address') ?? '') || undefined,
          details: String(formData.get('details') ?? '') || undefined,
          link: String(formData.get('link') ?? '') || undefined,
        })
        await audit(tenant.tx, {
          actorId: tenant.user.id,
          action: 'event.create',
          entity: `Twin:${created}`,
          after: { slug: created },
        })
        return created
      })
      revalidatePath('/whats-on')
      revalidatePath('/map')
      redirect(`/app/${org}/events?done=${encodeURIComponent(slug)}`)
    } catch (e) {
      if (e instanceof EventInputError) redirect(`/app/${org}/events?error=${encodeURIComponent(e.message)}`)
      throw e
    }
  }

  return (
    <main>
      <h1>Events</h1>
      <p className="muted">
        Everything you list appears on the public <a href="/whats-on">what&rsquo;s-on board</a> and{' '}
        <a href="/map">map</a> — free, with your organisation named as the organiser. Bookings and
        payments stay on your own site via the link you provide.
      </p>
      {done && (
        <p className="notice">
          Listed. <a href={`/e/${done}`}>See the public page ↗</a>
        </p>
      )}
      {error && <p className="notice">{error === 'invalid' ? 'Please check the form and try again.' : error}</p>}

      <form action={submit} className="stack" style={{ maxWidth: '36rem' }}>
        <label>
          What is it
          <input name="title" required maxLength={140} placeholder="e.g. Surplus food giveaway" />
        </label>
        <label>
          Category
          <select name="category" required defaultValue="community">
            {Object.entries(EVENT_CATEGORIES).map(([key, v]) => (
              <option key={key} value={key}>{v.label} — {v.blurb}</option>
            ))}
          </select>
        </label>
        <label>
          Starts
          <input type="datetime-local" name="startsAt" required />
        </label>
        <label>
          Ends <span className="muted">(optional)</span>
          <input type="datetime-local" name="endsAt" />
        </label>
        <label>
          Postcode <span className="muted">(puts it on the map)</span>
          <input name="postcode" required placeholder="e.g. M1 1AE" />
        </label>
        <label>
          Address / venue name <span className="muted">(shown publicly)</span>
          <input name="address" maxLength={200} placeholder="e.g. St Mary's Community Hall" />
        </label>
        <label>
          Details <span className="muted">(optional)</span>
          <textarea name="details" rows={4} maxLength={2000} />
        </label>
        <label>
          Link for more info / booking <span className="muted">(your own site — optional)</span>
          <input type="url" name="link" placeholder="https://" />
        </label>
        <button className="btn" type="submit">List it</button>
      </form>

      {events.length > 0 && (
        <>
          <h2 style={{ marginTop: '2rem' }}>Your listings</h2>
          <ul>
            {events.map((e) => (
              <li key={e.slug}>
                <a href={`/e/${e.slug}`}>{e.title}</a>{' '}
                <span className="muted">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(e.startsAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
