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
	import { onBack } from '$lib/back';
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

	// Android back closes an open sheet instead of leaving the app.
	$effect(() => {
		if (about) return onBack(() => (about = false));
	});
	$effect(() => {
		if (collecting) return onBack(() => ((collecting = false), (saved = false)));
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
		<!-- Viewfinder takes everything the controls don't need. All controls live in
		     one deck: bottom in portrait, right-hand side in landscape — right thumb. -->
		<main class="camera">
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

			<div class="deck">
				<div class="info">
					<button class="counter" aria-label={t('framesLeft')} onclick={counterTap}>
						{#key inCamera.shot}
							<span class="digits" in:fly={{ y: -18, duration: 320 }}>{String(framesLeft(inCamera)).padStart(2, '0')}</span>
						{/key}
					</button>
					{#if hasFlash()}<FlashToggle bind:on={flash} label={t('flash')} />{/if}
				</div>
				<div class="controls">
					<div class="winder">
						<Thumbwheel {armed} label={t('wind')} onflick={flick} ontick={tick} />
					</div>
					<button class="shutter" class:armed class:busy onclick={shoot} aria-label={t('shutter')}></button>
				</div>
			</div>
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
			{#if atLab && !collecting}
				{#if atLab.state === 'ready'}
					<button class="lab ready" onclick={() => (collecting = true)}>{t('collectOpen')}</button>
				{:else}
					<p class="lab">{t('atLab')}</p>
				{/if}
			{/if}
		</main>
	{/if}
</div>

{#if booted && !installGate && shooting && atLab && !collecting}
	<!-- while shooting, the lab status is a small tag over the finder, never over the controls -->
	{#if atLab.state === 'ready'}
		<button class="lab-tag ready" onclick={() => (collecting = true)}>{t('collectOpen')}</button>
	{:else}
		<p class="lab-tag">{t('atLab')}</p>
	{/if}
{/if}

{#if collecting && atLab?.state === 'ready'}
	<section class="sheet">
		<button class="x" aria-label={t('close')} onclick={() => ((collecting = false), (saved = false))}>✕</button>
		<h2>{t('ready')}</h2>
		<p class="small">{t('collectNote')}</p>
		{#if saved}
			<button class="big" onclick={finishCollect}>{t('collectDone')}</button>
			<button class="link" onclick={saveRoll}>{t('collectAgain')}</button>
		{:else}
			<button class="big" onclick={saveRoll}>{t('collectSave')}</button>
		{/if}
	</section>
{/if}

{#if about}
	<section class="sheet">
		<button class="x" aria-label={t('close')} onclick={() => (about = false)}>✕</button>
		<h2>RETROVISEUR</h2>
		<p>{t('aboutBody')}</p>
		<p class="small">{t('aboutHow')}</p>
		<p class="small">
			{t('aboutCredits')} · <a href="https://github.com/Maigre/Retroviseur" target="_blank" rel="noopener">GitHub</a> · {__APP_VERSION__}
		</p>
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
		min-width: 0;
		box-sizing: border-box;
		padding: 0.6rem max(0.6rem, env(safe-area-inset-right)) max(0.6rem, env(safe-area-inset-bottom))
			max(0.6rem, env(safe-area-inset-left));
	}
	/* Everything below is sized from the device (cq* units), never from rem
	   alone, so a small or font-scaled phone can't push controls off-screen. */
	.camera {
		--shutter: clamp(3.4rem, 19cqmin, 4.8rem);
		display: grid;
		gap: 0.6rem;
		grid-template-rows: minmax(0, 1fr) auto;
		grid-template-columns: minmax(0, 1fr);
	}
	@container device (orientation: landscape) {
		.camera {
			grid-template-rows: minmax(0, 1fr);
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}

	/* Tunnel viewfinder: as large as the space allows, soft, vignetted — never
	   the film look. Its area is a size container so it can fit 2:3 / 3:2. */
	.finder-area {
		min-height: 0;
		min-width: 0;
		container-type: size;
		display: grid;
		place-items: center;
	}
	.finder {
		position: relative;
		aspect-ratio: 2 / 3;
		width: min(calc(100cqw - 1rem), calc((100cqh - 1rem) * 2 / 3));
		border-radius: 0.9rem;
		overflow: hidden;
		background: #000;
		box-shadow: 0 0 0 0.35rem #262626, 0 0 0 0.45rem #000;
	}
	@container device (orientation: landscape) {
		.finder {
			aspect-ratio: 3 / 2;
			width: min(calc(100cqw - 1rem), calc((100cqh - 1rem) * 3 / 2));
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
		font-size: 1rem;
	}

	/* The deck. Portrait: counter + flash left, wheel + shutter right, in a row.
	   Landscape: a column on the right, shutter at the bottom. */
	.deck {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.6rem;
		min-width: 0;
	}
	.info {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
		min-width: 0;
	}
	.controls {
		display: flex;
		align-items: flex-end;
		gap: clamp(0.6rem, 4cqw, 1.2rem);
		/* keep the wheel off the right edge: edge swipes are Android's back */
		flex: none;
	}
	.winder {
		width: calc(var(--shutter) * 0.5);
		height: calc(var(--shutter) * 1.35);
	}
	@container device (orientation: landscape) {
		.deck {
			flex-direction: column;
			align-items: flex-end;
			justify-content: space-between;
			height: 100%;
		}
		.info {
			align-items: flex-end;
		}
	}
	.counter {
		font: clamp(1.4rem, 9cqmin, 2rem) / 1 var(--font);
		color: #111;
		background: var(--window);
		border: 0;
		padding: 0.1rem 0.45rem;
		border-radius: 0.3rem;
		box-shadow: inset 0 0.15rem 0.3rem rgb(0 0 0 / 0.45), 0 0 0 0.15rem #000;
		letter-spacing: 0.1em;
		overflow: hidden;
	}
	.digits {
		display: inline-block;
		animation: glow 700ms ease-out;
	}
	/* counter roll: the new number drops in over a brief yellow flash */
	@keyframes glow {
		from {
			background: var(--accent);
		}
	}
	.shutter {
		flex: none;
		width: var(--shutter);
		height: var(--shutter);
		border-radius: 50%;
		border: calc(var(--shutter) * 0.08) solid #2b2b2b;
		background: radial-gradient(circle at 40% 35%, #777, #444);
		box-shadow: 0 0.25rem 0 #000;
		transition: transform 60ms, box-shadow 60ms;
	}
	.shutter.armed {
		background: radial-gradient(circle at 40% 35%, #fafafa, #bbb);
	}
	.shutter:active,
	.shutter.busy {
		transform: translateY(0.2rem);
		box-shadow: 0 0.05rem 0 #000;
	}

	.center {
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 1.2rem;
		overflow: auto;
	}
	.card {
		width: min(22rem, 100%);
		box-sizing: border-box;
		text-align: center;
		display: grid;
		gap: 0.9rem;
		font-size: 1.15rem;
		overflow-wrap: anywhere;
	}
	.card h1,
	.sheet h2 {
		font: 1.35rem/1.1 var(--font);
		margin: 0;
	}
	.card p {
		margin: 0;
	}
	.big {
		font: 1.35rem/1.1 var(--font);
		padding: 0.75rem 1.1rem;
		border-radius: 0.7rem;
		border: 0;
		background: var(--accent);
		color: var(--accent-fg);
		box-shadow: 0 0.2rem 0 #8a6a00;
		max-width: 100%;
	}
	.link {
		background: none;
		border: 0;
		color: var(--muted);
		text-decoration: underline;
		font: inherit;
		font-size: 1rem;
	}
	.small {
		font-size: 1rem;
		color: var(--muted);
	}
	.lab {
		margin: 0;
		text-align: center;
		font-size: 1rem;
		color: var(--muted);
		background: none;
		border: 0;
	}
	.lab.ready,
	.lab-tag.ready {
		color: var(--accent);
		text-decoration: underline;
		font-family: var(--font);
	}
	.lab-tag {
		position: absolute;
		top: calc(2.9rem + env(safe-area-inset-top));
		left: 50%;
		transform: translateX(-50%);
		max-width: 90%;
		margin: 0;
		padding: 0.1rem 0.5rem;
		font-size: 0.95rem;
		color: var(--muted);
		background: rgb(0 0 0 / 0.6);
		border: 0;
		border-radius: 0.3rem;
		z-index: 3;
	}
	.sheet {
		position: absolute;
		inset: auto 0 0 0;
		max-height: 85%;
		overflow: auto;
		z-index: 10;
		background: #1d1d1d;
		border-top: 1px solid #333;
		border-radius: 1rem 1rem 0 0;
		padding: 1rem max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom))
			max(1rem, env(safe-area-inset-left));
		display: grid;
		gap: 0.8rem;
		text-align: center;
		font-size: 1.1rem;
	}
	.sheet p {
		margin: 0;
	}
	/* close stays reachable however long the sheet gets */
	.sheet .x {
		position: sticky;
		top: 0;
		justify-self: end;
		margin-bottom: -2.2rem;
		width: 2.2rem;
		height: 2.2rem;
		border: 0;
		border-radius: 50%;
		background: #333;
		color: var(--fg);
		font-size: 1.1rem;
		z-index: 1;
	}
	.sheet h2 {
		padding: 0 2.4rem;
	}
	.sheet a {
		color: var(--accent);
	}
	.notice {
		position: absolute;
		top: calc(2.9rem + env(safe-area-inset-top));
		left: 0.8rem;
		right: 0.8rem;
		z-index: 15;
		padding: 0.6rem;
		border: 0;
		border-radius: 0.5rem;
		background: #10321f;
		border-left: 0.3rem solid var(--stripe);
		color: var(--fg);
		font: 1.05rem var(--font);
	}
</style>
