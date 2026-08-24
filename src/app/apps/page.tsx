import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma, safeQuery } from '@/lib/db'

export const metadata: Metadata = {
  title: 'App store',
  description: 'Apps built and published by charities on public.charity.',
}

export const revalidate = 300

export default async function AppStore() {
  const apps = await safeQuery(() => prisma.app.findMany({
    where: { status: 'PUBLISHED', organisation: { status: 'PUBLISHED' } },
    include: { organisation: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  }), [])

  return (
    <main className="container">
      <h1>App store</h1>
      <p className="muted" style={{ maxWidth: '44rem' }}>
        Apps built by charities — donation flows, volunteer sign-ups, event pages and more. Each app
        runs on the charity’s own account with its own provider; we list and link.
      </p>
      {apps.length === 0 ? (
        <p className="notice">
          Nothing here yet. Charities: <Link href="/app">sign in</Link> to publish your first app.
        </p>
      ) : (
        <ul className="grid">
          {apps.map((a) => (
            <li key={a.id} className="card">
              <h3><a href={a.url} rel="noopener">{a.title}</a></h3>
              <p>{a.description}</p>
              <p>
                <Link className="muted" href={`/c/${a.organisation.slug}`}>
                  by {a.organisation.name}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
