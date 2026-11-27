import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Shield,
  MessageSquareWarning,
  SearchCheck,
  Timer,
  PhoneCall,
  Bot,
  BookOpen,
  Menu,
  X,
  Send,
  Users,
  Clock,
  Target,
  Languages,
  Loader2,
  ScanSearch,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BrandMark } from './BrandMark';
import { apiFetch } from '../lib/api';
import { convertCoachInputText } from '../lib/fastConvert';
import { LanguageSwitcher, useLanguage } from '../lib/i18n';
import type { AuthUser } from '../types/scamverse';

export type LandingTarget =
  | 'dashboard'
  | 'fake_inbox'
  | 'digital_detective'
  | 'timed_challenge'
  | 'consequence'
  | 'numberguard'
  | 'coach'
  | 'learn'
  | 'leaderboard';

interface LandingPageProps {
  user: AuthUser | null;
  onStartMission: () => void;
  onExploreWorkspace: () => void;
  onNavigateAuth: (mode: 'login' | 'signup') => void;
  onNavigateApp: (tab: LandingTarget) => void;
}

interface PublicStats {
  scenarioCount: number;
  moduleCount: number;
  reportCount: number;
  userCount: number;
  geminiConfigured: boolean;
}

interface QuickChatMsg {
  role: 'user' | 'assistant';
  content: string;
  sourceMode?: 'live_gemini' | 'educational_fallback';
}

const EASE_SETTLE = [0.16, 1, 0.3, 1] as const;

const TRUST_CHANNELS = [
  'WhatsApp OTP Protection',
  'JazzCash & Easypaisa Safety',
  'Raast Payment Verification',
  'BISP 8171 Impersonation Defense',
  'Bank SMS Phishing Lab',
  'Online Store Fraud Check',
  'Freelance Job Verification',
  'NumberGuard Community Lookup',
];

export const LandingPage: React.FC<LandingPageProps> = ({
  user,
  onStartMission,
  onExploreWorkspace,
  onNavigateAuth,
  onNavigateApp,
}) => {
  const { lang, isUrdu, t } = useLanguage();

  const [stats, setStats] = useState<PublicStats | null>(null);
  const [previewChoice, setPreviewChoice] = useState<'scam' | 'safe' | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sticky Front-Page Chatbot Drawer State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLang, setChatLang] = useState<'en' | 'ur'>(lang);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<QuickChatMsg[]>([
    {
      role: 'assistant',
      content:
        lang === 'ur'
          ? 'اسکیم ورس سائبر کوچ میں خوش آمدید۔ کوئی بھی مشکوک ایس ایم ایس، واٹس ایپ پیغام، جاز کیش یا ایزی پیسہ الرٹ، یا نوکری کی پیشکش یہاں پیسٹ کریں — میں آپ کو اس کی مشکوک علامات سمجھاؤں گا۔'
          : 'Welcome to ScamVerse Cyber Coach. Paste any suspicious SMS, WhatsApp message, JazzCash/Easypaisa alert, or job offer and I will walk through its warning signs with you.',
      sourceMode: 'live_gemini',
    },
  ]);

  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [detectiveImgFailed, setDetectiveImgFailed] = useState(false);
  const [ngImgFailed, setNgImgFailed] = useState(false);
  const [coachImgFailed, setCoachImgFailed] = useState(false);

  useEffect(() => {
    setChatLang(lang);
  }, [lang]);

  useEffect(() => {
    apiFetch<PublicStats>('/api/public/stats')
      .then(setStats)
      .catch(() => null);
  }, []);

  const handleQuickChatSend = async (promptText?: string) => {
    const text = (promptText ?? chatInput).trim();
    if (!text || chatSending) return;

    setChatError(null);
    const nextHistory = [...chatMessages, { role: 'user' as const, content: text }];
    setChatMessages(nextHistory);
    if (!promptText) setChatInput('');
    setChatSending(true);

    try {
      const res = await apiFetch<{
        reply: string;
        sourceMode: 'live_gemini' | 'educational_fallback';
      }>('/api/coach/ask-public', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          language: chatLang,
          history: nextHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.reply, sourceMode: res.sourceMode },
      ]);
    } catch (err: unknown) {
      setChatError(
        err instanceof Error
          ? err.message
          : t('Unable to reach Cyber Coach.', 'سائبر کوچ سے رابطہ نہیں ہو سکا۔')
      );
    } finally {
      setChatSending(false);
    }
  };

  const handleConvertInput = async (targetLanguage: 'en' | 'ur') => {
    const text = chatInput.trim();
    if (!text || converting || chatSending) return;
    setChatError(null);
    setConverting(true);
    try {
      const converted = await convertCoachInputText(text, targetLanguage);
      setChatInput(converted);
      setChatLang(targetLanguage);
    } catch (err: unknown) {
      setChatError(
        err instanceof Error
          ? err.message
          : t('Text conversion failed.', 'تحریر تبدیل نہیں ہو سکی۔')
      );
    } finally {
      setConverting(false);
    }
  };

  const navLinks = [
    { href: '#top', label: t('Home', 'ہوم') },
    { href: '#missions', label: t('Missions', 'مشنز') },
    { href: '#numberguard', label: t('NumberGuard', 'نمبر گارڈ') },
    { href: '#learn', label: t('Learn', 'سیکھیں') },
    { href: '#about', label: t('About', 'ہمارے بارے میں') },
  ];

  const learningTopics = [
    { en: 'Phishing Awareness', ur: 'فشنگ سے آگاہی' },
    { en: 'WhatsApp Scams', ur: 'واٹس ایپ فراڈ' },
    { en: 'Fake Job Offers', ur: 'جعلی ملازمت کی پیشکشیں' },
    { en: 'Online Shopping Safety', ur: 'آن لائن خریداری کی حفاظت' },
    { en: 'OTP & Password Protection', ur: 'او ٹی پی اور پاس ورڈ کا تحفظ' },
    { en: 'Social Media Scams', ur: 'سوشل میڈیا فراڈ' },
    { en: 'Digital Payment Safety', ur: 'ڈیجیٹل ادائیگی کی حفاظت' },
    { en: 'Fake Websites & Spoofed URLs', ur: 'جعلی ویب سائٹس اور لنکس' },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-900 sv-grid-bg overflow-x-clip">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <BrandMark onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-emerald-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block">
              <LanguageSwitcher compact />
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => onNavigateApp('dashboard')}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors whitespace-nowrap shrink-0"
              >
                {t('Open Dashboard', 'ڈیش بورڈ کھولیں')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateAuth('login')}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors whitespace-nowrap shrink-0"
              >
                {t('Sign In', 'سائن ان')}
              </button>
            )}

            <button
              type="button"
              aria-label={t('Toggle mobile navigation', 'موبائل مینو کھولیں')}
              onClick={() => setMobileNavOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE_SETTLE }}
              className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2"
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 sm:hidden">
                <span className="text-xs font-semibold text-slate-600">
                  {t('Language', 'زبان')}
                </span>
                <LanguageSwitcher compact />
              </div>
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-700"
                >
                  {link.label}
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section id="top" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-14 lg:pb-16">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_SETTLE }}
            className="lg:col-span-6 flex flex-col justify-between py-1"
          >
            <div>
              <p className="text-sm font-semibold text-emerald-700 mb-2.5">
                {t(
                  'ScamVerse — The Digital Trust Simulator · Pakistan ki Pehchaan',
                  'اسکیم ورس — ڈیجیٹل ٹرسٹ سمیولیٹر · پاکستان کی پہچان'
                )}
              </p>
              <h1
                className="font-display font-bold tracking-tight text-slate-900 leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.65rem)', textWrap: 'balance' }}
              >
                {t('Think Before You Click.', 'کلک کرنے سے پہلے سوچیں۔')}
              </h1>
              <p className="mt-3 text-base sm:text-lg font-semibold text-emerald-800 leading-snug max-w-xl">
                {t(
                  '“Pause. Verify. Protect.” — Outsmarting digital fraud across Pakistan before a single tap.',
                  '“رکیں۔ تصدیق کریں۔ محفوظ رہیں۔” — ایک کلک سے پہلے آن لائن فراڈ پہچاننے کا عملی اعتماد۔'
                )}
              </p>

              {/* Vision & Mission Strip */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl">
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                    {t('Our Vision', 'ہمارا وژن')}
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                    {t(
                      'A scam-resilient digital Pakistan where every student, shopper, and freelancer navigates online life safely.',
                      'ایک ایسا محفوظ ڈیجیٹل پاکستان جہاں ہر طالب علم، خریدار اور فری لانسر اعتماد کے ساتھ انٹرنیٹ استعمال کرے۔'
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                    {t('Our Mission', 'ہمارا مشن')}
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                    {t(
                      'Replacing passive advice with real SMS, WhatsApp, JazzCash/Easypaisa, and AI Cyber Coach training in English & Urdu.',
                      'SMS، واٹس ایپ، جاز کیش/ایزی پیسہ مشنز اور اردو و انگریزی AI رہنمائی کے ذریعے عملی سائبر تحفظ سکھانا۔'
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3.5">
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onStartMission}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{t('Start Your First Mission', 'پہلا مشن شروع کریں')}</span>
                  <ArrowRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
                </motion.button>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onExploreWorkspace}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{t('Explore ScamVerse', 'اسکیم ورس دیکھیں')}</span>
                </motion.button>
              </div>
            </div>

            {/* 4-Column Quantitative Strip */}
            <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div>
                <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {stats ? stats.scenarioCount : 30}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {t('Interactive Scenarios', 'انٹرایکٹو مشنز')}
                </div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {stats ? stats.moduleCount : 8}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {t('EN & Urdu Modules', 'انگریزی اور اردو اسباق')}
                </div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {stats ? stats.reportCount : 5}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {t('NumberGuard Alerts', 'نمبر گارڈ رپورٹس')}
                </div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                  60s
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {t('Rapid Blitz Mode', '60 سیکنڈ چیلنج')}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Bright Editorial Hero Visual + Interactive Animated Message Check */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: EASE_SETTLE }}
            className="lg:col-span-6 flex flex-col gap-4"
          >
            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-emerald-950 h-56 sm:h-64 shadow-sm group">
              {!heroImgFailed ? (
                <motion.img
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.4, ease: EASE_SETTLE }}
                  src="/src/assets/images/hero_pakistan_shield_1795778796544.jpg"
                  alt="Smiling cybersecurity learner at a sunlit desk inspecting digital trust alerts"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-slate-900 flex items-center justify-center">
                  <Shield className="w-12 h-12 text-emerald-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-emerald-950/15 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-white">
                <span className="font-medium">
                  {t(
                    'Pakistan Digital Trust Defense Lab',
                    'پاکستان ڈیجیٹل ٹرسٹ ڈیفنس لیب'
                  )}
                </span>
                <span className="font-mono text-emerald-200">
                  {t('Safe Training Environment', 'محفوظ تربیتی ماحول')}
                </span>
              </div>
            </div>

            {/* Interactive Preview Card with Animated Scan Sweep */}
            <div className="relative rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex-1 flex flex-col justify-between overflow-hidden">
              {/* Subtle ambient scan beam across preview */}
              <motion.div
                aria-hidden="true"
                initial={{ x: '-100%' }}
                animate={{ x: '220%' }}
                transition={{
                  repeat: Infinity,
                  repeatDelay: 4.5,
                  duration: 2.2,
                  ease: 'easeInOut',
                }}
                className="pointer-events-none absolute top-0 left-0 h-0.5 w-1/2 bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent"
              />

              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                    <ScanSearch className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{t('Interactive Message Check · SMS', 'انٹرایکٹو پیغام جانچ · SMS')}</span>
                  </span>
                  <span className="font-mono" dir="ltr">09:42 AM</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 mb-2" dir="ltr">
                  From: +92-300-0000112 (Meezan-Verify-Alert)
                </div>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                  {isUrdu ? (
                    <>
                      &ldquo;فوری انتباہ: آپ کی ڈیجیٹل بینکنگ تک رسائی محدود کر دی گئی ہے۔ اپنا شناختی کارڈ اور{' '}
                      <span className={previewChoice ? 'bg-rose-100 text-rose-900 px-1 rounded font-medium' : ''}>
                        2 گھنٹے کے اندر 6 ہندسوں کا OTP
                      </span>{' '}
                      لنک{' '}
                      <span
                        dir="ltr"
                        className={previewChoice ? 'bg-rose-100 text-rose-900 px-1 rounded font-mono text-xs font-medium' : 'font-mono text-xs text-emerald-800'}
                      >
                        meezan-kyc-sim.invalid
                      </span>{' '}
                      پر درج کریں ورنہ اکاؤنٹ بند ہو جائے گا۔&rdquo;
                    </>
                  ) : (
                    <>
                      &ldquo;URGENT: Your digital banking access has been restricted. Verify your CNIC and{' '}
                      <span className={previewChoice ? 'bg-rose-100 text-rose-900 px-1 rounded font-medium' : ''}>
                        6-digit OTP within 2 hours
                      </span>{' '}
                      at{' '}
                      <span
                        dir="ltr"
                        className={previewChoice ? 'bg-rose-100 text-rose-900 px-1 rounded font-mono text-xs font-medium' : 'font-mono text-xs text-emerald-800'}
                      >
                        meezan-kyc-sim.invalid
                      </span>{' '}
                      or your account will be frozen.&rdquo;
                    </>
                  )}
                </p>
              </div>

              <div className="mt-4">
                <AnimatePresence mode="wait">
                  {!previewChoice ? (
                    <motion.div
                      key="actions"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span className="text-xs text-slate-500">
                        {t('Test your instinct on this message:', 'اس پیغام پر اپنی سمجھ آزمائیں:')}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewChoice('scam')}
                          className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors whitespace-nowrap"
                        >
                          {t('Flag as Scam', 'فراڈ قرار دیں')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewChoice('safe')}
                          className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap"
                        >
                          {t('Mark Safe', 'محفوظ سمجھیں')}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE_SETTLE }}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                          {previewChoice === 'scam' ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {t(
                                  'Correct — Banking Phishing Scam Identified',
                                  'درست — بینکنگ فشنگ فراڈ کی نشاندہی ہو گئی'
                                )}
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                              <span className="text-amber-700">
                                {t(
                                  'Warning — This Is a Phishing Trap',
                                  'خبردار — یہ ایک فشنگ جال ہے'
                                )}
                              </span>
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewChoice(null)}
                          className="text-slate-500 hover:text-slate-800 underline"
                        >
                          {t('Reset', 'دوبارہ')}
                        </button>
                      </div>
                      <p className="text-slate-600">
                        {t(
                          'Real banks never ask for a 6-digit OTP on external mobile links or impose 2-hour freeze deadlines from personal mobile numbers.',
                          'حقیقی بینک کبھی بیرونی موبائل لنک پر 6 ہندسوں کا OTP نہیں مانگتے اور نہ ہی ذاتی موبائل نمبر سے اکاؤنٹ بند کرنے کی دھمکی دیتے ہیں۔'
                        )}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Smooth Moving Coverage Ticker */}
      <div className="border-y border-slate-200 bg-white/80 py-3 overflow-hidden" dir="ltr">
        <motion.div
          className="flex items-center gap-8 whitespace-nowrap text-xs font-medium text-slate-600 w-max"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
        >
          {[...TRUST_CHANNELS, ...TRUST_CHANNELS].map((label, idx) => (
            <span key={idx} className="inline-flex items-center gap-8">
              <span className="hover:text-emerald-800 transition-colors">{label}</span>
              <span aria-hidden="true" className="text-emerald-600 font-bold">
                ·
              </span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* Featured Missions */}
      <section id="missions" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: EASE_SETTLE }}
          className="max-w-2xl mb-10"
        >
          <p className="text-sm font-semibold text-emerald-700 mb-2">
            {t('Interactive Training Modes', 'انٹرایکٹو تربیتی موڈز')}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {t(
              'Learn by investigating, deciding, and testing your reflexes',
              'تحقیق کر کے، فیصلہ کر کے اور رفتار آزما کر سائبر حفاظت سیکھیں'
            )}
          </h2>
          <p className="text-slate-600 mt-3 text-base">
            {t(
              'Move beyond passive articles. Every ScamVerse module simulates real fraud tactics across SMS, WhatsApp, email, and Pakistani digital wallets.',
              'صرف مضامین پڑھنے سے آگے بڑھیں۔ اسکیم ورس کا ہر ماڈیول SMS، واٹس ایپ، ای میل اور پاکستانی ڈیجیٹل والٹس پر ہونے والے حقیقی فراڈ کی مشق کراتا ہے۔'
            )}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.3, ease: EASE_SETTLE }}
            className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                <MessageSquareWarning className="w-4 h-4 text-emerald-700" />
                <span>{t('Fake Inbox Lab', 'فیک ان باکس لیب')}</span>
                <span aria-hidden="true">·</span>
                <span>{t('8 Scenarios', '8 مشنز')}</span>
                <span aria-hidden="true">·</span>
                <span>{t('+10 pts per detection', 'ہر درست شناخت پر +10 پوائنٹس')}</span>
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900">
                {t('Fake Inbox — Scam Detection Mission', 'فیک ان باکس — فراڈ شناخت مشن')}
              </h3>
              <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
                {t(
                  'Audit simulated WhatsApp chats, JazzCash/Easypaisa prompts, courier hold texts, and scholarship emails. Highlight suspicious phrases, distinguish genuine notices from traps, and earn trust points.',
                  'واٹس ایپ چیٹس، جاز کیش یا ایزی پیسہ پیغامات، کوریئر اور اسکالرشپ ای میلز کا جائزہ لیں۔ مشکوک جملے پہچانیں اور حقیقی و جعلی پیغامات میں فرق کریں۔'
                )}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {t(
                  'Includes legitimate control messages to sharpen judgment',
                  'صحیح اور غلط پیغامات میں فرق سیکھنے کے لیے اصل مثالیں بھی شامل ہیں'
                )}
              </span>
              <button
                type="button"
                onClick={() => (user ? onNavigateApp('fake_inbox') : onStartMission())}
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{t('Open Fake Inbox', 'فیک ان باکس کھولیں')}</span>
                <ArrowRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.3, delay: 0.05, ease: EASE_SETTLE }}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col justify-between"
          >
            <div className="h-44 bg-emerald-950 overflow-hidden">
              {!detectiveImgFailed ? (
                <img
                  src="/src/assets/images/mission_inbox_check_1795778795238.jpg"
                  alt="Student checking verified alert on smartphone at a sunlit study desk"
                  referrerPolicy="no-referrer"
                  onError={() => setDetectiveImgFailed(true)}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-emerald-950">
                  <SearchCheck className="w-10 h-10 text-emerald-400" />
                </div>
              )}
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 mb-2">
                  {t('Digital Detective · 4 Cases · +5 pts/clue', 'ڈیجیٹل ڈیٹیکٹو · 4 کیسز · فی نشانی +5 پوائنٹس')}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {t('Investigate the Scam', 'فراڈ کی تفتیش کریں')}
                </h3>
                <p className="text-sm text-slate-600 mt-2">
                  {t(
                    'Inspect online stores, Telegram job pitches, and investment sites to isolate red-flag evidence.',
                    'آن لائن اسٹورز، ٹیلی گرام نوکریوں اور سرمایہ کاری کی جعلی ویب سائٹس میں چھپے خطرے کی علامات پکڑیں۔'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => (user ? onNavigateApp('digital_detective') : onStartMission())}
                className="mt-5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{t('Open Case Lab', 'کیس لیب کھولیں')}</span>
                <ArrowRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.3, ease: EASE_SETTLE }}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                <Timer className="w-4 h-4 text-emerald-700" />
                <span>{t('Timed Reflex Challenge', 'وقتی چیلنج')}</span>
                <span aria-hidden="true">·</span>
                <span>{t('60 Seconds', '60 سیکنڈ')}</span>
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                {t('60-Second Scam Challenge', '60 سیکنڈ اسکیم چیلنج')}
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                {t(
                  'Classify rapid-fire Raast/QR payment prompts, OTP calls, and safe alerts before the countdown hits zero.',
                  'وقت ختم ہونے سے پہلے تیزی سے QR ادائیگی، OTP کالز اور محفوظ پیغامات کی درجہ بندی کریں۔'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (user ? onNavigateApp('timed_challenge') : onStartMission())}
              className="mt-6 text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>{t('Start 60s Blitz', '60 سیکنڈ چیلنج شروع کریں')}</span>
              <ArrowRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.3, delay: 0.05, ease: EASE_SETTLE }}
            className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="text-xs text-slate-500 mb-3">
                {t('Branching Decision Lab · 4 Interactive Scenarios', 'نتائج کی لیب · 4 انٹرایکٹو منظرنامے')}
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                {t('Choose Your Consequence', 'اپنے فیصلے کا نتیجہ دیکھیں')}
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                {t(
                  'Trace the real-world fallout of paying a “PKR 1,500 prize tax”, reading an OTP to a spoofed bank caller, or taking freelance deals off-platform—with immediate safety debriefs.',
                  '1,500 روپے انعامی ٹیکس ادا کرنے، جعلی بینک کالر کو OTP بتانے یا فری لانس ڈیل پلیٹ فارم سے باہر لے جانے کے نتائج کا محفوظ ماحول میں تجربہ کریں۔'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (user ? onNavigateApp('consequence') : onStartMission())}
              className="mt-6 text-sm font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>{t('Run Decision Lab', 'فیصلہ لیب چلائیں')}</span>
              <ArrowRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-200">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: EASE_SETTLE }}
          className="mb-8"
        >
          <p className="text-sm font-semibold text-emerald-700 mb-2">
            {t('How ScamVerse Works', 'اسکیم ورس کیسے کام کرتا ہے')}
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            {t('Three steps to build lasting digital instinct', 'پائیدار ڈیجیٹل حفاظت کے تین آسان مراحل')}
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: t('01. Inspect Realistic Traps', '01. حقیقی جالوں کا معائنہ'),
              title: t('Analyze Everyday Channels', 'روزمرہ ذرائع کا جائزہ لیں'),
              body: t(
                'Review WhatsApp chats, SMS alerts, job portals, and payment prompts modeled after real Pakistani and global fraud tactics.',
                'پاکستانی اور عالمی آن لائن فراڈ کے مطابق بنائے گئے واٹس ایپ پیغامات، SMS اور ادائیگی کے لنکس کی محفوظ مشق کریں۔'
              ),
            },
            {
              step: t('02. Decide Under Context', '02. صورتحال کے مطابق فیصلہ'),
              title: t('Test Judgment & Speed', 'سمجھ بوجھ اور رفتار آزمائیں'),
              body: t(
                'Choose how to respond, isolate deceptive clues, and verify suspicious numbers through NumberGuard before taking action.',
                'درست ردعمل منتخب کریں، دھوکہ دہی کی علامات الگ کریں اور نمبر گارڈ پر مشکوک نمبرز کی تصدیق کریں۔'
              ),
            },
            {
              step: t('03. Learn & Level Up', '03. سیکھیں اور آگے بڑھیں'),
              title: t('Understand the Why', 'وجہ اور بچاؤ سمجھیں'),
              body: t(
                'Get immediate phrase-level breakdowns, bilingual English and Urdu guidance from the AI Cyber Coach, and verified progress badges.',
                'ہر مشن کے بعد فوری وضاحت، انگریزی اور اردو میں AI سائبر کوچ کی رہنمائی اور بیجز حاصل کریں۔'
              ),
            },
          ].map((item, idx) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: idx * 0.08, ease: EASE_SETTLE }}
            >
              <div className="font-mono text-sm font-semibold text-emerald-700 mb-2">{item.step}</div>
              <h3 className="font-display text-lg font-bold text-slate-900">{item.title}</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* NumberGuard + AI Cyber Coach */}
      <section id="numberguard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200">
        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.35, ease: EASE_SETTLE }}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col justify-between"
          >
            <div className="h-52 bg-slate-100 overflow-hidden">
              {!ngImgFailed ? (
                <img
                  src="/src/assets/images/feature_numberguard_verify_1795778796714.jpg"
                  alt="Minimalist smartphone and translucent emerald security shield on porcelain stone"
                  referrerPolicy="no-referrer"
                  onError={() => setNgImgFailed(true)}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-emerald-950">
                  <PhoneCall className="w-10 h-10 text-emerald-400" />
                </div>
              )}
            </div>
            <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium mb-2">
                  {t('NumberGuard · Community Reporting & Lookup', 'نمبر گارڈ · کمیونٹی رپورٹنگ اور تلاش')}
                </div>
                <h3 className="font-display text-2xl font-bold text-slate-900">
                  {t(
                    'Check & Report Suspicious Numbers Responsibly',
                    'مشکوک موبائل نمبرز کی ذمہ دارانہ جانچ اور رپورٹنگ'
                  )}
                </h3>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  {t(
                    'Look up +92 and international phone numbers for community-submitted scam categories, moderation states, and safety guidance—or submit a structured report with private screenshot evidence.',
                    '+92 اور بین الاقوامی نمبرز کی کمیونٹی رپورٹس، زمرے اور حفاظتی مشورے دیکھیں یا نجی اسکرین شاٹ ثبوت کے ساتھ نئی رپورٹ درج کریں۔'
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-3">
                  {t(
                    'Privacy-first design: Reports represent user-submitted alerts for awareness only, never expose submitter identities, and undergo moderation review.',
                    'رازداری اولین ترجیح: رپورٹس صرف عوامی آگاہی کے لیے ہیں، صارف کی شناخت ظاہر نہیں کی جاتی، اور ہر رپورٹ کا جائزہ لیا جاتا ہے۔'
                  )}
                </p>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => (user ? onNavigateApp('numberguard') : onExploreWorkspace())}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-sm font-semibold text-white transition-colors whitespace-nowrap"
                >
                  <span>{t('Open NumberGuard', 'نمبر گارڈ کھولیں')}</span>
                  <ArrowRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.35, delay: 0.06, ease: EASE_SETTLE }}
            className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-4 mb-5">
                {!coachImgFailed ? (
                  <img
                    src="/src/assets/images/avatar_coach_emblem_1795778797401.jpg"
                    alt="ScamVerse AI Cyber Coach translucent emerald crescent shield emblem"
                    referrerPolicy="no-referrer"
                    onError={() => setCoachImgFailed(true)}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Bot className="w-8 h-8 text-emerald-700" />
                  </div>
                )}
                <div>
                  <div className="text-xs text-emerald-700 font-semibold">
                    {t('AI Cyber Coach · English & اردو', 'AI سائبر کوچ · انگریزی اور اردو')}
                  </div>
                  <h3 className="font-display text-2xl font-bold text-slate-900">
                    {t('Ask About Any Suspicious Message', 'کسی بھی مشکوک پیغام کے بارے میں پوچھیں')}
                  </h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t(
                  'Paste a suspicious job message, advance-fee prompt, or online shopping claim—even type in Roman Urdu and click Convert to Urdu or English—to receive instant AI safety reasoning.',
                  'مشکوک پیغام، جعلی نوکری یا آن لائن خریداری کا دعویٰ پیسٹ کریں — رومن اردو میں لکھ کر فوراً اردو یا انگریزی میں تبدیل کریں اور AI سے رہنمائی حاصل کریں۔'
                )}
              </p>
              <div className="mt-5 space-y-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-slate-500 font-medium mb-1">
                  {t('Questions you can test right now:', 'ایسے سوالات جو آپ ابھی پوچھ سکتے ہیں:')}
                </div>
                <div>&bull; &ldquo;Someone asked for my 6-digit OTP to cancel a card charge. Is that real?&rdquo;</div>
                <div>&bull; &ldquo;BISP 8171 message from +92-301 asking registration fee — safe or scam?&rdquo;</div>
                <div dir="rtl">&bull; &ldquo;کیا کوئی نوکری شروع کرنے سے پہلے سیکیورٹی فیس مانگ سکتا ہے؟&rdquo;</div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-sm font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Bot className="w-4 h-4" />
                <span>{t('Ask AI Coach Now', 'ابھی AI کوچ سے پوچھیں')}</span>
              </button>
              <button
                type="button"
                onClick={() => (user ? onNavigateApp('coach') : onExploreWorkspace())}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 transition-colors whitespace-nowrap"
              >
                <span>{t('Open Full Workspace', 'مکمل ورک اسپیس کھولیں')}</span>
                <ArrowRight className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Learning Centre Preview */}
      <section id="learn" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-semibold text-emerald-700 mb-2">
              {t('Digital Safety Learning Centre', 'ڈیجیٹل تحفظ لرننگ سینٹر')}
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {t('8 bite-sized modules in English and Urdu', 'انگریزی اور اردو میں 8 مختصر اور مؤثر اسباق')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => (user ? onNavigateApp('learn') : onExploreWorkspace())}
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4" />
            <span>{t('Browse All 8 Modules', 'تمام 8 اسباق دیکھیں')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {learningTopics.map((topic, idx) => (
            <motion.button
              key={topic.en}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.25, delay: idx * 0.03, ease: EASE_SETTLE }}
              onClick={() => (user ? onNavigateApp('learn') : onExploreWorkspace())}
              className="text-start rounded-xl border border-slate-200 bg-white hover:border-emerald-600/60 p-4 shadow-xs transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="font-mono text-xs text-slate-400 mb-1">
                  0{idx + 1} · English / اردو
                </div>
                <div className="font-display text-sm font-bold text-slate-900">
                  {isUrdu ? topic.ur : topic.en}
                </div>
              </div>
              <div className="mt-3 text-xs font-medium text-emerald-700">
                {t('Interactive Quiz · +15 pts', 'انٹرایکٹو کوئز · +15 پوائنٹس')}
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* About ScamVerse: Problem Statement, Purpose, & Developers */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200">
        <div className="max-w-3xl mb-10">
          <p className="text-sm font-semibold text-emerald-700 mb-2">
            {t('About ScamVerse · Pakistan ki Pehchaan', 'اسکیم ورس کے بارے میں · پاکستان کی پہچان')}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {t(
              'Built to turn passive cybersecurity advice into real-world digital defense for Pakistan',
              'پاکستان کے ڈیجیٹل صارفین کو عملی سائبر تحفظ سکھانے کا مؤثر پلیٹ فارم'
            )}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, ease: EASE_SETTLE }}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-3">
                <Target className="w-4 h-4" />
                <span>
                  {t(
                    'What ScamVerse Is & The Problem Statement',
                    'اسکیم ورس کیا ہے اور اصل مسئلہ'
                  )}
                </span>
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                {t(
                  'Why Static Warnings Fail Everyday Users',
                  'روایتی تحریری تنبیہات کافی کیوں نہیں'
                )}
              </h3>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                {t(
                  'Millions of students, freelancers, online shoppers, and mobile wallet users in Pakistan receive convincing WhatsApp OTP traps, JazzCash/Easypaisa impersonations, fake BISP 8171 alerts, and advance-fee job links every day. Static blogs and PDFs are rarely remembered under pressure.',
                  'پاکستان میں لاکھوں طلبہ، فری لانسرز، آن لائن خریدار اور موبائل والٹ صارفین روزانہ جعلی واٹس ایپ OTP پیغامات، جاز کیش/ایزی پیسہ فراڈ، 8171 امدادی جال اور جعلی نوکریوں کے لنکس کا سامنا کرتے ہیں۔ عام مضامین دباؤ کے وقت یاد نہیں رہتے۔'
                )}
              </p>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                {t(
                  'ScamVerse solves this by delivering a hands-on digital trust simulator—combining fake inbox inspections, forensic case labs, timed challenges, NumberGuard community lookups, and a bilingual English/Urdu AI Cyber Coach.',
                  'اسکیم ورس اس مسئلے کا حل ایک عملی ڈیجیٹل ٹرسٹ سمیولیٹر کے ذریعے پیش کرتا ہے — جس میں فیک ان باکس، تفتیشی لیب، 60 سیکنڈ چیلنج، نمبر گارڈ اور انگریزی/اردو AI سائبر کوچ شامل ہیں۔'
                )}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, delay: 0.06, ease: EASE_SETTLE }}
            className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-3">
                <Clock className="w-4 h-4" />
                <span>{t('Our Purpose & Impact', 'ہمارا مقصد اور افادیت')}</span>
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                {t(
                  'Cybersecurity Built as Pakistan ki Pehchaan',
                  'سائبر تحفظ کی آگاہی — پاکستان کی پہچان'
                )}
              </h3>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                {t(
                  'ScamVerse bridges the gap between everyday digital wallet adoption and practical cyber safety by training people in realistic local and global fraud patterns before real money is at risk.',
                  'اسکیم ورس عام صارفین کو حقیقی نقصان سے پہلے مقامی اور عالمی آن لائن فراڈ کے طریقوں کی عملی مشق کرا کر ڈیجیٹل تحفظ فراہم کرتا ہے۔'
                )}
              </p>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                {t(
                  'With full English and Urdu support—including Roman Urdu conversion inside the AI Cyber Coach—every citizen from university campuses to mobile banking users can learn in the language they trust.',
                  'انگریزی اور اردو کی مکمل سہولت اور AI سائبر کوچ میں رومن اردو کنورٹر کے ساتھ ہر شہری اپنی پسندیدہ زبان میں آن لائن دھوکہ دہی سے بچنا سیکھ سکتا ہے۔'
                )}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, delay: 0.12, ease: EASE_SETTLE }}
            className="lg:col-span-3 rounded-xl border border-emerald-900/20 bg-emerald-950 text-white p-6 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-3">
                <Users className="w-4 h-4" />
                <span>{t('Developers Behind ScamVerse', 'اسکیم ورس کے ڈویلپرز')}</span>
              </div>
              <h3 className="font-display text-lg font-bold text-white">
                {t('Created by Team ScamVerse', 'ٹیم اسکیم ورس کی تخلیق')}
              </h3>
              <p className="text-xs text-emerald-100/80 mt-2 leading-relaxed">
                {t(
                  'Designed and engineered end-to-end across full-stack architecture, AI integration, and cybersecurity product design by:',
                  'فل اسٹیک آرکیٹیکچر، AI انضمام اور سائبر سیکیورٹی پروڈکٹ ڈیزائن کی مشترکہ تخلیق:'
                )}
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-lg border border-emerald-800 bg-emerald-900/60 p-3.5">
                  <div className="font-display text-sm font-bold text-white">Aliza Noreen</div>
                  <div className="text-xs text-emerald-300 mt-0.5">
                    {t('Developer · Co-Creator', 'ڈویلپر · شریک بانی')}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-800 bg-emerald-900/60 p-3.5">
                  <div className="font-display text-sm font-bold text-white">Aleena Khan</div>
                  <div className="text-xs text-emerald-300 mt-0.5">
                    {t('Developer · Co-Creator', 'ڈویلپر · شریک بانی')}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-emerald-800/80 text-[11px] font-mono text-emerald-300">
              Team ScamVerse · Pakistan
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="font-display font-bold text-slate-900">
              ScamVerse · {t('Pakistan ki Pehchaan', 'پاکستان کی پہچان')}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              {t(
                'Developed by Aliza Noreen & Aleena Khan. All simulation scenarios run safely inside a controlled educational environment.',
                'علیزہ نورین اور علینہ خان کی جانب سے تیار کردہ۔ تمام تربیتی منظرنامے ایک محفوظ تعلیمی ماحول میں چلتے ہیں۔'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
            <button type="button" onClick={onStartMission} className="hover:text-emerald-700 whitespace-nowrap">
              {t('Start Mission', 'مشن شروع کریں')}
            </button>
            <button
              type="button"
              onClick={() => (user ? onNavigateApp('numberguard') : onExploreWorkspace())}
              className="hover:text-emerald-700 whitespace-nowrap"
            >
              {t('NumberGuard', 'نمبر گارڈ')}
            </button>
            <button
              type="button"
              onClick={() => (user ? onNavigateApp('learn') : onExploreWorkspace())}
              className="hover:text-emerald-700 whitespace-nowrap"
            >
              {t('Learning Centre', 'لرننگ سینٹر')}
            </button>
            <button type="button" onClick={() => onNavigateAuth('login')} className="hover:text-emerald-700 whitespace-nowrap">
              {t('Sign In', 'سائن ان')}
            </button>
          </div>
        </div>
      </footer>

      {/* Sticky Front-Page AI Cyber Coach Chatbot Badge & Drawer */}
      <div className={`fixed bottom-4 ${isUrdu ? 'left-4 sm:left-6' : 'right-4 sm:right-6'} sm:bottom-6 z-40`}>
        <AnimatePresence mode="wait">
          {!chatOpen ? (
            <motion.button
              key="launcher"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.18, ease: EASE_SETTLE }}
              type="button"
              onClick={() => setChatOpen(true)}
              aria-label={t('Open AI Cyber Coach Chatbot', 'AI سائبر کوچ کھولیں')}
              className="inline-flex items-center gap-2.5 h-12 px-4 sm:px-5 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white shadow-lg border border-emerald-700 whitespace-nowrap"
            >
              <Bot className="w-5 h-5 text-emerald-200 shrink-0" />
              <span className="text-sm font-semibold">
                {t('AI Cyber Coach', 'AI سائبر کوچ')}
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="drawer"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.22, ease: EASE_SETTLE }}
              className="w-[calc(100vw-2rem)] sm:w-[410px] max-h-[82vh] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="px-4 py-3 bg-emerald-900 text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bot className="w-5 h-5 text-emerald-200 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold truncate">
                      {t('AI Cyber Coach', 'AI سائبر کوچ')}
                    </div>
                    <div className="text-[11px] text-emerald-100/80 truncate">
                      {t('Instant Scam Check · English / اردو', 'فوری فراڈ جانچ · انگریزی / اردو')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
                  <button
                    type="button"
                    onClick={() => setChatLang('en')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      chatLang === 'en'
                        ? 'bg-white text-emerald-900'
                        : 'bg-emerald-800 text-emerald-100 hover:bg-emerald-700'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatLang('ur')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                      chatLang === 'ur'
                        ? 'bg-white text-emerald-900'
                        : 'bg-emerald-800 text-emerald-100 hover:bg-emerald-700'
                    }`}
                  >
                    اردو
                  </button>
                  <button
                    type="button"
                    aria-label="Close AI Cyber Coach"
                    onClick={() => setChatOpen(false)}
                    className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F4F7FB] min-h-[220px] max-h-[340px]">
                {chatMessages.map((m, idx) => {
                  const msgIsUrdu = /[\u0600-\u06FF]/.test(m.content);
                  return (
                    <div
                      key={idx}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        dir={msgIsUrdu ? 'rtl' : 'ltr'}
                        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                          m.role === 'user'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white border border-slate-200 text-slate-800 shadow-xs'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })}

                {chatMessages.length === 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(chatLang === 'ur'
                      ? [
                          'کیا بینک فون پر OTP مانگ سکتا ہے؟',
                          'جعلی نوکری کی پیشکش کیسے پہچانیں؟',
                        ]
                      : [
                          'Is an OTP call from my bank real?',
                          'How to spot a fake job offer?',
                        ]
                    ).map((q) => (
                      <button
                        key={q}
                        type="button"
                        dir={chatLang === 'ur' ? 'rtl' : 'ltr'}
                        onClick={() => handleQuickChatSend(q)}
                        className="text-start text-[11px] px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 text-slate-700 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {chatSending && (
                  <div className="text-xs text-slate-500">
                    {t('Analyzing safety indicators...', 'حفاظتی علامات کا تجزیہ جاری ہے...')}
                  </div>
                )}
                {chatError && <div className="text-xs text-rose-600">{chatError}</div>}
              </div>

              {/* Visible Fast Text Converter Bar + Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleQuickChatSend();
                }}
                className="p-3 border-t border-slate-200 bg-white space-y-2"
              >
                <div className="flex items-center justify-between gap-2 px-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    {converting ? (
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
                    ) : (
                      <Languages className="w-3 h-3 text-emerald-700" />
                    )}
                    <span>
                      {converting
                        ? t('Converting...', 'تبدیل کیا جا رہا ہے...')
                        : t('Convert typed text:', 'تحریر تبدیل کریں:')}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
                    <button
                      type="button"
                      disabled={converting || chatSending || !chatInput.trim()}
                      onClick={() => handleConvertInput('ur')}
                      className="px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-45 text-[11px] font-semibold text-emerald-800 transition-colors whitespace-nowrap"
                    >
                      &rarr; اردو
                    </button>
                    <button
                      type="button"
                      disabled={converting || chatSending || !chatInput.trim()}
                      onClick={() => handleConvertInput('en')}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-45 text-[11px] font-semibold text-slate-700 transition-colors whitespace-nowrap"
                    >
                      &rarr; English
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    dir={chatLang === 'ur' || /[\u0600-\u06FF]/.test(chatInput) ? 'rtl' : 'ltr'}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      chatLang === 'ur'
                        ? 'انگریزی، رومن اردو یا اردو میں لکھیں...'
                        : 'Type in English or Roman Urdu...'
                    }
                    className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700"
                  />
                  <button
                    type="submit"
                    disabled={chatSending || converting || !chatInput.trim()}
                    aria-label="Send message"
                    className="p-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white transition-colors shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
