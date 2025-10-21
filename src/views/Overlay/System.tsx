import { useAtom, useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import Select from "../../components/Select"
import { openOverlayAtom } from "../../atoms/layerState"
import React, { useState, useEffect } from "react"

import ThemeSwitch from "../../components/ThemeSwitch"
import Switch from "../../components/Switch"
import { getAutoDownload, setAutoDownload as _setAutoDownload } from "../../updater"
import { disableDiveSystemPromptAtom, updateDisableDiveSystemPromptAtom } from "../../atoms/configState"
import { getIPCAutoLaunch, getIPCMinimalToTray, setIPCAutoLaunch, setIPCMinimalToTray } from "../../ipc/system"
import { commonFlashAtom } from "../../atoms/globalState"
import "../../styles/overlay/_System.scss"
import Button from "../../components/Button"

const System = () => {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState(i18n.language)
  const [autoDownload, setAutoDownload] = useState(false)
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [minimalToTray, setMinimalToTray] = useState(false)
  const disableDiveSystemPrompt = useAtomValue(disableDiveSystemPromptAtom)
  const [, updateDisableDiveSystemPrompt] = useAtom(updateDisableDiveSystemPromptAtom)
  const [, openOverlay] = useAtom(openOverlayAtom)
  const [, setCommonFlash] = useAtom(commonFlashAtom)

  useEffect(() => {
    getIPCAutoLaunch().then(setAutoLaunch)
    getIPCMinimalToTray().then(setMinimalToTray)
  }, [])

  const handleAutoLaunchChange = (value: boolean) => {
    setAutoLaunch(value)
    setIPCAutoLaunch(value)
  }

  const languageOptions = [
    { label: t("system.languageDefault"), value: "default" },
    { label: "繁體中文", value: "zh-TW" },
    { label: "简体中文", value: "zh-CN" },
    { label: "English", value: "en" },
    { label: "Español", value: "es" },
    { label: "日本語", value: "ja" },
    { label: "한국어", value: "ko" },
    { label: "Français", value: "fr" },
    { label: "Deutsch", value: "de" },
    { label: "Polski", value: "pl" },
    { label: "Suomi", value: "fi" },
    { label: "Svenska", value: "sv" },
    { label: "Norsk", value: "no" },
    { label: "Italiano", value: "it" },
    { label: "Türkçe", value: "tr" },
    { label: "Русский", value: "ru" },
    { label: "Українська", value: "uk" },
    { label: "Bahasa Indonesia", value: "id" },
    { label: "ภาษาไทย", value: "th" },
    { label: "Tiếng Việt", value: "vi" },
    { label: "ພາສາລາວ", value: "lo" },
    { label: "Filipino", value: "fil" },
    { label: "Português", value: "pt" },
  ]

  useEffect(() => {
    setAutoDownload(getAutoDownload())
  }, [])

  const handleLanguageChange = async (value: string) => {
    setLanguage(value)
    await i18n.changeLanguage(value === "default" ? navigator.language : value)
  }

  const handleMinimalToTrayChange = (value: boolean) => {
    setMinimalToTray(value)
    setIPCMinimalToTray(value)
  }

  const handleDefaultSystemPromptChange = async (value: boolean) => {
    await updateDisableDiveSystemPrompt({ value })
  }

  const openPromtSetting = () => {
    openOverlay({ page: "Setting", tab: "Model" })
    setCommonFlash("openPromtSetting")
  }

  return (
    <div className="system-page">
      <div className="system-container">
        <div className="system-header">
          <div className="system-title-container">
            <div>{t("system.title")}</div>
          </div>
        </div>
        <div className="system-content">

          {/* theme */}
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.theme")}</span>
              <div className="system-list-switch-container">
                <ThemeSwitch />
              </div>
            </div>
            <span className="system-list-description">{t("system.themeDescription")}</span>
          </div>

          {/* minimal to tray */}
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.minimalToTray")}</span>
              <div className="system-list-switch-container">
                <Switch
                  checked={minimalToTray}
                  onChange={e => handleMinimalToTrayChange(e.target.checked)}
                />
              </div>
            </div>
            <span className="system-list-description">{t("system.minimalToTrayDescription")}</span>
          </div>

          {/* auto launch */}
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.autoLaunch")}</span>
              <div className="system-list-switch-container">
                <Switch
                  checked={autoLaunch}
                  onChange={e => handleAutoLaunchChange(e.target.checked)}
                />
              </div>
            </div>
            <span className="system-list-description">{t("system.autoLaunchDescription")}</span>
          </div>

          {/* auto download */}
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.autoDownload")}</span>
              <div className="system-list-switch-container">
                <Switch
                  checked={autoDownload}
                  onChange={(e) => {
                    setAutoDownload(e.target.checked)
                    _setAutoDownload(e.target.checked)
                  }}
                />
              </div>
            </div>
            <span className="system-list-description">{t("system.autoDownloadDescription")}</span>
          </div>

          {/* language */}
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.language")}</span>
              <div className="system-list-switch-container">
                <Select
                  options={languageOptions}
                  value={language}
                  onSelect={(value) => handleLanguageChange(value)}
                  align="end"
                />
              </div>
            </div>
            <span className="system-list-description">{t("system.languageDescription")}</span>
          </div>

          {/* default System Prompt */}
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.defaultSystemPrompt")}</span>
              <div className="system-list-switch-container">
                <Switch
                  checked={!disableDiveSystemPrompt}
                  onChange={e => handleDefaultSystemPromptChange(!e.target.checked)}
                />
              </div>
            </div>
            <span className="system-list-description">{t("system.defaultSystemPromptDescription")}</span>
            <div className="custom-prompt-container">
              <span className="custom-prompt-description">{t("system.customPromptDescription")}</span>
              <Button
                theme="Outline"
                color="primary"
                size="large"
                onClick={openPromtSetting}
              >
                {t("system.customPromptButton")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(System)
