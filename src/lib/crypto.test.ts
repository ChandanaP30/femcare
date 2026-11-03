import { describe, it, expect, beforeAll } from 'vitest';
import { newSalt, deriveKey, encryptText, decryptText } from './crypto';

let key: CryptoKey;
let other: CryptoKey;
const salt = newSalt();

beforeAll(async () => {
  key = await deriveKey('correct horse 42', salt);
  other = await deriveKey('wrong passphrase', salt);
}, 60000);

describe('crypto', () => {
  it('creates a 16-byte salt, base64 encoded, that differs each time', () => {
    const a = newSalt();
    expect(atob(a).length).toBe(16);
    expect(newSalt()).not.toBe(a);
  });

  it('round-trips text unchanged', async () => {
    const plain = 'Notes with symbols: ₹ 12 °C ಮುಟ್ಟು';
    const enc = await encryptText(key, plain);
    expect(await decryptText(key, enc)).toBe(plain);
  });

  it('produces a versioned payload and never returns the plain text', async () => {
    const enc = await encryptText(key, 'secret note');
    expect(enc.startsWith('v1.')).toBe(true);
    expect(enc).not.toContain('secret note');
  });

  it('uses a fresh IV, so the same text encrypts differently each time', async () => {
    const a = await encryptText(key, 'same');
    const b = await encryptText(key, 'same');
    expect(a).not.toBe(b);
  });

  it('rejects decryption with the wrong passphrase', async () => {
    const enc = await encryptText(key, 'private');
    await expect(decryptText(other, enc)).rejects.toThrow();
  });

  it('rejects a payload in an unknown format', async () => {
    await expect(decryptText(key, 'v2.abc.def')).rejects.toThrow('Unknown encrypted format');
    await expect(decryptText(key, 'garbage')).rejects.toThrow();
  });

  it('rejects a tampered ciphertext', async () => {
    const enc = await encryptText(key, 'integrity');
    const [v, iv, ct] = enc.split('.');
    const flipped = ct.slice(0, -2) + (ct.slice(-2) === 'AA' ? 'BB' : 'AA');
    await expect(decryptText(key, `${v}.${iv}.${flipped}`)).rejects.toThrow();
  });
});