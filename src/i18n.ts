import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import en from "./locales/en/translation.json"
import zhTW from "./locales/zh-TW/translation.json"
import zhCN from "./locales/zh-CN/translation.json"
import es from "./locales/es/translation.json"
import ja from "./locales/ja/translation.json"
import ko from "./locales/ko/translation.json"
import fr from "./locales/fr/translation.json"
import de from "./locales/de/translation.json"
import pl from "./locales/pl/translation.json"
import fi from "./locales/fi/translation.json"
import sv from "./locales/sv/translation.json"
import no from "./locales/no/translation.json"
import it from "./locales/it/translation.json"
import tr from "./locales/tr/translation.json"
import ru from "./locales/ru/translation.json"
import uk from "./locales/uk/translation.json"
import id from "./locales/id/translation.json"
import th from "./locales/th/translation.json"
import vi from "./locales/vi/translation.json"
import lo from "./locales/lo/translation.json"
import fil from "./locales/fil/translation.json"
import pt from "./locales/pt/translation.json"

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en
      },
      "zh-TW": {
        translation: zhTW
      },
      "zh-CN": {
        translation: zhCN
      },
      es: {
        translation: es
      },
      ja: {
        translation: ja
      },
      ko: {
        translation: ko
      },
      fr: {
        translation: fr
      },
      de: {
        translation: de
      },
      pl: {
        translation: pl
      },
      fi: {
        translation: fi
      },
      sv: {
        translation: sv
      },
      no: {
        translation: no
      },
      it: {
        translation: it
      },
      tr: {
        translation: tr
      },
      ru: {
        translation: ru
      },
      uk: {
        translation: uk
      },
      id: {
        translation: id
      },
      th: {
        translation: th
      },
      vi: {
        translation: vi
      },
      lo: {
        translation: lo
      },
      fil: {
        translation: fil
      },
      pt: {
        translation: pt
      }
    },
    fallbackLng: "en",
    supportedLngs: ["zh-TW", "zh-CN", "en", "es", "ja", "ko", "fr", "de", "pl", "fi", "sv", "no", "it", "tr", "ru", "uk", "id", "th", "vi", "lo", "fil", "pt"],
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
