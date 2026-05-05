import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";

export const SUPPORTED_LANGS = [
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "en", name: "English", dir: "ltr" },
  { code: "fr", name: "Français", dir: "ltr" },
  { code: "es", name: "Español", dir: "ltr" },
] as const;

export type LangCode = typeof SUPPORTED_LANGS[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      fr: { translation: fr },
      es: { translation: es },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "samir.lang",
    },
  });

function applyDir(lng: string) {
  const meta = SUPPORTED_LANGS.find((l) => l.code === lng) ?? SUPPORTED_LANGS[1];
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.dir;
}
applyDir(i18n.language || "en");
i18n.on("languageChanged", applyDir);

export default i18n;