import "katex/dist/katex.min.css"

import React, { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { codeStreamingAtom } from "../../atoms/codeStreaming"
import ToolPanel from "./ToolPanel"
import FilePreview from "./FilePreview"
import { useTranslation } from "react-i18next"
import { themeAtom } from "../../atoms/themeState"
import Textarea from "../../components/WrappedTextarea"
import { isChatStreamingAtom } from "../../atoms/chatState"
import Zoom from "../../components/Zoom"
import { convertLocalFileSrc } from "../../ipc/util"
import Button from "../../components/Button"
import { useLocation } from "react-router-dom"
import Tooltip from "../../components/Tooltip"
import VideoPlayer from "../../components/VideoPlayer"
import TokenUsagePopup, { ResourceUsage } from "./TokenUsagePopup"

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "tool-call": {
        children: any
        name: string
        toolkey: string
      };
      "think": {
        children: any
      };
      "none": {
        children: any
      }
      "thread-query-error": {
        children: any
      }
      "rate-limit-exceeded": {
        children: any
      }
      "system-tool-call": {
        children: any
        name: string
      }
    }
  }
}

interface MessageProps {
  messageId: string
  text: string
  isSent: boolean
  timestamp: number
  files?: (File | string)[]
  isError?: boolean
  isLoading?: boolean
  isRateLimitExceeded?: boolean
  resourceUsage?: ResourceUsage
  onRetry: () => void
  onEdit: (editedText: string) => void
}

const Message = ({ messageId, text, isSent, files, isError, isLoading, isRateLimitExceeded, onRetry, onEdit, resourceUsage }: MessageProps) => {
  const { t } = useTranslation()
  const [theme] = useAtom(themeAtom)
  const updateStreamingCode = useSetAtom(codeStreamingAtom)
  const cacheCode = useRef<string>("")
  const [isCopied, setIsCopied] = useState<Record<string, NodeJS.Timeout>>({})
  const [isCopiedLink, setIsCopiedLink] = useState<Record<string, NodeJS.Timeout>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(text)
  const [editedText, setEditedText] = useState(text)
  const isChatStreaming = useAtomValue(isChatStreamingAtom)
  const [openToolPanels, setOpenToolPanels] = useState<Record<string, boolean>>({})
  const [showTokensPopup, setShowTokensPopup] = useState(false)
  const messageContentRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  useEffect(() => {
    setIsEditing(false)
    setIsCopied({})
    setIsCopiedLink({})
  }, [location])

  useEffect(() => {
    setContent(text)
  }, [messageId])

  useEffect(() => {
    if (!messageContentRef.current) {
      return
    }

    const wrappers = messageContentRef.current.querySelectorAll(".copy-link-button-wrapper")
    wrappers.forEach((wrapper) => {
      const linkWrapper = wrapper.closest(".markdown-link-wrapper")
      if (!linkWrapper) {
        return
      }

      const linkId = linkWrapper.getAttribute("data-link-id")
      const isCopied = linkId && isCopiedLink[linkId]

      if (isCopied) {
        wrapper.classList.add("show")
        wrapper.setAttribute("data-copied", "true")
      } else {
        wrapper.classList.remove("show")
        wrapper.setAttribute("data-copied", "false")
      }
    })
  }, [isCopiedLink])

  useEffect(() => {
    if (!messageContentRef.current) {
      return
    }

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains("markdown-link-wrapper")) {
        const wrapper = target.querySelector(".copy-link-button-wrapper")
        if (wrapper) {
          wrapper.classList.remove("show")
        }
      }
    }

    const container = messageContentRef.current
    container.addEventListener("mouseleave", handleMouseLeave, true)

    return () => {
      container.removeEventListener("mouseleave", handleMouseLeave, true)
    }
  }, [])

  const onCopy = (messageId: string, text: string) => {
    const _text = text.replace(/<tool-call[\s\S]*?<\/tool-call>/g, "")
                      .replace(/<thinking>/g, "")
                      .replace(/<\/thinking>/g, "")
    copyToClipboard(_text)
    clearTimeout(isCopied[messageId])
    const timeout = setTimeout(() => {
      setIsCopied(prev => {
        const newState = { ...prev }
        delete newState[messageId]
        return newState
      })
    }, 3000)
    setIsCopied({ [messageId]: timeout })
  }

  const onCopyLink = (linkId: string, url: string) => {
    copyToClipboard(url)
    clearTimeout(isCopiedLink[linkId])
    const timeout = setTimeout(() => {
      setIsCopiedLink(prev => {
        const newState = { ...prev }
        delete newState[linkId]
        return newState
      })
    }, 2000)
    setIsCopiedLink(prev => ({ ...prev, [linkId]: timeout }))
  }

  const handleEdit = () => {
    setEditedText(content)
    setIsEditing(true)
  }

  const editText = useMemo(() => {
    const onCancel = () => {
      setIsEditing(false)
    }

    const onSave = async () => {
      setContent(editedText)
      setIsEditing(false)
      onEdit(editedText)
    }

    return (
      <div className="edit-text">
        <Textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
        />
        <div className="edit-text-footer">
          <div className="edit-text-footer-left">
            <span>{t("chat.editDescription")}</span>
          </div>
          <div className="edit-text-footer-right">
            <Button
              theme="ColorShadows"
              color="neutral"
              size="medium"
              onClick={onCancel}
            >
              {t("chat.cancel")}
            </Button>
            <Button
              theme="ColorShadows"
              color="primary"
              size="medium"
              onClick={onSave}
              disabled={editedText === ""}
            >
              {t("chat.save")}
            </Button>
          </div>
        </div>
      </div>
    )
  }, [editedText])

  const formattedText = useMemo(() => {
    const _text = isSent ? content : text
    if (isSent) {
      const splitText = _text.split("\n")
      return splitText.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < splitText.length - 1 && <br />}
        </React.Fragment>
      ))
    }

    return (
      <ReactMarkdown
        remarkPlugins={[[remarkMath, {
          singleDollarTextMath: false,
          inlineMathDouble: false
        }], remarkGfm]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        remarkRehypeOptions={{
          allowDangerousHtml: true
        }}
        components={{
          p({ children, node }) {
            // Check if children contain block-level custom elements or media elements
            const hasBlockElement = node?.children?.some((child: any) =>
              child.type === "element" &&
              ["think", "tool-call", "thread-query-error", "video", "audio", "img", "system-tool-call"].includes(child.tagName)
            )
            // If contains block elements, render as fragment to avoid p > div nesting
            if (hasBlockElement) {
              return <>{children}</>
            }
            return <p>{children}</p>
          },
          think({ children }) {
            return <div className="think">{children}</div>
          },
          none() {
            return null
          },
          "thread-query-error"({ children }) {
            return (
              <details>
                <summary style={{ color: "var(--text-invert)", cursor: "pointer" }}>Error occurred click to show details:</summary>
                <div style={{ maxHeight: "100px", overflow: "auto" }}>
                  {children}
                </div>
              </details>
            )
          },
          "tool-call"({children, name, toolkey}) {
            let content = children
            if (typeof children !== "string") {
              if (!Array.isArray(children) || children.length === 0 || typeof children[0] !== "string") {
                return <></>
              }

              content = children[0]
            }

            const isOpen = openToolPanels[toolkey] || false

            return (
              <ToolPanel
                key={toolkey}
                content={content}
                name={name}
                isOpen={isOpen}
                onToggle={(open) => {
                  setOpenToolPanels(prev => ({
                    ...prev,
                    [toolkey]: open
                  }))
                }}
              />
            )
          },
          a(props) {
            if(props.children?.toString().toLowerCase().includes("audio")) {
              if (isChatStreaming) {
                return <></>
              }

              return <audio src={props.href} controls />
            }

            if(props.children?.toString().toLowerCase().includes("video") || props.children?.toString().toLowerCase().includes("影片")) {
              if (isChatStreaming) {
                return <></>
              }


              if (props.href) {
                return <VideoPlayer className="message-video" src={props.href} />
              }
              return <video className="message-video" src={props.href} controls />
            }

            const linkId = `link-${props.href}`

            return (
              <span
                className="markdown-link-wrapper"
                data-link-id={linkId}
              >
                <a href={props.href} target="_blank" rel="noreferrer">
                  {props.children}
                  <div className="copy-link-button-wrapper" data-copied="false">
                    <Button
                      theme="TextOnly"
                      color="neutral"
                      size="small"
                      noFocus
                      svgFill="none"
                      className="copy-link-button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onCopyLink(linkId, props.href || "")
                      }}
                    >
                      <Tooltip content={t("chat.copyLinkUrl")} side="top">
                        <div className="icon-wrapper icon-link-wrapper">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 22 22" fill="transparent">
                            <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                            <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                            <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </Tooltip>
                      <Tooltip content={t("chat.copied")} side="top">
                        <div className="icon-wrapper icon-check-wrapper">
                          <svg className="icon-check" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 22 22" fill="transparent">
                            <path d="M4.6709 10.4241L9.04395 15.1721L17.522 7.49414" stroke="currentColor" fill="transparent" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </Tooltip>
                    </Button>
                  </div>
                </a>
              </span>
            )
          },
          img({className, src}) {
            let imageSrc = src
            if (src?.startsWith("https://localfile")) {
              let path = src.replace("https://localfile", "").replace(/\\/g, "/")
              if (path === decodeURI(path)) {
                path = encodeURI(path)
              }

              imageSrc = convertLocalFileSrc(path)
            }

            return <Zoom allowCopy allowDownload><img src={imageSrc} className={className} /></Zoom>
          },
          video({className, src, controls}) {
            const videoSrc = src
            if (src?.startsWith("https://localfile")) {
              let path = src.replace("https://localfile", "").replace(/\\/g, "/")
              if (path === decodeURI(path)) {
                path = encodeURI(path)
              }
            }

            if (videoSrc) {
              return <VideoPlayer className="message-video" src={videoSrc} />
            }

            return <video
              className={`${className} message-video`}
              src={videoSrc}
              controls={controls}
            />
          },
          audio({className, src, controls}) {
            let audioSrc = src
            if (src?.startsWith("https://localfile")) {
              let path = src.replace("https://localfile", "").replace(/\\/g, "/")
              if (path === decodeURI(path)) {
                path = encodeURI(path)
              }

              audioSrc = convertLocalFileSrc(path)
            }

            return (
              <div className="audio-container">
                <audio
                  src={audioSrc}
                  controls={controls}
                  className={className}
                />
              </div>
            )
          },
          table({children}) {
            return <table className="message-table">{children}</table>
          },
          code({node, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || "")
            const language = match ? match[1] : ""
            let code = String(children).replace(/\n$/, "")

            const inline = node?.position?.start.line === node?.position?.end.line
            if (inline) {
              return <code className={`${className} inline-code`} {...props}>{children}</code>
            }

            const lines = code.split("\n")
            const isLongCode = lines.length > 10

            if (isLongCode) {
              const cleanText = _text.replace(/[\s\S\n]+(?=```)/gm, "")
              const isBlockComplete = cleanText.includes(code.trim() + "```")
              code = code.endsWith("``") ? code.slice(0, -2) : code
              code = code.endsWith("`") ? code.slice(0, -1) : code
              const handleClick = () => {
                updateStreamingCode({ code, language })
              }

              const diffLength = Math.abs(code.length - cacheCode.current.length)
              if ((!isBlockComplete && isLoading) || (diffLength < 10 && cacheCode.current !== code)) {
                cacheCode.current = code
                if(isChatStreaming) {
                  console.log("updateStreamingCode", code, language)
                  updateStreamingCode({ code, language })
                }
              }

              return (
                <button
                  className="code-block-button"
                  onClick={handleClick}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                  </svg>
                  <span>{t("chat.previewCode")}</span>
                </button>
              )
            }

            return (
              <div className="code-block">
                <div className="code-header">
                  <span className="language">{language}</span>
                  <Button
                    theme="Color"
                    color="primary"
                    size="small"
                    onClick={() => copyToClipboard(code)}
                  >
                    {t("chat.copyCode")}
                  </Button>
                </div>
                <SyntaxHighlighter
                  language={language.toLowerCase()}
                  style={theme === "dark" ? tomorrow : oneLight}
                  codeTagProps={{
                    style: {
                      background: "none"
                    }
                  }}
                  customStyle={{
                    margin: 0,
                    padding: "12px",
                    background: "none"
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            )
          },
          "rate-limit-exceeded"() {
            return (
              <div className="rate-limit-exceeded-wrapper">
                <svg className="rate-limit-exceeded-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.54 18.65 1.53 19.01C1.52 19.37 1.6 19.72 1.77 20.03C1.94 20.34 2.19 20.6 2.49 20.79C2.79 20.98 3.14 21.09 3.5 21.1H20.5C20.86 21.09 21.21 20.98 21.51 20.79C21.81 20.6 22.06 20.34 22.23 20.03C22.4 19.72 22.48 19.37 22.47 19.01C22.46 18.65 22.36 18.3 22.18 18L13.71 3.86C13.52 3.56 13.26 3.31 12.95 3.14C12.64 2.97 12.3 2.88 11.95 2.88C11.6 2.88 11.26 2.97 10.95 3.14C10.64 3.31 10.38 3.56 10.18 3.86H10.29Z" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="rate-limit-exceeded-content">
                  <div className="rate-limit-exceeded-title">
                    {t("chat.rateLimitExceededTitle")}
                  </div>
                  <div className="rate-limit-exceeded-description">
                    {t("chat.rateLimitExceededDescription")}
                  </div>
                </div>
              </div>
            )
          },
          "system-tool-call"({ name }) {
            return (
              <div className="system-tool-call">
                <div className="system-tool-call-spinner" />
                <span className="system-tool-call-name">{name}</span>
              </div>
            )
          },
        }}
      >
        {
        _text
          .replaceAll("file://", "https://localfile")
          .replaceAll("</think>\n\n", "\n\n</think>\n\n")
          // prompt tool call from host
          .replaceAll("<tool_call>", "<none>")
          .replaceAll("</tool_call>", "</none>")
          // Fix code block closing followed by text without newline (e.g., ```xxx)
          // Use (?!\w) to avoid breaking ```language patterns for consecutive code blocks
          .replace(/```(\w*)\n((?:(?!```)[^])*?)```(?!\w)([^\n`])/g, "```$1\n$2```\n$3")
        }
      </ReactMarkdown>
    )
  }, [content, text, isSent, isLoading, openToolPanels])

  if (isEditing) {
    return (
      <div className="message-container">
        <div className="message sent edit">
          {editText}
        </div>
      </div>
    )
  }

  return (
    <div className="message-container">
      <div ref={messageContentRef} className={`message ${isSent ? "sent" : "received"} ${isError ? "error" : ""} ${isRateLimitExceeded ? "rate-limit-exceeded" : ""}`}>
        {formattedText}
        {files && files.length > 0 && <FilePreview files={typeof files === "string" ? JSON.parse(files) : files} />}
        {isLoading && (
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        {!isRateLimitExceeded && (
          <div className="message-tools">
            {!isLoading && (
              <Button
                className="message-tools-hide"
                theme="TextOnly"
                color="neutral"
                size="small"
                noFocus
                onClick={() => onCopy(messageId, isSent ? content : text)}
              >
                {isCopied[messageId] ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                      <path d="M4.6709 10.4241L9.04395 15.1721L17.522 7.49414" stroke="currentColor" fill="transparent" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t("chat.copied")}</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                      <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                      <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                      <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t("chat.copy")}</span>
                  </>
                )}
              </Button>
            )}
            {!isLoading && !isChatStreaming && (
              isSent ?
                <>
                  <Button
                    className="message-tools-hide"
                    theme="TextOnly"
                    color="neutral"
                    size="small"
                    noFocus
                    onClick={handleEdit}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="18px" viewBox="0 0 25 22" fill="none">
                      <path d="M3.38184 13.6686V19.0001H21.4201" fill="transparent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3.38178 13.5986L14.1186 4.12082C15.7828 2.65181 18.4809 2.65181 20.1451 4.12082V4.12082C21.8092 5.58983 21.8092 7.97157 20.1451 9.44059L9.40824 18.9183" fill="transparent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t("chat.edit")}</span>
                  </Button>
                </>
                :
                <>
                  {messageId.includes("-") && (  //if messageId doesn't contain "-" then it's aborted before ready then it can't retry
                    <Button
                      className="message-tools-hide"
                      theme="TextOnly"
                      color="neutral"
                      size="small"
                      onClick={onRetry}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="transparent" height="15px" width="15px" viewBox="0 0 489.698 489.698">
                        <g>
                          <g>
                            <path d="M468.999,227.774c-11.4,0-20.8,8.3-20.8,19.8c-1,74.9-44.2,142.6-110.3,178.9c-99.6,54.7-216,5.6-260.6-61l62.9,13.1    c10.4,2.1,21.8-4.2,23.9-15.6c2.1-10.4-4.2-21.8-15.6-23.9l-123.7-26c-7.2-1.7-26.1,3.5-23.9,22.9l15.6,124.8    c1,10.4,9.4,17.7,19.8,17.7c15.5,0,21.8-11.4,20.8-22.9l-7.3-60.9c101.1,121.3,229.4,104.4,306.8,69.3    c80.1-42.7,131.1-124.8,132.1-215.4C488.799,237.174,480.399,227.774,468.999,227.774z"/>
                            <path d="M20.599,261.874c11.4,0,20.8-8.3,20.8-19.8c1-74.9,44.2-142.6,110.3-178.9c99.6-54.7,216-5.6,260.6,61l-62.9-13.1    c-10.4-2.1-21.8,4.2-23.9,15.6c-2.1,10.4,4.2,21.8,15.6,23.9l123.8,26c7.2,1.7,26.1-3.5,23.9-22.9l-15.6-124.8    c-1-10.4-9.4-17.7-19.8-17.7c-15.5,0-21.8,11.4-20.8,22.9l7.2,60.9c-101.1-121.2-229.4-104.4-306.8-69.2    c-80.1,42.6-131.1,124.8-132.2,215.3C0.799,252.574,9.199,261.874,20.599,261.874z"/>
                          </g>
                        </g>
                      </svg>
                      <span>{t("chat.retry")}</span>
                    </Button>
                  )}
                </>
              )
            }
            {!isError && !isLoading && !isSent && (
              <Button
                className="message-tokens-button message-tools-hide"
                theme="TextOnly"
                color="neutral"
                size="small"
                noFocus
                onClick={() => setShowTokensPopup(true)}
              >
                <div className="message-tokens">
                  <div className="message-tokens-main">
                    Tokens
                  </div>
                  <div className="message-tokens-detail">
                    ↑ {resourceUsage?.total_input_tokens ?? 0} ↓ {resourceUsage?.total_output_tokens ?? 0}
                  </div>
                </div>
              </Button>
            )}
          </div>
        )}
      </div>
      {showTokensPopup && !isError && (
        <TokenUsagePopup
          resourceUsage={resourceUsage}
          onClose={() => setShowTokensPopup(false)}
        />
      )}
    </div>
  )
}

export default React.memo(Message)
