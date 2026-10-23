#!/usr/bin/env bash
# Serves public/ through the Hosting emulator and asserts what firebase.json
# can't check itself — notably that `headers` is last-match-wins, so a reorder
# could silently let the catch-all max-age=0 clobber a specific cache rule.
# Deliberately narrow: skips emulator-only behaviour (traversal handling,
# compression, HTTPS) — see #29. Used by ci.yml, deploy.yml and locally.
set -euo pipefail

# Matches firebase.json -> emulators.hosting.port.
PORT="${PORT:-5050}"
PROJECT="${PROJECT:-mlz-no}"

cd "$(dirname "$0")/.."

base="http://127.0.0.1:$PORT"
log="emulator.log"

bunx firebase-tools emulators:start --only hosting \
  --project "$PROJECT" > "$log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT

# Wait up to 60s for the emulator to bind.
up=0
for _ in $(seq 1 120); do
  if curl -sf -o /dev/null "$base/"; then up=1; break; fi
  sleep 0.5
done
if [ "$up" != "1" ]; then
  echo "FAIL emulator never came up on $base (port taken?)"
  echo "--- emulator log ---"
  cat "$log"
  exit 1
fi

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

# Response headers for a URL, one per line.
headers() { curl -s -D - -o /dev/null "$1"; }

# Catches a deleted/mistyped header, otherwise invisible until someone scans the site.
for header in content-security-policy strict-transport-security x-content-type-options x-frame-options referrer-policy permissions-policy; do
  if headers "$base/" | grep -qi "^$header:"; then
    ok "header $header present"
  else
    bad "header $header missing"
  fi
done

# 404.html's filename is the whole contract with Hosting; a rename degrades silently.
status="$(curl -s -o /dev/null -w '%{http_code}' "$base/nope")"
if [ "$status" = "404" ] && curl -s "$base/nope" | grep -q 'notfound-home'; then
  ok "unknown path serves the custom 404 page"
else
  bad "unknown path did not serve the custom 404 page (status $status)"
fi

# Confirms firebase.json's ignore list keeps it from ever being served.
if [ "$(curl -s -o /dev/null -w '%{http_code}' "$base/firebase.json")" = "404" ]; then
  ok "firebase.json is not served"
else
  bad "firebase.json is served"
fi

# Without revalidation, a deploy could stay invisible for Hosting's default hour of caching.
if headers "$base/" | grep -qi '^cache-control:.*must-revalidate'; then
  ok "HTML is revalidated"
else
  bad "HTML is not revalidated"
fi

# Favicon has a stable URL, so it must not be immutable (200 checked first so
# a missing/renamed file can't pass this vacuously).
favicon="$base/assets/icons/favicon.svg"
if [ "$(curl -s -o /dev/null -w '%{http_code}' "$favicon")" != "200" ]; then
  bad "favicon is not served (cannot check its cache policy)"
elif headers "$favicon" | grep -qi '^cache-control:.*immutable'; then
  bad "favicon marked immutable"
else
  ok "favicon is served and not immutable"
fi

# The brand baseline is linked live from other origins (BRAND.md).
for path in /brand/tokens.css /brand/tokens.json /brand/brand.json /brand/tailwind.css /brand/BRAND.md /brand/logo/mark.svg /llms.txt; do
  status="$(curl -s -o /dev/null -w '%{http_code}' "$base$path")"
  if [ "$status" = "200" ]; then ok "$path is served"; else bad "$path returned $status"; fi
done

# Cross-origin <link> + @font-face and fetch() need CORS; a reorder or a
# narrowed glob would break every consumer at once.
for path in /brand/tokens.css /brand/fonts/ibm-plex-mono-400.woff2; do
  if headers "$base$path" | grep -qi '^access-control-allow-origin: \*'; then
    ok "$path allows any origin"
  else
    bad "$path is missing access-control-allow-origin: *"
  fi
done

# Folder URLs handed out in BRAND.md must not 404 (no directory listing).
for path in /brand /brand/ /brand/logo/; do
  loc="$(headers "$base$path" | grep -i '^location:' || true)"
  if echo "$loc" | grep -q '/brand/BRAND.md'; then
    ok "$path redirects to the brand guide"
  else
    bad "$path does not redirect to /brand/BRAND.md"
  fi
done

# Stable URLs that change with the baseline: cached, never immutable.
brand_cc="$(headers "$base/brand/tokens.css" | grep -i '^cache-control:' || true)"
if echo "$brand_cc" | grep -qi 'max-age=3600' && ! echo "$brand_cc" | grep -qi 'immutable'; then
  ok "brand files cached for an hour, not immutable"
else
  bad "unexpected brand cache policy: $brand_cc"
fi

if headers "$base/brand/BRAND.md" | grep -qi '^content-type: text/markdown; charset=utf-8'; then
  ok "markdown served as UTF-8"
else
  bad "markdown is not served as text/markdown; charset=utf-8"
fi

if [ "$fail" -ne 0 ]; then
  echo "--- emulator log ---"
  cat "$log"
fi
exit "$fail"
