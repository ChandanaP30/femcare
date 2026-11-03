import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { getPredictedPeriodDates } from '@/lib/cycle';
import type { Period } from '@/lib/types';
import {
  COUNTRIES,
  LEAVE_POLICIES,
  findPolicies,
  getLocalizedField,
  getPaidStatusLabel,
  getCategoryLabel,
  generateLeaveRequestMessage,
  getUIString,
  type LeaveCategory,
  type Language,
} from '@/lib/leave-policies';
import {
  Globe,
  MapPin,
  GraduationCap,
  Building2,
  Briefcase,
  CalendarClock,
  Check,
  ExternalLink,
  Copy,
  FileText,
  ShieldCheck,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useEffect } from 'react';

export function PeriodLeaveGuide() {
  const { profile, user } = useAuth();
  const lang: Language = 'en';

  const [countryCode, setCountryCode] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [district, setDistrict] = useState('');
  const [category, setCategory] = useState<LeaveCategory | ''>('');
  const [searched, setSearched] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('periods')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
      .then(({ data }) => setPeriods((data as Period[]) || []));
  }, [user]);

  const predictions = useMemo(() => {
    if (!profile) return [];
    return getPredictedPeriodDates(profile, periods, 3);
  }, [profile, periods]);

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode);
  const selectedState = selectedCountry?.states.find((s) => s.code === stateCode);

  const policies = useMemo(() => {
    if (!countryCode || !category) return [];
    return findPolicies(countryCode, stateCode || null, category as LeaveCategory);
  }, [countryCode, stateCode, category]);

  const userName = profile?.name || '';

  function handleSearch() {
    setSearched(true);
  }

  function handleCheckLeaveForPeriod(dates: { start: string; end: string }) {
    if (!policies.length || !category) return;
    const policy = policies[0];
    const title = getLocalizedField(policy.title, lang);
    const msg = generateLeaveRequestMessage(userName, dates, policy.leaveDays, title, lang);
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyRequestMessage(policyTitle: string, leaveDays: number | null) {
    const msg = generateLeaveRequestMessage(userName, predictions[0] || null, leaveDays, policyTitle, lang);
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const t = (key: Parameters<typeof getUIString>[0]) => getUIString(key, lang);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="text-primary-500" size={24} />
          <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('title')}</h1>
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('subtitle')}</p>
      </div>

      {/* Info banner */}
      <div className="card-soft p-4 flex items-start gap-3">
        <Sparkles size={18} className="text-accent-500 shrink-0 mt-0.5 dark:text-accent-300" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          All policies below are verified against official government sources. Always confirm with your HR department or institution, as employer-specific policies may differ.
        </p>
      </div>

      {/* Location & category selectors */}
      <div className="card p-5 space-y-4">
        {/* Country */}
        <div>
          <label className="label-text flex items-center gap-2">
            <Globe size={16} /> {t('selectCountry')}
          </label>
          <select
            value={countryCode}
            onChange={(e) => { setCountryCode(e.target.value); setStateCode(''); setDistrict(''); setSearched(false); }}
            className="input-field"
          >
            <option value="">—</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{getLocalizedField(c.name, lang)}</option>
            ))}
          </select>
        </div>

        {/* State */}
        {selectedCountry && selectedCountry.states.length > 1 && (
          <div>
            <label className="label-text flex items-center gap-2">
              <MapPin size={16} /> {t('selectState')}
            </label>
            <select
              value={stateCode}
              onChange={(e) => { setStateCode(e.target.value); setDistrict(''); setSearched(false); }}
              className="input-field"
            >
              <option value="">—</option>
              {selectedCountry.states.map((s) => (
                <option key={s.code} value={s.code}>{getLocalizedField(s.name, lang)}</option>
              ))}
            </select>
          </div>
        )}

        {/* District */}
        {selectedState && selectedState.districts.length > 0 && (
          <div>
            <label className="label-text flex items-center gap-2">
              <MapPin size={16} /> {t('selectDistrict')}
            </label>
            <select
              value={district}
              onChange={(e) => { setDistrict(e.target.value); setSearched(false); }}
              className="input-field"
            >
              <option value="">—</option>
              {selectedState.districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        {/* Category */}
        <div>
          <label className="label-text">{t('selectCategory')}</label>
          <div className="grid grid-cols-3 gap-2">
            <CategoryButton icon={GraduationCap} label={t('student')} active={category === 'student'} onClick={() => { setCategory('student'); setSearched(false); }} />
            <CategoryButton icon={Building2} label={t('employeeGov')} active={category === 'employee_government'} onClick={() => { setCategory('employee_government'); setSearched(false); }} />
            <CategoryButton icon={Briefcase} label={t('employeePrivate')} active={category === 'employee_private'} onClick={() => { setCategory('employee_private'); setSearched(false); }} />
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={!countryCode || !category}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <ShieldCheck size={18} /> {t('checkPolicies')}
        </button>
      </div>

      {/* Predicted periods */}
      {predictions.length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-3 flex items-center gap-2">
            <CalendarClock size={18} className="text-primary-500" /> {t('predictedPeriods')}
          </h3>
          <div className="space-y-2">
            {predictions.map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-700/30 rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {new Date(p.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(p.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-neutral-400">{i === 0 ? 'Next predicted' : `${i + 1} cycles ahead`}</p>
                </div>
                {searched && policies.length > 0 && (
                  <button
                    onClick={() => handleCheckLeaveForPeriod(p)}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {t('checkLeaveForPeriod')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="space-y-4">
          <h3 className="section-title">{t('applicablePolicies')}</h3>

          {policies.length === 0 ? (
            <div className="card p-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center mb-3">
                <ShieldCheck className="text-neutral-400" size={28} />
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">{t('noPolicy')}</p>
            </div>
          ) : (
            policies.map((policy) => {
              const title = getLocalizedField(policy.title, lang);
              const desc = getLocalizedField(policy.description, lang);
              const elig = getLocalizedField(policy.eligibility, lang);
              const cond = getLocalizedField(policy.conditions, lang);
              const paidLabel = getPaidStatusLabel(policy.paidStatus, lang);
              const catLabel = getCategoryLabel(policy.category, lang);

              return (
                <div key={policy.id} className="card p-5 space-y-4 animate-slide-up">
                  {/* Title + badges */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h4>
                      <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                        {catLabel}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{desc}</p>
                  </div>

                  {/* Key facts grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {policy.leaveDays !== null && (
                      <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-xl p-3">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('leaveDays')}</p>
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                          {policy.leaveDays} {t('days')}
                          <span className="text-xs font-normal text-neutral-400 ml-1">{policy.leaveDays <= 1 ? t('perMonth') : t('perYear')}</span>
                        </p>
                      </div>
                    )}
                    <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-xl p-3">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('paidStatus')}</p>
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{paidLabel}</p>
                    </div>
                  </div>

                  {/* Eligibility */}
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">{t('eligibility')}</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{elig}</p>
                  </div>

                  {/* Conditions */}
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">{t('conditions')}</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{cond}</p>
                  </div>

                  {/* Source */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-700/50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-neutral-400">{t('officialSource')}</p>
                        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mt-0.5">{policy.sourceName}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{t('lastVerified')}: {policy.lastVerified}</p>
                      </div>
                      <a
                        href={policy.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        <ExternalLink size={14} /> {t('viewSource')}
                      </a>
                    </div>
                  </div>

                  {/* Leave request generator */}
                  <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-primary-600 dark:text-primary-400" />
                      <h5 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t('createLeaveRequest')}</h5>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('editAndCopy')}</p>
                    <pre className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-sans bg-white dark:bg-neutral-800 rounded-lg p-3 border border-neutral-200 dark:border-neutral-700 max-h-48 overflow-y-auto">
                      {generateLeaveRequestMessage(userName, predictions[0] || null, policy.leaveDays, title, lang)}
                    </pre>
                    <button
                      onClick={() => copyRequestMessage(title, policy.leaveDays)}
                      className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                    >
                      {copied ? <><Check size={16} /> {t('copied')}</> : <><Copy size={16} /> {t('copyToClipboard')}</>}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* All known policies quick reference */}
      {!searched && (
        <div className="card p-5">
          <button
            onClick={() => {
              const el = document.getElementById('all-policies');
              el?.classList.toggle('hidden');
            }}
            className="w-full flex items-center justify-between text-sm font-semibold text-neutral-700 dark:text-neutral-300"
          >
            <span>All verified policies ({LEAVE_POLICIES.length})</span>
            <ChevronDown size={18} className="text-neutral-400" />
          </button>
          <div id="all-policies" className="hidden mt-4 space-y-2">
            {LEAVE_POLICIES.map((p) => {
              const country = COUNTRIES.find((c) => c.code === p.country);
              const state = country?.states.find((s) => s.code === p.state);
              const locName = state
                ? `${getLocalizedField(state.name, lang)}, ${getLocalizedField(country!.name, lang)}`
                : getLocalizedField(country!.name, lang);
              return (
                <div key={p.id} className="flex items-start gap-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{getLocalizedField(p.title, lang)}</p>
                    <p className="text-xs text-neutral-400">{locName} · {getPaidStatusLabel(p.paidStatus, lang)}</p>
                  </div>
                  {p.leaveDays && (
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400 shrink-0">{p.leaveDays}d</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryButton({ icon: Icon, label, active, onClick }: { icon: typeof GraduationCap; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
        active
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
      }`}
    >
      <Icon size={20} />
      <span className="text-xs font-medium text-center leading-tight">{label}</span>
    </button>
  );
}
