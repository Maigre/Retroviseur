# Android app (Phase 5) — proposal, not started

Status: **decisions taken 2026-09-26 (D57)**, not built yet.

## Shape

Capacitor wraps the same SvelteKit build into an Android app; the web app stays at
retroviseur.waverz.net for iPhone and everyone else. The build is bundled in the APK
(instant start, offline), and its storage belongs to the app (Android won't evict
rolls).

## What native fixes

| Today | In the app |
|---|---|
| no vibration (Brave/Chrome) | `@capacitor/haptics` |
| "the lab called" only on open | local notification scheduled on the phone at hand-off — no server push, zero-knowledge holds |
| status bar, Brave/Chrome install trouble | real APK, immersive fullscreen, locked portrait |
| late flash, frozen preview, video-res flash shots | **not** fixed by the WebView camera — needs a native camera preview behind a transparent web layer (fits in our rotated tunnel finder) |

**v1** = the app with the current web camera + native haptics, notifications,
fullscreen, install; **v2** = native camera (D57).

## Other pieces

- Lab API from the app: the app's origin is local → the lab allows cross-origin
  calls from that one origin (CORS). Tickets stay web links.
- Android App Links (yes, D57): a ticket tapped on a phone with the app opens the
  app. Needs `/.well-known/assetlinks.json` on retroviseur.waverz.net (app id +
  signing fingerprint) and an intent filter for `/lab/*`; **in the app**, the
  `appUrlOpen` event must route `/lab/<id>#<key>` to the bundled pickup page, and
  that page's lab calls go to the absolute API (CORS, above).
- Distribution: signed APK from `retroviseur.waverz.net/android` + GitHub Releases,
  in-app "update available" via a `version.json`; Play Store ($25 once) or
  F-Droid later.
- App id: **`net.waverz.retroviseur`** (D57).
- Signing key: made on the laptop, never in git, backed up in the password manager
  **and** the hub's `secrets/` (D57) — losing it means installed apps can never be
  updated.
- Toolchain on the laptop (checked 2026-09-26): Android SDK in `~/Android/Sdk`
  (build-tools 34–37, platforms 33–36.1, platform-tools 37, cmdline-tools
  `latest`), JDK 21 at `/usr/lib/jvm/java-21-openjdk-amd64`. The shell's default
  `JAVA_HOME` is JDK 17 (other projects), so the Android build sets JDK 21 for
  itself — never the global one. `npm run android` → signed APK.
- iOS: out of scope (needs a Mac + Apple developer account).

## Decisions (Thomas, 2026-09-26 — D57)

1. Camera: two steps — v1 web camera, v2 native.
2. Distribution: sideloaded APK now, stores later.
3. App ID: `net.waverz.retroviseur`.
4. Signing key backup: password manager **and** hub `secrets/`.
5. Ticket links open the app (App Links), handled in-app.
6. JDK 21 + Android platform 36 installed user-level on the laptop.
