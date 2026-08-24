import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma, safeQuery } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Charity directory',
  description: 'Browse charities listed on public.charity, verified against the official register.',
}

export const revalidate = 300 // ISR — the public surface stays static and fast

type Search = Promise<{ q?: string; tag?: string }>

export default async function Directory({ searchParams }: { searchParams: Search }) {
  const { q, tag } = await searchParams
  const orgs = await safeQuery(() => prisma.organisation.findMany({
    where: {
      status: 'PUBLISHED',
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      ...(tag ? { causeTags: { has: tag } } : {}),
    },
    orderBy: { name: 'asc' },
    take: 200,
  }), [])
  const allTags = [...new Set(orgs.flatMap((o) => o.causeTags))].sort()

  return (
    <main className="container">
      <h1>Charity directory</h1>
      <form action="/directory" method="get" role="search" style={{ margin: '1rem 0' }}>
        <label htmlFor="q" className="muted" style={{ fontWeight: 400 }}>
          Search by name
        </label>{' '}
        <input id="q" type="search" name="q" defaultValue={q ?? ''} />{' '}
        <button className="btn" type="submit">Search</button>
      </form>
      {allTags.length > 0 && (
        <p className="tags">
          {allTags.map((t) => (
            <Link key={t} className="tag" href={`/directory?tag=${encodeURIComponent(t)}`}>
              {t}
            </Link>
          ))}
        </p>
      )}
      {orgs.length === 0 ? (
        <p className="notice">
          No charities match{q ? ` “${q}”` : ''} yet. <Link href="/app/signup">List yours?</Link>
        </p>
      ) : (
        <ul className="grid">
          {orgs.map((o) => (
            <li key={o.id} className="card">
              <h3>
                <Link href={`/c/${o.slug}`}>{o.name}</Link>{' '}
                {o.verifiedAt && <span className="badge verified">Registered</span>}
              </h3>
              <p>{o.descriptionMd.slice(0, 140) || 'No description yet.'}</p>
              {o.causeTags.length > 0 && (
                <p className="tags">
                  {o.causeTags.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
