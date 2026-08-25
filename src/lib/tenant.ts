/**
 * Tenant context — the only sanctioned way to touch tenant-owned data.
 *
 * This used to be enforced by the comment above and nothing else, and every
 * write path ignored it. Tenant tables now carry FORCE ROW LEVEL SECURITY, so
 * the boundary is a database guarantee: a query that forgets its scoping
 * returns no rows rather than someone else's.
 *
 * A TenantContext therefore owns the transaction the actor context lives in.
 * There is no way to hold one without also holding the context that makes its
 * queries visible, which is the property the old design lacked.
 */
import { withActor, type Tx } from './db'
import { currentUser } from './auth'
import type { Membership, Organisation, Role, User } from '@prisma/client'

const ROLE_RANK: Record<Role, number> = { EDITOR: 0, ADMIN: 1, OWNER: 2 }

export class TenantContext {
  constructor(
    readonly tx: Tx,
    readonly org: Organisation,
    readonly user: User,
    readonly role: Role,
  ) {}

  require(minRole: Role) {
    if (ROLE_RANK[this.role] < ROLE_RANK[minRole]) {
      throw new TenantError(403, `requires ${minRole}`)
    }
    return this
  }

  hasRole(minRole: Role) {
    return ROLE_RANK[this.role] >= ROLE_RANK[minRole]
  }

  // --- scoped accessors ---
  // The organisationId filters are belt-and-braces: RLS enforces the same thing,
  // and would return nothing if one were dropped.

  apps() {
    return this.tx.app.findMany({
      where: { organisationId: this.org.id },
      orderBy: { createdAt: 'desc' },
    })
  }

  app(id: string) {
    return this.tx.app.findFirst({ where: { id, organisationId: this.org.id } })
  }

  modules() {
    return this.tx.organisationModule.findMany({ where: { organisationId: this.org.id } })
  }

  members() {
    return this.tx.membership.findMany({
      where: { organisationId: this.org.id },
      include: { user: true },
    })
  }

  async moduleEnabled(moduleKey: string) {
    if (moduleKey === 'directory') return true // always on — the price of entry
    const m = await this.tx.organisationModule.findUnique({
      where: { organisationId_moduleKey: { organisationId: this.org.id, moduleKey } },
    })
    return m !== null
  }
}

export class TenantError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/** Resolve the tenant for an authenticated user + org slug, or throw. */
export async function resolveTenant(tx: Tx, userId: string, orgSlug: string): Promise<TenantContext> {
  const membership: (Membership & { organisation: Organisation; user: User }) | null =
    await tx.membership.findFirst({
      where: { userId, organisation: { slug: orgSlug } },
      include: { organisation: true, user: true },
    })
  // 404 rather than 403: a non-member should not learn the organisation exists.
  if (!membership) throw new TenantError(404, 'no such organisation, or you are not a member')
  return new TenantContext(tx, membership.organisation, membership.user, membership.role)
}

/**
 * Open an actor context, resolve the tenant, and run `fn` inside it.
 *
 * All tenant work for a request belongs in one of these. Server actions call it
 * again rather than trusting anything from the page render — the org slug comes
 * from the URL, and identity is re-derived from the session cookie every time.
 */
export async function withTenant<T>(
  orgSlug: string,
  fn: (tenant: TenantContext) => Promise<T>,
): Promise<T> {
  const user = await currentUser()
  if (!user) throw new TenantError(401, 'not signed in')
  return withActor(async (tx) => {
    const tenant = await resolveTenant(tx, user.id, orgSlug)
    return fn(tenant)
  })
}
