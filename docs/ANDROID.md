# Android app (Phase 5) — proposal, not started

Status: **v1 + v2 built 2026-09-26 (D57, D60, D61)** — signed APK, awaiting the phone test.

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

## v1 as built (D60)

- **Build**: `npm run android` (`scripts/android.sh`) → `ANDROID=1 vite build` into
  `build-android/` (no service worker, native hooks compiled in; the web build
  never contains Capacitor code) → `cap sync` → `gradlew assembleRelease` →
  `dist-android/retroviseur.apk` + `version.json`. versionCode = git commit count,
  versionName `1.<count> (<sha>)`.
- **JDK**: Temurin 21 user-level in `~/.local/share/jdk-21` (the distro only has the
  21 JRE); the script sets `JAVA_HOME` itself, the shell keeps 17.
- **Signing key**: `~/.android-keys/retroviseur.jks` + `retroviseur.properties`
  (passwords), chmod 600, never in git. SHA-256
  `B6:5B:B1:7B:0D:87:57:9A:3D:65:93:5D:D9:89:05:F7:C4:2F:AB:E4:03:6D:6D:94:C9:27:97:65:5F:0B:62:AA`
  — also in `static/.well-known/assetlinks.json`. **Back both files up** (password
  manager + hub `secrets/`): without them no update can ever be installed over v1.
- **Native side** (`src/lib/native.ts`, inert on the web): haptics through
  `@capacitor/haptics`; the close button exits (`App.exitApp`); ticket and app
  sharing through the Android share sheet (the WebView has no Web Share API); the
  lab at `https://retroviseur.waverz.net/api/lab` (CORS for `https://localhost`
  in `deploy/lab.mjs`); tickets and shares carry the public address.
- **Notifications** (`@capacitor/local-notifications`, scheduled on the phone, no
  push): at hand-off, "your prints are ready" at the end of the developing window;
  once the lab gives the expiry, "the lab called" a week before. Cancelled when the
  roll is collected or gone. Permission asked at the first hand-off. No exact-alarm
  permission (removed from the merged manifest).
- **App Links**: intent filter `https://retroviseur.waverz.net/lab/*` with
  autoVerify; `appUrlOpen` / launch URL → `/lab/<id>#<key>` in the app (a launch
  URL is taken once per launch, not after every reload).
- **Shell**: portrait locked, immersive (bars hidden, swipe shows them), backups
  off (sealed rolls and their keys stay on the phone), icons generated from the
  pixel-art source by `scripts/icons.mjs` (launcher, adaptive, notification).
- **Distribution**: `npm run android:publish` → gaff
  `/srv/apps/retroviseur-data/android/` served at
  `https://retroviseur.waverz.net/android/retroviseur.apk`; the app compares its
  build with `/android/version.json` on open and offers the download; the web
  install screen on Android links the APK. GitHub Releases would need a tag —
  Thomas's call.

## v2: the native camera (D61)

`RetroCameraPlugin` (Java, in the app module — no third-party camera plugin),
driven by `src/lib/camera/native-camera.ts`:

- **Preview**: a CameraX `PreviewView` (TextureView mode) added *behind* the
  WebView, sized and placed on the finder's on-screen box (its
  `getBoundingClientRect` × devicePixelRatio, re-sent when the page lays out
  again), clipped to the finder's corner radius, softened like the web finder
  (`saturate 0.85 · brightness 0.95 · blur 0.6px`, Android 12+). In the app build
  `html`, `body`, `.device` and `.finder` are transparent and the native window
  paints `--bg` behind them, so only the finder shows the camera; the vignette,
  the blackout and every control stay web, on top. The activity is portrait-locked,
  so the preview is a true window onto the scene — no counter-rotation needed.
- **Still**: `ImageCapture`, minimise-latency mode, the 4:3 size closest to
  4096 × 3072 (a 48–50 MP sensor gives its ~12 MP output, not 20 MB files), real
  flash with CameraX's pre-flash metering (`FLASH_MODE_ON`) — the late flash of
  the web path (D36) is gone. JPEG 95 to a private cache file → read by the page
  through `Capacitor.convertFileSrc` → released (deleted) at once; the folder is
  wiped on load, stop and destroy. Then the usual path: `developStill` (crop 3:2,
  4096 px, upright, film look) → seal → storage.
- The dev panel's last-shot line reads `native` / `native+flash` with the source
  size; the device report gives the still size CameraX chose and the flash unit.
