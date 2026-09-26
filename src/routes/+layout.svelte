<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n';
	import { update } from '$lib/update.svelte';
	import { APK_URL, NATIVE, onTicketLink } from '$lib/native';
	// the app: the page is transparent so the native camera can show through the finder
	if (NATIVE && typeof document !== 'undefined') document.documentElement.classList.add('native');
	// the app: a ticket link tapped anywhere on the phone opens its pickup page here (D57)
	onTicketLink((path) => location.assign(path));
	let { children } = $props();
	// the developer bench uses the whole window
	const bare = $derived(page.url.pathname.startsWith('/bench'));
</script>

<!-- Full screen on phones; a phone-sized "device" in the middle of wide screens. -->
{#if bare}
	{@render children()}
{:else}
	<div class="device">
		{@render children()}
		{#if update.ready}
			<!-- a new build took over: offer the reload, never force it mid-shot (D52) -->
			<button class="update" onclick={() => location.reload()}>{t('updateReady')}</button>
		{:else if update.app}
			<!-- the Android app: a newer APK is out; the link leaves for the browser, which downloads it -->
			<a class="update" href={APK_URL}>{t('appUpdateReady')}</a>
		{/if}
	</div>
{/if}

<style>
	@font-face {
		font-family: 'VT323';
		font-style: normal;
		font-weight: 400;
		font-display: swap;
		src: url('/fonts/vt323-latin.woff2') format('woff2');
	}
	/* 90s film-box palette: Fujifilm green band, Kodak yellow, a red stripe. */
	:global(:root) {
		--bg: #0b0d0b;
		--body: #1a1c1a;
		--fg: #efeadb;
		--muted: #9d9a8c;
		--accent: #ffc20e; /* Kodak yellow */
		--accent-fg: #111;
		--band: var(--bg); /* same black as the camera body */
		--band-fg: #ffc20e; /* Kodak yellow on dark: ~11:1 */
		--stripe: #e4002b; /* film-box red: under the header */
		--stripe-2: #007a3d; /* Fujifilm green: over the header */
		--shell: #2c2f2c; /* camera-body edge */
		--shell-in: #111311; /* camera-body plate */
		--window: #e9e3cf; /* frame-counter window */
		--font: 'VT323', ui-monospace, monospace;
	}
	:global(html),
	:global(body) {
		margin: 0;
		height: 100%;
		background: var(--bg);
	}
	:global(html.native),
	:global(html.native body),
	:global(html.native) .device {
		background: transparent;
	}
	:global(body) {
		color: var(--fg);
		font: 1.25rem/1.25 var(--font);
		overscroll-behavior: none;
		-webkit-user-select: none;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}
	:global(button) {
		font-family: var(--font);
	}
	.device {
		position: relative;
		height: 100dvh;
		width: 100%;
		overflow: hidden;
		container-type: size;
		container-name: device;
		background: var(--bg);
	}
	.update {
		position: absolute;
		left: 0.8rem;
		right: 0.8rem;
		bottom: calc(env(safe-area-inset-bottom) + 0.8rem);
		z-index: 50;
		padding: 0.7rem;
		border: 0;
		border-radius: 0.6rem;
		background: var(--accent);
		color: var(--accent-fg);
		font: 1.1rem var(--font);
		box-shadow: 0 0.3rem 1rem rgb(0 0 0 / 0.6);
		text-align: center;
		text-decoration: none;
	}
	/* Wide screens: a fake smartphone in the middle of the page. */
	@media (min-width: 700px) and (min-height: 560px) {
		:global(body) {
			display: grid;
			place-items: center;
			background: radial-gradient(circle at 50% 30%, #1d1d1d, #050505 70%);
		}
		.device {
			width: min(400px, calc((100dvh - 3rem) * 0.48));
			height: min(840px, calc(100dvh - 3rem));
			border-radius: 2.6rem;
			box-shadow:
				0 0 0 0.7rem #050505,
				0 0 0 0.8rem #2a2a2a,
				0 2rem 4rem rgb(0 0 0 / 0.7);
		}
	}
</style>
