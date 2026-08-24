import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { currentUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Your charities' }

export default async function PortalHome() {
  const user = await currentUser()
  if (!user) redirect('/app/login')
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { organisation: true },
    orderBy: { organisation: { name: 'asc' } },
  })
  if (memberships.length === 1) redirect(`/app/${memberships[0].organisation.slug}`)

  return (
    <main className="container">
      <h1>Your charities</h1>
      {memberships.length === 0 ? (
        <p className="notice">
          You’re not part of any charity yet. <Link href="/app/signup">List one</Link>, or ask a
          colleague to invite you.
        </p>
      ) : (
        <ul className="grid">
          {memberships.map((m) => (
            <li key={m.id} className="card">
              <h3><Link href={`/app/${m.organisation.slug}`}>{m.organisation.name}</Link></h3>
              <p>{m.role.toLowerCase()} · {m.organisation.status.toLowerCase()}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
