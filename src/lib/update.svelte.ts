/**
 * "A new version is ready" (D52). The service worker takes over as soon as a new
 * build is installed; pages opened under the old one learn it from
 * `controllerchange` and offer a reload — never forced, so a shot or an upload
 * is never cut. An app left open checks again whenever it comes back.
 */
export const update = $state({ ready: false });

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
	const hadController = !!navigator.serviceWorker.controller; // first install: nothing to announce
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (hadController) update.ready = true;
	});
	const check = () =>
		navigator.serviceWorker
			.getRegistration()
			.then((r) => r?.update())
			.catch(() => {});
	document.addEventListener('visibilitychange', () => !document.hidden && check());
	setInterval(check, 30 * 60_000);
}
