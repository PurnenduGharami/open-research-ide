#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null || { echo "Node.js 22.19+ is required." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required." >&2; exit 1; }

node scripts/bootstrap-env.mjs
npm ci
npm run preflight || true

echo
echo "Setup complete. Add GEMINI_API_KEY in .env (or via Setup in the UI) and start with: npm run dev"
echo "Open http://127.0.0.1:3000 (or try 'Explore Sample Investigation' without an API key)."
