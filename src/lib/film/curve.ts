/**
 * Tone curves: a monotone cubic (Fritsch–Carlson) through a stock's control
 * points, baked into a 256-entry RGBA lookup table the shader samples.
 */
export type Points = [number, number][];

export function monotoneCubic(points: Points): (x: number) => number {
	const p = [...points].sort((a, b) => a[0] - b[0]);
	const n = p.length;
	if (n < 2) return () => (n ? p[0][1] : 0);
	const dx: number[] = [];
	const m: number[] = []; // secant slopes
	for (let i = 0; i < n - 1; i++) {
		dx.push(p[i + 1][0] - p[i][0]);
		m.push((p[i + 1][1] - p[i][1]) / dx[i]);
	}
	const t: number[] = [m[0]]; // tangents
	for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
	t.push(m[n - 2]);
	for (let i = 0; i < n - 1; i++) {
		if (m[i] === 0) {
			t[i] = t[i + 1] = 0;
			continue;
		}
		const a = t[i] / m[i];
		const b = t[i + 1] / m[i];
		const h = a * a + b * b;
		if (h > 9) {
			const k = 3 / Math.sqrt(h);
			t[i] = k * a * m[i];
			t[i + 1] = k * b * m[i];
		}
	}
	return (x: number) => {
		if (x <= p[0][0]) return p[0][1];
		if (x >= p[n - 1][0]) return p[n - 1][1];
		let i = 0;
		while (x > p[i + 1][0]) i++;
		const h = dx[i];
		const s = (x - p[i][0]) / h;
		const s2 = s * s;
		const s3 = s2 * s;
		return (
			(2 * s3 - 3 * s2 + 1) * p[i][1] +
			(s3 - 2 * s2 + s) * h * t[i] +
			(-2 * s3 + 3 * s2) * p[i + 1][1] +
			(s3 - s2) * h * t[i + 1]
		);
	};
}

/** 256 × RGBA bytes: channel c of entry i = curve_c(i / 255). */
export function buildLut(curves: { r: Points; g: Points; b: Points }): Uint8Array {
	const [r, g, b] = [curves.r, curves.g, curves.b].map(monotoneCubic);
	const lut = new Uint8Array(256 * 4);
	for (let i = 0; i < 256; i++) {
		const x = i / 255;
		lut[i * 4] = clamp255(r(x));
		lut[i * 4 + 1] = clamp255(g(x));
		lut[i * 4 + 2] = clamp255(b(x));
		lut[i * 4 + 3] = 255;
	}
	return lut;
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
