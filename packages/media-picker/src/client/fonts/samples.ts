export const LATIN_SAMPLE = "The quick brown fox jumps over the lazy dog";

/** By ISO 15924 code. Other scripts fall back to Latin */
const SAMPLE_BY_SCRIPT: Record<string, string> = {
  Arab: "أهلاً وسهلاً بكم",
  Armn: "Բարի գալուստ",
  Beng: "সবাইকে স্বাগতম",
  Cyrl: "Добро пожаловать всем",
  Deva: "आप सभी का स्वागत है",
  Ethi: "እንኳን ደህና መጡ",
  Geor: "კეთილი იყოს თქვენი მობრძანება",
  Gujr: "સૌનું સ્વાગત છે",
  Guru: "ਸਭ ਦਾ ਸਵਾਗਤ ਹੈ",
  Hang: "여러분 환영합니다",
  Hans: "欢迎大家来到这里",
  Hant: "歡迎大家來到這裡",
  Hebr: "ברוכים הבאים",
  Hira: "ようこそ、みなさん",
  Jpan: "ようこそ、皆さん。今日もよろしく",
  Khmr: "សូមស្វាគមន៍",
  Knda: "ಎಲ್ಲರಿಗೂ ಸ್ವಾಗತ",
  Kore: "여러분 환영합니다",
  Laoo: "ຍິນດີຕ້ອນຮັບ",
  Mlym: "എല്ലാവർക്കും സ്വാഗതം",
  Mymr: "ကြိုဆိုပါတယ်",
  Sinh: "සැමට සාදරයෙන් පිළිගනිමු",
  Taml: "அனைவருக்கும் வணக்கம்",
  Telu: "అందరికీ స్వాగతం",
  Thai: "ยินดีต้อนรับทุกคน",
};

export const sampleFor = (
  font: { primaryScript?: string; hasLatin?: boolean },
  custom: string,
): string => {
  if (custom.trim()) return custom;
  const native = font.primaryScript
    ? SAMPLE_BY_SCRIPT[font.primaryScript]
    : undefined;
  if (native) return native;
  return LATIN_SAMPLE;
};
