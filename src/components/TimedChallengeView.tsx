import React, { useEffect, useRef, useState } from 'react';
import {
  Timer,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import type { ScenarioItem, TimedChallengePayload } from '../types/scamverse';

interface TimedChallengeViewProps {
  onProgressUpdated: () => void;
  onBack: () => void;
}

interface ChallengeResult {
  totalAnswered: number;
  correctCount: number;
  accuracy: number;
  pointsEarned: number;
  dailyCapReached: boolean;
  rating: string;
  newlyEarnedBadges: Array<{ slug: string; name: string }>;
}

export const TimedChallengeView: React.FC<TimedChallengeViewProps> = ({
  onProgressUpdated,
  onBack,
}) => {
  const { isUrdu, t } = useLanguage();
  const [scenarios, setScenarios] = useState<Array<ScenarioItem<TimedChallengePayload>>>([]);
  const [phase, setPhase] = useState<'ready' | 'running' | 'finished'>('ready');
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Array<{ scenarioId: number; choice: boolean; correct: boolean }>>([]);
  const [lastFlash, setLastFlash] = useState<{ correct: boolean; tip: string } | null>(null);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    apiFetch<{ scenarios: Array<ScenarioItem<TimedChallengePayload>> }>(
      '/api/missions?mode=timed_challenge'
    )
      .then((res) => setScenarios(res.scenarios))
      .finally(() => setLoading(false));
  }, []);

  const finishChallenge = async (finalAnswers: Array<{ scenarioId: number; choice: boolean }>) => {
    setPhase('finished');
    if (finalAnswers.length === 0) {
      setResult({
        totalAnswered: 0,
        correctCount: 0,
        accuracy: 0,
        pointsEarned: 0,
        dailyCapReached: false,
        rating: 'Trust Novice',
        newlyEarnedBadges: [],
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<ChallengeResult>('/api/missions/timed-challenge/submit', {
        method: 'POST',
        body: JSON.stringify({
          answers: finalAnswers.map((a) => ({ scenarioId: a.scenarioId, choice: a.choice })),
        }),
      });
      setResult(res);
      onProgressUpdated();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (phase !== 'running') return;
    if (timeLeft <= 0) {
      finishChallenge(answersRef.current);
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((tVal) => tVal - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, timeLeft]);

  const startChallenge = () => {
    setScenarios((prev) => [...prev].sort(() => Math.random() - 0.5));
    setAnswers([]);
    setCurrentIdx(0);
    setTimeLeft(60);
    setLastFlash(null);
    setResult(null);
    setPhase('running');
  };

  const handleQuickAnswer = (isScamChoice: boolean) => {
    if (phase !== 'running') return;
    const item = scenarios[currentIdx];
    if (!item) return;

    const correct = item.payload.isScam === isScamChoice;
    const updated = [...answers, { scenarioId: item.id, choice: isScamChoice, correct }];
    setAnswers(updated);
    setLastFlash({ correct, tip: item.payload.quickTip });

    if (currentIdx + 1 >= scenarios.length) {
      finishChallenge(updated);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  };

  if (loading) {
    return <div className="h-80 rounded-2xl bg-white border border-slate-200 animate-pulse" />;
  }

  const current = scenarios[currentIdx];
  const liveScore = answers.filter((a) => a.correct).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
          {t('60-Second Scam Challenge', '60 سیکنڈ اسکیم چیلنج')}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {t(
            'Rapid-fire threat triage. Decide quickly whether each alert is a scam or safe.',
            'تیز رفتار حفاظتی جانچ۔ فوری فیصلہ کریں کہ ہر پیغام فراڈ ہے یا محفوظ۔'
          )}
        </p>
      </div>

      {phase === 'ready' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-5 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Timer className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              {t('Ready for Rapid Triage?', 'تیز رفتار جانچ کے لیے تیار ہیں؟')}
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
              {t(
                `You have 60 seconds to classify up to ${scenarios.length} realistic alerts. Earn bonus trust points and unlock the Quick Thinker badge at 5+ correct answers.`,
                `آپ کے پاس ${scenarios.length} پیغامات کی درجہ بندی کے لیے 60 سیکنڈ ہیں۔ 5 یا زیادہ درست جوابات پر کوئیک تھنکر بیج حاصل کریں۔`
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={startChallenge}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors shadow-xs"
          >
            <Play className="w-4 h-4" />
            <span>{t('Start 60-Second Countdown', '60 سیکنڈ کاؤنٹ ڈاؤن شروع کریں')}</span>
          </button>
        </div>
      )}

      {phase === 'running' && current && (
        <div className="space-y-4">
          {/* Timer & Live Score Header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <Timer className={`w-5 h-5 ${timeLeft <= 10 ? 'text-rose-600' : 'text-emerald-700'}`} />
              <div>
                <div className="text-xs text-slate-500">{t('Time Remaining', 'باقی وقت')}</div>
                <div
                  dir="ltr"
                  className={`font-mono text-2xl font-bold tabular-nums ${
                    timeLeft <= 10 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {timeLeft}s
                </div>
              </div>
            </div>

            <div className="flex-1 max-w-xs hidden sm:block">
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    timeLeft <= 10 ? 'bg-rose-600' : 'bg-emerald-700'
                  }`}
                  style={{ width: `${Math.round((timeLeft / 60) * 100)}%` }}
                />
              </div>
            </div>

            <div className="text-end">
              <div className="text-xs text-slate-500">{t('Correct', 'درست')}</div>
              <div className="font-mono text-2xl font-bold text-emerald-700 tabular-nums" dir="ltr">
                {liveScore}/{answers.length}
              </div>
            </div>
          </div>

          {lastFlash && (
            <div
              className={`rounded-xl border px-4 py-2.5 text-xs flex items-center gap-2.5 ${
                lastFlash.correct
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {lastFlash.correct ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>
                <strong>{lastFlash.correct ? t('Correct:', 'درست:') : t('Missed:', 'غلط:')}</strong>{' '}
                {lastFlash.tip}
              </span>
            </div>
          )}

          {/* Active Prompt Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5 shadow-xs" dir="ltr">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">
                {current.payload.channel} · {current.category}
              </span>
              <span className="font-mono tabular-nums">
                {currentIdx + 1} / {scenarios.length}
              </span>
            </div>

            <div>
              <div className="text-xs font-mono text-slate-500 mb-2">
                Source: {current.payload.sender}
              </div>
              <p className="text-lg font-medium text-slate-900 leading-relaxed">
                {current.payload.prompt}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleQuickAnswer(true)}
                className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition-colors"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{t('Scam', 'فراڈ')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAnswer(false)}
                className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t('Safe / Legitimate', 'محفوظ / درست')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'finished' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="text-center">
            <div className="text-xs font-semibold text-emerald-700 mb-1">
              {t('Challenge Complete', 'چیلنج مکمل')}
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              {submitting
                ? t('Calculating Verified Score...', 'اسکور کا حساب جاری ہے...')
                : result?.rating || t('Challenge Summary', 'نتائج کا خلاصہ')}
            </h2>
          </div>

          {result && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t('Answered', 'کل جوابات')}</div>
                  <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
                    {result.totalAnswered}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t('Correct', 'درست')}</div>
                  <div className="font-mono text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                    {result.correctCount}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t('Accuracy', 'درستگی')}</div>
                  <div className="font-mono text-2xl font-bold text-blue-600 tabular-nums mt-1">
                    {result.accuracy}%
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">{t('Points Earned', 'حاصل پوائنٹس')}</div>
                  <div className="font-mono text-2xl font-bold text-emerald-700 tabular-nums mt-1" dir="ltr">
                    +{result.pointsEarned}
                  </div>
                </div>
              </div>

              {result.dailyCapReached && (
                <p className="text-xs text-amber-700 text-center">
                  {t(
                    'Daily bonus points limit reached for timed runs today—your accuracy and rating are still recorded.',
                    'آج کے وقتی چیلنج کی یومیہ بونس حد پوری ہو چکی ہے — آپ کی درستگی اور ریٹنگ ریکارڈ کر لی گئی ہے۔'
                  )}
                </p>
              )}

              {result.newlyEarnedBadges.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-center text-sm text-emerald-900">
                  {t('Badge Unlocked:', 'نیا بیج ملا:')}{' '}
                  <strong>{result.newlyEarnedBadges.map((b) => b.name).join(', ')}</strong>
                </div>
              )}
            </>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={startChallenge}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t('Play Again', 'دوبارہ کھیلیں')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
