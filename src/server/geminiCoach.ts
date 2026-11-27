import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface CoachResult {
  reply: string;
  sourceMode: 'live_gemini' | 'educational_fallback';
  fallbackReason?: string;
}

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey = '';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedApiKey = apiKey;
  }
  return cachedClient;
}

// Fast in-memory LRU cache for instant repeated/reverse conversions
const CONVERSION_CACHE = new Map<string, string>();
const MAX_CACHE_ENTRIES = 500;

function setConversionCache(key: string, value: string): void {
  if (CONVERSION_CACHE.size >= MAX_CACHE_ENTRIES) {
    const firstKey = CONVERSION_CACHE.keys().next().value;
    if (firstKey !== undefined) {
      CONVERSION_CACHE.delete(firstKey);
    }
  }
  CONVERSION_CACHE.set(key, value);
}

const SYSTEM_INSTRUCTION = `You are the ScamVerse AI Cyber Coach, a calm, trustworthy, beginner-friendly cybersecurity educator.
Your mission is to help everyday users—especially students, freelancers, online shoppers, and digital wallet users in Pakistan and worldwide—spot scams, understand social engineering, and protect their accounts.

Strict safety and honesty guidelines:
1. Language: Respond in the user's requested language (English or Urdu; if the user writes in Urdu or selects Urdu, write clear, natural Urdu; if English, clear English).
2. Never ask users to share their passwords, banking PINs, JazzCash/Easypaisa MPINs, 6-digit OTPs, CNIC scans, or full card numbers.
3. Never guarantee that a message, link, or phone number is "100% safe" based only on limited user-provided text. Instead, explain what warning signs are present or absent and advise verifying through official apps or helplines.
4. Never accuse real individuals or make unsupported factual claims about specific phone numbers. Remind users that phone numbers and caller IDs can be spoofed or reassigned.
5. Keep answers structured, concise, and practical: (a) Risk assessment or core answer, (b) Specific warning signs to look for, (c) Safe next steps.
6. Reference local digital payment realities responsibly when helpful (e.g., official bank helplines, Raast, JazzCash/Easypaisa PIN-only-for-sending rule, 8171 official channel, avoiding advance fees).`;

function buildEducationalFallback(message: string, language: 'en' | 'ur', reason: string): CoachResult {
  const lower = message.toLowerCase();

  if (language === 'ur') {
    let reply =
      'براہِ کرم نوٹ کریں: اس وقت لائیو Gemini AI سروس دستیاب نہیں ہے، اس لیے آپ کو ScamVerse کا مستند حفاظتی گائیڈ فراہم کیا جا رہا ہے۔\n\n';
    if (lower.includes('otp') || lower.includes('pin') || lower.includes('او ٹی پی')) {
      reply +=
        'او ٹی پی (OTP) اور پن کی حفاظت:\n• کوئی بھی بینک، جاز کیش، ایزی پیسہ یا سرکاری ادارہ کبھی فون کال یا واٹس ایپ پر آپ کا 6 ہندسوں کا OTP یا MPIN نہیں مانگتا۔\n• اگر کوئی فراڈ روکنے کے بہانے کوڈ مانگے تو فوراً کال کاٹ دیں اور کارڈ کے پیچھے موجود سرکاری ہیلپ لائن پر خود کال کریں۔';
    } else if (lower.includes('job') || lower.includes('نوکری')) {
      reply +=
        'جعلی نوکری کی پہچان:\n• اصل ادارے کام شروع کرنے یا ٹاسک کھولنے کے لیے کبھی پیشگی فیس یا سیکیورٹی ڈپازٹ نہیں مانگتے۔\n• روزانہ غیر معمولی تنخواہ اور بغیر انٹرویو فوری بھرتی فراڈ کی واضح علامات ہیں۔';
    } else if (lower.includes('shop') || lower.includes('خریداری') || lower.includes('advance')) {
      reply +=
        'آن لائن خریداری اور ایڈوانس پیمنٹ:\n• نامعلوم صفحات پر ذاتی والٹ میں ایڈوانس رقم یا ٹوکن منی نہ بھیجیں۔\n• کیش آن ڈیلیوری (COD) یا مستند پلیٹ فارمز کو ترجیح دیں اور ادائیگی سے پہلے ریویوز چیک کریں۔';
    } else {
      reply +=
        'مشکوک پیغام جانچنے کے بنیادی اصول:\n1. غیر معمولی جلدی یا دھمکی (مثلاً 2 گھنٹے میں اکاؤنٹ بند) سے ہوشیار رہیں۔\n2. کسی بھی لنک پر کلک کرنے کے بجائے خود آفیشل ایپ یا ویب سائٹ کھول کر تصدیق کریں۔\n3. اپنا OTP، پاس ورڈ یا پن کسی کو ہرگز نہ بتائیں۔\n4. آپ NumberGuard میں مشکوک نمبر کی کمیونٹی رپورٹس بھی دیکھ سکتے ہیں۔';
    }
    return { reply, sourceMode: 'educational_fallback', fallbackReason: reason };
  }

  let reply = '';
  if (lower.includes('otp') || lower.includes('pin') || lower.includes('password')) {
    reply =
      'Why You Must Never Share an OTP or PIN:\n' +
      '• An OTP (One-Time Password) or wallet MPIN is an electronic signature that authorizes money transfers or password resets.\n' +
      '• Genuine banks, JazzCash/Easypaisa support, and government agencies never ask you to read back an OTP—even to "cancel" a fraudulent charge.\n' +
      '• Safe Action: Hang up immediately, never read the digits aloud, and dial the official helpline printed on the back of your card.';
  } else if (lower.includes('job') || lower.includes('work') || lower.includes('salary') || lower.includes('freelance')) {
    reply =
      'How to Spot a Fake Job Offer:\n' +
      '• Upfront Fee Demand: Legitimate employers pay you—never pay a "VIP task deposit", "software license fee", or "registration charge".\n' +
      '• Zero Interview: Immediate hiring over WhatsApp or Telegram for simple tasks (like liking videos) is a major red flag.\n' +
      '• Safe Action: Verify the company on LinkedIn and its official domain before sharing CNIC scans or bank IBAN details.';
  } else if (lower.includes('shop') || lower.includes('store') || lower.includes('buy') || lower.includes('discount') || lower.includes('advance')) {
    reply =
      'Checking Online Stores & Advance Payment Requests:\n' +
      '• Be cautious of 60–80% discounts on electronics combined with "Cash on Delivery disabled".\n' +
      '• Never send advance "token money" to a personal mobile wallet or unverified bank account.\n' +
      '• Safe Action: Prefer Cash on Delivery, open-parcel inspection, or established marketplace escrow. Check domain spelling and independent reviews.';
  } else if (lower.includes('suspicious') || lower.includes('message') || lower.includes('link') || lower.includes('whatsapp') || lower.includes('sms')) {
    reply =
      'Checklist to Evaluate Any Suspicious Message:\n' +
      '1. Urgency or Fear: Does it threaten account suspension or a 2-hour deadline?\n' +
      '2. Lookalike Links: Check the domain carefully for extra hyphens or misspelled brand names.\n' +
      '3. Secret Requests: Does it ask for an OTP, MPIN, password, or advance fee?\n' +
      '4. Safe Action: Do not tap embedded links. Open the official app directly to verify, and remember even a message without obvious red flags cannot be guaranteed 100% safe without official verification.';
  } else {
    reply =
      'Core ScamVerse Digital Safety Principles:\n' +
      '• Think Before You Click: Pause whenever a message creates panic or promises easy cash prizes.\n' +
      '• Verify Independently: Always navigate to your bank, courier, or university portal directly rather than using links inside SMS or WhatsApp.\n' +
      '• Protect Secrets: Never share OTPs, MPINs, or passwords with anyone, and enable Two-Step Verification on WhatsApp and email.';
  }

  return {
    reply,
    sourceMode: 'educational_fallback',
    fallbackReason: reason,
  };
}

export async function askCyberCoach(params: {
  message: string;
  language: 'en' | 'ur';
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<CoachResult> {
  const ai = getGeminiClient();
  if (!ai) {
    return buildEducationalFallback(
      params.message,
      params.language,
      'GEMINI_API_KEY is not configured on the server.'
    );
  }

  try {
    const recentHistory = params.history.slice(-8).map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }],
    }));

    const languageNote =
      params.language === 'ur'
        ? '[User selected Urdu language. Please reply clearly in Urdu script.]\n'
        : '[User selected English language. Please reply clearly in English.]\n';

    const contents = [
      ...recentHistory,
      {
        role: 'user',
        parts: [{ text: `${languageNote}${params.message}` }],
      },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const text = (response.text || '').trim();
    if (!text) {
      return buildEducationalFallback(
        params.message,
        params.language,
        'Gemini returned an empty response.'
      );
    }

    return {
      reply: text,
      sourceMode: 'live_gemini',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upstream Gemini request failed';
    console.error('Gemini Cyber Coach error:', msg);
    return buildEducationalFallback(
      params.message,
      params.language,
      `Gemini API fallback: ${msg.slice(0, 120)}`
    );
  }
}

export interface ConvertTextResult {
  convertedText: string;
  isLiveAI: boolean;
  cached?: boolean;
  fallbackReason?: string;
}

const ROMAN_TO_URDU_WORDS: Record<string, string> = {
  salam: 'سلام',
  assalam: 'السلام',
  alaikum: 'علیکم',
  bhai: 'بھائی',
  behan: 'بہن',
  yaar: 'یار',
  kya: 'کیا',
  kia: 'کیا',
  ye: 'یہ',
  yeh: 'یہ',
  wo: 'وہ',
  woh: 'وہ',
  hai: 'ہے',
  hain: 'ہیں',
  ho: 'ہو',
  haan: 'ہاں',
  ji: 'جی',
  nahi: 'نہیں',
  na: 'نہ',
  mera: 'میرا',
  meri: 'میری',
  mere: 'میرے',
  apna: 'اپنا',
  aap: 'آپ',
  ap: 'آپ',
  mujhe: 'مجھے',
  mujh: 'مجھ',
  se: 'سے',
  ko: 'کو',
  ka: 'کا',
  ki: 'کی',
  ke: 'کے',
  mein: 'میں',
  main: 'میں',
  par: 'پر',
  pe: 'پہ',
  aur: 'اور',
  ya: 'یا',
  agar: 'اگر',
  to: 'تو',
  bhi: 'بھی',
  abhi: 'ابھی',
  kese: 'کیسے',
  kaise: 'کیسے',
  kyun: 'کیوں',
  kahan: 'کہاں',
  kab: 'کب',
  kon: 'کون',
  kaun: 'کون',
  sab: 'سب',
  theek: 'ٹھیک',
  thik: 'ٹھیک',
  sahi: 'صحیح',
  galat: 'غلط',
  ghalat: 'غلط',
  asli: 'اصلی',
  asal: 'اصل',
  naqli: 'نقلی',
  fake: 'جعلی',
  scam: 'فراڈ',
  fraud: 'فراڈ',
  dhoka: 'دھوکہ',
  safe: 'محفوظ',
  mahfooz: 'محفوظ',
  khatra: 'خطرہ',
  mashkook: 'مشکوک',
  message: 'پیغام',
  msg: 'پیغام',
  sms: 'ایس ایم ایس',
  whatsapp: 'واٹس ایپ',
  call: 'کال',
  phone: 'فون',
  number: 'نمبر',
  link: 'لنک',
  website: 'ویب سائٹ',
  bank: 'بینک',
  account: 'اکاؤنٹ',
  jazzcash: 'جاز کیش',
  easypaisa: 'ایزی پیسہ',
  raast: 'راست',
  otp: 'او ٹی پی',
  pin: 'پن',
  password: 'پاس ورڈ',
  cnic: 'شناختی کارڈ',
  paise: 'پیسے',
  paisay: 'پیسے',
  rupees: 'روپے',
  fee: 'فیس',
  fees: 'فیس',
  inam: 'انعام',
  inaam: 'انعام',
  prize: 'انعام',
  job: 'نوکری',
  naukri: 'نوکری',
  nokri: 'نوکری',
  offer: 'پیشکش',
  verify: 'تصدیق',
  tasdeeq: 'تصدیق',
  check: 'چیک',
  karo: 'کرو',
  karen: 'کریں',
  karna: 'کرنا',
  krun: 'کروں',
  karun: 'کروں',
  karoon: 'کروں',
  batao: 'بتاؤ',
  batayen: 'بتائیں',
  samjhao: 'سمجھاؤ',
  mang: 'مانگ',
  maang: 'مانگ',
  raha: 'رہا',
  rahi: 'رہی',
  rahe: 'رہے',
  bheja: 'بھیجا',
  aaya: 'آیا',
  aya: 'آیا',
  click: 'کلک',
  band: 'بند',
  block: 'بلاک',
  wala: 'والا',
  wali: 'والی',
  wale: 'والے',
  madad: 'مدد',
  shukriya: 'شکریہ',
  please: 'براہ کرم',
  plz: 'براہ کرم',
};

const URDU_TO_ENGLISH_WORDS: Record<string, string> = Object.fromEntries(
  Object.entries(ROMAN_TO_URDU_WORDS)
    .filter(([k]) => !['kia', 'yeh', 'woh', 'ap', 'thik', 'galat', 'paisay', 'nokri', 'inaam', 'maang', 'aya', 'krun', 'plz'].includes(k))
    .map(([en, ur]) => [ur, en])
);

function localConvertFallback(text: string, targetLanguage: 'en' | 'ur'): string {
  const trimmed = text.trim();
  const tokens = trimmed.split(/(\s+|[.,!?؟،"']+)/);

  if (targetLanguage === 'ur') {
    const romanMarkers = new Set(['kya', 'kia', 'hai', 'hain', 'mujhe', 'mera', 'meri', 'karo', 'karen', 'karun', 'karoon', 'krun', 'batao', 'batayen', 'maang', 'mang', 'raha', 'rahi', 'nahi', 'haan', 'ye', 'yeh', 'wo', 'woh', 'mein', 'main', 'se', 'ko', 'ka', 'ki', 'ke', 'aur', 'kaise', 'kese', 'kyun', 'salam']);
    const alphaTokens = tokens.filter((t) => /^[a-zA-Z]+$/.test(t));
    const hasRomanMarker = alphaTokens.some((t) => romanMarkers.has(t.toLowerCase()));
    let translatedCount = 0;
    const mapped = tokens.map((tok) => {
      const clean = tok.toLowerCase();
      if (ROMAN_TO_URDU_WORDS[clean]) {
        translatedCount++;
        return ROMAN_TO_URDU_WORDS[clean];
      }
      return tok;
    });
    if (hasRomanMarker && translatedCount >= 1) {
      return mapped.join('');
    }
    return trimmed;
  }

  let translatedCount = 0;
  const mapped = tokens.map((tok) => {
    if (URDU_TO_ENGLISH_WORDS[tok]) {
      translatedCount++;
      return URDU_TO_ENGLISH_WORDS[tok];
    }
    return tok;
  });
  if (translatedCount >= 1) {
    return mapped.join('');
  }
  return trimmed;
}

export async function convertCoachText(params: {
  text: string;
  targetLanguage: 'en' | 'ur';
}): Promise<ConvertTextResult> {
  const trimmed = params.text.trim();
  if (!trimmed) {
    return { convertedText: '', isLiveAI: false };
  }

  // Fast skip if text is already clearly in target script (no mixed ASCII)
  const hasArabicScript = /[\u0600-\u06FF]/.test(trimmed);
  const hasLatinLetters = /[a-zA-Z]/.test(trimmed);
  if (params.targetLanguage === 'ur' && hasArabicScript && !hasLatinLetters) {
    return { convertedText: trimmed, isLiveAI: false, cached: true };
  }

  // Tier 1: 0ms In-Memory LRU Cache
  const cacheKey = `${params.targetLanguage}:${trimmed.toLowerCase()}`;
  const cachedHit = CONVERSION_CACHE.get(cacheKey);
  if (cachedHit) {
    return { convertedText: cachedHit, isLiveAI: true, cached: true };
  }

  // Tier 2: Ultra-low-latency Gemini Flash-Lite (ThinkingLevel.MINIMAL = zero thinking overhead)
  const ai = getGeminiClient();
  if (!ai) {
    return {
      convertedText: localConvertFallback(trimmed, params.targetLanguage),
      isLiveAI: false,
      fallbackReason: 'GEMINI_API_KEY is not configured on the server.',
    };
  }

  try {
    const instruction =
      params.targetLanguage === 'ur'
        ? 'Faithfully translate or transliterate the user text (English or Roman Urdu) into natural Urdu script. Preserve exact meaning and questions. Return only the Urdu text.'
        : 'Faithfully translate the user text (Urdu or Roman Urdu) into natural English. Preserve exact meaning and questions. Return only the English text.';

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: trimmed,
        config: {
          systemInstruction: instruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Converter latency timeout')), 6500)
      ),
    ]);

    const converted = (response.text || '').trim().replace(/^["']|["']$/g, '');
    if (!converted) {
      return {
        convertedText: localConvertFallback(trimmed, params.targetLanguage),
        isLiveAI: false,
        fallbackReason: 'Empty conversion response.',
      };
    }

    setConversionCache(cacheKey, converted);
    const reverseLang = params.targetLanguage === 'ur' ? 'en' : 'ur';
    setConversionCache(`${reverseLang}:${converted.toLowerCase()}`, trimmed);
    return {
      convertedText: converted,
      isLiveAI: true,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Conversion failed';
    console.error('Gemini convert text error:', msg);
    return {
      convertedText: localConvertFallback(trimmed, params.targetLanguage),
      isLiveAI: false,
      fallbackReason: 'Live Gemini converter is temporarily unavailable.',
    };
  }
}
