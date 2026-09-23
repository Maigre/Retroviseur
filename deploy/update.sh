#!/usr/bin/env bash
# Runs ON gaff, inside the git checkout /srv/apps/retroviseur.
# Pull main, build, publish the build to dist/ (what the server reads), reload pm2.
# The server keeps serving the previous dist/ while npm and vite run.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch --quiet origin main
git reset --quiet --hard origin/main   # the checkout is deploy-only: never edit on gaff
npm ci --no-audit --no-fund --loglevel=error
npm test --silent
npm run build --silent
rsync -a --delete-after build/ dist/
pm2 startOrReload deploy/ecosystem.config.cjs --update-env >/dev/null
pm2 save >/dev/null
curl -fsS -o /dev/null -w 'gaff: %{http_code}\n' http://127.0.0.1:3001/
echo "deployed $(git rev-parse --short HEAD)"
