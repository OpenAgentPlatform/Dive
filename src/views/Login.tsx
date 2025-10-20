import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"
import "@/styles/pages/_Login.scss"
import { useAtomValue } from "jotai"
import { useNavigate } from "react-router-dom"
import { isLoggedInOAPAtom } from "../atoms/oapState"
import { openOapLoginPage } from "../ipc/oap"
import Button from "../components/Button"

const Login = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)

  useEffect(() => {
    if (isLoggedInOAP) {
      setIsInitialized(true)
    }
  }, [isLoggedInOAP])

  const setIsInitialized = (value: boolean) => {
    localStorage.setItem("isInitialized", value ? "true" : "false")
  }

  return (
    <div className="login-page-container">
      <div className="header">
        <h1 className="main-title">Start Your Dive AI</h1>
        <p className="subtitle">
          {t("login.subtitle")}
        </p>
      </div>

      <div className="options-container">
        <div className="option-card">
          <h2 className="option-title">{t("login.title1")}</h2>
          <p className="option-description">
            {t("login.description1")}
          </p>
          <div className="button-container">
            <Button
              theme="Color"
              color="primary"
              size="large"
              onClick={() => {
                navigate("/setup")
                setIsInitialized(true)
              }}
            >{t("login.button1")}</Button>
          </div>
        </div>

        <div className="option-gap"></div>

        <div className="option-card">
          <h2 className="option-title">{t("login.title2")}</h2>
          <p className="option-description">
            {t("login.description2")}
          </p>
          <div className="button-container">
            <Button
              theme="Color"
              color="primary"
              size="large"
              onClick={() => openOapLoginPage(false)}
            >{t("login.button2")}</Button>
            <Button
              theme="Color"
              color="primary"
              size="large"
              onClick={() => openOapLoginPage(false)}
            >{t("login.button3")}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(Login)
