import { expect, it } from 'vitest';
import { dropOff, expose, loadRoll, markCollected, markReady } from './roll';
import { canDropOff, canLoad } from './rules';
import type { Roll } from './types';

const ticket = { lab: 'local-timelock' as const, droppedAt: 0, data: {} };
const fill = (r: Roll) => {
	while (r.state === 'loaded') r = expose(r);
	return r;
};

it('allows one roll in the camera while another is at the lab', () => {
	expect(canLoad([])).toBe(true);

	const first = fill(loadRoll('superia400', 0, 'a'));
	expect(canLoad([first])).toBe(false);
	expect(canDropOff(first, [first])).toBe(true);

	const atLab = dropOff(first, ticket);
	expect(canLoad([atLab])).toBe(true);

	const second = fill(loadRoll('superia400', 0, 'b'));
	expect(canLoad([atLab, second])).toBe(false);
	expect(canDropOff(second, [atLab, second])).toBe(false);

	const collected = markCollected(markReady(atLab));
	expect(canDropOff(second, [collected, second])).toBe(true);
});
