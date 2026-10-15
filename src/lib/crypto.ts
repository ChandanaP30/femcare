// Client-side encryption for health fields (AES-256-GCM, key from passphrase via PBKDF2).
// The key is not extractable and is kept in memory only.
const enc = new TextEncoder();
const dec = new TextDecoder();
const ITERATIONS = 250000;

function toB64(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Random salt, stored once per account (not secret). */
export function newSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Returns "v1.<iv>.<ciphertext>" so the format can change later. */
export async function encryptText(key: CryptoKey, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)));
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  const [version, ivB64, ctB64] = payload.split('.');
  if (version !== 'v1' || !ivB64 || !ctB64) throw new Error('Unknown encrypted format');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ctB64));
  return dec.decode(pt);
}