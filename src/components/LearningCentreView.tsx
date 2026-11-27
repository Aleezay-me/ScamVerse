import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import type { LearningModuleItem } from '../types/scamverse';

interface LearningCentreViewProps {
  onProgressUpdated: () => void;
  onBack: () => void;
}

interface QuizResult {
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  alreadyCompleted: boolean;
  pointsAwarded: number;
  questionResults: Array<{
    id: string;
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
    explanationUr: string;
  }>;
}

export const LearningCentreView: React.FC<LearningCentreViewProps> = ({
  onProgressUpdated,
  onBack,
}) => {
  const { lang: siteLang, setLang: setSiteLang, isUrdu: siteIsUrdu, t } = useLanguage();
  const [modules, setModules] = useState<LearningModuleItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lang, setLang] = useState<'en' | 'ur'>(siteLang);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLang(siteLang);
  }, [siteLang]);

  useEffect(() => {
    apiFetch<{ modules: LearningModuleItem[] }>('/api/learn/modules')
      .then((res) => {
        setModules(res.modules);
        if (res.modules.length > 0) {
          setSelectedId(res.modules[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const current = modules.find((m) => m.id === selectedId) || modules[0];

  const handleSelectModule = (id: number) => {
    setSelectedId(id);
    setQuizAnswers({});
    setQuizResult(null);
    setError(null);
  };

  const handleSubmitQuiz = async () => {
    if (!current || submitting) return;
    const answersArr = current.content.quiz.map((_, idx) => quizAnswers[idx]);
    if (answersArr.some((a) => a === undefined)) {
      setError(
        t(
          'Please answer every question in the module quiz.',
          'براہ کرم کوئز کے تمام سوالات کا جواب منتخب کریں۔'
        )
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<QuizResult>(`/api/learn/modules/${current.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: answersArr }),
      });
      setQuizResult(res);
      if (res.passed) {
        setModules((prev) =>
          prev.map((m) =>
            m.id === current.id ? { ...m, completed: true, quizScore: res.correctCount } : m
          )
        );
        onProgressUpdated();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('Unable to submit quiz.', 'کوئز جمع نہیں ہو سکا۔')
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
          <ArrowLeft className={`w-4 h-4 ${siteIsUrdu ? 'rotate-180' : ''}`} />
          <span>{t('Back to Dashboard', 'ڈیش بورڈ پر واپس جائیں')}</span>
        </button>
        <div className="text-sm text-slate-600">
          {t('No learning modules found.', 'کوئی تعلیمی سبق دستیاب نہیں ہے۔')}
        </div>
      </div>
    );
  }

  const isUrdu = lang === 'ur';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 mb-2 transition-colors"
          >
            <ArrowLeft className={`w-3.5 h-3.5 ${siteIsUrdu ? 'rotate-180' : ''}`} />
            <span>{t('Back to Dashboard', 'ڈیش بورڈ پر واپس جائیں')}</span>
          </button>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            {t('Digital Safety Learning Centre', 'ڈیجیٹل تحفظ لرننگ سینٹر')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t(
              'Interactive cyber-safety guides with practical examples and mastery quizzes (+15 pts each).',
              'عملی مثالوں اور کوئز کے ساتھ انٹرایکٹو سائبر تحفظ کے اسباق (ہر سبق پر +15 پوائنٹس)۔'
            )}
          </p>
        </div>

        <div
          dir="ltr"
          className="inline-flex p-1 bg-white border border-slate-200 rounded-lg self-start shadow-xs"
        >
          <button
            type="button"
            onClick={() => {
              setLang('en');
              setSiteLang('en');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              lang === 'en' ? 'bg-emerald-700 text-white' : 'text-slate-600'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => {
              setLang('ur');
              setSiteLang('ur');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              lang === 'ur' ? 'bg-emerald-700 text-white' : 'text-slate-600'
            }`}
          >
            اردو
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Module Directory */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden h-fit shadow-xs">
          {modules.map((mod, idx) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => handleSelectModule(mod.id)}
              className={`w-full text-start p-4 flex items-start justify-between gap-3 transition-colors ${
                mod.id === current.id ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0" dir={isUrdu ? 'rtl' : 'ltr'}>
                <div className="text-[11px] font-mono text-slate-500 mb-0.5">
                  {isUrdu ? `سبق 0${idx + 1}` : `Module 0${idx + 1}`} · +{mod.pointsReward} pts
                </div>
                <div
                  className={`text-sm font-semibold ${
                    mod.id === current.id ? 'text-emerald-900' : 'text-slate-900'
                  }`}
                >
                  {isUrdu ? mod.titleUr : mod.title}
                </div>
              </div>
              {mod.completed && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />}
            </button>
          ))}
        </div>

        {/* Module Reader + Quiz */}
        <div
          className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 space-y-6 shadow-xs"
          dir={isUrdu ? 'rtl' : 'ltr'}
        >
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-2">
              <BookOpen className="w-4 h-4" />
              <span>
                {current.completed
                  ? isUrdu
                    ? 'مکمل شدہ'
                    : 'Completed'
                  : isUrdu
                  ? `انعام: +${current.pointsReward} پوائنٹس`
                  : `Reward: +${current.pointsReward} pts`}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              {isUrdu ? current.titleUr : current.title}
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {isUrdu ? current.content.explanationUr : current.content.explanation}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
            <div className="text-xs font-bold text-amber-800">
              {isUrdu ? 'عملی مثال' : current.content.exampleTitle}
            </div>
            <p className="text-sm text-slate-800">
              {isUrdu ? current.content.exampleMessageUr : current.content.exampleMessage}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
              <h3 className="text-sm font-bold text-rose-700 mb-2">
                {isUrdu ? 'خطرے کی علامات' : 'Warning Signs'}
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-700 list-disc list-inside">
                {(isUrdu ? current.content.warningSignsUr : current.content.warningSigns).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <h3 className="text-sm font-bold text-emerald-800 mb-2">
                {isUrdu ? 'حفاظتی تدابیر' : 'Safety Tips'}
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-700 list-disc list-inside">
                {(isUrdu ? current.content.safetyTipsUr : current.content.safetyTips).map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Module Quick Quiz */}
          <div className="pt-5 border-t border-slate-200 space-y-5">
            <h3 className="font-display text-lg font-bold text-slate-900">
              {isUrdu ? 'فوری جانچ (کوئز)' : 'Quick Knowledge Check'}
            </h3>

            {current.content.quiz.map((q, qIdx) => {
              const opts = isUrdu ? q.optionsUr : q.options;
              const qResult = quizResult?.questionResults[qIdx];

              return (
                <div key={q.id} className="space-y-2.5">
                  <div className="text-sm font-semibold text-slate-900">
                    {qIdx + 1}. {isUrdu ? q.questionUr : q.question}
                  </div>
                  <div className="space-y-2">
                    {opts.map((opt, optIdx) => {
                      const selected = quizAnswers[qIdx] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={Boolean(quizResult)}
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                          className={`w-full text-start rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                            selected
                              ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-medium'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {qResult && (
                    <div
                      className={`text-xs rounded-xl p-3 ${
                        qResult.isCorrect
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {isUrdu ? qResult.explanationUr : qResult.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            {error && (
              <div className="text-xs text-rose-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {quizResult ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-900">
                  {isUrdu ? 'اسکور:' : 'Score:'}{' '}
                  <strong>
                    {quizResult.correctCount}/{quizResult.totalQuestions}
                  </strong>{' '}
                  {quizResult.alreadyCompleted
                    ? isUrdu
                      ? '(پہلے مکمل ہو چکا)'
                      : '(Already completed earlier)'
                    : quizResult.pointsAwarded > 0
                    ? isUrdu
                      ? `· +${quizResult.pointsAwarded} پوائنٹس شامل ہوئے`
                      : `· Awarded +${quizResult.pointsAwarded} points`
                    : isUrdu
                    ? '· پاس ہونے کے لیے دوبارہ کوشش کریں'
                    : '· Try again to pass'}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const idx = modules.findIndex((m) => m.id === current.id);
                    const next = modules[(idx + 1) % modules.length];
                    if (next) handleSelectModule(next.id);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors"
                >
                  <span>{isUrdu ? 'اگلا سبق' : 'Next Module'}</span>
                  <ArrowRight className={`w-3.5 h-3.5 ${isUrdu ? 'rotate-180' : ''}`} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitQuiz}
                className="px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
              >
                {submitting
                  ? isUrdu
                    ? 'جانچ جاری ہے...'
                    : 'Checking...'
                  : isUrdu
                  ? 'جوابات جمع کروائیں'
                  : 'Submit Quiz Answers'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
