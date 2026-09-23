<script lang="ts">
	import { page } from '$app/state';
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
