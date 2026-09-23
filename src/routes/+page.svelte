<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { CameraError, captureStill, closeCamera, flashSupport, openCamera, type FlashSupport } from '$lib/camera/capture';
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
	import { isAndroid, isIOS, isStandalone, persistStorage } from '$lib/platform';
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

	// The camera stage is turned when the space below the header is portrait.
	let bodyW = $state(0);
	let bodyH = $state(0);
	const turned = $derived(bodyH > bodyW);

	let collecting = $state(false);
	let saved = $state(false);

	let about = $state(false);

	let dev = $state(false);
	let lastCapture = $state('');
	// what the opened camera can do for the flash switch (D35); null = nothing
	let flashCaps = $state<FlashSupport | null>(null);
	let flashReport = $state('');
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
			const f = await flashSupport(stream).catch(() => null);
			flashCaps = f && (f.fill || f.torch) ? f : null;
			flashReport = f?.report ?? 'unknown';
			if (!flashCaps) flash = false;
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
		blackout = true; // dark until the counter rolls, never shorter than a blink (D34)
		const minBlack = new Promise((r) => setTimeout(r, SHUTTER_BLACKOUT_MS));
		sounds.shutter();
		buzz(HAPTIC.shutter);
		const t0 = performance.now();
		try {
			// turned stage = phone held sideways on a portrait screen → rotate the frame upright
			const still = await captureStill(stream, video, turned ? -90 : 0, flash ? flashCaps : null);
			const tCapture = performance.now();
			await repo.recordFrame(inCamera.id, await still.jpeg.arrayBuffer(), flash);
			const track = stream.getVideoTracks()[0]?.getSettings();
			lastCapture = `${still.method} ${still.sourceWidth}×${still.sourceHeight} · capture ${Math.round(tCapture - t0)} ms + store ${Math.round(performance.now() - tCapture)} ms · stream ${track?.width}×${track?.height}`;
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
		<!-- A landscape camera on a portrait-locked screen (D31). The stage is laid
		     out in landscape — tools along the top (counter + flash left, wheel +
		     shutter right), finder below — and turned a quarter-turn clockwise when the
		     screen is portrait, so it reads upright with the phone held sideways and
		     the header on the left. The shutter lands top-right, like a real camera. -->
		<main class="camera" bind:clientWidth={bodyW} bind:clientHeight={bodyH} style:--body-w="{bodyW}px" style:--body-h="{bodyH}px">
			<div class="stage" class:turned>
				<div class="block">
				<div class="tools">
					<div class="info">
						<button class="counter" aria-label={t('framesLeft')} onclick={counterTap}>
							{#key inCamera.shot}
								<span class="digits" in:fly={{ y: -18, duration: 320 }}>{String(framesLeft(inCamera)).padStart(2, '0')}</span>
							{/key}
						</button>
						{#if flashCaps}<FlashToggle bind:on={flash} label={t('flash')} />{/if}
					</div>
					<div class="winder">
						<Thumbwheel {armed} {turned} label={t('wind')} onflick={flick} ontick={tick} />
					</div>
					<!-- hangs past the finder's right edge, as far from it as the block is from the header -->
					<button class="shutter" class:armed class:busy onclick={shoot} aria-label={t('shutter')}></button>
				</div>
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
	<DevPanel {repo} {rolls} {lastCapture} {flashReport} onchange={refresh} onexit={() => ((dev = false), setDev(false))} />
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
		/* the red hairline frame continues from the header down both sides and along the bottom */
		border: 1px solid var(--stripe);
		border-top: 0;
		padding: 0.6rem max(0.6rem, env(safe-area-inset-right)) max(0.6rem, env(safe-area-inset-bottom))
			max(0.6rem, env(safe-area-inset-left));
	}
	/* Camera stage, laid out in landscape. Sizes come from the stage container
	   (cq* units), never from rem alone. */
	.camera {
		position: relative;
		padding: 0;
		overflow: hidden;
	}
	/* One width for the tools row and the finder (--fw): the counter lines up
	   with the finder's left edge, the wheel with its right edge, and the shutter
	   hangs just past it. The custom properties resolve against the stage
	   container where they are used (its content box, i.e. inside the padding);
	   the stage's own padding and gap can't use cq units — they would resolve
	   against the device instead. */
	.stage {
		--gap: 0.6rem;
		/* header → block, block → shutter and shutter → edge are all this wide,
		   so the shutter sits centred in the free space on the right */
		--side: calc((100cqw - var(--fw) - var(--shutter)) / 3);
		--shutter: clamp(2.5rem, 17cqh, 4.2rem);
		--fw: min(
			calc(100cqw - var(--shutter) - 3 * max(var(--gap), 1.2rem)),
			calc((100cqh - var(--shutter) - var(--gap) - 0.9rem) * 3 / 2)
		);
		position: absolute;
		inset: 0;
		container: stage / size;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		padding: 0.6rem 0;
		box-sizing: border-box;
	}
	.block {
		position: relative;
		margin-left: var(--side);
		display: flex;
		flex-direction: column;
		gap: var(--gap);
	}
	/* Portrait screen: swap the stage's width/height and turn it a quarter-turn
	   clockwise — its top edge becomes the screen's right edge. */
	.stage.turned {
		inset: auto;
		top: 0;
		left: 0;
		width: var(--body-h);
		height: var(--body-w);
		transform-origin: 0 0;
		transform: translateX(var(--body-w)) rotate(90deg);
	}
	.tools {
		position: relative;
		width: var(--fw);
		height: var(--shutter);
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 3cqw;
	}
	.info {
		display: flex;
		align-items: center;
		gap: clamp(0.5rem, 3cqw, 1.2rem);
		min-width: 0;
	}
	.winder {
		flex: none;
		width: min(calc(var(--shutter) * 2.6), 45%);
		height: calc(var(--shutter) * 0.72);
	}

	/* Tunnel viewfinder, 3:2 landscape. */
	.finder {
		position: relative;
		container-type: size;
		flex: none;
		aspect-ratio: 3 / 2;
		width: var(--fw);
		border-radius: 0.9rem;
		overflow: hidden;
		background: #000;
		box-shadow: 0 0 0 0.35rem #262626, 0 0 0 0.45rem #000;
	}
	.finder video {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 100cqw;
		height: 100cqh;
		transform: translate(-50%, -50%);
		object-fit: cover;
		filter: blur(0.6px) saturate(0.85) brightness(0.95);
	}
	/* On a turned stage the finder is a window onto the scene: undo the stage's
	   quarter-turn for the video itself. */
	.turned .finder video {
		width: 100cqh;
		height: 100cqw;
		transform: translate(-50%, -50%) rotate(-90deg);
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
		transition: opacity 120ms ease-in;
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
	.counter {
		font: clamp(1.2rem, 10cqh, 1.9rem) / 1 var(--font);
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
		position: absolute;
		left: calc(100% + var(--side));
		top: 0;
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
