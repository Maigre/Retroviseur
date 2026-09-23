# Android app (Phase 5) — proposal, not started

Status: **design proposed 2026-09-23, decisions pending** (Thomas asked to fix the
PWA install flow first). Nothing built yet.

## Shape

Capacitor wraps the same SvelteKit build into an Android app; the web app stays at
retroviseur.37m.gr for iPhone and everyone else. The build is bundled in the APK
(instant start, offline), and its storage belongs to the app (Android won't evict
rolls).

## What native fixes

| Today | In the app |
|---|---|
| no vibration (Brave/Chrome) | `@capacitor/haptics` |
| "the lab called" only on open | local notification scheduled on the phone at hand-off — no server push, zero-knowledge holds |
| status bar, Brave/Chrome install trouble | real APK, immersive fullscreen, locked portrait |
| late flash, frozen preview, video-res flash shots | **not** fixed by the WebView camera — needs a native camera preview behind a transparent web layer (fits in our rotated tunnel finder) |

Proposed: **v1** = the app with the current web camera + native haptics,
notifications, fullscreen, install; **v2** = native camera.

## Other pieces

- Lab API from the app: the app's origin is local → the lab allows cross-origin
  calls from that one origin (CORS). Tickets stay web links.
- Android App Links: a ticket tapped on a phone with the app opens the app's lab
  page (`/.well-known/assetlinks.json` with the signing fingerprint).
- Distribution: signed APK from `retroviseur.37m.gr/android` + GitHub Releases,
  in-app "update available" via a `version.json`; Play Store ($25 once) or
  F-Droid later.
- Signing key: made on the laptop, never in git, backed up — losing it means
  installed apps can never be updated.
- Toolchain on the laptop: Android SDK present (build-tools ≤ 37, platforms 33–34),
  Gradle 8.7, adb; needs JDK 21 (system has 25, too new for the Android Gradle
  plugin) and platform 35/36, both user-level. `npm run android` → signed APK.
- iOS: out of scope (needs a Mac + Apple developer account).

## Decisions pending (Thomas)

1. Camera: two steps (v1 web camera, v2 native) or native right away?
2. Distribution: sideloaded APK now, stores later?
3. App ID: `gr.m37.retroviseur` (Android ids can't start with a digit)?
4. Signing key backup: password manager, hub `secrets/`, or both?
5. Ticket links open the app (App Links)?
6. Install JDK 21 + Android platform 36 user-level on the laptop?
