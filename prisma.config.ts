import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Migrations and runtime use different roles.
 *
 * The application connects as `app-runtime`, a writer that owns nothing and
 * cannot bypass row-level security — so it cannot drop a table, disable RLS or
 * remove a policy even if the process is compromised.
 *
 * Migrations need to create and alter tables, so they run as the schema owner
 * via MIGRATE_DATABASE_URL. Falls back to DATABASE_URL for local development,
 * where one role does both.
 */
const MIGRATION_URL_VAR = process.env.MIGRATE_DATABASE_URL ? 'MIGRATE_DATABASE_URL' : 'DATABASE_URL'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env(MIGRATION_URL_VAR),
  },
})
