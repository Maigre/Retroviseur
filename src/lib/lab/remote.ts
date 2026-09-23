/**
 * The real lab (docs/LAB.md, D44): the roll is uploaded already encrypted, the
 * key only travels in the ticket. Uploads resume after an interruption: the
 * pending upload is saved on the roll, and the lab reports what is missing.
 */
import type { RollRepository } from '../roll/repository';
import { seal } from '../roll/seal';
import type { Roll } from '../roll/types';
import { packSealed, type Manifest } from './archive';
import { exportKey, ticketUrl } from './ticket';
import type { Delivery, Lab, LabStatus, LabTicket, SealedFrame } from './types';

export class LabClosedError extends Error {
	constructor(readonly reason: 'offline' | 'busy' | 'full' | 'error') {
		super(`lab closed: ${reason}`);
	}
}

export interface RemoteTicketData {
	id: string;
	key: string;
	windowFrom: number;
	windowTo: number;
	expiresAt?: number;
	[k: string]: unknown;
}

export class RemoteLab implements Lab {
	readonly kind = 'remote' as const;

	constructor(
		private repo: RollRepository,
		private base = '/api/lab',
		private origin = globalThis.location?.origin ?? ''
	) {}

	async #fetch(path: string, init?: RequestInit): Promise<Response> {
		let r: Response;
		try {
			r = await fetch(`${this.base}${path}`, init);
		} catch {
			throw new LabClosedError('offline');
		}
		if (r.status === 429) throw new LabClosedError('busy');
		if (r.status === 507) throw new LabClosedError('full');
		return r;
	}

	async dropOff(roll: Roll, frames: AsyncIterable<SealedFrame>, onProgress?: (done: number, total: number) => void): Promise<LabTicket> {
		const key = await this.repo.key(roll.id);
		const sealedFrames: SealedFrame[] = [];
		for await (const f of frames) sealedFrames.push(f);
		const total = sealedFrames.length + 1;

		// resume a pending upload if the lab still has it, else start one
		let up = roll.upload;
		let missing: (number | 'manifest')[] | null = null;
		if (up) {
			const r = await this.#fetch(`/rolls/${up.id}`);
			const s = r.ok ? await r.json() : null;
			if (s?.state === 'uploading') missing = s.missing;
			else if (s?.state === 'developing' || s?.state === 'ready') missing = [];
			else up = undefined;
		}
		if (!up) {
			const r = await this.#fetch('/rolls', { method: 'POST', body: JSON.stringify({ frames: sealedFrames.length }) });
			if (!r.ok) throw new LabClosedError('error');
			const j = await r.json();
			up = { id: j.id, token: j.uploadToken, window: j.window };
			await this.repo.save({ ...roll, upload: up });
			missing = null; // everything
		}
		const need = (p: number | 'manifest') => missing === null || missing.includes(p);
		const put = async (what: string, body: Uint8Array<ArrayBuffer>) => {
			const r = await this.#fetch(`/rolls/${up!.id}/${what}`, { method: 'PUT', headers: { authorization: `Bearer ${up!.token}` }, body });
			if (!r.ok) throw new LabClosedError('error');
		};

		let done = 0;
		if (need('manifest')) {
			const manifest: Manifest = {
				v: 1,
				stock: roll.stock,
				loadedAt: roll.loadedAt,
				exposures: roll.exposures,
				frames: sealedFrames.map((f) => f.meta)
			};
			await put('manifest', packSealed(await seal(key, new TextEncoder().encode(JSON.stringify(manifest)).buffer)));
		}
		onProgress?.(++done, total);
		for (const f of sealedFrames) {
			const n = f.meta.index + 1;
			if (need(n)) await put(`frames/${n}`, packSealed(f.sealed));
			onProgress?.(++done, total);
		}
		if (missing === null || missing.length) {
			const r = await this.#fetch(`/rolls/${up.id}/commit`, { method: 'POST', headers: { authorization: `Bearer ${up.token}` } });
			if (!r.ok && r.status !== 409) throw new LabClosedError('error');
		}
		const data: RemoteTicketData = { id: up.id, key: await exportKey(key), windowFrom: up.window.from, windowTo: up.window.to };
		return { lab: this.kind, droppedAt: Date.now(), data };
	}

	async status(ticket: LabTicket): Promise<LabStatus> {
		const { id } = ticket.data as RemoteTicketData;
		const r = await this.#fetch(`/rolls/${id}`);
		if (r.status === 404) return { state: 'gone' };
		if (!r.ok) throw new LabClosedError('error');
		const s = await r.json();
		if (s.state === 'ready') return { state: 'ready', expiresAt: s.expiresAt };
		if (s.state === 'collected') return { state: 'collected', until: s.collectedUntil };
		if (s.state === 'developing') return { state: 'developing' };
		return { state: 'gone' };
	}

	/** Pickup happens on the ticket page; the app just opens it. */
	async collect(roll: Roll): Promise<Delivery> {
		return { kind: 'elsewhere', message: this.link(roll) };
	}

	link(roll: Roll): string {
		const d = roll.ticket?.data as RemoteTicketData;
		return ticketUrl(this.origin, d.id, d.key);
	}
}
