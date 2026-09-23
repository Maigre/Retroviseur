<script lang="ts">
	import { t } from '$lib/i18n';

	let { onabout, onnotice }: { onabout: () => void; onnotice: (msg: 'linkCopied') => void } = $props();

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
		<button aria-label={t('about')} onclick={onabout}>?</button>
		<button aria-label={t('share')} onclick={share}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
				<line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
			</svg>
		</button>
	</div>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
		/* film-box stripes: Fujifilm green on top (below the status bar), red under */
		background:
			linear-gradient(var(--stripe-2), var(--stripe-2)) 0 env(safe-area-inset-top) / 100% 0.22rem no-repeat,
			var(--band);
		color: var(--band-fg);
		border-bottom: 0.22rem solid var(--stripe);
		padding: calc(0.85rem + 0.22rem + env(safe-area-inset-top)) max(0.7rem, env(safe-area-inset-right)) 0.85rem
			max(0.6rem, env(safe-area-inset-left));
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
