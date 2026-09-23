#!/usr/bin/env bash
# Deploy the latest pushed `main` to gaff (VM 103 on rachael): gaff pulls,
# builds and reloads itself (deploy/update.sh). Push your commits first.
# Needs `ssh rachael` to work from this machine.
set -euo pipefail

TARGET=${TARGET:-mgr@10.2.37.103}
JUMP=${JUMP:-rachael}

local_head=$(git -C "$(dirname "$0")/.." rev-parse --short HEAD 2>/dev/null || true)
remote_main=$(git -C "$(dirname "$0")/.." rev-parse --short origin/main 2>/dev/null || true)
[ "$local_head" = "$remote_main" ] || echo "note: local HEAD $local_head ≠ origin/main $remote_main — deploying origin/main"

ssh -J "$JUMP" "$TARGET" /srv/apps/retroviseur/deploy/update.sh
