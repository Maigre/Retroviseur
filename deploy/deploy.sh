#!/usr/bin/env bash
# Build and ship Retroviseur to gaff (VM 103 on rachael), then (re)start it under pm2.
# Usage: deploy/deploy.sh            — needs `ssh rachael` working from this machine.
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET=${TARGET:-mgr@10.2.37.103}
JUMP=${JUMP:-rachael}
DEST=/srv/apps/retroviseur
SSH="ssh -J $JUMP"

npm ci
npm test
npm run build

$SSH "$TARGET" "mkdir -p $DEST"
rsync -az --delete-after -e "$SSH" build/ "$TARGET:$DEST/build/"
rsync -az -e "$SSH" deploy/server.mjs deploy/ecosystem.config.cjs "$TARGET:$DEST/"
$SSH "$TARGET" "cd $DEST && pm2 startOrReload ecosystem.config.cjs && pm2 save >/dev/null && curl -fsS -o /dev/null -w 'gaff: %{http_code}\n' http://127.0.0.1:3001/"
echo "deployed $(git rev-parse --short HEAD) → https://retroviseur.37m.gr"
