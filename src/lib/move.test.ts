import { expect, it } from 'vitest';
import { HOME, holdsSomething, newHomeUrl, onOldHost, publicOrigin } from './move';
import type { Roll } from './roll/types';

const roll = (p: Partial<Roll>): Roll => ({ id: 'r', state: 'loaded', stock: 'superia400', exposures: 27, shot: 0, loadedAt: 0, ...p });

it('knows the old host', () => {
	expect(onOldHost('retroviseur.37m.gr')).toBe(true);
	expect(onOldHost('retroviseur.waverz.net')).toBe(false);
});

it('gives out the new address from the old host only', () => {
	expect(publicOrigin({ host: 'retroviseur.37m.gr', origin: 'https://retroviseur.37m.gr' })).toBe(HOME);
	expect(publicOrigin({ host: '192.168.1.5:5173', origin: 'https://192.168.1.5:5173' })).toBe('https://192.168.1.5:5173');
});

it('holds a phone only for what its storage alone has', () => {
	expect(holdsSomething([])).toBe(false);
	expect(holdsSomething([roll({})])).toBe(false); // a fresh roll: nothing lost
	expect(holdsSomething([roll({ shot: 3 })])).toBe(true);
	expect(holdsSomething([roll({ state: 'full', shot: 27 })])).toBe(true);
	const ticket = { lab: 'remote' as const, droppedAt: 0, data: {} };
	expect(holdsSomething([roll({ state: 'developing', shot: 27, ticket })])).toBe(true); // ticket not shared yet
	expect(holdsSomething([roll({ state: 'developing', shot: 27, ticket, handedOff: true })])).toBe(false);
	expect(holdsSomething([roll({ state: 'developing', shot: 27, ticket: { lab: 'local-timelock', droppedAt: 0, data: {} } })])).toBe(true);
});

it('keeps the path and the ticket key', () => {
	expect(newHomeUrl({ pathname: '/lab/abc', search: '', hash: '#k3y' })).toBe(`${HOME}/lab/abc#k3y`);
});
