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

## How it runs (D40)

`src/lib/film/develop.ts`, WebGL2, on every frame at capture — after the 3:2
crop/rotation, before JPEG encoding and sealing:

1. **Soft copy**: the frame downscaled ¼ and blurred (separable gaussian, twice).
   Feeds both the lens softness and the halation.
2. **Develop pass** (one fragment shader), in this order:
   1. **Plastic lens softness**: mix towards the soft copy by distance from centre.
   2. **Halation**: the soft copy's highlights added back as a red-orange glow.
   3. **Tone curves**: per channel, monotone cubic through the stock's control
      points (`curve.ts`), baked into a 256-entry LUT texture. Display (sRGB)
      values — where the curves were drawn.
   4. **Split toning**: shadow tint × (1−L)², highlight tint × L².
   5. **Saturation** around luminance.
   6. **Vignette**.
   7. **Light leak** (first/last frame, `leak.ts`): warm fog screened in from
      one edge, wobbly front; edge and reach fixed per roll.
   8. **Date stamp** (`stamp.ts`): orange 7-segment `'26 9 23` with a glow,
      screened in bottom-right *before* grain, like an imprint.
   9. **Grain**: two octaves of value noise on an integer hash (pcg2d — a float
      hash left visible stripes), sized from 12 MP, strongest in the mid-tones,
      faintly coloured.
3. The canvas is encoded to JPEG q 0.9 by the caller.

No WebGL2 (or a frame bigger than the GPU's max texture) → the frame is kept
undeveloped; the dev panel says so. There is no simulated flash look: the flash
is real (D35/D36).

## Bench

`/bench` (hidden; linked from the dev panel): load your own photos — they never
leave the browser — or use the built-in test card; see original / Superia 400 /
C200 side by side, toggle the date stamp and a head/tail light leak, reseed the
grain, tune each stock with sliders, and copy its parameters as JSON into
`src/lib/film/stocks.ts`. Then set `FILM_STOCK` in `config.ts`.
