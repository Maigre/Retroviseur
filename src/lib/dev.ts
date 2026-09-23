/**
 * Hidden developer mode (tap the frame counter 7 times). Lets the developer
 * look at sealed frames, fill a roll, and skip the lab wait. Deliberately
 * breaks the product rules — it must never be reachable by accident.
 */
import type { RollRepository } from './roll/repository';
import { unseal } from './roll/seal';
import type { Roll } from './roll/types';

const KEY = 'retroviseur-dev';

export function devEnabled(): boolean {
	try {
		return localStorage.getItem(KEY) === '1';
	} catch {
		return false;
	}
}

export function setDev(on: boolean): void {
	try {
		if (on) localStorage.setItem(KEY, '1');
		else localStorage.removeItem(KEY);
	} catch {
		// private mode: dev mode just won't stick
	}
}

const LAB_KEY = 'retroviseur-devlab';

/** Dev lab: drop rolls off at the on-phone time-lock lab instead of the real one. */
export function devLabEnabled(): boolean {
	try {
		return localStorage.getItem(LAB_KEY) === '1';
	} catch {
		return false;
	}
}

export function setDevLab(on: boolean): void {
	try {
		if (on) localStorage.setItem(LAB_KEY, '1');
		else localStorage.removeItem(LAB_KEY);
	} catch {
		// private mode
	}
}

/** A grey placeholder "exposure" so a roll can be filled without shooting. */
async function placeholder(n: number): Promise<ArrayBuffer> {
	const c = document.createElement('canvas');
	c.width = 1500;
	c.height = 1000;
	const g = c.getContext('2d')!;
	g.fillStyle = '#6b6b6b';
	g.fillRect(0, 0, c.width, c.height);
	g.fillStyle = '#ff6a13';
	g.font = 'bold 160px monospace';
	g.textAlign = 'center';
	g.fillText(`DEV ${String(n).padStart(2, '0')}`, c.width / 2, c.height / 2 + 50);
	const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.8));
	return blob.arrayBuffer();
}

/** Expose placeholder frames until `leave` frames remain. */
export async function fillRoll(repo: RollRepository, roll: Roll, leave = 1): Promise<void> {
	let r = roll;
	while (r.state === 'loaded' && r.exposures - r.shot > leave) {
		r = await repo.recordFrame(r.id, await placeholder(r.shot + 1), false);
	}
}

/** Make a developing roll due now; the next status check marks it ready. */
export async function skipWait(repo: RollRepository, roll: Roll): Promise<void> {
	if (roll.state !== 'developing' || !roll.ticket) return;
	await repo.save({ ...roll, ticket: { ...roll.ticket, data: { ...roll.ticket.data, readyAt: Date.now() } } });
}

export interface DevFrame {
	index: number;
	takenAt: number;
	flash: boolean;
	url: string;
	width: number;
	height: number;
	bytes: number;
}

/** Unseal a roll's frames to object URLs. Caller revokes them. */
export async function viewFrames(repo: RollRepository, rollId: string): Promise<DevFrame[]> {
	const key = await repo.key(rollId);
	const out: DevFrame[] = [];
	for await (const f of repo.frames(rollId)) {
		const blob = new Blob([await unseal(key, f.sealed)], { type: 'image/jpeg' });
		const bmp = await createImageBitmap(blob);
		out.push({ ...f.meta, url: URL.createObjectURL(blob), width: bmp.width, height: bmp.height, bytes: blob.size });
		bmp.close();
	}
	return out;
}

export async function wipeEverything(): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const r = indexedDB.deleteDatabase('retroviseur');
		r.onsuccess = () => resolve();
		r.onerror = () => reject(r.error);
		r.onblocked = () => resolve(); // closes when the page reloads
	});
}
