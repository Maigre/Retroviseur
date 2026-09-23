/**
 * Per-roll sealing (ARCHITECTURE.md § Sealing). Every frame is AES-GCM
 * encrypted with the roll's key before it touches storage. The key is
 * extractable so a remote lab can later receive it wrapped (and the phone
 * then forgets it).
 */
export interface Sealed {
	iv: Uint8Array<ArrayBuffer>;
	data: ArrayBuffer;
}

export function newRollKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, bytes: ArrayBuffer): Promise<Sealed> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
	return { iv, data };
}

export function unseal(key: CryptoKey, sealed: Sealed): Promise<ArrayBuffer> {
	return crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, key, sealed.data);
}
