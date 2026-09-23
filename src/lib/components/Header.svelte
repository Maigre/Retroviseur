<script lang="ts">
	import { t } from '$lib/i18n';

	let { onabout, onnotice }: { onabout?: () => void; onnotice: (msg: 'linkCopied') => void } = $props();

	async function share() {
		const data = { title: 'Retroviseur', text: t('shareText'), url: location.origin };
		try {
			if (navigator.share) return await navigator.share(data);
		} catch (e) {
			if ((e as DOMException).name === 'AbortError') return;
		}
		try {
			await navigator.clipboard.writeText(data.url);
			onnotice('linkCopied');
		} catch {
			// nothing else to try
		}
	}
</script>

<header>
	<h1>RETROVISEUR</h1>
	<div class="actions">
		{#if onabout}<button aria-label={t('about')} onclick={onabout}>?</button>{/if}
		<button aria-label={t('share')} onclick={share}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
				<line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
			</svg>
		</button>
	</div>
</header>

<style>
	/* The header is the camera body's left end (held sideways): no band of its
	   own, it sits on the body plate like a painted label. Green along the
	   body's edge, red as the seam to the rest of the camera. */
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
		color: var(--band-fg);
		border-top: 0.22rem solid var(--stripe-2);
		border-bottom: 0.22rem solid var(--stripe);
		padding: 0.75rem 0.7rem;
	}
	/* centred between the band's left edge and the first button */
	h1 {
		flex: 1;
		text-align: center;
		margin: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: clip;
		white-space: nowrap;
		font: italic clamp(1.35rem, 8cqw, 1.8rem) / 1 var(--font); /* VT323 has no italic: slanted by the browser */
		letter-spacing: 0.08em;
	}
	.actions {
		display: flex;
		flex: none;
		gap: 0.3rem;
	}
	button {
		width: 2.1rem;
		height: 2.1rem;
		display: grid;
		place-items: center;
		background: none;
		color: inherit;
		border: 2px solid currentColor;
		border-radius: 0.25rem;
		font-size: 1.4rem;
		line-height: 1;
		padding: 0;
	}
	svg {
		width: 1.15rem;
		height: 1.15rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.4;
		stroke-linecap: round;
	}
</style>
