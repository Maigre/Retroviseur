/**
 * What comes with the prints (D53, answers Q4): a contact sheet image and a
 * roll.json, alongside the frames in every zip.
 */
import { STOCKS, type FilmStockId } from '../film/stocks';
import type { Manifest } from './archive';

export function rollJson(m: Manifest, version: string): string {
	const stock = STOCKS[m.stock as FilmStockId];
	return JSON.stringify(
		{
			app: 'Retroviseur',
			version,
			film: stock?.label ?? m.stock,
			loaded: new Date(m.loadedAt).toISOString(),
			exposures: m.exposures,
			frames: m.frames.map((f) => ({ n: f.index + 1, taken: new Date(f.takenAt).toISOString(), flash: f.flash }))
		},
		null,
		2
	);
}

/** One JPEG with every frame as a small print, numbered like film edge marks. */
export async function contactSheet(frames: Blob[], m: Manifest): Promise<Blob> {
	const cols = 5;
	const cw = 300;
	const ch = 200;
	const gap = 14;
	const head = 70;
	const rows = Math.ceil(frames.length / cols);
	const c = document.createElement('canvas');
	c.width = cols * cw + (cols + 1) * gap;
	c.height = head + rows * (ch + gap + 22) + gap;
	const g = c.getContext('2d')!;
	g.fillStyle = '#0b0d0b';
	g.fillRect(0, 0, c.width, c.height);
	g.fillStyle = '#ffc20e';
	g.font = 'italic 40px VT323, ui-monospace, monospace';
	const stock = STOCKS[m.stock as FilmStockId]?.label ?? m.stock;
	const d = new Date(m.loadedAt);
	g.fillText(`RETROVISEUR · ${stock} · ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`, gap, 48);
	for (let i = 0; i < frames.length; i++) {
		const x = gap + (i % cols) * (cw + gap);
		const y = head + Math.floor(i / cols) * (ch + gap + 22);
		const bmp = await createImageBitmap(frames[i]);
		const k = Math.min(cw / bmp.width, ch / bmp.height);
		const w = bmp.width * k;
		const h = bmp.height * k;
		g.fillStyle = '#000';
		g.fillRect(x, y, cw, ch);
		g.drawImage(bmp, x + (cw - w) / 2, y + (ch - h) / 2, w, h);
		bmp.close();
		g.fillStyle = '#ff8a2a';
		g.font = '22px VT323, ui-monospace, monospace';
		g.fillText(`▸${i + 1}${m.frames[i]?.flash ? ' ⚡' : ''}`, x, y + ch + 20);
	}
	return new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.85));
}
