<script lang="ts">
	// Phase 0 placeholder: the camera body without a camera. Lets us feel the
	// wind → shoot ritual on a phone before getUserMedia and the shader land.
	import { Winder } from '$lib/camera/winder';
	import { FILM_STOCK } from '$lib/config';
	import { t } from '$lib/i18n';
	import { hasFlash } from '$lib/platform';
	import { expose, framesLeft, loadRoll } from '$lib/roll/roll';

	const winder = new Winder();
	let roll = $state(loadRoll(FILM_STOCK));
	let wound = $state(0);
	let flash = $state(false);

	function flick() {
		winder.flick();
		wound = winder.progress;
		navigator.vibrate?.(winder.armed ? 30 : 8);
	}

	function shoot() {
		if (roll.state !== 'loaded' || !winder.fire()) return;
		roll = expose(roll);
		wound = 0;
		navigator.vibrate?.(15);
	}
</script>

<main class="body">
	<div class="counter" aria-label={t('framesLeft')}>{framesLeft(roll)}</div>

	<div class="finder" aria-hidden="true"></div>

	{#if roll.state === 'loaded'}
		{#if hasFlash()}
			<label class="flash"><input type="checkbox" bind:checked={flash} /> {t('flash')}</label>
		{/if}
		<button class="wheel" onclick={flick} aria-label={t('wind')} style:--p={wound}></button>
		<button class="shutter" onclick={shoot} disabled={wound < 1} aria-label="shutter"></button>
	{:else}
		<p class="done">{t('rollFull')}</p>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background: #111;
		color: #eee;
		font-family: system-ui, sans-serif;
	}
	.body {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		grid-template-rows: auto 1fr auto auto;
		gap: 1.5rem;
		padding: 2rem 1rem;
		box-sizing: border-box;
		position: relative;
	}
	.counter {
		font: 700 1.6rem ui-monospace, monospace;
		color: #f60;
		background: #000;
		padding: 0.2rem 0.6rem;
		border-radius: 0.3rem;
	}
	.finder {
		width: min(60vw, 18rem);
		aspect-ratio: 3 / 2;
		background: radial-gradient(#333, #000 75%);
		border-radius: 0.6rem;
		box-shadow: inset 0 0 1.5rem #000, 0 0 0 0.4rem #222;
	}
	.wheel {
		position: absolute;
		right: 0;
		top: 35%;
		width: 2.2rem;
		height: 8rem;
		border: 0;
		border-radius: 0.6rem 0 0 0.6rem;
		background: repeating-linear-gradient(#444 0 4px, #222 4px 8px);
		box-shadow: inset 0.3rem 0 0 hsl(24 100% 50% / calc(var(--p) * 100%));
	}
	.shutter {
		width: 5rem;
		height: 5rem;
		border-radius: 50%;
		border: 0.35rem solid #333;
		background: #ddd;
	}
	.shutter:disabled {
		background: #555;
	}
	.shutter:active:not(:disabled) {
		transform: scale(0.94);
	}
	.flash {
		font-size: 0.9rem;
	}
</style>
