/**
 * Tenant context — the only sanctioned way to touch tenant-owned tables.
 *
 * Rule: route handlers and server components never query Organisation-owned
 * data with a bare prisma call. They resolve a TenantContext first, and every
 * query goes through it, so organisationId scoping is enforced in one place
 * rather than remembered at each call site.
 */
import { prisma } from './db'
import type { Membership, Organisation, Role, User } from '@prisma/client'

const ROLE_RANK: Record<Role, number> = { EDITOR: 0, ADMIN: 1, OWNER: 2 }

export class TenantContext {
  constructor(
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

  // --- scoped accessors; add one per tenant-owned model ---

  apps() {
    return prisma.app.findMany({ where: { organisationId: this.org.id }, orderBy: { createdAt: 'desc' } })
  }

  app(id: string) {
    return prisma.app.findFirst({ where: { id, organisationId: this.org.id } })
  }

  modules() {
    return prisma.organisationModule.findMany({ where: { organisationId: this.org.id } })
  }

  async moduleEnabled(moduleKey: string) {
    if (moduleKey === 'directory') return true // always on — the price of entry
    const m = await prisma.organisationModule.findUnique({
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
export async function resolveTenant(userId: string, orgSlug: string): Promise<TenantContext> {
  const membership: (Membership & { organisation: Organisation; user: User }) | null =
    await prisma.membership.findFirst({
      where: { userId, organisation: { slug: orgSlug } },
      include: { organisation: true, user: true },
    })
  if (!membership) throw new TenantError(404, 'no such organisation, or you are not a member')
  return new TenantContext(membership.organisation, membership.user, membership.role)
}
