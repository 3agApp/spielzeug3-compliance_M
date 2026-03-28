// ─── i18n React Context ───────────────────────────────────────────────────────
// This file contains ONLY React components (LanguageProvider) and hooks (useLang)
// so that Vite Fast Refresh works without warnings.
// Non-React exports (translations, Language, TranslationKeys) live in
// i18n.translations.ts; error translation lives in translateError.ts.
import { createContext, useContext, useState, ReactNode } from "react";
import type { Language, TranslationKeys } from "./i18n.translations";
import { translations } from "./i18n.translations";

// Re-export types only (types are erased at runtime, so they don't affect HMR)
export type { Language, TranslationKeys } from "./i18n.translations";

const LanguageContext = createContext<{
  lang: Language;
  setLang: (l: Language) => void;
  t: TranslationKeys;
}>({
  lang: "de",
  setLang: () => {},
  t: translations.de as TranslationKeys,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem("lang") as Language) ?? "de";
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  const t = translations[lang] as TranslationKeys;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
