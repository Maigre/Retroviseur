<script lang="ts">
	// Horizontal ribbed film-advance wheel, top right. Push it leftward with the
	// thumb: it ticks continuously while it turns, and each quick flick is one
	// advance notch; the parent's Winder decides when the film is wound.
	import { FlickDetector } from '$lib/camera/flick';
	import { WHEEL_TICK_PX } from '$lib/config';

	let {
		armed,
		label,
		onflick,
		ontick
	}: { armed: boolean; label: string; onflick: () => void; ontick: () => void } = $props();

	const detector = new FlickDetector();
	let offset = $state(0); // texture scroll in px, follows the thumb
	let rest = 0; // where the texture settled after the last stroke
	let lastTick = 0; // travel at the last ratchet tick in this stroke

	function down(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		detector.start(e.clientX, e.timeStamp);
		lastTick = 0;
	}

	function move(e: PointerEvent) {
		const travel = detector.travel(e.clientX);
		if (armed) {
			offset = rest - Math.min(travel, 3); // wound: the wheel is blocked
			return;
		}
		offset = rest - travel;
		while (travel - lastTick >= WHEEL_TICK_PX) {
			lastTick += WHEEL_TICK_PX;
			ontick();
		}
		if (detector.move(e.clientX, e.timeStamp)) onflick();
	}

	function up() {
		detector.end();
		rest = offset;
	}
</script>

<div
	class="wheel"
	class:armed
	role="slider"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={1}
	aria-valuenow={armed ? 1 : 0}
	tabindex="0"
	style:--offset="{offset}px"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onkeydown={(e) => (e.key === 'ArrowLeft' || e.key === ' ') && !armed && onflick()}
></div>

<style>
	.wheel {
		width: min(11rem, 46vw);
		height: 2.7rem;
		border-radius: 0.9rem;
		background:
			linear-gradient(rgb(255 255 255 / 0.12), transparent 35%, rgb(0 0 0 / 0.55)),
			linear-gradient(90deg, rgb(0 0 0 / 0.7), transparent 22%, transparent 78%, rgb(0 0 0 / 0.7)),
			repeating-linear-gradient(90deg, #4c4c4c 0 3px, #1a1a1a 3px 7px);
		background-position: 0 0, 0 0, var(--offset) 0;
		touch-action: none;
		cursor: ew-resize;
		box-shadow: inset 0 0 0 1px #000, 0 0 0 0.25rem #0000;
		transition: box-shadow 150ms;
	}
	.wheel.armed {
		box-shadow: inset 0 0 0 1px #000, 0 0 0 0.2rem var(--accent);
	}
</style>
