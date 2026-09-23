/**
 * Minimal promise layer over IndexedDB — two stores, no library.
 *
 *   rolls   key `id`               { roll: Roll, key: CryptoKey }
 *   frames  key [rollId, index]    { rollId, index, meta, iv, data }   index `byRoll`
 */
export const DB_NAME = 'retroviseur';
const VERSION = 1;

export function openDB(name = DB_NAME): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(name, VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			db.createObjectStore('rolls', { keyPath: 'roll.id' });
			const frames = db.createObjectStore('frames', { keyPath: ['rollId', 'index'] });
			frames.createIndex('byRoll', 'rollId');
		};
		req.onsuccess = () => {
			// let a database delete (dev reset) or a future upgrade proceed
			req.result.onversionchange = () => req.result.close();
			resolve(req.result);
		};
		req.onerror = () => reject(req.error);
		req.onblocked = () => reject(new Error('database upgrade blocked by another tab'));
	});
}

export function request<T>(r: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => reject(r.error);
	});
}

/** Resolves when the transaction has durably committed. */
export function committed(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
	});
}
