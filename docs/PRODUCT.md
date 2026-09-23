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

Every screen sits under a **header band**: a Fujifilm-green line, RETROVISEUR in VT323
Kodak yellow on a dark band, a red line under it, **?** (About) and **Share** (share
sheet, or copy the link). On a wide screen the app is framed as a phone.
Android's back gesture closes sheets and overlays first, never the app by
accident.

0. **First launch** — four cards: a disposable camera → hold it sideways → wind,
   then shoot → take it to the lab (D50); replayable from About.
1. **Install gate** (iOS and Android browsers) — add to Home Screen first
   (Android: the Install button), skippable.
2. **Camera body** — the only real screen (D31): a **landscape camera on a
   portrait-locked screen**. Hold the phone a quarter-turn anticlockwise:
   header down the left side; along the top, the frame counter (cream window,
   counts *down*, rolls on each shot) and the flash switch on the left, the
   horizontal **thumbwheel** and the **shutter** on the right (top-right, under
   the index finger); the 3:2 tunnel finder centred below. Held upright, the
   same body appears turned: tools in a column on the right, counter at 90°.
   - Flash: a switch with a bolt icon — hidden on iOS until the native app (D15).
3. **Roll finished** — "take it to the lab" (drop-off).
4. **At the lab** — a quiet line at the bottom; no countdown, no date. The next
   roll can be loaded meanwhile (D14). Checked each time the app opens (D16).
5. **Prints ready** — "collect them" opens a sheet: save the roll (.zip via
   the share sheet or a download), then confirm to clear it from the phone (D26).

## Gestures

### Thumbwheel (film advance)

- Horizontal ribbed wheel beside the shutter. With the phone held sideways,
  **roll it to the left** with the thumb (on the upright screen that is a swipe
  up, mid-screen — never Android's edge-swipe "back").
- While it turns it **ticks continuously** (a ratchet tooth every 7 px).
- A quick flick counts as one **notch**; ~3 notches (`WIND_CLICKS`) and it
  **locks** with a heavier thunk + a strong haptic, outlined in orange.
  Further pushes barely move it (blocked, as on a real camera).
- The wound state is kept across reloads (D25).
- Shutter is disabled until the wheel is locked; firing unlocks it again.

### Shutter

Press-and-release with a mechanical *clack*, the finder blacks out ~450 ms,
the counter rolls down with a glow, and a haptic pulse. Pressing it unwound =
dry, dull click, nothing happens.

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
