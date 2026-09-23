import { committed, openDB, request } from '../storage/db';
import type { FilmStockId } from '../film/stocks';
import type { SealedFrame } from '../lab/types';
import { expose, loadRoll, RollError } from './roll';
import { canLoad } from './rules';
import { newRollKey, seal } from './seal';
import type { FrameMeta, Roll } from './types';

interface RollRecord {
	roll: Roll;
	/** null once the roll has left the phone (remote lab, ticket handed off) */
	key: CryptoKey | null;
}

interface FrameRecord {
	rollId: string;
	index: number;
	meta: FrameMeta;
	iv: Uint8Array<ArrayBuffer>;
	data: ArrayBuffer;
}

/**
 * The only door to stored rolls. Frames go in sealed and never come back out
 * as pixels here — reading them is the Lab's job.
 */
export class RollRepository {
	constructor(private db: IDBDatabase) {}

	static async open(name?: string): Promise<RollRepository> {
		return new RollRepository(await openDB(name));
	}

	async list(): Promise<Roll[]> {
		const tx = this.db.transaction('rolls');
		const records = await request<RollRecord[]>(tx.objectStore('rolls').getAll());
		return records.map((r) => r.roll).sort((a, b) => a.loadedAt - b.loadedAt);
	}

	async load(stock: FilmStockId, now = Date.now()): Promise<Roll> {
		if (!canLoad(await this.list())) throw new RollError('a roll is already in the camera');
		const record: RollRecord = { roll: loadRoll(stock, now), key: await newRollKey() };
		const tx = this.db.transaction('rolls', 'readwrite');
		tx.objectStore('rolls').add(record);
		await committed(tx);
		return record.roll;
	}

	/** Persist a state transition computed by roll.ts (drop-off, ready, collected). */
	async save(roll: Roll): Promise<void> {
		const tx = this.db.transaction('rolls', 'readwrite');
		const store = tx.objectStore('rolls');
		const record = await request<RollRecord | undefined>(store.get(roll.id));
		if (!record) throw new RollError(`unknown roll ${roll.id}`);
		store.put({ ...record, roll });
		await committed(tx);
	}

	/**
	 * Seal one exposure and advance the counter in a single transaction: the
	 * counter only moves once the frame is durably stored.
	 */
	async recordFrame(rollId: string, jpeg: ArrayBuffer, flash: boolean, now = Date.now()): Promise<Roll> {
		const record = await this.#record(rollId);
		const next = expose(record.roll, now); // throws if the roll is not loaded
		const meta: FrameMeta = { index: record.roll.shot, takenAt: now, flash };
		if (!record.key) throw new RollError('this roll has left the phone');
		const { iv, data } = await seal(record.key, jpeg); // before the tx: crypto awaits would close it

		const tx = this.db.transaction(['rolls', 'frames'], 'readwrite');
		const rolls = tx.objectStore('rolls');
		const current = await request<RollRecord>(rolls.get(rollId));
		if (current.roll.shot !== record.roll.shot) {
			tx.abort();
			throw new RollError('roll changed while the frame was being sealed');
		}
		tx.objectStore('frames').add({ rollId, index: meta.index, meta, iv, data } satisfies FrameRecord);
		rolls.put({ ...current, roll: next });
		await committed(tx);
		return next;
	}

	/** Remember that the film is wound (or not) so a reload keeps the shutter armed. */
	async setWound(rollId: string, wound: boolean): Promise<void> {
		const tx = this.db.transaction('rolls', 'readwrite');
		const store = tx.objectStore('rolls');
		const record = await request<RollRecord | undefined>(store.get(rollId));
		if (!record || record.roll.state !== 'loaded') return;
		store.put({ ...record, roll: { ...record.roll, wound } });
		await committed(tx);
	}

	/** A collected roll leaves the app: record, key and every frame, in one go. */
	async remove(rollId: string): Promise<void> {
		const tx = this.db.transaction(['rolls', 'frames'], 'readwrite');
		tx.objectStore('rolls').delete(rollId);
		tx.objectStore('frames').delete(IDBKeyRange.bound([rollId, 0], [rollId, Infinity]));
		await committed(tx);
	}

	async key(rollId: string): Promise<CryptoKey> {
		const key = (await this.#record(rollId)).key;
		if (!key) throw new RollError('this roll has left the phone');
		return key;
	}

	/**
	 * The roll has left for the lab and its ticket was handed off: delete every
	 * frame and the key. The record stays, holding the backup ticket.
	 */
	async forget(rollId: string): Promise<void> {
		const tx = this.db.transaction(['rolls', 'frames'], 'readwrite');
		const rolls = tx.objectStore('rolls');
		const record = await request<RollRecord | undefined>(rolls.get(rollId));
		if (!record) throw new RollError(`unknown roll ${rollId}`);
		rolls.put({ ...record, key: null });
		tx.objectStore('frames').delete(IDBKeyRange.bound([rollId, 0], [rollId, Infinity]));
		await committed(tx);
	}

	async *frames(rollId: string): AsyncGenerator<SealedFrame> {
		const tx = this.db.transaction('frames');
		const all = await request<FrameRecord[]>(tx.objectStore('frames').index('byRoll').getAll(rollId));
		for (const f of all.sort((a, b) => a.index - b.index)) yield { meta: f.meta, sealed: { iv: f.iv, data: f.data } };
	}

	async #record(rollId: string): Promise<RollRecord> {
		const tx = this.db.transaction('rolls');
		const record = await request<RollRecord | undefined>(tx.objectStore('rolls').get(rollId));
		if (!record) throw new RollError(`unknown roll ${rollId}`);
		return record;
	}
}
