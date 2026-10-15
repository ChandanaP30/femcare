export type Mood = 'good' | 'okay' | 'neutral' | 'low' | 'difficult';

export type Sender = 'user' | 'assistant';

export type Theme = 'light' | 'dark' | 'system';

export type Language = 'en' | 'hi' | 'kn';

export type FlowLevel = 'light' | 'medium' | 'heavy';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface Profile {
  id: string;
  name: string;
  date_of_birth: string | null;
  cycle_length: number;
  period_duration: number;
  last_period_date: string | null;
  cycle_regularity: string;
  typical_symptoms: string[];
  preferences: Record<string, unknown>;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Period {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  notes: string;
  flow_level: FlowLevel | null;
  created_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  mood: string;
  symptoms: string[];
  pain_level: number;
  notes: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  sender: Sender;
  message: string;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string;
  created_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  period_reminders: boolean;
  daily_logging_reminders: boolean;
  medication_reminders: boolean;
  hydration_reminders: boolean;
  cycle_logging_reminders: boolean;
  theme: Theme;
  language: Language;
  created_at: string;
  updated_at: string;
}

export interface CycleInfo {
  currentDay: number;
  phase: CyclePhase;
  nextPeriodDate: string | null;
  fertileWindowStart: string | null;
  fertileWindowEnd: string | null;
  ovulationDate: string | null;
  cycleLength: number;
  periodDuration: number;
  daysUntilNextPeriod: number;
  isOnPeriod: boolean;
  confidence: number;
  predictedCycleLength: number;
  predictedPeriodDuration: number;
  regularityScore: number;
  trendDirection: 'stable' | 'shortening' | 'lengthening';
}

export interface PeriodDayLog {
  id: string;
  user_id: string;
  period_id: string | null;
  log_date: string;
  flow_level: FlowLevel | null;
  mood: string;
  symptoms: string[];
  pain_level: number;
  notes: string;
  created_at: string;
}

export interface NearbyPlace {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  distance: number;
  address: string;
  phone?: string;
  open?: boolean | null;
  tags: Record<string, string>;
}
