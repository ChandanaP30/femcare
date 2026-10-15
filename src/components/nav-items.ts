import { Home, Calendar, Brain, Siren, User, type LucideIcon } from 'lucide-react';

export type NavKey = 'home' | 'calendar' | 'insights' | 'sos' | 'profile';

export const NAV_ITEMS: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'insights', label: 'Insights', icon: Brain },
  { key: 'sos', label: 'SOS', icon: Siren },
  { key: 'profile', label: 'Profile', icon: User },
];
