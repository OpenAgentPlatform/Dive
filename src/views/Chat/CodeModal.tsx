import React, { useRef, useEffect, useCallback, useState } from "react"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow, darcula } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { themeAtom } from '../../atoms/themeState'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { codeStreamingAtom, updateStreamingCodeAtom } from '../../atoms/codeStreaming'
import { useTranslation } from "react-i18next"
import CodePreview from "./CodePreview"

type TabType = "code" | "preview"

const supportedPreviewLanguage = [
  "mermaid",
  "html",
  "svg",
  "xml",
]

const CodeModal = () => {
  const [theme] = useAtom(themeAtom)
  const codeModalRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>("code")

  const { streamingCode } = useAtomValue(codeStreamingAtom)
  const code = streamingCode?.code || ""
  const updateStreamingCode = useSetAtom(updateStreamingCodeAtom)

  const scrollCodeToBottom = useCallback(() => {
    if (codeModalRef.current) {
      const pre = codeModalRef.current.querySelector("pre")
      if (pre) {
        pre.scrollTop = pre.scrollHeight
      }
    }
  }, [])

  useEffect(() => {
    scrollCodeToBottom()
    setActiveTab("code")
  }, [streamingCode])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  if (!streamingCode || !streamingCode.code)
    return null

  return (
    <div className="code-modal">
      <div className="code-modal-content">
        <div className="code-modal-header">
          <span className="language">{streamingCode?.language}</span>
          <div className="header-right">
            {supportedPreviewLanguage.includes(streamingCode?.language || "") && (
              <div className="code-modal-tabs">
                <button 
                  className={`tab-btn ${activeTab === "code" ? "active" : ""}`}
                  onClick={() => setActiveTab("code")}
                >
                  Code
                </button>
                <button 
                  className={`tab-btn ${activeTab === "preview" ? "active" : ""}`}
                  onClick={() => setActiveTab("preview")}
                >
                  Preview
                </button>
              </div>
            )}
            <button 
              className="close-btn"
              onClick={() => updateStreamingCode({ code: "", language: "" })}
            >
              ×
            </button>
          </div>
        </div>
        <div className="code-modal-body" ref={codeModalRef}>
          {activeTab === "code" && (
            <SyntaxHighlighter
              language={streamingCode?.language.toLowerCase() || ""}
              style={theme === "dark" ? tomorrow : darcula}
              showLineNumbers={true}
              customStyle={{
                margin: 0,
                height: '100%',
                background: 'transparent'
              }}
              codeTagProps={{
                style: {
                  fontSize: '14px',
                  lineHeight: '1.5'
                }
              }}
            >
              {code}
            </SyntaxHighlighter>
          )}
          {activeTab === "preview" && (
            <CodePreview language={streamingCode?.language || ""} code={code} />
          )}
        </div>
        <div className="code-modal-footer">
          <button 
            className="copy-btn"
            onClick={() => copyToClipboard(code)}
          >
            {t("chat.copyCode")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default React.memo(CodeModal) 