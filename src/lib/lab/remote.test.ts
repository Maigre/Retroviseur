import 'fake-indexeddb/auto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createLab } from '../../../deploy/lab.mjs';
import { EXPOSURES } from '../config';
import { RollRepository } from '../roll/repository';
import { dropOff } from '../roll/roll';
import { unseal } from '../roll/seal';
import { parseArchive, unpackSealed, type Manifest } from './archive';
import { LabClosedError, RemoteLab, type RemoteTicketData } from './remote';
import { formatWindow, importKey, ticketMessage } from './ticket';

const H = 3_600_000;
let server: Server;
let dir: string;
let base: string;
const clock = { t: Date.UTC(2026, 8, 23, 12) };

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'lab-client-'));
	const lab = await createLab({ dir, now: () => clock.t });
	server = createServer(async (req, res) => {
		if (!(await lab.handle(req, res, new URL(req.url!, 'http://x').pathname))) res.writeHead(404).end();
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/lab`;
});
afterAll(async () => {
	server.close();
	await rm(dir, { recursive: true, force: true });
});

const jpeg = (i: number) => new TextEncoder().encode(`jpeg-${i}`.padEnd(200, '.')).buffer;

it('uploads a roll it cannot read back, resumes, and the ticket alone opens it', async () => {
	const repo = await RollRepository.open('remote-e2e');
	const lab = new RemoteLab(repo, base, 'https://retroviseur.test');
	let roll = await repo.load('superia400', Date.UTC(2026, 8, 20));
	for (let i = 0; i < EXPOSURES; i++) roll = await repo.recordFrame(roll.id, jpeg(i), i === 3, Date.UTC(2026, 8, 21, i));

	// interrupted: the network dies after a few frames
	const realFetch = globalThis.fetch;
	let puts = 0;
	globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
		if (init?.method === 'PUT' && ++puts > 5) throw new TypeError('network down');
		return realFetch(url, init);
	}) as typeof fetch;
	await expect(lab.dropOff(roll, repo.frames(roll.id))).rejects.toBeInstanceOf(LabClosedError);
	globalThis.fetch = realFetch;

	// resumed from the saved upload: only what is missing goes up again
	roll = (await repo.list())[0];
	expect(roll.upload?.id).toBeTruthy();
	const progress: number[] = [];
	const ticket = await lab.dropOff(roll, repo.frames(roll.id), (d) => progress.push(d));
	expect(progress.at(-1)).toBe(EXPOSURES + 1);
	const data = ticket.data as RemoteTicketData;
	expect(data.id).toBe(roll.upload!.id);
	expect(data.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(lab.link({ ...roll, ticket })).toBe(`https://retroviseur.test/lab/${data.id}#${data.key}`);

	// hand-off: the phone forgets frames and key
	await repo.save({ ...dropOff(roll, ticket), handedOff: true });
	await repo.forget(roll.id);
	await expect(repo.key(roll.id)).rejects.toThrow();
	expect(await lab.status(ticket)).toEqual({ state: 'developing' });

	// ready: the ticket's key alone decrypts what the lab hands out
	clock.t += 72 * H;
	const ready = await lab.status(ticket);
	expect(ready.state).toBe('ready');
	const { manifest, frames } = parseArchive(await (await fetch(`${base}/rolls/${data.id}/archive`)).arrayBuffer());
	const key = await importKey(data.key);
	const m: Manifest = JSON.parse(new TextDecoder().decode(await unseal(key, unpackSealed(manifest))));
	expect(m.frames).toHaveLength(EXPOSURES);
	expect(m.frames[3].flash).toBe(true);
	expect(frames).toHaveLength(EXPOSURES);
	const last = new TextDecoder().decode(await unseal(key, unpackSealed(frames[EXPOSURES - 1])));
	expect(last.startsWith(`jpeg-${EXPOSURES - 1}`)).toBe(true);

	await new Promise((r) => setTimeout(r, 50));
	expect((await lab.status(ticket)).state).toBe('collected');
	clock.t += 2 * H;
	expect(await lab.status(ticket)).toEqual({ state: 'gone' });
});

it('writes the ticket message with the window, never the exact day', () => {
	const from = Date.UTC(2026, 8, 25, 12);
	const to = Date.UTC(2026, 8, 27, 12);
	expect(formatWindow(from, to, 'en')).toEqual({ from: 'Fri 25', to: 'Sun 27 September' });
	expect(formatWindow(from, Date.UTC(2026, 9, 1, 12), 'en').from).toBe('Fri 25 September');
	const fr = ticketMessage('https://x/lab/a#b', from, to, 'fr');
	expect(fr).toContain('ne le perdez pas');
	expect(fr).toContain('https://x/lab/a#b');
});
