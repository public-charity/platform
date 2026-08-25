/**
 * The canonical public origin of this deployment.
 *
 * Auth redirects must never be derived from `req.url`. Next's standalone server
 * reports its own bind address there — the Dockerfile sets HOSTNAME=0.0.0.0 — so
 * behind Fly's TLS proxy `new URL(path, req.url)` resolves to
 * https://0.0.0.0:3000: it picks up the scheme from x-forwarded-proto but keeps
 * the internal host, and the magic link then lands somewhere no browser can
 * reach. The user retries the link, the single-use token is already spent, and
 * the failure surfaces as ?error=expired.
 *
 * BASE_URL wins when set. Otherwise fall back to the proxy's forwarded headers,
 * which — unlike req.url — do carry the real public host.
 */
import { headers } from 'next/headers'

export async function baseUrl(): Promise<string> {
  const configured = process.env.BASE_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (host && !/^(0\.0\.0\.0|\[::\]|::)(:|$)/.test(host)) {
    const proto = h.get('x-forwarded-proto')?.split(',')[0].trim() || 'http'
    return `${proto}://${host}`
  }
  return 'http://localhost:3000'
}
