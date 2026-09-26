import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createLab } from './lab.mjs';

const H = 3_600_000;
let dir, server, base, clock, lab;

async function start(limits = {}) {
	dir = await mkdtemp(join(tmpdir(), 'lab-'));
	clock = { t: Date.UTC(2026, 8, 23, 12) };
	lab = await createLab({ dir, now: () => clock.t, limits });
	server = createServer(async (req, res) => {
		if (!(await lab.handle(req, res, new URL(req.url, 'http://x').pathname))) res.writeHead(404).end();
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	base = `http://127.0.0.1:${server.address().port}/api/lab`;
}
beforeEach(() => start());
afterEach(async () => {
	server.close();
	await rm(dir, { recursive: true, force: true });
});

const part = (n, size = 64) => new Uint8Array(size).fill(n); // stand-in for iv ‖ ciphertext
async function createRoll(frames = 2) {
	const r = await fetch(`${base}/rolls`, { method: 'POST', body: JSON.stringify({ frames }) });
	expect(r.status).toBe(201);
	return r.json();
}
const put = (id, token, what, body) => fetch(`${base}/rolls/${id}/${what}`, { method: 'PUT', headers: { authorization: `Bearer ${token}` }, body });
const commit = (id, token) => fetch(`${base}/rolls/${id}/commit`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
const status = async (id) => (await fetch(`${base}/rolls/${id}`)).json();

async function fullRoll(frames = 2) {
	const roll = await createRoll(frames);
	await put(roll.id, roll.uploadToken, 'manifest', part(0));
	for (let i = 1; i <= frames; i++) await put(roll.id, roll.uploadToken, `frames/${i}`, part(i));
	expect((await commit(roll.id, roll.uploadToken)).status).toBe(200);
	return roll;
}

it('walks a roll through upload, developing, pickup and destruction', async () => {
	const roll = await createRoll(2);
	expect(roll.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
	expect(roll.window.to - roll.window.from).toBe(48 * H);
	expect(roll).not.toHaveProperty('readyAt');

	// resumable: status lists what is missing
	await put(roll.id, roll.uploadToken, 'frames/2', part(2));
	expect((await status(roll.id)).missing).toEqual(['manifest', 1]);
	expect((await commit(roll.id, roll.uploadToken)).status).toBe(409);
	await put(roll.id, roll.uploadToken, 'manifest', part(0, 20));
	await put(roll.id, roll.uploadToken, 'frames/1', part(1, 30));
	expect((await commit(roll.id, roll.uploadToken)).status).toBe(200);

	// committed: the token is burnt
	expect((await put(roll.id, roll.uploadToken, 'frames/1', part(9))).status).toBe(409);

	// too early — neither status nor archive reveal the ready time
	const early = await status(roll.id);
	expect(early.state).toBe('developing');
	expect(early).not.toHaveProperty('expiresAt');
	expect((await fetch(`${base}/rolls/${roll.id}/archive`)).status).toBe(425);

	// after the window: ready, with an expiry
	clock.t += 72 * H;
	const ready = await status(roll.id);
	expect(ready.state).toBe('ready');
	expect(ready.expiresAt).toBeGreaterThan(clock.t);

	// pickup: the container holds manifest then frames, length-prefixed
	const buf = Buffer.from(await (await fetch(`${base}/rolls/${roll.id}/archive`)).arrayBuffer());
	expect(buf.subarray(0, 5).toString()).toBe('RTVL1');
	let o = 5;
	const sizes = [];
	while (o < buf.length) {
		const n = buf.readUInt32BE(o);
		sizes.push([n, buf[o + 4]]);
		o += 4 + n;
	}
	expect(sizes).toEqual([[20, 0], [30, 1], [64, 2]]);
	await new Promise((r) => setTimeout(r, 50)); // 'finish' → collectedAt

	const collected = await status(roll.id);
	expect(collected.state).toBe('collected');
	expect(collected.collectedUntil).toBe(clock.t + H);
	// still available within the grace hour
	expect((await fetch(`${base}/rolls/${roll.id}/archive`)).status).toBe(200);

	// an hour later: gone, and the folder with it
	clock.t += H + 1;
	expect((await fetch(`${base}/rolls/${roll.id}/archive`)).status).toBe(410);
	expect(await readdir(dir)).toEqual([]);
	expect((await status(roll.id)).state).toBe('gone');
});

it('refuses writes without the upload token and oversized parts', async () => {
	await start({ maxFrameBytes: 100, maxRollBytes: 150 });
	const roll = await createRoll(2);
	const r = await fetch(`${base}/rolls/${roll.id}/frames/1`, { method: 'PUT', body: part(1) });
	expect(r.status).toBe(401);
	expect((await put(roll.id, 'wrong', 'frames/1', part(1))).status).toBe(401);
	expect((await put(roll.id, roll.uploadToken, 'frames/1', part(1, 101))).status).toBe(413);
	expect((await put(roll.id, roll.uploadToken, 'frames/3', part(1))).status).toBe(400);
	expect((await put(roll.id, roll.uploadToken, 'frames/1', part(1, 100))).status).toBe(204);
	expect((await put(roll.id, roll.uploadToken, 'frames/2', part(2, 100))).status).toBe(413); // roll cap
	expect((await fetch(`${base}/rolls`, { method: 'POST', body: JSON.stringify({ frames: 28 }) })).status).toBe(400);
});

it('limits new rolls per client per day, without keeping addresses', async () => {
	await start({ rollsPerIpPerDay: 2 });
	await createRoll();
	await createRoll();
	expect((await fetch(`${base}/rolls`, { method: 'POST', body: JSON.stringify({ frames: 1 }) })).status).toBe(429);
	clock.t += 24 * H; // next day: new salt, counters cleared
	await createRoll();
});

it('says the lab is full when the store cap is reached', async () => {
	await start({ maxStoreBytes: 200 });
	await fullRoll(2); // 64 + 64 + 64 = 192
	const r = await fetch(`${base}/rolls`, { method: 'POST', body: JSON.stringify({ frames: 1 }) });
	expect(r.status).toBe(201); // under the cap still
	const roll = await r.json();
	expect((await put(roll.id, roll.uploadToken, 'frames/1', part(1, 64))).status).toBe(507);
});

it('the janitor clears abandoned uploads and uncollected rolls', async () => {
	const abandoned = await createRoll(1);
	const kept = await fullRoll(1);
	clock.t += 25 * H;
	await lab.janitor();
	expect(await readdir(dir)).toEqual([kept.id]);
	clock.t += 72 * H + 30 * 24 * H;
	await lab.janitor();
	expect(await readdir(dir)).toEqual([]);
	expect(lab.storeBytes).toBe(0);
	expect(abandoned.id).toBeTruthy();
});

it('lets the Android app (https://localhost) in, and nobody else cross-origin', async () => {
	const pre = await fetch(`${base}/rolls`, { method: 'OPTIONS', headers: { origin: 'https://localhost', 'access-control-request-method': 'PUT' } });
	expect(pre.status).toBe(204);
	expect(pre.headers.get('access-control-allow-origin')).toBe('https://localhost');
	expect(pre.headers.get('access-control-allow-headers')).toContain('Authorization');
	const roll = await createRoll();
	const s = await fetch(`${base}/rolls/${roll.id}`, { headers: { origin: 'https://localhost' } });
	expect(s.headers.get('access-control-allow-origin')).toBe('https://localhost');
	const other = await fetch(`${base}/rolls/${roll.id}`, { headers: { origin: 'https://evil.example' } });
	expect(other.headers.get('access-control-allow-origin')).toBeNull();
});
