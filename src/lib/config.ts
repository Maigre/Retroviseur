/**
 * Developer-fixed constants. None of these are exposed to the user:
 * Retroviseur is a disposable camera, not a settings screen.
 * See docs/DECISIONS.md for why each value is what it is.
 */
import type { FilmStockId } from './film/stocks';

/** Exposures per roll. One roll at a time. */
export const EXPOSURES = 27;

/** Thumbwheel flicks needed to advance the film to the next frame. */
export const WIND_CLICKS = 3;

/** Developing wait, drawn uniformly at random when the roll is dropped off. */
export const DEVELOP_MIN_HOURS = 24;
export const DEVELOP_MAX_HOURS = 72;

/**
 * The one film stock baked into every frame. Chosen by the developer after
 * testing (candidates: 'superia400', 'c200'); never selectable in the UI.
 */
export const FILM_STOCK: FilmStockId = 'superia400';

/** Orange date imprint on every frame (format: Q8, provisional `'26 9 23`). */
export const DATE_STAMP = true;

/** Frames fogged by light leaks at the head and tail of the roll. */
export const LEAK_HEAD_FRAMES = 1;
export const LEAK_TAIL_FRAMES = 1;

/**
 * Capture: frames are cropped to 3:2 (35 mm) and scaled so the long side is at
 * most this many pixels (~6 MP). Provisional until Q7 is settled.
 */
export const CAPTURE_MAX_LONG_SIDE = 3000;
export const JPEG_QUALITY = 0.9;

/** Thumbwheel flick: upward travel (CSS px) within a short stroke counts as one click. */
export const FLICK_MIN_PX = 22;
export const FLICK_MAX_MS = 450;

/**
 * The finder goes dark when the shutter fires and stays dark until the frame is
 * stored and the counter rolls (the live view freezes during capture anyway) —
 * but at least this long.
 */
export const SHUTTER_BLACKOUT_MS = 150;

/** Wheel travel (CSS px) between two ratchet ticks while winding. */
export const WHEEL_TICK_PX = 7;

/** Torch-as-flash: time for auto-exposure to settle once the torch is lit. */
export const TORCH_SETTLE_MS = 450;
