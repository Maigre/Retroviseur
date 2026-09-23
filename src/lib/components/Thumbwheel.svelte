<script lang="ts">
	// Ribbed film-advance wheel on the right edge. Each quick upward flick is one
	// ratchet click; the parent's Winder decides when the film is wound.
	import { FlickDetector } from '$lib/camera/flick';

	let {
		armed,
		label,
		onflick
	}: { armed: boolean; label: string; onflick: () => void } = $props();

	const detector = new FlickDetector();
	let offset = $state(0); // texture scroll in px, follows the finger
	let rest = 0; // where the texture settled after the last stroke

	function down(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		detector.start(e.clientY, e.timeStamp);
	}

	function move(e: PointerEvent) {
		// A wound wheel is blocked: it barely moves.
		const travel = detector.travel(e.clientY);
		offset = rest - (armed ? Math.min(travel, 3) : travel);
		if (!armed && detector.move(e.clientY, e.timeStamp)) onflick();
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
	onkeydown={(e) => (e.key === 'ArrowUp' || e.key === ' ') && !armed && onflick()}
></div>

<style>
	.wheel {
		position: absolute;
		right: 0;
		top: 32%;
		width: 2.6rem;
		height: 9rem;
		border-radius: 0.8rem 0 0 0.8rem;
		background:
			linear-gradient(90deg, rgb(0 0 0 / 0.55), transparent 40%, rgb(0 0 0 / 0.5)),
			repeating-linear-gradient(var(--rib) 0 3px, var(--rib-dark) 3px 7px);
		background-position: 0 0, 0 var(--offset);
		touch-action: none;
		cursor: ns-resize;
		box-shadow: inset 0 0 0 1px #000;
		transition: box-shadow 120ms;
		--rib: #4a4a4a;
		--rib-dark: #1c1c1c;
	}
	.wheel.armed {
		box-shadow: inset 0.25rem 0 0 var(--accent), inset 0 0 0 1px #000;
	}
</style>
