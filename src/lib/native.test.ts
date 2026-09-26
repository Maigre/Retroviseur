import { expect, it } from 'vitest';
import { LAB_API, NATIVE, notifyId, ticketPath } from './native';

it('is inert in the web build', () => {
	expect(NATIVE).toBe(false);
	expect(LAB_API).toBe('/api/lab');
});

it('takes only our own ticket links', () => {
	expect(ticketPath('https://retroviseur.waverz.net/lab/AbC_d-9#k3y')).toBe('/lab/AbC_d-9#k3y');
	expect(ticketPath('https://retroviseur.waverz.net/')).toBeNull();
	expect(ticketPath('https://evil.example/lab/abc#k')).toBeNull();
	expect(ticketPath('not a url')).toBeNull();
	expect(ticketPath(undefined)).toBeNull();
});

it('gives each roll stable, distinct notification ids', () => {
	expect(notifyId('roll-1', 'ready')).toBe(notifyId('roll-1', 'ready'));
	expect(notifyId('roll-1', 'ready')).not.toBe(notifyId('roll-1', 'call'));
	expect(notifyId('roll-1', 'ready')).toBeGreaterThanOrEqual(0);
});
