/**
 * The orange date imprint of a 90s compact: 7-segment digits, European order
 * with the year last — `23 9 '26` (D41).
 */
export function formatStamp(t: number | Date): string {
	const d = new Date(t);
	return `${d.getDate()} ${d.getMonth() + 1} '${String(d.getFullYear() % 100).padStart(2, '0')}`;
}

/** Segments a–g lit for each digit (a top, clockwise, g middle). */
export const SEGMENTS: Record<string, string> = {
	'0': 'abcdef',
	'1': 'bc',
	'2': 'abdeg',
	'3': 'abcdg',
	'4': 'bcfg',
	'5': 'acdfg',
	'6': 'acdefg',
	'7': 'abc',
	'8': 'abcdefg',
	'9': 'abcdfg'
};

/**
 * Draw the stamp into a transparent canvas, `height` px tall: orange segments
 * with a soft glow, the way the LED imprint bleeds into the emulsion.
 */
export function drawStamp(text: string, height: number): HTMLCanvasElement {
	const h = Math.max(8, Math.round(height));
	const w7 = h * 0.68; // digit width — squat digits, low profile (D41)
	const gap = h * 0.2;
	const th = Math.max(1.5, h * 0.11); // segment thickness
	const glyph = (ch: string) => (ch === ' ' ? w7 * 0.55 : ch === "'" ? th * 2.2 : w7);
	const pad = h * 0.7; // room for the glow on every side
	const width = Math.ceil([...text].reduce((a, ch) => a + glyph(ch) + gap, 0) - gap + pad * 2);
	const c = document.createElement('canvas');
	c.width = width;
	c.height = Math.ceil(h + pad * 2);
	const g = c.getContext('2d')!;
	g.lineCap = 'round';
	g.lineWidth = th;
	const draw = () => {
		let x = pad;
		const y0 = pad;
		const mid = y0 + h / 2;
		const bot = y0 + h;
		for (const ch of text) {
			const segs = SEGMENTS[ch];
			if (segs) {
				const l = x + th / 2;
				const r = x + w7 - th / 2;
				const lines: Record<string, [number, number, number, number]> = {
					a: [l, y0, r, y0],
					b: [r, y0, r, mid],
					c: [r, mid, r, bot],
					d: [l, bot, r, bot],
					e: [l, mid, l, bot],
					f: [l, y0, l, mid],
					g: [l, mid, r, mid]
				};
				g.beginPath();
				for (const s of segs) {
					const [x1, y1, x2, y2] = lines[s];
					// small gaps at the joints, like real segments
					const inset = th * 0.35;
					const vx = Math.sign(x2 - x1) * inset;
					const vy = Math.sign(y2 - y1) * inset;
					g.moveTo(x1 + vx, y1 + vy);
					g.lineTo(x2 - vx, y2 - vy);
				}
				g.stroke();
			} else if (ch === "'") {
				g.beginPath();
				g.moveTo(x + th, y0);
				g.lineTo(x + th * 0.6, y0 + h * 0.28);
				g.stroke();
			}
			x += glyph(ch) + gap;
		}
	};
	// wide halo first, then the digits themselves, slightly out of focus —
	// light exposed into the emulsion rather than ink on top (D43)
	g.strokeStyle = 'rgba(255, 110, 20, 0.5)';
	g.shadowColor = 'rgba(255, 90, 10, 0.95)';
	g.shadowBlur = h * 0.65;
	draw();
	draw();
	g.shadowBlur = 0;
	g.filter = `blur(${Math.max(0.5, h * 0.05)}px)`; // ignored where unsupported
	g.strokeStyle = 'rgba(255, 150, 40, 0.9)';
	draw();
	g.filter = 'none';
	return c;
}
