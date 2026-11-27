import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import type { ConsequenceOption, ConsequencePayload, ScenarioItem } from '../types/scamverse';

interface ConsequenceViewProps {
  onProgressUpdated: () => void;
  onBack: () => void;
}

interface ConsequenceFeedback {
  alreadyCompleted: boolean;
  chosenOption: ConsequenceOption;
  safestOption: ConsequenceOption;
  debrief: string;
  pointsAwarded: number;
  isCorrect: boolean;
}

export const ConsequenceView: React.FC<ConsequenceViewProps> = ({
  onProgressUpdated,
  onBack,
}) => {
  const { isUrdu, t } = useLanguage();
  const [scenarios, setScenarios] = useState<Array<ScenarioItem<ConsequencePayload>>>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [feedback, setFeedback] = useState<ConsequenceFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ scenarios: Array<ScenarioItem<ConsequencePayload>> }>(
      '/api/missions?mode=consequence'
    )
      .then((res) => setScenarios(res.scenarios))
      .catch((err: unknown) =>
        setError(
          err instanceof Error
            ? err.message
            : t('Unable to load scenarios.', 'منظرنامے لوڈ نہیں ہو سکے۔')
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const current = scenarios[activeIdx];

  const selectScenario = (idx: number) => {
    setActiveIdx(idx);
    setFeedback(null);
    setError(null);
  };

  const handleChoose = async (optionId: string) => {
    if (!current || submitting || feedback) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<ConsequenceFeedback>('/api/missions/consequence/answer', {
        method: 'POST',
        body: JSON.stringify({ scenarioId: current.id, optionId }),
      });
      setFeedback(res);
      setScenarios((prev) =>
        prev.map((s, idx) =>
          idx === activeIdx ? { ...s, completed: true, wasCorrect: res.isCorrect } : s
        )
      );
      onProgressUpdated();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Failed to evaluate choice.', 'فیصلے کا تجزیہ نہیں ہو سکا۔')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-80 rounded-2xl bg-white border border-slate-200 animate-pulse" />;
  }

  if (!current) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
          <span>{t('Back to Dashboard', 'ڈیش بورڈ پر واپس جائیں')}</span>
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
          {error || t('No consequence scenarios available.', 'کوئی منظرنامہ دستیاب نہیں ہے۔')}
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
            {t('Choose Your Consequence', 'اپنے فیصلے کا نتیجہ دیکھیں')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t(
              'Make a real-world decision and trace the exact outcome before risking your own wallet or data.',
              'حقیقی زندگی جیسی صورتحال میں فیصلہ کریں اور اپنا پیسہ یا ڈیٹا خطرے میں ڈالے بغیر اس کا نتیجہ دیکھیں۔'
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {scenarios.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectScenario(idx)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                idx === activeIdx
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              {t(`Scenario 0${idx + 1}`, `منظرنامہ 0${idx + 1}`)} {s.completed ? '✓' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 space-y-6 shadow-xs">
        <div dir="ltr">
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-2">
            <GitBranch className="w-4 h-4" />
            <span>
              {current.category} · {current.regionTag}
            </span>
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900">{current.title}</h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{current.payload.situation}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2" dir="ltr">
          <div className="text-xs font-mono text-slate-500">{current.payload.senderContext}</div>
          <p className="text-sm text-slate-800 leading-relaxed">{current.payload.messagePreview}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {!feedback ? (
          <div>
            <div className="text-sm font-semibold text-slate-800 mb-3">
              {t('What do you do next?', 'آپ کا اگلا قدم کیا ہوگا؟')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" dir="ltr">
              {current.payload.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleChoose(opt.id)}
                  className="text-left rounded-xl border border-slate-200 hover:border-emerald-600 bg-slate-50 hover:bg-emerald-50/40 p-4 transition-colors flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-medium text-slate-900">{opt.label}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 pt-4 border-t border-slate-200">
            <div
              className={`rounded-xl border p-5 space-y-2 ${
                feedback.chosenOption.outcomeType === 'safe'
                  ? 'border-emerald-200 bg-emerald-50'
                  : feedback.chosenOption.outcomeType === 'risky'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-rose-200 bg-rose-50'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-display text-base font-bold text-slate-900">
                  {feedback.chosenOption.outcomeType === 'safe' ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  ) : feedback.chosenOption.outcomeType === 'risky' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-rose-600" />
                  )}
                  <span>{feedback.chosenOption.outcomeTitle}</span>
                </div>
                <span className="font-mono text-xs font-semibold text-emerald-800 tabular-nums">
                  {feedback.alreadyCompleted
                    ? t('Already completed', 'پہلے مکمل ہو چکا')
                    : t(`+${feedback.pointsAwarded} trust points`, `+${feedback.pointsAwarded} ٹرسٹ پوائنٹس`)}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{feedback.chosenOption.narrative}</p>
              <div className="text-xs text-slate-700 pt-1">
                <strong>{t('Key takeaway:', 'اہم سبق:')}</strong> {feedback.chosenOption.lesson}
              </div>
            </div>

            {feedback.chosenOption.id !== feedback.safestOption.id && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {t('Safest Choice:', 'سب سے محفوظ انتخاب:')} {feedback.safestOption.label}
                  </span>
                </div>
                <p className="text-xs text-slate-700">{feedback.safestOption.narrative}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <p className="text-xs text-slate-600 max-w-2xl">{feedback.debrief}</p>
              {activeIdx < scenarios.length - 1 && (
                <button
                  type="button"
                  onClick={() => selectScenario(activeIdx + 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                >
                  <span>{t('Next Scenario', 'اگلا منظرنامہ')}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
