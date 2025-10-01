import React, { useState } from "react"
import { useSetAtom } from "jotai"
import { defaultInterface } from "../../atoms/interfaceState"
import { useTranslation } from "react-i18next"
import { useNavigate, useLocation } from "react-router-dom"
import ModelConfigForm from "./ModelConfigForm"
import { showToastAtom } from "../../atoms/toastState"
import { ModelProvider } from "../../../types/model"
import "../../styles/components/_Setup.scss"
import Button from "../../components/Button"

const Setup = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isInitialSetup = location.pathname !== "/setup"
  const [localProvider, setLocalProvider] = useState<ModelProvider>("openai")
  const showToast = useSetAtom(showToastAtom)

  const handleSubmit = async (data: any) => {
    try {
      if (data.success) {
        showToast({
          message: t("setup.saveSuccess"),
          type: "success"
        })
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      showToast({
        message: t("setup.saveFailed"),
        type: "error"
      })
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-container">
        {!isInitialSetup && (
          <Button
            theme="TextOnly"
            color="neutral"
            size="medium"
            svgFill="currentColor"
            className="back-btn"
            onClick={() => navigate(-1)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            {t("setup.back")}
          </Button>
        ) || (
          <>
            <h1>{t("setup.title")}</h1>
            <p className="subtitle">{t("setup.subtitle")}</p>
          </>
        )}

        <ModelConfigForm
          provider={localProvider}
          fields={defaultInterface[localProvider]}
          onSubmit={handleSubmit}
          onProviderChange={setLocalProvider}
          submitLabel="setup.submit"
        />
      </div>
    </div>
  )
}

export default React.memo(Setup)