/**
 * Outbound email. In production this sends through an SMTP/API provider
 * (configure EMAIL_* secrets); in development it logs the link to stdout.
 */
import { baseUrl } from './base-url'

export async function sendLoginEmail(to: string, token: string) {
  // Same origin resolution as the auth redirect, so the link and the redirect
  // it lands on can never disagree.
  const link = `${await baseUrl()}/app/auth?token=${token}`
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[dev] magic link for ${to}: ${link}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'sign-in@public.charity',
      to,
      subject: 'Your sign-in link for public.charity',
      text: `Sign in to public.charity:\n\n${link}\n\nThis link lasts 15 minutes and can be used once. If you didn't request it, ignore this email.`,
    }),
  })
  if (!res.ok) throw new Error(`email send failed: ${res.status} ${await res.text()}`)
}
