#!/usr/bin/env bash
#
# Asserts that a running deployment of public/ behaves the way firebase.json
# says it should. There is no server and no build step, so none of this can be
# unit-tested: the only way to know the config works is to ask a deployment.
#
#   scripts/smoke.sh http://127.0.0.1:5000   # the Hosting emulator, in ci.yml
#   scripts/smoke.sh https://mlz.no          # production, after deploy.yml
#
# One script for both so the two can't drift: production is held to exactly the
# contract the pull request was checked against. Deliberately narrow on the
# config side — it skips anything that is emulator behaviour rather than this
# repo's config (traversal handling, compression, HTTPS), see #29.
#
# Every assertion is checked before exiting, so one run reports every problem.
set -euo pipefail

base="${1:?usage: scripts/smoke.sh <base-url>}"
base="${base%/}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fail=0
ok() { echo "ok   $1"; }
bad() {
  echo "FAIL $1"
  fail=1
}

# Response headers for a URL, one per line. No -f: a 404 has headers too.
headers() { curl -sS -D - -o /dev/null "$1"; }
status() { curl -sS -o /dev/null -w '%{http_code}' "$1"; }

echo "smoke testing $base"

# Catches a deleted or mistyped header, otherwise invisible until someone scans
# the site.
for header in content-security-policy strict-transport-security \
  x-content-type-options x-frame-options referrer-policy permissions-policy; do
  if headers "$base/" | grep -qi "^$header:"; then
    ok "header $header present"
  else
    bad "header $header missing"
  fi
done

# cleanUrls is load-bearing: every URL under /projects is extension-less, so a
# flipped flag would 404 the whole section. Probed on / rather than a page,
# because this is a question about the flag, not about what content exists.
if [ "$(status "$base/")" = "200" ] &&
  [ "$(status "$base/index.html")" = "301" ]; then
  ok "cleanUrls redirects .html to the extension-less URL"
else
  bad "cleanUrls is not in effect"
fi

# Confirms firebase.json's ignore list keeps it from ever being served.
if [ "$(status "$base/firebase.json")" = "404" ]; then
  ok "firebase.json is not served"
else
  bad "firebase.json is served"
fi

# Without revalidation, a deploy could stay invisible for Hosting's default
# hour of caching.
if headers "$base/" | grep -qi '^cache-control:.*must-revalidate'; then
  ok "HTML is revalidated"
else
  bad "HTML is not revalidated"
fi

# /assets/** keeps stable URLs across deploys, so it gets a day of caching and
# must never be immutable — replacing a file would otherwise never reach anyone
# holding the old one. 200 is checked first so a renamed file can't pass this
# vacuously.
favicon="$base/assets/icons/favicon.svg"
favicon_cache="$(headers "$favicon" | grep -i '^cache-control:' || true)"
if [ "$(status "$favicon")" != "200" ]; then
  bad "favicon is not served (cannot check its cache policy)"
elif printf '%s' "$favicon_cache" | grep -qi 'immutable'; then
  bad "favicon marked immutable"
elif printf '%s' "$favicon_cache" | grep -qi 'max-age=86400'; then
  ok "assets are cached for a day and not immutable"
else
  bad "favicon cache policy is not max-age=86400 ($favicon_cache)"
fi

# 404.html's filename is the whole contract with Hosting — there is no config
# key for it, so a rename degrades silently. Compared byte-for-byte rather than
# grepped, so a half-deployed 404 page fails too.
notfound="$tmp/404"
code="$(curl -sS -o "$notfound" -w '%{http_code}' \
  -H 'Accept-Encoding: identity' "$base/no-such-path-$$")"
if [ "$code" != "404" ]; then
  bad "unknown path answered $code, not 404"
elif ! cmp -s "$notfound" "$root/public/404.html"; then
  bad "unknown path 404s but the body is not public/404.html"
else
  ok "unknown path serves public/404.html with a 404 status"
fi

# Every file in public/ compared against what the deployment actually returns.
# This is what makes the production run worth having: it is the only check that
# the deploy landed in full, rather than uploading some files and reporting
# success. cleanUrls means a page's URL is its path without the .html, and the
# file list skips what firebase.json's ignore list never uploads.
url_for() {
  case "$1" in
  index.html) printf '/' ;;
  */index.html) printf '/%s' "${1%/index.html}" ;;
  *.html) printf '/%s' "${1%.html}" ;;
  *) printf '/%s' "$1" ;;
  esac
}

# Hosting purges its CDN on deploy, but the production run starts seconds after
# that, so give an edge a few tries to catch up before calling it a failure.
# curl is silenced here: a failed attempt is normal, and the verdict is reported
# by the caller either way.
matches() {
  for attempt in 1 2 3 4 5; do
    if curl -fs -o "$tmp/body" -H 'Accept-Encoding: identity' "$2" 2>/dev/null &&
      cmp -s "$tmp/body" "$1"; then
      return 0
    fi
    [ "$attempt" = 5 ] || sleep 3
  done
  return 1
}

served=0
while IFS= read -r file; do
  # Reached by unknown paths, not by its own URL — asserted above instead.
  [ "$file" = "404.html" ] && continue
  if matches "$root/public/$file" "$base$(url_for "$file")"; then
    served=$((served + 1))
  else
    bad "public/$file is not served as it sits on disk"
  fi
done < <(cd "$root/public" && find . -type f \
  -not -path '*/.*' -not -path './node_modules/*' |
  sed 's|^\./||' | sort)
ok "$served files served byte-for-byte from public/"

exit "$fail"
