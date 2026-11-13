import { supabase } from '@/lib/supabase';

export const SYMPTOM_ALERTS_CHANGED = 'femcare:symptom-alerts-changed';

export interface SymptomAlertSettings {
  enabled: boolean;
  maxPerCycle: 1 | 2;
  prepReminders: boolean;
}

/** Off by default: the user opts in. */
export const DEFAULT_SYMPTOM_ALERT_SETTINGS: SymptomAlertSettings = {
  enabled: false,
  maxPerCycle: 1,
  prepReminders: true,
};

export async function loadSymptomAlertSettings(userId: string): Promise<SymptomAlertSettings> {
  const { data } = await supabase.from('user_settings').select('notifications').eq('user_id', userId).maybeSingle();
  const stored = ((data?.notifications as { symptomAlerts?: Partial<SymptomAlertSettings> } | null)?.symptomAlerts) ?? {};
  return {
    enabled: stored.enabled === true,
    maxPerCycle: stored.maxPerCycle === 2 ? 2 : 1,
    prepReminders: stored.prepReminders !== false,
  };
}

/** Stores settings under user_settings.notifications.symptomAlerts, keeping other keys (such as reminders) intact. */
export async function saveSymptomAlertSettings(userId: string, settings: SymptomAlertSettings): Promise<void> {
  const { data } = await supabase.from('user_settings').select('id, notifications').eq('user_id', userId).maybeSingle();
  const current = ((data?.notifications as Record<string, unknown> | null) ?? {});
  const merged = { ...current, symptomAlerts: settings };
  if (data?.id) {
    const { error } = await supabase.from('user_settings').update({ notifications: merged }).eq('id', data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('user_settings').insert({ user_id: userId, notifications: merged });
    if (error) throw error;
  }
  window.dispatchEvent(new Event(SYMPTOM_ALERTS_CHANGED));
}
