import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import Backend from "i18next-http-backend"

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: window.ipcRenderer && await window.ipcRenderer.getResourcesPath("locales/{{lng}}/{{ns}}.json"),
    },
    fallbackLng: "en",
    supportedLngs: ["zh-TW", "zh-CN", "en", "es", "ja"],
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
