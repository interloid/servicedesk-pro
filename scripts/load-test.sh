#!/usr/bin/env bash
# k6 load test against the throwaway E2E stack. Never points at a hosted project:
# it blanks everything .env.local would supply, and stops unless the running app
# reports the local database. Results go to .e2e/load/.
#
#   npm run e2e:stack              # once, to create the stack
#   npm run test:load -- smoke     # or: load, stress, spike
#   LOAD_BUILD=1 npm run test:load -- load   # rebuild the app first
#
# If docker points at a dead context, prefix with DOCKER_CONTEXT=default.
set -euo pipefail

cd "$(dirname "$0")/.."
PROFILE=${1:-smoke}
PORT=3100
BASE_URL="http://localhost:$PORT"
K6_IMAGE=grafana/k6:1.3.0
STACK=.e2e/stack.env
DIST=.next-e2e

[ -f "$STACK" ] || { echo "No E2E stack found. Run: npm run e2e:stack" >&2; exit 1; }

read_stack() { sed -nE "s/^$1=\"?([^\"]*)\"?$/\1/p" "$STACK"; }
SUPABASE_URL=$(read_stack E2E_SUPABASE_URL)

case "$SUPABASE_URL" in
http://127.0.0.1:* | http://localhost:*) ;;
*) echo "Refusing to load test non-local $SUPABASE_URL." >&2; exit 1 ;;
esac

if ss -ltn | grep -q ":$PORT "; then
  echo "Port $PORT is in use. It may be wired to live data, so stopping." >&2
  exit 1
fi

# Same environment as playwright.config.ts. Next.js fills anything missing from
# the process from .env.local, which holds live keys, so every name is blanked.
while IFS= read -r name; do
  [ "$name" = NODE_ENV ] || export "$name="
done < <(sed -nE 's/^([A-Za-z_][A-Za-z0-9_]*)=.*/\1/p' .env.example .env.local 2>/dev/null | sort -u)

export E2E_DIST_DIR=$DIST
export NEXT_PUBLIC_SITE_URL=$BASE_URL
export NEXT_PUBLIC_SITE_NAME=ServiceDesk
export NEXT_PUBLIC_SITE_DESCRIPTION="ServiceDesk end-to-end test build"
export NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(read_stack E2E_SUPABASE_ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY=$(read_stack E2E_SUPABASE_SERVICE_ROLE_KEY)
export NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
export SESSION_SECRET=e2e-session-secret-e2e-session-secret
export PLATFORM_ADMIN_EMAILS=admin@juniper.seed.test
export SUBDOMAIN_ROUTING_AVAILABLE=false

if [ -n "${LOAD_BUILD:-}" ] || [ ! -f "$DIST/BUILD_ID" ]; then
  npx next build
fi

# Fresh sessions: the saved ones expire, and a token refreshed under load would be
# rotated by many requests at once. Playwright starts and stops its own server.
E2E_SKIP_BUILD=1 npx playwright test --project=setup --reporter=dot

# node directly, not npx: stopping npx would leave the server running on the port.
node node_modules/next/dist/bin/next start -p "$PORT" >/dev/null 2>.e2e/load-server.log &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -fs -o /dev/null "$BASE_URL/login" && break
  sleep 1
done

POLICY=$(curl -fsI "$BASE_URL/login" | grep -i '^content-security-policy:' || true)
if [[ "$POLICY" != *"$SUPABASE_URL"* ]] || [[ "$POLICY" == *".supabase.co"* ]]; then
  echo "The app isn't on the local database. Stopping before any load." >&2
  exit 1
fi

mkdir -p .e2e/load
STAMP=$(date +%Y%m%d-%H%M%S)

docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$PWD/load:/work/load:ro" -v "$PWD/.e2e:/work/.e2e" -w /work/load \
  -e BASE_URL="$BASE_URL" -e PROFILE="$PROFILE" -e LOAD_DEBUG="${LOAD_DEBUG:-}" \
  "$K6_IMAGE" run --quiet --summary-trend-stats="avg,med,p(90),p(95),p(99),max" \
  --summary-export="/work/.e2e/load/$PROFILE-$STAMP.json" servicedesk.js
