import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Award,
  CheckCircle2,
  Shield,
  Lock,
  Trash2,
  AlertCircle,
  User as UserIcon,
  ArrowLeft,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import type { AuthUser, DashboardData, LeaderboardEntry } from '../types/scamverse';

interface BackProps {
  onBack: () => void;
}

export const LeaderboardView: React.FC<BackProps> = ({ onBack }) => {
  const { isUrdu, t } = useLanguage();
  const [period, setPeriod] = useState<'all' | 'weekly'>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ entries: LeaderboardEntry[] }>(`/api/progress/leaderboard?period=${period}`)
      .then((res) => setEntries(res.entries))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 mb-2 transition-colors"
          >
            <ArrowLeft className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
            <span>{t('Back to Dashboard', 'ڈیش بورڈ پر واپس جائیں')}</span>
          </button>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            {t('Trust Leaderboard', 'ٹرسٹ لیڈر بورڈ')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t(
              'Ranked by verified trust points earned across ScamVerse missions and safety quizzes.',
              'اسکیم ورس مشنز اور حفاظتی کوئز میں حاصل کردہ تصدیق شدہ پوائنٹس کی درجہ بندی۔'
            )}
          </p>
        </div>

        <div
          dir="ltr"
          className="inline-flex p-1 bg-white border border-slate-200 rounded-lg self-start shadow-xs"
        >
          <button
            type="button"
            onClick={() => setPeriod('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              period === 'all' ? 'bg-emerald-700 text-white' : 'text-slate-600'
            }`}
          >
            {t('All-Time', 'مجموعی')}
          </button>
          <button
            type="button"
            onClick={() => setPeriod('weekly')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              period === 'weekly' ? 'bg-emerald-700 text-white' : 'text-slate-600'
            }`}
          >
            {t('Weekly', 'ہفتہ وار')}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">
            {t('Loading leaderboard...', 'لیڈر بورڈ لوڈ ہو رہا ہے...')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <th className="py-3.5 px-5 font-semibold text-start">{t('Rank', 'درجہ')}</th>
                  <th className="py-3.5 px-5 font-semibold text-start">{t('Learner', 'صارف')}</th>
                  <th className="py-3.5 px-5 font-semibold text-end">{t('Level', 'لیول')}</th>
                  <th className="py-3.5 px-5 font-semibold text-end">{t('Completed', 'مکمل')}</th>
                  <th className="py-3.5 px-5 font-semibold text-end">{t('Trust Points', 'ٹرسٹ پوائنٹس')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {entries.map((row) => (
                  <tr
                    key={`${row.rank}-${row.displayName}`}
                    className={
                      row.isCurrentUser ? 'bg-emerald-50/70' : 'hover:bg-slate-50 transition-colors'
                    }
                  >
                    <td className="py-3.5 px-5 font-mono tabular-nums text-slate-500" dir="ltr">
                      #{row.rank}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        {row.rank <= 3 && <Trophy className="w-4 h-4 text-amber-500 shrink-0" />}
                        <span className="font-semibold text-slate-900">{row.displayName}</span>
                        {row.isCurrentUser && (
                          <span className="text-xs text-emerald-700 font-semibold">
                            {t('(You)', '(آپ)')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-end font-mono tabular-nums text-slate-600" dir="ltr">
                      Lv.{row.level}
                    </td>
                    <td className="py-3.5 px-5 text-end font-mono tabular-nums text-slate-600">
                      {row.completedChallenges}
                    </td>
                    <td className="py-3.5 px-5 text-end font-mono tabular-nums font-bold text-emerald-700">
                      {row.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

interface ProfileViewProps {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
  onBack: () => void;
}

const AVATAR_OPTIONS = [
  { label: 'Emerald Shield', url: '/src/assets/images/avatar_coach_emblem_1795778797401.jpg' },
  { label: 'Analyst Desk', url: '/src/assets/images/hero_pakistan_shield_1795778796544.jpg' },
  { label: 'Trust Check', url: '/src/assets/images/mission_inbox_check_1795778795238.jpg' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onUserUpdated, onBack }) => {
  const { setLang: setSiteLang, isUrdu, t } = useLanguage();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'ur'>(user.preferredLanguage);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>('/api/progress/dashboard').then(setDashboard).catch(() => null);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName, bio, preferredLanguage, avatarUrl }),
      });
      onUserUpdated(res.user);
      setSiteLang(preferredLanguage);
      setSaveMessage(t('Profile settings saved.', 'پروفائل کی ترتیبات محفوظ ہو گئیں۔'));
    } catch (err: unknown) {
      setSaveMessage(
        err instanceof Error
          ? err.message
          : t('Unable to save profile.', 'پروفائل محفوظ نہیں ہو سکا۔')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 mb-2 transition-colors"
        >
          <ArrowLeft className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
          <span>{t('Back to Dashboard', 'ڈیش بورڈ پر واپس جائیں')}</span>
        </button>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          {t('Profile & Achievements', 'پروفائل اور کامیابیاں')}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {t(
            'Manage your public leaderboard display name, English/Urdu preference, and review earned badges.',
            'اپنا لیڈر بورڈ نام، انگریزی/اردو زبان کی ترجیح اور حاصل کردہ بیجز دیکھیں۔'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Account & Settings */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs h-fit"
        >
          <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="User profile avatar"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-xl object-cover border border-slate-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <UserIcon className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="font-display text-lg font-bold text-slate-900">
                {user.fullName}
              </div>
              <div className="text-xs text-slate-500">
                <span dir="ltr">{user.email}</span> ·{' '}
                {user.isDemo
                  ? t('Guest Analyst Session', 'مہمان سیشن')
                  : t('Registered Account', 'رجسٹرڈ اکاؤنٹ')}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('Display Name (Shown on Leaderboard)', 'نمائشی نام (لیڈر بورڈ کے لیے)')}
            </label>
            <input
              id="prof-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-700 focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="prof-bio" className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('Learning Focus / Bio', 'تعارف')}
            </label>
            <input
              id="prof-bio"
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-700 focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="prof-lang" className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('Preferred Website & Coach Language', 'ویب سائٹ اور کوچ کی پسندیدہ زبان')}
            </label>
            <select
              id="prof-lang"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value === 'ur' ? 'ur' : 'en')}
              className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-700 focus:bg-white"
            >
              <option value="en">English</option>
              <option value="ur">اردو (Urdu)</option>
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">
              {t('Choose Emblem Avatar', 'ایمبلم منتخب کریں')}
            </div>
            <div className="flex flex-wrap gap-2">
              {AVATAR_OPTIONS.map((opt) => (
                <button
                  key={opt.url}
                  type="button"
                  onClick={() => setAvatarUrl(opt.url)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    avatarUrl === opt.url
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {saveMessage && <div className="text-xs font-semibold text-emerald-700">{saveMessage}</div>}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors"
          >
            {saving ? t('Saving...', 'محفوظ ہو رہا ہے...') : t('Save Settings', 'ترتیبات محفوظ کریں')}
          </button>
        </form>

        {/* Stats & Badges */}
        <div className="lg:col-span-6 space-y-5">
          {dashboard && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 shadow-xs">
                <div>
                  <div className="text-xs text-slate-500">{t('Points', 'پوائنٹس')}</div>
                  <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {dashboard.stats.totalPoints}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t('Level', 'لیول')}</div>
                  <div className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                    {dashboard.stats.level}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t('Missions', 'مشنز')}</div>
                  <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {dashboard.stats.completedMissions}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t('Accuracy', 'درستگی')}</div>
                  <div className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                    {dashboard.stats.accuracyPercent}%
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {t('Achievements', 'کامیابیاں')}
                </h2>
                {dashboard.badges.map((b) => (
                  <div
                    key={b.id}
                    className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
                      b.earned
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : 'border-slate-200 bg-slate-50 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Award className={`w-5 h-5 ${b.earned ? 'text-emerald-700' : 'text-slate-400'}`} />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{b.name}</div>
                        <div className="text-xs text-slate-600">{b.description}</div>
                      </div>
                    </div>
                    {b.earned ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="text-xs font-mono text-slate-400">
                        {t('Locked', 'مقفل')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface AdminReportRow {
  id: number;
  referenceCode: string;
  displayPhone: string;
  categoryLabel: string;
  description: string;
  incidentDate: string;
  moderationStatus: 'under_review' | 'moderated_report' | 'rejected';
  moderationNote: string;
  flagCount: number;
  isSample: number;
  hasEvidence: number;
  evidenceFilename: string | null;
}

interface AdminModerationViewProps {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
  onBack: () => void;
}

export const AdminModerationView: React.FC<AdminModerationViewProps> = ({
  user,
  onUserUpdated,
  onBack,
}) => {
  const { isUrdu, t } = useLanguage();
  const [status, setStatus] = useState<{
    envConfigured: boolean;
    requiresBootstrap: boolean;
    isCurrentUserAdmin: boolean;
  } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [metrics, setMetrics] = useState<{
    totalUsers: number;
    totalAnswers: number;
    pendingReports: number;
    flaggedReports: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdminQueue = async () => {
    const res = await apiFetch<{
      reports: AdminReportRow[];
      metrics: { totalUsers: number; totalAnswers: number; pendingReports: number; flaggedReports: number };
    }>('/api/admin/reports');
    setReports(res.reports);
    setMetrics(res.metrics);
  };

  useEffect(() => {
    setLoading(true);
    apiFetch<{ envConfigured: boolean; requiresBootstrap: boolean; isCurrentUserAdmin: boolean }>(
      '/api/admin/status'
    )
      .then(async (s) => {
        setStatus(s);
        if (s.isCurrentUserAdmin) {
          await loadAdminQueue();
        }
      })
      .finally(() => setLoading(false));
  }, [user.role]);

  const handleBootstrapOrUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const endpoint = status?.requiresBootstrap ? '/api/admin/bootstrap' : '/api/admin/unlock';
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ passcode }),
      });
      setPasscode('');
      onUserUpdated({ ...user, role: 'admin' });
      const s = await apiFetch<{
        envConfigured: boolean;
        requiresBootstrap: boolean;
        isCurrentUserAdmin: boolean;
      }>('/api/admin/status');
      setStatus(s);
      await loadAdminQueue();
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : t('Authorization failed.', 'اجازت کی تصدیق ناکام رہی۔')
      );
    }
  };

  const handleModerate = async (
    id: number,
    moderationStatus: 'under_review' | 'moderated_report' | 'rejected'
  ) => {
    await apiFetch(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ moderationStatus, moderationNote: `Updated by moderator (${moderationStatus})` }),
    });
    await loadAdminQueue();
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/admin/reports/${id}`, { method: 'DELETE' });
    await loadAdminQueue();
  };

  if (loading || !status) {
    return <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />;
  }

  if (!status.isCurrentUserAdmin) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
        >
          <ArrowLeft className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
          <span>{t('Back to Dashboard', 'ڈیش بورڈ پر واپس جائیں')}</span>
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
            <Lock className="w-4 h-4" />
            <span>{t('Protected Moderation Console', 'محفوظ ماڈریشن کنسول')}</span>
          </div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            {status.requiresBootstrap
              ? t('First-Run Moderator Passcode Setup', 'پہلی بار ماڈریٹر پاس کوڈ سیٹ اپ')
              : t('Verify Moderator Passcode', 'ماڈریٹر پاس کوڈ کی تصدیق کریں')}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {status.requiresBootstrap
              ? t(
                  'No server ADMIN_PASSCODE secret or claimed moderator passcode exists yet. Set a one-time passcode (8+ characters) to lock and unlock the moderation console.',
                  'ابھی کوئی ماڈریٹر پاس کوڈ مقرر نہیں ہے۔ کنسول کو محفوظ بنانے کے لیے کم از کم 8 حروف کا پاس کوڈ مقرر کریں۔'
                )
              : t(
                  'Ordinary accounts cannot access NumberGuard moderation controls. Enter the server administrator passcode to continue.',
                  'عام صارفین نمبر گارڈ ماڈریشن تک رسائی حاصل نہیں کر سکتے۔ جاری رکھنے کے لیے ایڈمن پاس کوڈ درج کریں۔'
                )}
          </p>

          {authError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleBootstrapOrUnlock} className="space-y-3">
            <input
              type="password"
              dir="ltr"
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder={
                status.requiresBootstrap
                  ? t('Create 8+ char admin passcode', '8+ حروف کا پاس کوڈ بنائیں')
                  : t('Enter admin passcode', 'ایڈمن پاس کوڈ درج کریں')
              }
              className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-700 focus:bg-white"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 text-sm transition-colors"
            >
              {status.requiresBootstrap
                ? t('Claim & Unlock Moderation', 'ماڈریشن محفوظ کر کے کھولیں')
                : t('Unlock Moderation Console', 'ماڈریشن کنسول کھولیں')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 mb-2 transition-colors"
          >
            <ArrowLeft className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
            <span>{t('Back to Dashboard', 'ڈیش بورڈ پر واپس جائیں')}</span>
          </button>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            {t('Admin & NumberGuard Moderation', 'ایڈمن اور نمبر گارڈ ماڈریشن')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t(
              'Review community submissions, verify flags, and remove abusive or misleading entries.',
              'کمیونٹی رپورٹس کا جائزہ لیں اور غلط یا غیر موزوں اندراجات کو حذف کریں۔'
            )}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold self-start sm:self-auto">
          <Shield className="w-4 h-4" />
          <span>{t('Authorized Moderator', 'مجاز ماڈریٹر')}</span>
        </span>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">{t('Registered Learners', 'رجسٹرڈ صارفین')}</div>
            <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {metrics.totalUsers}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">{t('Mission Submissions', 'مکمل کردہ مشنز')}</div>
            <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {metrics.totalAnswers}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">{t('Pending Review', 'زیرِ جائزہ')}</div>
            <div className="font-mono text-2xl font-bold text-amber-600 tabular-nums mt-1">
              {metrics.pendingReports}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs text-slate-500">{t('Flagged Reports', 'فلیگ شدہ رپورٹس')}</div>
            <div className="font-mono text-2xl font-bold text-rose-600 tabular-nums mt-1">
              {metrics.flaggedReports}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-xs overflow-hidden">
        {reports.map((r) => (
          <div key={r.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                <span className="text-emerald-700 font-semibold" dir="ltr">{r.referenceCode}</span>
                <span>·</span>
                <span dir="ltr">{r.displayPhone}</span>
                <span>·</span>
                <span>{r.categoryLabel}</span>
                <span>·</span>
                <span>{t('Flags:', 'فلیگز:')} {r.flagCount}</span>
                {r.hasEvidence ? <span>· {r.evidenceFilename}</span> : null}
              </div>
              <p className="text-sm text-slate-800">{r.description}</p>
              <div className="text-xs text-slate-500">
                {t('Current Status:', 'موجودہ حیثیت:')}{' '}
                <strong className="text-slate-900">{r.moderationStatus}</strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleModerate(r.id, 'moderated_report')}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors"
              >
                {t('Approve', 'منظور')}
              </button>
              <button
                type="button"
                onClick={() => handleModerate(r.id, 'under_review')}
                className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-xs font-semibold transition-colors"
              >
                {t('Under Review', 'زیرِ جائزہ')}
              </button>
              <button
                type="button"
                onClick={() => handleModerate(r.id, 'rejected')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold transition-colors"
              >
                {t('Reject', 'مسترد')}
              </button>
              <button
                type="button"
                aria-label={`Delete report ${r.referenceCode}`}
                onClick={() => handleDelete(r.id)}
                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
