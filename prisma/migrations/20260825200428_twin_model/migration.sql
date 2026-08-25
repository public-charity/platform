-- Extensions this migration depends on, declared rather than assumed.
-- The geometry column below and the trigram index further down both fail
-- outright without these, and a fresh clone or CI database has neither.
-- No-ops where they are already installed (e.g. Fly Managed Postgres).
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "TwinKind" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isPrivateDefault" BOOLEAN NOT NULL DEFAULT false,
    "allowedGeometry" TEXT[],
    "hasLifecycle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwinKind_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Twin" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT NOT NULL,
    "slug" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "validFrom" TIMESTAMPTZ(3),
    "validTo" TIMESTAMPTZ(3),
    "geom" geometry(Geometry,4326),
    "homeCellR7" BIGINT,
    "userId" TEXT,
    "organisationId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Twin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "trustTier" INTEGER NOT NULL DEFAULT 1,
    "licence" TEXT,
    "url" TEXT,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeDef" (
    "key" TEXT NOT NULL,
    "kindKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cardinality" TEXT NOT NULL DEFAULT 'MANY',
    "sensitivity" INTEGER NOT NULL DEFAULT 0,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'SELF',
    "jsonSchema" JSONB,
    "deprecatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AttributeDef_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TwinFact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "twinId" UUID NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNum" DECIMAL(20,6),
    "valueBool" BOOLEAN,
    "valueTs" TIMESTAMPTZ(3),
    "valueJson" JSONB,
    "unit" TEXT,
    "sourceId" UUID NOT NULL,
    "sourceRef" TEXT,
    "assertedByTwin" UUID,
    "assertedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DECIMAL(4,3) NOT NULL DEFAULT 1.0,
    "visibility" TEXT NOT NULL DEFAULT 'SELF',
    "sensitivity" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMPTZ(3),
    "supersedesId" UUID,
    "disputedAt" TIMESTAMPTZ(3),
    "redactedAt" TIMESTAMPTZ(3),

    CONSTRAINT "TwinFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Twin_userId_key" ON "Twin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Twin_organisationId_key" ON "Twin"("organisationId");

-- CreateIndex
CREATE INDEX "Twin_kind_status_idx" ON "Twin"("kind", "status");

-- CreateIndex
CREATE INDEX "Twin_homeCellR7_idx" ON "Twin"("homeCellR7");

-- CreateIndex
CREATE UNIQUE INDEX "Twin_kind_slug_key" ON "Twin"("kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "AttributeDef_category_idx" ON "AttributeDef"("category");

-- CreateIndex
CREATE INDEX "TwinFact_twinId_attributeKey_idx" ON "TwinFact"("twinId", "attributeKey");

-- CreateIndex
CREATE INDEX "TwinFact_attributeKey_idx" ON "TwinFact"("attributeKey");

-- AddForeignKey
ALTER TABLE "Twin" ADD CONSTRAINT "Twin_kind_fkey" FOREIGN KEY ("kind") REFERENCES "TwinKind"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Twin" ADD CONSTRAINT "Twin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Twin" ADD CONSTRAINT "Twin_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeDef" ADD CONSTRAINT "AttributeDef_kindKey_fkey" FOREIGN KEY ("kindKey") REFERENCES "TwinKind"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwinFact" ADD CONSTRAINT "TwinFact_twinId_fkey" FOREIGN KEY ("twinId") REFERENCES "Twin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwinFact" ADD CONSTRAINT "TwinFact_attributeKey_fkey" FOREIGN KEY ("attributeKey") REFERENCES "AttributeDef"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwinFact" ADD CONSTRAINT "TwinFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Everything below is hand-written: constraints, geometry, RLS, and the
-- registry seed. Prisma cannot express any of it, so `prisma db push` would
-- silently drop it — use migrations only.
-- ============================================================================

-- Exactly one value column per fact. A fact with two values, or none, is not a
-- fact. Redacted rows are the one exception: their values are nulled out but
-- the row survives so the history stays honest.
ALTER TABLE "TwinFact"
  ADD CONSTRAINT fact_exactly_one_value CHECK (
    num_nonnulls("valueText","valueNum","valueBool","valueTs","valueJson") = 1
    OR "redactedAt" IS NOT NULL),
  ADD CONSTRAINT fact_confidence_range CHECK (confidence BETWEEN 0 AND 1),
  ADD CONSTRAINT fact_visibility CHECK (visibility IN ('PUBLIC','MEMBER','CONSENTED','SELF')),
  ADD CONSTRAINT fact_interval CHECK ("validTo" IS NULL OR "validTo" > "validFrom");

ALTER TABLE "Twin"
  ADD CONSTRAINT twin_visibility CHECK (visibility IN ('PUBLIC','MEMBER','SELF')),
  ADD CONSTRAINT twin_status CHECK (status IN ('ACTIVE','MERGED','RETIRED')),
  ADD CONSTRAINT twin_interval CHECK ("validTo" IS NULL OR "validTo" > "validFrom");

ALTER TABLE "AttributeDef"
  ADD CONSTRAINT attr_value_type CHECK ("valueType" IN ('TEXT','NUM','BOOL','TS','JSON')),
  ADD CONSTRAINT attr_cardinality CHECK (cardinality IN ('ONE','MANY')),
  ADD CONSTRAINT attr_sensitivity CHECK (sensitivity BETWEEN 0 AND 3);

-- A fact's value column must match the type its attribute declares. Without
-- this the vocabulary is advisory and drifts within weeks.
CREATE OR REPLACE FUNCTION app.fact_type_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE want text;
BEGIN
  IF NEW."redactedAt" IS NOT NULL THEN RETURN NEW; END IF;
  SELECT "valueType" INTO want FROM "AttributeDef" WHERE key = NEW."attributeKey";
  IF (want = 'TEXT' AND NEW."valueText" IS NULL)
  OR (want = 'NUM'  AND NEW."valueNum"  IS NULL)
  OR (want = 'BOOL' AND NEW."valueBool" IS NULL)
  OR (want = 'TS'   AND NEW."valueTs"   IS NULL)
  OR (want = 'JSON' AND NEW."valueJson" IS NULL) THEN
    RAISE EXCEPTION 'attribute % expects a % value', NEW."attributeKey", want;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER fact_type_check BEFORE INSERT OR UPDATE ON "TwinFact"
  FOR EACH ROW EXECUTE FUNCTION app.fact_type_check();

-- Geometry is declared generically so a new kind never needs a schema change;
-- which shapes a kind may hold is data, checked here.
CREATE OR REPLACE FUNCTION app.twin_geometry_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE allowed text[];
BEGIN
  IF NEW.geom IS NULL THEN RETURN NEW; END IF;
  SELECT "allowedGeometry" INTO allowed FROM "TwinKind" WHERE key = NEW.kind;
  -- ST_GeometryType returns 'ST_Point'; GeometryType returns 'POINT'. The
  -- registry stores the former, so compare against the same function or every
  -- kind silently rejects every shape.
  IF allowed IS NULL OR NOT (ST_GeometryType(NEW.geom) = ANY (allowed)) THEN
    RAISE EXCEPTION 'twin kind % does not allow geometry %', NEW.kind, ST_GeometryType(NEW.geom);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER twin_geometry_check BEFORE INSERT OR UPDATE ON "Twin"
  FOR EACH ROW EXECUTE FUNCTION app.twin_geometry_check();

-- Spatial and lookup indexes. The geography cast is IMMUTABLE so it can be
-- indexed; ST_Transform is not, which is why tiles transform the envelope
-- rather than the rows.
CREATE INDEX twin_geom_gix ON "Twin" USING gist (geom);
CREATE INDEX twin_geog_gix ON "Twin" USING gist ((geom::geography));
CREATE INDEX twin_public_name_trgm ON "Twin" USING gin ("displayName" gin_trgm_ops)
  WHERE visibility = 'PUBLIC';
CREATE INDEX fact_current ON "TwinFact" ("twinId","attributeKey")
  WHERE "validTo" IS NULL AND "redactedAt" IS NULL;

-- ---------------------------------------------------------------- helpers
-- Is this twin the acting user's own person twin?
CREATE OR REPLACE FUNCTION app.owns_twin(p_twin uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT EXISTS (
     SELECT 1 FROM "Twin" t
      WHERE t.id = p_twin AND t."userId" = app.user_id()) $$;

-- Is the acting user a member of the organisation this twin represents?
--
-- Used only by TwinFact policies. It reads Twin, so Twin's own policies must
-- never call back into Twin — see the note on twin_member_read below.
CREATE OR REPLACE FUNCTION app.member_of_twin(p_twin uuid) RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE AS
$$ SELECT EXISTS (
     SELECT 1 FROM "Twin" t
      WHERE t.id = p_twin
        AND t."organisationId" IS NOT NULL
        AND app.is_member(t."organisationId")) $$;

-- ---------------------------------------------------------------- registry
-- The vocabulary. Every one of these is a row, so extending the platform to a
-- new kind of thing never touches a table definition.

INSERT INTO "TwinKind"(key,label,"isPrivateDefault","allowedGeometry","hasLifecycle") VALUES
  ('PERSON','Person',       true,  '{}',         false),
  ('PLACE', 'Place',        false, '{ST_Point}', false),
  ('EVENT', 'Event',        false, '{ST_Point}', true),
  ('ORG',   'Organisation', false, '{ST_Point}', false),
  ('AGENT', 'Agent',        false, '{}',         false);

INSERT INTO "Source"(key,kind,label,"trustTier") VALUES
  ('self',          'SELF',     'Told to us by the subject',                        2),
  ('ccew_register', 'REGULATOR','Charity Commission for England and Wales register', 3),
  ('platform',      'ORG',      'Derived by the platform',                           1);

-- Note the PERSON attributes: interests and intent are things people state,
-- with a CONSENTED default so they are unreadable until released to a purpose.
-- There is no attribute for anything the platform would have to infer.
INSERT INTO "AttributeDef"(key,"kindKey",label,"valueType",category,cardinality,sensitivity,"defaultVisibility") VALUES
  ('org.description',                'ORG',   'Description',               'TEXT','profile',     'ONE', 0,'PUBLIC'),
  ('org.website',                    'ORG',   'Website',                   'TEXT','profile',     'ONE', 0,'PUBLIC'),
  ('org.donate_url',                 'ORG',   'Donation link',             'TEXT','profile',     'ONE', 0,'PUBLIC'),
  ('org.cause_tag',                  'ORG',   'Cause',                     'TEXT','profile',     'MANY',0,'PUBLIC'),
  ('org.charity_number',             'ORG',   'Registered charity number', 'TEXT','registration','ONE', 0,'PUBLIC'),
  ('org.region',                     'ORG',   'Region',                    'TEXT','location',    'ONE', 0,'PUBLIC'),
  ('person.display_name',            'PERSON','Name',                      'TEXT','profile',     'ONE', 0,'SELF'),
  ('person.interest',                'PERSON','Interest',                  'TEXT','interests',   'MANY',0,'CONSENTED'),
  ('person.looking_for',             'PERSON','Looking for',               'TEXT','intent',      'MANY',1,'CONSENTED'),
  ('person.home_cell_r7',            'PERSON','Approximate area',          'TEXT','location',    'ONE', 1,'CONSENTED'),
  ('place.waste.collection_day',     'PLACE', 'Bin collection day',        'TEXT','utilities',   'ONE', 0,'MEMBER'),
  ('place.broadband.max_speed_mbps', 'PLACE', 'Fastest broadband',         'NUM', 'utilities',   'ONE', 0,'MEMBER'),
  ('place.school.catchment',         'PLACE', 'School catchment',          'TEXT','services',    'MANY',0,'MEMBER'),
  ('event.starts_at',                'EVENT', 'Starts',                    'TS',  'schedule',    'ONE', 0,'PUBLIC'),
  ('event.capacity',                 'EVENT', 'Capacity',                  'NUM', 'schedule',    'ONE', 0,'PUBLIC');

-- ---------------------------------------------------------------- backfill
-- Existing charities and users become twins. The 1:1 bridge columns mean the
-- old tables keep working untouched while the twin graph grows alongside them.

-- updatedAt is Prisma's @updatedAt: maintained by the client, with no database
-- default, so raw SQL must set it explicitly.
INSERT INTO "Twin"(kind,"displayName",slug,visibility,"organisationId","updatedAt")
SELECT 'ORG', o.name, o.slug,
       CASE WHEN o.status = 'PUBLISHED' THEN 'PUBLIC' ELSE 'MEMBER' END,
       o.id, now()
FROM "Organisation" o;

-- People are private by default and by construction — never PUBLIC here.
INSERT INTO "Twin"(kind,"displayName",visibility,"userId","updatedAt")
SELECT 'PERSON', coalesce(u.name, split_part(u.email,'@',1)), 'SELF', u.id, now()
FROM "User" u;

-- Organisation profile columns become facts, with provenance. The columns stay
-- where they are for now; this is the twin graph learning what already exists.
INSERT INTO "TwinFact"("twinId","attributeKey","valueText","sourceId",visibility)
SELECT t.id, v.key, v.val, (SELECT id FROM "Source" WHERE key = 'self'), 'PUBLIC'
FROM "Organisation" o
JOIN "Twin" t ON t."organisationId" = o.id
CROSS JOIN LATERAL (VALUES
  ('org.description', nullif(o."descriptionMd", '')),
  ('org.website',     o.website),
  ('org.donate_url',  o."donateUrl"),
  ('org.region',      o.region)
) AS v(key, val)
WHERE v.val IS NOT NULL;

INSERT INTO "TwinFact"("twinId","attributeKey","valueText","sourceId",visibility)
SELECT t.id, 'org.charity_number', o."charityNumber",
       (SELECT id FROM "Source" WHERE key = 'ccew_register'), 'PUBLIC'
FROM "Organisation" o
JOIN "Twin" t ON t."organisationId" = o.id
WHERE o."charityNumber" IS NOT NULL AND o."registerSource" = 'CCEW';

INSERT INTO "TwinFact"("twinId","attributeKey","valueText","sourceId",visibility)
SELECT t.id, 'org.cause_tag', tag, (SELECT id FROM "Source" WHERE key = 'self'), 'PUBLIC'
FROM "Organisation" o
JOIN "Twin" t ON t."organisationId" = o.id
CROSS JOIN LATERAL unnest(o."causeTags") AS tag;

-- ---------------------------------------------------------------- RLS
ALTER TABLE "Twin"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Twin"     FORCE  ROW LEVEL SECURITY;
ALTER TABLE "TwinFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TwinFact" FORCE  ROW LEVEL SECURITY;

CREATE POLICY twin_public_read ON "Twin" FOR SELECT
  USING (visibility = 'PUBLIC' AND status = 'ACTIVE');

CREATE POLICY twin_self_read ON "Twin" FOR SELECT
  USING ("userId" IS NOT NULL AND "userId" = app.user_id());

-- Deliberately tests the row's own column rather than calling
-- app.member_of_twin(id). That function reads Twin, so using it here would make
-- reading a twin evaluate a policy that reads a twin — unbounded recursion,
-- which Postgres stops at the stack limit. Policies on Twin must only ever
-- consult Twin's own columns plus tables that carry no policies of their own.
CREATE POLICY twin_member_read ON "Twin" FOR SELECT
  USING ("organisationId" IS NOT NULL AND app.is_member("organisationId"));

-- Without an INSERT policy nothing can create a twin at all. Three legitimate
-- routes: your own person twin, a twin for an organisation you administer, and
-- a standalone place or event created by any signed-in person. Who may then
-- edit a standalone twin is a stewardship question, handled separately.
CREATE POLICY twin_insert ON "Twin" FOR INSERT
  WITH CHECK (
    ("userId" IS NOT NULL AND "userId" = app.user_id())
    OR ("organisationId" IS NOT NULL AND app.is_member_with_role("organisationId",'OWNER','ADMIN'))
    OR (app.user_id() IS NOT NULL AND "userId" IS NULL AND "organisationId" IS NULL)
  );

-- Same rule as above: own columns only, no self-referential lookups.
CREATE POLICY twin_member_update ON "Twin" FOR UPDATE
  USING      (("userId" IS NOT NULL AND "userId" = app.user_id())
              OR ("organisationId" IS NOT NULL AND app.is_member("organisationId")))
  WITH CHECK (("userId" IS NOT NULL AND "userId" = app.user_id())
              OR ("organisationId" IS NOT NULL AND app.is_member("organisationId")));

-- Facts are append-only: there is no UPDATE or DELETE policy, so a correction
-- must be a new row that supersedes the old one.
CREATE POLICY fact_public_read ON "TwinFact" FOR SELECT
  USING (visibility = 'PUBLIC' AND "redactedAt" IS NULL);

CREATE POLICY fact_self_read ON "TwinFact" FOR SELECT
  USING (app.owns_twin("twinId"));

CREATE POLICY fact_member_read ON "TwinFact" FOR SELECT
  USING (visibility IN ('PUBLIC','MEMBER') AND "redactedAt" IS NULL
         AND app.member_of_twin("twinId"));

-- CONSENTED facts are deliberately unreachable until ConsentGrant exists.
-- No policy matches them, so they are invisible to everyone rather than
-- accidentally readable in the meantime.

CREATE POLICY fact_insert ON "TwinFact" FOR INSERT
  WITH CHECK (app.owns_twin("twinId") OR app.member_of_twin("twinId"));
