import React, { useState, useRef, useEffect, useCallback } from "react"
import { useTranslation } from 'react-i18next'
import Tooltip from "../../components/Tooltip"
import useHotkeyEvent from "../../hooks/useHotkeyEvent"
import Textarea from "../../components/WrappedTextarea"
import { lastMessageAtom } from "../../atoms/chatState"
import { useAtomValue } from "jotai"
import { hasActiveConfigAtom } from "../../atoms/configState"

interface Props {
  onSendMessage?: (message: string, files?: FileList) => void
  disabled?: boolean
  onAbort: () => void
}

interface FilePreview {
  type: 'image' | 'file'
  url?: string
  name: string
  size: string
}

const ACCEPTED_FILE_TYPES = [
  '*/*'
].join(',')

const ChatInput: React.FC<Props> = ({ onSendMessage, disabled, onAbort }) => {
  const { t } = useTranslation()
  const [message, setMessage] = useState("")
  const [previews, setPreviews] = useState<FilePreview[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevDisabled = useRef(disabled)
  const uploadedFiles = useRef<File[]>([])
  const isComposing = useRef(false)
  const [isAborting, setIsAborting] = useState(false)
  const lastMessage = useAtomValue(lastMessageAtom)
  const hasActiveConfig = useAtomValue(hasActiveConfigAtom)

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }, [])

  const handleFiles = (files: File[]) => {
    const existingFiles = uploadedFiles.current

    const newFiles = files.filter(newFile => {
      const isDuplicate = existingFiles.some(existingFile => {
        if (existingFile.name !== newFile.name)
          return false

        if (existingFile.size !== newFile.size)
          return false

        if (existingFile.lastModified !== newFile.lastModified)
          return false

        return true
      })

      return !isDuplicate
    })

    if (newFiles.length === 0)
      return

    const newPreviews = newFiles.map(file => {
      const preview: FilePreview = {
        type: file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name,
        size: formatFileSize(file.size)
      }

      if (preview.type === 'image') {
        preview.url = URL.createObjectURL(file)
      }

      return preview
    })

    setPreviews(prev => [...prev, ...newPreviews])
    uploadedFiles.current = [...existingFiles, ...newFiles]

    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer()
      uploadedFiles.current.forEach(file => {
        dataTransfer.items.add(file)
      })
      fileInputRef.current.files = dataTransfer.files
    }
  }

  const removeFile = (index: number, e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    uploadedFiles.current = uploadedFiles.current.filter((_, i) => i !== index)

    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer()
      uploadedFiles.current.forEach(file => {
        dataTransfer.items.add(file)
      })

      if (uploadedFiles.current.length === 0) {
        fileInputRef.current.value = ''
      } else {
        fileInputRef.current.files = dataTransfer.files
      }
    }

    setPreviews(prev => {
      const newPreviews = [...prev]
      if (newPreviews[index].type === 'image' && newPreviews[index].url) {
        URL.revokeObjectURL(newPreviews[index].url)
      }
      newPreviews.splice(index, 1)
      return newPreviews
    })
  }

  const handlePaste = (e: ClipboardEvent) => {
    if (document.activeElement !== textareaRef.current)
      return

    const items = e.clipboardData?.items
    if (!items)
      return

    const imageItems = Array.from(items).filter(item => item.type.startsWith("image/"))
    if (imageItems.length === 0)
      return

    if (imageItems.length > 0) {
      e.preventDefault()
      const files = imageItems.map(item => item.getAsFile()).filter((file): file is File => file !== null)
      handleFiles(files)
    }
  }

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

  useHotkeyEvent("chat-input:paste-last-message", () => {
    if (lastMessage) {
      setMessage(m => m + lastMessage)
    }
  })

  useEffect(() => {
    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("paste", handlePaste)
      previews.forEach(preview => {
        if (preview.type === 'image' && preview.url) {
          URL.revokeObjectURL(preview.url)
        }
      })
    }
  }, [])

  useEffect(() => {
    if (prevDisabled.current && !disabled) {
      textareaRef.current?.focus()
    }
    prevDisabled.current = disabled
    setIsAborting(false)
  }, [disabled])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && disabled) {
        e.stopPropagation()
        e.preventDefault()
        setIsAborting(true)
        onAbort()
      }
    }

    window.addEventListener("keydown", handleKeydown)
    return () => {
      window.removeEventListener("keydown", handleKeydown)
    }
  }, [disabled])

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      window.ipcRenderer.showInputContextMenu()
    }

    if (textareaRef.current) {
      textareaRef.current.addEventListener("contextmenu", handleContextMenu)
    }

    return () => {
      if (textareaRef.current) {
        textareaRef.current.removeEventListener("contextmenu", handleContextMenu)
      }
    }
  }, [])

  const adjustHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    textarea.style.height = "auto"
    if (e.target.value.includes("\n")) {
      textarea.style.height = `${textarea.scrollHeight}px`
    }
    setMessage(e.target.value)
  }

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if ((!message.trim() && !uploadedFiles.current.length) || !onSendMessage || disabled || !hasActiveConfig)
      return

    onSendMessage(message, fileInputRef.current?.files || undefined)
    setMessage("")
    resetTextareaHeight()

    uploadedFiles.current = []
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    setPreviews(prev => {
      prev.forEach(preview => {
        if (preview.type === 'image' && preview.url) {
          URL.revokeObjectURL(preview.url)
        }
      })
      return []
    })
  }

  const onKeydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || isComposing.current) {
      return
    }

    e.preventDefault()
    handleSubmit(e)
  }

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false
  }, [])

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files))
    }
  }

  return (
    <footer className="chat-input">
      <div className="input-wrapper">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={adjustHeight}
          onKeyDown={onKeydown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={t('chat.placeholder')}
          rows={1}
          disabled={disabled}
        />
      </div>
      <div className="input-actions">
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept={ACCEPTED_FILE_TYPES}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <button
          className="upload-btn"
          onClick={handleFileClick}
          disabled={disabled}
          title={t('chat.uploadFile')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
          </svg>
        </button>
        {(disabled && !isAborting) ? (
          <Tooltip type="controls" content={<>{t("chat.abort")}<span className="key">Esc</span></>}>
            <button
              className="abort-btn"
              onClick={() => {
                setIsAborting(true)
                onAbort()
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                <circle cx="12" cy="12" r="12" fill="black"></circle>
                <circle cx="12" cy="12" r="7" fill="white"></circle>
                <circle cx="12" cy="12" r="6.5" fill="black"></circle>
                <circle cx="12" cy="12" r="3" fill="white"></circle>
              </svg>
            </button>
          </Tooltip>
        ) : (
          <Tooltip type="controls" content={!hasActiveConfig ? t("chat.noModelAlert") : t('chat.send')}>
            <button
              className="send-btn"
              onClick={handleSubmit}
              disabled={disabled || !hasActiveConfig}
            >
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </Tooltip>
        )}
      </div>
      {previews.length > 0 && (
        <div className="file-previews">
          {previews.map((preview, index) => (
            <div key={index} className={`preview-item ${preview.type}`}>
              {preview.type === 'image' ? (
                <img src={preview.url} alt={preview.name} />
              ) : (
                <div className="file-info">
                  <div className="file-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                  </div>
                  <div className="file-details">
                    <div className="file-name">{preview.name}</div>
                    <div className="file-size">{preview.size}</div>
                  </div>
                </div>
              )}
              <button
                className="remove-preview"
                onClick={(e) => removeFile(index, e)}
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </footer>
  )
}

export default React.memo(ChatInput)
