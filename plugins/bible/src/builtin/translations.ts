// The "open"/built-in translations resolved via bible-api.com
export const translations = [
  { id: "web", name: "World English Bible" },
  { id: "kjv", name: "King James Version" },
  { id: "bbe", name: "Bible in Basic English" },
  { id: "webbe", name: "World English Bible (British)" },
  { id: "oeb-us", name: "Open English Bible (US)" },
  { id: "clementine", name: "Clementine Latin Vulgate" },
  { id: "almeida", name: "João Ferreira de Almeida (PT)" },
  { id: "rccv", name: "Romanian Corrected Cornilescu" },
] as const;

export const defaultTranslationId = "kjv";
