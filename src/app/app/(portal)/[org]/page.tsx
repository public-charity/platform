import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { resolveTenant } from '@/lib/tenant'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/audit'

export default async function OrgOverview({ params }: { params: Promise<{ org: string }> }) {
  const user = await currentUser()
  if (!user) redirect('/app/login')
  const { org } = await params
  const tenant = await resolveTenant(user.id, org)

  async function saveProfile(formData: FormData) {
    'use server'
    const user = await currentUser()
    if (!user) redirect('/app/login')
    const tenant = (await resolveTenant(user.id, org)).require('EDITOR')
    const before = tenant.org
    const updated = await prisma.organisation.update({
      where: { id: tenant.org.id },
      data: {
        descriptionMd: String(formData.get('description') ?? '').slice(0, 4000),
        website: String(formData.get('website') ?? '') || null,
        donateUrl: String(formData.get('donateUrl') ?? '') || null,
        region: String(formData.get('region') ?? '') || null,
        causeTags: String(formData.get('causeTags') ?? '')
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8),
      },
    })
    await audit({ actorId: user.id, action: 'org.update', entity: `Organisation:${updated.id}`, before, after: updated })
    revalidatePath(`/c/${org}`)
    revalidatePath('/directory')
    redirect(`/app/${org}?saved=1`)
  }

  return (
    <main>
      <h1>Overview</h1>
      {tenant.org.status === 'PENDING' && (
        <p className="notice">
          Your listing is awaiting review. It will appear in the public directory once approved.
        </p>
      )}
      <form action={saveProfile} className="stack" style={{ maxWidth: '36rem' }}>
        <label>
          About your charity
          <textarea name="description" rows={6} defaultValue={tenant.org.descriptionMd} />
        </label>
        <label>
          Website
          <input type="url" name="website" defaultValue={tenant.org.website ?? ''} placeholder="https://" />
        </label>
        <label>
          Donation link <span className="muted">(your own provider — donors go straight there)</span>
          <input type="url" name="donateUrl" defaultValue={tenant.org.donateUrl ?? ''} placeholder="https://" />
        </label>
        <label>
          Region
          <input name="region" defaultValue={tenant.org.region ?? ''} placeholder="e.g. Greater Manchester" />
        </label>
        <label>
          Cause tags <span className="muted">(comma-separated, up to 8)</span>
          <input name="causeTags" defaultValue={tenant.org.causeTags.join(', ')} placeholder="education, poverty relief" />
        </label>
        <button className="btn" type="submit">Save</button>
      </form>
    </main>
  )
}
