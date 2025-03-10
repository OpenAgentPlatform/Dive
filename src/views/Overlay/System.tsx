import { useAtom } from "jotai"
import { useTranslation } from "react-i18next"
import Select from "../../components/Select"
import { closeOverlayAtom } from "../../atoms/layerState"
import React, { useState, useEffect } from "react"
import ThemeSwitch from "../../components/ThemeSwitch"

const System = () => {
  const { t, i18n } = useTranslation()
  const [, closeOverlay] = useAtom(closeOverlayAtom)
  const [language, setLanguage] = useState(i18n.language)

  const languageOptions = [
    { label: "繁體中文", value: "zh-TW" },
    { label: "简体中文", value: "zh-CN" },
    { label: "English", value: "en" },
  ]

  const onClose = () => {
    closeOverlay("System")
  }

  const handleLanguageChange = async (value: string) => {
    setLanguage(value)
    await i18n.changeLanguage(value)
    setDefaultInstructions()
  }

  const setDefaultInstructions = async () => {
    try {
      const response = await fetch("/api/config/customrules")
      const data = await response.json()
      if (data.success && data.rules === "") {
        const response = await fetch("/api/config/customrules", {
          method: "POST",
          body: t("system.defaultInstructions")
        })
      }
    } catch (error) {
      console.error("Failed to fetch custom rules:", error)
    }
  }

  return (
    <div className="system-page overlay-page">
      <button
        className="close-btn"
        onClick={onClose}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div className="system-container">
        <div className="system-header">
          <div>
            <h1>{t("system.title")}</h1>
          </div>
        </div>
        <div className="system-content">
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.language")}：</span>
            </div>
            <div className="system-list-switch-container">
              <Select
                options={languageOptions}
                value={language}
                onSelect={(value) => handleLanguageChange(value)}
                align="end"
              />
            </div>
          </div>
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.theme")}：</span>
            </div>
            <div className="system-list-switch-container">
              <ThemeSwitch />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(System)