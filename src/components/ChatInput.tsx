import "../styles/components/_ChatInput.scss"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import Tooltip from "./Tooltip"
import useHotkeyEvent from "../hooks/useHotkeyEvent"
import Textarea from "./WrappedTextarea"
import { currentChatIdAtom, draftMessagesAtom, lastMessageAtom, type FilePreview } from "../atoms/chatState"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { activeConfigAtom, configAtom, configDictAtom, currentModelSupportToolsAtom, isConfigActiveAtom, writeRawConfigAtom } from "../atoms/configState"
import { loadToolsAtom, toolsAtom, type Tool, type SubTool } from "../atoms/toolState"
import { useNavigate } from "react-router-dom"
import { showToastAtom } from "../atoms/toastState"
import { getTermFromModelConfig, queryGroup, queryModel, updateGroup, updateModel } from "../helper/model"
import { modelSettingsAtom } from "../atoms/modelState"
import { fileToBase64, getFileFromImageUrl } from "../util"
import { isLoggedInOAPAtom } from "../atoms/oapState"
import Button from "./Button"
import { invokeIPC, isTauri } from "../ipc"
import ToolDropDown from "./ToolDropDown"
import { historiesAtom } from "../atoms/historyState"

interface Props {
  page: "welcome" | "chat"
  onSendMessage?: (message: string, files?: FileList) => void
  disabled?: boolean //isChatStreaming
  onAbort: () => void
}

const ACCEPTED_FILE_TYPES = "*"

const MESSAGE_HISTORY_KEY = "chat-input-message-history"
const MAX_HISTORY_SIZE = 50

const ChatInput: React.FC<Props> = ({ page, onSendMessage, disabled, onAbort }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [message, setMessage] = useState("")
  const [previews, setPreviews] = useState<FilePreview[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevDisabled = useRef(disabled)
  const uploadedFiles = useRef<File[]>([])
  const isComposing = useRef(false)
  const [isAborting, setIsAborting] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const tempMessage = useRef("")
  const lastMessage = useAtomValue(lastMessageAtom)
  const hasActiveConfig = useAtomValue(isConfigActiveAtom)
  const supportTools = useAtomValue(currentModelSupportToolsAtom)
  const activeConfig = useAtomValue(activeConfigAtom)
  const [isDragging, setIsDragging] = useState(false)
  const loadTools = useSetAtom(loadToolsAtom)
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const config = useAtomValue(configAtom)
  const configList = useAtomValue(configDictAtom)
  const saveAllConfig = useSetAtom(writeRawConfigAtom)
  const showToast = useSetAtom(showToastAtom)
  const setSettings = useSetAtom(modelSettingsAtom)
  const [draftMessages, setDraftMessages] = useAtom(draftMessagesAtom)
  const currentChatId = useAtomValue(currentChatIdAtom)
  const histories = useAtomValue(historiesAtom)
  const tools = useAtomValue(toolsAtom)

  // Tool mention states
  const [showToolMenu, setShowToolMenu] = useState(false)
  const [toolMenuPosition, setToolMenuPosition] = useState({ top: 0, left: 0 })
  const [toolSearchQuery, setToolSearchQuery] = useState("")
  const [selectedToolIndex, setSelectedToolIndex] = useState(0)
  const [mentionStartPos, setMentionStartPos] = useState(0)
  const toolMenuRef = useRef<HTMLDivElement>(null)

  // Calculate chat key for draft storage
  const chatKey = page === "welcome" ? "__new_chat__" : currentChatId || "__new_chat__"
  const getMessage = () => new Promise<string>((resolve) => {
    setMessage(prev => {
      resolve(prev)
      return prev
    })
  })

  const messageDisabled = !hasActiveConfig

  useEffect(() => {
    loadTools()
  }, [isLoggedInOAP])

  // Load draft message and files when chatKey changes
  useEffect(() => {
    const draft = draftMessages[chatKey] || { message: "", files: [], previews: [] }

    // Always set message from draft (empty string if no draft)
    setMessage(draft.message)

    // Always set files and previews from draft (empty arrays if no draft)
    // Create copies to avoid reference sharing
    uploadedFiles.current = [...draft.files]
    setPreviews([...draft.previews])

    // Update file input
    if (fileInputRef.current) {
      if (draft.files.length > 0) {
        const dataTransfer = new DataTransfer()
        draft.files.forEach(file => {
          dataTransfer.items.add(file)
        })
        fileInputRef.current.files = dataTransfer.files
      } else {
        fileInputRef.current.value = ""
      }
    }
    // Only run when chatKey changes, not when draftMessages changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey])

  // Auto-save draft when typing or uploading
  useEffect(() => {
    (async () => {
      const _message = await getMessage()
      setDraftMessages(prev => {
        // Create a set of valid chat IDs from history
        const validChatIds = new Set([
          "__new_chat__",
          ...histories.starred.map(chat => chat.id),
          ...histories.normal.map(chat => chat.id)
        ])

        // Clean up drafts for chats that no longer exist in history
        const cleanedDrafts = Object.keys(prev).reduce((acc, key) => {
          if (validChatIds.has(key) && (prev[key].message !== "" || prev[key].files.length > 0)) {
            acc[key] = prev[key]
          }
          return acc
        }, {} as typeof prev)

        // Add/update current draft
        return {
          ...cleanedDrafts,
          [chatKey]: {
            message: _message || message,
            files: [...uploadedFiles.current], // Create a copy to avoid reference sharing
            previews: [...previews] // Create a copy of previews too
          }
        }
      })
    })()
  }, [message, previews, setDraftMessages, histories])


  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) {
      return bytes + " B"
    }
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " KB"
    }
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }, [])

  const handleFiles = async (files: File[]) => {
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

    const newPreviews: FilePreview[] = []
    for (const file of newFiles) {
      const preview: FilePreview = {
        type: file.type.startsWith("image/") ? "image" : "file",
        name: file.name,
        size: formatFileSize(file.size)
      }

      if (preview.type === "image") {
        preview.url = await fileToBase64(file).catch(() => "") || ""
      }

      newPreviews.push(preview)
    }

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
        fileInputRef.current.value = ""
      } else {
        fileInputRef.current.files = dataTransfer.files
      }
    }

    setPreviews(prev => {
      const newPreviews = [...prev]
      newPreviews.splice(index, 1)
      return newPreviews
    })
  }

  const handlePaste = (e: ClipboardEvent) => {
    if (document.activeElement !== textareaRef.current)
      return

    const handlePasteInTauri = async () => {
      if (!isTauri)
        return

      const uri = await invokeIPC("save_clipboard_image_to_cache")
      const file = await getFileFromImageUrl(uri)
      handleFiles([file])
    }

    const items = e.clipboardData?.items
    if (!items)
      return handlePasteInTauri()

    const imageItems = Array.from(items).filter(item => item.type.startsWith("image/"))
    if (imageItems.length === 0)
      return items.length == 0 ? handlePasteInTauri() : null

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
    }
  }, [])

  // Handle click outside tool menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolMenuRef.current && !toolMenuRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowToolMenu(false)
      }
    }

    if (showToolMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [showToolMenu])

  // Scroll selected item into view
  useEffect(() => {
    if (showToolMenu && toolMenuRef.current) {
      const selectedItem = toolMenuRef.current.querySelector(".tool-mention-item.selected")
      if (selectedItem) {
        selectedItem.scrollIntoView({
          block: "nearest",
          behavior: "smooth"
        })
      }
    }
  }, [selectedToolIndex, showToolMenu])

  // Update menu position when message changes and menu is visible
  useEffect(() => {
    if (showToolMenu && textareaRef.current) {
      const textarea = textareaRef.current
      const textareaRect = textarea.getBoundingClientRect()
      const cursorPos = textarea.selectionStart

      // Create a mirror div to measure text position
      const div = document.createElement("div")
      const style = window.getComputedStyle(textarea)

      // Copy textarea styles to mirror div
      const properties = [
        "boxSizing", "width", "height", "overflowX", "overflowY",
        "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
        "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
        "fontFamily", "fontSize", "fontWeight", "lineHeight",
        "letterSpacing", "whiteSpace", "wordWrap", "wordBreak"
      ]

      properties.forEach(prop => {
        div.style[prop as any] = style[prop as any]
      })

      div.style.position = "absolute"
      div.style.visibility = "hidden"
      div.style.top = "0"
      div.style.left = "0"
      div.style.whiteSpace = "pre-wrap"
      div.style.wordWrap = "break-word"

      document.body.appendChild(div)

      // Add text up to cursor position
      const textBeforeCursor = textarea.value.substring(0, cursorPos)
      div.textContent = textBeforeCursor

      // Add a span at cursor position to measure
      const span = document.createElement("span")
      span.textContent = "|"
      div.appendChild(span)

      const spanRect = span.getBoundingClientRect()
      const divRect = div.getBoundingClientRect()
      document.body.removeChild(div)

      // Calculate relative position
      const top = textareaRect.top + (spanRect.top - divRect.top) + textarea.scrollTop
      const left = textareaRect.left + (spanRect.left - divRect.left)
      const lineHeight = parseInt(style.lineHeight) || 20
      const menuMaxHeight = 240 // Max height from CSS
      const windowHeight = window.innerHeight

      // Calculate space below cursor
      const spaceBelow = windowHeight - (top + lineHeight)

      // If not enough space below, show menu above cursor
      const showAbove = spaceBelow < menuMaxHeight && top > menuMaxHeight

      setToolMenuPosition({
        top: showAbove ? top - menuMaxHeight : top + lineHeight,
        left: left
      })
    }
  }, [message, showToolMenu])

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
      window.ipcRenderer && window.ipcRenderer.showInputContextMenu()
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

  const currentModelEnableToolcall = () => {
    return config.enableTools ?? true
  }

  const toggleEnableTools = () => {
    if(!hasActiveConfig){
      return
    }

    const _config = configList[config.activeProvider]
    const enableTools = config?.enableTools ?? true
    setSettings(s => {
      const term = getTermFromModelConfig(_config)
      if (!term) {
        return s
      }

      const group = queryGroup(term.group, s.groups)
      if (!group) {
        return s
      }

      const models = queryModel(term.model, group[0])
      if (!models.length) {
        return s
      }

      const model = models[0]
      model.enableTools = !enableTools

      const newGroup = updateModel(term.model, group[0], { enableTools: !enableTools })
      if (newGroup) {
        s.groups = updateGroup(term.group, s.groups, newGroup) || s.groups
      }

      return s
    })

    saveAllConfig({...config, enableTools: !enableTools})
    if(enableTools){
      showToast({
        message: t("chat.tools-btn.disableToast"),
        type: "success"
      })
    } else {
      showToast({
        message: t("chat.tools-btn.enableToast"),
        type: "success"
      })
    }
  }

  // Get all available tool options (tool/subtool format)
  const getToolOptions = useCallback(() => {
    const options: Array<{ label: string; value: string; tool: Tool; subTool?: SubTool }> = []

    tools.forEach((tool) => {
      if (tool.enabled && tool.tools && tool.tools.length > 0) {
        tool.tools.forEach((subTool) => {
          if (subTool.enabled) {
            options.push({
              label: `${tool.name}/${subTool.name}`,
              value: `${tool.name}/${subTool.name}`,
              tool,
              subTool
            })
          }
        })
      }
    })

    return options
  }, [tools])

  // Filter tool options based on search query
  const getFilteredToolOptions = useCallback(() => {
    const options = getToolOptions()
    if (!toolSearchQuery) {
      return options
    }

    const query = toolSearchQuery.toLowerCase()
    return options.filter((option) =>
      option.label.toLowerCase().includes(query)
    )
  }, [toolSearchQuery, getToolOptions])

  // Calculate cursor position in pixels
  const getCursorPosition = useCallback(() => {
    if (!textareaRef.current) {
      return { top: 0, left: 0 }
    }

    const textarea = textareaRef.current
    const textareaRect = textarea.getBoundingClientRect()
    const cursorPos = textarea.selectionStart

    // Create a mirror div to measure text position
    const div = document.createElement("div")
    const style = window.getComputedStyle(textarea)

    // Copy textarea styles to mirror div
    const properties = [
      "boxSizing", "width", "height", "overflowX", "overflowY",
      "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "fontFamily", "fontSize", "fontWeight", "lineHeight",
      "letterSpacing", "whiteSpace", "wordWrap", "wordBreak"
    ]

    properties.forEach(prop => {
      div.style[prop as any] = style[prop as any]
    })

    div.style.position = "absolute"
    div.style.visibility = "hidden"
    div.style.top = "0"
    div.style.left = "0"
    div.style.whiteSpace = "pre-wrap"
    div.style.wordWrap = "break-word"

    document.body.appendChild(div)

    // Add text up to cursor position
    const textBeforeCursor = textarea.value.substring(0, cursorPos)
    div.textContent = textBeforeCursor

    // Add a span at cursor position to measure
    const span = document.createElement("span")
    span.textContent = "|"
    div.appendChild(span)

    const spanRect = span.getBoundingClientRect()
    const divRect = div.getBoundingClientRect()
    document.body.removeChild(div)

    // Calculate relative position
    const top = textareaRect.top + (spanRect.top - divRect.top) + textarea.scrollTop
    const left = textareaRect.left + (spanRect.left - divRect.left)

    return { top, left }
  }, [])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart

    setMessage(newValue)

    // Check if @ symbol was just typed
    const textBeforeCursor = newValue.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf("@")

    if (lastAtIndex !== -1) {
      // Check if there's a space before @ or it's at the start
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " "
      const isValidMention = charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0

      if (isValidMention) {
        const searchText = textBeforeCursor.substring(lastAtIndex + 1)

        // Show menu if @ is followed by no space or only alphanumeric/slash characters
        if (!searchText.includes(" ") && !searchText.includes("\n")) {
          // Check if there are any available tools before showing menu
          const availableOptions = getToolOptions()
          if (availableOptions.length === 0) {
            setShowToolMenu(false)
            return
          }

          setToolSearchQuery(searchText)
          setMentionStartPos(lastAtIndex)
          setShowToolMenu(true)
          setSelectedToolIndex(0)

          // Calculate position for the menu at cursor position
          if (textareaRef.current) {
            const cursorPosition = getCursorPosition()
            const lineHeight = parseInt(window.getComputedStyle(textareaRef.current).lineHeight) || 20
            const menuMaxHeight = 240 // Max height from CSS
            const windowHeight = window.innerHeight

            // Calculate space below cursor
            const spaceBelow = windowHeight - (cursorPosition.top + lineHeight)

            // If not enough space below, show menu above cursor
            const showAbove = spaceBelow < menuMaxHeight && cursorPosition.top > menuMaxHeight

            setToolMenuPosition({
              top: showAbove ? cursorPosition.top - menuMaxHeight : cursorPosition.top + lineHeight,
              left: cursorPosition.left
            })
          }
          return
        }
      }
    }

    // Hide menu if no valid @ mention found
    setShowToolMenu(false)
  }

  // Handle tool selection
  const selectTool = useCallback((toolValue: string) => {
    const beforeMention = message.substring(0, mentionStartPos)
    const afterMention = message.substring(mentionStartPos + toolSearchQuery.length + 1) // +1 for @
    const newMessage = beforeMention + toolValue + " " + afterMention

    setMessage(newMessage)
    setShowToolMenu(false)
    setToolSearchQuery("")

    // Focus back to textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + toolValue.length + 1
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [message, mentionStartPos, toolSearchQuery])

  const saveMessageToHistory = (msg: string) => {
    if (!msg.trim()) {
      return
    }

    const history: string[] = JSON.parse(localStorage.getItem(MESSAGE_HISTORY_KEY) || "[]")
    // Skip if the latest message is the same
    if (history.length > 0 && history[0] === msg) {
      return
    }

    // Add to the beginning
    history.unshift(msg)
    // Limit history size
    if (history.length > MAX_HISTORY_SIZE) {
      history.pop()
    }
    localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(history))
  }

  const handleSubmit = (e: React.FormEvent) => {
    if (page === "chat") {
      e.preventDefault()
      if ((!message.trim() && !uploadedFiles.current.length) || !onSendMessage || messageDisabled || disabled)
        return

      // Save message to history before sending
      saveMessageToHistory(message)
      setHistoryIndex(-1)
      tempMessage.current = ""

      onSendMessage(message, fileInputRef.current?.files || undefined)
      setMessage("")

      uploadedFiles.current = []
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      setPreviews([])

      // Clear draft for this chat after sending
      setDraftMessages(prev => {
        const newDrafts = { ...prev }
        delete newDrafts[chatKey]
        return newDrafts
      })
    } else {
      e.preventDefault()
      if (!hasActiveConfig)
        return

      if (message.trim() || uploadedFiles.current.length > 0) {
        // Save message to history before navigating
        saveMessageToHistory(message)
        setHistoryIndex(-1)
        tempMessage.current = ""

        // Clear draft when navigating to chat
        setDraftMessages(prev => {
          const newDrafts = { ...prev }
          delete newDrafts[chatKey]
          return newDrafts
        })
        navigate("/chat", {
          state: {
            initialMessage: message,
            files: uploadedFiles.current
          }
        })
      }
    }
  }

  const onKeydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle tool menu navigation
    if (showToolMenu) {
      const filteredOptions = getFilteredToolOptions()

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedToolIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        return
      }

      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedToolIndex((prev) => prev > 0 ? prev - 1 : 0)
        return
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (filteredOptions[selectedToolIndex]) {
          selectTool(filteredOptions[selectedToolIndex].value)
        }
        return
      }

      if (e.key === "Tab") {
        e.preventDefault()
        if (filteredOptions[selectedToolIndex]) {
          selectTool(filteredOptions[selectedToolIndex].value)
        }
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        setShowToolMenu(false)
        return
      }
    }

    // chat-input:history-up
    // Handle message history navigation with ArrowUp/ArrowDown
    if (e.key === "ArrowUp" && !showToolMenu) {
      const textarea = e.currentTarget
      const cursorPosition = textarea.selectionStart
      // Only trigger if cursor is at the beginning of the textarea
      if (cursorPosition === 0) {
        e.preventDefault()
        const history: string[] = JSON.parse(localStorage.getItem(MESSAGE_HISTORY_KEY) || "[]")
        if (history.length === 0) {
          return
        }

        if (historyIndex === -1) {
          // Save current message before navigating history
          tempMessage.current = message
        }

        const newIndex = historyIndex + 1
        if (newIndex < history.length) {
          setHistoryIndex(newIndex)
          setMessage(history[newIndex])
        }
        return
      }
    }

    if (e.key === "ArrowDown" && !showToolMenu) {
      const textarea = e.currentTarget
      const cursorPosition = textarea.selectionStart
      const textLength = textarea.value.length
      // Only trigger if cursor is at the end of the textarea
      if (cursorPosition === textLength && historyIndex >= 0) {
        e.preventDefault()
        const history: string[] = JSON.parse(localStorage.getItem(MESSAGE_HISTORY_KEY) || "[]")

        const newIndex = historyIndex - 1
        if (newIndex >= 0) {
          setHistoryIndex(newIndex)
          setMessage(history[newIndex])
        } else {
          // Return to the original message
          setHistoryIndex(-1)
          setMessage(tempMessage.current)
        }
        return
      }
    }

    if ((e.key !== "Enter" && e.key !== "Escape") || e.shiftKey || isComposing.current) {
      return
    }

    if (e.key === "Enter" && (messageDisabled || disabled)) {
      return
    }

    if (e.key === "Escape" && disabled) {
      e.stopPropagation()
      e.preventDefault()
      setIsAborting(true)
      onAbort()
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }

  return (
    <div className="chat-input-wrapper">
      {activeConfig?.model && activeConfig?.model !== "none" && !supportTools && (
        <div className="chat-input-banner">
          <div>
            {t("chat.unsupportTools", { model: activeConfig?.model })}
          </div>
          <Button
            theme="Color"
            color="neutralGray"
            size="small"
            onClick={toggleEnableTools}
          >
            {currentModelEnableToolcall() ?
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M3 9L3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M8 9L8 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {t("chat.tools-btn.disable")}
              </> : <>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="11" viewBox="0 0 10 11" fill="none">
                  <path d="M2.40367 1.92843C2.58324 1.92843 2.73887 1.98399 2.94238 2.10304L7.69497 4.84113C8.05012 5.04748 8.21373 5.22208 8.21373 5.49986C8.21373 5.77764 8.05012 5.95224 7.69497 6.15859L2.94238 8.89669C2.73887 9.01177 2.58324 9.07129 2.40367 9.07129C2.05251 9.07129 1.78516 8.80542 1.78516 8.36891V2.62685C1.78516 2.19431 2.05251 1.92843 2.40367 1.92843Z" fill="currentColor"/>
                </svg>
                {t("chat.tools-btn.enable")}
              </>}
          </Button>
        </div>
      )}
      {(!activeConfig?.model || activeConfig?.model == "none") && (
        <div className="chat-input-banner">
          {t("chat.noModelBanner")}
        </div>
      )}
      <footer
        className="chat-input"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          className={`drag-overlay ${isDragging ? "show" : ""}`}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="drag-overlay-bg"
          onDrop={handleDrop}></div>
          <div className="drag-overlay-text">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"></path>
              <path fill="currentColor" d="M6.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM3 16l4-4 2 2 6-4.5 4 4.5v1.999L3 16Z"></path>
            </svg>
            {t("chat.dragFiles")}
          </div>
        </div>
        <div className="input-wrapper">
          <Textarea
            autoheight={true}
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={onKeydown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={t("chat.placeholder")}
            rows={1}
          />
          {showToolMenu && (() => {
            const filteredOptions = getFilteredToolOptions()
            if (filteredOptions.length === 0) {
              return null
            }
            return (
              <div
                ref={toolMenuRef}
                className="tool-mention-menu"
                style={{
                  position: "fixed",
                  top: `${toolMenuPosition.top}px`,
                  left: `${toolMenuPosition.left}px`,
                }}
              >
                {filteredOptions.map((option, index) => (
                  <div
                    key={option.value}
                    className={`tool-mention-item ${index === selectedToolIndex ? "selected" : ""}`}
                    onClick={() => selectTool(option.value)}
                    onMouseEnter={() => setSelectedToolIndex(index)}
                  >
                    <div className="tool-mention-label">{option.label}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
        {previews.length > 0 && (
          <div className="file-previews">
            {previews.map((preview, index) => (
              <div key={index} className={`preview-item ${preview.type}`}>
                {preview.type === "image" ? (
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
        <div className="input-actions">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept={ACCEPTED_FILE_TYPES}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <Tooltip type="controls" content={t("chat.uploadFile")}>
            <button
              className="upload-btn"
              onClick={handleFileClick}
              disabled={messageDisabled || disabled}
            >
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
              </svg>
            </button>
          </Tooltip>
          <div className="chat-input-tools-container">
            <ToolDropDown />
            {(disabled && !isAborting) ? (
              <Tooltip type="controls" content={<>{t("chat.abort")}<span className="key">Esc</span></>}>
                <button
                  className="abort-btn"
                  onClick={() => {
                    setIsAborting(true)
                    onAbort()
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none">
                    <path fill="currentColor" d="M7 8.89A1.89 1.89 0 0 1 8.89 7h4.22A1.89 1.89 0 0 1 15 8.89v4.22A1.89 1.89 0 0 1 13.11 15H8.89A1.89 1.89 0 0 1 7 13.11V8.89Z"></path>
                    <circle cx="11" cy="11" r="10" stroke="currentColor" strokeWidth="2"></circle>
                  </svg>
                </button>
              </Tooltip>
            ) : (
              <Tooltip type="controls" content={!hasActiveConfig ? t("chat.noModelAlert") : t("chat.send")}>
                <button
                  className="send-btn"
                  onClick={handleSubmit}
                  disabled={messageDisabled || disabled}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default React.memo(ChatInput)
