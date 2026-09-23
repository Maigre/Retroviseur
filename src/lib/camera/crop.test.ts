import { expect, it } from 'vitest';
import { crop3x2 } from './crop';

it('crops 4:3 to 3:2 and caps the long side', () => {
	expect(crop3x2(4000, 3000, 3000)).toEqual({ sx: 0, sy: 167, sw: 4000, sh: 2667, dw: 3000, dh: 2000 });
});

it('keeps portrait frames portrait', () => {
	const c = crop3x2(1080, 1920, 3000);
	expect(c.sh / c.sw).toBeCloseTo(1.5, 2);
	expect(c.dh).toBe(1620);
});

it('never upscales', () => {
	expect(crop3x2(1500, 1000, 3000)).toMatchObject({ sw: 1500, sh: 1000, dw: 1500, dh: 1000 });
});
