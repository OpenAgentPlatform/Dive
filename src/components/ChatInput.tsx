import "../styles/components/_ChatInput.scss"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import Tooltip from "./Tooltip"
import useHotkeyEvent from "../hooks/useHotkeyEvent"
import Textarea from "./WrappedTextarea"
import { currentChatIdAtom, draftMessagesAtom, lastMessageAtom, type FilePreview } from "../atoms/chatState"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { activeConfigAtom, configAtom, configDictAtom, currentModelSupportToolsAtom, isConfigActiveAtom, selectModelAtom, writeRawConfigAtom } from "../atoms/configState"
import { loadToolsAtom, toolsAtom, type Tool, type SubTool } from "../atoms/toolState"
import { useNavigate } from "react-router-dom"
import { showToastAtom } from "../atoms/toastState"
import { getTermFromModelConfig, queryGroup, queryModel, updateGroup, updateModel } from "../helper/model"
import { modelListAtom, modelSettingsAtom, type ModelOption } from "../atoms/modelState"
import { fileToBase64, getFileFromImageUrl } from "../util"
import { isLoggedInOAPAtom } from "../atoms/oapState"
import Button from "./Button"
import { invokeIPC, isTauri } from "../ipc"
import ToolDropDown from "./ToolDropDown"
import { historiesAtom } from "../atoms/historyState"
import { searchPath, fuzzySearchPath, type PathEntry } from "../ipc/path"
import SuggestionMenu from "./SuggestionMenu"
import { skillsAtom, loadSkillsAtom } from "../atoms/skillState"
import { openOverlayAtom } from "../atoms/layerState"
import { isProviderIconNoFilter, PROVIDER_ICONS } from "../atoms/interfaceState"
import { systemThemeAtom, userThemeAtom } from "../atoms/themeState"

interface Props {
  page: "welcome" | "chat"
  onSendMessage?: (message: string, files?: FileList) => void
  disabled?: boolean //isChatStreaming
  onAbort: () => void
}

const ACCEPTED_FILE_TYPES = "*"

const MESSAGE_HISTORY_KEY = "chat-input-message-history"
const MAX_HISTORY_SIZE = 50
const RECENT_PATHS_KEY = "chat-input-recent-paths"
const MAX_RECENT_PATHS = 5

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
  const skills = useAtomValue(skillsAtom)
  const loadSkills = useSetAtom(loadSkillsAtom)
  const openOverlay = useSetAtom(openOverlayAtom)
  const allModels = useAtomValue(modelListAtom)
  const selectModel = useSetAtom(selectModelAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const userTheme = useAtomValue(userThemeAtom)

  // Tool mention states
  const [showToolMenu, setShowToolMenu] = useState(false)
  const [toolSearchQuery, setToolSearchQuery] = useState("")
  const [selectedToolIndex, setSelectedToolIndex] = useState(0)
  const [mentionStartPos, setMentionStartPos] = useState(0)

  // Path search states
  const [showPathMenu, setShowPathMenu] = useState(false)
  const [pathSearchQuery, setPathSearchQuery] = useState("")
  const [selectedPathIndex, setSelectedPathIndex] = useState(0)
  const [pathStartPos, setPathStartPos] = useState(0)
  const [pathEntries, setPathEntries] = useState<PathEntry[]>([])
  const [isSearchingPath, setIsSearchingPath] = useState(false)

  // Fuzzy search mode states
  const [isFuzzyMode, setIsFuzzyMode] = useState(false)
  const [fuzzyBasePath, setFuzzyBasePath] = useState("")
  const [fuzzyQuery, setFuzzyQuery] = useState("")

  // Skill menu states
  const [showSkillMenu, setShowSkillMenu] = useState(false)
  const [skillSearchQuery, setSkillSearchQuery] = useState("")
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0)
  const [skillStartPos, setSkillStartPos] = useState(0)

  // Model menu states (for /model command)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [modelSearchQuery, setModelSearchQuery] = useState("")
  const [selectedModelIndex, setSelectedModelIndex] = useState(0)

  // Recent paths for quick access
  const [recentPaths, setRecentPaths] = useState<PathEntry[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_PATHS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

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
    loadSkills()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    textareaRef.current?.focus()
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

  // Built-in special options that show at the top when query is empty
  const builtInOptions = useMemo(() => [
    { label: "@search", value: "search", isBuiltIn: true },
  ], [])

  // Filter tool options based on search query
  const getFilteredToolOptions = useCallback(() => {
    const options = getToolOptions()
    const query = toolSearchQuery.toLowerCase()

    if (!toolSearchQuery) {
      // Show built-in options at top when query is empty
      return [...builtInOptions, ...options]
    }

    // Filter both built-in and tool options
    const filteredBuiltIn = builtInOptions.filter((option) =>
      option.label.toLowerCase().includes(query)
    )
    const filteredTools = options.filter((option) =>
      option.label.toLowerCase().includes(query)
    )

    return [...filteredBuiltIn, ...filteredTools]
  }, [toolSearchQuery, getToolOptions, builtInOptions])

  // Built-in slash commands
  type BuiltInCommandType = "navigation" | "model"
  interface BuiltInCommand {
    name: string
    description: string
    type: BuiltInCommandType
  }

  const builtInCommands = useMemo<BuiltInCommand[]>(() => [
    { name: "new-session", description: t("chat.commands.newSession"), type: "navigation" },
    { name: "copy", description: t("chat.commands.copy"), type: "navigation" },
    { name: "models", description: t("chat.commands.models"), type: "navigation" },
    { name: "settings", description: t("chat.commands.settings"), type: "navigation" },
    { name: "mcp", description: t("chat.commands.mcp"), type: "navigation" },
    { name: "model", description: t("chat.commands.model"), type: "model" },
  ], [t])

  // Unified slash item type for the combined menu
  interface SlashItem {
    key: string
    name: string
    description: string
    isBuiltIn: boolean
    commandType?: BuiltInCommandType
    [key: string]: unknown
  }

  // Filter combined slash items (built-in commands + skills)
  const getFilteredSlashItems = useCallback((): SlashItem[] => {
    const query = skillSearchQuery.toLowerCase()

    const builtInItems: SlashItem[] = builtInCommands
      .filter(cmd => !query || cmd.name.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query))
      .map(cmd => ({
        key: `builtin-${cmd.name}`,
        name: cmd.name,
        description: cmd.description,
        isBuiltIn: true,
        commandType: cmd.type,
      }))

    const skillItems: SlashItem[] = skills
      .filter(skill => !query || skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query))
      .map(skill => ({
        key: `skill-${skill.name}`,
        name: skill.name,
        description: skill.description,
        isBuiltIn: false,
      }))

    return [...builtInItems, ...skillItems]
  }, [skillSearchQuery, skills, builtInCommands])

  // Filter model options based on search query
  const getFilteredModelOptions = useCallback(() => {
    const query = modelSearchQuery.toLowerCase()

    if (!query) {
      return allModels
    }

    return allModels.filter(model =>
      model.name.toLowerCase().includes(query)
    )
  }, [modelSearchQuery, allModels])

  // Determine if we should show recent paths (initial state when entering path search mode)
  const isInitialPathSearch = useMemo(() => {
    // Check if path query is just "@/" or "@X:/" (initial trigger)
    const query = pathSearchQuery
    const isUnixInitial = query === "@/"
    const isWindowsInitial = /^@[A-Za-z]:[\\/]$/.test(query)
    // Show recent paths when query is just the initial trigger and we have recent paths
    return (isUnixInitial || isWindowsInitial) && recentPaths.length > 0
  }, [pathSearchQuery, recentPaths.length])

  // Get path menu items (recent paths or search results)
  const getPathMenuItems = useMemo(() => {
    if (isInitialPathSearch) {
      return recentPaths
    }
    return pathEntries
  }, [isInitialPathSearch, recentPaths, pathEntries])

  // Save path to recent paths
  const saveRecentPath = useCallback((entry: PathEntry) => {
    setRecentPaths(prev => {
      // Remove if already exists
      const filtered = prev.filter(p => p.path !== entry.path)
      // Add to beginning
      const updated = [entry, ...filtered].slice(0, MAX_RECENT_PATHS)
      // Save to localStorage
      try {
        localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(updated))
      } catch {
        // Ignore localStorage errors
      }
      return updated
    })
  }, [])

  // Debounced path search
  const searchPathDebounced = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    return (query: string) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(async () => {
        setIsSearchingPath(true)
        try {
          const result = await searchPath(query)
          if (!result.error) {
            setPathEntries(result.entries)
          } else {
            setPathEntries([])
          }
        } catch {
          setPathEntries([])
        } finally {
          setIsSearchingPath(false)
        }
      }, 150)
    }
  }, [])

  // Debounced fuzzy path search
  const fuzzySearchPathDebounced = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    return (basePath: string, query: string) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(async () => {
        setIsSearchingPath(true)
        try {
          const result = await fuzzySearchPath(basePath, query)
          if (!result.error) {
            setPathEntries(result.entries)
          } else {
            setPathEntries([])
          }
        } catch {
          setPathEntries([])
        } finally {
          setIsSearchingPath(false)
        }
      }, 150)
    }
  }, [])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart

    setMessage(newValue)

    const textBeforeCursor = newValue.substring(0, cursorPos)

    // Find the start of the current token (word)
    let tokenStart = -1
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = textBeforeCursor[i]
      if (char === " " || char === "\n") {
        tokenStart = i + 1
        break
      }
      if (i === 0) {
        tokenStart = 0
      }
    }

    if (tokenStart !== -1) {
      const currentToken = textBeforeCursor.substring(tokenStart)

      // Check if it's a path pattern with @ prefix:
      // 1. Unix-style: starts with "@/"
      // 2. Windows-style: @ followed by single letter and ":/" or ":\\" (e.g., @C:/)
      const isUnixPath = currentToken.startsWith("@/")
      const isWindowsPath = /^@[A-Za-z]:[\\/]/.test(currentToken)

      if (isUnixPath || isWindowsPath) {
        // Store the full token including @ for replacement later
        setPathSearchQuery(currentToken)
        setPathStartPos(tokenStart)
        setShowPathMenu(true)
        setSelectedPathIndex(0)
        setShowToolMenu(false)

        if (isFuzzyMode && fuzzyBasePath) {
          // In fuzzy mode - extract query from current token
          const pathPart = currentToken.substring(1) // Remove @ prefix
          // Query is everything after the fuzzy base path
          const query = pathPart.startsWith(fuzzyBasePath)
            ? pathPart.substring(fuzzyBasePath.length)
            : pathPart.substring(pathPart.lastIndexOf("/") + 1)
          setFuzzyQuery(query)
          fuzzySearchPathDebounced(fuzzyBasePath, query)
        } else {
          // Normal path search (strip the @ prefix for the actual search)
          searchPathDebounced(currentToken.substring(1))
        }
        return
      }
    }

    // Hide path menu if no valid path pattern found
    setShowPathMenu(false)
    setIsFuzzyMode(false)
    setFuzzyBasePath("")
    setFuzzyQuery("")

    // Check if @ symbol was just typed (original tool mention logic)
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
          return
        }
      }
    }

    // Hide menu if no valid @ mention found
    setShowToolMenu(false)

    // Check if / was just typed at the beginning of input or after space/newline (skill/command trigger)
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")

    if (lastSlashIndex !== -1) {
      // Check if there's a space/newline before / or it's at the start
      const charBeforeSlash = lastSlashIndex > 0 ? textBeforeCursor[lastSlashIndex - 1] : " "
      const isValidSkillTrigger = charBeforeSlash === " " || charBeforeSlash === "\n" || lastSlashIndex === 0

      if (isValidSkillTrigger) {
        const searchText = textBeforeCursor.substring(lastSlashIndex + 1)

        // Check for /model <query> pattern (model command with space and query)
        const modelMatch = searchText.match(/^model\s(.*)$/i)
        if (modelMatch) {
          setModelSearchQuery(modelMatch[1])
          setShowModelMenu(true)
          setSelectedModelIndex(0)
          setShowSkillMenu(false)
          setSkillStartPos(lastSlashIndex)
          return
        }

        // Show menu if / is followed by no space or only alphanumeric/dash characters
        if (!searchText.includes(" ") && !searchText.includes("\n") && /^[a-z0-9-]*$/i.test(searchText)) {
          setSkillSearchQuery(searchText)
          setSkillStartPos(lastSlashIndex)
          setShowSkillMenu(true)
          setSelectedSkillIndex(0)
          setShowModelMenu(false)
          return
        }
      }
    }

    // Hide skill menu and model menu if no valid / trigger found
    setShowSkillMenu(false)
    setShowModelMenu(false)
  }

  // Handle tool selection
  const selectTool = useCallback((toolValue: string) => {
    const beforeMention = message.substring(0, mentionStartPos)
    const afterMention = message.substring(mentionStartPos + toolSearchQuery.length + 1) // +1 for @
    const newMessage = beforeMention + "@" + toolValue + " " + afterMention

    setMessage(newMessage)
    setShowToolMenu(false)
    setToolSearchQuery("")

    // Focus back to textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + toolValue.length + 2 // +2 for @ and space
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [message, mentionStartPos, toolSearchQuery])

  // Handle path selection
  const selectPath = useCallback((entry: PathEntry) => {
    const beforePath = message.substring(0, pathStartPos)
    const afterPath = message.substring(pathStartPos + pathSearchQuery.length)

    // If it's a directory, append "/" to continue searching
    // Add @ prefix since our trigger pattern uses @
    const selectedPath = entry.isDir ? "@" + entry.path + "/" : "@" + entry.path + " "
    const newMessage = beforePath + selectedPath + afterPath

    setMessage(newMessage)

    // Save to recent paths
    saveRecentPath(entry)

    // Reset fuzzy mode on selection
    setIsFuzzyMode(false)
    setFuzzyBasePath("")
    setFuzzyQuery("")

    if (entry.isDir) {
      // Continue showing menu for directory navigation
      // pathSearchQuery includes @ prefix
      setPathSearchQuery("@" + entry.path + "/")
      setSelectedPathIndex(0)
      // Trigger new search for directory contents (without @ prefix)
      searchPathDebounced(entry.path + "/")
    } else {
      setShowPathMenu(false)
      setPathSearchQuery("")
    }

    // Focus and position cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforePath.length + selectedPath.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [message, pathStartPos, pathSearchQuery, searchPathDebounced, saveRecentPath])

  // Handle slash item selection (unified for built-in commands and skills)
  const selectSlashItem = useCallback((item: SlashItem) => {
    if (item.isBuiltIn) {
      // Handle built-in navigation commands
      if (item.commandType === "navigation") {
        switch (item.name) {
          case "new-session":
            navigate("/")
            break
          case "copy":
            if (lastMessage) {
              navigator.clipboard.writeText(lastMessage)
              showToast({ message: t("chat.copied"), type: "success" })
            }
            break
          case "models":
            openOverlay({ page: "Setting", tab: "Model" })
            break
          case "settings":
            openOverlay({ page: "Setting", tab: "System" })
            break
          case "mcp":
            openOverlay({ page: "Setting", tab: "Tools" })
            break
        }
        setMessage("")
        setShowSkillMenu(false)
        setSkillSearchQuery("")
        return
      }

      // Handle /model command - switch to model menu mode
      if (item.commandType === "model") {
        const newMessage = "/model "
        setMessage(newMessage)
        setShowSkillMenu(false)
        setSkillSearchQuery("")
        setShowModelMenu(true)
        setModelSearchQuery("")
        setSelectedModelIndex(0)

        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus()
            textareaRef.current.setSelectionRange(newMessage.length, newMessage.length)
          }
        }, 0)
        return
      }
    }

    // Handle regular skill selection (insert as text)
    const beforeSlash = message.substring(0, skillStartPos)
    const afterSlash = message.substring(skillStartPos + skillSearchQuery.length + 1) // +1 for /
    const newMessage = beforeSlash + "/" + item.name + " " + afterSlash

    setMessage(newMessage)
    setShowSkillMenu(false)
    setSkillSearchQuery("")

    // Focus back to textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeSlash.length + item.name.length + 2 // +2 for / and space
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [message, skillStartPos, skillSearchQuery, openOverlay])

  // Handle model selection from model menu
  const selectModelFromMenu = useCallback(async (option: ModelOption) => {
    setShowModelMenu(false)
    setModelSearchQuery("")
    setMessage("")

    try {
      await selectModel(option.value)
      showToast({
        message: t("chat.commands.modelChanged", { model: option.value.model.model }),
        type: "success"
      })
    } catch (error) {
      console.error(error)
      showToast({
        message: t("setup.saveFailed"),
        type: "error"
      })
    }

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 0)
  }, [selectModel, showToast, t])

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
    // Handle path menu keyboard navigation
    if (showPathMenu) {
      const menuItems = getPathMenuItems
      if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
        e.preventDefault()
        setSelectedPathIndex(prev => Math.min(prev + 1, menuItems.length - 1))
        return
      }
      if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
        e.preventDefault()
        setSelectedPathIndex(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && !e.altKey)) {
        e.preventDefault()
        if (menuItems[selectedPathIndex]) {
          selectPath({ name: menuItems[selectedPathIndex].name, path: menuItems[selectedPathIndex].path, isDir: menuItems[selectedPathIndex].isDir })
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setShowPathMenu(false)
        setIsFuzzyMode(false)
        setFuzzyBasePath("")
        setFuzzyQuery("")
        return
      }
      // Ctrl+S to toggle fuzzy mode
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault()
        if (!isFuzzyMode) {
          // Enter fuzzy mode - use current path as base
          const currentPath = pathSearchQuery.substring(1) // Remove @ prefix
          // Get the directory part of the current path
          const basePath = currentPath.endsWith("/") ? currentPath : currentPath.substring(0, currentPath.lastIndexOf("/") + 1) || "/"
          setIsFuzzyMode(true)
          setFuzzyBasePath(basePath)
          setFuzzyQuery("")
          setPathEntries([])
        } else {
          // Exit fuzzy mode
          setIsFuzzyMode(false)
          setFuzzyBasePath("")
          setFuzzyQuery("")
          // Refresh with normal search
          searchPathDebounced(pathSearchQuery.substring(1))
        }
        return
      }
      return
    }

    // Handle tool menu keyboard navigation
    if (showToolMenu) {
      const filteredOptions = getFilteredToolOptions()
      if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
        e.preventDefault()
        setSelectedToolIndex(prev => Math.min(prev + 1, filteredOptions.length - 1))
        return
      }
      if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
        e.preventDefault()
        setSelectedToolIndex(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && !e.altKey)) {
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
      return
    }

    // Handle model menu keyboard navigation
    if (showModelMenu) {
      const filteredOptions = getFilteredModelOptions()
      if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
        e.preventDefault()
        setSelectedModelIndex(prev => Math.min(prev + 1, filteredOptions.length - 1))
        return
      }
      if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
        e.preventDefault()
        setSelectedModelIndex(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && !e.altKey)) {
        e.preventDefault()
        if (filteredOptions[selectedModelIndex]) {
          selectModelFromMenu(filteredOptions[selectedModelIndex])
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setShowModelMenu(false)
        return
      }
      return
    }

    // Handle skill menu keyboard navigation
    if (showSkillMenu) {
      const filteredOptions = getFilteredSlashItems()
      if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
        e.preventDefault()
        setSelectedSkillIndex(prev => Math.min(prev + 1, filteredOptions.length - 1))
        return
      }
      if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
        e.preventDefault()
        setSelectedSkillIndex(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && !e.altKey)) {
        e.preventDefault()
        if (filteredOptions[selectedSkillIndex]) {
          selectSlashItem(filteredOptions[selectedSkillIndex])
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setShowSkillMenu(false)
        return
      }
      return
    }

    // chat-input:history-up
    // Handle message history navigation with ArrowUp/ArrowDown
    if (e.key === "ArrowUp" && !showToolMenu && !showPathMenu && !showSkillMenu && !showModelMenu) {
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

    if (e.key === "ArrowDown" && !showToolMenu && !showPathMenu && !showSkillMenu && !showModelMenu) {
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

    if (e.key !== "Enter" || e.shiftKey || isComposing.current) {
      return
    }

    if (e.altKey) {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newMessage = message.substring(0, start) + "\n" + message.substring(end)
      setMessage(newMessage)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
      return
    }

    if (messageDisabled || disabled) {
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
          <SuggestionMenu
            show={showToolMenu && getFilteredToolOptions().length > 0}
            items={getFilteredToolOptions().map(opt => ({ key: opt.value, ...opt }))}
            selectedIndex={selectedToolIndex}
            onSelectedIndexChange={setSelectedToolIndex}
            onSelect={(item) => selectTool(item.value)}
            onClose={() => setShowToolMenu(false)}
            textareaRef={textareaRef}
            renderItem={(item) => (
              <span className="chat-suggestion-label">{item.label}</span>
            )}
          />
          <SuggestionMenu
            show={showPathMenu}
            items={getPathMenuItems.map(entry => ({ key: entry.path, ...entry }))}
            selectedIndex={selectedPathIndex}
            onSelectedIndexChange={setSelectedPathIndex}
            onSelect={(item) => selectPath({ name: item.name, path: item.path, isDir: item.isDir })}
            onClose={() => {
              setShowPathMenu(false)
              setIsFuzzyMode(false)
              setFuzzyBasePath("")
              setFuzzyQuery("")
            }}
            textareaRef={textareaRef}
            isLoading={isSearchingPath}
            loadingContent={isFuzzyMode ? t("chat.fuzzySearching") : t("chat.searchingPath")}
            emptyContent={isFuzzyMode ? t("chat.noFuzzyResults") : t("chat.noPathResults")}
            headerContent={isFuzzyMode ? (
              <>🔍 {t("chat.fuzzyMode")} - {fuzzyBasePath}</>
            ) : isInitialPathSearch ? (
              <>🕐 {t("chat.recentPaths")}</>
            ) : undefined}
            renderItem={(item) => (
              <>
                <span className="chat-suggestion-icon">
                  {item.isDir ? "📁" : "📄"}
                </span>
                <span className="chat-suggestion-label">{isInitialPathSearch ? item.path : item.name}</span>
              </>
            )}
          />
          <SuggestionMenu<SlashItem>
            show={showSkillMenu && getFilteredSlashItems().length > 0}
            items={getFilteredSlashItems()}
            selectedIndex={selectedSkillIndex}
            onSelectedIndexChange={setSelectedSkillIndex}
            onSelect={(item) => selectSlashItem(item)}
            onClose={() => setShowSkillMenu(false)}
            textareaRef={textareaRef}
            renderItem={(item) => (
              <>
                <span className="chat-suggestion-label">/{item.name}</span>
                <span className="chat-suggestion-description">{item.description}</span>
                {item.isBuiltIn && (
                  <span className="chat-suggestion-badge">Built-in</span>
                )}
              </>
            )}
          />
          <SuggestionMenu
            show={showModelMenu}
            items={getFilteredModelOptions().map(m => ({ key: m.name, ...m }))}
            selectedIndex={selectedModelIndex}
            onSelectedIndexChange={setSelectedModelIndex}
            onSelect={(item) => {
              const modelItem = item as unknown as ModelOption & { key: string }
              selectModelFromMenu(modelItem)
            }}
            onClose={() => setShowModelMenu(false)}
            textareaRef={textareaRef}
            emptyContent={t("chat.commands.noModelsFound")}
            headerContent={<>{t("chat.commands.selectModel")}</>}
            renderItem={(item) => {
              const modelItem = item as unknown as ModelOption & { key: string }
              return (
                <div className="model-suggestion-item">
                  <img
                    src={PROVIDER_ICONS[modelItem.provider]}
                    alt={modelItem.provider}
                    className={`model-suggestion-icon ${isProviderIconNoFilter(modelItem.provider, userTheme, systemTheme) ? "no-filter" : ""}`}
                  />
                  <span className="chat-suggestion-label">{modelItem.name}</span>
                </div>
              )
            }}
          />
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
