import React, { useState, useRef, KeyboardEvent, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useSetAtom, useAtom, useAtomValue } from "jotai"
import { codeStreamingAtom } from "../atoms/codeStreaming"
import { useTranslation } from "react-i18next"
import { historiesAtom, loadHistoriesAtom } from "../atoms/historyState"
import { hasActiveConfigAtom, hasConfigAtom } from "../atoms/configState"
import Setup from "./Setup"
import { openOverlayAtom } from "../atoms/layerState"
import useHotkeyEvent from "../hooks/useHotkeyEvent"
import Textarea from "../components/WrappedTextarea"
import Tooltip from "../components/Tooltip"
import { loadToolsAtom, toolsAtom } from "../atoms/toolState"

const formatFileSize = (bytes: number) => {
  if (bytes === 0)
    return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

const Welcome = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [message, setMessage] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const updateStreamingCode = useSetAtom(codeStreamingAtom)
  const histories = useAtomValue(historiesAtom)
  const loadHistories = useSetAtom(loadHistoriesAtom)
  const hasConfig = useAtomValue(hasConfigAtom)
  const isComposing = useRef(false)
  const openOverlay = useSetAtom(openOverlayAtom)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const loadTools = useSetAtom(loadToolsAtom)
  const tools = useAtomValue(toolsAtom)
  const hasActiveConfig = useAtomValue(hasActiveConfigAtom)

  useEffect(() => {
    loadTools()
  }, [])

  useEffect(() => {
    updateStreamingCode(null)
  }, [updateStreamingCode])

  useEffect(() => {
    loadHistories()
  }, [loadHistories])

  useHotkeyEvent("chat-input:upload-file", () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  })

  useHotkeyEvent("chat-input:focus", () => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasActiveConfig)
      return

    if (message.trim() || uploadedFiles.length > 0) {
      navigate("/chat", {
        state: {
          initialMessage: message,
          files: uploadedFiles
        }
      })
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey || isComposing.current) {
        return
      }

      handleSubmit(e)
    }
  }

  const handleCompositionStart = () => {
    isComposing.current = true
  }

  const handleCompositionEnd = () => {
    isComposing.current = false
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const isImageFile = (file: File) => {
    return file.type.startsWith("image/")
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items)
      return

    const imageItems = Array.from(items).filter(item => item.type.startsWith("image/"))
    if (imageItems.length === 0)
      return

    const newFiles = await Promise.all(
      imageItems.map(async item => {
        const blob = item.getAsFile()
        if (!blob)
          return null

        const ext = blob.type.split("/")[1]
        const filename = `pasted_image_${Date.now()}.${ext}`
        return new File([blob], filename, { type: blob.type })
      })
    )

    const validFiles = newFiles.filter((file): file is File => file !== null)
    setUploadedFiles(prev => [...prev, ...validFiles])
  }

  if (!hasConfig) {
    return <Setup />
  }

  return (
    <div className="main-container">
      <div className="welcome-content">
        <h1>{t("welcome.title")}</h1>
        <p className="subtitle">{t("welcome.subtitle")}</p>

        <form className="welcome-input" onSubmit={handleSubmit}>
          <div className="input-container">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onPaste={handlePaste}
              placeholder={t("chat.placeholder")}
              autoFocus={true}
              rows={2}
            />
            <div className="input-actions">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title={t("chat.uploadFile")}
              >
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                </svg>
              </button>
              <div className="tools-container">
                <button
                  className="tools-btn"
                  onClick={() => openOverlay("Tools")}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                  </svg>
                  {`${tools.length} ${t("chat.tools")}`}
                </button>
                <Tooltip
                  content={!hasActiveConfig ? t("chat.noModelAlert") : t("chat.send")}
                >
                  <button type="submit" className="send-btn" disabled={(!message.trim() && uploadedFiles.length === 0) || !hasActiveConfig}>
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </form>

        {uploadedFiles.length > 0 && (
          <div className="uploaded-files-preview">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="file-item">
                {isImageFile(file) ? (
                  <div className="image-preview">
                    <img src={URL.createObjectURL(file)} alt={file.name} />
                  </div>
                ) : (
                  <div className="file-info">
                    <div className="file-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24">
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                      </svg>
                    </div>
                    <div className="file-details">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeFile(index)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="suggestions">
          {histories.length > 0 && histories.slice(0, 3).map(history => (
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
