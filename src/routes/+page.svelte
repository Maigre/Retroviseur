<script lang="ts">
	import { onMount } from 'svelte';
	import { CameraError, captureStill, closeCamera, openCamera } from '$lib/camera/capture';
	import { buzz, Sounds } from '$lib/camera/sound';
	import { Winder } from '$lib/camera/winder';
	import Thumbwheel from '$lib/components/Thumbwheel.svelte';
	import { FILM_STOCK } from '$lib/config';
	import { t, type MessageKey } from '$lib/i18n';
	import { LocalTimelockLab } from '$lib/lab/local-timelock';
	import { hasFlash, isIOS, isStandalone, persistStorage } from '$lib/platform';
	import { RollRepository } from '$lib/roll/repository';
	import { dropOff, framesLeft, markReady } from '$lib/roll/roll';
	import { canDropOff } from '$lib/roll/rules';
	import type { Roll } from '$lib/roll/types';

	const lab = new LocalTimelockLab();
	const sounds = new Sounds();
	const winder = new Winder();

	let repo: RollRepository | undefined;
	let rolls = $state<Roll[]>([]);
	let booted = $state(false);
	let installGate = $state(false);

	let armed = $state(false);
	let flash = $state(false);
	let busy = $state(false);
	let blackout = $state(false);
	let notice = $state<MessageKey | null>(null);

	let video = $state<HTMLVideoElement>();
	let stream: MediaStream | undefined;
	let camera = $state<'off' | 'starting' | 'live' | 'denied' | 'unavailable' | 'insecure'>('off');
	let visible = $state(true);

	const inCamera = $derived(rolls.find((r) => r.state === 'loaded' || r.state === 'full'));
	const atLab = $derived(rolls.find((r) => r.state === 'developing' || r.state === 'ready'));
	const shooting = $derived(inCamera?.state === 'loaded');

	onMount(() => {
		installGate = isIOS() && !isStandalone() && sessionStorage.getItem('install-skipped') !== '1';
		void (async () => {
			repo = await RollRepository.open();
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
		if (!repo) return;
		let list = await repo.list();
		// "Ready" is noticed on open (D16).
		for (const r of list) {
			if (r.state === 'developing' && r.ticket && (await lab.status(r.ticket)).state === 'ready') {
				await repo.save(markReady(r));
				list = await repo.list();
			}
		}
		rolls = list;
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

	function flick() {
		sounds.unlock();
		if (winder.flick()) {
			sounds.lock();
			buzz(35);
		} else {
			sounds.tick();
			buzz(6);
		}
		armed = winder.armed;
	}

	async function shoot() {
		sounds.unlock();
		if (!repo || !inCamera || busy) return;
		if (!winder.armed || camera !== 'live' || !stream || !video) {
			sounds.dry();
			buzz(4);
			return;
		}
		busy = true;
		blackout = true;
		sounds.shutter();
		buzz(18);
		const minBlack = new Promise((r) => setTimeout(r, 140));
		try {
			const jpeg = await captureStill(stream, video);
			await repo.recordFrame(inCamera.id, await jpeg.arrayBuffer(), flash);
			winder.fire(); // the film is only consumed once the frame is safely stored
			armed = false;
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
		if (!repo || !inCamera || !canDropOff(inCamera, rolls)) return;
		const ticket = await lab.dropOff(inCamera, repo.frames(inCamera.id));
		await repo.save(dropOff(inCamera, ticket));
		await refresh();
	}

	function skipInstall() {
		sessionStorage.setItem('install-skipped', '1');
		installGate = false;
	}

	const cameraMessage: Record<string, MessageKey> = {
		denied: 'cameraDenied',
		unavailable: 'cameraUnavailable',
		insecure: 'cameraInsecure'
	};
</script>

<main class="body">
	{#if !booted}
		<!-- opening the film box -->
	{:else if installGate}
		<section class="card">
			<h1>{t('installTitle')}</h1>
			<p>{t('installBody')}</p>
			<button class="link" onclick={skipInstall}>{t('installSkip')}</button>
		</section>
	{:else if inCamera}
		<div class="counter" aria-label={t('framesLeft')}>{String(framesLeft(inCamera)).padStart(2, '0')}</div>

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

		{#if shooting}
			{#if hasFlash()}
				<label class="flash"><input type="checkbox" bind:checked={flash} /> {t('flash')}</label>
			{/if}
			<Thumbwheel {armed} label={t('wind')} onflick={flick} />
			<button class="shutter" class:armed onclick={shoot} aria-label={t('shutter')}></button>
		{:else}
			<section class="card">
				<p>{t('rollFull')}</p>
				{#if canDropOff(inCamera, rolls)}
					<button class="big" onclick={takeToLab}>{t('dropOff')}</button>
				{:else}
					<p class="small">{t('labBusy')}</p>
				{/if}
			</section>
		{/if}
	{:else}
		<section class="card">
			<button class="big" onclick={loadRoll}>{t('loadNew')}</button>
		</section>
	{/if}

	{#if booted && !installGate && atLab}
		<p class="lab small">{t(atLab.state === 'ready' ? 'readySoon' : 'atLab')}</p>
	{/if}

	{#if notice}
		<button class="notice" onclick={() => (notice = null)}>{t(notice)}</button>
	{/if}
</main>

<style>
	:global(:root) {
		--bg: #111;
		--body: #1b1b1b;
		--fg: #eee;
		--muted: #999;
		--accent: #ff6a13;
	}
	:global(body) {
		margin: 0;
		background: var(--bg);
		color: var(--fg);
		font-family: system-ui, sans-serif;
		overscroll-behavior: none;
		-webkit-user-select: none;
		user-select: none;
	}
	.body {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.6rem;
		padding: max(1.5rem, env(safe-area-inset-top)) 1rem max(1.5rem, env(safe-area-inset-bottom));
		box-sizing: border-box;
		position: relative;
		background: radial-gradient(circle at 50% 40%, var(--body), var(--bg) 70%);
	}
	.counter {
		font: 700 1.5rem ui-monospace, monospace;
		color: var(--accent);
		background: #000;
		padding: 0.15rem 0.55rem;
		border-radius: 0.3rem;
		box-shadow: inset 0 0 0.4rem rgb(255 106 19 / 0.25);
		letter-spacing: 0.1em;
	}
	/* Tunnel viewfinder: small, soft, vignetted — never the film look. */
	.finder {
		position: relative;
		width: min(56vw, 15rem);
		aspect-ratio: 2 / 3;
		border-radius: 1rem;
		overflow: hidden;
		background: #000;
		box-shadow: 0 0 0 0.45rem #262626, 0 0 0 0.6rem #000;
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
	}
	.blackout.on {
		opacity: 1;
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
	.shutter {
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
	.shutter:active {
		transform: translateY(0.25rem);
		box-shadow: 0 0.05rem 0 #000;
	}
	.flash {
		font-size: 0.9rem;
		color: var(--muted);
	}
	.card {
		max-width: 22rem;
		text-align: center;
		display: grid;
		gap: 1rem;
	}
	.card h1 {
		font-size: 1.3rem;
		margin: 0;
	}
	.big {
		font: 600 1.1rem system-ui, sans-serif;
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
	.small {
		font-size: 0.85rem;
		color: var(--muted);
	}
	.lab {
		position: absolute;
		bottom: max(0.8rem, env(safe-area-inset-bottom));
		margin: 0;
		padding: 0 1rem;
		text-align: center;
	}
	.notice {
		position: absolute;
		top: max(0.8rem, env(safe-area-inset-top));
		left: 1rem;
		right: 1rem;
		padding: 0.7rem;
		border: 0;
		border-radius: 0.6rem;
		background: #332018;
		color: var(--fg);
		font: inherit;
	}
</style>
