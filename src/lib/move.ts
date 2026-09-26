/**
 * The move to retroviseur.waverz.net (D56). Rolls live in the browser's storage,
 * which belongs to one origin: a phone with frames on a roll at the old address
 * stays there until that roll is dropped off and its ticket handed over; anyone
 * else is sent on at once. Lab tickets and shared links always carry the new
 * address — the server behind both names is the same.
 */
import type { Roll } from './roll/types';

export const HOME = 'https://retroviseur.waverz.net';
export const OLD_HOST = 'retroviseur.37m.gr';

export const onOldHost = (host = globalThis.location?.host): boolean => host === OLD_HOST;

/** The address to give out: the new home on the old host, else wherever we are (dev, LAN). */
export const publicOrigin = (loc: Pick<Location, 'host' | 'origin'> | undefined = globalThis.location): string =>
	!loc ? '' : onOldHost(loc.host) ? HOME : loc.origin;

/** Something only this origin's storage holds: frames shot, or a drop-off not yet handed over. */
export const holdsSomething = (rolls: Roll[]): boolean =>
	rolls.some((r) => !(r.state === 'loaded' && r.shot === 0) && !(r.ticket?.lab === 'remote' && r.handedOff));

/** The same page at the new address (a ticket's #key rides along). */
export const newHomeUrl = (loc: Pick<Location, 'pathname' | 'search' | 'hash'>): string => HOME + loc.pathname + loc.search + loc.hash;
