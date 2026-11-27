import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Trash2,
  AlertTriangle,
  Bot,
  User as UserIcon,
  ArrowLeft,
  Languages,
  Loader2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { convertCoachInputText } from '../lib/fastConvert';
import { useLanguage } from '../lib/i18n';
import type { CoachMessage } from '../types/scamverse';

interface CyberCoachViewProps {
  onBack: () => void;
}

const STARTER_QUESTIONS_EN = [
  'Is this message suspicious: "Verify your bank KYC within 2 hours or account freezes"?',
  'How can I identify a fake remote job offer?',
  'Why should I never share my OTP or JazzCash/Easypaisa MPIN?',
  'How can I check whether an online store is trustworthy?',
];

const STARTER_QUESTIONS_UR = [
  'کیا کوئی بینک فون پر او ٹی پی (OTP) مانگ سکتا ہے؟',
  'جعلی نوکری کی پیشکش کی پہچان کیسے کی جائے؟',
  'آن لائن اسٹور پر خریداری سے پہلے کن باتوں کا خیال رکھیں؟',
  'اگر کوئی جاز کیش یا ایزی پیسہ ایڈوانس فیس مانگے تو کیا کرنا چاہیے؟',
];

export const CyberCoachView: React.FC<CyberCoachViewProps> = ({ onBack }) => {
  const { lang: siteLang, isUrdu: siteIsUrdu, t } = useLanguage();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [language, setLanguage] = useState<'en' | 'ur'>(siteLang);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLanguage(siteLang);
  }, [siteLang]);

  useEffect(() => {
    apiFetch<{ messages: CoachMessage[]; language: 'en' | 'ur' }>('/api/coach/history')
      .then((res) => {
        setMessages(res.messages);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    setError(null);
    const optimisticUser: CoachMessage = {
      id: Date.now(),
      role: 'user',
      content: trimmed,
      sourceMode: 'user',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput('');
    setSending(true);

    try {
      const res = await apiFetch<{
        id: number;
        reply: string;
        sourceMode: 'live_gemini' | 'educational_fallback';
        isLiveAI: boolean;
        fallbackReason: string | null;
      }>('/api/coach/ask', {
        method: 'POST',
        body: JSON.stringify({ message: trimmed, language }),
      });

      if (!res.isLiveAI && res.fallbackReason) {
        setFallbackNotice(
          t(
            `Safety Guide Fallback Active (${res.fallbackReason}) — responses below use curated safety guides.`,
            `حفاظتی گائیڈ موڈ فعال ہے (${res.fallbackReason}) — نیچے مستند حفاظتی رہنمائی دکھائی جا رہی ہے۔`
          )
        );
      } else {
        setFallbackNotice(null);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: res.id,
          role: 'assistant',
          content: res.reply,
          sourceMode: res.sourceMode,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Unable to reach Cyber Coach.', 'سائبر کوچ سے رابطہ نہیں ہو سکا۔')
      );
    } finally {
      setSending(false);
    }
  };

  const handleConvertText = async (targetLanguage: 'en' | 'ur') => {
    const trimmed = input.trim();
    if (!trimmed || converting || sending) return;

    setError(null);
    setConverting(true);
    try {
      const converted = await convertCoachInputText(trimmed, targetLanguage);
      setInput(converted);
      setLanguage(targetLanguage);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('Could not convert input text.', 'تحریر تبدیل نہیں ہو سکی۔')
      );
    } finally {
      setConverting(false);
    }
  };

  const handleClear = async () => {
    try {
      await apiFetch('/api/coach/history', { method: 'DELETE' });
      setMessages([]);
      setFallbackNotice(null);
    } catch {
      // ignore
    }
  };

  const starters = language === 'ur' ? STARTER_QUESTIONS_UR : STARTER_QUESTIONS_EN;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 mb-2 transition-colors"
        >
          <ArrowLeft className={`w-3.5 h-3.5 ${siteIsUrdu ? 'rotate-180' : ''}`} />
          <span>{t('Back to Dashboard', 'ڈیش بورڈ پر واپس جائیں')}</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {!imgFailed ? (
              <img
                src="/src/assets/images/avatar_coach_emblem_1795778797401.jpg"
                alt="AI Cyber Coach emblem"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-emerald-700" />
              </div>
            )}
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                {t('AI Cyber Coach', 'AI سائبر کوچ')}
              </h1>
              <p className="text-xs text-slate-600">
                {t(
                  'Ask about suspicious messages, phishing, online shopping, or digital payments in English or Urdu.',
                  'انگریزی یا اردو میں مشکوک پیغامات، فشنگ، آن لائن خریداری یا ڈیجیٹل ادائیگی کے بارے میں پوچھیں۔'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div
              dir="ltr"
              className="inline-flex p-1 bg-white border border-slate-200 rounded-lg shadow-xs"
            >
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  language === 'en' ? 'bg-emerald-700 text-white' : 'text-slate-600'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ur')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  language === 'ur' ? 'bg-emerald-700 text-white' : 'text-slate-600'
                }`}
              >
                اردو
              </button>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={t('Clear chat history', 'چیٹ صاف کریں')}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {fallbackNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{fallbackNotice}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white flex flex-col h-[540px] shadow-xs overflow-hidden">
        {/* Chat Transcript */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-sm text-slate-500">
              {t('Loading conversation...', 'گفتگو لوڈ ہو رہی ہے...')}
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-4 py-4">
              <div className="text-sm text-slate-700 leading-relaxed" dir={language === 'ur' ? 'rtl' : 'ltr'}>
                {language === 'ur'
                  ? 'سلام! کوئی مشکوک پیغام یا آن لائن حفاظت سے متعلق سوال پوچھیں۔ آپ انگریزی یا رومن اردو میں لکھ کر نیچے دیے گئے بٹن سے فوراً اردو یا انگریزی میں تحریر تبدیل بھی کر سکتے ہیں۔'
                  : 'Hello! Paste a suspicious message or ask any digital safety question. If you type in Roman Urdu or English, you can use the Convert toolbar below to switch your draft into Urdu or English before sending.'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {starters.map((q) => (
                  <button
                    key={q}
                    type="button"
                    dir={language === 'ur' ? 'rtl' : 'ltr'}
                    onClick={() => sendMessage(q)}
                    className="text-start rounded-xl border border-slate-200 hover:border-emerald-600 bg-slate-50 hover:bg-emerald-50/40 p-3.5 text-xs text-slate-700 hover:text-slate-900 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isUrduText = /[\u0600-\u06FF]/.test(msg.content);
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-emerald-700" />
                    </div>
                  )}
                  <div
                    dir={isUrduText ? 'rtl' : 'ltr'}
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                      isUser
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}
                  >
                    {msg.content}
                    {!isUser && (
                      <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] font-mono text-slate-500">
                        {msg.sourceMode === 'live_gemini'
                          ? t('Generated by Gemini AI Cyber Coach', 'جیمینائی AI سائبر کوچ کا جواب')
                          : t('ScamVerse Educational Safety Guide', 'اسکیم ورس حفاظتی گائیڈ')}
                      </div>
                    )}
                  </div>
                  {isUser && (
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Bot className="w-4 h-4 text-emerald-700" />
              <span>{t('Analyzing safety patterns...', 'حفاظتی علامات کا تجزیہ جاری ہے...')}</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input Form + Visible Text Converter */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              {converting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
              ) : (
                <Languages className="w-3.5 h-3.5 text-emerald-700" />
              )}
              <span>
                {converting
                  ? t('Converting your text...', 'آپ کی تحریر تبدیل کی جا رہی ہے...')
                  : t(
                      'Typing on an English keyboard? Convert your text before sending:',
                      'انگریزی یا رومن اردو میں لکھ رہے ہیں؟ بھیجنے سے پہلے تحریر تبدیل کریں:'
                    )}
              </span>
            </span>

            <div className="flex items-center gap-2 shrink-0" dir="ltr">
              <button
                type="button"
                disabled={converting || sending || !input.trim()}
                onClick={() => handleConvertText('ur')}
                className="px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-45 text-xs font-semibold text-emerald-800 transition-colors whitespace-nowrap"
              >
                &rarr; اردو
              </button>
              <button
                type="button"
                disabled={converting || sending || !input.trim()}
                onClick={() => handleConvertText('en')}
                className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-45 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
              >
                &rarr; English
              </button>
            </div>
          </div>

          {error && <div className="text-xs text-rose-600">{error}</div>}

          <div className="flex items-center gap-2.5">
            <input
              type="text"
              dir={language === 'ur' || /[\u0600-\u06FF]/.test(input) ? 'rtl' : 'ltr'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                language === 'ur'
                  ? 'انگریزی، رومن اردو یا اردو میں سوال یا مشکوک پیغام لکھیں...'
                  : 'Ask about a suspicious message, job offer, or OTP rule...'
              }
              className="flex-1 rounded-lg bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700"
            />
            <button
              type="submit"
              disabled={sending || converting || !input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-sm transition-colors whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              <span>{t('Send', 'بھیجیں')}</span>
            </button>
          </div>
          <div className="text-[11px] text-slate-500">
            {t(
              'Reminder: Never paste your real passwords, banking PINs, or 6-digit OTP codes into any chat.',
              'یاددہانی: کبھی بھی اپنا اصل پاس ورڈ، بینکنگ پن یا 6 ہندسوں کا OTP کسی چیٹ میں نہ لکھیں۔'
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
