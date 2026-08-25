-- The twin backfill silently missed rows.
--
-- It ran `INSERT INTO "Twin" ... SELECT ... FROM "Organisation"`, and that
-- SELECT is subject to row-level security like any other. With no actor
-- context only PUBLISHED organisations were visible, so every PENDING one was
-- skipped — and the migration reported success, because RLS narrows results
-- rather than raising.
--
-- The lesson generalises: any migration that reads a table carrying policies
-- must lift FORCE for the duration, or it is quietly working on a subset.
-- ENABLE stays on throughout; only the owner exemption is restored, and only
-- inside this transaction.

ALTER TABLE "Organisation" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "Twin"         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "TwinFact"     NO FORCE ROW LEVEL SECURITY;

-- Idempotent: only organisations that do not already have a twin.
INSERT INTO "Twin"(kind,"displayName",slug,visibility,"organisationId","updatedAt")
SELECT 'ORG', o.name, o.slug,
       CASE WHEN o.status = 'PUBLISHED' THEN 'PUBLIC' ELSE 'MEMBER' END,
       o.id, now()
FROM "Organisation" o
WHERE NOT EXISTS (SELECT 1 FROM "Twin" t WHERE t."organisationId" = o.id);

INSERT INTO "Twin"(kind,"displayName",visibility,"userId","updatedAt")
SELECT 'PERSON', coalesce(u.name, split_part(u.email,'@',1)), 'SELF', u.id, now()
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Twin" t WHERE t."userId" = u.id);

-- Facts for any twin that has none yet, from the same organisation columns.
INSERT INTO "TwinFact"("twinId","attributeKey","valueText","sourceId",visibility)
SELECT t.id, v.key, v.val, (SELECT id FROM "Source" WHERE key = 'self'),
       CASE WHEN o.status = 'PUBLISHED' THEN 'PUBLIC' ELSE 'MEMBER' END
FROM "Organisation" o
JOIN "Twin" t ON t."organisationId" = o.id
CROSS JOIN LATERAL (VALUES
  ('org.description', nullif(o."descriptionMd", '')),
  ('org.website',     o.website),
  ('org.donate_url',  o."donateUrl"),
  ('org.region',      o.region)
) AS v(key, val)
WHERE v.val IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "TwinFact" f
                   WHERE f."twinId" = t.id AND f."attributeKey" = v.key);

INSERT INTO "TwinFact"("twinId","attributeKey","valueText","sourceId",visibility)
SELECT t.id, 'org.charity_number', o."charityNumber",
       (SELECT id FROM "Source" WHERE key = 'ccew_register'),
       CASE WHEN o.status = 'PUBLISHED' THEN 'PUBLIC' ELSE 'MEMBER' END
FROM "Organisation" o
JOIN "Twin" t ON t."organisationId" = o.id
WHERE o."charityNumber" IS NOT NULL AND o."registerSource" = 'CCEW'
  AND NOT EXISTS (SELECT 1 FROM "TwinFact" f
                   WHERE f."twinId" = t.id AND f."attributeKey" = 'org.charity_number');

INSERT INTO "TwinFact"("twinId","attributeKey","valueText","sourceId",visibility)
SELECT t.id, 'org.cause_tag', tag, (SELECT id FROM "Source" WHERE key = 'self'),
       CASE WHEN o.status = 'PUBLISHED' THEN 'PUBLIC' ELSE 'MEMBER' END
FROM "Organisation" o
JOIN "Twin" t ON t."organisationId" = o.id
CROSS JOIN LATERAL unnest(o."causeTags") AS tag
WHERE NOT EXISTS (SELECT 1 FROM "TwinFact" f
                   WHERE f."twinId" = t.id AND f."attributeKey" = 'org.cause_tag'
                     AND f."valueText" = tag);

ALTER TABLE "Organisation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Twin"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "TwinFact"     FORCE ROW LEVEL SECURITY;
