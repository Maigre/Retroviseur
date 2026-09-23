<script lang="ts">
	// Developer-only sheet (English only, never localised — see src/lib/dev.ts).
	import { onDestroy } from 'svelte';
	import { onBack } from '$lib/back';
	import { buzz } from '$lib/camera/sound';
	import { devLabEnabled, fillRoll, setDevLab, skipWait, viewFrames, wipeEverything, type DevFrame } from '$lib/dev';
	import { FILM_STOCK } from '$lib/config';
	import { filmSupported } from '$lib/film/develop';
	import type { RollRepository } from '$lib/roll/repository';
	import type { Roll } from '$lib/roll/types';

	let {
		repo,
		rolls,
		lastCapture = '',
		flashReport = '',
		onchange,
		onexit
	}: { repo: RollRepository; rolls: Roll[]; lastCapture?: string; flashReport?: string; onchange: () => Promise<void>; onexit: () => void } = $props();

	let busy = $state(false);
	let frames = $state<DevFrame[]>([]);
	let zoom = $state<number | null>(null); // index into frames
	let log = $state('');
	let open = $state(true);
	let devLab = $state(devLabEnabled());

	// Android back closes the viewer, then the panel — never the app.
	$effect(() => {
		if (zoom !== null) return onBack(() => (zoom = null));
	});
	$effect(() => {
		if (open) return onBack(() => (open = false));
	});

	const current = $derived(zoom === null ? null : frames[zoom]);
	function step(d: number) {
		if (zoom === null) return;
		zoom = (zoom + d + frames.length) % frames.length;
	}
	let swipeX = 0;

	async function run(label: string, fn: () => Promise<unknown>) {
		busy = true;
		log = `${label}…`;
		try {
			await fn();
			await onchange();
			log = `${label}: done`;
		} catch (e) {
			log = `${label}: ${e}`;
		} finally {
			busy = false;
		}
	}

	function clearFrames() {
		frames.forEach((f) => URL.revokeObjectURL(f.url));
		frames = [];
		zoom = null;
	}

	async function show(roll: Roll) {
		clearFrames();
		await run(`unseal ${roll.shot} frames`, async () => (frames = await viewFrames(repo, roll.id)));
	}

	function vibrate() {
		const ok = buzz([80, 60, 80]);
		log = `navigator.vibrate ${'vibrate' in navigator ? 'exists' : 'MISSING'}, returned ${ok}` +
			(ok ? ' (if nothing buzzed: check the phone’s vibration/haptics settings and battery saver)' : '');
	}

	const when = (t?: number) => (t ? new Date(t).toLocaleString() : '—');
	onDestroy(clearFrames);
</script>

{#if !open}
	<button class="tab" onclick={() => (open = true)}>DEV ▴</button>
{:else}
<section class="dev">
	<header>
		<strong>DEV</strong>
		<span class="actions">
			<button onclick={() => (open = false)}>collapse</button>
			<button onclick={onexit}>exit dev mode</button>
		</span>
	</header>

	{#each rolls as roll (roll.id)}
		<div class="roll">
			<div>
				<b>{roll.state}</b> · {roll.shot}/{roll.exposures} · loaded {when(roll.loadedAt)}
				{#if roll.ticket?.lab === 'local-timelock'}<br />dev lab · ready at {when(roll.ticket.data.readyAt as number)}{/if}
				{#if roll.ticket?.lab === 'remote'}<br />lab {String(roll.ticket.data.id).slice(0, 6)}… · window {when(roll.ticket.data.windowFrom as number)} → {when(roll.ticket.data.windowTo as number)}{roll.handedOff ? ' · handed off' : ' · ticket pending'}{/if}
				{#if roll.upload}<br />upload pending {roll.upload.id.slice(0, 6)}…{/if}
			</div>
			<div class="actions">
				{#if roll.state === 'loaded' && roll.exposures - roll.shot > 1}
					<button disabled={busy} onclick={() => run('fill to 1 left', () => fillRoll(repo, roll, 1))}>fill → 1 left</button>
				{/if}
				{#if roll.state === 'developing' && roll.ticket?.lab === 'local-timelock'}
					<button disabled={busy} onclick={() => run('skip the wait', () => skipWait(repo, roll))}>skip the wait</button>
				{/if}
				{#if roll.ticket?.lab === 'remote'}
					<a class="btn" href="/lab/{roll.ticket.data.id}#{roll.ticket.data.key}">open ticket</a>
				{/if}
				{#if roll.shot > 0 && (roll.state === 'loaded' || roll.state === 'full' || roll.ticket?.lab === 'local-timelock')}
					<button disabled={busy} onclick={() => show(roll)}>view frames</button>
				{/if}
			</div>
		</div>
	{:else}
		<p>no rolls</p>
	{/each}

	<p class="log">film look: {filmSupported() ? `WebGL2 ok · stock ${FILM_STOCK}` : 'NO WebGL2 — frames are not developed'}</p>
	<label class="log"><input type="checkbox" bind:checked={devLab} onchange={() => setDevLab(devLab)} /> dev lab (on-phone time-lock, skippable) instead of the real lab</label>
	<div class="actions">
		<a class="btn" href="/bench" target="_blank" rel="noopener">film bench ↗</a>
		<button onclick={vibrate}>test vibration</button>
		<button
			disabled={busy}
			onclick={() => confirm('Delete every roll and frame on this device?') && run('wipe', wipeEverything).then(() => location.reload())}
			>wipe everything</button
		>
	</div>
	{#if lastCapture}<p class="log">last shot: {lastCapture}</p>{/if}
	<p class="log">
		flash: {flashReport || 'camera not opened yet'} · vibrate {'vibrate' in navigator ? 'present' : 'MISSING'} ·
		{navigator.userAgent.match(/(Chrome|Brave|Firefox|Safari)\/[\d.]+/g)?.join(' ') ?? navigator.userAgent}
		{matchMedia('(display-mode: fullscreen)').matches ? ' · installed (fullscreen)' : matchMedia('(display-mode: standalone)').matches ? ' · installed (standalone)' : ' · browser tab'}
	</p>
	{#if log}<p class="log">{log}</p>{/if}

	{#if frames.length}
		<div class="grid">
			{#each frames as f, i (f.index)}
				<button class="thumb" onclick={() => (zoom = i)}>
					<img src={f.url} alt="frame {f.index + 1}" />
					<span>{f.index + 1}</span>
				</button>
			{/each}
		</div>
		<button onclick={clearFrames}>hide frames</button>
	{/if}
</section>
{/if}

{#if current}
	<div class="viewer">
		<div class="bar">
			<button onclick={() => step(-1)} aria-label="previous">◀</button>
			<span>#{current.index + 1}/{frames.length}</span>
			<button onclick={() => step(1)} aria-label="next">▶</button>
			<button class="close" onclick={() => (zoom = null)} aria-label="close">✕</button>
		</div>
		<!-- swipe left/right on the photo to browse -->
		<div
			class="photo"
			role="presentation"
			onpointerdown={(e) => (swipeX = e.clientX)}
			onpointerup={(e) => Math.abs(e.clientX - swipeX) > 40 && step(e.clientX < swipeX ? 1 : -1)}
		>
			<img src={current.url} alt="frame {current.index + 1}" draggable="false" />
		</div>
		<p class="meta">
			{current.width}×{current.height} · {Math.round(current.bytes / 1024)} KB · {when(current.takenAt)}{current.flash ? ' · flash' : ''}
		</p>
	</div>
{/if}

<style>
	.tab {
		position: absolute;
		top: calc(3.4rem + env(safe-area-inset-top));
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		font: 0.75rem ui-monospace, monospace;
		color: #0c1a12;
		background: #3f8;
		border: 0;
		border-radius: 0 0 0.3rem 0.3rem;
		padding: 0.15rem 0.6rem;
	}
	.dev {
		position: absolute;
		inset: auto 0 0 0;
		max-height: 75%;
		overflow: auto;
		z-index: 20;
		background: #0c1a12;
		border-top: 2px solid #3f8;
		color: #cfe;
		font: 0.8rem ui-monospace, monospace;
		font-family: ui-monospace, monospace;
		padding: 0.8rem 1rem calc(0.8rem + env(safe-area-inset-bottom));
		display: grid;
		gap: 0.6rem;
		user-select: text;
	}
	header,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	header {
		justify-content: space-between;
	}
	button,
	.btn {
		font: inherit;
		text-decoration: none;
		color: #0c1a12;
		background: #3f8;
		border: 0;
		border-radius: 0.3rem;
		padding: 0.35rem 0.6rem;
	}
	button:disabled {
		opacity: 0.5;
	}
	.roll {
		display: grid;
		gap: 0.4rem;
		border: 1px solid #245;
		padding: 0.5rem;
		border-radius: 0.4rem;
	}
	.log {
		margin: 0;
		color: #9db;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
		gap: 0.3rem;
	}
	.thumb {
		position: relative;
		padding: 0;
		background: #000;
		aspect-ratio: 1;
		overflow: hidden;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.thumb span {
		position: absolute;
		left: 0.2rem;
		bottom: 0.1rem;
		color: #3f8;
	}
	.viewer {
		position: absolute;
		inset: 0;
		z-index: 30;
		background: #000;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		color: #cfe;
		font: 0.85rem ui-monospace, monospace;
		padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
			env(safe-area-inset-left);
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #0c1a12;
		border-bottom: 2px solid #3f8;
	}
	.bar span {
		flex: 1;
		text-align: center;
	}
	.bar button {
		min-width: 2.6rem;
		min-height: 2.4rem;
		font-size: 1.1rem;
	}
	.photo {
		position: relative;
		min-height: 0;
		touch-action: pan-y;
	}
	.photo img {
		/* absolute + contain: a % max-height can't resolve inside an auto grid row */
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		user-select: none;
	}
	.meta {
		margin: 0;
		padding: 0.5rem;
		text-align: center;
	}
</style>
