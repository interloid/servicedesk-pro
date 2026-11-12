#!/usr/bin/env bash
# Authorization suite: attacks and legitimate flows run as the real API roles
# (anon, authenticated) against a database built from every migration.
#
# It starts a throwaway PostgreSQL cluster in a temp directory on a free local
# port, and deletes it on exit. It never reads .env files and never connects to a
# hosted project. Needs PostgreSQL 15+ server binaries (initdb, pg_ctl, psql) on
# PATH, or in PG_BIN.
#
#   npm run test:authz
#   AUTHZ_EXCLUDE=20261112120000 npm run test:authz   # leave a migration out
#   AUTHZ_KEEP=1 npm run test:authz                   # keep the database to inspect
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
HERE="$ROOT/supabase/tests/authz"

if [ -n "${PG_BIN:-}" ]; then
  PATH="$PG_BIN:$PATH"
elif ! command -v initdb >/dev/null 2>&1; then
  for dir in /opt/homebrew/opt/postgresql@1{7,6,5}/bin /usr/local/opt/postgresql@1{7,6,5}/bin /usr/lib/postgresql/1{7,6,5}/bin; do
    if [ -x "$dir/initdb" ]; then PATH="$dir:$PATH"; break; fi
  done
fi
for tool in initdb pg_ctl psql; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing $tool. Install PostgreSQL 15+ or set PG_BIN." >&2; exit 2; }
done

WORK=$(mktemp -d)
PORT=$(( 56000 + RANDOM % 2000 ))
cleanup() {
  if [ -n "${AUTHZ_KEEP:-}" ]; then
    echo "Kept: psql -h $WORK -p $PORT -U postgres   (stop: pg_ctl -D $WORK/data stop)"
    return
  fi
  pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

initdb -D "$WORK/data" -U postgres --auth=trust --no-sync -E UTF8 >/dev/null
pg_ctl -D "$WORK/data" -l "$WORK/pg.log" -w \
  -o "-p $PORT -k $WORK -c listen_addresses='' -c fsync=off -c wal_level=logical" start >/dev/null

db() { psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X "$@"; }

db -f "$HERE/shim.sql" >/dev/null

# The MAINTAIN privilege (in the dumped initial grants) arrived in PostgreSQL 17,
# which hosted projects run. On 16 it is dropped; no policy depends on it.
STRIP_MAINTAIN=cat
if [ "$(db -At -c 'show server_version_num')" -lt 170000 ]; then
  STRIP_MAINTAIN="sed -E s/MAINTAIN,[[:space:]]*//g"
fi

for f in "$ROOT"/supabase/migrations/*.sql; do
  name=$(basename "$f")
  version=${name%%_*}
  # The initial migration was later edited to include this column, so this one
  # can't run on an empty database (same skip as scripts/e2e-stack.sh).
  [ "$name" = "20260831162650_add_invoices_updated_at.sql" ] && continue
  case " ${AUTHZ_EXCLUDE:-} " in *" $version "*) echo "Excluded: $name"; continue ;; esac
  # pg_cron and pg_net are platform extensions; shim.sql stands in for their API.
  sed -E 's/^[[:space:]]*(create|CREATE)[[:space:]]+(extension|EXTENSION)[[:space:]]+(if not exists|IF NOT EXISTS)[[:space:]]+(pg_cron|pg_net)[^;]*;/-- &/' "$f" \
    | $STRIP_MAINTAIN \
    | db --single-transaction >/dev/null 2>"$WORK/m.log" \
    || { echo "Migration failed: $name" >&2; grep -m5 -E 'ERROR|DETAIL|LINE' "$WORK/m.log" >&2; exit 2; }
done

for f in "$ROOT"/supabase/schemas/seeds/*.sql "$ROOT"/supabase/schemas/storage/buckets.sql; do
  db --single-transaction -f "$f" >/dev/null
done

db -f "$HERE/harness.sql" >/dev/null
db -f "$HERE/fixtures.sql" >/dev/null

for f in "$HERE"/cases/*.sql; do
  db -f "$f" >/dev/null
done

db -At -F ' | ' -c "select case when passed then 'PASS' else 'FAIL' end, kind, label, coalesce(detail, '') from authz.results order by id"

FAILED=$(db -At -c "select count(*) from authz.results where not passed")
TOTAL=$(db -At -c "select count(*) from authz.results")
echo
echo "$((TOTAL - FAILED)) of $TOTAL passed"
[ "$FAILED" -eq 0 ]
