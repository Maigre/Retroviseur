/**
 * Film looks, applied on the phone at capture time (WebGL, see
 * docs/FILM-LOOK.md). Both candidates ship in code so they can be A/B'd on
 * the bench; `FILM_STOCK` in config.ts picks the one users get.
 *
 * Values are starting points to tune by eye against reference scans.
 */
export type FilmStockId = 'superia400' | 'c200';

export interface FilmStock {
	id: FilmStockId;
	label: string;
	/** Per-channel tone curves as [input, output] control points in 0..1. */
	curves: { r: [number, number][]; g: [number, number][]; b: [number, number][] };
	/** Tint pushed into shadows / highlights (linear RGB offsets). */
	shadowTint: [number, number, number];
	highlightTint: [number, number, number];
	saturation: number;
	/** Grain: amplitude (0..1) and size in output pixels at 12 MP. */
	grain: { amount: number; size: number };
	/** Plastic lens: corner darkening and edge softness (0..1). */
	vignette: number;
	softness: number;
	/** Red glow bleeding around highlights. */
	halation: number;
}

export const STOCKS: Record<FilmStockId, FilmStock> = {
	superia400: {
		id: 'superia400',
		label: 'Fujicolor Superia 400 (QuickSnap)',
		curves: {
			r: [[0, 0.02], [0.25, 0.23], [0.75, 0.8], [1, 0.98]],
			g: [[0, 0.04], [0.25, 0.26], [0.75, 0.78], [1, 0.97]],
			b: [[0, 0.05], [0.25, 0.25], [0.75, 0.74], [1, 0.93]]
		},
		shadowTint: [-0.01, 0.02, 0.015],
		highlightTint: [0.02, 0.01, -0.01],
		saturation: 1.08,
		grain: { amount: 0.09, size: 1.6 },
		vignette: 0.35,
		softness: 0.25,
		halation: 0.15
	},
	c200: {
		id: 'c200',
		label: 'Fujicolor C200',
		curves: {
			r: [[0, 0.05], [0.25, 0.27], [0.75, 0.78], [1, 0.96]],
			g: [[0, 0.06], [0.25, 0.28], [0.75, 0.78], [1, 0.96]],
			b: [[0, 0.07], [0.25, 0.28], [0.75, 0.75], [1, 0.94]]
		},
		shadowTint: [0, 0.01, 0.02],
		highlightTint: [0.015, 0.01, 0],
		saturation: 0.92,
		grain: { amount: 0.06, size: 1.2 },
		vignette: 0.3,
		softness: 0.2,
		halation: 0.08
	}
};
