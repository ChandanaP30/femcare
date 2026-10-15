# FemCare+ fixes (verified by tests and build)

## Bugs fixed
1. **Date off by one day in India (and other zones).** Dates were converted with `toISOString()` (UTC),
   so the next period, ovulation and fertile window showed one day early in IST, and "today" was wrong
   between 00:00 and 05:30 IST. Now uses local-date helpers `toDateStr()` / `todayStr()` and `parseDate()`
   reads `YYYY-MM-DD` as a local date. Files: `src/lib/cycle.ts`, `SymptomsScreen`, `CalendarScreen`,
   `HomeDashboard`, `PeriodLogScreen`.
2. **Ovulation formula.** Was cycle length / 2 (wrong for non-28-day cycles, and it contradicted the chatbot).
   Now ovulation = next period - 14 days (`LUTEAL_PHASE_DAYS`). Still an estimate, not clinical.
3. **Chatbot keyword matching.** `includes()` matched inside words ('late' in 'translate'). Now whole-word matching.
4. **Android location.** Manifest only had INTERNET; added ACCESS_COARSE/FINE_LOCATION so nearby search can work
   in the APK. Also set `allowBackup="false"` so session data is not copied to cloud backups.
5. **Type errors and lint errors.** Added 4 missing translation keys to `TranslationKey`; removed unused imports.

## Added
- **Offline mode.** Cycle, period, symptom, SOS-contact, settings and chat data are kept in a local copy on the phone.
  Offline, reads come from that copy and writes are saved there and queued; when the internet returns the queue is
  sent in order. New rows get ids on the phone so a retried save cannot create duplicates. A banner shows
  "offline", "N changes waiting to sync" or a conflict warning (English, Hindi, Kannada).
  Files: `src/lib/offline.ts` (new), `src/components/OfflineBanner.tsx` (new), `src/lib/supabase.ts`,
  `src/lib/auth-context.tsx` (starts offline with the stored login, clears local data on sign-out if nothing is
  waiting to sync), `src/components/AppShell.tsx`, `src/screens/LocatorScreen.tsx` (clear offline message),
  `src/lib/i18n.ts` (5 new texts), `src/main.tsx` + `src/index.css` (fonts now bundled, no Google Fonts needed).
  `src/lib/offline.test.ts`: 15 tests with the real Supabase client against a fake backend.
- **Multilingual Ask AI (Hindi + Kannada).** The assistant now detects the script you type in (Devanagari / Kannada)
  and answers in that language; for English-letter text it answers in the app language. All 15 topics have Hindi and
  Kannada keywords and answers, plus localized fallback message and suggested questions.
  Files: `src/lib/chatbot-translations.ts` (new), `src/lib/chatbot.ts`, `src/screens/ChatScreen.tsx`.
  **The Hindi and Kannada texts were drafted with AI help and MUST be reviewed by a native speaker before release.**
- `src/lib/chatbot.test.ts`: 20 tests for multilingual behaviour.
- `src/lib/cycle.test.ts`: 21 automated tests (date handling, predictions, phases, chatbot). Run `npm test`
  or `npm run test:tz` (runs in IST, UTC and Los Angeles time zones).

## Offline: what works and what does not
- Works offline: opening the app (installed APK), logging periods and symptoms, calendar, insights, history,
  SOS contacts (calls/SMS need phone signal), education articles, rule-based chat, language switching.
- Needs internet: first login, sign-up, password reset, nearby-service search and map tiles, syncing.
- You must open the app online at least once after login so the local copy is downloaded.
- Conflicts: last-write-wins. If the same day was logged on two devices, the offline entry that conflicts is
  dropped and the banner says so.
- The local copy is stored in the app's private storage and is NOT encrypted. Consider encrypting it (Android
  Keystore / secure storage plugin) before a public release, and say so in the paper's privacy section.
- The browser (web) version has no service worker, so it does not open offline; only the installed APK does.

## Still to do (not fixed yet)
- Health articles, symptom list and leave policies are English only (chatbot is now multilingual).
- Romanised Hindi/Kannada typed in English letters (e.g. 'pet dard') is not understood.
- Dates in screens still use the 'en-US' format.
- Kannada UI is partial (154 of 239 strings).
- SOS has no location sharing / one-tap alert.
- Fertile window offsets (-4/+1 days) and the 14-day luteal assumption are modelling choices to cite or justify.
