import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Award,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Flame,
  Lightbulb,
  MailCheck,
  PhoneCall,
  SearchCheck,
  ShieldCheck,
  Target,
  Timer,
  XCircle,
  Zap,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import type { DashboardData } from '../types/scamverse';

export type WorkspaceTab =
  | 'dashboard'
  | 'fake_inbox'
  | 'digital_detective'
  | 'timed_challenge'
  | 'consequence'
  | 'numberguard'
  | 'coach'
  | 'learn'
  | 'leaderboard'
  | 'profile'
  | 'admin';

interface DashboardViewProps {
  onNavigate: (tab: WorkspaceTab) => void;
  onBackHome: () => void;
  refreshSignal: number;
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  'mail-check': <MailCheck className="w-5 h-5" />,
  'search-check': <SearchCheck className="w-5 h-5" />,
  'shield-check': <ShieldCheck className="w-5 h-5" />,
  zap: <Zap className="w-5 h-5" />,
  award: <Award className="w-5 h-5" />,
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onBackHome,
  refreshSignal,
}) => {
  const { isUrdu, t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<DashboardData>('/api/progress/dashboard')
      .then(setData)
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : t('Unable to load dashboard.', 'ڈیش بورڈ لوڈ نہیں ہو سکا۔')
        );
      })
      .finally(() => setLoading(false));
  }, [refreshSignal]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-xl bg-white border border-slate-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white border border-slate-200" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-white border border-slate-200" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {error || t('Dashboard data could not be loaded.', 'ڈیش بورڈ کا ڈیٹا لوڈ نہیں ہو سکا۔')}
      </div>
    );
  }

  const { profile, stats, weeklyProgress, badges, recentActivity, dailyTip } = data;
  const levelBase = (stats.level - 1) * 75;
  const levelProgressPct = Math.min(
    100,
    Math.max(4, Math.round(((stats.totalPoints - levelBase) / 75) * 100))
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
          <span>{t('Back to Home', 'ہوم پر واپس جائیں')}</span>
        </button>
      </div>

      {/* Welcome & Level Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="text-xs font-semibold text-emerald-700 mb-1.5">
            {t('Pakistan Digital Trust Overview', 'ذاتی ڈیجیٹل ٹرسٹ خلاصہ')}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {t(`Welcome back, ${profile.displayName}`, `خوش آمدید، ${profile.displayName}`)}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t('Level', 'لیول')}{' '}
            <span className="font-mono font-semibold text-emerald-700">{stats.level}</span> ·{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {stats.totalPoints}
            </span>{' '}
            / <span className="font-mono tabular-nums">{stats.nextLevelPoints}</span>{' '}
            {t('pts to next level', 'اگلے لیول تک پوائنٹس')}
          </p>
        </div>

        <div className="w-full lg:w-72">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span>{t(`Level ${stats.level} Progress`, `لیول ${stats.level} کی پیش رفت`)}</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-700">
              {levelProgressPct}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
              style={{ width: `${levelProgressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{t('Total Trust Points', 'کل ٹرسٹ پوائنٹس')}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {stats.totalPoints}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {t(`Level ${stats.level}`, `لیول ${stats.level}`)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{t('Completed Scenarios', 'مکمل کردہ مشنز')}</span>
            <Target className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {stats.completedMissions}
            <span className="text-base text-slate-400">/{stats.totalAvailableScenarios}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {t(
              `${stats.completedModules}/${stats.totalModules} learning modules done`,
              `${stats.completedModules}/${stats.totalModules} اسباق مکمل`
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{t('Detection Accuracy', 'شناخت کی درستگی')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {stats.accuracyPercent}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.completedMissions === 0
              ? t('Complete a mission to calculate', 'حساب کے لیے کوئی مشن مکمل کریں')
              : t('Based on submitted missions', 'جمع کرائے گئے مشنز کی بنیاد پر')}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{t('Learning Streak', 'مسلسل مشق')}</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {stats.streakDays}{' '}
            {stats.streakDays === 1 ? t('day', 'دن') : t('days', 'دن')}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {t('Daily activity bonus active', 'روزانہ سرگرمی فعال ہے')}
          </div>
        </div>
      </div>

      {/* Main Split: Weekly Chart + Shortcuts / Tip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                {t('Weekly Trust Points Activity', 'ہفتہ وار ٹرسٹ پوائنٹس کی سرگرمی')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('Recorded activity across the past 7 days', 'گزشتہ 7 دنوں کی ریکارڈ شدہ سرگرمی')}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {t('7-Day Window', '7 دن کا ریکارڈ')}
            </span>
          </div>

          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyProgress} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="svPointsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#047857" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" stroke="#64748B" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="points"
                  name={t('Points Earned', 'حاصل کردہ پوائنٹس')}
                  stroke="#047857"
                  strokeWidth={2.2}
                  fillOpacity={1}
                  fill="url(#svPointsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shortcuts & Daily Tip */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 mb-2">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span>
                {t(`Daily Cyber Safety Tip · ${dailyTip.category}`, `آج کا حفاظتی مشورہ · ${dailyTip.category}`)}
              </span>
            </div>
            <h3 className="font-display text-base font-bold text-slate-900">{dailyTip.title}</h3>
            <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">{dailyTip.body}</p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('numberguard')}
            className="w-full text-start rounded-xl border border-slate-200 hover:border-emerald-600 bg-white p-5 shadow-xs transition-colors flex items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-1">
                <PhoneCall className="w-4 h-4" />
                <span>{t('NumberGuard Shortcut', 'نمبر گارڈ شارٹ کٹ')}</span>
              </div>
              <div className="font-display text-base font-bold text-slate-900">
                {t('Look Up or Report a Number', 'نمبر چیک یا رپورٹ کریں')}
              </div>
            </div>
            <ArrowRight className={`w-4 h-4 text-slate-400 shrink-0 ${isUrdu ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('coach')}
            className="w-full text-start rounded-xl border border-slate-200 hover:border-emerald-600 bg-white p-5 shadow-xs transition-colors flex items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-1">
                <Bot className="w-4 h-4" />
                <span>{t('AI Cyber Coach Shortcut', 'AI سائبر کوچ شارٹ کٹ')}</span>
              </div>
              <div className="font-display text-base font-bold text-slate-900">
                {t('Analyze a Message in EN / اردو', 'انگریزی یا اردو میں پیغام جانچیں')}
              </div>
            </div>
            <ArrowRight className={`w-4 h-4 text-slate-400 shrink-0 ${isUrdu ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Recommended Missions */}
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
          {t('Recommended Training Missions', 'تجویز کردہ تربیتی مشنز')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('fake_inbox')}
            className="text-start rounded-xl border border-slate-200 hover:border-emerald-600 bg-white p-5 shadow-xs transition-colors"
          >
            <div className="text-xs text-emerald-700 font-semibold mb-1">
              {t('Fake Inbox · +10 pts each', 'فیک ان باکس · فی مشن +10 پوائنٹس')}
            </div>
            <div className="font-display text-base font-bold text-slate-900">
              {t('Detect Phishing SMS & WhatsApp Traps', 'جعلی SMS اور واٹس ایپ پیغامات پہچانیں')}
            </div>
            <p className="text-xs text-slate-600 mt-1.5">
              {t(
                'Inspect realistic bank, courier, and freelance messages.',
                'بینک، کوریئر اور فری لانسنگ کے مشکوک پیغامات کی جانچ کریں۔'
              )}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('digital_detective')}
            className="text-start rounded-xl border border-slate-200 hover:border-emerald-600 bg-white p-5 shadow-xs transition-colors"
          >
            <div className="text-xs text-blue-600 font-semibold mb-1">
              {t('Digital Detective · +5 pts/clue', 'ڈیجیٹل ڈیٹیکٹو · فی نشانی +5 پوائنٹس')}
            </div>
            <div className="font-display text-base font-bold text-slate-900">
              {t('Investigate Suspicious Storefronts', 'مشکوک ویب سائٹس کی تفتیش کریں')}
            </div>
            <p className="text-xs text-slate-600 mt-1.5">
              {t(
                'Spot advance-payment traps, fake domains, and job fees.',
                'ایڈوانس ادائیگی، جعلی ڈومین اور نوکری کی فیس کے جال پکڑیں۔'
              )}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('timed_challenge')}
            className="text-start rounded-xl border border-slate-200 hover:border-emerald-600 bg-white p-5 shadow-xs transition-colors"
          >
            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold mb-1">
              <Timer className="w-3.5 h-3.5" />
              <span>{t('60-Second Blitz', '60 سیکنڈ چیلنج')}</span>
            </div>
            <div className="font-display text-base font-bold text-slate-900">
              {t('Test Reflexes Under Pressure', 'وقتی دباؤ میں درست فیصلہ کریں')}
            </div>
            <p className="text-xs text-slate-600 mt-1.5">
              {t(
                'Beat the 60-second clock across rapid-fire trust prompts.',
                '60 سیکنڈ میں تیزی سے جعلی اور محفوظ پیغامات الگ کریں۔'
              )}
            </p>
          </button>
        </div>
      </div>

      {/* Badges & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {t('Earned Badges', 'حاصل کردہ بیجز')}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              {t('View Profile', 'پروفائل دیکھیں')}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`rounded-lg border p-3.5 flex items-start gap-3 ${
                  badge.earned
                    ? 'border-emerald-300 bg-emerald-50/60'
                    : 'border-slate-200 bg-slate-50/70 opacity-65'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    badge.earned ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {BADGE_ICONS[badge.iconKey] || <Award className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{badge.name}</div>
                  <p className="text-xs text-slate-600 mt-0.5">{badge.description}</p>
                  <div className="text-[11px] font-mono mt-1 text-slate-500">
                    {badge.earned ? t('Earned', 'حاصل شدہ') : t('Locked', 'مقفل')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
            {t('Recent Activity', 'حالیہ سرگرمی')}
          </h2>
          {recentActivity.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-600">
                {t(
                  'No completed scenarios yet. Start with Fake Inbox to record your first detection.',
                  'ابھی کوئی مشن مکمل نہیں ہوا۔ اپنی پہلی شناخت کے لیے فیک ان باکس شروع کریں۔'
                )}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('fake_inbox')}
                className="mt-4 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
              >
                {t('Launch Fake Inbox', 'فیک ان باکس شروع کریں')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivity.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.modeLabel}</div>
                    </div>
                  </div>
                  <div className="font-mono text-xs font-semibold text-emerald-700 tabular-nums shrink-0">
                    +{item.points} {t('pts', 'پوائنٹس')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
