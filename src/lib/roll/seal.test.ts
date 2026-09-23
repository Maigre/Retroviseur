import { expect, it } from 'vitest';
import { newRollKey, seal, unseal } from './seal';

it('round-trips bytes and hides them at rest', async () => {
	const key = await newRollKey();
	const bytes = new TextEncoder().encode('frame-01 jpeg bytes').buffer;
	const sealed = await seal(key, bytes);
	expect(new Uint8Array(sealed.data)).not.toEqual(new Uint8Array(bytes));
	expect(new TextDecoder().decode(await unseal(key, sealed))).toBe('frame-01 jpeg bytes');
	await expect(unseal(await newRollKey(), sealed)).rejects.toThrow();
});
