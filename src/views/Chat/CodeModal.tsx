import React, { useRef, useEffect, useCallback, useState } from "react"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow, darcula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { themeAtom } from "../../atoms/themeState"
import { useAtom, useAtomValue } from "jotai"
import { codeStreamingAtom } from "../../atoms/codeStreaming"
import { useTranslation } from "react-i18next"
import CodePreview from "./CodePreview"
import { useLayer } from "../../hooks/useLayer"
import { isChatStreamingAtom } from "../../atoms/chatState"
import Tooltip from "../../components/Tooltip"
import { sidebarVisibleAtom } from "../../atoms/sidebarState"

type TabType = "code" | "preview"

const supportedPreviewLanguage = [
  "mermaid",
  "html",
  "svg",
  "xml",
]

const CodeModal = () => {
  const theme = useAtomValue(themeAtom)
  const codeModalRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>("code")
  const isChatStreaming = useAtomValue(isChatStreamingAtom)
  const [hasScrolledUp, setHasScrolledUp] = useState(false)

  const [streamingCode, updateStreamingCode] = useAtom(codeStreamingAtom)
  const code = streamingCode?.code || ""

  const { pushLayer, closeLayer } = useLayer({
    type: "Surface",
    onClose: () => {
      if (isChatStreaming) {
        return false
      }

      closeCodeModal()
    },
  })

  const scrollCodeToBottom = useCallback(() => {
    setTimeout(() => {
      if (codeModalRef.current) {
        codeModalRef.current.scrollTop = codeModalRef.current.scrollHeight
      }
    }, 0)
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 10
    setHasScrolledUp(!isAtBottom)
  }, [])

  const closeCodeModal = () => {
    updateStreamingCode({ code: "", language: "" })
    setHasScrolledUp(false)
    closeLayer()
  }

  useEffect(() => {
    if (!hasScrolledUp) {
      scrollCodeToBottom()
    }
    setActiveTab("code")
  }, [streamingCode, hasScrolledUp])


  useEffect(() => {
    if (!isChatStreaming && streamingCode?.code) {
      pushLayer()
    }
  }, [isChatStreaming, streamingCode?.code, pushLayer])

  useEffect(() => {
    if (!isChatStreaming && supportedPreviewLanguage.includes(streamingCode?.language || "")) {
      setActiveTab("preview")
    }
  }, [isChatStreaming, streamingCode?.language])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  if (!streamingCode || !streamingCode.code)
    return null

  return (
    <div className="code-modal">
      <CodeModalSizeBox />
      <div className="code-modal-content">
        <div className="code-modal-header">
          <div className="header-left">
            <Tooltip
              content={t("common.close")}
            >
              <button
                className="close-btn"
                onClick={closeCodeModal}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M14 3L6 11L14 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </Tooltip>
            <span className="language">{streamingCode?.language}</span>
          </div>
          <div className="header-right">
            {supportedPreviewLanguage.includes(streamingCode?.language || "") && (
              <>
                <div className="code-modal-tabs">
                  <Tooltip
                    content="Code"
                  >
                    <button
                      className={`tab-btn ${activeTab === "code" ? "active" : ""}`}
                      onClick={() => setActiveTab("code")}
                    >
                      <span className="tab-btn-text">Code</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M17 7L21 11L17 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M5 15L1 11L5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M13 4L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content="Preview"
                  >
                    <button
                      className={`tab-btn ${activeTab === "preview" ? "active" : ""}`}
                      onClick={() => setActiveTab("preview")}
                    >
                      <span className="tab-btn-text">Preview</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M20 11C20 11 16.4669 6 11 6C5.53313 6 2 11 2 11C2 11 5.53203 16 11 16C16.468 16 20 11 20 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                        <path d="M11 15.5C13.4853 15.5 15.5 13.4853 15.5 11C15.5 8.51472 13.4853 6.5 11 6.5C8.51472 6.5 6.5 8.51472 6.5 11C6.5 13.4853 8.51472 15.5 11 15.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                      </svg>
                      </button>
                  </Tooltip>
                </div>
              </>
            )}
            <Tooltip
              content={t("chat.copyCode")}
            >
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(code)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                  <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                  <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                  <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="code-modal-body" ref={codeModalRef} onScroll={handleScroll}>
          {activeTab === "code" && (
            <SyntaxHighlighter
              language={streamingCode?.language.toLowerCase() || ""}
              style={theme === "dark" ? tomorrow : darcula}
              showLineNumbers={true}
              customStyle={{
                margin: 0,
                height: "100%",
                background: "transparent"
              }}
              codeTagProps={{
                style: {
                  fontSize: "14px",
                  lineHeight: "1.5"
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
      </div>
    </div>
  )
}

const CodeModalSizeBox = () => {
  const [size, setSize] = useState<number>(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--code-modal-width")) || 50)
  const startSizeRef = useRef<number>(size)
  const startXRef = useRef<number>(0)
  const MAX_CODE_MODAL_WIDTH = 80
  const MIN_CODE_MODAL_WIDTH = 20
  const [isMouseDown, setIsMouseDown] = useState(false)
  const coverRef = useRef<HTMLDivElement>(null)
  const actualWidthRef = useRef<HTMLDivElement>(null)
  const isSidebarVisible = useAtomValue(sidebarVisibleAtom)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsMouseDown(true)

    startSizeRef.current = size

    if (coverRef.current) {
      const coverRect = coverRef.current.getBoundingClientRect()
      const currentActualSize = (coverRect.width / (actualWidthRef.current?.clientWidth || window.innerWidth || 1000)) * 100

      startSizeRef.current = currentActualSize
      setSize(currentActualSize)
      document.documentElement.style.setProperty("--code-modal-width", `${Math.max(Math.min(startSizeRef.current, MAX_CODE_MODAL_WIDTH), MIN_CODE_MODAL_WIDTH)}%`)
    }

    startXRef.current = e.clientX

    const handleMouseUp = () => {
      setSize(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--code-modal-width")) || 50)
      document.removeEventListener("mouseup", handleMouseUp)
      setIsMouseDown(false)
    }

    document.addEventListener("mouseup", handleMouseUp)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const newSize = startSizeRef.current - (e.clientX - startXRef.current) / (actualWidthRef.current?.clientWidth || window.innerWidth || 1000) * 100
    document.documentElement.style.setProperty("--code-modal-width", `${Math.max(Math.min(newSize, MAX_CODE_MODAL_WIDTH), MIN_CODE_MODAL_WIDTH)}%`)
  }

  return (
    <>
      <div className="code-modal-size-box"
        onMouseDown={handleMouseDown}
      >
        <div className="code-modal-size-box-icon"></div>
      </div>
      <div className={`code-modal-size-box-width ${isSidebarVisible ? "sidebar-visible" : ""}`} ref={actualWidthRef}></div>
      <div className="code-modal-size-box-cover" ref={coverRef}></div>
      <div className={`code-modal-size-box-cover-all ${isMouseDown ? "active" : ""}`}
        onMouseMove={handleMouseMove}
      ></div>
    </>
  )
}

export default React.memo(CodeModal)