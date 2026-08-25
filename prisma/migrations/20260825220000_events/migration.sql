-- Events: the first product surface built purely on the twin registry.
--
-- Deliberately contains no table changes. An event is a Twin of kind EVENT —
-- its time is the twin's validity interval, its place is the twin's geometry,
-- its organiser is a Stewardship row, and everything else is facts. A new
-- broadcastable type ("sales event", "road closure", "surgery hours") is a
-- category value, not a migration.

INSERT INTO "AttributeDef"(key,"kindKey",label,"valueType",category,cardinality,sensitivity,"defaultVisibility") VALUES
  ('event.category','EVENT','Category',            'TEXT','schedule',   'ONE',0,'PUBLIC'),
  ('event.details', 'EVENT','Details',             'TEXT','profile',    'ONE',0,'PUBLIC'),
  ('event.link',    'EVENT','More info / booking', 'TEXT','profile',    'ONE',0,'PUBLIC'),
  ('event.address', 'EVENT','Address',             'TEXT','location',   'ONE',0,'PUBLIC')
ON CONFLICT (key) DO NOTHING;

-- The timeline's index: upcoming public events by start time.
CREATE INDEX IF NOT EXISTS event_upcoming ON "Twin" ("validFrom")
  WHERE kind = 'EVENT' AND visibility = 'PUBLIC' AND status = 'ACTIVE';

-- Public events have public organisers — accountability is the point.
-- Anyone may see who stewards a PUBLIC twin. Safe against recursion: this
-- policy reads Twin, and Twin's policies never read Stewardship (the
-- dependency runs one way — see the stewardship migration).
CREATE POLICY stewardship_public_twin_read ON "Stewardship" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Twin" t
                  WHERE t.id = "Stewardship"."twinId"
                    AND t.visibility = 'PUBLIC'));
