import React, { createContext, useContext, useEffect, useState } from 'react';

export type SiteLanguage = 'en' | 'ur';

interface LanguageContextValue {
  lang: SiteLanguage;
  setLang: (next: SiteLanguage) => void;
  toggleLang: () => void;
  isUrdu: boolean;
  t: (enText: string, urText: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'scamverse_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<SiteLanguage>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved === 'ur' ? 'ur' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = (next: SiteLanguage) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failure
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  }, [lang]);

  const toggleLang = () => setLang(lang === 'en' ? 'ur' : 'en');
  const t = (enText: string, urText: string) => (lang === 'ur' ? urText : enText);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        isUrdu: lang === 'ur',
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selector (English or Urdu)"
      dir="ltr"
      className="inline-flex items-center p-0.5 rounded-lg border border-slate-200 bg-slate-100 shrink-0"
    >
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`${
          compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'
        } font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
          lang === 'en'
            ? 'bg-white text-emerald-800 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLang('ur')}
        className={`${
          compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'
        } font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
          lang === 'ur'
            ? 'bg-emerald-700 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        اردو
      </button>
    </div>
  );
};
