import React, { useEffect, useState } from 'react';
import {
  SearchCheck,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Globe,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import type { DetectiveClue, DigitalDetectivePayload, ScenarioItem } from '../types/scamverse';

interface DigitalDetectiveViewProps {
  onProgressUpdated: () => void;
  onBack: () => void;
}

interface DetectiveFeedback {
  alreadyCompleted: boolean;
  correctFlags: number;
  totalRedFlags: number;
  falsePositives: number;
  isCorrect: boolean;
  pointsAwarded: number;
  clues: DetectiveClue[];
  summaryExplanation: string;
  safetyRecommendations: string[];
  newlyEarnedBadges: Array<{ slug: string; name: string }>;
}

export const DigitalDetectiveView: React.FC<DigitalDetectiveViewProps> = ({
  onProgressUpdated,
  onBack,
}) => {
  const { isUrdu, t } = useLanguage();
  const [cases, setCases] = useState<Array<ScenarioItem<DigitalDetectivePayload>>>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedClues, setSelectedClues] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<DetectiveFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ scenarios: Array<ScenarioItem<DigitalDetectivePayload>> }>(
      '/api/missions?mode=digital_detective'
    )
      .then((res) => setCases(res.scenarios))
      .catch((err: unknown) =>
        setError(
          err instanceof Error
            ? err.message
            : t('Unable to load cases.', 'کیسز لوڈ نہیں ہو سکے۔')
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const current = cases[activeIdx];

  const selectCase = (idx: number) => {
    setActiveIdx(idx);
    setSelectedClues([]);
    setFeedback(null);
    setError(null);
  };

  const toggleClue = (clueId: string) => {
    if (feedback) return;
    setSelectedClues((prev) =>
      prev.includes(clueId) ? prev.filter((id) => id !== clueId) : [...prev, clueId]
    );
  };

  const handleSubmit = async () => {
    if (!current || selectedClues.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<DetectiveFeedback>('/api/missions/detective/answer', {
        method: 'POST',
        body: JSON.stringify({ scenarioId: current.id, selectedClueIds: selectedClues }),
      });
      setFeedback(res);
      setCases((prev) =>
        prev.map((c, idx) =>
          idx === activeIdx ? { ...c, completed: true, wasCorrect: res.isCorrect } : c
        )
      );
      onProgressUpdated();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Failed to submit investigation.', 'تفتیش جمع نہیں ہو سکی۔')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse" />;
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
          {error || t('No investigation cases found.', 'کوئی تفتیشی کیس دستیاب نہیں ہے۔')}
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
            {t('Digital Detective — Investigate the Scam', 'ڈیجیٹل ڈیٹیکٹو — فراڈ کی تفتیش')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t(
              'Inspect the evidence card and flag every deceptive warning sign (+5 pts per true red flag).',
              'ثبوت کارڈ کا معائنہ کریں اور ہر مشکوک علامت کی نشاندہی کریں (ہر درست نشانی پر +5 پوائنٹس)۔'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cases.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCase(idx)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                idx === activeIdx
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              {t(`Case 0${idx + 1}`, `کیس 0${idx + 1}`)} {c.completed ? '✓' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Evidence Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs" dir="ltr">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-700 font-mono truncate">
                <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{current.payload.previewUrlOrHandle}</span>
              </div>
              <span className="text-[11px] font-mono font-semibold text-slate-500 shrink-0">
                {current.payload.caseCode}
              </span>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="text-xs text-emerald-700 font-semibold">
                {current.payload.channelLabel} · {current.category}
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {current.payload.previewTitle}
              </h2>
              <div className="text-sm font-semibold text-amber-700">
                {current.payload.previewSubtitle}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed">
                {current.payload.previewBody}
              </div>
              <div className="inline-block rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-800">
                Action Button: &ldquo;{current.payload.previewCtaText}&rdquo;
              </div>
              <div className="pt-3 border-t border-slate-200 text-xs text-slate-500 font-mono">
                {current.payload.previewFooterNote}
              </div>
            </div>
          </div>

          {feedback && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {feedback.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  <div>
                    <div className="font-display text-base font-bold text-slate-900">
                      {t(
                        `Found ${feedback.correctFlags} of ${feedback.totalRedFlags} Red Flags`,
                        `${feedback.totalRedFlags} میں سے ${feedback.correctFlags} خطرے کی علامات ملیں`
                      )}
                    </div>
                    <div className="text-xs text-slate-600">
                      {feedback.alreadyCompleted
                        ? t(
                            'Previously completed (no duplicate points).',
                            'پہلے مکمل ہو چکا ہے (اضافی پوائنٹس نہیں ملے)۔'
                          )
                        : t(
                            `+${feedback.pointsAwarded} trust points awarded`,
                            `+${feedback.pointsAwarded} ٹرسٹ پوائنٹس دیے گئے`
                          )}
                    </div>
                  </div>
                </div>
                {activeIdx < cases.length - 1 && (
                  <button
                    type="button"
                    onClick={() => selectCase(activeIdx + 1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                  >
                    <span>{t('Next Case', 'اگلا کیس')}</span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{feedback.summaryExplanation}</p>

              <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-4">
                <div className="text-sm font-bold text-emerald-800 mb-1.5">
                  {t('Safety Recommendations', 'حفاظتی سفارشات')}
                </div>
                <ul className="space-y-1 text-sm text-slate-700 list-disc list-inside">
                  {feedback.safetyRecommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Clue Selection Panel */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between shadow-xs h-fit">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold mb-2">
              <SearchCheck className="w-4 h-4" />
              <span>{t('Evidence Checklist', 'شواہد کی فہرست')}</span>
            </div>
            <h3 className="font-display text-lg font-bold text-slate-900">
              {t('Select the suspicious elements', 'مشکوک عناصر منتخب کریں')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {t(
                'Not every detail is malicious—pick only the true scam warning signs.',
                'ہر بات مشکوک نہیں ہوتی — صرف حقیقی فراڈ کی نشانیاں منتخب کریں۔'
              )}
            </p>

            <div className="space-y-2.5">
              {current.payload.clues.map((clue) => {
                const checked = selectedClues.includes(clue.id);
                const revealedClue = feedback?.clues.find((c) => c.id === clue.id);

                let borderClass = checked
                  ? 'border-emerald-600 bg-emerald-50/70'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300';

                if (revealedClue) {
                  if (revealedClue.isRedFlag) {
                    borderClass = checked
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-amber-300 bg-amber-50';
                  } else if (checked) {
                    borderClass = 'border-rose-300 bg-rose-50';
                  }
                }

                return (
                  <button
                    key={clue.id}
                    type="button"
                    onClick={() => toggleClue(clue.id)}
                    disabled={Boolean(feedback)}
                    className={`w-full text-start rounded-xl border p-3.5 transition-colors ${borderClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-emerald-700 shrink-0">
                        {checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{clue.label}</div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5" dir="ltr">
                          &ldquo;{clue.excerpt}&rdquo;
                        </div>
                        {revealedClue && (
                          <div className="mt-2 text-xs text-slate-700 border-t border-slate-200 pt-2">
                            <span
                              className={`font-semibold ${
                                revealedClue.isRedFlag ? 'text-rose-700' : 'text-slate-600'
                              }`}
                            >
                              {revealedClue.isRedFlag
                                ? t('Red Flag: ', 'خطرے کی نشانی: ')
                                : t('Benign Detail: ', 'عام تفصیل: ')}
                            </span>
                            {revealedClue.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          {!feedback && (
            <button
              type="button"
              disabled={selectedClues.length === 0 || submitting}
              onClick={handleSubmit}
              className="mt-6 w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 px-4 text-sm transition-colors"
            >
              {submitting
                ? t('Evaluating Investigation...', 'تفتیش کی جانچ جاری ہے...')
                : t(
                    `Submit Investigation (${selectedClues.length} selected)`,
                    `تفتیش جمع کروائیں (${selectedClues.length} منتخب)`
                  )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
