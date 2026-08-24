import { NextRequest, NextResponse } from 'next/server'
import { redeemLoginToken } from '@/lib/auth'

// GET /app/auth?token=... — the magic-link landing.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const user = token ? await redeemLoginToken(token) : null
  if (!user) {
    return NextResponse.redirect(new URL('/app/login?error=expired', req.url))
  }
  return NextResponse.redirect(new URL('/app', req.url))
}
