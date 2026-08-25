import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { withTenant, TenantError } from '@/lib/tenant'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ org: string }>
}) {
  const { org } = await params

  let name: string | null = null
  let failure = 0
  try {
    name = await withTenant(org, async (tenant) => tenant.org.name)
  } catch (e) {
    if (e instanceof TenantError) failure = e.status
    else throw e
  }
  // redirect()/notFound() throw their own control-flow errors, so they belong
  // outside the catch rather than inside it.
  if (failure === 401) redirect('/app/login')
  if (failure) notFound()

  return (
    <div className="container" style={{ paddingTop: '1.5rem' }}>
      <nav className="site-nav" aria-label="Charity" style={{ marginLeft: 0, marginBottom: '1rem' }}>
        <strong>{name}</strong>
        <Link href={`/app/${org}`}>Overview</Link>
        <Link href={`/app/${org}/apps`}>Apps</Link>
        <Link href={`/app/${org}/settings`}>Settings</Link>
        <Link href={`/c/${org}`}>Public page ↗</Link>
      </nav>
      {children}
    </div>
  )
}
