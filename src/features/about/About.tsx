import { Activity, Heart, Shield, Globe, Lock, Stethoscope, MapPin, FileText } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

export default function About() {
  const { t } = useTheme();

  const features = [
    { icon: Activity, title: 'Cycle Tracking', desc: 'Log periods, symptoms, and moods with real data storage.' },
    { icon: Stethoscope, title: 'AI Assistant', desc: 'Three-mode AI: Ask About Me, Learn, and What Should I Do?' },
    { icon: Heart, title: 'Health Education', desc: 'Evidence-based content on menstrual, reproductive, and sexual health.' },
    { icon: MapPin, title: 'Nearby Services', desc: 'Find pharmacies, hospitals, and clinics using OpenStreetMap.' },
    { icon: FileText, title: 'Health Reports', desc: 'Generate a doctor-ready report from your actual logged data.' },
    { icon: Lock, title: 'Privacy Lock', desc: 'PIN protection for sensitive screens and data.' },
    { icon: Globe, title: 'Multilingual', desc: 'English, Hindi, and Kannada support.' },
    { icon: Shield, title: 'Data Privacy', desc: 'Your health data stays yours. No selling or sharing.' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <img src="/image.png" alt="FemCare+ logo" className="w-12 h-12 rounded-xl object-cover" />
        <div>
          <h1 className="text-2xl font-bold text-ink dark:text-gray-100">FemCare+</h1>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">{t('about.version')} 1.0.0</p>
        </div>
      </div>

      <div className="card">
        <p className="text-sm text-ink dark:text-gray-200 leading-relaxed">{t('about.description')}</p>
      </div>

      <div>
        <h2 className="section-title mb-3">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="card flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary dark:bg-primary-800 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink dark:text-gray-100">{f.title}</p>
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-900">
        <h3 className="text-sm font-semibold text-ink dark:text-gray-100 mb-2">Medical Disclaimer</h3>
        <p className="text-sm text-ink dark:text-gray-200 leading-relaxed">
          FemCare+ is a health-information and wellness application. It is NOT a diagnostic system. It does not diagnose diseases, claim certainty, replace doctors, or present cycle predictions as guaranteed. Always consult a qualified healthcare professional for medical concerns.
        </p>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-ink dark:text-gray-100 mb-2">Data & Privacy</h3>
        <p className="text-sm text-ink dark:text-gray-200 leading-relaxed">
          Your data is stored securely and is only accessible to you. We do not sell, share, or expose your health information. API keys and secrets are never placed in client-side code. You can delete your data or account at any time from Privacy & Data settings.
        </p>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-ink dark:text-gray-100 mb-2">Technology</h3>
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
          Built with React, TypeScript, Tailwind CSS, and Supabase. Location services use OpenStreetMap and the Overpass API. AI features use a transparent rule-based system with clean interfaces for future ML integration.
        </p>
      </div>
    </div>
  );
}
