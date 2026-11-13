import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { newSalt, deriveKey, encryptText, decryptText } from '@/lib/crypto';

interface CryptoMeta { salt: string; check: string }

interface CryptoContextValue {
  hasSetup: boolean;
  unlocked: boolean;
  /** Forgets the key in memory: the passphrase is needed again. The person stays signed in. */
  lock: () => void;
  setup: (passphrase: string) => Promise<void>;
  /** Sets a new passphrase after the person has proved who they are with an emailed code.
   *  Data encrypted with the old passphrase cannot be opened afterwards. */
  resetPassphrase: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<boolean>;
  encrypt: (plain: string) => Promise<string>;
  decrypt: (stored: string) => Promise<string>;
}

const CHECK_TEXT = 'femcare-check';
const CryptoContext = createContext<CryptoContextValue | null>(null);

function readMeta(profile: unknown): CryptoMeta | null {
  const prefs = ((profile as { preferences?: unknown } | null)?.preferences ?? {}) as Record<string, unknown>;
  const c = prefs.crypto as CryptoMeta | undefined;
  return c && c.salt && c.check ? c : null;
}

export function CryptoProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [meta, setMeta] = useState<CryptoMeta | null>(() => readMeta(profile));
  const [key, setKey] = useState<CryptoKey | null>(null);

  useEffect(() => { setMeta(readMeta(profile)); }, [profile]);
  useEffect(() => { if (!user) setKey(null); }, [user]);

  async function saveMeta(next: CryptoMeta) {
    if (!user) throw new Error('Not signed in');
    const current = ((profile as { preferences?: unknown } | null)?.preferences ?? {}) as Record<string, unknown>;
    const { error } = await supabase
      .from('profiles')
      .update({ preferences: { ...current, crypto: next } })
      .eq('id', user.id);
    if (error) throw error;
    setMeta(next);
  }

  async function setup(passphrase: string) {
    const salt = newSalt();
    const k = await deriveKey(passphrase, salt);
    const check = await encryptText(k, CHECK_TEXT);
    await saveMeta({ salt, check });
    setKey(k);
  }

  async function unlock(passphrase: string) {
    if (!meta) return false;
    try {
      const k = await deriveKey(passphrase, meta.salt);
      const plain = await decryptText(k, meta.check);
      if (plain !== CHECK_TEXT) return false;
      setKey(k);
      return true;
    } catch {
      return false;
    }
  }

  async function encrypt(plain: string) {
    if (!key) throw new Error('Locked');
    return encryptText(key, plain);
  }

  async function decrypt(stored: string) {
    // Rows saved before encryption are plain text and are returned unchanged.
    if (!stored.startsWith('v1.')) return stored;
    if (!key) throw new Error('Locked');
    try {
      return await decryptText(key, stored);
    } catch {
      return '[Unable to decrypt]';
    }
  }

  const value: CryptoContextValue = {
    hasSetup: meta !== null,
    unlocked: key !== null,
    lock: () => setKey(null),
    setup,
    resetPassphrase: setup,
    unlock,
    encrypt,
    decrypt,
  };

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>;
}

export function useCrypto(): CryptoContextValue {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error('useCrypto must be used inside CryptoProvider');
  return ctx;
}