import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Fix, SosContact } from './sos';

export const SOS_AUTO_EVENT = 'femcare:sos-auto-changed';
export const MAX_NATIVE_CONTACTS = 5;

export interface SosStatus {
  sms: boolean;
  location: boolean;
  enabled: boolean;
  lockButton: boolean;
  contacts: number;
  widgets: number;
}

interface SosBridgePlugin {
  sync(o: { contacts: { name: string; phone: string }[]; lang: string }): Promise<void>;
  getStatus(): Promise<SosStatus>;
  setEnabled(o: { enabled: boolean }): Promise<void>;
  setLockButton(o: { enabled: boolean }): Promise<void>;
  requestSms(): Promise<{ granted: boolean }>;
  requestLocation(): Promise<{ granted: boolean }>;
  saveFix(o: { lat: number; lon: number; accuracy: number }): Promise<void>;
  clearAll(): Promise<void>;
}

const Bridge = registerPlugin<SosBridgePlugin>('SosBridge');

const isNative = () => Capacitor.isNativePlatform();

/** At most 5 distinct contacts (same last 10 digits counts as the same person), in saved order. */
export function limitContacts(list: SosContact[]): { name: string; phone: string }[] {
  const seen = new Set<string>();
  const out: { name: string; phone: string }[] = [];
  for (const c of list) {
    const key = c.phone.replace(/\D/g, '').slice(-10);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: c.name, phone: c.phone });
    if (out.length >= MAX_NATIVE_CONTACTS) break;
  }
  return out;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isNative()) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const syncNativeContacts = (list: SosContact[], lang: string) =>
  safe<void>(() => Bridge.sync({ contacts: limitContacts(list), lang }), undefined);
export const getNativeStatus = () => safe<SosStatus | null>(() => Bridge.getStatus(), null);
export const setNativeEnabled = (enabled: boolean) => safe<void>(() => Bridge.setEnabled({ enabled }), undefined);
export const setNativeLockButton = (enabled: boolean) => safe<void>(() => Bridge.setLockButton({ enabled }), undefined);
export const saveNativeFix = (fix: Fix) =>
  safe<void>(() => Bridge.saveFix({ lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy ?? 0 }), undefined);
export const clearNative = () => safe<void>(() => Bridge.clearAll(), undefined);
export const requestNativeSms = async () => (await safe(() => Bridge.requestSms(), { granted: false })).granted;
export const requestNativeLocation = async () => (await safe(() => Bridge.requestLocation(), { granted: false })).granted;

/** True while auto-send mode is on. Re-reads when the settings card changes it. */
export function useAutoSendEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => { void getNativeStatus().then((s) => { if (alive) setOn(!!s?.enabled); }); };
    refresh();
    window.addEventListener(SOS_AUTO_EVENT, refresh);
    return () => { alive = false; window.removeEventListener(SOS_AUTO_EVENT, refresh); };
  }, []);
  return on;
}
