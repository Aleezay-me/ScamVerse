import { apiFetch } from './api';

// Client-side instant cache so repeated or reverse toggles resolve in 0ms
const CLIENT_CONVERT_CACHE = new Map<string, string>();

const INSTANT_PHRASE_PAIRS: Array<[string, string]> = [
  ['is this message a scam', 'کیا یہ پیغام فراڈ ہے؟'],
  ['why should i never share otp', 'مجھے او ٹی پی (OTP) کبھی کیوں نہیں بتانا چاہیے؟'],
  ['how to spot fake job offers', 'جعلی نوکری کی پیشکش کی پہچان کیسے کریں؟'],
  ['is advance payment safe for online shopping', 'کیا آن لائن خریداری میں ایڈوانس پیمنٹ محفوظ ہے؟'],
  ['how do i check a suspicious number', 'مشکوک فون نمبر کی جانچ کیسے کروں؟'],
  ['someone is asking for my jazzcash otp', 'کوئی مجھ سے میرا جیز کیش او ٹی پی مانگ رہا ہے۔'],
  ['someone is asking for my easypaisa pin', 'کوئی مجھ سے میرا ایزی پیسہ پن مانگ رہا ہے۔'],
  ['should i click this link', 'کیا مجھے اس لنک پر کلک کرنا چاہیے؟'],
  ['is this bisp 8171 message real', 'کیا یہ بی آئی ایس پی 8171 کا پیغام اصلی ہے؟'],
  ['salam', 'السلام علیکم'],
  ['assalam o alaikum', 'السلام علیکم'],
  ['hello', 'السلام علیکم'],
  ['thank you', 'شکریہ'],
  ['thanks', 'شکریہ'],
];

const PHRASE_EN_TO_UR = new Map<string, string>();
const PHRASE_UR_TO_EN = new Map<string, string>();

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[?.!؟،]+$/g, '')
    .replace(/\s+/g, ' ');
}

for (const [en, ur] of INSTANT_PHRASE_PAIRS) {
  PHRASE_EN_TO_UR.set(normalizeKey(en), ur);
  PHRASE_UR_TO_EN.set(normalizeKey(ur), en.charAt(0).toUpperCase() + en.slice(1) + '?');
}

const ROMAN_URDU_MARKERS = new Set([
  'kya', 'kia', 'hai', 'hain', 'ho', 'hun', 'hoon', 'mujhe', 'mujh', 'mujhko',
  'mera', 'meri', 'mere', 'aap', 'ap', 'apna', 'apni', 'apne', 'tum', 'hum', 'hamara',
  'karo', 'karen', 'karna', 'karun', 'karoon', 'krun', 'karta', 'karti', 'karte',
  'batao', 'batayen', 'bataen', 'samjhao', 'samjhaen', 'maang', 'mang', 'manga',
  'raha', 'rahi', 'rahe', 'bheja', 'bheji', 'aaya', 'aya', 'aayi', 'nahi', 'nahin',
  'haan', 'han', 'ji', 'ye', 'yeh', 'wo', 'woh', 'mein', 'main', 'se', 'ko', 'ka',
  'ki', 'ke', 'par', 'pe', 'aur', 'ya', 'agar', 'kese', 'kaise', 'kyun', 'kyu',
  'kahan', 'kab', 'kon', 'kaun', 'chahiye', 'sakta', 'sakti', 'sakte', 'gaya', 'gayi',
  'dekh', 'dekho', 'dekhen', 'salam', 'assalam', 'alaikum', 'bhai', 'behan', 'yaar',
  'paise', 'paisay', 'naukri', 'nokri', 'dhoka', 'mashkook', 'tasdeeq', 'shukriya',
  'madad', 'wala', 'wali', 'wale', 'abhi', 'theek', 'thik', 'galat', 'ghalat',
  'asli', 'naqli', 'khatra', 'mahfooz', 'bataiye', 'batain', 'kholo', 'kholun', 'kholoon',
]);

const ROMAN_TO_URDU_WORDS: Record<string, string> = {
  salam: 'سلام',
  assalam: 'السلام',
  alaikum: 'علیکم',
  bhai: 'بھائی',
  behan: 'بہن',
  yaar: 'یار',
  dost: 'دوست',
  kya: 'کیا',
  kia: 'کیا',
  ye: 'یہ',
  yeh: 'یہ',
  wo: 'وہ',
  woh: 'وہ',
  hai: 'ہے',
  hain: 'ہیں',
  tha: 'تھا',
  thi: 'تھی',
  the: 'تھے',
  ho: 'ہو',
  hoga: 'ہوگا',
  hogi: 'ہوگی',
  hoon: 'ہوں',
  hun: 'ہوں',
  haan: 'ہاں',
  han: 'ہاں',
  ji: 'جی',
  nahi: 'نہیں',
  nahin: 'نہیں',
  na: 'نہ',
  mat: 'مت',
  mera: 'میرا',
  meri: 'میری',
  mere: 'میرے',
  hamara: 'ہمارا',
  hum: 'ہم',
  apna: 'اپنا',
  apni: 'اپنی',
  apne: 'اپنے',
  aap: 'آپ',
  ap: 'آپ',
  tum: 'تم',
  mujhe: 'مجھے',
  mujhko: 'مجھ کو',
  mujh: 'مجھ',
  unhon: 'انہوں',
  usne: 'اس نے',
  maine: 'میں نے',
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
  phir: 'پھر',
  lekin: 'لیکن',
  magar: 'مگر',
  kese: 'کیسے',
  kaise: 'کیسے',
  kyun: 'کیوں',
  kyu: 'کیوں',
  kahan: 'کہاں',
  kab: 'کب',
  kon: 'کون',
  kaun: 'کون',
  kitna: 'کتنا',
  kitne: 'کتنے',
  koi: 'کوئی',
  kuch: 'کچھ',
  sab: 'سب',
  bohat: 'بہت',
  bahut: 'بہت',
  zyada: 'زیادہ',
  kam: 'کم',
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
  email: 'ای میل',
  call: 'کال',
  phone: 'فون',
  number: 'نمبر',
  link: 'لنک',
  website: 'ویب سائٹ',
  app: 'ایپ',
  bank: 'بینک',
  account: 'اکاؤنٹ',
  jazzcash: 'جیز کیش',
  easypaisa: 'ایزی پیسہ',
  raast: 'راست',
  bisp: 'بی آئی ایس پی',
  nadra: 'نادرا',
  daraz: 'دراز',
  olx: 'او ایل ایکس',
  otp: 'او ٹی پی',
  pin: 'پن',
  mpin: 'ایم پن',
  password: 'پاس ورڈ',
  code: 'کوڈ',
  cnic: 'شناختی کارڈ',
  paise: 'پیسے',
  paisay: 'پیسے',
  rupees: 'روپے',
  rs: 'روپے',
  fee: 'فیس',
  fees: 'فیس',
  advance: 'ایڈوانس',
  payment: 'ادائیگی',
  inam: 'انعام',
  inaam: 'انعام',
  prize: 'انعام',
  job: 'نوکری',
  naukri: 'نوکری',
  nokri: 'نوکری',
  salary: 'تنخواہ',
  offer: 'پیشکش',
  parcel: 'پارسل',
  delivery: 'ڈیلیوری',
  verify: 'تصدیق',
  tasdeeq: 'تصدیق',
  check: 'چیک',
  karo: 'کرو',
  karen: 'کریں',
  karna: 'کرنا',
  karun: 'کروں',
  karoon: 'کروں',
  krun: 'کروں',
  karta: 'کرتا',
  karti: 'کرتی',
  karte: 'کرتے',
  kiya: 'کیا',
  batao: 'بتاؤ',
  batayen: 'بتائیں',
  bataen: 'بتائیں',
  bataiye: 'بتائیے',
  batain: 'بتائیں',
  samjhao: 'سمجھاؤ',
  samjhaen: 'سمجھائیں',
  mang: 'مانگ',
  maang: 'مانگ',
  manga: 'مانگا',
  raha: 'رہا',
  rahi: 'رہی',
  rahe: 'رہے',
  bheja: 'بھیجا',
  bheji: 'بھیجی',
  bhejo: 'بھیجو',
  bhej: 'بھیج',
  aaya: 'آیا',
  aya: 'آیا',
  aayi: 'آئی',
  gaya: 'گیا',
  gayi: 'گئی',
  gaye: 'گئے',
  dekh: 'دیکھ',
  dekho: 'دیکھو',
  dekhen: 'دیکھیں',
  kholo: 'کھولو',
  kholun: 'کھولوں',
  kholoon: 'کھولوں',
  chahiye: 'چاہیے',
  sakta: 'سکتا',
  sakti: 'سکتی',
  sakte: 'سکتے',
  click: 'کلک',
  open: 'اوپن',
  band: 'بند',
  block: 'بلاک',
  report: 'رپورٹ',
  wala: 'والا',
  wali: 'والی',
  wale: 'والے',
  liye: 'لیے',
  madad: 'مدد',
  help: 'مدد',
  shukriya: 'شکریہ',
  please: 'براہ کرم',
  plz: 'براہ کرم',
  is: 'اس',
  us: 'اس',
  in: 'ان',
  un: 'ان',
  aik: 'ایک',
  ek: 'ایک',
  do: 'دو',
  teen: 'تین',
  din: 'دن',
  aaj: 'آج',
  kal: 'کل',
  ghar: 'گھر',
  kaam: 'کام',
};

function tryInstantLocalConvert(text: string, targetLanguage: 'en' | 'ur'): string | null {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const norm = normalizeKey(trimmed);

  // 1. Instant exact phrase lookup
  if (targetLanguage === 'ur') {
    const exactUr = PHRASE_EN_TO_UR.get(norm);
    if (exactUr) return exactUr;
  } else {
    const exactEn = PHRASE_UR_TO_EN.get(norm);
    if (exactEn) return exactEn;
  }

  // 2. If already strictly in target script, return as-is
  const hasArabicScript = /[\u0600-\u06FF]/.test(trimmed);
  const hasLatinLetters = /[a-zA-Z]/.test(trimmed);
  if (targetLanguage === 'ur' && hasArabicScript && !hasLatinLetters) {
    return trimmed;
  }
  if (targetLanguage === 'en' && hasLatinLetters && !hasArabicScript) {
    // Only skip if not Roman Urdu; if Roman Urdu, let server translate to English
    const words = norm.split(/\s+/);
    const romanMarkerHits = words.filter((w) => ROMAN_URDU_MARKERS.has(w)).length;
    if (romanMarkerHits === 0) {
      return trimmed;
    }
  }

  // 3. Instant deterministic Roman-Urdu -> Urdu script converter (0ms)
  if (targetLanguage === 'ur' && hasLatinLetters && !hasArabicScript) {
    const tokens = trimmed.split(/(\s+|[.,!?؟،"']+)/);
    const wordTokens = tokens.filter((t) => /^[a-zA-Z]+$/.test(t));
    if (wordTokens.length === 0) return null;

    let markerCount = 0;
    let knownCount = 0;
    for (const w of wordTokens) {
      const lw = w.toLowerCase();
      if (ROMAN_URDU_MARKERS.has(lw)) markerCount++;
      if (ROMAN_TO_URDU_WORDS[lw]) knownCount++;
    }

    // Trigger instant local conversion when text is clearly Roman Urdu & fully covered
    if (markerCount >= 1 && knownCount === wordTokens.length) {
      const converted = tokens
        .map((tok) => {
          if (tok === '?') return '؟';
          if (tok === ',') return '،';
          const lw = tok.toLowerCase();
          return ROMAN_TO_URDU_WORDS[lw] || tok;
        })
        .join('');
      return converted;
    }
  }

  return null;
}

export async function convertCoachInputText(
  text: string,
  targetLanguage: 'en' | 'ur'
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const cacheKey = `${targetLanguage}:${trimmed.toLowerCase()}`;
  const cached = CLIENT_CONVERT_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fast 0ms on-device Roman Urdu / phrase conversion
  const instantResult = tryInstantLocalConvert(trimmed, targetLanguage);
  if (instantResult) {
    CLIENT_CONVERT_CACHE.set(cacheKey, instantResult);
    const reverseLang = targetLanguage === 'ur' ? 'en' : 'ur';
    CLIENT_CONVERT_CACHE.set(`${reverseLang}:${instantResult.toLowerCase()}`, trimmed);
    return instantResult;
  }

  const res = await apiFetch<{ convertedText: string }>('/api/coach/convert', {
    method: 'POST',
    body: JSON.stringify({ text: trimmed, targetLanguage }),
  });

  if (res.convertedText) {
    CLIENT_CONVERT_CACHE.set(cacheKey, res.convertedText);
    const sourceGuess = /[\u0600-\u06FF]/.test(trimmed) ? 'ur' : 'en';
    if (sourceGuess !== targetLanguage) {
      CLIENT_CONVERT_CACHE.set(`${sourceGuess}:${res.convertedText.toLowerCase()}`, trimmed);
    }
  }

  return res.convertedText || text;
}
