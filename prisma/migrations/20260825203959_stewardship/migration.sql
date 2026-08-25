-- DropIndex
-- REMOVED: Prisma generated `DROP INDEX "twin_geom_gix";` here.
--
-- Twin.geom is an Unsupported() type, so Prisma cannot represent a GiST index
-- on it. When it diffs the schema it sees an index it does not recognise and
-- emits a DROP — and it does this for `migrate dev`, not only `db push`. The
-- first run of this migration silently destroyed the spatial index.
--
-- Every generated migration from here must be read for DROP statements against
-- hand-written objects before it is applied. See scripts/check-migration-drift.sh.

-- CreateTable
CREATE TABLE "Stewardship" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "twinId" UUID NOT NULL,
    "stewardTwinId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "fromAt" TIMESTAMPTZ(3) NOT NULL,
    "toAt" TIMESTAMPTZ(3),
    "grantedByTwinId" UUID,
    "evidenceSourceId" UUID,
    "evidenceRef" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stewardship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stewardship_stewardTwinId_idx" ON "Stewardship"("stewardTwinId");

-- CreateIndex
CREATE INDEX "Stewardship_twinId_idx" ON "Stewardship"("twinId");

-- AddForeignKey
ALTER TABLE "Stewardship" ADD CONSTRAINT "Stewardship_twinId_fkey" FOREIGN KEY ("twinId") REFERENCES "Twin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stewardship" ADD CONSTRAINT "Stewardship_stewardTwinId_fkey" FOREIGN KEY ("stewardTwinId") REFERENCES "Twin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stewardship" ADD CONSTRAINT "Stewardship_grantedByTwinId_fkey" FOREIGN KEY ("grantedByTwinId") REFERENCES "Twin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stewardship" ADD CONSTRAINT "Stewardship_evidenceSourceId_fkey" FOREIGN KEY ("evidenceSourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Stewardship: time-bounded, transferable control.
-- ============================================================================

-- The range exists for the index and the exclusion constraint. Application
-- logic uses fromAt/toAt; the overlap rule lives in exactly one function
-- (app.steward_may_read) so the range operators stay in one place.
ALTER TABLE "Stewardship"
  ADD COLUMN during tstzrange
    GENERATED ALWAYS AS (tstzrange("fromAt","toAt",'[)')) STORED,
  ADD CONSTRAINT stewardship_role
    CHECK (role IN ('OWNER','OCCUPIER','MANAGER','CUSTODIAN')),
  ADD CONSTRAINT stewardship_interval
    CHECK ("toAt" IS NULL OR "toAt" > "fromAt");

-- Two people cannot own the same thing at the same time. btree_gist is what
-- allows a plain equality (twinId) and a range overlap to share one exclusion
-- constraint. This makes an out-of-order or double transfer a hard error at
-- write time rather than a data problem discovered months later.
ALTER TABLE "Stewardship"
  ADD CONSTRAINT stewardship_owner_no_overlap
  EXCLUDE USING gist ("twinId" WITH =, during WITH &&) WHERE (role = 'OWNER');

CREATE INDEX stewardship_lookup ON "Stewardship" USING gist ("twinId", during);
CREATE INDEX stewardship_current ON "Stewardship" ("twinId","stewardTwinId")
  WHERE "toAt" IS NULL;

-- ---------------------------------------------------------------- helpers

-- Every twin the caller acts as: their own person twin, plus the twin of any
-- organisation they belong to. Reads Twin only — never Stewardship. See the
-- recursion note below.
CREATE OR REPLACE FUNCTION app.acting_twins() RETURNS uuid[]
  LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT coalesce(array_agg(t.id), '{}'::uuid[])
     FROM "Twin" t
    WHERE (t."userId" IS NOT NULL AND t."userId" = app.user_id())
       OR (t."organisationId" IS NOT NULL AND app.is_member(t."organisationId")) $$;

-- The read rule, and the heart of the design.
--
-- A steward may read a fact when their tenure OVERLAPS the fact's validity —
-- not merely when the fact is current. So a seller keeps what was true while
-- they were responsible, and never sees what became true after they left.
CREATE OR REPLACE FUNCTION app.steward_may_read(
  p_twin uuid, p_from timestamptz, p_to timestamptz
) RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT EXISTS (
     SELECT 1 FROM "Stewardship" s
      WHERE s."twinId" = p_twin
        AND s."stewardTwinId" = ANY (app.acting_twins())
        AND s.during && tstzrange(p_from, p_to, '[)')) $$;

-- Writing is narrower than reading: only whoever holds it right now.
CREATE OR REPLACE FUNCTION app.is_current_steward(p_twin uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT EXISTS (
     SELECT 1 FROM "Stewardship" s
      WHERE s."twinId" = p_twin
        AND s."stewardTwinId" = ANY (app.acting_twins())
        AND s.during @> now()) $$;

-- Handover needs its own test, and this is why.
--
-- Two owners cannot overlap, so a transfer must close the outgoing tenure
-- before opening the incoming one. But closing it means the seller is no
-- longer the current steward — and so, under is_current_steward alone, is no
-- longer allowed to name their successor. The transfer deadlocks.
--
-- So authority to hand over is judged at the moment the new tenure begins:
-- either the caller still holds the twin then, or their own tenure ended
-- exactly there, which is precisely what a clean handover looks like.
CREATE OR REPLACE FUNCTION app.was_steward_at(p_twin uuid, p_at timestamptz) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT EXISTS (
     SELECT 1 FROM "Stewardship" s
      WHERE s."twinId" = p_twin
        AND s."stewardTwinId" = ANY (app.acting_twins())
        AND (s.during @> p_at OR upper(s.during) = p_at)) $$;

-- ---------------------------------------------------------------- RLS
--
-- RECURSION INVARIANT, and the reason there is no steward SELECT policy on
-- Twin: Stewardship's own policies read Twin (via acting_twins). If a Twin
-- SELECT policy read Stewardship, reading a twin would evaluate a policy that
-- reads a stewardship that reads a twin — unbounded. The dependency runs one
-- way only: Stewardship -> Twin, never back.
--
-- The consequence is deliberate rather than a compromise. A place twin is
-- public — a house at an address is not a secret. What is private is the facts
-- about it, and those are gated by fact_steward_read below, which touches
-- Stewardship without going through Twin's SELECT policies.

ALTER TABLE "Stewardship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stewardship" FORCE  ROW LEVEL SECURITY;

CREATE POLICY stewardship_own_read ON "Stewardship" FOR SELECT
  USING ("stewardTwinId" = ANY (app.acting_twins()));

-- Claiming stewardship for yourself, or handing it to someone else while you
-- still hold it.
CREATE POLICY stewardship_insert ON "Stewardship" FOR INSERT
  WITH CHECK ("stewardTwinId" = ANY (app.acting_twins())
              OR app.was_steward_at("twinId", "fromAt"));

-- Closing your own tenure. There is no DELETE policy: a transfer closes a row
-- and opens another, so the history of who was responsible when is preserved.
CREATE POLICY stewardship_close ON "Stewardship" FOR UPDATE
  USING      ("stewardTwinId" = ANY (app.acting_twins()))
  WITH CHECK ("stewardTwinId" = ANY (app.acting_twins()));

-- Facts a steward may read, clipped to their tenure.
CREATE POLICY fact_steward_read ON "TwinFact" FOR SELECT
  USING (visibility IN ('PUBLIC','MEMBER')
         AND "redactedAt" IS NULL
         AND app.steward_may_read("twinId","validFrom","validTo"));

-- The current steward may also record new facts and maintain the twin itself.
DROP POLICY IF EXISTS fact_insert ON "TwinFact"; -- intentional: replaced below to admit stewards
CREATE POLICY fact_insert ON "TwinFact" FOR INSERT
  WITH CHECK (app.owns_twin("twinId")
              OR app.member_of_twin("twinId")
              OR app.is_current_steward("twinId"));

CREATE POLICY twin_steward_update ON "Twin" FOR UPDATE
  USING      (app.is_current_steward(id))
  WITH CHECK (app.is_current_steward(id));

-- Re-assert the hand-written objects Prisma does not know about, so that a
-- generated DROP slipping through is repaired rather than left silently
-- missing. Idempotent by design.
CREATE INDEX IF NOT EXISTS twin_geom_gix ON "Twin" USING gist (geom);
CREATE INDEX IF NOT EXISTS twin_geog_gix ON "Twin" USING gist ((geom::geography));
CREATE INDEX IF NOT EXISTS twin_public_name_trgm ON "Twin" USING gin ("displayName" gin_trgm_ops)
  WHERE visibility = 'PUBLIC';
CREATE INDEX IF NOT EXISTS fact_current ON "TwinFact" ("twinId","attributeKey")
  WHERE "validTo" IS NULL AND "redactedAt" IS NULL;
