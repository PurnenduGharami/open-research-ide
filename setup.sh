#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null || { echo "Node.js 22.19+ is required." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required." >&2; exit 1; }
command -v openclaw >/dev/null || { echo "OpenClaw CLI is required and must be on PATH." >&2; exit 1; }

node scripts/bootstrap-env.mjs
npm ci
node scripts/configure-openclaw.mjs
openclaw config validate
npm run preflight

echo
echo "Setup complete. Start the local IDE with: npm run dev"
echo "Open http://127.0.0.1:3000 (keep this terminal running)."
