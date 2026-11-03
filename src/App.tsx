import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SettingsProvider } from '@/lib/settings-context';
import { LanguageProvider } from '@/lib/language-context';
import { CryptoProvider } from '@/lib/crypto-context';
import { CryptoGate } from '@/screens/UnlockScreen';
import { SplashScreen } from '@/screens/SplashScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { ProfileSetupScreen } from '@/screens/ProfileSetupScreen';
import { AppShell } from '@/components/AppShell';
import { FullScreenSpinner } from '@/components/Spinner';
import { HomeDashboard } from '@/screens/HomeDashboard';
import { CalendarScreen } from '@/screens/CalendarScreen';
import { SymptomsScreen } from '@/screens/SymptomsScreen';
import { InsightsScreen } from '@/screens/InsightsScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { SosScreen } from '@/screens/SosScreen';
import { LocatorScreen } from '@/screens/LocatorScreen';
import { EducationScreen } from '@/screens/EducationScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { PrivacyScreen } from '@/screens/PrivacyScreen';
import { AboutScreen } from '@/screens/AboutScreen';
import { PeriodLeaveGuide } from '@/screens/PeriodLeaveGuide';
import { PeriodLogScreen } from '@/screens/PeriodLogScreen';
import { PeriodHistoryScreen } from '@/screens/PeriodHistoryScreen';
import { NotificationSettingsScreen } from '@/screens/NotificationSettingsScreen';
import { ReminderSync } from '@/lib/reminder-sync';
import { cancelAllReminders } from '@/lib/reminders';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { HealthReportScreen } from '@/screens/HealthReportScreen';
import type { NavKey } from '@/components/nav-items';

type AppPage =
  | NavKey
  | 'symptoms'
  | 'log-period'
  | 'history'
  | 'chat'
  | 'locator'
  | 'education'
  | 'settings'
  | 'privacy'
  | 'about'
  | 'leave-guide'
  | 'report'
  | 'notifications';

const NAV_KEYS: NavKey[] = ['home', 'calendar', 'insights', 'sos', 'profile'];

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentNav, setCurrentNav] = useState<NavKey>('home');
  const [currentPage, setCurrentPage] = useState<AppPage>('home');

  // In-app history of pages we came from. Every navigation pushes the page being left,
  // and every back action pops it. A ref keeps popstate handling free of side effects.
  const backStackRef = useRef<AppPage[]>([]);

  useEffect(() => {
    const seen = localStorage.getItem('femcare_onboarding_seen');
    if (seen && showSplash) {
      setShowSplash(false);
    }
  }, []);

  // Browser and device back: pop our own stack. With an empty stack, stay on the current page.
  useEffect(() => {
    function onPopState() {
      const stack = backStackRef.current;
      if (stack.length === 0) return;
      const prev = stack.pop() as AppPage;
      setCurrentPage(prev);
      if (NAV_KEYS.includes(prev as NavKey)) setCurrentNav(prev as NavKey);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Tap on a notification opens the screen it points to, only when signed in and set up.
  const routeRef = useRef<(page: AppPage) => void>(() => {});
  const readyRef = useRef(false);
  routeRef.current = (page: AppPage) => navigateTo(page);
  readyRef.current = !!user && !!profile?.onboarding_completed;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const route = (event.notification.extra as { route?: string } | undefined)?.route;
      if (route && readyRef.current) routeRef.current(route as AppPage);
    });
    return () => { handle.then((h) => h.remove()); };
  }, []);
  function handleSplashDone() {
    setShowSplash(false);
    if (!localStorage.getItem('femcare_onboarding_seen')) {
      setShowOnboarding(true);
    }
  }

  function handleOnboardingComplete() {
    setShowOnboarding(false);
    localStorage.setItem('femcare_onboarding_seen', 'true');
  }

  function navigateTo(page: AppPage) {
    if (page === currentPage) return;
    backStackRef.current.push(currentPage);
    window.history.pushState({ femcare: true }, '');
    setCurrentPage(page);
    if (NAV_KEYS.includes(page as NavKey)) setCurrentNav(page as NavKey);
  }

  function goHome() {
    setCurrentPage('home');
    setCurrentNav('home');
  }

  // Header back button: returns to the real previous page. Falls back to Home when there is none.
  function goBack() {
    if (backStackRef.current.length === 0) {
      goHome();
      return;
    }
    // The popstate handler pops the stack and restores the previous page.
    window.history.back();
  }

  function handleNavChange(nav: NavKey) {
    navigateTo(nav);
  }

  function handleNavigate(page: string) {
    navigateTo(page as AppPage);
  }

  function handleSignOut() {
    backStackRef.current = [];
    cancelAllReminders();
    signOut();
    goHome();
  }

  if (showSplash) {
    return <SplashScreen onDone={handleSplashDone} />;
  }

  if (showOnboarding && !user) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (loading) {
    return <FullScreenSpinner message="Loading" />;
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  // User is authenticated but hasn't completed onboarding
  if (profile && !profile.onboarding_completed) {
    return <ProfileSetupScreen onComplete={() => {}} />;
  }

  function renderPage() {
    switch (currentPage) {
      case 'home':
        return <HomeDashboard onNavigate={handleNavigate} onNavChange={handleNavChange} />;
      case 'calendar':
        return <CalendarScreen />;
      case 'insights':
        return <InsightsScreen />;
      case 'sos':
        return <SosScreen onNavigate={handleNavigate} />;
      case 'profile':
        return <ProfileScreen onNavigate={handleNavigate} onNavChange={handleNavChange} onSignOut={handleSignOut} />;
      case 'symptoms':
        return <SymptomsScreen />;
      case 'log-period':
        return <PeriodLogScreen onNavigate={handleNavigate} />;
      case 'history':
        return <PeriodHistoryScreen onNavigate={handleNavigate} />;
      case 'chat':
        return <ChatScreen />;
      case 'locator':
        return <LocatorScreen />;
      case 'education':
        return <EducationScreen />;
      case 'settings':
        return <SettingsScreen onNavigate={handleNavigate} />;
      case 'privacy':
        return <PrivacyScreen onSignedOut={handleSignOut} />;
      case 'about':
        return <AboutScreen />;
      case 'report':
        return <HealthReportScreen />;
      case 'notifications':
        return <NotificationSettingsScreen />;
      case 'leave-guide':
        return <PeriodLeaveGuide />;
      default:
        return <HomeDashboard onNavigate={handleNavigate} onNavChange={handleNavChange} />;
    }
  }

  // Secondary screens (anything that is not a bottom-nav tab) get the header back button.
  const showBack = !NAV_KEYS.includes(currentPage as NavKey);

  return (
    <SettingsProvider>
      <AppShell
        currentNav={currentNav}
        onNavChange={handleNavChange}
        onNavigate={handleNavigate}
        showBack={showBack}
        onBack={goBack}
      >
        <ReminderSync />
        {renderPage()}
      </AppShell>
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <CryptoProvider>
          <CryptoGate>
            <AppContent />
          </CryptoGate>
        </CryptoProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
