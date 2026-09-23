<script lang="ts">
	// Hidden developer bench (D40): run the film look on your own photos with both
	// stocks side by side, tune the parameters live, copy them into stocks.ts.
	// Not linked from the app; English only. Photos never leave the browser.
	import { onMount } from 'svelte';
	import { FILM_STOCK } from '$lib/config';
	import { develop, filmSupported } from '$lib/film/develop';
	import { leakFor } from '$lib/film/leak';
	import { formatStamp } from '$lib/film/stamp';
	import { STOCKS, type FilmStock, type FilmStockId } from '$lib/film/stocks';

	const MAX = 1600; // bench preview size (long side)
	const ids = Object.keys(STOCKS) as FilmStockId[];

	// editable copies of the stocks
	let stocks = $state<Record<FilmStockId, FilmStock>>(structuredClone(STOCKS));
	let photos = $state<{ name: string; canvas: HTMLCanvasElement }[]>([]);
	let current = $state(0);
	let stampOn = $state(true);
	let leak = $state<'none' | 'head' | 'tail'>('none');
	let seed = $state(1);
	let zoom = $state<string | null>(null);
	let results = $state<{ id: FilmStockId | 'original'; url: string; ms: number }[]>([]);
	let supported = $state(true);
	let copied = $state('');

	function toCanvas(img: CanvasImageSource & { width: number; height: number }, name: string) {
		const k = Math.min(1, MAX / Math.max(img.width, img.height));
		const c = document.createElement('canvas');
		c.width = Math.round(img.width * k);
		c.height = Math.round(img.height * k);
		c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
		return { name, canvas: c };
	}

	/** A synthetic test card so the bench works before any photo is loaded. */
	function sample() {
		const c = document.createElement('canvas');
		c.width = 1500;
		c.height = 1000;
		const g = c.getContext('2d')!;
		const sky = g.createLinearGradient(0, 0, 0, 620);
		sky.addColorStop(0, '#5d8fc9');
		sky.addColorStop(1, '#dfe8ef');
		g.fillStyle = sky;
		g.fillRect(0, 0, 1500, 620);
		g.fillStyle = '#4f7a3a';
		g.fillRect(0, 620, 1500, 380);
		g.fillStyle = '#fff6d8';
		g.beginPath();
		g.arc(1180, 170, 70, 0, Math.PI * 2);
		g.fill();
		const skins = ['#f1c7a8', '#d9a07a', '#a86f4c', '#6b4330'];
		skins.forEach((s, i) => {
			g.fillStyle = s;
			g.beginPath();
			g.arc(260 + i * 170, 520, 70, 0, Math.PI * 2);
			g.fill();
		});
		for (let i = 0; i < 12; i++) {
			g.fillStyle = `hsl(${i * 30} 70% 50%)`;
			g.fillRect(60 + i * 115, 760, 100, 100);
		}
		for (let i = 0; i < 12; i++) {
			const v = Math.round((i / 11) * 255);
			g.fillStyle = `rgb(${v},${v},${v})`;
			g.fillRect(60 + i * 115, 880, 100, 80);
		}
		return { name: 'test card', canvas: c };
	}

	async function addFiles(e: Event) {
		const files = [...((e.currentTarget as HTMLInputElement).files ?? [])];
		for (const f of files) {
			const bmp = await createImageBitmap(f);
			photos.push(toCanvas(bmp, f.name));
			bmp.close();
		}
		current = photos.length - 1;
		render();
	}

	function blobUrl(c: HTMLCanvasElement): Promise<string> {
		return new Promise((r) => c.toBlob((b) => r(URL.createObjectURL(b!)), 'image/jpeg', 0.9));
	}

	async function render() {
		const p = photos[current];
		if (!p) return;
		results.forEach((r) => URL.revokeObjectURL(r.url));
		const out: typeof results = [{ id: 'original', url: await blobUrl(p.canvas), ms: 0 }];
		const exposures = 27;
		const index = leak === 'head' ? 0 : leak === 'tail' ? exposures - 1 : 5;
		for (const id of ids) {
			const t0 = performance.now();
			const c = develop(p.canvas, {
				stock: stocks[id],
				seed: `bench:${seed}`,
				stamp: stampOn ? formatStamp(Date.now()) : null,
				leak: leakFor(index, exposures, `bench:${seed}`)
			});
			const ms = Math.round(performance.now() - t0);
			out.push({ id, url: await blobUrl(c), ms });
		}
		results = out;
	}

	async function copyParams(id: FilmStockId) {
		const text = JSON.stringify(stocks[id], null, '\t');
		try {
			await navigator.clipboard.writeText(text);
			copied = `${id} copied`;
		} catch {
			copied = text;
		}
	}

	onMount(() => {
		supported = filmSupported();
		photos.push(sample());
		render();
	});

	const sliders: { key: string; label: string; min: number; max: number; step: number; get: (s: FilmStock) => number; set: (s: FilmStock, v: number) => void }[] = [
		{ key: 'sat', label: 'saturation', min: 0.5, max: 1.5, step: 0.01, get: (s) => s.saturation, set: (s, v) => (s.saturation = v) },
		{ key: 'ga', label: 'grain amount', min: 0, max: 0.25, step: 0.005, get: (s) => s.grain.amount, set: (s, v) => (s.grain.amount = v) },
		{ key: 'gs', label: 'grain size (px @12MP)', min: 0.5, max: 4, step: 0.1, get: (s) => s.grain.size, set: (s, v) => (s.grain.size = v) },
		{ key: 'hal', label: 'halation', min: 0, max: 0.6, step: 0.01, get: (s) => s.halation, set: (s, v) => (s.halation = v) },
		{ key: 'vig', label: 'vignette', min: 0, max: 0.8, step: 0.01, get: (s) => s.vignette, set: (s, v) => (s.vignette = v) },
		{ key: 'soft', label: 'edge softness', min: 0, max: 0.8, step: 0.01, get: (s) => s.softness, set: (s, v) => (s.softness = v) }
	];
</script>

<svelte:head><title>Retroviseur · bench</title></svelte:head>

<main class="bench">
	<header>
		<h1>FILM BENCH</h1>
		<p>
			Both stocks on your photos — nothing leaves this browser. Live now: <b>{FILM_STOCK}</b>.
			{#if !supported}<strong>WebGL2 unavailable here: no film look.</strong>{/if}
		</p>
	</header>

	<section class="controls">
		<label class="file">Add photos <input type="file" accept="image/*" multiple onchange={addFiles} /></label>
		<select bind:value={current} onchange={render} aria-label="photo">
			{#each photos as p, i}<option value={i}>{p.name}</option>{/each}
		</select>
		<label><input type="checkbox" bind:checked={stampOn} onchange={render} /> date stamp</label>
		<select bind:value={leak} onchange={render} aria-label="light leak">
			<option value="none">no leak (mid-roll)</option>
			<option value="head">first frame leak</option>
			<option value="tail">last frame leak</option>
		</select>
		<button onclick={() => (seed++, render())}>new grain/leak seed</button>
	</section>

	<section class="grid">
		{#each results as r (r.id)}
			<div class="card">
				<button class="img" onclick={() => (zoom = r.url)}><img src={r.url} alt={r.id} /></button>
				<p class="cap">
					<b>{r.id === 'original' ? 'original' : stocks[r.id].label}</b>
					{#if r.id !== 'original'}· {r.ms} ms{/if}
				</p>
				{#if r.id !== 'original'}
					{@const id = r.id}
					<div class="sliders">
						{#each sliders as sl (sl.key)}
							<label>
								<span>{sl.label} <output>{sl.get(stocks[id]).toFixed(3)}</output></span>
								<input
									type="range"
									min={sl.min}
									max={sl.max}
									step={sl.step}
									value={sl.get(stocks[id])}
									oninput={(e) => (sl.set(stocks[id], +(e.currentTarget as HTMLInputElement).value), render())}
								/>
							</label>
						{/each}
						<button onclick={() => copyParams(id)}>copy {id} params</button>
					</div>
				{/if}
			</div>
		{/each}
	</section>
	{#if copied}<pre class="copied">{copied}</pre>{/if}
</main>

{#if zoom}
	<button class="zoom" onclick={() => (zoom = null)}><img src={zoom} alt="zoomed" /></button>
{/if}

<style>
	.bench {
		min-height: 100dvh;
		box-sizing: border-box;
		padding: 1rem;
		background: var(--bg);
		color: var(--fg);
		font: 15px/1.4 ui-monospace, monospace;
		user-select: text;
		-webkit-user-select: text;
	}
	h1 {
		font: italic 2rem/1 var(--font);
		color: var(--accent);
		margin: 0 0 0.3rem;
	}
	header p {
		margin: 0 0 1rem;
		color: var(--muted);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.controls button,
	.controls select,
	.file,
	.sliders button {
		font: inherit;
		background: #1d201d;
		color: var(--fg);
		border: 1px solid #3a3d3a;
		border-radius: 0.3rem;
		padding: 0.35rem 0.6rem;
	}
	.file input {
		display: none;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
	}
	.card {
		margin: 0;
		display: grid;
		gap: 0.5rem;
		align-content: start;
	}
	.img {
		padding: 0;
		border: 0;
		background: #000;
	}
	.img img {
		width: 100%;
		display: block;
	}
	.cap {
		margin: 0;
		color: var(--muted);
	}
	.sliders {
		display: grid;
		gap: 0.3rem;
	}
	.sliders label {
		display: grid;
		gap: 0.1rem;
		font-size: 13px;
	}
	.sliders span {
		display: flex;
		justify-content: space-between;
	}
	.copied {
		white-space: pre-wrap;
		color: var(--muted);
	}
	.zoom {
		position: fixed;
		inset: 0;
		background: #000e;
		border: 0;
		padding: 0.5rem;
		display: grid;
		place-items: center;
		z-index: 10;
	}
	.zoom img {
		max-width: 100%;
		max-height: 100%;
	}
</style>
