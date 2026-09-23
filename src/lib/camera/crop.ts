/**
 * Centre-crop a frame to 3:2 (long side / short side = 1.5), keeping its
 * orientation, and scale it so the long side is at most `maxLong`.
 */
export function crop3x2(w: number, h: number, maxLong: number) {
	const landscape = w >= h;
	const long = landscape ? w : h;
	const short = landscape ? h : w;
	let cl = long;
	let cs = Math.round(long / 1.5);
	if (cs > short) {
		cs = short;
		cl = Math.round(short * 1.5);
	}
	const sw = landscape ? cl : cs;
	const sh = landscape ? cs : cl;
	const scale = Math.min(1, maxLong / cl);
	return {
		sx: Math.round((w - sw) / 2),
		sy: Math.round((h - sh) / 2),
		sw,
		sh,
		dw: Math.round(sw * scale),
		dh: Math.round(sh * scale)
	};
}
