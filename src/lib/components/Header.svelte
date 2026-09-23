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
		background: var(--band);
		color: var(--band-fg);
		padding: calc(0.35rem + env(safe-area-inset-top)) 0.8rem 0.35rem;
	}
	h1 {
		margin: 0;
		font: 1.9rem/1 var(--font);
		letter-spacing: 0.12em;
	}
	.actions {
		display: flex;
		gap: 0.4rem;
	}
	button {
		width: 2.3rem;
		height: 2.3rem;
		display: grid;
		place-items: center;
		background: none;
		color: inherit;
		border: 2px solid currentColor;
		border-radius: 0.3rem;
		font-size: 1.5rem;
		line-height: 1;
		padding: 0;
	}
	svg {
		width: 1.3rem;
		height: 1.3rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
	}
</style>
