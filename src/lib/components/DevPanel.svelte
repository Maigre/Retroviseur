<script lang="ts">
	// Developer-only sheet (English only, never localised — see src/lib/dev.ts).
	import { onDestroy } from 'svelte';
	import { buzz } from '$lib/camera/sound';
	import { fillRoll, skipWait, viewFrames, wipeEverything, type DevFrame } from '$lib/dev';
	import type { RollRepository } from '$lib/roll/repository';
	import type { Roll } from '$lib/roll/types';

	let {
		repo,
		rolls,
		onchange,
		onexit
	}: { repo: RollRepository; rolls: Roll[]; onchange: () => Promise<void>; onexit: () => void } = $props();

	let busy = $state(false);
	let frames = $state<DevFrame[]>([]);
	let zoom = $state<DevFrame | null>(null);
	let log = $state('');
	let open = $state(true);

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
				{#if roll.ticket}<br />ready at {when(roll.ticket.data.readyAt as number)}{/if}
			</div>
			<div class="actions">
				{#if roll.state === 'loaded' && roll.exposures - roll.shot > 1}
					<button disabled={busy} onclick={() => run('fill to 1 left', () => fillRoll(repo, roll, 1))}>fill → 1 left</button>
				{/if}
				{#if roll.state === 'developing'}
					<button disabled={busy} onclick={() => run('skip the wait', () => skipWait(repo, roll))}>skip the wait</button>
				{/if}
				{#if roll.shot > 0}
					<button disabled={busy} onclick={() => show(roll)}>view frames</button>
				{/if}
			</div>
		</div>
	{:else}
		<p>no rolls</p>
	{/each}

	<div class="actions">
		<button onclick={vibrate}>test vibration</button>
		<button
			disabled={busy}
			onclick={() => confirm('Delete every roll and frame on this device?') && run('wipe', wipeEverything).then(() => location.reload())}
			>wipe everything</button
		>
	</div>
	{#if log}<p class="log">{log}</p>{/if}

	{#if frames.length}
		<div class="grid">
			{#each frames as f (f.index)}
				<button class="thumb" onclick={() => (zoom = f)}>
					<img src={f.url} alt="frame {f.index + 1}" />
					<span>{f.index + 1}</span>
				</button>
			{/each}
		</div>
		<button onclick={clearFrames}>hide frames</button>
	{/if}
</section>
{/if}

{#if zoom}
	<button class="zoom" onclick={() => (zoom = null)}>
		<img src={zoom.url} alt="frame {zoom.index + 1}" />
		<span>#{zoom.index + 1} · {zoom.width}×{zoom.height} · {Math.round(zoom.bytes / 1024)} KB · {when(zoom.takenAt)}{zoom.flash ? ' · flash' : ''}</span>
	</button>
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
		max-height: 70dvh;
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
	button {
		font: inherit;
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
	.zoom {
		position: absolute;
		inset: 0;
		z-index: 30;
		background: #000e;
		display: grid;
		place-items: center;
		gap: 0.5rem;
		padding: 1rem;
		color: #cfe;
		border-radius: 0;
	}
	.zoom img {
		max-width: 100%;
		max-height: 85dvh;
	}
</style>
