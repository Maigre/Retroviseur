import { expect, it } from 'vitest';
import { drawReadyAt } from './develop-time';
import { LocalTimelockLab } from './local-timelock';

const H = 3_600_000;

it('draws a developing time between 24 and 72 hours', () => {
	expect(drawReadyAt(0, () => 0)).toBe(24 * H);
	expect(drawReadyAt(0, () => 1)).toBe(72 * H);
});

it('local lab reports ready only after the deadline', async () => {
	const lab = new LocalTimelockLab();
	const ticket = { lab: lab.kind, droppedAt: 0, data: { readyAt: 100 } };
	expect(await lab.status(ticket, 99)).toEqual({ state: 'developing' });
	expect(await lab.status(ticket, 100)).toEqual({ state: 'ready' });
});
