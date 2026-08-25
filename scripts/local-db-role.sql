-- Local development parity with Fly Managed Postgres.
--
-- On MPG the application connects as `app-runtime`, a writer that owns nothing
-- and cannot bypass row-level security. Locally the default superuser owns
-- every table and bypasses every policy, so without this the entire access
-- model silently does nothing in development and only bites in production.
--
-- Run once per database:  psql -d publiccharity_dev -f scripts/local-db-role.sql

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'devpassword' NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app TO app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_user;

-- The part that stops this drifting: tables and functions created by later
-- migrations are granted automatically, instead of every new migration
-- breaking local development with "permission denied".
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app    GRANT EXECUTE ON FUNCTIONS TO app_user;
