import React, { useEffect, useState } from 'react';
import {
  Search,
  AlertCircle,
  CheckCircle2,
  Flag,
  ShieldAlert,
  Upload,
  Info,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import type { NumberGuardSummary } from '../types/scamverse';

interface CategoryOption {
  id: number;
  slug: string;
  label: string;
}

interface RecentSummary {
  normalizedPhone: string;
  displayPhone: string;
  reportCount: number;
  latestIncident: string;
  statusLabel: string;
  isSample: boolean;
  categories: string[];
}

interface NumberGuardViewProps {
  onBack: () => void;
}

const COUNTRY_CODES = [
  { code: '+92', label: 'Pakistan (+92)' },
  { code: '+1', label: 'USA / Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+966', label: 'Saudi Arabia (+966)' },
];

export const NumberGuardView: React.FC<NumberGuardViewProps> = ({ onBack }) => {
  const { isUrdu, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'lookup' | 'report'>('lookup');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [recentSummaries, setRecentSummaries] = useState<RecentSummary[]>([]);

  // Lookup state
  const [lookupCountryCode, setLookupCountryCode] = useState('+92');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<NumberGuardSummary | null>(null);

  // Flagging state
  const [flagReportId, setFlagReportId] = useState<number | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagStatus, setFlagStatus] = useState<string | null>(null);

  // Submit Report state
  const [repCountryCode, setRepCountryCode] = useState('+92');
  const [repPhone, setRepPhone] = useState('');
  const [repCategory, setRepCategory] = useState('fake-bank-calls');
  const [repDate, setRepDate] = useState(new Date().toISOString().slice(0, 10));
  const [repDesc, setRepDesc] = useState('');
  const [evidenceName, setEvidenceName] = useState<string | null>(null);
  const [evidenceDataUrl, setEvidenceDataUrl] = useState<string | null>(null);
  const [repSubmitting, setRepSubmitting] = useState(false);
  const [repError, setRepError] = useState<string | null>(null);
  const [repSuccess, setRepSuccess] = useState<{
    referenceCode: string;
    displayPhone: string;
    normalizedPhone: string;
    message: string;
  } | null>(null);

  const loadDirectory = async () => {
    try {
      const [catRes, recentRes] = await Promise.all([
        apiFetch<{ categories: CategoryOption[] }>('/api/numberguard/categories'),
        apiFetch<{ summaries: RecentSummary[] }>('/api/numberguard/recent'),
      ]);
      setCategories(catRes.categories);
      setRecentSummaries(recentRes.summaries);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  const performLookup = async (cc: string, rawPhone: string) => {
    setLookupError(null);
    setFlagStatus(null);
    setLookupLoading(true);
    try {
      const q = new URLSearchParams({ countryCode: cc, phone: rawPhone });
      const res = await apiFetch<NumberGuardSummary>(`/api/numberguard/search?${q.toString()}`);
      setLookupResult(res);
    } catch (err: unknown) {
      setLookupError(
        err instanceof Error
          ? err.message
          : t('Unable to search number.', 'نمبر تلاش نہیں ہو سکا۔')
      );
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(lookupCountryCode, lookupPhone);
  };

  const handleSelectRecent = (item: RecentSummary) => {
    const matchedCc =
      COUNTRY_CODES.find((c) => item.normalizedPhone.startsWith(c.code))?.code || '+92';
    const subscriber = item.normalizedPhone.slice(matchedCc.length);
    setLookupCountryCode(matchedCc);
    setLookupPhone(subscriber);
    setActiveTab('lookup');
    performLookup(matchedCc, subscriber);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRepError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setEvidenceName(null);
      setEvidenceDataUrl(null);
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setRepError(
        t(
          'Only PNG, JPEG, or WebP screenshot images are permitted.',
          'صرف PNG، JPEG یا WebP اسکرین شاٹ تصاویر کی اجازت ہے۔'
        )
      );
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setRepError(
        t('Screenshot file must be 1.5 MB or smaller.', 'اسکرین شاٹ فائل 1.5 MB یا اس سے کم ہونی چاہیے۔')
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEvidenceName(file.name);
        setEvidenceDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepError(null);
    setRepSuccess(null);
    setRepSubmitting(true);
    try {
      const res = await apiFetch<{
        referenceCode: string;
        displayPhone: string;
        normalizedPhone: string;
        message: string;
      }>('/api/numberguard/report', {
        method: 'POST',
        body: JSON.stringify({
          countryCode: repCountryCode,
          phone: repPhone,
          categorySlug: repCategory,
          description: repDesc,
          incidentDate: repDate,
          evidenceFilename: evidenceName,
          evidenceDataUrl,
        }),
      });
      setRepSuccess(res);
      setRepPhone('');
      setRepDesc('');
      setEvidenceName(null);
      setEvidenceDataUrl(null);
      loadDirectory();
    } catch (err: unknown) {
      setRepError(
        err instanceof Error
          ? err.message
          : t('Failed to submit report.', 'رپورٹ جمع نہیں ہو سکی۔')
      );
    } finally {
      setRepSubmitting(false);
    }
  };

  const handleFlagSubmit = async (reportId: number) => {
    setFlagStatus(null);
    try {
      const res = await apiFetch<{ message: string }>(`/api/numberguard/reports/${reportId}/flag`, {
        method: 'POST',
        body: JSON.stringify({ reason: flagReason }),
      });
      setFlagStatus(res.message);
      setFlagReportId(null);
      setFlagReason('');
      performLookup(lookupCountryCode, lookupPhone);
    } catch (err: unknown) {
      setFlagStatus(
        err instanceof Error ? err.message : t('Could not submit flag.', 'شکایت درج نہیں ہو سکی۔')
      );
    }
  };

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
            {t('NumberGuard — Community Number Reporting', 'نمبر گارڈ — کمیونٹی نمبر رپورٹنگ')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {t(
              'Look up community-submitted reports or file an incident alert safely with moderation review.',
              'کمیونٹی کی جانب سے رپورٹ کردہ نمبرز تلاش کریں یا ماڈریشن کے ساتھ محفوظ طریقے سے نئی رپورٹ درج کریں۔'
            )}
          </p>
        </div>

        <div
          dir="ltr"
          className="inline-flex p-1 bg-white border border-slate-200 rounded-lg self-start shadow-xs"
        >
          <button
            type="button"
            onClick={() => setActiveTab('lookup')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'lookup'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('Lookup Number', 'نمبر تلاش کریں')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'report'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('Submit Report', 'رپورٹ جمع کروائیں')}
          </button>
        </div>
      </div>

      {/* Responsible Use & Spoofing Disclaimer */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3 text-xs text-slate-700">
        <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <strong>{t('Community Safety Notice:', 'کمیونٹی حفاظتی انتباہ:')}</strong>{' '}
          {t(
            'Reports reflect user-submitted alerts, not legal proof. Phone numbers and caller IDs can be spoofed, cloned, or reassigned to new owners. Submitter identities and uploaded screenshots are kept private for moderation only.',
            'یہ رپورٹس صارفین کے جمع کردہ انتباہات ہیں، قانونی ثبوت نہیں۔ فون نمبرز اور کالر آئی ڈی کی نقل (spoofing) ہو سکتی ہے۔ رپورٹ کنندہ کی شناخت اور اسکرین شاٹس نجی رکھے جاتے ہیں۔'
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {activeTab === 'lookup' && (
            <>
              <form
                onSubmit={handleLookupSubmit}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-xs"
              >
                <div className="text-sm font-bold text-slate-900">
                  {t('Search Suspicious Phone Number', 'مشکوک فون نمبر تلاش کریں')}
                </div>
                <div className="flex flex-col sm:flex-row gap-3" dir="ltr">
                  <select
                    aria-label="Country code"
                    value={lookupCountryCode}
                    onChange={(e) => setLookupCountryCode(e.target.value)}
                    className="rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-700 focus:bg-white"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    placeholder="300 0000101"
                    className="flex-1 rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors whitespace-nowrap"
                  >
                    <Search className="w-4 h-4" />
                    <span>{lookupLoading ? t('Searching...', 'تلاش جاری...') : t('Search', 'تلاش کریں')}</span>
                  </button>
                </div>
                {lookupError && (
                  <div className="text-xs text-rose-600 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{lookupError}</span>
                  </div>
                )}
              </form>

              {lookupResult && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <div className="text-xs text-slate-500">
                        {t('Normalized Lookup Result', 'تلاش کا نتیجہ')}
                      </div>
                      <div className="font-mono text-xl font-bold text-slate-900 mt-0.5 tabular-nums" dir="ltr">
                        {lookupResult.displayPhone}
                      </div>
                    </div>
                    <div className="sm:text-end">
                      <div
                        className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                          lookupResult.totalReports === 0
                            ? 'text-emerald-700'
                            : lookupResult.status === 'moderated_report'
                            ? 'text-amber-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {lookupResult.totalReports === 0 ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <ShieldAlert className="w-4 h-4" />
                        )}
                        <span>{lookupResult.statusLabel}</span>
                      </div>
                      <div className="text-xs font-mono text-slate-500 mt-1 tabular-nums">
                        {lookupResult.totalReports} {t('reports', 'رپورٹس')}
                        {lookupResult.mostRecentReportDate
                          ? ` · ${lookupResult.mostRecentReportDate}`
                          : ''}
                      </div>
                    </div>
                  </div>

                  {lookupResult.categories.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-2">
                        {t('Reported Categories', 'رپورٹ کردہ اقسام')}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-800">
                        {lookupResult.categories.map((cat) => (
                          <span
                            key={cat.slug}
                            className="font-mono bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1"
                          >
                            {cat.label}: <strong>{cat.count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {flagStatus && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                      {flagStatus}
                    </div>
                  )}

                  {lookupResult.reports.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      {t(
                        'No community reports exist for this number yet. Remember that absence of reports does not guarantee safety—always verify callers via official channels.',
                        'اس نمبر کے خلاف ابھی کوئی رپورٹ موجود نہیں۔ تاہم رپورٹ نہ ہونے کا مطلب مکمل تحفظ نہیں — ہمیشہ سرکاری ذرائع سے تصدیق کریں۔'
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lookupResult.reports.map((rep) => (
                        <div
                          key={rep.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span className="font-mono font-semibold text-emerald-700" dir="ltr">
                              {rep.referenceCode} · {rep.categoryLabel}
                            </span>
                            <span className="font-mono">
                              {rep.incidentDate} ·{' '}
                              {rep.moderationStatus === 'moderated_report'
                                ? t('Moderated', 'تصدیق شدہ')
                                : t('Under review', 'جائزے کے تحت')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800">{rep.description}</p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-500">
                              {t('Community flags:', 'کمیونٹی فلیگز:')} {rep.flagCount}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setFlagReportId(flagReportId === rep.id ? null : rep.id)
                              }
                              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-amber-700"
                            >
                              <Flag className="w-3.5 h-3.5" />
                              <span>{t('Flag inaccurate / abusive', 'غلط رپورٹ کی نشاندہی')}</span>
                            </button>
                          </div>

                          {flagReportId === rep.id && (
                            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={flagReason}
                                onChange={(e) => setFlagReason(e.target.value)}
                                placeholder={t('Reason for flagging (min 5 chars)', 'وجہ لکھیں (کم از کم 5 حروف)')}
                                className="flex-1 rounded-md bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() => handleFlagSubmit(rep.id)}
                                className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
                              >
                                {t('Submit Flag', 'بھیجیں')}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs text-slate-600">
                    <div className="font-bold text-slate-900">
                      {t('Safety Recommendations', 'حفاظتی سفارشات')}
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                      {lookupResult.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                    <p className="text-slate-500 pt-1">{lookupResult.disclaimer}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'report' && (
            <form
              onSubmit={handleReportSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-xs"
            >
              <h2 className="font-display text-lg font-bold text-slate-900">
                {t('Submit a Suspicious Number Report', 'مشکوک نمبر کی رپورٹ درج کریں')}
              </h2>

              {repError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{repError}</span>
                </div>
              )}

              {repSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 text-sm text-emerald-900">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {t('Report Recorded — Reference:', 'رپورٹ درج ہو گئی — حوالہ:')} {repSuccess.referenceCode}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800">{repSuccess.message}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const cc = repCountryCode;
                      const num = repSuccess.normalizedPhone.slice(cc.length);
                      setLookupCountryCode(cc);
                      setLookupPhone(num);
                      setActiveTab('lookup');
                      performLookup(cc, num);
                    }}
                    className="text-xs font-semibold text-emerald-700 underline"
                  >
                    {t(`Search ${repSuccess.displayPhone} in NumberGuard`, `${repSuccess.displayPhone} کو نمبر گارڈ میں دیکھیں`)}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" dir="ltr">
                <div>
                  <label htmlFor="ng-cc" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('Country Code', 'ملکی کوڈ')}
                  </label>
                  <select
                    id="ng-cc"
                    value={repCountryCode}
                    onChange={(e) => setRepCountryCode(e.target.value)}
                    className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-700 focus:bg-white"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="ng-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('Phone Number', 'فون نمبر')}
                  </label>
                  <input
                    id="ng-phone"
                    type="text"
                    required
                    value={repPhone}
                    onChange={(e) => setRepPhone(e.target.value)}
                    placeholder="300 0000999"
                    className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ng-cat" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('Scam Category', 'فراڈ کی قسم')}
                  </label>
                  <select
                    id="ng-cat"
                    value={repCategory}
                    onChange={(e) => setRepCategory(e.target.value)}
                    className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-700 focus:bg-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ng-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('Date of Incident', 'واقعے کی تاریخ')}
                  </label>
                  <input
                    id="ng-date"
                    type="date"
                    dir="ltr"
                    required
                    value={repDate}
                    onChange={(e) => setRepDate(e.target.value)}
                    className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-700 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ng-desc" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t(
                    'Description of what happened (Avoid sharing personal banking info)',
                    'واقعے کی تفصیل لکھیں (ذاتی بینکنگ معلومات ہرگز نہ لکھیں)'
                  )}
                </label>
                <textarea
                  id="ng-desc"
                  rows={4}
                  required
                  value={repDesc}
                  onChange={(e) => setRepDesc(e.target.value)}
                  placeholder={t(
                    'Describe the suspicious call or message pattern (minimum 15 characters)...',
                    'مشکوک کال یا پیغام کا طریقہ بیان کریں (کم از کم 15 حروف)...'
                  )}
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t(
                    'Optional Screenshot Evidence (Private moderation only — never shown publicly)',
                    'اختیاری اسکرین شاٹ ثبوت (صرف نجی ماڈریشن کے لیے — عوامی طور پر ظاہر نہیں ہوگا)'
                  )}
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600 cursor-pointer hover:border-emerald-600">
                  <Upload className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="truncate">
                    {evidenceName
                      ? `${t('Attached:', 'منسلک:')} ${evidenceName}`
                      : t('Attach PNG, JPEG, or WebP (max 1.5 MB)', 'PNG، JPEG یا WebP منسلک کریں (زیادہ سے زیادہ 1.5 MB)')}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={repSubmitting}
                className="px-6 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
              >
                {repSubmitting
                  ? t('Submitting Report...', 'رپورٹ جمع ہو رہی ہے...')
                  : t('Submit Report for Review', 'جائزے کے لیے رپورٹ جمع کروائیں')}
              </button>
            </form>
          )}
        </div>

        {/* Recent Community Directory */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 h-fit shadow-xs">
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold mb-1">
            <Clock className="w-4 h-4" />
            <span>{t('Recent Reported Numbers', 'حالیہ رپورٹ کردہ نمبرز')}</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            {t(
              'Click any entry to inspect its community report summary.',
              'کسی بھی نمبر پر کلک کر کے اس کی رپورٹ تفصیل دیکھیں۔'
            )}
          </p>

          <div className="divide-y divide-slate-100">
            {recentSummaries.map((item) => (
              <button
                key={item.normalizedPhone}
                type="button"
                onClick={() => handleSelectRecent(item)}
                className="w-full text-start py-3 hover:bg-slate-50 px-2.5 -mx-2.5 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums" dir="ltr">
                    {item.displayPhone}
                  </span>
                  <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                    {item.reportCount} {t('reports', 'رپورٹس')}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5 truncate">
                  {item.categories.join(' · ')}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{item.statusLabel}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
