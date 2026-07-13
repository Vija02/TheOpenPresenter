// The "open"/built-in translations resolved via bible-api.com
export const translations = [
  { id: "web", name: "World English Bible", language: "en" },
  { id: "kjv", name: "King James Version", language: "en" },
  { id: "bbe", name: "Bible in Basic English", language: "en" },
  { id: "webbe", name: "World English Bible (British)", language: "en" },
  { id: "oeb-us", name: "Open English Bible (US)", language: "en" },
  { id: "clementine", name: "Clementine Latin Vulgate", language: "la" },
  { id: "almeida", name: "João Ferreira de Almeida (PT)", language: "pt" },
  { id: "rccv", name: "Romanian Corrected Cornilescu", language: "ro" },
] as const;

export const defaultTranslationId = "kjv";
