import { supabase } from './supabase';

/**
 * Downloads the small tables the offline layer needs (symptom alerts, symptoms, recent chat history)
 * while the phone is online, so they can be read later without a connection.
 * Read-only: nothing here writes to the server. Failures are ignored.
 */
let running: Promise<void> | null = null;

export function warmOfflineData(userId: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    try { await supabase.from('symptom_alerts').select('*').eq('user_id', userId); } catch { /* ignore */ }
    try { await supabase.from('symptoms').select('*').eq('user_id', userId); } catch { /* ignore */ }
    try {
      await supabase.from('chat_history').select('*').eq('user_id', userId).order('created_at', { ascending: true }).limit(200);
    } catch { /* ignore */ }
  })().finally(() => { running = null; });
  return running;
}