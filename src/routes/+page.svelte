<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { CameraError, captureStill, closeCamera, openCamera } from '$lib/camera/capture';
	import { buzz, HAPTIC, Sounds } from '$lib/camera/sound';
	import { Winder } from '$lib/camera/winder';
	import DevPanel from '$lib/components/DevPanel.svelte';
	import FlashToggle from '$lib/components/FlashToggle.svelte';
	import Header from '$lib/components/Header.svelte';
	import Thumbwheel from '$lib/components/Thumbwheel.svelte';
	import { FILM_STOCK, SHUTTER_BLACKOUT_MS } from '$lib/config';
	import { devEnabled, setDev } from '$lib/dev';
	import { t, type MessageKey } from '$lib/i18n';
	import { install, promptInstall } from '$lib/install.svelte';
	import { LocalTimelockLab } from '$lib/lab/local-timelock';
	import { hasFlash, isAndroid, isIOS, isStandalone, persistStorage } from '$lib/platform';
	import { RollRepository } from '$lib/roll/repository';
	import { dropOff, framesLeft, markReady } from '$lib/roll/roll';
	import { canDropOff } from '$lib/roll/rules';
	import type { Roll } from '$lib/roll/types';

	const sounds = new Sounds();
	const winder = new Winder();

	let repo = $state<RollRepository>();
	let lab: LocalTimelockLab | undefined;
	let rolls = $state<Roll[]>([]);
	let booted = $state(false);
	let installGate = $state<'ios' | 'android' | null>(null);

	let armed = $state(false);
	let flash = $state(false);
	let busy = $state(false);
	let blackout = $state(false);
	let notice = $state<MessageKey | null>(null);

	let video = $state<HTMLVideoElement>();
	let stream: MediaStream | undefined;
	let camera = $state<'off' | 'starting' | 'live' | 'denied' | 'unavailable' | 'insecure'>('off');
	let visible = $state(true);

	let collecting = $state(false);
	let saved = $state(false);

	let about = $state(false);

	let dev = $state(false);
	let devTaps: number[] = [];

	const inCamera = $derived(rolls.find((r) => r.state === 'loaded' || r.state === 'full'));
	const atLab = $derived(rolls.find((r) => r.state === 'developing' || r.state === 'ready'));
	const shooting = $derived(inCamera?.state === 'loaded');

	onMount(() => {
		dev = devEnabled();
		const skipped = sessionStorage.getItem('install-skipped') === '1';
		if (!isStandalone() && !skipped) installGate = isIOS() ? 'ios' : isAndroid() ? 'android' : null;
		void (async () => {
			repo = await RollRepository.open();
			lab = new LocalTimelockLab(repo);
			await refresh();
			booted = true;
		})();
		const onVisibility = () => {
			visible = !document.hidden;
			if (!visible) stopCamera();
			else void refresh(); // a roll may have come back from the lab meanwhile
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			stopCamera();
		};
	});

	// Camera runs only while a roll is loaded and the finder is on screen.
	$effect(() => {
		const wanted = shooting && visible && !installGate && !!video;
		if (wanted && camera === 'off') void startCamera();
		if (!wanted && (camera === 'live' || camera === 'starting')) stopCamera();
	});

	async function refresh() {
		if (!repo || !lab) return;
		let list = await repo.list();
		// "Ready" is noticed on open (D16).
		for (const r of list) {
			if (r.state === 'developing' && r.ticket && (await lab.status(r.ticket)).state === 'ready') {
				await repo.save(markReady(r));
				list = await repo.list();
			}
		}
		rolls = list;
		const current = list.find((r) => r.state === 'loaded');
		winder.restore(!!current?.wound); // a wound camera stays wound across reloads
		armed = winder.armed;
	}

	async function startCamera() {
		if (!video || camera === 'starting' || camera === 'live') return;
		camera = 'starting';
		try {
			stream = await openCamera();
			video.srcObject = stream;
			await video.play();
			camera = 'live';
			if (!visible) stopCamera(); // hidden while the permission prompt was up
		} catch (e) {
			closeCamera(stream);
			stream = undefined;
			camera = e instanceof CameraError ? e.kind : 'unavailable';
		}
	}

	function stopCamera() {
		closeCamera(stream);
		stream = undefined;
		if (video) video.srcObject = null;
		camera = 'off';
	}

	async function loadRoll() {
		sounds.unlock();
		await persistStorage();
		await repo?.load(FILM_STOCK);
		winder.fire();
		armed = false;
		await refresh();
	}

	function tick() {
		sounds.unlock();
		sounds.tick();
	}

	function flick() {
		if (winder.flick()) {
			sounds.lock();
			buzz(HAPTIC.lock);
			if (inCamera) void repo?.setWound(inCamera.id, true);
		} else {
			sounds.notch();
			buzz(HAPTIC.notch);
		}
		armed = winder.armed;
	}

	async function shoot() {
		sounds.unlock();
		if (!repo || !inCamera || busy) return;
		if (!winder.armed || camera !== 'live' || !stream || !video) {
			sounds.dry();
			buzz(HAPTIC.dry);
			return;
		}
		busy = true;
		blackout = true;
		sounds.shutter();
		buzz(HAPTIC.shutter);
		const minBlack = new Promise((r) => setTimeout(r, SHUTTER_BLACKOUT_MS));
		try {
			const jpeg = await captureStill(stream, video);
			await repo.recordFrame(inCamera.id, await jpeg.arrayBuffer(), flash);
			winder.fire(); // the film is only consumed once the frame is safely stored
			armed = false;
			await minBlack;
			await refresh();
		} catch (e) {
			console.error(e);
			notice = 'captureFailed';
		} finally {
			await minBlack;
			blackout = false;
			busy = false;
		}
	}

	async function takeToLab() {
		if (!repo || !lab || !inCamera || !canDropOff(inCamera, rolls)) return;
		const ticket = await lab.dropOff(inCamera, repo.frames(inCamera.id));
		await repo.save(dropOff(inCamera, ticket));
		await refresh();
	}

	async function saveRoll() {
		if (!lab || atLab?.state !== 'ready') return;
		const delivery = await lab.collect(atLab);
		if (delivery.kind !== 'archive') return;
		const file = delivery.file;
		try {
			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({ files: [file] });
				saved = true;
				return;
			}
		} catch (e) {
			if ((e as DOMException).name === 'AbortError') return; // share sheet dismissed
		}
		const a = document.createElement('a');
		a.href = URL.createObjectURL(file);
		a.download = file.name;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
		saved = true;
	}

	async function finishCollect() {
		if (!repo || !atLab) return;
		await repo.remove(atLab.id);
		collecting = false;
		saved = false;
		await refresh();
	}

	async function installNow() {
		if (await promptInstall()) installGate = null;
	}

	function skipInstall() {
		sessionStorage.setItem('install-skipped', '1');
		installGate = null;
	}

	// Seven taps on the counter within 3 s toggle developer mode.
	function counterTap() {
		const now = Date.now();
		devTaps = [...devTaps.filter((t) => now - t < 3000), now];
		if (devTaps.length >= 7) {
			devTaps = [];
			dev = true;
			setDev(true);
			buzz(HAPTIC.lock);
		}
	}

	const cameraMessage: Record<string, MessageKey> = {
		denied: 'cameraDenied',
		unavailable: 'cameraUnavailable',
		insecure: 'cameraInsecure'
	};
</script>

<div class="app">
<Header onabout={() => (about = true)} onnotice={(m) => (notice = m)} />
{#if !booted}
	<main class="center"></main>
{:else if installGate}
	<main class="center">
		<section class="card">
			<h1>{t('installTitle')}</h1>
			{#if installGate === 'ios'}
				<p>{t('installBodyIOS')}</p>
			{:else if install.installed}
				<p>{t('installedOpen')}</p>
			{:else if install.available}
				<p>{t('installBodyAndroid')}</p>
				<button class="big" onclick={installNow}>{t('installButton')}</button>
			{:else}
				<p>{t('installBodyAndroidManual')}</p>
			{/if}
			<button class="link" onclick={skipInstall}>{t('installSkip')}</button>
		</section>
	</main>
{:else if shooting && inCamera}
	<main class="camera">
		<button class="counter" aria-label={t('framesLeft')} onclick={counterTap}>
			{#key inCamera.shot}
				<span class="digits" in:fly={{ y: -18, duration: 320 }}>{String(framesLeft(inCamera)).padStart(2, '0')}</span>
			{/key}
		</button>

		<div class="winder">
			<Thumbwheel {armed} label={t('wind')} onflick={flick} ontick={tick} />
		</div>

		<div class="finder-area">
			<div class="finder">
				<video bind:this={video} playsinline muted autoplay></video>
				<div class="blackout" class:on={blackout}></div>
				{#if cameraMessage[camera]}
					<div class="finder-msg">
						<p>{t(cameraMessage[camera])}</p>
						<button class="link" onclick={() => ((camera = 'off'), startCamera())}>{t('retry')}</button>
					</div>
				{/if}
			</div>
		</div>

		<div class="flash">
			{#if hasFlash()}<FlashToggle bind:on={flash} label={t('flash')} />{/if}
		</div>

		<button class="shutter" class:armed class:busy onclick={shoot} aria-label={t('shutter')}></button>
	</main>
{:else}
	<main class="center">
		<button class="counter" aria-label={t('framesLeft')} onclick={counterTap}>
			{inCamera ? '00' : '--'}
		</button>
		<section class="card">
			{#if inCamera}
				<p>{t('rollFull')}</p>
				{#if canDropOff(inCamera, rolls)}
					<button class="big" onclick={takeToLab}>{t('dropOff')}</button>
				{:else}
					<p class="small">{t('labBusy')}</p>
				{/if}
			{:else}
				<button class="big" onclick={loadRoll}>{t('loadNew')}</button>
			{/if}
		</section>
	</main>
{/if}

</div>

{#if booted && !installGate && atLab && !collecting}
	{#if atLab.state === 'ready'}
		<button class="lab ready" onclick={() => (collecting = true)}>{t('collectOpen')}</button>
	{:else}
		<p class="lab">{t('atLab')}</p>
	{/if}
{/if}

{#if collecting && atLab?.state === 'ready'}
	<section class="sheet">
		<h2>{t('ready')}</h2>
		<p class="small">{t('collectNote')}</p>
		{#if saved}
			<button class="big" onclick={finishCollect}>{t('collectDone')}</button>
			<button class="link" onclick={saveRoll}>{t('collectAgain')}</button>
		{:else}
			<button class="big" onclick={saveRoll}>{t('collectSave')}</button>
		{/if}
		<button class="link" onclick={() => ((collecting = false), (saved = false))}>{t('close')}</button>
	</section>
{/if}

{#if about}
	<section class="sheet">
		<h2>RETROVISEUR</h2>
		<p>{t('aboutBody')}</p>
		<p class="small">{t('aboutHow')}</p>
		<p class="small">
			{t('aboutCredits')} · <a href="https://github.com/Maigre/Retroviseur" target="_blank" rel="noopener">GitHub</a> · {__APP_VERSION__}
		</p>
		<button class="link" onclick={() => (about = false)}>{t('close')}</button>
	</section>
{/if}

{#if notice}
	<button class="notice" onclick={() => (notice = null)}>{t(notice)}</button>
{/if}

{#if dev && repo}
	<DevPanel {repo} {rolls} onchange={refresh} onexit={() => ((dev = false), setDev(false))} />
{/if}

<style>
	.app {
		height: 100%;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
	}
	main {
		min-height: 0;
		box-sizing: border-box;
		padding: 0.9rem max(0.9rem, env(safe-area-inset-right)) max(0.9rem, env(safe-area-inset-bottom))
			max(0.9rem, env(safe-area-inset-left));
	}

	/* Camera body. Portrait: counter + wheel on top, finder, flash + shutter at the
	   bottom (right thumb). Landscape: finder in the middle, wheel top-right and
	   shutter bottom-right, both under the right thumb. */
	.camera {
		display: grid;
		gap: 0.9rem;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto minmax(0, 1fr) auto;
		grid-template-areas:
			'counter winder'
			'finder finder'
			'flash shutter';
		align-items: center;
	}
	@container device (orientation: landscape) {
		.camera {
			grid-template-columns: 1fr auto 1fr;
			grid-template-rows: auto minmax(0, 1fr) auto;
			grid-template-areas:
				'counter finder winder'
				'. finder .'
				'flash finder shutter';
		}
	}
	.counter {
		grid-area: counter;
		justify-self: start;
		font: 2.1rem/1 var(--font);
		color: var(--accent);
		background: #000;
		border: 0;
		padding: 0.1rem 0.5rem;
		overflow: hidden;
		border-radius: 0.3rem;
		box-shadow: inset 0 0 0.4rem rgb(255 106 19 / 0.25);
		letter-spacing: 0.1em;
	}
	.digits {
		display: inline-block;
		animation: glow 700ms ease-out;
	}
	@keyframes glow {
		from {
			text-shadow: 0 0 0.6rem var(--accent);
			color: #ffd0b0;
		}
	}
	.winder {
		grid-area: winder;
		justify-self: end;
	}
	.flash {
		grid-area: flash;
		justify-self: start;
	}
	.shutter {
		grid-area: shutter;
		justify-self: end;
		width: 5.2rem;
		height: 5.2rem;
		border-radius: 50%;
		border: 0.4rem solid #2b2b2b;
		background: radial-gradient(circle at 40% 35%, #777, #444);
		box-shadow: 0 0.3rem 0 #000;
		transition: transform 60ms, box-shadow 60ms;
	}
	.shutter.armed {
		background: radial-gradient(circle at 40% 35%, #fafafa, #bbb);
	}
	.shutter:active,
	.shutter.busy {
		transform: translateY(0.25rem);
		box-shadow: 0 0.05rem 0 #000;
	}

	/* Tunnel viewfinder: small, soft, vignetted — never the film look. */
	.finder-area {
		grid-area: finder;
		height: 100%;
		min-height: 0;
		display: grid;
		place-items: center;
	}
	.finder {
		position: relative;
		height: min(100%, 22.5rem);
		aspect-ratio: 2 / 3;
		max-width: 100%;
		border-radius: 1rem;
		overflow: hidden;
		background: #000;
		box-shadow: 0 0 0 0.45rem #262626, 0 0 0 0.6rem #000;
	}
	@container device (orientation: landscape) {
		.finder {
			/* sized from the device height: a % height inside an auto column can't resolve */
			aspect-ratio: 3 / 2;
			height: auto;
			width: min(calc((100cqh - 6.5rem) * 1.5), calc(100cqw - 20rem), 24rem);
			max-width: none;
		}
		.winder :global(.wheel) {
			width: min(7.5rem, 22cqw);
		}
	}
	.finder video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(0.6px) saturate(0.85) brightness(0.95);
	}
	.finder::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(ellipse at center, transparent 45%, rgb(0 0 0 / 0.85) 100%);
		box-shadow: inset 0 0 1.5rem #000;
	}
	.blackout {
		position: absolute;
		inset: 0;
		background: #000;
		opacity: 0;
		z-index: 1;
		transition: opacity 280ms ease-in;
	}
	.blackout.on {
		opacity: 1;
		transition: none;
	}
	.finder-msg {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: grid;
		place-content: center;
		text-align: center;
		padding: 1rem;
		font-size: 0.85rem;
	}

	.center {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1.5rem;
	}
	.card {
		max-width: 22rem;
		text-align: center;
		display: grid;
		gap: 1rem;
	}
	.card h1,
	.sheet h2 {
		font-size: 1.25rem;
		margin: 0;
	}
	.big {
		font: 1.45rem/1 var(--font);
		padding: 0.9rem 1.4rem;
		border-radius: 0.8rem;
		border: 0;
		background: var(--accent);
		color: #000;
	}
	.link {
		background: none;
		border: 0;
		color: var(--muted);
		text-decoration: underline;
		font: inherit;
	}
	.sheet a {
		color: var(--accent);
	}
	.small {
		font-size: 1rem;
		color: var(--muted);
	}
	.lab {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: max(0.4rem, env(safe-area-inset-bottom));
		margin: 0;
		font-size: 1rem;
		color: var(--muted);
		background: none;
		border: 0;
		white-space: nowrap;
	}
	.lab.ready {
		color: var(--accent);
		text-decoration: underline;
		font: 1.15rem var(--font);
	}
	.sheet {
		position: absolute;
		inset: auto 0 0 0;
		z-index: 10;
		background: #1d1d1d;
		border-top: 1px solid #333;
		border-radius: 1rem 1rem 0 0;
		padding: 1.2rem 1.2rem max(1.2rem, env(safe-area-inset-bottom));
		display: grid;
		gap: 0.9rem;
		text-align: center;
	}
	.notice {
		position: absolute;
		top: calc(3.6rem + env(safe-area-inset-top));
		left: 1rem;
		right: 1rem;
		z-index: 15;
		padding: 0.7rem;
		border: 0;
		border-radius: 0.6rem;
		background: #332018;
		color: var(--fg);
		font: inherit;
	}
</style>
