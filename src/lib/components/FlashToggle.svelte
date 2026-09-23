<script lang="ts">
	let { on = $bindable(false), label }: { on: boolean; label: string } = $props();
</script>

<button class="flash" class:on role="switch" aria-checked={on} aria-label={label} onclick={() => (on = !on)}>
	<span class="track"><span class="knob"></span></span>
	<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>
</button>

<style>
	.flash {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: 0;
		padding: 0.4rem;
		color: var(--muted);
	}
	.track {
		width: 2.6rem;
		height: 1.4rem;
		border-radius: 1rem;
		background: #2a2a2a;
		box-shadow: inset 0 0 0 1px #000;
		position: relative;
		transition: background 150ms;
	}
	.knob {
		position: absolute;
		top: 0.15rem;
		left: 0.15rem;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 50%;
		background: #888;
		transition: transform 150ms, background 150ms;
	}
	svg {
		width: 1.4rem;
		height: 1.4rem;
		fill: currentColor;
	}
	.on {
		color: #ffd21a;
	}
	.on .track {
		background: #4a3d00;
	}
	.on .knob {
		transform: translateX(1.2rem);
		background: #ffd21a;
	}
</style>
