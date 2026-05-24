#!/bin/bash
# Wrapper invoked by ~/Library/LaunchAgents/com.jaxevents.refresh.plist.
# Runs the standalone scraper with the right Node, env, and working dir.
#
# launchd starts processes with a minimal PATH that doesn't include nvm or
# Homebrew, so the absolute path to node is required. If you upgrade node
# via nvm and the path changes, update NODE_BIN below.

set -euo pipefail

PROJECT_DIR="/Users/kendalltotten/Sites/jax-events"
NODE_BIN="/Users/kendalltotten/.nvm/versions/node/v22.22.1/bin/node"
TSX="$PROJECT_DIR/node_modules/.bin/tsx"
LOG_DIR="$PROJECT_DIR/data"
LOG_FILE="$LOG_DIR/refresh.log"

mkdir -p "$LOG_DIR"

# Trim the log if it's grown past ~1 MB so it doesn't accumulate forever.
if [ -f "$LOG_FILE" ] && [ "$(stat -f%z "$LOG_FILE")" -gt 1000000 ]; then
  tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

cd "$PROJECT_DIR"

# Load .env.local into the environment so API-key-gated scrapers (Ticketmaster,
# the tip parser) see their keys. Skip lines that are blank or commented.
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -Ev '^\s*(#|$)' .env.local | sed 's/^\([^=]*\)=\(.*\)$/\1="\2"/')
  set +a
fi

echo "----- $(date -u +%FT%TZ) starting refresh -----" >> "$LOG_FILE"
"$NODE_BIN" "$TSX" scripts/scrape.ts >> "$LOG_FILE" 2>&1
echo "----- $(date -u +%FT%TZ) refresh exit $? -----" >> "$LOG_FILE"
