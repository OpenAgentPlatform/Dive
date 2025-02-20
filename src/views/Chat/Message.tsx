import "katex/dist/katex.min.css"

import React, { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { tomorrow, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useAtom, useSetAtom } from 'jotai'
import { updateStreamingCodeAtom } from '../../atoms/codeStreaming'
import ToolPanel, { ToolCall, ToolResult } from './ToolPanel'
import FilePreview from './FilePreview'
import { useTranslation } from 'react-i18next'
import { themeAtom } from "../../atoms/themeState";

interface MessageProps {
  messageId: string
  text: string
  isSent: boolean
  timestamp: number
  files?: (File | string)[]
  isError?: boolean
  isLoading?: boolean
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  onRetry: () => void
}

const Message = ({ messageId, text, isSent, files, isError, isLoading, toolCalls, toolResults, onRetry }: MessageProps) => {
  const { t } = useTranslation()
  const [theme] = useAtom(themeAtom)
  const updateStreamingCode = useSetAtom(updateStreamingCodeAtom)
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const formattedText = useMemo(() => {
    if (isSent) {
      const splitText = text.split("\n")
      return splitText.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < splitText.length - 1 && <br />}
        </React.Fragment>
      ))
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({node, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || "")
            const language = match ? match[1] : ""
            const code = String(children).replace(/\n$/, "")

            const inline = node?.position?.start.line === node?.position?.end.line
            if (inline) {
              return <code className={`${className} inline-code`} {...props}>{children}</code>
            }

            const lines = code.split("\n")
            const isLongCode = lines.length > 10

            if (isLongCode) {
              const cleanText = text.replace(/\s+(?=```)/gm, "")
              const isBlockComplete = cleanText.includes(code.trim() + "```")
              const handleClick = () => {
                updateStreamingCode({ code, language })
              }
              
              if (!isBlockComplete && isLoading) {
                updateStreamingCode({ code, language })
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
                  <button 
                    className="copy-btn"
                    onClick={() => copyToClipboard(code)}
                  >
                    {t("chat.copyCode")}
                  </button>
                </div>
                <SyntaxHighlighter
                  language={language.toLowerCase()}
                  style={theme === "dark" ? tomorrow : oneLight}
                  customStyle={{
                    margin: 0,
                    padding: "12px",
                    background: "transparent"
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            )
          }
        }}
      >
        {text}
      </ReactMarkdown>
    )
  }, [text, isSent, isLoading])

  return (
    <div className="message-container">
      <div className={`message ${isSent ? "sent" : "received"} ${isError ? "error" : ""}`}>
        {toolCalls && (
          <ToolPanel
            type="calls"
            content={toolCalls}
          />
        )}
        {toolResults && (
          <ToolPanel
            type="result"
            content={toolResults}
            name={toolResults[0]?.name}
          />
        )}
        {formattedText}
        {files && files.length > 0 && <FilePreview files={files} />}
        {isLoading && (
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>
      {!isSent && !isLoading && (
        <div className="message-tools">
          {/* {messageId.includes("-") && (
            <div className="message-page">
              <button className={`${"active"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clipRule="evenodd" d="M14.7071 5.29289C15.0976 5.68342 15.0976 6.31658 14.7071 6.70711L9.41421 12L14.7071 17.2929C15.0976 17.6834 15.0976 18.3166 14.7071 18.7071C14.3166 19.0976 13.6834 19.0976 13.2929 18.7071L7.29289 12.7071C7.10536 12.5196 7 12.2652 7 12C7 11.7348 7.10536 11.4804 7.29289 11.2929L13.2929 5.29289C13.6834 4.90237 14.3166 4.90237 14.7071 5.29289Z" fill="currentColor"></path></svg>
              </button>
              <div className="message-page-number">
                <span>1</span>
                /
                <span>2</span>
              </div>
              <button>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clipRule="evenodd" d="M9.29289 18.7071C8.90237 18.3166 8.90237 17.6834 9.29289 17.2929L14.5858 12L9.29289 6.70711C8.90237 6.31658 8.90237 5.68342 9.29289 5.29289C9.68342 4.90237 10.3166 4.90237 10.7071 5.29289L16.7071 11.2929C16.8946 11.4804 17 11.7348 17 12C17 12.2652 16.8946 12.5196 16.7071 12.7071L10.7071 18.7071C10.3166 19.0976 9.68342 19.0976 9.29289 18.7071Z" fill="currentColor"></path></svg>
              </button>
            </div>
          )} */}
          <div></div>
          {/* {messageId.includes("-") && (  //if messageId doesn't contain "-" then it's aborted before ready then it can't retry
            <button
              type="button"
              className="retry-btn"
              onClick={onRetry}
              title={t("chat.retry")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="#000000" height="15px" width="15px" viewBox="0 0 489.698 489.698">
                <g>
                  <g>
                    <path d="M468.999,227.774c-11.4,0-20.8,8.3-20.8,19.8c-1,74.9-44.2,142.6-110.3,178.9c-99.6,54.7-216,5.6-260.6-61l62.9,13.1    c10.4,2.1,21.8-4.2,23.9-15.6c2.1-10.4-4.2-21.8-15.6-23.9l-123.7-26c-7.2-1.7-26.1,3.5-23.9,22.9l15.6,124.8    c1,10.4,9.4,17.7,19.8,17.7c15.5,0,21.8-11.4,20.8-22.9l-7.3-60.9c101.1,121.3,229.4,104.4,306.8,69.3    c80.1-42.7,131.1-124.8,132.1-215.4C488.799,237.174,480.399,227.774,468.999,227.774z"/>
                    <path d="M20.599,261.874c11.4,0,20.8-8.3,20.8-19.8c1-74.9,44.2-142.6,110.3-178.9c99.6-54.7,216-5.6,260.6,61l-62.9-13.1    c-10.4-2.1-21.8,4.2-23.9,15.6c-2.1,10.4,4.2,21.8,15.6,23.9l123.8,26c7.2,1.7,26.1-3.5,23.9-22.9l-15.6-124.8    c-1-10.4-9.4-17.7-19.8-17.7c-15.5,0-21.8,11.4-20.8,22.9l7.2,60.9c-101.1-121.2-229.4-104.4-306.8-69.2    c-80.1,42.6-131.1,124.8-132.2,215.3C0.799,252.574,9.199,261.874,20.599,261.874z"/>
                  </g>
                </g>
              </svg>
              <span>{t('chat.retry')}</span>
            </button>
          )} */}
        </div>
      )}
    </div>
  )
}

export default React.memo(Message)