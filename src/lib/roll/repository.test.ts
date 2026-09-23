import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { EXPOSURES } from '../config';
import { RollRepository } from './repository';
import { dropOff } from './roll';
import { unseal } from './seal';

let n = 0;
const fresh = () => RollRepository.open(`test-${n++}`);
const jpeg = (i: number) => new TextEncoder().encode(`jpeg-${i}`).buffer;

it('persists frames sealed and advances the counter with them', async () => {
	const repo = await fresh();
	const roll = await repo.load('superia400', 1);
	await repo.recordFrame(roll.id, jpeg(0), false, 2);
	const after = await repo.recordFrame(roll.id, jpeg(1), true, 3);
	expect(after.shot).toBe(2);

	// Survives a "reload": a new repository on the same database.
	const reopened = await RollRepository.open(`test-${n - 1}`);
	const [stored] = await reopened.list();
	expect(stored.shot).toBe(2);

	const key = await reopened.key(roll.id);
	const frames = [];
	for await (const f of reopened.frames(roll.id)) frames.push(f);
	expect(frames.map((f) => f.meta)).toEqual([
		{ index: 0, takenAt: 2, flash: false },
		{ index: 1, takenAt: 3, flash: true }
	]);
	expect(new TextDecoder().decode(await unseal(key, frames[1].sealed))).toBe('jpeg-1');
});

it('fills the roll, then allows one more roll once it is at the lab', async () => {
	const repo = await fresh();
	let roll = await repo.load('superia400');
	await expect(repo.load('superia400')).rejects.toThrow();
	for (let i = 0; i < EXPOSURES; i++) roll = await repo.recordFrame(roll.id, jpeg(i), false);
	expect(roll.state).toBe('full');
	await expect(repo.recordFrame(roll.id, jpeg(99), false)).rejects.toThrow();

	await repo.save(dropOff(roll, { lab: 'local-timelock', droppedAt: 0, data: {} }));
	const next = await repo.load('superia400');
	expect((await repo.list()).map((r) => r.state)).toEqual(['developing', 'loaded']);
	expect(next.shot).toBe(0);
});
