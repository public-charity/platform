import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { resolveTenant, TenantError } from '@/lib/tenant'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ org: string }>
}) {
  const user = await currentUser()
  if (!user) redirect('/app/login')
  const { org } = await params
  try {
    const tenant = await resolveTenant(user.id, org)
    return (
      <div className="container" style={{ paddingTop: '1.5rem' }}>
        <nav className="site-nav" aria-label="Charity" style={{ marginLeft: 0, marginBottom: '1rem' }}>
          <strong>{tenant.org.name}</strong>
          <Link href={`/app/${org}`}>Overview</Link>
          <Link href={`/app/${org}/apps`}>Apps</Link>
          <Link href={`/app/${org}/settings`}>Settings</Link>
          <Link href={`/c/${org}`}>Public page ↗</Link>
        </nav>
        {children}
      </div>
    )
  } catch (e) {
    if (e instanceof TenantError) notFound()
    throw e
  }
}
