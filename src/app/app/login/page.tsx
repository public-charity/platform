import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createLoginToken } from '@/lib/auth'
import { sendLoginEmail } from '@/lib/email'

export const metadata: Metadata = { title: 'Sign in' }

async function requestLink(formData: FormData) {
  'use server'
  const email = String(formData.get('email') ?? '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect('/app/login?error=email')
  const token = await createLoginToken(email)
  await sendLoginEmail(email, token)
  redirect('/app/login?sent=1')
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const { sent, error } = await searchParams
  return (
    <main className="container" style={{ maxWidth: '28rem' }}>
      <h1>Sign in</h1>
      {sent ? (
        <p className="notice">
          If that address has an account, a sign-in link is on its way. It lasts 15 minutes — check
          spam if it doesn’t arrive.
        </p>
      ) : (
        <>
          {error === 'email' && <p className="notice">That doesn’t look like an email address.</p>}
          <p className="muted">
            No passwords here. Enter your email and we send a one-time sign-in link.
          </p>
          <form action={requestLink} className="stack">
            <label>
              Email
              <input type="email" name="email" required autoComplete="email" />
            </label>
            <button className="btn" type="submit">Email me a sign-in link</button>
          </form>
        </>
      )}
    </main>
  )
}
