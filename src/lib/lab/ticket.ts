/**
 * The lab ticket (docs/LAB.md): `https://…/lab/<id>#<key>`. The key sits in the
 * fragment, which browsers never send to a server.
 */
import type { Lang } from '../i18n';

const b64url = {
	encode(bytes: Uint8Array): string {
		let s = '';
		for (const b of bytes) s += String.fromCharCode(b);
		return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	},
	decode(text: string): Uint8Array<ArrayBuffer> {
		const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
		const out = new Uint8Array(s.length);
		for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
		return out;
	}
};

export async function exportKey(key: CryptoKey): Promise<string> {
	return b64url.encode(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

export function importKey(text: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', b64url.decode(text), 'AES-GCM', false, ['decrypt']);
}

export const ID_RE = /^[A-Za-z0-9_-]{22}$/;
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/;

export function ticketUrl(origin: string, id: string, key: string): string {
	return `${origin}/lab/${id}#${key}`;
}

/** "Thu 25" / "jeu. 25" (+ " September" / " septembre"): composed from parts so
 *  every engine writes it the same way. */
function dayLabel(t: number, lang: Lang, withMonth: boolean): string {
	const d = new Date(t);
	const wd = new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(d);
	const month = new Intl.DateTimeFormat(lang, { month: 'long' }).format(d);
	return `${wd} ${d.getDate()}${withMonth ? ` ${month}` : ''}`;
}

/** The two days bounding the window: "Thu 25" … "Sat 27 September". */
export function formatWindow(from: number, to: number, lang: Lang): { from: string; to: string } {
	const sameMonth = new Date(from).getMonth() === new Date(to).getMonth();
	return { from: dayLabel(from, lang, !sameMonth), to: dayLabel(to, lang, true) };
}

export function formatDay(t: number, lang: Lang): string {
	return dayLabel(t, lang, true);
}

/** The message handed to the share sheet (and to "copy"). */
export function ticketMessage(url: string, from: number, to: number, lang: Lang): string {
	const w = formatWindow(from, to, lang);
	return lang === 'fr'
		? `🎞 Retroviseur — ticket de labo\nVoici votre ticket de labo, ne le perdez pas ! Vos tirages seront prêts entre le ${w.from} et le ${w.to}.\n${url}\nPas de ticket, pas de tirages : le labo n'a aucun autre moyen de retrouver votre pellicule.`
		: `🎞 Retroviseur — lab ticket\nThis is your lab ticket, don't lose it! Your prints will be ready between ${w.from} and ${w.to}.\n${url}\nNo ticket, no prints: the lab has no other way to find your roll.`;
}
