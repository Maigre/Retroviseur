# Film look

Applied **on the phone, at capture**, as one WebGL2 pass over the full-res
frame, before JPEG encoding and sealing (D3). Never shown in the viewfinder.

## Candidates

Both live in [`src/lib/film/stocks.ts`](../src/lib/film/stocks.ts); the
developer picks one with `FILM_STOCK` in `config.ts` after bench tests (D4).

| | Superia 400 / QuickSnap | Fujicolor C200 |
|---|---|---|
| Character | the Fuji disposable: punchy, cyan-green shadows, warm skin | softer consumer stock: pastel, a bit washed out |
| Grain | visible (amount 0.09, ~1.6 px) | finer (0.06, ~1.2 px) |
| Saturation | 1.08 | 0.92 |
| Halation | 0.15 | 0.08 |

Numbers are starting points, to tune by eye against reference scans.

## Pass order

1. **Linearise** input (sRGB → linear).
2. **Flash look** (if flash on): lift the foreground, crush the background,
   harden the falloff — the "deer in headlights" disposable flash.
3. **Tone curves** per channel (monotone cubic through the control points).
4. **Split toning**: shadow tint / highlight tint.
5. **Saturation**.
6. **Halation**: blur of the brightest areas, tinted red-orange, added back.
7. **Plastic lens**: radial softness (blur mixed by distance from centre) + vignette.
8. **Grain**: luminance-dependent noise (strongest in mid-tones), seeded per
   frame, sized so it survives JPEG q ≈ 0.9.
9. **Light leak** on head/tail frames (`LEAK_HEAD_FRAMES`, `LEAK_TAIL_FRAMES`):
   warm orange-red gradient bleeding in from one edge, random shape per roll.
10. **Date stamp**: orange 7-segment digits, bottom-right, slight glow, drawn
    *before* grain so it gets grain like a real imprint.
11. **Encode** back to sRGB, crop 3:2.

## Bench method (phase 2)

A hidden `/bench` route that runs the pipeline on a set of reference photos
with both stocks side by side, so the choice in D4 is made on real images.
