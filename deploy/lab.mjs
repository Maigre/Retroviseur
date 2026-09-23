// @ts-nocheck — plain Node ESM, run as-is on gaff; covered by deploy/lab.test.mjs
// The lab (docs/LAB.md, D44): stores encrypted rolls it cannot read, hands each
// one out once after a random 1–3 day wait, then destroys it. Zero dependencies,
// no database: one folder per roll. Mounted by server.mjs under /api/lab.
//
// What it knows per roll: a random id, part sizes and timestamps. No key, no
// names, no addresses; client IPs only as in-memory counters under a salt that
// changes every day and is never written anywhere.
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const DEFAULTS = {
	maxFrames: 27,
	maxFrameBytes: 4 * 1024 * 1024,
	maxManifestBytes: 64 * 1024,
	maxRollBytes: 100 * 1024 * 1024,
	maxStoreBytes: 20 * 1024 * 1024 * 1024,
	rollsPerIpPerDay: 10,
	readyMin: 24 * HOUR,
	readyMax: 72 * HOUR,
	graceAfterPickup: HOUR,
	keepAfterReady: 30 * DAY,
	abandonUpload: DAY,
	/** proxies in front of us that append to X-Forwarded-For (kxkm-prod, holden) */
	proxyHops: 0
};

const ID = /^[A-Za-z0-9_-]{22}$/;
const MAGIC = Buffer.from('RTVL1');

/**
 * @param {{ dir: string, now?: () => number, limits?: Partial<typeof DEFAULTS> }} opts
 */
export async function createLab({ dir, now = Date.now, limits = {} }) {
	const L = { ...DEFAULTS, ...limits };
	await mkdir(dir, { recursive: true });
	let storeBytes = 0;

	// ---------- per-IP daily counters, memory only ----------
	let saltDay = -1;
	let salt = randomBytes(32);
	const counters = new Map();
	function allowCreate(ip) {
		const day = Math.floor(now() / DAY);
		if (day !== saltDay) {
			saltDay = day;
			salt = randomBytes(32);
			counters.clear();
		}
		const key = createHmac('sha256', salt).update(ip).digest('base64url');
		const n = (counters.get(key) ?? 0) + 1;
		counters.set(key, n);
		return n <= L.rollsPerIpPerDay;
	}
	function clientIp(req) {
		const xff = String(req.headers['x-forwarded-for'] ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		// with N trusted proxies, the client is the N-th entry from the end
		if (L.proxyHops > 0 && xff.length >= L.proxyHops) return xff[xff.length - L.proxyHops];
		return req.socket.remoteAddress ?? 'unknown';
	}

	// ---------- storage ----------
	const rollDir = (id) => join(dir, id);
	const partPath = (id, part) => join(rollDir(id), part === 'manifest' ? 'manifest.bin' : `${String(part).padStart(2, '0')}.bin`);
	async function readMeta(id) {
		if (!ID.test(id)) return null;
		try {
			return JSON.parse(await readFile(join(rollDir(id), 'meta.json'), 'utf8'));
		} catch {
			return null;
		}
	}
	async function writeMeta(meta) {
		const p = join(rollDir(meta.id), 'meta.json');
		await writeFile(p + '.tmp', JSON.stringify(meta));
		await rename(p + '.tmp', p);
	}
	async function destroy(id) {
		const meta = await readMeta(id);
		if (meta) storeBytes -= meta.bytes ?? 0;
		await rm(rollDir(id), { recursive: true, force: true });
	}
	/** state as of now; persists the developing → ready step lazily */
	async function current(meta) {
		const t = now();
		if (meta.state === 'uploading' && t > meta.createdAt + L.abandonUpload) return 'expired';
		if (meta.state === 'collected' && t > meta.collectedAt + L.graceAfterPickup) return 'expired';
		if ((meta.state === 'developing' || meta.state === 'ready') && t > meta.readyAt + L.keepAfterReady) return 'expired';
		if (meta.state === 'developing' && t >= meta.readyAt) {
			meta.state = 'ready';
			await writeMeta(meta);
		}
		return meta.state;
	}

	/** Delete everything past its time; recount the store. Runs every 10 min. */
	async function janitor() {
		let total = 0;
		for (const id of await readdir(dir).catch(() => [])) {
			const meta = await readMeta(id);
			if (!meta) {
				if (ID.test(id)) await rm(rollDir(id), { recursive: true, force: true });
				continue;
			}
			if ((await current(meta)) === 'expired') await rm(rollDir(id), { recursive: true, force: true });
			else total += meta.bytes ?? 0;
		}
		storeBytes = total;
	}
	await janitor();

	// ---------- http helpers ----------
	function send(res, code, body, headers = {}) {
		const data = body === undefined ? '' : JSON.stringify(body);
		res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(data), ...headers });
		res.end(data);
	}
	/** Read a body up to `limit` bytes; null if it is larger. */
	function readBody(req, limit) {
		return new Promise((resolve, reject) => {
			const declared = Number(req.headers['content-length'] ?? NaN);
			if (declared > limit) {
				req.resume();
				return resolve(null);
			}
			const chunks = [];
			let size = 0;
			req.on('data', (c) => {
				size += c.length;
				if (size > limit) {
					req.destroy();
					resolve(null);
				} else chunks.push(c);
			});
			req.on('end', () => resolve(Buffer.concat(chunks)));
			req.on('error', reject);
		});
	}
	const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');
	const authorized = (req, meta) => {
		const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''));
		return !!m && !!meta.tokenHash && hashToken(m[1]) === meta.tokenHash;
	};
	const windowOf = (meta) => ({ from: meta.windowFrom, to: meta.windowTo });
	const missing = (meta) => {
		const out = [];
		if (meta.parts.manifest == null) out.push('manifest');
		for (let i = 1; i <= meta.frames; i++) if (meta.parts.frames[i] == null) out.push(i);
		return out;
	};

	// ---------- routes ----------
	async function create(req, res) {
		const body = await readBody(req, 1024);
		let frames;
		try {
			frames = JSON.parse(String(body ?? '')).frames;
		} catch {
			return send(res, 400, { error: 'bad request' });
		}
		if (!Number.isInteger(frames) || frames < 1 || frames > L.maxFrames) return send(res, 400, { error: 'bad frame count' });
		if (!allowCreate(clientIp(req))) return send(res, 429, { error: 'lab busy' });
		if (storeBytes >= L.maxStoreBytes) return send(res, 507, { error: 'lab full' });
		const t = now();
		const id = randomBytes(16).toString('base64url');
		const token = randomBytes(24).toString('base64url');
		const meta = {
			v: 1,
			id,
			state: 'uploading',
			frames,
			createdAt: t,
			readyAt: t + L.readyMin + randomInt(0, L.readyMax - L.readyMin + 1),
			windowFrom: t + L.readyMin,
			windowTo: t + L.readyMax,
			collectedAt: null,
			bytes: 0,
			tokenHash: hashToken(token),
			parts: { manifest: null, frames: {} }
		};
		await mkdir(rollDir(id));
		await writeMeta(meta);
		// the exact ready time is never returned before it has passed
		send(res, 201, { id, uploadToken: token, window: windowOf(meta) });
	}

	async function putPart(req, res, meta, part) {
		if (meta.state !== 'uploading') return send(res, 409, { error: 'already committed' });
		if (!authorized(req, meta)) return send(res, 401, { error: 'unauthorized' });
		if (part !== 'manifest' && (!Number.isInteger(part) || part < 1 || part > meta.frames)) return send(res, 400, { error: 'bad frame' });
		const limit = part === 'manifest' ? L.maxManifestBytes : L.maxFrameBytes;
		const body = await readBody(req, limit);
		if (body === null) return send(res, 413, { error: 'too large' });
		if (body.length < 13) return send(res, 400, { error: 'empty' }); // iv (12) + at least one byte
		const previous = part === 'manifest' ? meta.parts.manifest : meta.parts.frames[part];
		const rollBytes = meta.bytes - (previous ?? 0) + body.length;
		if (rollBytes > L.maxRollBytes) return send(res, 413, { error: 'roll too large' });
		if (storeBytes - (previous ?? 0) + body.length > L.maxStoreBytes) return send(res, 507, { error: 'lab full' });
		const p = partPath(meta.id, part);
		await writeFile(p + '.tmp', body);
		await rename(p + '.tmp', p);
		if (part === 'manifest') meta.parts.manifest = body.length;
		else meta.parts.frames[part] = body.length;
		storeBytes += body.length - (previous ?? 0);
		meta.bytes = rollBytes;
		await writeMeta(meta);
		send(res, 204);
	}

	async function commit(req, res, meta) {
		if (meta.state !== 'uploading') return send(res, 409, { error: 'already committed' });
		if (!authorized(req, meta)) return send(res, 401, { error: 'unauthorized' });
		const gaps = missing(meta);
		if (gaps.length) return send(res, 409, { error: 'incomplete', missing: gaps });
		meta.state = 'developing';
		meta.tokenHash = null; // burnt: nobody can change a committed roll
		await writeMeta(meta);
		send(res, 200, { state: 'developing', window: windowOf(meta) });
	}

	async function status(res, meta) {
		const state = await current(meta);
		if (state === 'expired') {
			await destroy(meta.id);
			return send(res, 404, { state: 'gone' });
		}
		const out = { state, frames: meta.frames, window: windowOf(meta) };
		if (state === 'uploading') out.missing = missing(meta);
		if (state === 'ready') out.expiresAt = meta.readyAt + L.keepAfterReady;
		if (state === 'collected') out.collectedUntil = meta.collectedAt + L.graceAfterPickup;
		send(res, 200, out);
	}

	async function archive(res, meta) {
		const state = await current(meta);
		if (state === 'expired') {
			await destroy(meta.id);
			return send(res, 410, { state: 'gone' });
		}
		if (state === 'uploading') return send(res, 404, { state: 'gone' });
		if (state === 'developing') return send(res, 425, { state, window: windowOf(meta) });
		const parts = ['manifest', ...Array.from({ length: meta.frames }, (_, i) => i + 1)];
		const sizes = parts.map((p) => (p === 'manifest' ? meta.parts.manifest : meta.parts.frames[p]));
		const length = MAGIC.length + sizes.reduce((a, s) => a + 4 + s, 0);
		res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': length, 'Cache-Control': 'no-store' });
		res.write(MAGIC);
		for (let i = 0; i < parts.length; i++) {
			const len = Buffer.alloc(4);
			len.writeUInt32BE(sizes[i]);
			res.write(len);
			await new Promise((resolve, reject) => {
				const s = createReadStream(partPath(meta.id, parts[i]));
				s.on('error', reject);
				s.on('end', resolve);
				s.pipe(res, { end: false });
			});
			if (res.destroyed) return; // the reader went away: not a pickup
		}
		// a complete transfer is the pickup; the grace hour starts once
		res.on('finish', () => {
			if (meta.state === 'collected') return;
			meta.state = 'collected';
			meta.collectedAt = now();
			writeMeta(meta).catch((e) => console.error('lab:', e?.message ?? e));
		});
		res.end();
	}

	/** Handle /api/lab/* — returns false for any other path. */
	async function handle(req, res, pathname) {
		if (!pathname.startsWith('/api/lab/')) return false;
		const seg = pathname.slice('/api/lab/'.length).split('/');
		try {
			if (seg[0] !== 'rolls') return send(res, 404, { error: 'not found' }), true;
			if (seg.length === 1) {
				if (req.method === 'POST') await create(req, res);
				else send(res, 405, { error: 'method' });
				return true;
			}
			const meta = await readMeta(seg[1]);
			if (!meta) return send(res, 404, { state: 'gone' }), true;
			const [, , what, n] = seg;
			if (!what && req.method === 'GET') await status(res, meta);
			else if (what === 'archive' && req.method === 'GET') await archive(res, meta);
			else if (what === 'commit' && req.method === 'POST') await commit(req, res, meta);
			else if (what === 'manifest' && req.method === 'PUT') await putPart(req, res, meta, 'manifest');
			else if (what === 'frames' && req.method === 'PUT') await putPart(req, res, meta, Number(n));
			else send(res, 404, { error: 'not found' });
		} catch (e) {
			console.error('lab:', e?.message ?? e); // no ids, no ips
			if (!res.headersSent) send(res, 500, { error: 'lab error' });
			else res.destroy();
		}
		return true;
	}

	return { handle, janitor, get storeBytes() { return storeBytes; } };
}
