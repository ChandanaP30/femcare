// Applies the Smart Alerts edits to four existing FemCare+ files.
//
//   node scripts/apply-smart-alerts.mjs            (run from the project folder)
//   node scripts/apply-smart-alerts.mjs <folder>   (or point it at the project folder)
//
// Safe by design: every anchor is checked before anything is written; if any check fails,
// nothing changes. Files that are already patched are skipped. The original of each changed
// file is saved next to it as <name>.pre-smartalerts.bak
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const REQUIRED_NEW_FILES = [
  'src/lib/symptomAlertPlan.ts',
  'src/lib/symptomAlertService.ts',
  'src/lib/symptomAlertScheduler.ts',
  'src/lib/symptomPatterns.ts',
  'src/lib/symptomSafety.ts',
  'src/components/SmartAlertCard.tsx',
];

// Every `find` is a single-line snippet. `expect` is how many times it must occur (default 1).
// Newlines in `replace` are converted to the file's own line-ending style.
const PATCHES = [
  {
    file: 'src/lib/reminders.ts',
    done: 'smartAlertTips',
    edits: [
      { find: "import type { Period, Profile } from '@/lib/types';",
        replace: "import type { Period, Profile } from '@/lib/types';\nimport type { SmartAlertSlot } from '@/lib/symptomAlertPlan';" },
      { find: '  fertilityEstimates: boolean;',
        replace: '  fertilityEstimates: boolean;\n  /** Pattern-based Smart Alerts. Optional so older saved settings still load. */\n  smartAlerts?: boolean;\n  smartAlertTips?: boolean;' },
      { find: '  fertilityEstimates: false,',
        replace: '  fertilityEstimates: false,\n  smartAlerts: false,\n  smartAlertTips: true,' },
      { find: "  fertility: 'fertility-estimates',",
        replace: "  fertility: 'fertility-estimates',\n  smart: 'smart-alerts'," },
      { find: "  { id: CHANNEL.fertility, name: 'Fertility estimates', description: 'Optional estimated fertile-window reminders' },",
        replace: "  { id: CHANNEL.fertility, name: 'Fertility estimates', description: 'Optional estimated fertile-window reminders' },\n  { id: CHANNEL.smart, name: 'Smart alerts', description: 'At most one gentle heads-up per cycle, based on your own past symptoms' }," },
      { find: 'const ID = { period: 100, checkin: 200, tip: 300, fertility: 400, test: 900 };',
        replace: 'const ID = { period: 100, checkin: 200, tip: 300, fertility: 400, smart: 500, test: 900 };' },
      { find: 'ID.fertility, ID.test];', replace: 'ID.fertility, ID.smart, ID.test];' },
      { find: '  now: Date;',
        replace: '  now: Date;\n  /** Planned by symptomAlertService. This function only fits it into the schedule. */\n  smartAlert?: SmartAlertSlot | null;' },
      { find: 'const { prefs, periods, profile, now } = input;',
        replace: 'const { prefs, periods, profile, now, smartAlert } = input;' },
      { find: '  return items;',
        replace:
`  // 5. Smart Alert (pattern based): at most one per cycle, already time-shifted out of quiet hours.
  //    Skipped when the period reminder lands on the same day, so the two never stack.
  if (prefs.smartAlerts && smartAlert && smartAlert.at > now && !isInQuietHours(smartAlert.at.getHours(), smartAlert.at.getMinutes(), prefs)) {
    const periodItem = items.find((i) => i.id === ID.period);
    const sameDay = periodItem?.at ? startOfDay(periodItem.at).getTime() === startOfDay(smartAlert.at).getTime() : false;
    if (!sameDay) {
      items.push({ id: ID.smart, title: TITLE, body: smartAlert.body, channelId: CHANNEL.smart, route: 'home', at: smartAlert.at });
    }
  }

  return items;` },
      { find: '}): Promise<number> {',
        replace: '  smartAlert?: SmartAlertSlot | null;\n}): Promise<number> {' },
    ],
  },
  {
    file: 'src/lib/reminder-sync.tsx',
    done: 'planSmartAlert',
    edits: [
      { find: "import { loadReminderPrefs, syncReminders, REMINDERS_CHANGED } from '@/lib/reminders';",
        replace: "import { loadReminderPrefs, syncReminders, REMINDERS_CHANGED } from '@/lib/reminders';\nimport { planSmartAlert } from '@/lib/symptomAlertService';" },
      { find: '.then((prefs) => (cancelled ? null : syncReminders({ prefs, periods, profile })))',
        replace:
`.then(async (prefs) => {
          if (cancelled) return null;
          // Never throws: resolves to null when Smart Alerts are off, not due, or unavailable.
          const smartAlert = await planSmartAlert({ userId: user.id, prefs, periods, profile });
          return syncReminders({ prefs, periods, profile, smartAlert });
        })` },
    ],
  },
  {
    file: 'src/screens/NotificationSettingsScreen.tsx',
    done: 'smartAlertTips',
    edits: [
      { find: 'Smartphone, Sparkles, ShieldCheck }', replace: 'Smartphone, Sparkles, ShieldCheck, Activity }' },
      { find: '<p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ink-muted">',
        replace:
`<Card>
        <Row
          icon={Activity}
          title="Smart alerts"
          desc="Learns from your own logged symptoms. If your usual pre-period symptoms show up and your period is estimated within 3 days, you may get one gentle heads-up per cycle. It is never sent right after you log, and never during quiet hours."
          control={<Toggle checked={!!prefs.smartAlerts} onChange={(v) => update({ smartAlerts: v })} label="Smart alerts" disabled={off} />}
        />
        {prefs.smartAlerts && (
          <div className="pl-12">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink-muted">Include preparation tips on the card</p>
              <Toggle checked={prefs.smartAlertTips ?? true} onChange={(v) => update({ smartAlertTips: v })} label="Preparation tips" disabled={off} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Only your own data is used, and the lock-screen text never mentions symptoms. These are patterns, not a diagnosis.
            </p>
          </div>
        )}
      </Card>

      <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ink-muted">` },
    ],
  },
  {
    file: 'src/screens/HomeDashboard.tsx',
    done: 'SmartAlertCard',
    edits: [
      { find: "import PreperiodInsights from '@/components/PreperiodInsights';",
        replace: "import PreperiodInsights from '@/components/PreperiodInsights';\nimport { SmartAlertCard } from '@/components/SmartAlertCard';\nimport { REMINDERS_CHANGED } from '@/lib/reminders';" },
      { find: '{/* Next period */}',
        replace: '<SmartAlertCard userId={user?.id} periods={periods} logs={recentLogs} nextPeriodLabel={formatDateShort(cycleInfo.nextPeriodDate)} />\n\n          {/* Next period */}' },
      // After a check-in is saved, re-plan. The planner delays delivery, so this never notifies at once.
      { find: 'setLogSaved(true);', expect: 2,
        replace: 'setLogSaved(true);\n        window.dispatchEvent(new Event(REMINDERS_CHANGED));' },
    ],
  },
];

const count = (text, find) => text.split(find).length - 1;
const problems = [];

for (const f of REQUIRED_NEW_FILES) {
  if (!fs.existsSync(path.join(root, f))) problems.push(`Missing new file: ${f}. Copy it into the project first.`);
}

const results = [];
for (const p of PATCHES) {
  const full = path.join(root, p.file);
  if (!fs.existsSync(full)) { problems.push(`Cannot find ${p.file} in ${root}`); continue; }
  const raw = fs.readFileSync(full, 'utf8');
  if (raw.includes(p.done)) { results.push({ ...p, full, skip: true }); continue; }
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  let text = raw;
  for (const e of p.edits) {
    const want = e.expect ?? 1;
    const got = count(text, e.find);
    if (got !== want) { problems.push(`${p.file}: expected ${want} match(es) of \`${e.find.slice(0, 70)}\` but found ${got}`); continue; }
    text = text.split(e.find).join(e.replace.replace(/\n/g, nl));
  }
  results.push({ ...p, full, text });
}

if (problems.length) {
  console.error('Nothing was changed. Problems found:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

for (const r of results) {
  if (r.skip) { console.log(`skipped (already applied): ${r.file}`); continue; }
  fs.copyFileSync(r.full, r.full + '.pre-smartalerts.bak');
  fs.writeFileSync(r.full, r.text, 'utf8');
  console.log(`patched: ${r.file}  (backup: ${path.basename(r.full)}.pre-smartalerts.bak)`);
}
console.log('Done. Next: npx tsc --noEmit && npx vitest run');
