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

---

## Open questions

- ~~Q1 — Which box / domain~~ → D17 (VM on Rachael; domain still to set).
- ~~Q2 — Flash on iOS~~ → D15.
- ~~Q3 — Next roll while developing?~~ → D14.
- **Q4 — Archive contents**: JPEGs only, or JPEGs + a contact-sheet image +
  a small `roll.json` (dates, stock, frame order)?
- **Q5 — Archive timing (local lab)**: is the .zip built at drop-off (sealed
  archive sitting on the phone) or at collection?
- ~~Q6 — Ready notification~~ → D16.
- **Q7 — Capture resolution/aspect**: 3:2 like 35 mm (crop from the 4:3
  sensor) at ~12 MP, or smaller to keep a roll light (~27 × 3 MB)?
- **Q8 — Date stamp format**: `'26 9 23` (classic Japanese compact) or `23 9 '26`?
- **Q9 — Dedicated domain** (retroviseur.37m.gr meanwhile, D19).
