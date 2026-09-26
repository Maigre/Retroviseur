#!/usr/bin/env bash
# The Android app (docs/ANDROID.md): web build → Capacitor → signed release APK in
# dist-android/, with the version.json the app checks for updates.
# Needs JDK 21 (set here, never globally) and the key from ~/.android-keys/.
set -euo pipefail
cd "$(dirname "$0")/.."

# a full JDK 21 (the distro ships only the 21 JRE here), user-level — never the global JAVA_HOME
export JAVA_HOME="${RETRO_JDK:-$HOME/.local/share/jdk-21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export RETRO_SIGNING="${RETRO_SIGNING:-$HOME/.android-keys/retroviseur.properties}"
[ -f "$RETRO_SIGNING" ] || { echo "no signing key at $RETRO_SIGNING (docs/ANDROID.md)" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || echo "warning: uncommitted changes go into this APK" >&2

export RETRO_VERSION_CODE="$(git rev-list --count HEAD)"
export RETRO_VERSION_NAME="1.$RETRO_VERSION_CODE ($(git rev-parse --short HEAD))"

ANDROID=1 npx vite build
npx cap sync android
(cd android && ./gradlew --quiet assembleRelease)

mkdir -p dist-android
cp android/app/build/outputs/apk/release/app-release.apk dist-android/retroviseur.apk
printf '{ "versionCode": %s, "versionName": "%s" }\n' "$RETRO_VERSION_CODE" "$RETRO_VERSION_NAME" > dist-android/version.json
echo "dist-android/retroviseur.apk — $RETRO_VERSION_NAME"
