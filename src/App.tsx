import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  MailWarning,
  SearchCheck,
  Timer,
  GitBranch,
  PhoneCall,
  Bot,
  BookOpen,
  Trophy,
  User as UserIcon,
  Shield,
  LogOut,
  Menu,
  X,
  Home,
} from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { apiFetch, setAuthToken } from './lib/api';
import { LanguageSwitcher, useLanguage } from './lib/i18n';
import type { AuthUser } from './types/scamverse';
import { BrandMark } from './components/BrandMark';
import { LandingPage, type LandingTarget } from './components/LandingPage';
import { AuthViews, type AuthMode } from './components/AuthViews';
import { DashboardView, type WorkspaceTab } from './components/DashboardView';
import { FakeInboxView } from './components/FakeInboxView';
import { DigitalDetectiveView } from './components/DigitalDetectiveView';
import { TimedChallengeView } from './components/TimedChallengeView';
import { ConsequenceView } from './components/ConsequenceView';
import { NumberGuardView } from './components/NumberGuardView';
import { CyberCoachView } from './components/CyberCoachView';
import { LearningCentreView } from './components/LearningCentreView';
import {
  AdminModerationView,
  LeaderboardView,
  ProfileView,
} from './components/ProfileLeaderboardAdmin';

export default function App() {
  const { t, isUrdu } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<'landing' | 'auth' | 'workspace'>('landing');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const navItems: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: t('Dashboard', 'ڈیش بورڈ'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'fake_inbox', label: t('Fake Inbox', 'فیک ان باکس'), icon: <MailWarning className="w-4 h-4" /> },
    { id: 'digital_detective', label: t('Digital Detective', 'ڈیجیٹل ڈیٹیکٹو'), icon: <SearchCheck className="w-4 h-4" /> },
    { id: 'timed_challenge', label: t('60s Challenge', '60 سیکنڈ چیلنج'), icon: <Timer className="w-4 h-4" /> },
    { id: 'consequence', label: t('Consequences', 'فیصلے اور نتائج'), icon: <GitBranch className="w-4 h-4" /> },
    { id: 'numberguard', label: t('NumberGuard', 'نمبر گارڈ'), icon: <PhoneCall className="w-4 h-4" /> },
    { id: 'coach', label: t('AI Cyber Coach', 'AI سائبر کوچ'), icon: <Bot className="w-4 h-4" /> },
    { id: 'learn', label: t('Learning Centre', 'لرننگ سینٹر'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'leaderboard', label: t('Leaderboard', 'لیڈر بورڈ'), icon: <Trophy className="w-4 h-4" /> },
    { id: 'profile', label: t('Profile & Badges', 'پروفائل اور بیجز'), icon: <UserIcon className="w-4 h-4" /> },
    { id: 'admin', label: t('Moderation', 'ماڈریشن'), icon: <Shield className="w-4 h-4" /> },
  ];

  useEffect(() => {
    apiFetch<{ user: AuthUser | null }>('/api/auth/me')
      .then((res) => {
        if (res.user) {
          setUser(res.user);
        }
      })
      .catch(() => null)
      .finally(() => setBooting(false));
  }, []);

  const refreshProfile = () => {
    setRefreshSignal((s) => s + 1);
    apiFetch<{ user: AuthUser | null }>('/api/auth/me')
      .then((res) => {
        if (res.user) setUser(res.user);
      })
      .catch(() => null);
  };

  const handleEnterWorkspace = async (targetTab: WorkspaceTab = 'dashboard') => {
    try {
      const data = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/demo', {
        method: 'POST',
      });
      setAuthToken(data.token);
      setUser(data.user);
      setActiveTab(targetTab);
      setView('workspace');
    } catch {
      setAuthMode('login');
      setView('auth');
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setView('landing');
    setMobileMenuOpen(false);
  };

  const handleLandingNavigate = (target: LandingTarget) => {
    if (user) {
      setActiveTab(target);
      setView('workspace');
    } else {
      handleEnterWorkspace(target);
    }
  };

  const goBackToDashboard = () => setActiveTab('dashboard');

  if (booting) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center text-sm text-slate-600">
        {t('Loading ScamVerse...', 'اسکیم ورس لوڈ ہو رہا ہے...')}
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      {view === 'landing' && (
        <LandingPage
          user={user}
          onStartMission={() => {
            if (user) {
              setActiveTab('fake_inbox');
              setView('workspace');
            } else {
              handleEnterWorkspace('fake_inbox');
            }
          }}
          onExploreWorkspace={() => {
            if (user) {
              setActiveTab('dashboard');
              setView('workspace');
            } else {
              handleEnterWorkspace('dashboard');
            }
          }}
          onNavigateAuth={(mode) => {
            setAuthMode(mode);
            setView('auth');
          }}
          onNavigateApp={handleLandingNavigate}
        />
      )}

      {view === 'auth' && (
        <AuthViews
          mode={authMode}
          onChangeMode={setAuthMode}
          onAuthenticated={(authedUser) => {
            setUser(authedUser);
            setActiveTab('dashboard');
            setView('workspace');
          }}
          onBackHome={() => setView('landing')}
        />
      )}

      {view === 'workspace' && user && (
        <div className="min-h-screen bg-[#F4F7FB] text-slate-900 flex flex-col lg:flex-row">
          {/* Desktop Sidebar */}
          <aside
            className={`hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 ${
              isUrdu ? 'border-l' : 'border-r'
            } border-slate-200 bg-white min-h-screen sticky top-0`}
          >
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 gap-2">
              <BrandMark onClick={() => setView('landing')} />
            </div>

            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">
                {t('Language', 'زبان')}
              </span>
              <LanguageSwitcher compact />
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <span className={active ? 'text-emerald-700' : 'text-slate-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/70">
              <div className="text-xs">
                <div className="font-bold text-slate-900 truncate">{user.displayName}</div>
                <div className="font-mono text-slate-500 tabular-nums" dir="ltr">
                  Lv.{user.level} · {user.totalPoints} pts
                </div>
              </div>
              {user.isDemo && (
                <button
                  type="button"
                  onClick={() => {
                    handleLogout().then(() => {
                      setAuthMode('signup');
                      setView('auth');
                    });
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors"
                >
                  {t('Create Permanent Account', 'مستقل اکاؤنٹ بنائیں')}
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setView('landing')}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>{t('Home', 'ہوم')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-medium text-slate-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('Sign Out', 'لاگ آؤٹ')}</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 h-14 px-4 border-b border-slate-200 bg-white/95 backdrop-blur-md flex items-center justify-between gap-3">
            <BrandMark onClick={() => setView('landing')} />
            <div className="flex items-center gap-2.5">
              <LanguageSwitcher compact />
              <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums hidden sm:inline" dir="ltr">
                {user.totalPoints} pts
              </span>
              <button
                type="button"
                aria-label="Toggle navigation menu"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="p-2 rounded-lg border border-slate-200 text-slate-700"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </header>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-b border-slate-200 bg-white p-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    activeTab === item.id
                      ? 'bg-emerald-50 text-emerald-800 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('landing');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Home className="w-4 h-4" />
                  <span>{t('Back to Home', 'ہوم پر واپس')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('Sign Out', 'لاگ آؤٹ')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Content Viewport */}
          <main className="flex-1 min-w-0">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {activeTab === 'dashboard' && (
                <DashboardView
                  onNavigate={setActiveTab}
                  onBackHome={() => setView('landing')}
                  refreshSignal={refreshSignal}
                />
              )}
              {activeTab === 'fake_inbox' && (
                <FakeInboxView onProgressUpdated={refreshProfile} onBack={goBackToDashboard} />
              )}
              {activeTab === 'digital_detective' && (
                <DigitalDetectiveView
                  onProgressUpdated={refreshProfile}
                  onBack={goBackToDashboard}
                />
              )}
              {activeTab === 'timed_challenge' && (
                <TimedChallengeView
                  onProgressUpdated={refreshProfile}
                  onBack={goBackToDashboard}
                />
              )}
              {activeTab === 'consequence' && (
                <ConsequenceView onProgressUpdated={refreshProfile} onBack={goBackToDashboard} />
              )}
              {activeTab === 'numberguard' && <NumberGuardView onBack={goBackToDashboard} />}
              {activeTab === 'coach' && <CyberCoachView onBack={goBackToDashboard} />}
              {activeTab === 'learn' && (
                <LearningCentreView onProgressUpdated={refreshProfile} onBack={goBackToDashboard} />
              )}
              {activeTab === 'leaderboard' && <LeaderboardView onBack={goBackToDashboard} />}
              {activeTab === 'profile' && (
                <ProfileView
                  user={user}
                  onUserUpdated={(u) => setUser(u)}
                  onBack={goBackToDashboard}
                />
              )}
              {activeTab === 'admin' && (
                <AdminModerationView
                  user={user}
                  onUserUpdated={(u) => setUser(u)}
                  onBack={goBackToDashboard}
                />
              )}
            </div>
          </main>
        </div>
      )}
    </MotionConfig>
  );
}
