/**
 * Stable client-side id generator for circuit entities.
 *
 * `crypto.randomUUID` is only exposed in secure contexts, and `vite dev` is
 * regularly reached over a plain-HTTP LAN address while testing on a phone,
 * so fall back to `crypto.getRandomValues` when it is unavailable.
 */
export function createId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
