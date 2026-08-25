import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { currentUser, createLoginToken } from '@/lib/auth'
import { sendLoginEmail } from '@/lib/email'
import { lookupCCEW } from '@/lib/charity-register'
import { audit } from '@/lib/audit'

export const metadata: Metadata = { title: 'List your charity' }

// Organisation slugs share a path segment with /app/login, /app/signup and
// /app/auth, and the static segments win — a charity that slugified to one of
// these would be permanently unreachable.
const RESERVED_SLUGS = new Set(['login', 'signup', 'auth', 'app', 'api', 'admin', 'settings', 'new'])

function slugify(name: string) {
  const base = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  if (!base) return 'charity'
  return RESERVED_SLUGS.has(base) ? `${base}-org` : base
}

async function signup(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim()
  const charityNumber = String(formData.get('charityNumber') ?? '').replace(/\D/g, '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) redirect('/app/signup?error=required')

  // Verify against the official register when a number is given and lookup is configured
  const reg = charityNumber ? await lookupCCEW(charityNumber) : null

  const user = await prisma.user.upsert({ where: { email }, create: { email }, update: {} })

  // Allocate the slug by attempting the insert rather than checking first.
  // Check-then-insert was always a race, and under row-level security a pending
  // organisation belonging to someone else is invisible to the check — so the
  // collision would surface as a constraint violation at insert time anyway.
  const base = slugify(reg?.name ?? name)
  let org = null
  for (let attempt = 1; attempt <= 25 && !org; attempt++) {
    try {
      org = await prisma.organisation.create({
        data: {
          slug: attempt === 1 ? base : `${base}-${attempt}`,
          name: reg?.name ?? name,
          charityNumber: charityNumber || null,
          registerSource: reg ? 'CCEW' : 'NONE',
          verifiedAt: reg?.registered ? new Date() : null,
          status: 'PENDING', // published after moderation
          memberships: { create: { userId: user.id, role: 'OWNER' } },
          modules: { create: { moduleKey: 'directory' } },
        },
      })
    } catch (e) {
      const taken = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      if (!taken) throw e
    }
  }
  if (!org) redirect('/app/signup?error=required')

  await audit(prisma, { actorId: user.id, action: 'org.signup', entity: `Organisation:${org.id}`, after: org })

  const token = await createLoginToken(email)
  await sendLoginEmail(email, token)
  redirect('/app/signup?done=1')
}

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>
}) {
  const { done, error } = await searchParams
  const user = await currentUser()
  if (done) {
    return (
      <main className="container" style={{ maxWidth: '28rem' }}>
        <h1>Nearly there</h1>
        <p className="notice">
          Your listing is created and awaiting a quick review. We’ve emailed you a sign-in link so
          you can add your details in the meantime.
        </p>
      </main>
    )
  }
  return (
    <main className="container" style={{ maxWidth: '28rem' }}>
      <h1>List your charity</h1>
      <p className="muted">
        Free, and takes about two minutes. If you have a registered charity number we’ll fetch your
        details from the official register.
      </p>
      {error === 'required' && <p className="notice">Name and a valid email are required.</p>}
      <form action={signup} className="stack">
        <label>
          Charity number <span className="muted">(optional — England &amp; Wales)</span>
          <input name="charityNumber" inputMode="numeric" placeholder="e.g. 1234567" />
        </label>
        <label>
          Charity name
          <input name="name" required />
        </label>
        <label>
          Your email
          <input type="email" name="email" required defaultValue={user?.email ?? ''} autoComplete="email" />
        </label>
        <button className="btn" type="submit">Create my listing</button>
      </form>
    </main>
  )
}
