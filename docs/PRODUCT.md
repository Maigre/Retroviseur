# Product

## Pitch

Phones made photography infinite, instant and editable. Retroviseur takes all
three away on purpose: a **finite roll**, **no instant feedback**, **no second
chance**. What you get back is the feeling of opening an envelope of prints.

## Principles

- **A disposable, not a camera app.** If a real disposable doesn't have it, we
  probably don't either.
- **Zero configuration exposed.** Roll length, film stock, develop time are
  developer constants ([`src/lib/config.ts`](../src/lib/config.ts)).
- **Tactile over visual.** Gestures, clicks, haptics and sound carry the UI;
  text is minimal (FR + EN).
- **The roll is sacred.** Losing a roll is the worst possible bug — storage
  durability beats every other concern.

## The "no" list

| No… | Because |
|---|---|
| preview after a shot | the surprise is the product |
| delete / retake | every frame counts, including the bad ones |
| gallery on the phone | the photos live at the lab, then in the archive — not in the app |
| stock / ISO / filter picker | one film, chosen by us |
| live film look in the finder | it would spoil the reveal |
| more than two rolls | one in the camera, one at the lab — that's it |
| selfie camera | a disposable only looks one way |

## Flow

```
 ┌─────────┐ wind+shoot ×27 ┌──────┐ drop off ┌────────────┐ 1–3 days ┌───────┐ collect ┌───────────┐
 │ loaded  │───────────────▶│ full │─────────▶│ developing │─────────▶│ ready │────────▶│ collected │
 └─────────┘                └──────┘          └────────────┘          └───────┘         └───────────┘
      ▲                                                                                        │
      └──────────────────────────── load a new roll ◀──────────────────────────────────────────┘
```

Two rolls at most (D14): one **in the camera** (loaded or full) and one **at
the lab** (developing or ready). As soon as a roll is dropped off, a new one can
be loaded; if that one fills up before the first comes back, it waits in the
camera until the first has been collected.

## Screens

1. **Camera body** — the only real screen.
   - Frame counter (orange digits in a black window, counts *down*).
   - Small **tunnel viewfinder** in the middle: live but small, vignetted,
     slightly soft — like a plastic optical finder. No film look.
   - **Thumbwheel** on the right edge.
   - **Shutter** button: big, stiff, disabled until the film is wound.
   - **Flash slider** (on/off), like on a QuickSnap — hidden on iOS until the native app (D15).
2. **Roll finished** — "take it to the lab" (drop-off action).
3. **Developing** — an envelope/lab-bag state; no countdown, no date. Checked
   each time the app opens (D16). Meanwhile the next roll can be loaded.
4. **Ready** — "your prints are ready" → collect.
5. **Collected** — the archive is handed off (share sheet / download); load a new roll.

## Gestures

### Thumbwheel (film advance)

- Ribbed wheel on the right edge, under the right thumb.
- **Flick upward ~3 times** (`WIND_CLICKS`). Each flick = one ratchet *click*:
  a short tick sound + light haptic; the wheel texture scrolls with the finger.
- The last click **locks** with a heavier thunk + stronger haptic; the counter
  ticks down by one. Further flicks do nothing (the wheel is blocked, as on a
  real camera).
- Shutter is disabled until the wheel is locked; firing unlocks it again.

### Shutter

Press-and-release with a mechanical *clack*, a brief finder blackout, and a
haptic. Pressing it unwound = dry, dull click, nothing happens.

### Flash

Two-position slider driving the real torch (Android). Hidden on iOS until the
native app (D15).

## What the frames look like

On-device Fujifilm look baked in at capture: grain, colour curves, plastic-lens
vignette/softness, halation, plus the **orange date stamp** and **light leaks**
on the first and last frame. Details in [FILM-LOOK.md](FILM-LOOK.md).

## Prior art (and how we differ)

- **Gudak Cam** — 24 shots, tiny finder, 3-day wait, then photos appear in-app.
- **Dispo** — photos "develop" at 9 a.m. next day, social feed.
- **Huji Cam** — the look, without the constraint.

Retroviseur's difference: the **roll** is the unit — it leaves the phone as a
sealed whole, goes to a *lab* (local time-lock today, email or a real lab
tomorrow), and comes back as an archive, never as a feed.
