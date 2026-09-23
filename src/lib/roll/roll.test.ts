import { describe, expect, it } from 'vitest';
import { EXPOSURES } from '../config';
import { dropOff, expose, framesLeft, loadRoll, markCollected, markReady, RollError } from './roll';

const ticket = { lab: 'local-timelock' as const, droppedAt: 0, data: {} };

describe('roll lifecycle', () => {
	it('fills after EXPOSURES shots and refuses more', () => {
		let roll = loadRoll('superia400', 0, 'r1');
		for (let i = 0; i < EXPOSURES - 1; i++) roll = expose(roll);
		expect(roll.state).toBe('loaded');
		expect(framesLeft(roll)).toBe(1);
		roll = expose(roll, 42);
		expect(roll.state).toBe('full');
		expect(roll.fullAt).toBe(42);
		expect(() => expose(roll)).toThrow(RollError);
	});

	it('only moves forward', () => {
		const loaded = loadRoll('c200', 0, 'r2');
		expect(() => dropOff(loaded, ticket)).toThrow(RollError);
		let roll = loaded;
		while (roll.state === 'loaded') roll = expose(roll);
		roll = dropOff(roll, ticket);
		expect(() => markCollected(roll)).toThrow(RollError);
		roll = markCollected(markReady(roll), 7);
		expect(roll.state).toBe('collected');
	});
});
