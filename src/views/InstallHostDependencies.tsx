import "../styles/pages/_InstallHostDependencies.scss"

import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { systemThemeAtom, themeAtom } from "../atoms/themeState"
import { useAtom } from "jotai"
import { onReceiveDownloadDependencyLog, startReceiveDownloadDependencyLog } from "../ipc"

type Log = {
  timestamp: string
  message: string
}

type Props = {
  onFinish: () => void
  onUpdate: (log: string) => void
}

const InstallHostDependencies = ({ onFinish, onUpdate }: Props) => {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<Log[]>([])
  const [theme] = useAtom(themeAtom)
  const [systemTheme] = useAtom(systemThemeAtom)
  const logsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unlisten = onReceiveDownloadDependencyLog((log) => {
      if (log === "finish") {
        setLogs(prevLogs => {
          return [
            ...prevLogs,
            {
              timestamp: new Date().toLocaleString(),
              message: "install host dependencies finished, wait for mcp host to start...",
            },
          ]
        })

        return onFinish()
      }

      onUpdate(log)
      setLogs(prevLogs => {
        const newLogs = [...prevLogs, { timestamp: new Date().toLocaleString(), message: log }]
        if (newLogs.length > 100) {
          return newLogs.slice(newLogs.length - 100)
        }
        return newLogs
      })

        setTimeout(() => {
          if (logsRef.current) {
            logsRef.current.scrollTop = logsRef.current.scrollHeight
          }
        }, 100)
    })

    startReceiveDownloadDependencyLog()
    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  return (
    <div className="downloading-container" data-theme={theme === "system" ? systemTheme : theme}>
      <div className="downloading-content">
        <h1 className="downloading-title">
          <div className="spinner">
          </div>
          {t("InstallHostDependencies.title")}
        </h1>

        <div className="downloading-log" ref={logsRef}>
          {logs.map((log) => (
            <div key={log.timestamp} className="downloading-log-item">
              <span className="downloading-log-item-timestamp">
                [<span className="downloading-log-item-timestamp-time">{log.timestamp}</span>]
              </span>
              <span className="downloading-log-item-message">
                {log.message}
              </span>
            </div>
          ))}
        </div>

        <div className="button-container">
          {t("InstallHostDependencies.tip")}
        </div>
      </div>
    </div>
  )
}

export default React.memo(InstallHostDependencies)
