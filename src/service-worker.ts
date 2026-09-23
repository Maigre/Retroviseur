/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Offline shell: every build asset + static file is precached per version.
// Navigations fall back to the cached index.html (SPA). Rolls live in
// IndexedDB, not here — clearing this cache never touches a roll.
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `retroviseur-${version}`;
const ASSETS = [...build, ...files, '/'];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET' || new URL(req.url).origin !== sw.location.origin) return;

	if (req.mode === 'navigate') {
		// Network first so a deploy shows up; the cached shell when offline.
		event.respondWith(fetch(req).catch(async () => (await caches.match('/')) ?? Response.error()));
		return;
	}
	event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});
