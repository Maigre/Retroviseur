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

---

## Open questions

- ~~Q1 — Which box / domain~~ → D17 (VM on Rachael; domain still to set).
- ~~Q2 — Flash on iOS~~ → D15.
- ~~Q3 — Next roll while developing?~~ → D14.
- **Q4 — Archive contents**: JPEGs only for now (D26); add a contact sheet or
  a `roll.json`?
- ~~Q5 — Archive timing~~ → built at collection (D26).
- ~~Q6 — Ready notification~~ → D16.
- **Q7 — Capture resolution/aspect**: 3:2 like 35 mm (crop from the 4:3
  sensor) at ~12 MP, or smaller to keep a roll light (~27 × 3 MB)?
- **Q8 — Date stamp format**: `'26 9 23` (classic Japanese compact) or `23 9 '26`?
- **Q9 — Dedicated domain** (retroviseur.37m.gr meanwhile, D19).
