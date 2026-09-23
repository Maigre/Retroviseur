<script lang="ts">
	// First-launch explanation (D50): four cards, shown once, and again from About.
	import { t, type MessageKey } from '$lib/i18n';

	let { ondone, startLabel = 'introStart' }: { ondone: () => void; startLabel?: MessageKey } = $props();

	const cards: { title: MessageKey; body: MessageKey; art: string }[] = [
		{ title: 'intro1Title', body: 'intro1Body', art: 'camera' },
		{ title: 'intro2Title', body: 'intro2Body', art: 'sideways' },
		{ title: 'intro3Title', body: 'intro3Body', art: 'wind' },
		{ title: 'intro4Title', body: 'intro4Body', art: 'lab' }
	];
	let i = $state(0);
	const last = $derived(i === cards.length - 1);
	let swipeX = 0;

	const next = () => (last ? ondone() : (i += 1));
	const prev = () => i > 0 && (i -= 1);
</script>

<section
	class="intro"
	aria-label={t(cards[i].title)}
	role="presentation"
	onpointerdown={(e) => (swipeX = e.clientX)}
	onpointerup={(e) => {
		const d = e.clientX - swipeX;
		if (d < -50) next();
		else if (d > 50) prev();
	}}
>
	{#key i}
		<div class="card">
			<svg class="art" viewBox="0 0 120 80" aria-hidden="true">
				{#if cards[i].art === 'camera'}
					<rect x="18" y="20" width="84" height="46" rx="8" class="body" />
					<rect x="26" y="27" width="14" height="9" rx="2" class="dark" />
					<circle cx="60" cy="45" r="14" class="ring" />
					<circle cx="60" cy="45" r="7" class="dark" />
					<rect x="18" y="56" width="84" height="3" class="yellow" />
					<rect x="18" y="59" width="84" height="2" class="red" />
					<rect x="80" y="26" width="15" height="9" rx="2" class="window" />
					<text x="87.5" y="33.5" class="num">27</text>
				{:else if cards[i].art === 'sideways'}
					<g transform="rotate(-90 60 40)">
						<rect x="40" y="6" width="40" height="68" rx="6" class="body" />
						<rect x="42" y="9" width="36" height="8" class="yellow" />
						<rect x="45" y="22" width="30" height="36" rx="3" class="dark" />
						<circle cx="72" cy="66" r="4" class="ring" />
					</g>
					<path d="M92 70 A34 34 0 0 1 92 10" class="arrow" />
					<path d="M88 13 L92 10 L95 15" class="arrow" />
				{:else if cards[i].art === 'wind'}
					<rect x="28" y="30" width="64" height="20" rx="8" class="body" />
					{#each Array(12) as _, k (k)}<rect x={33 + k * 5} y="32" width="2" height="16" class="rib" />{/each}
					<path d="M84 62 H36" class="arrow" />
					<path d="M41 57 L36 62 L41 67" class="arrow" />
					<text x="60" y="22" class="hint">× 3</text>
				{:else}
					<rect x="10" y="26" width="34" height="28" rx="4" class="body" />
					<circle cx="27" cy="40" r="8" class="ring" />
					<path d="M50 40 H68" class="arrow" />
					<path d="M63 35 L68 40 L63 45" class="arrow" />
					<rect x="74" y="22" width="36" height="36" rx="3" class="ticket" />
					<path d="M80 32 H104 M80 39 H100 M80 46 H96" class="lines" />
				{/if}
			</svg>
			<h2>{t(cards[i].title)}</h2>
			<p>{t(cards[i].body)}</p>
		</div>
	{/key}

	<div class="dots" aria-hidden="true">
		{#each cards as _, k (k)}<span class:on={k === i}></span>{/each}
	</div>
	<button class="big" onclick={next}>{t(last ? startLabel : 'introNext')}</button>
	{#if !last}<button class="link" onclick={ondone}>{t('introSkip')}</button>{/if}
</section>

<style>
	.intro {
		height: 100%;
		box-sizing: border-box;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto auto auto;
		justify-items: center;
		align-items: center;
		gap: 0.8rem;
		padding: 1rem 1.2rem 1.4rem;
		text-align: center;
		touch-action: pan-y;
	}
	.card {
		display: grid;
		justify-items: center;
		gap: 0.7rem;
		max-width: 22rem;
		animation: in 260ms ease-out;
	}
	@keyframes in {
		from {
			opacity: 0;
			transform: translateX(1rem);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card {
			animation: none;
		}
	}
	.art {
		width: min(15rem, 70%);
		height: auto;
	}
	h2 {
		margin: 0;
		font: italic 1.6rem/1.1 var(--font);
		color: var(--accent);
	}
	p {
		margin: 0;
		font-size: 1.15rem;
		line-height: 1.35;
	}
	.dots {
		display: flex;
		gap: 0.45rem;
	}
	.dots span {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #3a3d3a;
	}
	.dots span.on {
		background: var(--accent);
	}
	.big {
		font: 1.35rem/1.1 var(--font);
		padding: 0.75rem 1.2rem;
		border-radius: 0.7rem;
		border: 0;
		background: var(--accent);
		color: var(--accent-fg);
		box-shadow: 0 0.2rem 0 #8a6a00;
	}
	.link {
		background: none;
		border: 0;
		color: var(--muted);
		text-decoration: underline;
		font: inherit;
		font-size: 1rem;
	}
	/* line-art in the camera's palette */
	.body {
		fill: #2c2f2c;
		stroke: #000;
		stroke-width: 1.2;
	}
	.dark {
		fill: #0a0a0a;
	}
	.ring {
		fill: #0b0b0b;
		stroke: #6b6b6b;
		stroke-width: 2.5;
	}
	.yellow {
		fill: var(--accent);
	}
	.red {
		fill: var(--stripe);
	}
	.window {
		fill: var(--window);
	}
	.num {
		font: 7px var(--font);
		fill: #111;
		text-anchor: middle;
	}
	.rib {
		fill: #4c4c4c;
	}
	.arrow,
	.lines {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.lines {
		stroke: #555;
		stroke-width: 2;
	}
	.ticket {
		fill: var(--window);
	}
	.hint {
		font: 12px var(--font);
		fill: var(--muted);
		text-anchor: middle;
	}
</style>
