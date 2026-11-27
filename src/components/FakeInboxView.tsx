import React, { useEffect, useState } from 'react';
import {
  Mail,
  MessageCircle,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import type { FakeInboxPayload, ScenarioItem } from '../types/scamverse';

interface FakeInboxViewProps {
  onProgressUpdated: () => void;
  onBack: () => void;
}

interface AnswerFeedback {
  isCorrect: boolean;
  alreadyCompleted: boolean;
  pointsAwarded: number;
  expectedClassification: 'scam' | 'safe';
  suspiciousPhrases: string[];
  redFlags: string[];
  safeResponse: string;
  explanation: string;
  newlyEarnedBadges: Array<{ slug: string; name: string }>;
}

function highlightBody(body: string, phrases: string[]): React.ReactNode {
  if (!phrases || phrases.length === 0) return body;
  const escaped = phrases
    .filter((p) => p.length > 0)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return body;
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = body.split(regex);

  return parts.map((part, idx) => {
    const isMatch = phrases.some((p) => p.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <mark
          key={idx}
          className="bg-rose-100 text-rose-800 border border-rose-300 rounded px-1 py-0.5 font-semibold"
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const FakeInboxView: React.FC<FakeInboxViewProps> = ({ onProgressUpdated, onBack }) => {
  const { isUrdu, t } = useLanguage();
  const [scenarios, setScenarios] = useState<Array<ScenarioItem<FakeInboxPayload>>>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLinkInspect, setShowLinkInspect] = useState(false);

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ scenarios: Array<ScenarioItem<FakeInboxPayload>> }>(
        '/api/missions?mode=fake_inbox'
      );
      setScenarios(res.scenarios);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Unable to load Fake Inbox scenarios.', 'فیک ان باکس مشنز لوڈ نہیں ہو سکے۔')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  const current = scenarios[selectedIdx];
  const completedCount = scenarios.filter((s) => s.completed).length;

  const handleSelectScenario = (idx: number) => {
    setSelectedIdx(idx);
    setFeedback(null);
    setError(null);
    setShowLinkInspect(false);
  };

  const handleSubmitChoice = async (choice: 'scam' | 'safe' | 'not_sure') => {
    if (!current || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<AnswerFeedback>('/api/missions/fake-inbox/answer', {
        method: 'POST',
        body: JSON.stringify({ scenarioId: current.id, choice }),
      });
      setFeedback(res);
      setScenarios((prev) =>
        prev.map((s, idx) =>
          idx === selectedIdx ? { ...s, completed: true, wasCorrect: res.isCorrect } : s
        )
      );
      onProgressUpdated();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Could not submit classification.', 'جواب جمع نہیں ہو سکا۔')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (selectedIdx < scenarios.length - 1) {
      handleSelectScenario(selectedIdx + 1);
    } else {
      handleSelectScenario(0);
    }
  };

  const channelIcon = (channel: FakeInboxPayload['channel']) => {
    if (channel === 'WhatsApp') return <MessageCircle className="w-4 h-4 text-emerald-600" />;
    if (channel === 'SMS') return <Smartphone className="w-4 h-4 text-blue-600" />;
    return <Mail className="w-4 h-4 text-emerald-700" />;
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
          {error || t('No Fake Inbox scenarios available.', 'کوئی فیک ان باکس مشن دستیاب نہیں ہے۔')}
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
            {t('Fake Inbox — Scam Detection Lab', 'فیک ان باکس — فراڈ شناخت لیب')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t(
              'Inspect each message carefully. External links are disabled inside the safe inspection viewer.',
              'ہر پیغام کا بغور جائزہ لیں۔ محفوظ معائنے کے لیے بیرونی لنکس غیر فعال رکھے گئے ہیں۔'
            )}
          </p>
        </div>
        <div className="text-xs font-mono font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3.5 py-2 tabular-nums self-start sm:self-auto">
          {t('Progress:', 'پیش رفت:')} {completedCount}/{scenarios.length}{' '}
          {t('completed', 'مکمل')}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-emerald-700 transition-all duration-300"
          style={{ width: `${scenarios.length ? Math.round((completedCount / scenarios.length) * 100) : 0}%` }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inbox Message List */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-xs h-fit max-h-[560px] overflow-y-auto">
          {scenarios.map((item, idx) => {
            const active = idx === selectedIdx;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectScenario(idx)}
                className={`w-full text-start p-4 transition-colors flex items-start justify-between gap-3 ${
                  active ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    {channelIcon(item.payload.channel)}
                    <span className="font-medium text-slate-700">{item.payload.channel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{item.category}</span>
                  </div>
                  <div className={`text-sm font-semibold truncate ${active ? 'text-emerald-900' : 'text-slate-900'}`}>
                    {item.payload.senderName}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{item.title}</div>
                </div>
                {item.completed && (
                  <span className="shrink-0 mt-1">
                    {item.wasCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Message Inspector */}
        <div className="lg:col-span-8 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  {channelIcon(current.payload.channel)}
                </div>
                <div>
                  <div className="font-display text-base font-bold text-slate-900">
                    {current.payload.senderName}
                  </div>
                  <div className="font-mono text-xs text-slate-500" dir="ltr">
                    {current.payload.senderAddress}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 font-mono" dir="ltr">
                {current.payload.timestamp}
              </div>
            </div>

            {current.payload.subject && (
              <div className="mt-4 text-sm font-semibold text-slate-800" dir="ltr">
                Subject: {current.payload.subject}
              </div>
            )}

            <div
              dir="ltr"
              className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm sm:text-base text-slate-800 leading-relaxed"
            >
              {feedback
                ? highlightBody(current.payload.body, feedback.suspiciousPhrases)
                : current.payload.body}
            </div>

            {current.payload.fictionalLink && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-500">
                    {t(
                      'Embedded Link (Disabled for Safe Inspection)',
                      'شامل لنک (محفوظ معائنے کے لیے غیر فعال)'
                    )}
                  </div>
                  <div className="font-mono text-xs text-emerald-800 truncate" dir="ltr">
                    {current.payload.fictionalLink}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkInspect((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {showLinkInspect
                      ? t('Hide URL Inspection', 'لنک کی جانچ چھپائیں')
                      : t('Inspect URL Safely', 'محفوظ طریقے سے لنک جانچیں')}
                  </span>
                </button>
              </div>
            )}

            {showLinkInspect && current.payload.fictionalLink && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
                <div className="font-semibold">
                  {t('URL Safety Inspection', 'URL حفاظتی معائنہ')}
                </div>
                <div>
                  {t(
                    'Domain ends in .invalid (non-routable training domain). Notice how deceptive links mimic brand keywords before hyphens instead of matching an official bank or courier root domain.',
                    'یہ ڈومین .invalid پر ختم ہوتا ہے (محفوظ تربیتی ڈومین)۔ غور کریں کہ جعلی لنکس اصل بینک یا کوریئر ویب سائٹ کے بجائے ملتے جلتے الفاظ استعمال کرتے ہیں۔'
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {/* Classification Actions */}
            {!feedback ? (
              <div className="mt-6 pt-5 border-t border-slate-200">
                <div className="text-sm font-semibold text-slate-800 mb-3">
                  {t('How do you classify this message?', 'آپ اس پیغام کی درجہ بندی کیسے کریں گے؟')}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitChoice('scam')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>{t('Scam', 'فراڈ')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitChoice('safe')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('Safe / Legitimate', 'محفوظ / درست')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitChoice('not_sure')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>{t('Not sure', 'یقین نہیں')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
                <div
                  className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
                    feedback.isCorrect
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {feedback.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {feedback.isCorrect
                          ? t('Correct Classification', 'درست درجہ بندی')
                          : t(
                              `Actually: ${feedback.expectedClassification === 'scam' ? 'Scam' : 'Safe / Legitimate'}`,
                              `درحقیقت: ${feedback.expectedClassification === 'scam' ? 'فراڈ' : 'محفوظ / درست'}`
                            )}
                      </div>
                      <div className="text-xs text-slate-600">
                        {feedback.alreadyCompleted
                          ? t(
                              'Already completed earlier (no duplicate points awarded).',
                              'یہ مشن پہلے ہی مکمل ہو چکا ہے (اضافی پوائنٹس شامل نہیں ہوئے)۔'
                            )
                          : t(
                              `Awarded +${feedback.pointsAwarded} trust points`,
                              `+${feedback.pointsAwarded} ٹرسٹ پوائنٹس دیے گئے`
                            )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                  >
                    <span>{t('Next Scenario', 'اگلا مشن')}</span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {feedback.newlyEarnedBadges.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                    {t('Badge Unlocked:', 'نیا بیج حاصل ہوا:')}{' '}
                    <strong>{feedback.newlyEarnedBadges.map((b) => b.name).join(', ')}</strong>
                  </div>
                )}

                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-bold text-slate-900">
                      {t('Why this matters', 'یہ کیوں اہم ہے')}
                    </div>
                    <p className="text-slate-600 mt-1 leading-relaxed">{feedback.explanation}</p>
                  </div>

                  {feedback.redFlags.length > 0 && (
                    <div>
                      <div className="font-bold text-slate-900">
                        {t('Warning signs highlighted', 'نمایاں کردہ خطرے کی علامات')}
                      </div>
                      <ul className="mt-1.5 space-y-1 text-slate-600 list-disc list-inside">
                        {feedback.redFlags.map((flag, idx) => (
                          <li key={idx}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3.5">
                    <div className="font-bold text-emerald-800">
                      {t('Recommended safe response', 'تجویز کردہ محفوظ ردعمل')}
                    </div>
                    <p className="text-slate-700 mt-1">{feedback.safeResponse}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
