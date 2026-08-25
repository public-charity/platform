import { redirect } from 'next/navigation'
import { signOut } from '@/lib/auth'
import { withTenant } from '@/lib/tenant'

export default async function OrgSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { members, organisation } = await withTenant(org, async (tenant) => ({
    members: await tenant.members(),
    organisation: tenant.org,
  }))

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
        Status: <span className="badge">{organisation.status.toLowerCase()}</span>
        {organisation.charityNumber && <> · Charity № {organisation.charityNumber}</>}
      </p>
      <h2>Account</h2>
      <form action={doSignOut}>
        <button className="btn secondary" type="submit">Sign out</button>
      </form>
    </main>
  )
}
