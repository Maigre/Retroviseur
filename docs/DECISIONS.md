# Decisions

A log of key choices, newest at the bottom. Each entry: what, why, and what was
rejected. Change a decision by adding a new entry that supersedes the old one —
don't rewrite history.

## D1 — Name: Rétroviseur · 2026-09-23

*Rétro* + *viseur* (viewfinder); a rear-view mirror only shows what's behind
you, just as the app only shows photos after the fact. Repo `Maigre/Retroviseur`,
display name **Rétroviseur**.

Availability checked 2026-09-23: no App Store app (FR/US storefronts), no Google
Play result, no GitHub clash in the account.

Rejected (taken on the stores or too crowded): Pellicule, Bobine, Pelloche,
Cliché (an actual disposable-camera app), Latent, Argentique, Wind On, Emulsion,
Silver Salt, Photon (~45 apps incl. *Photon Camera*, plus the `photon` Rust/WASM
image library). Free but not chosen: Révélateur, Amorce, Rembobine, Grainroll,
Pellicam.

## D2 — Develop MVP: on-device time-lock, Lab abstraction from day one · 2026-09-23

The MVP "lab" is local: the full roll stays sealed on the phone and unlocks after
a wait. The flow **will** evolve (email delivery, then maybe a real photo lab),
so the camera talks to a `Lab` interface ([`src/lib/lab/types.ts`](../src/lib/lab/types.ts))
and never knows which lab it has. Adding a lab = one new class, no UI change.

Rejected for the MVP: server + email (more moving parts before the core ritual
is proven); share-a-sealed-archive (clunky).

Known limit: with a local lab, the key is on the device, so the lock is a
ritual, not security. Accepted.

## D3 — Film look applied on the phone, at capture · 2026-09-23

WebGL shader bakes the look into each frame before it is sealed. Works offline
and with the local lab. Consequence: the look of a roll is frozen at capture.

## D4 — Film stock: developer-fixed, two candidates · 2026-09-23

Superia 400 / QuickSnap and Fujicolor C200 are both implemented as parameter
sets ([`src/lib/film/stocks.ts`](../src/lib/film/stocks.ts)); after bench tests
the developer picks one via `FILM_STOCK`. Users never choose. Pro 400H rejected
(too "wedding", not disposable).

## D5 — Stack: SvelteKit (static SPA) + Capacitor later · 2026-09-23

SvelteKit with `adapter-static` (SPA fallback, `ssr = false`): a plain static
build that any HTTPS host serves and Capacitor can wrap unchanged. Svelte 5
runes for the few bits of UI state; domain logic in plain TS modules, unit-tested
with Vitest.

Rejected: vanilla TS (more hand-rolled UI state), React Native/Expo first
(loses the "open a link and shoot" PWA).

## D6 — Camera UX · 2026-09-23

- **Tunnel viewfinder**: small, vignetted, no live film look.
- **Thumbwheel, ~3 flicks** (`WIND_CLICKS`) with ratchet haptics/sound; shutter
  locked until wound.
- **Big on-screen shutter** (tap-anywhere rejected: accidental shots are too
  costly with 27 frames).
- **27 exposures, one roll at a time.**

## D7 — Reveal: export only · 2026-09-23

When the roll is ready, the user collects it as an archive (share sheet /
download). No in-app viewing, no contact sheet in the app; the local frames are
wiped after collection. Rejected: envelope + in-app contact-sheet reveal.

## D8 — Develop wait: random 1–3 days · 2026-09-23

Drawn uniformly in [24 h, 72 h] at drop-off; the exact time is not shown.

## D9 — Extras: flash switch, orange date stamp, light leaks · 2026-09-23

In: flash on/off slider, always-on orange date imprint, light leaks on the first
and last frame. Out: selfie camera.

## D10 — FR + EN from day one · 2026-09-23

Language follows the browser (first supported of `navigator.languages`), no
picker. Strings in [`src/lib/i18n.ts`](../src/lib/i18n.ts).

## D11 — License: AGPL-3.0 · 2026-09-23

Open code; any fork, including one run as a hosted service (a cloned lab
backend), must stay open.

## D12 — Hosting: self-hosted static site · 2026-09-23

The `build/` output is served from one of our own boxes over HTTPS. See
[DEPLOY.md](DEPLOY.md).

## D13 — Display name without accent: Retroviseur · 2026-09-23

Supersedes the display-name half of D1: the app is **Retroviseur** everywhere
(stores, home screen, repo), no *é*. Simpler to type, search and share
internationally; the *rétro + viseur* pun still reads.

## D14 — One roll in the camera, one at the lab · 2026-09-23

Answers Q3. After dropping a roll off, a new one can be loaded right away.
At most **one roll in the camera** (loaded/full) and **one at the lab**
(developing/ready): a second full roll waits in the camera until the first has
been collected. Rules in [`src/lib/roll/rules.ts`](../src/lib/roll/rules.ts).

## D15 — Flash hidden on iOS until the native app · 2026-09-23

Answers Q2. The browser can't reliably drive the torch on iOS, so the flash
switch is not shown there ([`src/lib/platform.ts`](../src/lib/platform.ts)).
It comes back with the Capacitor app and the native flash. No simulated flash
look on iOS in the meantime.

## D16 — "Ready" is noticed on open (no push) · 2026-09-23

Answers Q6. With the local lab, the app checks whether the roll is ready when
it is opened; no push server. Real notifications arrive with the native app
(local notifications), which is planned soon.

## D17 — Hosting: a Node VM on Rachael · 2026-09-23

Refines D12 / answers Q1: the PWA will be served from a dedicated VM on
Rachael, set up by Thomas; deployment details to follow. Until then, the app
is validated from the laptop over the LAN (`npm run preview:lan`, DEPLOY.md).

## D18 — Node 24 LTS · 2026-09-23

Tooling pinned to the active LTS line (`.nvmrc` = 24, `engines.node >= 24`).

## D19 — Served from gaff at retroviseur.37m.gr · 2026-09-23

Implements D17. Until a dedicated domain exists, the PWA lives at
**https://retroviseur.37m.gr**: kxkm-prod (TLS) → holden (nginx vhost) → gaff
(VM on Rachael, pm2, port 3001). A zero-dependency Node static server rather
than nginx on gaff, since gaff hosts Node apps and has no local nginx.
Details in [DEPLOY.md](DEPLOY.md).

## D20 — Capture: 3:2, ≤ 3000 px, JPEG 0.9 (provisional) · 2026-09-23

Phase 1 default pending Q7: centre-crop to 3:2 in the frame's own orientation,
long side capped at 3000 px (~6 MP, ~1–3 MB per frame, well under 100 MB per
roll). Constants in `config.ts`.

## D21 — A frame is only "taken" once it is stored · 2026-09-23

The shutter consumes the wound film only after the sealed frame and the new
counter have committed together. If capture or storage fails, the counter does
not move and the film stays wound — the user sees a short notice, not a lost
frame.

## D22 — iOS: install gate, skippable · 2026-09-23

On iOS in a Safari tab, the first screen asks to add the app to the Home Screen
(Safari may evict a tab's storage after ~7 days unused; installed PWAs are
exempt). A small "continue in Safari anyway" link keeps testing possible.

## D23 — Install gate on Android too · 2026-09-23

Extends D22 after Thomas's first phone test. On Android the gate offers Chrome's
own install prompt (`beforeinstallprompt`, captured at module load in
`src/lib/install.svelte.ts`) or, when the browser doesn't offer it, the
"⋮ → Add to Home screen" instructions. Still skippable.

## D24 — Camera layout: top bar, thumb corner, free rotation · 2026-09-23

Supersedes the portrait lock. Header band (app name in VT323 — the waverz.net
font — on a plain orange band, About + Share buttons). Below it, portrait:
counter top-left, horizontal wheel top-right, finder, flash switch bottom-left,
shutter bottom-right; landscape: finder in the middle, wheel top-right and
shutter bottom-right, both under the right thumb. The screen may rotate, so the
camera stream (and the saved frame) follows the phone's orientation. On wide
screens the app sits in a phone-sized frame. Everything fits the viewport: no
scrolling on a small phone (checked at 320×569).

## D25 — Winding and shutter feedback · 2026-09-23

The wheel turns leftward and ticks continuously while it moves (one tick every
7 px), a notch per counted flick, a heavier lock on the third. A wound camera
**stays wound across reloads** (`roll.wound`), like a real one. After a shot the
finder blacks out ~450 ms and the counter rolls to its new value with a glow.
Haptics are ≥ 20 ms pulses (cheap motors ignore shorter ones).

## D26 — Collect = zip, then a confirmed wipe · 2026-09-23

Provisionally answers Q4/Q5: the archive is built at collection, JPEGs only
(`retroviseur-YYYY-MM-DD/01.jpg…`, stored uncompressed), handed to the share
sheet or downloaded. The roll is removed from the phone only after the user
confirms they saved it — a download can't be verified, and losing a roll is the
worst bug.

## D27 — Hidden developer mode · 2026-09-23

Seven taps on the frame counter. A collapsible panel to view the sealed frames,
fill a roll to its last frame, skip the lab wait, test vibration and wipe all
data. It breaks the product rules on purpose, is English-only, and is never
advertised.

## D28 — Layout v3: one control deck, finder first · 2026-09-23

Supersedes the placement half of D24 after the Jelly Star test (controls cropped
on the right, tiny finder, the horizontal wheel fighting Android's edge-swipe
"back"). The **viewfinder takes all the space the controls don't need** (55–63 %
of a phone screen). All controls sit in **one deck** — bottom row in portrait
(counter + flash left; wheel + shutter right), right-hand column in landscape
(shutter bottom-right). The wheel is **vertical again (flick up)** and sits next
to the shutter, never on a screen edge. Sizes derive from the device (`cq*`
units, `clamp`) instead of `rem` alone, and the template's `text-scale` meta is
gone, so the phone's font-size setting can't push controls off-screen. Header
slimmed. **Android back** closes the open sheet / dev viewer / dev panel before
it can leave the app (`src/lib/back.ts`). Checked on 9 viewports × 2 font scales
(280×560 → 915×412, 100 % / 125 %): nothing outside the screen.

## D29 — 90s film-box palette · 2026-09-23

Replaces the orange: **Fujifilm green** header band, **Kodak yellow** wordmark,
buttons and armed ring, a thin **red stripe** under the band, a **cream frame
counter window** with black digits (like a real disposable). The icon follows.
Tokens in `src/routes/+layout.svelte`.

## D30 — Pixel-art app icon · 2026-09-23

Thomas picked variant C of three pixel-art proposals: a disposable camera on a
32×32 grid — Fujifilm-green body, Kodak yellow/red band, black outline on a
charcoal ground (so the outline reads), art inside the maskable safe zone.
Generated by `scripts/icons.mjs` (SVG with crisp edges + 32/180/192/512 PNGs).

## D31 — A landscape camera on a portrait screen · 2026-09-23

Supersedes the deck placement of D28 (Thomas). The screen stays **portrait-locked**
(manifest `orientation: portrait`) and the header stays on top, but the camera is
designed as a **landscape** body, held with the phone turned a quarter-turn
anticlockwise: then the header reads vertically on the left; along the top edge
sit the counter + flash (left) and the wheel + shutter (right — shutter top-right
under the index finger, like a real camera); the 3:2 finder is centred below.
Implementation: a `.stage` laid out in landscape and, when the space under the
header is portrait, sized with swapped width/height and rotated 90° clockwise.
Consequences:
- the counter reads at 90° when the phone is upright, and upright when held sideways;
- the finder `<video>` is counter-rotated −90° so it stays a window onto the scene;
- saved frames are rotated −90° at capture (the sensor's "up" is the screen's right);
- the wheel is horizontal again in stage terms ("roll it left"), which on the upright
  screen is a vertical swipe mid-screen — clear of Android's edge-swipe back;
- if the browser rotates the page anyway (tab with auto-rotate), the stage is shown
  unrotated and nothing is rotated at capture.
Trade-off: the finder is ~42 % of a small phone's screen (33 % on tall phones),
down from 55–63 % in D28 — the price of tools across the top of a landscape body.
Header colours swapped: Kodak-yellow band, Fujifilm-green lettering.

## D32 — Aligned tools row, dark striped header · 2026-09-23

- The tools row and the finder share one width: the counter starts at the finder's
  left edge, the wheel (now larger, ~2.6× the shutter) ends at its right edge, and
  the shutter hangs just past it.
- Header, Thomas's proposal: a **Fujifilm-green line on top, a dark band with
  Kodak-yellow lettering, a red line at the bottom**. Green-on-yellow and
  yellow-on-green were both ~3.4:1 contrast; yellow on the dark band is ~11:1.
  Bigger lettering and more padding.

## D33 — Shutter blackout is a blink · 2026-09-23

Supersedes the ~450 ms minimum of D25 (Thomas: "too long"). The finder blinks
dark for 150 ms (+120 ms fade) when the shutter fires, whatever capture takes;
capture and storage carry on behind it with the shutter locked, and the counter
roll marks the moment the frame is stored.

## D34 — Blackout until the counter rolls; equal breathing room · 2026-09-23

- Supersedes D33: a 150 ms blink left the live view visibly frozen while
  `takePhoto` ran. The finder now stays dark from the shutter until the frame is
  stored and the counter rolls, with 150 ms as the minimum. The dev panel shows
  the last shot's method, source size and capture/store timings, so we can judge
  on the real phone whether grabbing the video frame instead (no freeze, but
  stream resolution) is worth it.
- Held sideways, the counter/flash/wheel/finder block sits as far from the header
  as it is from the shutter (`--side`); the shutter keeps its place.
- Taller header (more padding, same lettering).

## D35 — A flash switch that really fires; frame and header polish · 2026-09-23

- Supersedes D15. Until now the switch only recorded "flash on" in the frame's
  metadata. It now fires: `takePhoto({ fillLightMode: 'flash' })` where the
  camera reports it, otherwise the torch is lit around the capture. The switch is
  shown **only when the opened camera reports a flash or a torch** — hidden
  anywhere else (iOS included) instead of a switch that does nothing. The dev
  panel reports what the device exposes (fill-light modes, torch, vibrate,
  browser, installed or tab).
- Held sideways, header → block, block → shutter and shutter → edge are equal:
  the shutter sits centred in the free space on the right.
- Header: same black as the camera body, green line on top; RETROVISEUR centred
  between the band's left edge and the first button, slanted (VT323 has no
  italic — the browser obliques it). The header's red bottom line continues
  around the camera area (sides and bottom).

## D36 — Torch-lit video frame for flash shots; hairline frame · 2026-09-23

- On the Jelly Star the flash fired late: with `takePhoto` the flash timing belongs
  to the phone's camera software. Where a torch exists, a flash shot is now: torch
  on → 450 ms for exposure → the next rendered video frame → torch off. The light
  is on at the exact moment of the shot; the cost is that flash shots have the
  live-video resolution (the dev panel's "last shot" shows it). `takePhoto` with
  `fillLightMode: 'flash'` remains only for cameras with a flash but no torch.
- The red line around the camera area is a 1 px hairline; the header keeps its
  thicker red bottom line.

## D37 — Header stripes swapped, red hairline frame · 2026-09-23

Thick red line on top of the header, thick Fujifilm-green line under it; a 1 px red
hairline frames the whole screen — header sides included — joining the red top line.

## D38 — A camera-body shell instead of the red frame · 2026-09-23

Supersedes D37 (Thomas: the red frame was visually too hard). The header keeps only
its own lines — Fujifilm green on top, red at the bottom. The camera area gets a
discreet grey shell drawn in stage (landscape) terms: a thin edge along the top and
bottom, open towards the header, and a larger rounded grip at the right end behind
the shutter with a faint leatherette grain — the ergonomic right hand of a compact.
Upright on screen: thin edges down both sides, the grip at the bottom.

## D39 — One camera body: the header is its left end · 2026-09-23

Refines D38 (Thomas: the header felt on top of the camera, not part of it). A single
grey shell with a slim black margin now wraps the whole screen. Held sideways its
left end — tighter corners — carries the header, sitting on the body plate like a
painted label (green along the body's edge, red as the seam to the rest), and its
right end is the rounded grip behind the shutter. The header has no band of its
own any more.

## D40 — The film look, on the GPU at capture · 2026-09-23

Phase 2. Every frame is developed by a WebGL2 pipeline (soft copy + one develop
pass: softness, halation, tone-curve LUT, split toning, saturation, vignette,
light leak, date stamp, grain) after crop/rotation and before sealing — details
in FILM-LOOK.md. Curves in display space; grain on an integer hash; the date
stamp is `'26 9 23` for now (Q8). No WebGL2 → undeveloped frame, reported in the
dev panel. The simulated flash look planned in FILM-LOOK is dropped: the flash
is real. `/bench` lets Thomas compare Superia 400 and C200 on his own photos,
tune them and export the numbers; the pick of `FILM_STOCK` stays his (#t-004).

## D41 — Superia 400 it is; a smaller European date stamp · 2026-09-23

Thomas's pick (closes D4 / #t-004): **Fujicolor Superia 400** is the film, with
the starting parameters as they are. C200 stays in `stocks.ts` for the bench.
The date imprint (answers Q8) is European, year last — `23 9 '26` — and smaller:
digits ~2.6 % of the frame's short side tall (was 4.5 %), squatter (width 0.68 × height).

## D42 — Date stamp blends into the picture · 2026-09-23

The imprint is screened in at 65 % (`STAMP_OPACITY`), so the picture shows through
the digits and their glow, closer to a real imprint on the emulsion.

## D43 — Softer, smaller imprint · 2026-09-23

Refines D41/D42 (Thomas: blend more, a bit smaller, more glow/blur). Opacity 50 %,
digits ~2.1 % of the short side tall, a wider halo (two passes) and the digits
themselves slightly blurred — light exposed into the emulsion, not ink on top.

## D44 — The lab: encrypted upload + a lab ticket, no email · 2026-09-23

Replaces the "email lab" (D2's second step). The phone uploads the roll already
encrypted to a small service on gaff; the key travels only in a **lab ticket**
link (key after the `#`, never sent to the server) that the user hands to
themselves or a friend through the share sheet ("this is your lab ticket, don't
lose it — ready between Thu 25 and Sat 27"). The server draws the ready time
(1–3 days), refuses pickup before it, destroys the roll 1 h after a complete
pickup or 30 days after ready. The app keeps a backup ticket and shows "the lab
called" a week before destruction (a phone-scheduled notification comes with the
Android app — no server push). No emails, no accounts, no addresses, no
proof-of-work for now; abuse is held by roll-shaped uploads, the time-lock, one
pickup, expiry, a global cap and an in-memory per-IP limit. Access logs off for
this host (holden; kxkm-prod block prepared for Thomas). Full spec:
[LAB.md](LAB.md).

## D45 — The lab, as built · 2026-09-23

Built per LAB.md with two corrections to the spec that would have leaked the
secret ready time: it is drawn at creation (not commit — an upload takes
minutes), and `expiresAt` is only reported once the roll is ready. Hand-off also
accepts "I saved it somewhere else" when neither share nor clipboard works. The
hosting contact on the About page is the GitHub issues page until Thomas gives
one (Q11). Verified end to end against the production server with a 15 s test
wait: upload, ticket, phone left with no frames and no key, server files without
the key, developing → ready → collect, 27-frame zip, app sees the pickup.

## D46 — Protect without watching: limits + log-on-block · 2026-09-23

Thomas: with no access log at all, how do we fend off trouble? The gateway had no
automatic protection reading access logs (fail2ban only guarded sshd), but this host
had no rate limit either — and kxkm-prod is shared with Seafile. Now, on kxkm-prod
for retroviseur.37m.gr: per-client request and connection limits kept in memory
(30 r/s, 5 r/s on the lab API, 20 connections), `429` beyond; only rejected requests
are logged with their address (`retroviseur-blocked.log`), and fail2ban (jail
`retroviseur`) bans repeat offenders from 80/443 for an hour. Ordinary visits are
still not logged. The promise becomes: "visits are not logged; an address is only
recorded when it is blocked for abuse." Volumetric DDoS stays out of scope (only an
upstream shield would help, at the cost of a third party in the path).

## D47 — Fullscreen when installed · 2026-09-23

The installed app asks for `display: fullscreen` (with `display_override:
["fullscreen", "standalone"]`): Android hides its status and navigation bars; where
fullscreen isn't supported (iOS, some browsers) it falls back to standalone.
"Installed" now means display-mode fullscreen **or** standalone, so the install gate
doesn't reappear. Safe-area insets were already honoured (`viewport-fit=cover`).
Existing installs pick the change up when reinstalled (or when Chrome refreshes its
WebAPK).

## D48 — Installing never drops you into the browser app · 2026-09-23

Thomas: after tapping Install, the page went on into the web app in the browser —
confusing, people start shooting there. Now the install screen stays until the
install is done ("Installing…" → "Installed — open it from your Home Screen, you
can close this tab"), or shows "didn't go through — try again". The browser app is
only reachable through an explicit, remembered choice ("Use it in the browser
instead", on the welcome screen or after a failed install); the About sheet offers
"Install the app" to change one's mind.

## D49 — "Installed" only when it really is · 2026-09-23

Watched on Thomas's Jelly Star over adb: Chrome builds the app on Google's servers
and hands it to the **Play Store's install queue**, which runs it after pending app
updates (about 20 that evening) — minutes of waiting, during which Chrome already
fires `appinstalled` and its "Installing…" notification can be dismissed; every
retry queued another app, so several could land later. The page now says Android
is finishing through the Play Store and not to tap Install again, and declares
itself in `related_applications` so `getInstalledRelatedApps` can confirm the real
install (polled every 5 s) before showing "Installed"; a later visit in the browser
sees the installed app instead of an Install offer.

## D50 — First-launch explanation · 2026-09-23

Four cards before the first roll — a disposable camera (27, no preview, no delete) →
hold it sideways → wind, then shoot → take it to the lab (1–3 days, keep the
ticket) — with small line drawings in the camera's palette, swipe or Next, Skip.
Shown once (`retroviseur-intro-seen`), and again from About → "How it works".

## D51 — Storage safety · 2026-09-23

A roll is only loaded when about 108 MB are free (27 × a 4 MB per-frame budget); a
frame is only shot when 4 MB are free — the film stays wound, nothing is lost. A
quota error while storing says "this phone is full — that frame was not taken"
instead of the generic failure. Where the browser won't estimate, nothing blocks.

## D52 — "A new version is ready" · 2026-09-23

When a new build's service worker takes over an open page, a bar offers "tap to
reload" — never an automatic reload mid-shot or mid-upload. An app left open checks
for updates when it comes back to the foreground and every 30 minutes.

## D53 — Extras with the prints (answers Q4) · 2026-09-23

Every zip — lab pickup page and dev lab — holds the frames plus `contact-sheet.jpg`
(all prints numbered like film edge marks, flash marked, film and date in the
header) and `roll.json` (app version, film, load date, per-frame time and flash).

## D54 — The wheel rolls the other way · 2026-09-24

Thomas: invert the winding direction. Held sideways the wheel now rolls to the
right (on the upright screen, a swipe down, still mid-screen and clear of Android's
edge gestures); the ribs follow the thumb. Intro card, About text and product doc
follow.

## D55 — A "close" button that puts the lens cap on · 2026-09-24

A power button after About and Share. A web page may not close itself unless a
script opened it, so it tries `window.close()` and otherwise puts the lens cap on:
camera off (no battery, no camera light), a "Camera closed — tap to open" screen
that suggests swiping the app away to leave. The Android app will truly exit.

## D56 — A home of its own: retroviseur.waverz.net (answers Q9) · 2026-09-26

Thomas: the app moves to **https://retroviseur.waverz.net**; `camera.waverz.net` is a
second door (a DNS CNAME that kxkm-prod 301s to the main name: one origin, so rolls
never split between two storages). TLS is a `*.waverz.net` wildcard from acme.sh on
kxkm-prod (DNS-01, Infomaniak — the same token as `*.kxkm.net`). Same privacy as
before: no access log, per-client limits, fail2ban.

The old address can't simply 301 on day one: rolls live in the browser's storage,
which belongs to one origin, so a tester mid-roll would find an empty camera at the
new address. **Soft move** instead (Thomas): on `retroviseur.37m.gr` the app sends
anyone on at once *unless* that phone holds something only its storage has — frames
on a roll, or a drop-off whose ticket isn't handed over yet (`src/lib/move.ts`).
Those see "Retroviseur has moved — finish this roll here, take it to the lab, then
carry on (and install again) at the new address"; the next open after the hand-off
sends them on. Ticket links and the share button always carry the new address; old
tickets keep working (the pickup page moves on with its `#key`). **Around
2026-10-10** the old name becomes a plain 301 on kxkm-prod (docs/DEPLOY.md).

## D57 — The Android app: decisions (ANDROID.md) · 2026-09-26

Thomas, on the six pending points: (1) two steps — v1 keeps the web camera and adds
native haptics, notifications, fullscreen; v2 brings a native camera; (2) a signed
APK first, sideloaded, stores later; (3) app id **`net.waverz.retroviseur`**; (4) the
signing key is backed up in the password manager **and** the hub's `secrets/`;
(5) ticket links open the app (Android App Links) — the app must then route an
incoming `/lab/<id>#key` to its own pickup page; (6) JDK 21 + Android platform 36
installed user-level on the laptop.

## D58 — Print-ready frames: 4096 px, ~11 MP (answers Q7) · 2026-09-26

Thomas: the prints end up on real photo paper through a pro lab, so take the best
the camera gives. Frames stay 3:2 but the long side goes from 3000 to **4096 px**
(4096 × 2731, ~11 MP): at 300 dpi that prints up to ~23 × 35 cm, far past the
10 × 15 of a disposable. Not "full sensor": 48–50 MP phone sensors bin down to
~12 MP of real detail, grain and the soft disposable look set the detail anyway,
and a frame larger than the GPU's texture limit silently skips the film look —
4096 is safe on every phone. Measured on real 12 MP photos, developed at q 0.9:
3.3–3.7 MB per frame. Limits follow with headroom: lab 8 MB per frame and 200 MB
per roll, nginx 9 MB bodies on both hops, on-phone budget 6 MB per frame
(~162 MB free to load a roll).

## D59 — Hosting contact: contact@waverz.net (answers Q11) · 2026-09-26

The About page's hosting contact (LCEN) is **contact@waverz.net**, replacing the
GitHub issues page that stood in. Takedown reports go there (docs/LAB.md).

## D60 — Android app v1, as built · 2026-09-26

The v1 of D57 exists: Capacitor 8 around the same build (`ANDROID=1`, own folder,
no service worker), native haptics, share sheet, exit, on-phone notifications for
"ready" and "the lab called", App Links for tickets, immersive portrait shell,
backups off. The app calls the lab cross-origin from `https://localhost`, so the
lab allows exactly that origin (CORS). Signed APK served from
`/android/retroviseur.apk` with a `version.json` the app checks. Details in
docs/ANDROID.md.

## D61 — The native camera (Android v2) · 2026-09-26

Thomas: go v2. Our own small CameraX plugin rather than a community one (those
pull in barcode scanning and Play-services models): a preview behind the
transparent page, placed under the finder, and full-resolution stills with the
real, pre-metered flash. The camera body, finder vignette and blackout stay web;
frames still go capture → film look → seal → storage, the unsealed file living
only until the page has read it. Details in docs/ANDROID.md.

---

## Open questions

- ~~Q1 — Which box / domain~~ → D17 (VM on Rachael; domain still to set).
- ~~Q2 — Flash on iOS~~ → D15.
- ~~Q3 — Next roll while developing?~~ → D14.
- ~~Q4 — Archive contents~~ → frames + contact sheet + roll.json (D53).
- ~~Q5 — Archive timing~~ → built at collection (D26).
- ~~Q6 — Ready notification~~ → D16.
- ~~Q7 — Capture resolution/aspect~~ → 3:2 at 4096 px, ~11 MP (D58).
- ~~Q8 — Date stamp format~~ → `23 9 '26` (D41).
- ~~Q11 — Hosting contact~~ → contact@waverz.net (D59).
- **Q10 — Chrome install fails on the Jelly Star** (Brave installs); symptoms to collect.
- ~~Q9 — Dedicated domain~~ → retroviseur.waverz.net (D56).
