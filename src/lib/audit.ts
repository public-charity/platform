import { prisma, type Tx } from './db'

/**
 * Append-only audit trail. Corrections are new records, never edits.
 *
 * Pass the transaction the change is happening in. Writing through the global
 * client instead would put the audit record in its own transaction, so it could
 * commit while the change it describes rolled back — or vanish while the change
 * survived. An audit trail that disagrees with the data is worse than none.
 */
export function audit(
  db: Tx | typeof prisma,
  params: {
    actorId?: string | null
    action: string
    entity: string
    before?: unknown
    after?: unknown
  },
) {
  return db.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      before: params.before === undefined ? undefined : JSON.parse(JSON.stringify(params.before)),
      after: params.after === undefined ? undefined : JSON.parse(JSON.stringify(params.after)),
    },
  })
}
