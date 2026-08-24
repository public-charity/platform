import { redirect } from 'next/navigation'
import { currentUser, signOut } from '@/lib/auth'
import { resolveTenant } from '@/lib/tenant'
import { prisma } from '@/lib/db'

export default async function OrgSettings({ params }: { params: Promise<{ org: string }> }) {
  const user = await currentUser()
  if (!user) redirect('/app/login')
  const { org } = await params
  const tenant = await resolveTenant(user.id, org)
  const members = await prisma.membership.findMany({
    where: { organisationId: tenant.org.id },
    include: { user: true },
  })

  async function doSignOut() {
    'use server'
    await signOut()
    redirect('/')
  }

  return (
    <main>
      <h1>Settings</h1>
      <h2>Team</h2>
      <table style={{ maxWidth: '36rem' }}>
        <thead><tr><th>Email</th><th>Role</th></tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.user.email}</td>
              <td><span className="badge">{m.role.toLowerCase()}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Team invitations are coming shortly — for now, contact us to add colleagues.</p>
      <h2>Listing</h2>
      <p>
        Status: <span className="badge">{tenant.org.status.toLowerCase()}</span>
        {tenant.org.charityNumber && <> · Charity № {tenant.org.charityNumber}</>}
      </p>
      <h2>Account</h2>
      <form action={doSignOut}>
        <button className="btn secondary" type="submit">Sign out</button>
      </form>
    </main>
  )
}
