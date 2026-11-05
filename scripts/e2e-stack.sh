#!/usr/bin/env bash
# Throwaway Supabase stack for the Playwright suite. Runs beside the default local
# stack on shifted ports (55xxx), so it never touches that stack or a hosted project.
#
#   npm run e2e:stack        # (re)build it: empty database, all migrations, seed data
#   npm run e2e:stack:stop   # remove it and its data
#
# It never reads .env.local. Docker must be running; if docker points at a dead
# context, prefix with DOCKER_CONTEXT=default.
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT=servicedeske2e
CONTAINER="supabase_db_${PROJECT}"
OUT=.e2e/stack.env

if [ "${1:-up}" = "stop" ]; then
  supabase stop --project-id "$PROJECT" --no-backup
  rm -f "$OUT"
  exit 0
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# A copy of the config, so the repo's own config.toml stays as it is. Migrations are
# applied below rather than by `supabase start`, which stops at the first failure.
mkdir "$WORK/supabase"
cp supabase/config.toml "$WORK/supabase/"
cp -r supabase/migrations "$WORK/supabase/"
sed -i -E \
  -e "s/^project_id = .*/project_id = \"$PROJECT\"/" \
  -e 's/^port = 54([0-9]{3})/port = 55\1/' \
  -e 's/^shadow_port = 54320/shadow_port = 55320/' \
  -e 's/^inspector_port = 8083/inspector_port = 8183/' \
  -e 's/^sign_in_sign_ups = 30/sign_in_sign_ups = 1000/' \
  -e '/^\[db\.migrations\]/,/^\[/ s/^enabled = true/enabled = false/' \
  -e '/^\[db\.seed\]/,/^\[/ s/^enabled = true/enabled = false/' \
  "$WORK/supabase/config.toml"

supabase stop --project-id "$PROJECT" --no-backup >/dev/null 2>&1 || true
(cd "$WORK" && supabase start -x vector,logflare,studio,imgproxy,edge-runtime >/dev/null)

# Local Auth opens a database connection per request, and each one then sits in
# TIME_WAIT for a minute. A full test run fills the port range, and the resulting
# 500s read as signed-out users. Only this stack's Auth container is changed.
AUTH_CONTAINER="supabase_auth_${PROJECT}"
docker run --rm --privileged --user root --network "container:$AUTH_CONTAINER" \
  --entrypoint sh "$(docker inspect -f '{{.Config.Image}}' "$AUTH_CONTAINER")" \
  -c 'sysctl -qw net.ipv4.tcp_tw_reuse=1 net.ipv4.ip_local_port_range="1024 65535"'

STATUS=$(cd "$WORK" && supabase status --output env 2>/dev/null)
read_status() { sed -nE "s/^$1=\"?([^\"]*)\"?$/\1/p" <<<"$STATUS"; }
API_URL=$(read_status API_URL)
ANON_KEY=$(read_status ANON_KEY)
SERVICE_ROLE_KEY=$(read_status SERVICE_ROLE_KEY)

case "$API_URL" in
  http://127.0.0.1:*) ;;
  *) echo "Refusing to continue: stack URL is '$API_URL', not local." >&2; exit 2 ;;
esac

in_db() { docker exec -i "$CONTAINER" psql -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

for f in "$WORK"/supabase/migrations/*.sql; do
  name=$(basename "$f")
  # The initial migration was later edited to include this column, so this one can't
  # run on an empty database. Hosted databases already recorded it.
  [ "$name" = "20260831162650_add_invoices_updated_at.sql" ] && continue
  in_db -U postgres --single-transaction <"$f" >/dev/null 2>"$WORK/m.log" \
    || { echo "Migration failed: $name" >&2; grep -m3 -E 'ERROR|DETAIL' "$WORK/m.log" >&2; exit 2; }
done

# Reference rows (plans, time zones) live in seed files, not migrations.
for f in supabase/schemas/seeds/*.sql; do
  in_db -U postgres --single-transaction <"$f" >/dev/null
done

# The hosted project's default grants, which the migrations do not record (SEC-033).
# Scheduled jobs are removed so that nothing changes data underneath a test run.
in_db -U supabase_admin <<'SQL'
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
SQL
in_db -U postgres -c "select cron.unschedule(jobid) from cron.job" >/dev/null

# Auth caches its view of the hook function, which only exists from this point.
docker restart "supabase_auth_${PROJECT}" >/dev/null

NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  node scripts/seed-tenants.mjs --apply --count 10 | tail -n 4

# Staff replies are disabled outside business hours, so tests and screenshots on
# these workspaces would otherwise change by time of day.
in_db -U postgres <<'SQL'
update business_hours
set schedule_json = schedule_json || '{"working_days":["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],"day_start":"00:00:00","day_end":"23:59:59"}'
where tenant_id in (select id from tenants where slug in ('seed-cedar', 'seed-juniper'));
SQL

mkdir -p "$(dirname "$OUT")"
cat >"$OUT" <<EOF
E2E_SUPABASE_URL=$API_URL
E2E_SUPABASE_ANON_KEY=$ANON_KEY
E2E_SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EOF
echo "E2E stack ready at $API_URL"
