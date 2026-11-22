#!/usr/bin/env bash
#
# Post-build smoke test for the frontend container.
#
# Proves the image actually serves the app rather than just holding the port:
# it boots the container, waits for the server, then checks that route handlers
# execute, that the documents render, and that the /audit proxy is wired.
#
# Usage:
#   Frontend/scripts/smoke-test.sh [image] [port]
#
# Note on what is NOT checked here. `app/components/ParticleClientWrapper.tsx`
# loads the wallet provider with `dynamic(..., { ssr: false })`, and that wrapper
# sits above `{children}` in the root layout — so no page body is server-rendered
# for any route, and grepping the HTML for page text would always fail. Rendered
# content is asserted in the vitest suite instead (`npm test`); this script
# checks the things only a running container can show.
#
# Exits non-zero on the first failed check so a caller can trigger the
# documented rollback. See docs/DEPLOY_FRONTEND_DOCKER.md.

set -euo pipefail

IMAGE="${1:-gatedelay-frontend:local}"
PORT="${2:-3100}"
CONTAINER="gatedelay-frontend-smoke-$$"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-60}"
BASE="http://127.0.0.1:$PORT"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "SMOKE FAIL: $*" >&2
  echo "--- container logs ---" >&2
  docker logs "$CONTAINER" 2>&1 | tail -40 >&2 || true
  exit 1
}

echo "Starting $IMAGE as $CONTAINER on :$PORT"
docker run -d --name "$CONTAINER" -p "$PORT:3000" "$IMAGE" >/dev/null

# ── 1. Boot ────────────────────────────────────────────────────────────────
echo -n "Waiting for the server "
for _ in $(seq 1 "$BOOT_TIMEOUT"); do
  if curl -fsS "$BASE/api/ping" >/dev/null 2>&1; then
    echo "ok"
    break
  fi
  # A container that already exited will never come up; stop waiting.
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
    fail "container exited during boot"
  fi
  echo -n "."
  sleep 1
done

curl -fsS "$BASE/api/ping" >/dev/null 2>&1 \
  || fail "server did not respond within ${BOOT_TIMEOUT}s"

# ── 2. Route handlers execute ──────────────────────────────────────────────
# A well-formed body (not just a 200) means Next.js is running app code, not
# serving a static error document.
PING_BODY=$(curl -fsS "$BASE/api/ping")
case "$PING_BODY" in
  *'"ok":true'*) echo "  /api/ping -> ok:true" ;;
  *) fail "/api/ping returned an unexpected body: $PING_BODY" ;;
esac

# ── 3. Documents render ────────────────────────────────────────────────────
check_route() {
  local path="$1"
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
  [ "$status" = "200" ] || fail "$path returned HTTP $status (expected 200)"

  # The root layout's <body> class. Present means app/layout.tsx rendered;
  # Next's own error document would not carry it.
  curl -s "$BASE$path" | grep -q 'min-h-full flex flex-col' \
    || fail "$path did not render the root layout"

  echo "  $path -> 200, layout rendered"
}

echo "Checking routes:"
check_route "/"
check_route "/audit"

# ── 4. The /audit backend proxy is wired ───────────────────────────────────
# app/api/market-audit/route.ts proxies to ${NEXT_PUBLIC_API_URL}/market-audit/
# logs. With a backend reachable it answers 200 with rows; with none it answers
# 500 and a JSON `error` body from its own catch block. Both prove the handler
# ran — what would fail the deploy is a non-JSON body or a hang.
AUDIT_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/market-audit?limit=1")
AUDIT_BODY=$(curl -s --max-time 15 "$BASE/api/market-audit?limit=1")

case "$AUDIT_STATUS" in
  200) echo "  /api/market-audit -> 200 (backend reachable)" ;;
  5*)
    case "$AUDIT_BODY" in
      *'"error"'*) echo "  /api/market-audit -> $AUDIT_STATUS with JSON error (no backend configured; handler ran)" ;;
      *) fail "/api/market-audit returned $AUDIT_STATUS with a non-JSON body: $AUDIT_BODY" ;;
    esac
    ;;
  *) fail "/api/market-audit returned an unexpected HTTP $AUDIT_STATUS" ;;
esac

echo "SMOKE PASS: $IMAGE"
