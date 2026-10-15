import { Droplet, Heart, Shield, Brain, MapPin } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

export function AboutScreen() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col items-center text-center py-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-400 to-accent-500 text-white flex items-center justify-center shadow-xl mb-4">
          <Droplet size={44} fill="currentColor" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          FemCare<span className="text-accent-500">+</span>
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-2">{t('aboutTagline')}</p>
        <p className="text-xs text-neutral-400 mt-1">{t('version')}</p>
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-3">{t('aboutFemcareTitle')}</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {t('aboutDesc1')}
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mt-3">
          {t('aboutDesc2')}
        </p>
      </div>

      <div className="space-y-3">
        <FeatureRow icon={Brain} title={t('featureCycleTracking')} description={t('featureCycleTrackingDesc')} />
        <FeatureRow icon={Heart} title={t('featureInsights')} description={t('featureInsightsDesc')} />
        <FeatureRow icon={MapPin} title={t('featureLocator')} description={t('featureLocatorDesc')} />
        <FeatureRow icon={Shield} title={t('featurePrivacy')} description={t('featurePrivacyDesc')} />
      </div>

      <div className="card-soft p-4">
        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">{t('medicalDisclaimerTitle')}</h4>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {t('medicalDisclaimerText')}
        </p>
      </div>

      <div className="card p-5">
        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">{t('creditsTitle')}</h4>
        <div className="space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          <p>{t('creditOsm')}</p>
          <p>{t('creditOverpass')}</p>
          <p>{t('creditBuilt')}</p>
        </div>
      </div>

      <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
        {t('madeWithCare')}
      </p>
    </div>
  );
}

function FeatureRow({ icon: Icon, title, description }: { icon: typeof Brain; title: string; description: string }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="font-medium text-neutral-900 dark:text-neutral-100 text-sm">{title}</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
