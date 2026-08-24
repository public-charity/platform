import { prisma } from './db'

/** Append-only audit trail. Corrections are new records, never edits. */
export function audit(params: {
  actorId?: string | null
  action: string
  entity: string
  before?: unknown
  after?: unknown
}) {
  return prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      before: params.before === undefined ? undefined : JSON.parse(JSON.stringify(params.before)),
      after: params.after === undefined ? undefined : JSON.parse(JSON.stringify(params.after)),
    },
  })
}
