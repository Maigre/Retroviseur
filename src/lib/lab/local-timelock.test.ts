import 'fake-indexeddb/auto';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { EXPOSURES } from '../config';
import { RollRepository } from '../roll/repository';
import { dropOff, markReady } from '../roll/roll';
import { LocalTimelockLab } from './local-timelock';

it('develops a full roll into a zip of its frames, then the roll can be removed', async () => {
	const repo = await RollRepository.open('lab-collect');
	const lab = new LocalTimelockLab(repo);
	let roll = await repo.load('superia400', new Date(2026, 8, 23).getTime());
	for (let i = 0; i < EXPOSURES; i++) roll = await repo.recordFrame(roll.id, new TextEncoder().encode(`jpeg-${i}`).buffer, false);

	const ticket = await lab.dropOff(roll, repo.frames(roll.id));
	roll = dropOff(roll, ticket);
	await expect(lab.collect(roll)).rejects.toThrow();
	expect((await lab.status(ticket, ticket.droppedAt)).state).toBe('developing');

	roll = markReady(roll);
	const delivery = await lab.collect(roll);
	if (delivery.kind !== 'archive') throw new Error('expected an archive');
	expect(delivery.file.name).toBe('retroviseur-2026-09-23.zip');
	const files = unzipSync(new Uint8Array(await delivery.file.arrayBuffer()));
	const names = Object.keys(files).sort();
	expect(names).toHaveLength(EXPOSURES);
	expect(names[0]).toBe('retroviseur-2026-09-23/01.jpg');
	expect(new TextDecoder().decode(files['retroviseur-2026-09-23/27.jpg'])).toBe('jpeg-26');

	await repo.remove(roll.id);
	expect(await repo.list()).toEqual([]);
	const left = [];
	for await (const f of repo.frames(roll.id)) left.push(f);
	expect(left).toEqual([]);
});
