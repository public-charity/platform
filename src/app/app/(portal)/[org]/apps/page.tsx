import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { resolveTenant } from '@/lib/tenant'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/audit'

const LOVABLE_TEMPLATE_PROMPT = encodeURIComponent(
  'Build a single-page donation and supporter sign-up site for a UK charity. Clean, accessible, mobile-first. Include: a hero with the charity name and mission, a prominent donate button linking to an external donation URL I will provide, an email sign-up form, and a section for current projects.',
)

export default async function OrgApps({ params }: { params: Promise<{ org: string }> }) {
  const user = await currentUser()
  if (!user) redirect('/app/login')
  const { org } = await params
  const tenant = await resolveTenant(user.id, org)

  const appsEnabled = await tenant.moduleEnabled('apps')

  async function enableApps() {
    'use server'
    const user = await currentUser()
    if (!user) redirect('/app/login')
    const tenant = (await resolveTenant(user.id, org)).require('ADMIN')
    await prisma.organisationModule.upsert({
      where: { organisationId_moduleKey: { organisationId: tenant.org.id, moduleKey: 'apps' } },
      create: { organisationId: tenant.org.id, moduleKey: 'apps' },
      update: {},
    })
    await audit({ actorId: user.id, action: 'module.enable', entity: `Organisation:${tenant.org.id}`, after: { moduleKey: 'apps' } })
    redirect(`/app/${org}/apps`)
  }

  async function submitApp(formData: FormData) {
    'use server'
    const user = await currentUser()
    if (!user) redirect('/app/login')
    const tenant = (await resolveTenant(user.id, org)).require('EDITOR')
    const url = String(formData.get('url') ?? '')
    const title = String(formData.get('title') ?? '').trim().slice(0, 120)
    if (!title || !/^https:\/\/[^\s]+$/.test(url)) redirect(`/app/${org}/apps?error=invalid`)
    const app = await prisma.app.create({
      data: {
        organisationId: tenant.org.id,
        title,
        description: String(formData.get('description') ?? '').slice(0, 500),
        url,
        status: 'PENDING',
      },
    })
    await audit({ actorId: user.id, action: 'app.submit', entity: `App:${app.id}`, after: app })
    revalidatePath('/apps')
    redirect(`/app/${org}/apps?submitted=1`)
  }

  if (!appsEnabled) {
    return (
      <main>
        <h1>Apps</h1>
        <p className="muted" style={{ maxWidth: '40rem' }}>
          Publish apps your charity has built — donation pages, volunteer sign-ups, event sites —
          and they’ll appear on your public page and in the app store. Optional, free, and you can
          switch it off any time.
        </p>
        <form action={enableApps}>
          <button className="btn" type="submit">Enable the apps module</button>
        </form>
      </main>
    )
  }

  const apps = await tenant.apps()

  return (
    <main>
      <h1>Apps</h1>
      <section className="notice" style={{ maxWidth: '40rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Don’t have an app yet?</h3>
        <p className="muted">
          You can build one with an AI app builder — no developers needed. Describe what you want,
          publish it, then paste the published link below. One starting point:
        </p>
        <p>
          <a className="btn secondary" href={`https://lovable.dev/?prompt=${LOVABLE_TEMPLATE_PROMPT}`} rel="noopener">
            Start from our charity template on Lovable ↗
          </a>
        </p>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Any builder or developer works — we list any published https:// URL. Apps are reviewed
          before they appear publicly.
        </p>
      </section>

      <h2>Submit an app</h2>
      <form action={submitApp} className="stack" style={{ maxWidth: '36rem' }}>
        <label>
          Title
          <input name="title" required maxLength={120} />
        </label>
        <label>
          Published URL
          <input type="url" name="url" required placeholder="https://your-app.lovable.app" />
        </label>
        <label>
          Description
          <textarea name="description" rows={3} maxLength={500} />
        </label>
        <button className="btn" type="submit">Submit for review</button>
      </form>

      <h2>Your apps</h2>
      {apps.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Title</th><th>Status</th><th>URL</th></tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td><span className="badge">{a.status.toLowerCase()}</span></td>
                <td><a href={a.url} rel="noopener">{a.url}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted" style={{ marginTop: '1rem' }}>
        <Link href="/apps">See the public app store ↗</Link>
      </p>
    </main>
  )
}
