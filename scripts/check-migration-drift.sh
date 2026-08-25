#!/bin/sh
# Prisma cannot represent the hand-written half of this schema — GiST indexes on
# Unsupported() geometry columns, RLS policies, triggers, exclusion constraints.
# When it diffs, it sees objects it does not recognise and generates DROPs for
# them. It does this for `migrate dev`, not only `db push`.
#
# Run this over any newly generated migration before applying it.
set -e
TARGET="${1:-prisma/migrations}"
HITS=$(grep -rnE 'DROP (INDEX|POLICY|TRIGGER|FUNCTION|CONSTRAINT)' "$TARGET" \
        | grep -v '^\s*--' \
        | grep -vE 'REMOVED:|IF EXISTS' || true)
if [ -n "$HITS" ]; then
  echo "Migration drops hand-written objects — review before applying:"
  echo "$HITS"
  exit 1
fi
echo "No unreviewed DROP statements in $TARGET"
