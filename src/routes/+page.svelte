<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { CameraError, captureStill, closeCamera, flashSupport, openCamera, type FlashSupport } from '$lib/camera/capture';
	import { buzz, HAPTIC, Sounds } from '$lib/camera/sound';
	import { Winder } from '$lib/camera/winder';
	import DevPanel from '$lib/components/DevPanel.svelte';
	import FlashToggle from '$lib/components/FlashToggle.svelte';
	import Header from '$lib/components/Header.svelte';
	import Intro from '$lib/components/Intro.svelte';
	import { freeBytes, FRAME_BYTES, isQuotaError, ROLL_BYTES } from '$lib/storage/space';
	import Thumbwheel from '$lib/components/Thumbwheel.svelte';
	import { DATE_STAMP, FILM_STOCK, SHUTTER_BLACKOUT_MS } from '$lib/config';
	import { leakFor } from '$lib/film/leak';
	import { formatStamp } from '$lib/film/stamp';
	import { STOCKS } from '$lib/film/stocks';
	import { devEnabled, devLabEnabled, setDev } from '$lib/dev';
	import { detectLang, t, tf, type MessageKey } from '$lib/i18n';
	import { onBack } from '$lib/back';
	import { install, promptInstall, reallyInstalled } from '$lib/install.svelte';
	import { LocalTimelockLab } from '$lib/lab/local-timelock';
	import { LabClosedError, RemoteLab, type RemoteTicketData } from '$lib/lab/remote';
	import { holdsSomething, newHomeUrl, onOldHost } from '$lib/move';
	import { APK_URL, cancelNotify, exitApp, nativeShare, NATIVE, notifyAt, notifyId } from '$lib/native';
	import { formatDay, formatWindow, ticketMessage } from '$lib/lab/ticket';
	import type { Lab } from '$lib/lab/types';
	import { browserMode, isAndroid, isIOS, isStandalone, persistStorage, setBrowserMode } from '$lib/platform';
	import { RollRepository } from '$lib/roll/repository';
	import { dropOff, framesLeft, markReady } from '$lib/roll/roll';
	import { canDropOff } from '$lib/roll/rules';
	import type { Roll } from '$lib/roll/types';

	const sounds = new Sounds();
	const winder = new Winder();

	let repo = $state<RollRepository>();
	// the real lab (D44); the on-phone time-lock is kept as the dev lab
	let local: LocalTimelockLab | undefined;
	let remote = $state<RemoteLab>();
	const labFor = (r: Roll): Lab | undefined => (r.ticket?.lab === 'remote' || r.upload ? remote : local);
	const lang = detectLang();
	let uploading = $state<{ done: number; total: number } | null>(null);
	let rolls = $state<Roll[]>([]);
	let booted = $state(false);
	let installGate = $state<'ios' | 'android' | null>(null);
	// Install flow (D48): the gate never lets the browser app through on its own —
	// only the explicit "use it in the browser" choice does.
	let installStage = $state<'offer' | 'installing' | 'failed'>('offer');
	const platformGate = (): 'ios' | 'android' | null => (isIOS() ? 'ios' : isAndroid() ? 'android' : null);

	let armed = $state(false);
	let flash = $state(false);
	let busy = $state(false);
	let blackout = $state(false);
	let notice = $state<MessageKey | null>(null);
	let noticeVars = $state<Record<string, string | number>>({});
	// first-launch explanation (D50): shown once, and again from About
	let intro = $state(false);
	const INTRO_KEY = 'retroviseur-intro-seen';

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
	// lens cap on (D55): the camera is off until tapped open again
	let capped = $state(false);
	// the old address (D56): only a phone with a roll it alone holds stays here
	let moved = $state(false);

	let dev = $state(false);
	let lastCapture = $state('');
	// what the opened camera can do for the flash switch (D35); null = nothing
	let flashCaps = $state<FlashSupport | null>(null);
	let flashReport = $state('');
	let devTaps: number[] = [];

	const inCamera = $derived(rolls.find((r) => r.state === 'loaded' || r.state === 'full'));
	const atLab = $derived(rolls.find((r) => r.state === 'developing' || r.state === 'ready'));
	const shooting = $derived(inCamera?.state === 'loaded');
	/** a remote roll whose ticket hasn't been handed off yet: nothing else until it is */
	const pendingTicket = $derived(rolls.find((r) => r.ticket?.lab === 'remote' && !r.handedOff));
	const remoteData = (r: Roll) => r.ticket?.data as RemoteTicketData;
	const WEEK = 7 * 24 * 3_600_000;
	/** the lab calls back a week before it destroys uncollected prints */
	const labCalling = $derived(
		!!atLab && atLab.state === 'ready' && atLab.ticket?.lab === 'remote' && !!remoteData(atLab).expiresAt && Date.now() >= remoteData(atLab).expiresAt! - WEEK
	);

	onMount(() => {
		dev = devEnabled();
		if (!isStandalone() && !browserMode()) {
			installGate = platformGate();
			// already installed (e.g. a second visit in the browser): say so, don't offer again
			void reallyInstalled().then((yes) => yes && (install.installed = true));
		}
		void (async () => {
			try {
				intro = localStorage.getItem(INTRO_KEY) !== '1';
			} catch {
				intro = true;
			}
			repo = await RollRepository.open();
			local = new LocalTimelockLab(repo);
			remote = new RemoteLab(repo);
			await refresh();
			if (onOldHost()) {
				if (!holdsSomething(rolls)) return location.replace(newHomeUrl(location));
				moved = true;
			}
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
		const wanted = shooting && visible && !installGate && !capped && !!video;
		if (wanted && camera === 'off') void startCamera();
		if (!wanted && (camera === 'live' || camera === 'starting')) stopCamera();
	});

	async function refresh() {
		if (!repo) return;
		let list = await repo.list();
		// The lab's news is picked up on open (D16): ready, collected, gone.
		for (const r of list) {
			const lab = labFor(r);
			if (!lab || !r.ticket || (r.state !== 'developing' && r.state !== 'ready')) continue;
			if (r.ticket.lab === 'remote' && !r.handedOff) continue;
			let s;
			try {
				s = await lab.status(r.ticket);
			} catch {
				continue; // offline: try again next time
			}
			if (s.state === 'ready' && s.expiresAt && NATIVE && remoteData(r)?.expiresAt !== s.expiresAt) {
				// the lab calls a week before it destroys the prints (D16) — from the phone itself
				const until = formatDay(s.expiresAt, lang);
				void notifyAt(notifyId(r.id, 'call'), Math.max(Date.now() + 60_000, s.expiresAt - WEEK), t('ready'), tf('labCalled', { until }));
			}
			if (s.state === 'ready' && r.state === 'developing') {
				const ticket = s.expiresAt ? { ...r.ticket, data: { ...r.ticket.data, expiresAt: s.expiresAt } } : r.ticket;
				await repo.save({ ...markReady(r), ticket });
			} else if (s.state === 'ready' && s.expiresAt && remoteData(r)?.expiresAt !== s.expiresAt) {
				await repo.save({ ...r, ticket: { ...r.ticket, data: { ...r.ticket.data, expiresAt: s.expiresAt } } });
			} else if (s.state === 'collected' || s.state === 'gone') {
				// picked up — by whoever held the ticket — or destroyed: the backup goes too
				await repo.remove(r.id);
				void cancelNotify(notifyId(r.id, 'ready'));
				void cancelNotify(notifyId(r.id, 'call'));
				notice = s.state === 'collected' ? 'pickedUp' : 'labGone';
			}
		}
		rolls = await repo.list();
		list = rolls;
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
		const free = await freeBytes();
		if (free !== null && free < ROLL_BYTES) {
			noticeVars = { mb: Math.ceil(ROLL_BYTES / 1024 / 1024) };
			notice = 'storageLow';
			return;
		}
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
		const free = await freeBytes();
		if (free !== null && free < FRAME_BYTES) {
			notice = 'storageFull'; // the film stays wound: nothing is lost
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
			const film = {
				stock: STOCKS[inCamera.stock],
				seed: `${inCamera.id}:${inCamera.shot}`,
				stamp: DATE_STAMP ? formatStamp(Date.now()) : null,
				leak: leakFor(inCamera.shot, inCamera.exposures, inCamera.id)
			};
			const still = await captureStill(stream, video, turned ? -90 : 0, flash ? flashCaps : null, film);
			const tCapture = performance.now();
			await repo.recordFrame(inCamera.id, await still.jpeg.arrayBuffer(), flash);
			const track = stream.getVideoTracks()[0]?.getSettings();
			lastCapture = `${still.method}${still.developed ? ' +film' : ' (no film look)'} ${still.sourceWidth}×${still.sourceHeight} · capture ${Math.round(tCapture - t0)} ms + store ${Math.round(performance.now() - tCapture)} ms · stream ${track?.width}×${track?.height}`;
			winder.fire(); // the film is only consumed once the frame is safely stored
			armed = false;
			await minBlack;
			await refresh();
		} catch (e) {
			console.error(e);
			notice = isQuotaError(e) ? 'storageFull' : 'captureFailed';
		} finally {
			await minBlack;
			blackout = false;
			busy = false;
		}
	}

	async function takeToLab() {
		if (!repo || !inCamera || uploading || !canDropOff(inCamera, rolls)) return;
		const lab = devLabEnabled() ? local : remote;
		if (!lab) return;
		const id = inCamera.id;
		uploading = { done: 0, total: inCamera.shot + 1 };
		try {
			const ticket = await lab.dropOff(inCamera, repo.frames(id), (done, total) => (uploading = { done, total }));
			const fresh = (await repo.list()).find((r) => r.id === id)!; // holds the saved upload
			await repo.save({ ...dropOff(fresh, ticket), upload: undefined, handedOff: lab === local });
		} catch (e) {
			console.error(e);
			notice = e instanceof LabClosedError && e.reason === 'full' ? 'labFull' : 'labClosed';
		} finally {
			uploading = null;
			await refresh();
		}
	}

	// ---- the lab ticket: shared or copied, then the phone forgets the roll ----
	const ticketText = (r: Roll) => ticketMessage(remote!.link(r), remoteData(r).windowFrom, remoteData(r).windowTo, lang);

	async function handOff(proxy: Roll) {
		if (!repo) return;
		const r = $state.snapshot(proxy) as Roll; // IndexedDB can't store reactive proxies
		await repo.save({ ...r, handedOff: true });
		await repo.forget(r.id); // frames and key gone; the backup ticket stays
		// the app: the phone itself says when the prints should be back (no server push)
		const d = remoteData(r);
		if (d?.windowTo) void notifyAt(notifyId(r.id, 'ready'), d.windowTo, t('ready'), t('labReady'));
		await refresh();
	}

	async function shareTicket(r: Roll) {
		if (!navigator.share && !NATIVE) return copyTicket(r);
		try {
			const data = { title: 'Retroviseur', text: ticketText(r) };
			if (!(await nativeShare(data))) await navigator.share(data);
			await handOff(r);
		} catch (e) {
			if ((e as DOMException).name !== 'AbortError') await copyTicket(r);
		}
	}

	async function copyTicket(r: Roll) {
		let ok = false;
		try {
			await navigator.clipboard.writeText(ticketText(r));
			ok = true;
		} catch {
			// older path: select the ticket text in the sheet and copy it
			const area = document.querySelector<HTMLTextAreaElement>('.ticket textarea');
			if (area) {
				area.focus();
				area.select();
				ok = document.execCommand?.('copy') ?? false;
			}
		}
		if (!ok) return; // the text stays selectable, and "I saved it" hands off
		notice = 'ticketCopied';
		await handOff(r);
	}

	async function saveRoll() {
		// dev lab only: the real lab's pickup happens on the ticket page
		if (!local || atLab?.state !== 'ready') return;
		const delivery = await local.collect(atLab);
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
		installStage = 'installing';
		const accepted = await promptInstall();
		if (!accepted) return void (installStage = 'failed');
		// Chrome builds the app, then the Play Store installs it from its queue:
		// wait for the real thing (up to ~20 min), checking every few seconds
		for (let i = 0; i < 240 && installGate; i++) {
			const yes = await reallyInstalled();
			if (yes) return void (install.installed = true);
			if (yes === null) return; // can't tell here: the "installing" text stays
			await new Promise((r) => setTimeout(r, 5000));
		}
	}

	function useInBrowser() {
		setBrowserMode(true);
		installGate = null;
	}

	/**
	 * "Close the camera" (D55). A web page may not close itself unless a script
	 * opened it, so: try, and if it's still here, put the lens cap on instead —
	 * camera off, a tap to reopen. The Android app will truly exit here.
	 */
	function closeApp() {
		stopCamera();
		capped = true;
		if (NATIVE) return void exitApp(); // the app truly exits (D55)
		try {
			window.close();
		} catch {
			// refused: the lens cap stays on
		}
	}

	function introDone() {
		try {
			localStorage.setItem(INTRO_KEY, '1');
		} catch {
			// private mode: shown again next time
		}
		intro = false;
	}

	function offerInstall() {
		setBrowserMode(false);
		installStage = 'offer';
		about = false;
		installGate = platformGate();
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
<!-- one camera body: the header is its left end (held sideways), the grip its right end -->
<div class="shell">
	<Header onabout={() => (about = true)} onclose={closeApp} onnotice={(m) => (notice = m)} />

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
				{:else if installStage === 'installing'}
					<p>{t('installing')}</p>
					<p class="dots" aria-hidden="true">· · ·</p>
				{:else if installStage === 'failed'}
					<p>{t('installFailed')}</p>
					{#if install.available}
						<button class="big" onclick={installNow}>{t('installRetry')}</button>
					{:else}
						<p class="small">{t('installBodyAndroidManual')}</p>
					{/if}
				{:else if install.available}
					<p>{t('installBodyAndroid')}</p>
					<button class="big" onclick={installNow}>{t('installButton')}</button>
				{:else}
					<p>{t('installBodyAndroidManual')}</p>
				{/if}
				{#if !install.installed}
					<button class="link" onclick={useInBrowser}>{t('installSkip')}</button>
				{/if}
				{#if installGate === 'android'}
					<!-- the real app (D57): sideloaded APK for now -->
					<a class="link" href={APK_URL}>{t('getApk')}</a>
				{/if}
			</section>
		</main>
	{:else if capped}
		<main class="center capped">
			<button class="cap" onclick={() => (capped = false)} aria-label={t('closedTitle')}>
				<svg viewBox="0 0 100 100" aria-hidden="true">
					<circle cx="50" cy="50" r="44" class="cap-rim" />
					<circle cx="50" cy="50" r="34" class="cap-face" />
					<text x="50" y="55" class="cap-text">RETRO</text>
				</svg>
			</button>
			<section class="card">
				<h1>{t('closedTitle')}</h1>
				<p class="small">{t('closedBody')}</p>
			</section>
		</main>
	{:else if intro}
		<main class="intro-main"><Intro ondone={introDone} startLabel={rolls.length ? 'introNext' : 'introStart'} /></main>
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
			{#if atLab && !collecting && !pendingTicket}{@render labLine('lab')}{/if}
		</main>
	{/if}
</div>
</div>

{#snippet labLine(cls: string)}
	{#if atLab}
		{#if atLab.ticket?.lab === 'remote'}
			{@const d = remoteData(atLab)}
			{#if atLab.state === 'ready'}
				<a class="{cls} ready" class:calling={labCalling} href={remote?.link(atLab)}>
					{labCalling ? tf('labCalled', { until: formatDay(d.expiresAt!, lang) }) : t('labReady')}
				</a>
			{:else}
				{@const w = formatWindow(d.windowFrom, d.windowTo, lang)}
				<p class={cls}>{tf('atLabWindow', { from: w.from, to: w.to })}</p>
			{/if}
		{:else if atLab.state === 'ready'}
			<button class="{cls} ready" onclick={() => (collecting = true)}>{t('collectOpen')}</button>
		{:else}
			<p class={cls}>{t('atLab')}</p>
		{/if}
	{/if}
{/snippet}

{#if booted && !installGate && shooting && atLab && !collecting && !pendingTicket}
	<!-- while shooting, the lab status is a small tag over the finder, never over the controls -->
	{@render labLine('lab-tag')}
{/if}

{#if uploading}
	<section class="sheet">
		<h2>{t('dropOff')}</h2>
		<p>{tf('labUploading', uploading)}</p>
		<progress max={uploading.total} value={uploading.done}></progress>
	</section>
{/if}

{#if pendingTicket && !uploading}
	<!-- blocking: the roll only leaves the phone once its ticket is safe somewhere -->
	<section class="sheet ticket">
		<h2>{t('ticketTitle')}</h2>
		<p class="small">{t('ticketBody')}</p>
		<textarea readonly rows="5" onfocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()}>{ticketText(pendingTicket)}</textarea>
		<button class="big" onclick={() => shareTicket(pendingTicket)}>{t('ticketShare')}</button>
		<button class="link" onclick={() => copyTicket(pendingTicket)}>{t('ticketCopy')}</button>
		<button class="link" onclick={() => handOff(pendingTicket)}>{t('ticketSaved')}</button>
	</section>
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

{#if moved && !pendingTicket && !uploading}
	<section class="sheet">
		<h2>{t('movedTitle')}</h2>
		<p class="small">{t('movedBody')}</p>
		<button class="big" onclick={() => (moved = false)}>{t('movedOk')}</button>
	</section>
{/if}

{#if about}
	<section class="sheet">
		<button class="x" aria-label={t('close')} onclick={() => (about = false)}>✕</button>
		<h2>RETROVISEUR</h2>
		<p>{t('aboutBody')}</p>
		<p class="small">{t('aboutHow')}</p>
		<button class="link" onclick={() => ((about = false), (intro = true))}>{t('introHow')}</button>
		<p class="small">{t('aboutPrivacy')}</p>
		{#if !isStandalone() && platformGate()}
			<button class="link" onclick={offerInstall}>{t('installAgain')}</button>
		{/if}
		<p class="small">
			{t('aboutCredits')} · <a href="https://github.com/Maigre/Retroviseur" target="_blank" rel="noopener">GitHub</a> · {__APP_VERSION__}
			<br />{t('aboutContact')} <a href="mailto:contact@waverz.net">contact@waverz.net</a>
		</p>
	</section>
{/if}

{#if notice}
	<button class="notice" onclick={() => ((notice = null), (noticeVars = {}))}>{tf(notice, noticeVars)}</button>
{/if}

{#if dev && repo}
	<DevPanel {repo} {rolls} {lastCapture} {flashReport} onchange={refresh} onexit={() => ((dev = false), setDev(false))} />
{/if}

<style>
	/* The whole screen is one camera body (D39): a grey shell with a slim black
	   margin. Held sideways, its left end carries the header, its right end the
	   rounded grip — so the tighter corners are on the header side (the screen's
	   top) and the fuller ones on the grip side (the screen's bottom). */
	.app {
		height: 100%;
		box-sizing: border-box;
		padding: calc(env(safe-area-inset-top) + 0.3rem) calc(env(safe-area-inset-right) + 0.3rem)
			calc(env(safe-area-inset-bottom) + 0.3rem) calc(env(safe-area-inset-left) + 0.3rem);
	}
	.shell {
		height: 100%;
		box-sizing: border-box;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		border: 2px solid var(--shell);
		border-radius: 1.3rem 1.3rem 2.2rem 2.2rem;
		overflow: hidden;
		background: linear-gradient(90deg, var(--shell-in), var(--bg) 45%, var(--bg) 55%, var(--shell-in));
	}
	@container device (orientation: landscape) {
		.shell {
			border-radius: 1.3rem 2.2rem 2.2rem 1.3rem;
		}
	}
	main {
		min-height: 0;
		min-width: 0;
		box-sizing: border-box;
		padding: 0.6rem;
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
	/* The grip, drawn behind the shutter at the stage's right end (the shell's
	   grip end): a rounded, faintly grained pad like a compact's hand grip. */
	.stage::after {
		content: '';
		position: absolute;
		pointer-events: none;
		top: 0;
		bottom: 0;
		right: 0;
		width: calc(var(--shutter) + 1.2 * var(--side));
		border-left: 2px solid var(--shell);
		border-radius: 1.2rem 0 0 1.2rem;
		background:
			radial-gradient(circle at 30% 30%, rgb(255 255 255 / 0.035) 0.6px, transparent 1.2px) 0 0 / 5px 5px,
			linear-gradient(90deg, #181a18, #121412);
		box-shadow: inset 0.35rem 0 0.6rem rgb(0 0 0 / 0.45);
	}
	.block {
		position: relative;
		z-index: 1;
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
		z-index: 1;
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
	.cap {
		background: none;
		border: 0;
		padding: 0;
		width: min(12rem, 50cqw);
	}
	.cap svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.cap-rim {
		fill: #1a1c1a;
		stroke: #000;
		stroke-width: 2;
	}
	.cap-face {
		fill: #111311;
		stroke: #2c2f2c;
		stroke-width: 3;
	}
	.cap-text {
		font: italic 13px var(--font);
		fill: #3a3d3a;
		text-anchor: middle;
		letter-spacing: 2px;
	}
	.intro-main {
		padding: 0;
	}
	.dots {
		letter-spacing: 0.4em;
		color: var(--accent);
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.3;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dots {
			animation: none;
		}
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
	.sheet progress {
		width: 100%;
		accent-color: var(--accent);
	}
	.ticket textarea {
		width: 100%;
		box-sizing: border-box;
		font: 0.95rem/1.35 ui-monospace, monospace;
		background: #0b0d0b;
		color: var(--fg);
		border: 1px solid #333;
		border-radius: 0.5rem;
		padding: 0.5rem;
		resize: none;
		user-select: text;
		-webkit-user-select: text;
	}
	.lab.calling,
	.lab-tag.calling {
		background: var(--accent);
		color: #111;
		text-decoration: none;
		padding: 0.3rem 0.6rem;
		border-radius: 0.35rem;
		white-space: normal;
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
