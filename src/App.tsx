import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SettingsProvider } from '@/lib/settings-context';
import { LanguageProvider } from '@/lib/language-context';
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
  | 'leave-guide';

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentNav, setCurrentNav] = useState<NavKey>('home');
  const [currentPage, setCurrentPage] = useState<AppPage>('home');

  useEffect(() => {
    const seen = localStorage.getItem('femcare_onboarding_seen');
    if (seen && showSplash) {
      setShowSplash(false);
    }
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

  function handleNavChange(nav: NavKey) {
    setCurrentNav(nav);
    setCurrentPage(nav);
  }

  function handleNavigate(page: string) {
    setCurrentPage(page as AppPage);
    // Also update nav highlight if it's a main nav item
    const navKeys: NavKey[] = ['home', 'calendar', 'insights', 'sos', 'profile'];
    if (navKeys.includes(page as NavKey)) {
      setCurrentNav(page as NavKey);
    }
  }

  function handleSignOut() {
    signOut();
    setCurrentPage('home');
    setCurrentNav('home');
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
      case 'leave-guide':
        return <PeriodLeaveGuide />;
      default:
        return <HomeDashboard onNavigate={handleNavigate} onNavChange={handleNavChange} />;
    }
  }

  return (
    <SettingsProvider>
      <AppShell currentNav={currentNav} onNavChange={handleNavChange} onNavigate={handleNavigate}>
        {renderPage()}
      </AppShell>
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}
