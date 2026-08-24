import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

export const revalidate = 300

type Params = Promise<{ slug: string }>

async function getOrg(slug: string) {
  return prisma.organisation.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { apps: { where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' } } },
  })
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const org = await getOrg((await params).slug)
  if (!org) return {}
  return { title: org.name, description: org.descriptionMd.slice(0, 160) }
}

export default async function CharityPage({ params }: { params: Params }) {
  const org = await getOrg((await params).slug)
  if (!org) notFound()

  return (
    <main className="container">
      <h1>
        {org.name}{' '}
        {org.verifiedAt && (
          <span className="badge verified">
            Registered charity {org.charityNumber ? `№ ${org.charityNumber}` : ''}
          </span>
        )}
      </h1>
      {org.causeTags.length > 0 && (
        <p className="tags">
          {org.causeTags.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </p>
      )}
      {org.descriptionMd && <p style={{ maxWidth: '44rem' }}>{org.descriptionMd}</p>}
      <p>
        {org.donateUrl && (
          <a className="btn" href={org.donateUrl} rel="noopener">
            Donate — direct to {org.name}
          </a>
        )}{' '}
        {org.website && (
          <a className="btn secondary" href={org.website} rel="noopener">
            Visit website
          </a>
        )}
      </p>
      {org.donateUrl && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Donations go directly to the charity’s own payment provider. public.charity never handles
          your money.
        </p>
      )}
      {org.apps.length > 0 && (
        <section>
          <h2>Apps from {org.name}</h2>
          <ul className="grid">
            {org.apps.map((a) => (
              <li key={a.id} className="card">
                <h3>
                  <a href={a.url} rel="noopener">{a.title}</a>
                </h3>
                <p>{a.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
