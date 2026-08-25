import { NextRequest, NextResponse } from 'next/server'
import { redeemLoginToken } from '@/lib/auth'
import { baseUrl } from '@/lib/base-url'

// GET /app/auth?token=... — the magic-link landing.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const user = token ? await redeemLoginToken(token) : null
  // Resolve against the public origin, not req.url — see lib/base-url.ts.
  const origin = await baseUrl()
  return NextResponse.redirect(new URL(user ? '/app' : '/app/login?error=expired', origin))
}
