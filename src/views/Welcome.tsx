import React, { useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useSetAtom, useAtomValue } from "jotai"
import { codeStreamingAtom } from "../atoms/codeStreaming"
import { useTranslation } from "react-i18next"
import { historiesAtom, loadHistoriesAtom } from "../atoms/historyState"
import ChatInput from "../components/ChatInput"
import Login from "./Login"
import { isLoggedInOAPAtom } from "../atoms/oapState"
import { modelGroupsAtom } from "../atoms/modelState"
import "../styles/pages/_Welcome.scss"

const Welcome = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const updateStreamingCode = useSetAtom(codeStreamingAtom)
  const histories = useAtomValue(historiesAtom)
  const loadHistories = useSetAtom(loadHistoriesAtom)
  const isInitialized = useMemo(() => localStorage.getItem("isInitialized") === "true", [])
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const modelGroups = useAtomValue(modelGroupsAtom)

  useEffect(() => {
    document.title = t("header.title")
  }, [])

  useEffect(() => {
    updateStreamingCode(null)
  }, [updateStreamingCode])

  useEffect(() => {
    loadHistories()
  }, [loadHistories])

  if (!isInitialized && !isLoggedInOAP && modelGroups.length === 0) {
    return <Login />
  }

  return (
    <div className="main-container">
      <div className="welcome-content">
        <h1>{t("welcome.title")}</h1>
        <p className="subtitle">{t("welcome.subtitle")}</p>

        <ChatInput
          page="welcome"
          onSendMessage={() => {}}
          disabled={false}
          onAbort={() => {}}
        />

        <div className="suggestions">
          {histories.normal.length > 0 && histories.normal.slice(0, 3).map(history => (
            <div
              key={history.id}
              className="suggestion-item"
              onClick={() => navigate(`/chat/${history.id}`)}
            >
              <div className="content-wrapper">
                <strong>{history.title || t("chat.untitledChat")}</strong>
              </div>
              <div className="bottom-row">
                <p>{new Date(history.createdAt).toLocaleString()}</p>
                <span className="arrow">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default React.memo(Welcome)
