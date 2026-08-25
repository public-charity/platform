import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { cookies } from 'next/headers'
import { createHash } from 'node:crypto'
import { SESSION_COOKIE } from './constants'

// Single PrismaClient across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function makeClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/** A transaction-scoped client. Tenant tables are only readable through one of these. */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * The only door to tenant-owned data.
 *
 * Every tenant table has FORCE ROW LEVEL SECURITY, and the policies key off
 * `app.user_id()`. That setting is established by `app.assume()`, which takes a
 * session token hash and resolves the user itself — the application cannot
 * simply assert an identity.
 *
 * The transaction is load-bearing, not decoration. `set_config(..., true)` is
 * SET LOCAL, which only exists inside a transaction; outside one it is a no-op
 * with a warning. A plain SET would persist on the pooled connection and be
 * handed to whoever gets it next. Prisma's pg adapter pins a single connection
 * for `$transaction` and takes an arbitrary one for every other query, so all
 * work for a request must happen inside this callback.
 *
 * Without a valid session the context stays empty and only the public policies
 * match — anonymous callers see published rows and nothing else.
 */
export async function withActor<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  const tokenHash = raw ? createHash('sha256').update(raw).digest('hex') : null

  return prisma.$transaction(async (tx) => {
    if (tokenHash) {
      await tx.$queryRaw`SELECT app.assume(${tokenHash})`
    }
    return fn(tx)
  })
}

/**
 * Run a query, returning a fallback when the database is unreachable.
 * Public ISR pages use this so `next build` never requires a live database
 * (builds run in a builder without one); the first revalidation after deploy
 * fills the cache with real data.
 *
 * Connection failures only. An RLS denial or a missing actor context is a bug,
 * not an outage, and must not be laundered into an empty page.
 */
const CONNECTION_ERRORS = /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|Can't reach database|connection refused|57P03|08006|08001/i

export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
    const msg = e instanceof Error ? `${e.message} ${(e as { code?: string }).code ?? ''}` : String(e)
    if (!isBuild && !CONNECTION_ERRORS.test(msg)) throw e
    if (process.env.NODE_ENV === 'production' && !isBuild) {
      console.error('safeQuery fallback (database unreachable):', e)
    }
    return fallback
  }
}
