/**
 * Developer-fixed constants. None of these are exposed to the user:
 * Rétroviseur is a disposable camera, not a settings screen.
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

/** Frames fogged by light leaks at the head and tail of the roll. */
export const LEAK_HEAD_FRAMES = 1;
export const LEAK_TAIL_FRAMES = 1;
