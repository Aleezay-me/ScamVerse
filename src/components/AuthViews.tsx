import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Play,
  ArrowLeft,
} from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import { LanguageSwitcher, useLanguage } from '../lib/i18n';
import type { AuthUser } from '../types/scamverse';

export type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthViewsProps {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
  onAuthenticated: (user: AuthUser) => void;
  onBackHome: () => void;
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  mode,
  onChangeMode,
  onAuthenticated,
  onBackHome,
}) => {
  const { isUrdu, t } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetRequested, setResetRequested] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    if (!email.trim() || !password) {
      setError(
        t(
          'Enter both your email address and password.',
          'اپنا ای میل اور پاس ورڈ دونوں درج کریں۔'
        )
      );
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(data.token);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Unable to sign in.', 'سائن ان نہیں ہو سکا۔')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (fullName.trim().length < 2) {
      setError(
        t(
          'Enter your full name (at least 2 characters).',
          'اپنا پورا نام درج کریں (کم از کم 2 حروف)۔'
        )
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('Enter a valid email address.', 'درست ای میل ایڈریس درج کریں۔'));
      return;
    }
    if (password.length < 8) {
      setError(
        t(
          'Password must be at least 8 characters long.',
          'پاس ورڈ کم از کم 8 حروف کا ہونا ضروری ہے۔'
        )
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(
        t(
          'Password and confirmation do not match.',
          'پاس ورڈ اور تصدیقی پاس ورڈ ایک جیسے نہیں ہیں۔'
        )
      );
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password, confirmPassword }),
      });
      setAuthToken(data.token);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Could not create account.', 'اکاؤنٹ نہیں بن سکا۔')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/demo', {
        method: 'POST',
      });
      setAuthToken(data.token);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Could not start guest session.', 'مہمان سیشن شروع نہیں ہو سکا۔')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      if (!resetRequested) {
        const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setInfoMessage(res.message);
        setResetRequested(true);
      } else {
        const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, code: resetCode, newPassword }),
        });
        setInfoMessage(res.message);
        setResetRequested(false);
        onChangeMode('login');
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Password reset request failed.', 'پاس ورڈ ری سیٹ کی درخواست ناکام رہی۔')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] sv-grid-bg flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
            <span>{t('Back to Home', 'ہوم پر واپس جائیں')}</span>
          </button>
          <LanguageSwitcher compact />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{t('ScamVerse Account', 'اسکیم ورس اکاؤنٹ')}</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {mode === 'login' && t('Sign in to your workspace', 'اپنے ورک اسپیس میں سائن ان کریں')}
              {mode === 'signup' && t('Create your learner profile', 'اپنا پروفائل بنائیں')}
              {mode === 'forgot' && t('Reset your password', 'پاس ورڈ تبدیل کریں')}
            </h1>
            <p className="text-sm text-slate-600 mt-1.5">
              {mode === 'login' &&
                t(
                  'Track mission scores, earned badges, and NumberGuard reports.',
                  'مشن اسکور، بیجز اور نمبر گارڈ رپورٹس محفوظ رکھیں۔'
                )}
              {mode === 'signup' &&
                t(
                  'Start practicing scam detection with saved progress.',
                  'محفوظ ریکارڈ کے ساتھ فراڈ سے بچاؤ کی مشق شروع کریں۔'
                )}
              {mode === 'forgot' &&
                t(
                  'Enter your registered email to request a password reset.',
                  'پاس ورڈ ری سیٹ کوڈ کے لیے اپنا رجسٹرڈ ای میل درج کریں۔'
                )}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('Email address', 'ای میل ایڈریس')}
                </label>
                <input
                  id="login-email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
                    {t('Password', 'پاس ورڈ')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setInfoMessage(null);
                      onChangeMode('forgot');
                    }}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    {t('Forgot password?', 'پاس ورڈ بھول گئے؟')}
                  </button>
                </div>
                <div className="relative" dir="ltr">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('Enter your password', 'اپنا پاس ورڈ درج کریں')}
                    className="w-full rounded-lg bg-slate-50 border border-slate-300 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold py-2.5 px-4 text-sm transition-colors whitespace-nowrap"
              >
                <span>{loading ? t('Signing in...', 'سائن ان ہو رہا ہے...') : t('Sign In', 'سائن ان')}</span>
                <ArrowRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label htmlFor="signup-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('Full name', 'پورا نام')}
                </label>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Sara Ahmed"
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('Email address', 'ای میل ایڈریس')}
                </label>
                <input
                  id="signup-email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sara@university.edu.pk"
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('Password (min 8 characters)', 'پاس ورڈ (کم از کم 8 حروف)')}
                </label>
                <div className="relative" dir="ltr">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('Create a strong password', 'مضبوط پاس ورڈ بنائیں')}
                    className="w-full rounded-lg bg-slate-50 border border-slate-300 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="signup-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('Confirm password', 'پاس ورڈ کی تصدیق کریں')}
                </label>
                <div className="relative" dir="ltr">
                  <input
                    id="signup-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('Repeat your password', 'پاس ورڈ دوبارہ لکھیں')}
                    className="w-full rounded-lg bg-slate-50 border border-slate-300 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold py-2.5 px-4 text-sm transition-colors whitespace-nowrap"
              >
                <span>
                  {loading
                    ? t('Creating account...', 'اکاؤنٹ بنایا جا رہا ہے...')
                    : t('Create Account', 'اکاؤنٹ بنائیں')}
                </span>
                <ArrowRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('Registered email', 'رجسٹرڈ ای میل')}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                />
              </div>

              {resetRequested && (
                <>
                  <div>
                    <label htmlFor="reset-code" className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('6-digit verification code', '6 ہندسوں کا تصدیقی کوڈ')}
                    </label>
                    <input
                      id="reset-code"
                      type="text"
                      dir="ltr"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="123456"
                      className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t('New password', 'نیا پاس ورڈ')}
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      dir="ltr"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('Minimum 8 characters', 'کم از کم 8 حروف')}
                      className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold py-2.5 px-4 text-sm transition-colors"
              >
                {loading
                  ? t('Processing...', 'کارروائی جاری ہے...')
                  : resetRequested
                  ? t('Verify Code & Update Password', 'کوڈ کی تصدیق اور پاس ورڈ اپ ڈیٹ کریں')
                  : t('Request Reset Code', 'ری سیٹ کوڈ طلب کریں')}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
            <button
              type="button"
              onClick={handleGuestAccess}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold py-2.5 px-4 text-sm transition-colors whitespace-nowrap"
            >
              <Play className="w-4 h-4 text-emerald-700" />
              <span>{t('Continue as Guest Analyst', 'مہمان تجزیہ کار کے طور پر جاری رکھیں')}</span>
            </button>

            <div className="text-center text-sm text-slate-600">
              {mode === 'login' ? (
                <>
                  {t('New to ScamVerse?', 'اسکیم ورس پر نئے ہیں؟')}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setInfoMessage(null);
                      onChangeMode('signup');
                    }}
                    className="text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    {t('Create an account', 'نیا اکاؤنٹ بنائیں')}
                  </button>
                </>
              ) : (
                <>
                  {t('Already have an account?', 'پہلے سے اکاؤنٹ موجود ہے؟')}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setInfoMessage(null);
                      onChangeMode('login');
                    }}
                    className="text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    {t('Sign in', 'سائن ان کریں')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
