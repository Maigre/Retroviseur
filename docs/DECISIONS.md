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

---

## Open questions

- **Q1 — Which box / domain** serves the PWA? (D12)
- **Q2 — Flash on iOS**: the torch control in the browser is unreliable there;
  is a simulated flash look acceptable, or should the switch hide on iOS?
- **Q3 — Next roll while developing?** D6 says one roll at a time; strictly,
  that blocks shooting for 1–3 days after drop-off. Alternative: one roll *in
  the camera* + one *at the lab*.
- **Q4 — Archive contents**: JPEGs only, or JPEGs + a contact-sheet image +
  a small `roll.json` (dates, stock, frame order)?
- **Q5 — Archive timing (local lab)**: is the .zip built at drop-off (sealed
  archive sitting on the phone) or at collection?
- **Q6 — Ready notification**: a PWA can't reliably wake itself up without a
  server (Web Push). Accept "you'll see it next time you open the app" for the
  local lab, or add a minimal push server early?
- **Q7 — Capture resolution/aspect**: 3:2 like 35 mm (crop from the 4:3
  sensor) at ~12 MP, or smaller to keep a roll light (~27 × 3 MB)?
- **Q8 — Date stamp format**: `'26 9 23` (classic Japanese compact) or `23 9 '26`?
