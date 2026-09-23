// Render static/icons/icon.svg to the PNG sizes the manifest and iOS need.
// Run after editing the SVG: `node scripts/icons.mjs` (outputs are committed).
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('static/icons/icon.svg');
for (const [name, size] of [
	['icon-192.png', 192],
	['icon-512.png', 512],
	['apple-touch-icon.png', 180]
]) {
	const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng();
	writeFileSync(`static/icons/${name}`, png);
	console.log(name, png.length, 'bytes');
}
