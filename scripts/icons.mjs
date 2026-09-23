// Pixel-art app icon (D30): a disposable camera on a 32×32 grid, Fuji-green
// body, Kodak yellow/red band, black outline on charcoal. The art sits in the
// central safe zone so Android's round / squircle masks never cut into it.
// Run `node scripts/icons.mjs` after editing; outputs are committed.
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const ART = [
	'...............KYYK.....',
	'..KKKKKKKKKKKKKKKKKKKK..',
	'..KbbbbbbbbbbbbbbbbbbK..',
	'..KBFFFBBBBBBBBBBVVVBK..',
	'..KBFFFBBBKKKKBBBVVVBK..',
	'..KBBBBBBKLLLLKBBBBBBK..',
	'..KBBBBBKLllllLKBBBBBK..',
	'..KBBBBBKLlgwlLKBBBBBK..',
	'..KBBBBBKLlgglLKBBBBBK..',
	'..KBBBBBKLllllLKBBBBBK..',
	'..KBBBBBBKLLLLKBBBBBBK..',
	'..KYYYYYYYKKKKYYYYYYYK..',
	'..KRRRRRRRRRRRRRRRRRRK..',
	'..KBBBBBBBBBBBBBBBBBBK..',
	'..KKKKKKKKKKKKKKKKKKKK..'
];
const TOP = 9;
const LEFT = 4;
const PALETTE = {
	'.': process.env.ICON_BG ?? '#2b2d2b', // charcoal, so the black outline reads
	K: '#000000', // outline
	B: '#007a3d', // Fujifilm green body
	b: '#1d9a55', // body highlight
	F: '#dcdcdc', // flash window
	V: '#0a0a0a', // viewfinder
	L: '#6b6b6b', // lens ring
	l: '#0b0b0b', // lens
	g: '#1f4a63', // glass
	w: '#cfe8f5', // glint
	Y: '#ffc20e', // Kodak yellow
	R: '#e4002b' // film-box red
};

let rects = `<rect width="32" height="32" fill="${PALETTE['.']}"/>`;
ART.forEach((row, y) =>
	[...row].forEach((c, x) => {
		if (c !== '.') rects += `<rect x="${x + LEFT}" y="${y + TOP}" width="1" height="1" fill="${PALETTE[c]}"/>`;
	})
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">${rects}</svg>\n`;

const out = process.env.ICON_OUT ?? 'static/icons';
writeFileSync(`${out}/icon.svg`, svg);
for (const [name, size] of [
	['icon-192.png', 192],
	['icon-512.png', 512],
	['apple-touch-icon.png', 180],
	['favicon-32.png', 32]
]) {
	writeFileSync(`${out}/${name}`, new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());
}
console.log('icons written to', out);
