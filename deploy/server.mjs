// Zero-dependency server for the SPA build and the lab API (/api/lab, see
// lab.mjs and docs/LAB.md), run by pm2 on gaff.
// Public path: kxkm-prod (TLS) → holden (nginx) → gaff:$PORT → this file.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLab } from './lab.mjs';

const ROOT = process.env.ROOT ?? fileURLToPath(new URL('../build', import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
// rolls live outside the git checkout so deploys never touch them
const LAB_DIR = process.env.LAB_DIR ?? fileURLToPath(new URL('../.lab-data', import.meta.url));

const lab = await createLab({
	dir: LAB_DIR,
	limits: {
		proxyHops: Number(process.env.LAB_PROXY_HOPS ?? 0),
		// test-only: shorten the developing wait (never set in production)
		...(process.env.LAB_TEST_READY_MS
			? { readyMin: Number(process.env.LAB_TEST_READY_MS), readyMax: Number(process.env.LAB_TEST_READY_MS) }
			: {})
	}
});
setInterval(() => lab.janitor().catch((e) => console.error('lab janitor:', e?.message ?? e)), 10 * 60_000).unref();

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.webmanifest': 'application/manifest+json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain; charset=utf-8'
};

const HEADERS = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'no-referrer',
	'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()'
};

async function resolve(urlPath) {
	const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
	const file = join(ROOT, rel);
	if (file !== ROOT && !file.startsWith(ROOT + sep)) return null; // path traversal
	try {
		const s = await stat(file);
		if (s.isFile()) return { file, size: s.size };
	} catch {}
	return null;
}

createServer(async (req, res) => {
	let pathname = '/';
	try {
		pathname = new URL(req.url ?? '/', 'http://x').pathname;
	} catch {
		// handled below
	}
	if (await lab.handle(req, res, pathname)) return;
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		res.writeHead(405, { Allow: 'GET, HEAD' }).end();
		return;
	}
	let path;
	try {
		path = new URL(req.url ?? '/', 'http://x').pathname;
	} catch {
		res.writeHead(400).end();
		return;
	}
	// Real file, else SPA fallback (client-side routes) — but never for asset-looking paths.
	let hit = await resolve(path);
	if (!hit && !extname(path)) hit = await resolve('index.html');
	if (!hit) {
		res.writeHead(404, { 'Content-Type': 'text/plain', ...HEADERS }).end('not found');
		return;
	}
	const immutable = path.startsWith('/_app/immutable/');
	res.writeHead(200, {
		'Content-Type': TYPES[extname(hit.file)] ?? 'application/octet-stream',
		'Content-Length': hit.size,
		'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
		...HEADERS
	});
	if (req.method === 'HEAD') res.end();
	else createReadStream(hit.file).pipe(res);
}).listen(PORT, HOST, () => console.log(`retroviseur serving ${ROOT} on ${HOST}:${PORT}`));
