<script lang="ts">
	// The ticket page (docs/LAB.md): whoever holds the link picks the roll up here.
	// The key comes from the URL fragment and never leaves this browser.
	import { onDestroy, onMount } from 'svelte';
	import { zipSync } from 'fflate';
	import { page } from '$app/state';
	import { onBack } from '$lib/back';
	import Header from '$lib/components/Header.svelte';
	import { detectLang, t, tf, type MessageKey } from '$lib/i18n';
	import { parseArchive, unpackSealed, type Manifest } from '$lib/lab/archive';
	import { contactSheet, rollJson } from '$lib/lab/extras';
	import { formatWindow, ID_RE, importKey, KEY_RE } from '$lib/lab/ticket';
	import { newHomeUrl, onOldHost } from '$lib/move';
	import { LAB_API } from '$lib/native';
	import { unseal } from '$lib/roll/seal';

	type View = 'loading' | 'bad' | 'developing' | 'ready' | 'collected' | 'collecting' | 'open' | 'gone' | 'error' | 'wrongkey';

	const lang = detectLang();
	const id = page.params.id ?? '';
	let key = '';
	let view = $state<View>('loading');
	let windowText = $state({ from: '', to: '' });
	let collectedUntil = $state(0);
	let progress = $state(0);
	let prints = $state<{ n: number; url: string; blob: Blob; takenAt: number }[]>([]);
	let rollName = $state('retroviseur');
	let rollManifest: Manifest | null = null;
	let zoom = $state<number | null>(null);
	let now = $state(Date.now());
	let notice = $state<MessageKey | null>(null);
	const tick = setInterval(() => (now = Date.now()), 15_000);

	const api = `${LAB_API}/rolls/${id}`;

	async function status() {
		try {
			const r = await fetch(api, { cache: 'no-store' });
			if (r.status === 404) return (view = 'gone');
			if (!r.ok) return (view = 'error');
			const s = await r.json();
			now = Date.now();
			windowText = formatWindow(s.window.from, s.window.to, lang);
			if (s.state === 'developing') view = 'developing';
			else if (s.state === 'ready') view = 'ready';
			else if (s.state === 'collected') {
				collectedUntil = s.collectedUntil;
				if (view !== 'open') view = 'collected';
			} else view = 'gone';
		} catch {
			view = 'error';
		}
	}

	onMount(() => {
		// the old address (D56): a ticket holds nothing locally, so it simply moves on
		if (onOldHost()) return location.replace(newHomeUrl(location));
		key = location.hash.slice(1);
		if (!ID_RE.test(id) || !KEY_RE.test(key)) view = 'bad';
		else void status();
	});
	onDestroy(() => {
		clearInterval(tick);
		prints.forEach((p) => URL.revokeObjectURL(p.url));
	});
	$effect(() => {
		if (zoom !== null) return onBack(() => (zoom = null));
	});

	/** Download the roll (the pickup), then open it with the ticket's key. */
	async function collect() {
		view = 'collecting';
		progress = 0;
		let buf: ArrayBuffer;
		try {
			const r = await fetch(`${api}/archive`, { cache: 'no-store' });
			if (r.status === 425) return void status();
			if (r.status === 410 || r.status === 404) return (view = 'gone');
			if (!r.ok || !r.body) return (view = 'error');
			const total = Number(r.headers.get('content-length') ?? 0);
			const reader = r.body.getReader();
			const chunks: Uint8Array[] = [];
			let got = 0;
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
				got += value.length;
				if (total) progress = Math.round((100 * got) / total);
			}
			const all = new Uint8Array(got);
			let o = 0;
			for (const c of chunks) all.set(c, (o += c.length) - c.length);
			buf = all.buffer;
		} catch {
			return (view = 'error');
		}
		try {
			const k = await importKey(key);
			const { manifest, frames } = parseArchive(buf);
			const m: Manifest = JSON.parse(new TextDecoder().decode(await unseal(k, unpackSealed(manifest))));
			rollManifest = m;
			const d = new Date(m.loadedAt);
			rollName = `retroviseur-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			const out = [];
			for (let i = 0; i < frames.length; i++) {
				const blob = new Blob([await unseal(k, unpackSealed(frames[i]))], { type: 'image/jpeg' });
				out.push({ n: i + 1, url: URL.createObjectURL(blob), blob, takenAt: m.frames[i]?.takenAt ?? 0 });
			}
			prints = out;
			view = 'open';
		} catch {
			return (view = 'wrongkey');
		}
		await status(); // collected: the grace hour has started
	}

	function download(blob: Blob, name: string) {
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = name;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
	}

	async function saveAll() {
		const files: Record<string, [Uint8Array, { level: 0; mtime: Date }]> = {};
		for (const p of prints) {
			files[`${rollName}/${String(p.n).padStart(2, '0')}.jpg`] = [new Uint8Array(await p.blob.arrayBuffer()), { level: 0, mtime: new Date(p.takenAt || Date.now()) }];
		}
		// the extras (D53): a contact sheet and roll.json alongside the frames
		if (rollManifest) {
			const opts = { level: 0 as const, mtime: new Date() };
			files[`${rollName}/roll.json`] = [new TextEncoder().encode(rollJson(rollManifest, __APP_VERSION__)), opts];
			const sheet = await contactSheet(prints.map((p) => p.blob), rollManifest);
			files[`${rollName}/contact-sheet.jpg`] = [new Uint8Array(await sheet.arrayBuffer()), opts];
		}
		const zip = zipSync(files);
		download(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), `${rollName}.zip`);
	}

	const minutesLeft = $derived(Math.max(0, Math.ceil((collectedUntil - now) / 60_000)));
	const current = $derived(zoom === null ? null : prints[zoom]);
	let swipeX = 0;
</script>

<svelte:head><title>Retroviseur · lab</title></svelte:head>

<div class="app">
	<div class="shell">
		<Header onnotice={(m) => (notice = m)} />
		<main>
			<p class="stamp">LAB · {id.slice(0, 6)}</p>

			{#if view === 'loading'}
				<p class="muted">…</p>
			{:else if view === 'bad'}
				<p>{t('labPageBadTicket')}</p>
			{:else if view === 'developing'}
				<h1>{t('labPageDeveloping')}</h1>
				<p>{tf('labPageWindow', windowText)}</p>
			{:else if view === 'ready'}
				<h1>{t('labPageReady')}</h1>
				<button class="big" onclick={collect}>{t('labPageCollect')}</button>
				<p class="fine">{t('labPageSmall')}</p>
			{:else if view === 'collected'}
				<p>{tf('labPageCollected', { time: new Date(collectedUntil).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) })}</p>
				<button class="big" onclick={collect}>{t('labPageOpen')}</button>
				<p class="fine">{t('labPageSmall')}</p>
			{:else if view === 'collecting'}
				<p>{tf('labPageCollecting', { pct: progress })}</p>
				<progress max="100" value={progress}></progress>
			{:else if view === 'open'}
				<div class="bar">
					<button class="big" onclick={saveAll}>{t('labPageSaveAll')}</button>
					<p class="fine">
						{collectedUntil && collectedUntil > now ? tf('labPageCountdown', { min: minutesLeft }) : t('labPageDestroyed')}
					</p>
				</div>
				<!-- the contact sheet -->
				<div class="sheet">
					{#each prints as p, i (p.n)}
						<button class="print" onclick={() => (zoom = i)}>
							<img src={p.url} alt="#{p.n}" loading="lazy" />
							<span>▸{p.n}</span>
						</button>
					{/each}
				</div>
			{:else if view === 'gone'}
				<p>{t('labPageGone')}</p>
			{:else if view === 'wrongkey'}
				<p>{t('labPageWrongKey')}</p>
			{:else}
				<p>{t('labPageError')}</p>
				<button class="link" onclick={status}>{t('retry')}</button>
			{/if}

			<a class="home" href="/">{t('labPageHome')}</a>
		</main>
	</div>
</div>

{#if current}
	<div class="viewer">
		<div class="vbar">
			<button onclick={() => (zoom = (zoom! - 1 + prints.length) % prints.length)} aria-label="previous">◀</button>
			<span>{current.n}/{prints.length}</span>
			<button onclick={() => (zoom = (zoom! + 1) % prints.length)} aria-label="next">▶</button>
			<button onclick={() => download(current.blob, `${rollName}-${String(current.n).padStart(2, '0')}.jpg`)}>{t('labPageSave')}</button>
			<button onclick={() => (zoom = null)} aria-label={t('close')}>✕</button>
		</div>
		<div
			class="photo"
			role="presentation"
			onpointerdown={(e) => (swipeX = e.clientX)}
			onpointerup={(e) => Math.abs(e.clientX - swipeX) > 40 && (zoom = (zoom! + (e.clientX < swipeX ? 1 : -1) + prints.length) % prints.length)}
		>
			<img src={current.url} alt="#{current.n}" draggable="false" />
		</div>
	</div>
{/if}

{#if notice}
	<button class="notice" onclick={() => (notice = null)}>{t(notice)}</button>
{/if}

<style>
	.app {
		height: 100%;
		box-sizing: border-box;
		padding: calc(env(safe-area-inset-top) + 0.3rem) calc(env(safe-area-inset-right) + 0.3rem)
			calc(env(safe-area-inset-bottom) + 0.3rem) calc(env(safe-area-inset-left) + 0.3rem);
	}
	.shell {
		height: 100%;
		box-sizing: border-box;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		border: 2px solid var(--shell);
		border-radius: 1.3rem 1.3rem 2.2rem 2.2rem;
		overflow: hidden;
		background: linear-gradient(var(--shell-in), var(--bg) 60%);
	}
	main {
		overflow: auto;
		padding: 1rem;
		display: grid;
		gap: 0.9rem;
		align-content: start;
		justify-items: center;
		text-align: center;
		user-select: text;
		-webkit-user-select: text;
	}
	h1 {
		font: 1.5rem/1.15 var(--font);
		margin: 0;
	}
	p {
		margin: 0;
		max-width: 26rem;
	}
	.stamp {
		font: italic 1rem var(--font);
		color: var(--accent);
		letter-spacing: 0.15em;
		opacity: 0.8;
	}
	.muted,
	.fine {
		color: var(--muted);
		font-size: 0.95rem;
	}
	.big {
		font: 1.35rem/1.1 var(--font);
		padding: 0.75rem 1.1rem;
		border-radius: 0.7rem;
		border: 0;
		background: var(--accent);
		color: var(--accent-fg);
		box-shadow: 0 0.2rem 0 #8a6a00;
	}
	.link,
	.home {
		background: none;
		border: 0;
		color: var(--muted);
		text-decoration: underline;
		font: inherit;
		font-size: 1rem;
	}
	progress {
		width: min(20rem, 100%);
		accent-color: var(--accent);
	}
	.bar {
		display: grid;
		gap: 0.5rem;
		justify-items: center;
	}
	/* contact sheet: prints on a dark sleeve, frame numbers in the edge-print orange */
	.sheet {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
		gap: 0.35rem;
		background: #050605;
		padding: 0.5rem;
		border-radius: 0.4rem;
	}
	.print {
		position: relative;
		padding: 0;
		border: 0;
		background: #000;
		aspect-ratio: 3 / 2;
		overflow: hidden;
	}
	.print img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.print span {
		position: absolute;
		left: 0.25rem;
		bottom: 0.1rem;
		font: 0.85rem var(--font);
		color: #ff8a2a;
		text-shadow: 0 0 0.2rem #000;
	}
	.viewer {
		position: absolute;
		inset: 0;
		z-index: 30;
		background: #000;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
	}
	.vbar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem;
		color: var(--fg);
		font-family: var(--font);
	}
	.vbar span {
		flex: 1;
		text-align: center;
	}
	.vbar button {
		min-width: 2.4rem;
		min-height: 2.3rem;
		font: 1.05rem var(--font);
		background: #1d201d;
		color: var(--fg);
		border: 1px solid #333;
		border-radius: 0.4rem;
	}
	.photo {
		position: relative;
		min-height: 0;
		touch-action: pan-y;
	}
	.photo img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.notice {
		position: absolute;
		top: 4rem;
		left: 0.8rem;
		right: 0.8rem;
		z-index: 40;
		padding: 0.6rem;
		border: 0;
		border-radius: 0.5rem;
		background: #10321f;
		color: var(--fg);
		font: 1.05rem var(--font);
	}
</style>
