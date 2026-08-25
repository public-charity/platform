-- Row-level security for the existing tenant tables.
--
-- Why: TenantContext (src/lib/tenant.ts) was enforced only by a comment, and
-- every write path already ignored it. This makes the tenant boundary a
-- database guarantee instead of a convention.
--
-- FORCE, not just ENABLE: plain ENABLE exempts the table owner, and the
-- application currently connects as the owning role. FORCE is what makes the
-- policies apply to it. Verified: with FORCE and no actor context, the owning
-- role reads 0 rows.

CREATE SCHEMA IF NOT EXISTS app;

-- Current actor, or NULL when anonymous.
-- current_setting(..., true) returns NULL rather than raising when unset,
-- which is what lets anonymous reads return zero rows instead of erroring.
CREATE OR REPLACE FUNCTION app.user_id() RETURNS text
  LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT nullif(current_setting('app.user_id', true), '') $$;

-- The application does not name its own actor. It presents a session token
-- hash and receives a context, so a handler cannot simply assert an identity.
CREATE OR REPLACE FUNCTION app.assume(p_token_hash text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app AS $$
DECLARE v_user text;
BEGIN
  SELECT s."userId" INTO v_user
    FROM "Session" s
   WHERE s."tokenHash" = p_token_hash
     AND s."expiresAt" > now();

  -- set_config(..., true) = SET LOCAL: transaction-scoped, so it cannot leak
  -- onto a pooled connection and reach the next request. Verified against the
  -- pgbouncer endpoint in transaction pooling mode.
  PERFORM set_config('app.user_id', coalesce(v_user, ''), true);
  RETURN v_user;
END $$;

-- Membership deliberately has no RLS in this migration: it is the table the
-- policies below join against, and adding policies here creates mutual
-- recursion. It carries no tenant content of its own.
CREATE OR REPLACE FUNCTION app.is_member(p_org text) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT EXISTS (
     SELECT 1 FROM "Membership" m
      WHERE m."organisationId" = p_org
        AND m."userId" = app.user_id()) $$;

CREATE OR REPLACE FUNCTION app.is_member_with_role(p_org text, VARIADIC p_roles "Role"[]) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT EXISTS (
     SELECT 1 FROM "Membership" m
      WHERE m."organisationId" = p_org
        AND m."userId" = app.user_id()
        AND m.role = ANY(p_roles)) $$;

-- ---------------------------------------------------------------- Organisation
ALTER TABLE "Organisation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organisation" FORCE  ROW LEVEL SECURITY;

-- Multiple PERMISSIVE SELECT policies OR together: public ∪ member.
CREATE POLICY org_public_read ON "Organisation" FOR SELECT
  USING (status = 'PUBLISHED');

CREATE POLICY org_member_read ON "Organisation" FOR SELECT
  USING (app.is_member(id));

CREATE POLICY org_member_update ON "Organisation" FOR UPDATE
  USING      (app.is_member_with_role(id, 'OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (app.is_member_with_role(id, 'OWNER', 'ADMIN', 'EDITOR'));

-- Signup creates an organisation before any membership exists, and runs
-- unauthenticated. Insert stays open; publication is gated by status.
CREATE POLICY org_insert ON "Organisation" FOR INSERT
  WITH CHECK (status = 'PENDING');

-- ---------------------------------------------------------- OrganisationModule
ALTER TABLE "OrganisationModule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganisationModule" FORCE  ROW LEVEL SECURITY;

CREATE POLICY orgmod_member_read ON "OrganisationModule" FOR SELECT
  USING (app.is_member("organisationId"));

CREATE POLICY orgmod_admin_insert ON "OrganisationModule" FOR INSERT
  WITH CHECK (app.is_member_with_role("organisationId", 'OWNER', 'ADMIN'));

CREATE POLICY orgmod_admin_update ON "OrganisationModule" FOR UPDATE
  USING      (app.is_member_with_role("organisationId", 'OWNER', 'ADMIN'))
  WITH CHECK (app.is_member_with_role("organisationId", 'OWNER', 'ADMIN'));

-- ------------------------------------------------------------------------ App
ALTER TABLE "App" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "App" FORCE  ROW LEVEL SECURITY;

-- The nested Organisation read is itself policy-checked, and org_public_read
-- permits exactly the published rows, so this composes without a definer.
CREATE POLICY app_public_read ON "App" FOR SELECT
  USING (status = 'PUBLISHED'
         AND EXISTS (SELECT 1 FROM "Organisation" o
                      WHERE o.id = "App"."organisationId"
                        AND o.status = 'PUBLISHED'));

CREATE POLICY app_member_read ON "App" FOR SELECT
  USING (app.is_member("organisationId"));

CREATE POLICY app_member_insert ON "App" FOR INSERT
  WITH CHECK (app.is_member_with_role("organisationId", 'OWNER', 'ADMIN', 'EDITOR')
              AND status = 'PENDING');

CREATE POLICY app_member_update ON "App" FOR UPDATE
  USING      (app.is_member_with_role("organisationId", 'OWNER', 'ADMIN', 'EDITOR'))
  WITH CHECK (app.is_member_with_role("organisationId", 'OWNER', 'ADMIN', 'EDITOR'));

-- Signup creates the organisation, its owner membership and the always-on
-- `directory` module in one unauthenticated transaction, before any actor
-- context can exist. This permits that single bootstrap insert and nothing else.
--
-- Deliberately not conditioned on reading Organisation: nested creates give no
-- ordering guarantee, so the parent row may not be policy-visible yet. The
-- exposure is negligible — `directory` is the always-on module and
-- TenantContext.moduleEnabled() returns true for it without consulting the row
-- at all, so the row carries no authority.
CREATE POLICY orgmod_bootstrap_insert ON "OrganisationModule" FOR INSERT
  WITH CHECK ("moduleKey" = 'directory');
