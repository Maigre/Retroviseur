#!/usr/bin/env bash
# Publish the APK built by scripts/android.sh: gaff serves it at
# https://retroviseur.waverz.net/android/retroviseur.apk, and installed apps see
# the new version.json and offer the update. version.json goes last, so no app
# is told about an APK that isn't there yet.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f dist-android/retroviseur.apk ] || { echo "build first: npm run android" >&2; exit 1; }
DEST=/srv/apps/retroviseur-data/android
SSH="ssh -J rachael mgr@10.2.37.103"
$SSH "mkdir -p $DEST"
rsync -e "ssh -J rachael" dist-android/retroviseur.apk "mgr@10.2.37.103:$DEST/retroviseur.apk.new"
$SSH "mv $DEST/retroviseur.apk.new $DEST/retroviseur.apk"
rsync -e "ssh -J rachael" dist-android/version.json "mgr@10.2.37.103:$DEST/version.json"
echo "published: $(cat dist-android/version.json)"
