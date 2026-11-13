import { Capacitor } from '@capacitor/core';

export type SaveResult = { ok: true } | { ok: false; reason: 'plugin' | 'failed' };

/**
 * Saves a text file. In the Android app it is written to the app cache and the share sheet opens,
 * so the user picks where it goes. In a browser it downloads normally.
 */
export async function saveTextFile(filename: string, text: string): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) {
    let mods: [typeof import('@capacitor/filesystem'), typeof import('@capacitor/share')];
    try {
      mods = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    } catch {
      return { ok: false, reason: 'plugin' };
    }
    try {
      const { Filesystem, Directory, Encoding } = mods[0];
      const written = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await mods[1].Share.share({ title: filename, dialogTitle: filename, url: written.uri });
      return { ok: true };
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      if (/cancel/i.test(msg)) return { ok: true };
      if (/not implemented|not available|plugin/i.test(msg)) return { ok: false, reason: 'plugin' };
      return { ok: false, reason: 'failed' };
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
