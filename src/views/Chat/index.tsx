import React, { useRef, useState, useCallback, useEffect } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import type { ElicitRequestFormParams, ElicitResult } from "@modelcontextprotocol/sdk/types.js"
import ChatMessages, { Message, ChatMessagesRef } from "./ChatMessages"
import ChatInput from "../../components/ChatInput"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { codeStreamingAtom } from "../../atoms/codeStreaming"
import useHotkeyEvent from "../../hooks/useHotkeyEvent"
import { showToastAtom } from "../../atoms/toastState"
import { useTranslation } from "react-i18next"
import { currentChatIdAtom, isChatStreamingAtom, lastMessageAtom, messagesMapAtom, chatStreamingStatusMapAtom, streamingStateMapAtom } from "../../atoms/chatState"
import { safeBase64Encode } from "../../util"
import { loadOapToolsAtom, updateOAPUsageAtom } from "../../atoms/oapState"
import { loadHistoriesAtom } from "../../atoms/historyState"
import { openOverlayAtom } from "../../atoms/layerState"
import PopupConfirm from "../../components/PopupConfirm"
import PopupElicitationRequest from "../../components/PopupElicitationRequest"
import { authorizeStateAtom } from "../../atoms/globalState"
import { readLocalFile } from "../../ipc/util"
import "../../styles/pages/_Chat.scss"
import { registBackendEvent, responseLocalIPCElicitation } from "../../ipc"
import camelcaseKeys from "camelcase-keys"
import { forceRestartMcpConfigAtom, loadToolsAtom, Tool, toolsAtom } from "../../atoms/toolState"
import "../../styles/pages/_Chat.scss"
import { createPortal } from "react-dom"

// Elicitation request state type using MCP SDK types
interface ElicitationRequestState {
  requestId: string
  message: string
  requestedSchema: ElicitRequestFormParams["requestedSchema"]
}

interface ToolCall {
  name: string
  arguments: any
}

interface ToolResult {
  name: string
  result: any
}

interface RawMessage {
  id: string
  createdAt: string
  content: string
  role: "user" | "assistant" | "tool_call" | "tool_result"
  chatId: string
  messageId: string
  toolCalls?: ToolCall[] | Record<string, ToolCall[]>
  resource_usage: {
    model: string
    total_input_tokens: number
    total_output_tokens: number
    total_run_time: number
    time_to_first_token: number
    tokens_per_second: number
    user_token: number
    langchain_token: number
    custom_prompt_token: number
    system_prompt_token: number
    mcp_tool_prompt_token: number
  }
  files: File[]
}

const ChatWindow = () => {
  const { chatId } = useParams()
  const location = useLocation()
  // Store messages per chatId
  const [messagesMap, setMessagesMap] = useAtom(messagesMapAtom)
  const [messages, setMessages] = useState<Message[]>([])
  const currentId = useRef(0)
  const chatMessagesRef = useRef<ChatMessagesRef>(null)
  const currentChatIdRef = useRef<string | null>(null)
  const navigate = useNavigate()
  const isInitialMessageHandled = useRef(false)
  const showToast = useSetAtom(showToastAtom)
  const { t } = useTranslation()
  const updateStreamingCode = useSetAtom(codeStreamingAtom)
  const setLastMessage = useSetAtom(lastMessageAtom)
  const currentChatId = useAtomValue(currentChatIdAtom)
  const setCurrentChatId = useSetAtom(currentChatIdAtom)
  const [isChatStreaming, setIsChatStreaming] = useAtom(isChatStreamingAtom)
  // Store streaming status per chatId
  const [chatStreamingStatusMap, setChatStreamingStatusMap] = useAtom(chatStreamingStatusMapAtom)
  // Store streaming state per chatId
  const [streamingStateMap, setStreamingStateMap] = useAtom(streamingStateMapAtom)
  const toolKeyRef = useRef(0)
  const agentToolKeyRef = useRef(0)
  const updateOAPUsage = useSetAtom(updateOAPUsageAtom)
  const loadHistories = useSetAtom(loadHistoriesAtom)
  const openOverlay = useSetAtom(openOverlayAtom)
  const [showAuthorizePopup, setShowAuthorizePopup] = useState(false)
  const [currentTool, setCurrentTool] = useState<Tool | null>(null)
  const setAuthorizeState = useSetAtom(authorizeStateAtom)
  const isAuthorizing = useRef(false)
  const allTools = useAtomValue(toolsAtom)
  const authorizeState = useAtomValue(authorizeStateAtom)
  const [cancelingAuthorize, setCancelingAuthorize] = useState(false)
  const [isLoadingChat, setIsLoadingChat] = useState(false)
  const forceRestartMcpConfig = useSetAtom(forceRestartMcpConfigAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [elicitationRequest, setElicitationRequest] = useState<ElicitationRequestState | null>(null)
  const loadTools = useSetAtom(loadToolsAtom)

  // via local ipc
  useEffect(() => {
    const unlistenMcpElicitation = registBackendEvent("mcp.elicitation", (data) => {
      const payload = camelcaseKeys(JSON.parse(data), { deep: true })
      console.log({payload})
      setElicitationRequest(payload)
    })

    return () => {
      unlistenMcpElicitation()
    }
  }, [])

  // Helper function to set streaming status for a specific chatId
  const setChatStreamingStatus = useCallback((targetChatId: string, isStreaming: boolean) => {
    setChatStreamingStatusMap(prev => {
      const newMap = new Map(prev)
      newMap.set(targetChatId, isStreaming)
      return newMap
    })

    // Update global streaming state if this is the current chat
    // Use currentChatId.current to get the real-time current chat
    if (currentChatIdRef.current === targetChatId) {
      setIsChatStreaming(isStreaming)
    } else {
      // Always update for temp chats or when chatId is empty
      setIsChatStreaming(isStreaming)
    }
  }, [setIsChatStreaming, setChatStreamingStatusMap])

  // Helper function to update messages for a specific chatId
  const updateMessagesForChat = useCallback((targetChatId: string, updater: (prev: Message[]) => Message[]) => {
    setMessagesMap(prev => {
      const currentMessages = prev.get(targetChatId) || []
      const newMessages = updater(currentMessages)
      const newMap = new Map(prev)
      newMap.set(targetChatId, newMessages)

      // Only update the displayed messages if this is the current chat
      // Use currentChatIdRef.current to get the real-time current chat
      if (currentChatIdRef.current === targetChatId) {
        setMessages(newMessages)
      }

      return newMap
    })
  }, [setMessagesMap])

  const loadChat = useCallback(async (id: string) => {
    // Immediately update currentChatIdRef to prevent race conditions
    currentChatIdRef.current = id

    // Handle temporary chat
    if (id.startsWith("__temp__")) {
      const tempMessages = messagesMap.get(id) || []
      setMessages(tempMessages)
      setChatStreamingStatus(id, chatStreamingStatusMap.get(id) || false)
      return
    }

    // If messages already exist in messagesMap and chat is streaming, use cached messages
    const cachedMessages = messagesMap.get(id)
    const isStreaming = chatStreamingStatusMap.get(id)
    if (cachedMessages && isStreaming) {
      setMessages([...cachedMessages])  // Use spread to create new array reference
      setChatStreamingStatus(id, true)
      return
    }

    // Also use cached messages if available, even if not streaming
    if (cachedMessages) {
      setIsLoadingChat(true)
      // Small delay to show loading transition
      await new Promise(resolve => setTimeout(resolve, 50))
      setMessages([...cachedMessages])  // Use spread to create new array reference
      setChatStreamingStatus(id, false)
      setIsLoadingChat(false)
      return
    }

    // Clear messages immediately when loading new chat to prevent showing stale data
    setMessages([])
    setIsLoadingChat(true)

    try {
      const response = await fetch(`/api/chat/${id}`)
      const data = await response.json()

      if (data.success) {
        document.title = `${data.data.chat.title.substring(0, 40)}${data.data.chat.title.length > 40 ? "..." : ""} - Dive AI`

        const rawToMessage = (msg: RawMessage): Message => ({
          id: msg.messageId || msg.id || String(currentId.current++),
          text: msg.content,
          isSent: msg.role === "user",
          timestamp: new Date(msg.createdAt).getTime(),
          files: msg.files,
          resourceUsage: msg.resource_usage
        })

        let toolCallBuf: any[] = []
        let toolResultBuf: string[] = []

        const messages = data.data.messages
        const convertedMessages = messages
          .reduce((acc: Message[], msg: RawMessage, index: number) => {
            // push user message and first assistant message
            if (msg.role === "user") {
              acc.push(rawToMessage(msg))
              return acc
            }

            const isLastSent = acc[acc.length - 1].isSent

            // merge files from user message and assistant message
            if (!isLastSent) {
              acc[acc.length - 1].files = [
                ...(acc[acc.length - 1].files || []),
                ...(msg.files || [])
              ]
            }

            switch (msg.role) {
              case "tool_call":
                toolCallBuf.push(JSON.parse(msg.content))
                if (isLastSent) {
                  acc.push(rawToMessage({ ...msg, content: "" }))
                }
                break
              case "tool_result":
                toolResultBuf.push(msg.content)
                if (messages[index + 1]?.role === "tool_result") {
                  break
                }

                const [callContent, toolsName] = toolCallBuf.reduce((_acc, call) => {
                  _acc[0] += `##Tool Calls:${safeBase64Encode(JSON.stringify(call))}`

                  const toolName = Array.isArray(call) ? call[0]?.name : call.name || ""
                  toolName && _acc[1].add(toolName)
                  return _acc
                }, ["", new Set()])

                const resultContent = toolResultBuf.reduce((_acc, result) =>
                  _acc + `##Tool Result:${safeBase64Encode(result)}`
                , "")

                const content = `${callContent}${resultContent}`
                const toolName = toolsName.size > 0 ? JSON.stringify(Array.from(toolsName).join(", ")) : ""

                // eslint-disable-next-line quotes
                acc[acc.length - 1].text += `\n<tool-call toolkey=${toolKeyRef.current} name=${toolName || '""'}>${content}</tool-call>\n\n`
                toolKeyRef.current++

                toolCallBuf = []
                toolResultBuf = []
                break
              case "assistant":
                const isToolCall = (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) || (typeof msg.toolCalls === "object" && Object.keys(msg.toolCalls).length > 0)
                if (isToolCall) {
                  if (isLastSent) {
                    acc.push(rawToMessage({ ...msg, content: msg.content }))
                  } else if(msg.content && toolCallBuf.length === 0) {
                    acc[acc.length - 1].text += msg.content
                    acc[acc.length - 1].resourceUsage = msg.resource_usage
                  }

                  toolCallBuf.push(msg.toolCalls)
                  break
                }

                if (isLastSent) {
                  acc.push(rawToMessage(msg))
                } else {
                  acc[acc.length - 1].text += msg.content
                  acc[acc.length - 1].resourceUsage = msg.resource_usage
                }
                break
            }

            return acc
          }, [])

        // Store messages in the map and set current messages
        setMessagesMap(prev => {
          const newMap = new Map(prev)
          newMap.set(id, convertedMessages)
          return newMap
        })
        setMessages(convertedMessages)
      }
    } catch (error) {
      console.warn("Failed to load chat:", error)
    } finally {
      setIsLoadingChat(false)
    }
  }, [setChatStreamingStatus, messagesMap, chatStreamingStatusMap, setMessagesMap])

  useHotkeyEvent("chat-message:copy-last", async () => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage) {
      await navigator.clipboard.writeText(lastMessage.text)
      showToast({
        message: t("toast.copiedToClipboard"),
        type: "success"
      })
    }
  })

  useEffect(() => {
    if (messages.length > 0 && !isChatStreaming) {
      setLastMessage(messages[messages.length - 1].text)
    }
  }, [messages, setLastMessage, isChatStreaming])

  useEffect(() => {
    // when chatId changes, setMessages from cache(messagesMap) or load the chat
    if (chatId) {
      if(chatId !== currentChatIdRef.current) {
        loadChat(chatId)
        currentChatIdRef.current = chatId
        setCurrentChatId(chatId)
        navigate(`/chat/${chatId}`)
      }
      const isStreaming = chatStreamingStatusMap.get(chatId) || false
      setIsChatStreaming(isStreaming)
    } else {
      // Handle temp chats when chatId is empty
      const tempChatStreaming = Array.from(chatStreamingStatusMap.entries()).some(([id, isStreaming]) => {
        const isTempAndStreaming = id.startsWith("__temp__") && isStreaming
        return isTempAndStreaming
      })
      setIsChatStreaming(tempChatStreaming)
    }
  }, [chatId, loadChat])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      chatMessagesRef.current?.scrollToBottom()
    }, 100)
  }, [])

  const onSendMsg = useCallback(async (msg: string, files?: FileList) => {

    // Only block if the CURRENT chat is streaming
    // Allow new chats (chatId === undefined) even if another chat is streaming
    if (chatId && chatStreamingStatusMap.get(chatId)) {
      return
    }

    // Priority: chatId (URL param) > "" (new chat)
    // Use chatId from URL to ensure we're sending to the correct chat
    const targetChatId = chatId || `${"__temp__"}${Date.now()}${Math.random()}`
    // Set currentChatId to targetChatId (including temp IDs) so messages update correctly
    currentChatIdRef.current = targetChatId

    const formData = new FormData()
    if (msg)
      formData.append("message", msg)

    // Only append chatId if it's a real chat (not temp)
    if (chatId && chatId !== "")
      formData.append("chatId", chatId)

    if (files) {
      Array.from(files).forEach(file => {
        formData.append("files", file)
      })
    }

    // id format: targetChatId-currentId
    // if only use currentId, it will cause the message id is not unique when chatId changes
    // then Message component will not update when chatId changes
    const userMessage: Message = {
      id: `${targetChatId}-${currentId.current++}`,
      text: msg,
      isSent: true,
      timestamp: Date.now(),
      files: files ? Array.from(files) : undefined
    }

    const aiMessage: Message = {
      id: `${targetChatId}-${currentId.current++}`,
      text: "",
      isSent: false,
      timestamp: Date.now()
    }

    updateMessagesForChat(targetChatId, prev => [...prev, userMessage, aiMessage])
    setChatStreamingStatus(targetChatId, true)
    // Explicitly set global streaming state to ensure it's updated immediately
    setIsChatStreaming(true)
    scrollToBottom()

    handlePost(formData, "formData", "/api/chat", targetChatId)
  }, [chatStreamingStatusMap, scrollToBottom, allTools, chatId, updateMessagesForChat, setChatStreamingStatus])

  const onAbort = useCallback(async () => {
    if (!isChatStreaming || !currentChatIdRef.current)
      return

    const chatReader = streamingStateMap.get(currentChatIdRef.current)?.chatReader
    if(chatReader) {
      chatReader.cancel()
    }

    try {
      await fetch(`/api/chat/${currentChatIdRef.current}/abort`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed abort:", error)
    }
  }, [isChatStreaming, currentChatIdRef.current, scrollToBottom])

  const onRetry = useCallback(async (messageId: string) => {
    if (isChatStreaming || !currentChatIdRef.current)
      return

    const targetChatId = currentChatIdRef.current

    let prevMessages = {} as Message
    updateMessagesForChat(targetChatId, prev => {
      let newMessages = [...prev]
      const messageIndex = newMessages.findIndex(msg => msg.id === messageId)
      if (messageIndex !== -1) {
        prevMessages = newMessages[messageIndex]
        prevMessages.text = ""
        prevMessages.isError = false
        newMessages = newMessages.slice(0, messageIndex)
      }
      return newMessages
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    updateMessagesForChat(targetChatId, prev => {
      const newMessages = [...prev]
      newMessages.push(prevMessages)
      return newMessages
    })
    setChatStreamingStatus(targetChatId, true)
    scrollToBottom()

    const body = JSON.stringify({
      chatId: currentChatIdRef.current,
      messageId: prevMessages.isSent ? prevMessages.id : messageId,
    })

    handlePost(body, "json", "/api/chat/retry", targetChatId)
  }, [isChatStreaming, currentChatIdRef.current, updateMessagesForChat, setChatStreamingStatus])

  const onEdit = useCallback(async (messageId: string, newText: string) => {
    if (isChatStreaming || !currentChatIdRef.current)
      return

    const targetChatId = currentChatIdRef.current

    let prevMessages = {} as Message
    let editedMessageFiles: (File | string)[] | undefined
    updateMessagesForChat(targetChatId, prev => {
      let newMessages = [...prev]
      const messageIndex = newMessages.findIndex(msg => msg.id === messageId)
      if (messageIndex !== -1) {
        // Get files from the edited message before updating
        editedMessageFiles = newMessages[messageIndex].files

        // Update the edited message text
        newMessages[messageIndex].text = newText

        prevMessages = newMessages[messageIndex + 1]
        prevMessages.text = ""
        prevMessages.isError = false
        newMessages = newMessages.slice(0, messageIndex+1)
      }
      return newMessages
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    updateMessagesForChat(targetChatId, prev => {
      const newMessages = [...prev]
      newMessages.push(prevMessages)
      return newMessages
    })
    setChatStreamingStatus(targetChatId, true)
    scrollToBottom()

    const body = new FormData()
    body.append("chatId", currentChatIdRef.current)
    body.append("messageId", prevMessages.isSent ? prevMessages.id : messageId)
    body.append("content", newText)

    // Convert files to File objects and append to FormData
    if (editedMessageFiles && editedMessageFiles.length > 0) {
      for (const file of editedMessageFiles) {
        if (file instanceof File) {
          body.append("files", file)
        } else if (typeof file === "string") {
          // Convert file path string to File object
          try {
            if (file.startsWith("http") || file.startsWith("data:") || file.startsWith("blob:")) {
              // Remote URL - use fetch
              const response = await fetch(file)
              const blob = await response.blob()
              const fileName = file.split("/").pop() || "file"
              const fileObj = new File([blob], fileName, { type: blob.type })
              body.append("files", fileObj)
            } else {
              // Local file path - use readLocalFile
              const fileObj = await readLocalFile(file)
              body.append("files", fileObj)
            }
          } catch (err) {
            console.error("Failed to read file:", file, err)
          }
        }
      }
    }

    handlePost(body, "formData", "/api/chat/edit", targetChatId)
  }, [isChatStreaming, currentChatIdRef.current, updateMessagesForChat, setChatStreamingStatus])

  const handlePost = useCallback(async (body: any, type: "json" | "formData", url: string, initialChatId: string) => {
    // Use a ref to track the current chatId (may change when chat_info is received)
    let targetChatId = initialChatId

    // Initialize or get streaming state for this chatId
    if (!streamingStateMap.has(targetChatId)) {
      setStreamingStateMap(prev => {
        const newMap = new Map(prev)
        newMap.set(targetChatId, {
          currentText: "",
          toolCallResults: "",
          toolResultCount: 0,
          toolResultTotal: 0,
          agentToolCallResults: "",
          agentToolResultCount: 0,
          agentToolResultTotal: 0,
          chatReader: null
        })
        return newMap
      })
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: type === "json" ? {
          "Content-Type": "application/json",
        } : {},
        body: body
      })

      const chatReader = response.body!.getReader()
      setStreamingStateMap(prev => {
        const newMap = new Map(prev)
        newMap.set(targetChatId, {
          ...newMap.get(targetChatId)!,
          chatReader: chatReader
        })
        return newMap
      })
      const decoder = new TextDecoder()
      let chunkBuf = ""
      // clear authorize state
      setAuthorizeState(null)

      while (true) {
        const { value, done } = await chatReader.read()
        if (done) {
          break
        }

        const chunk = decoder.decode(value)
        const lines = (chunkBuf + chunk).split("\n")
        chunkBuf = lines.pop() || ""

        for (const line of lines) {
          if (line.trim() === "" || !line.startsWith("data: "))
            continue

          const dataStr = line.slice(5)
          if (dataStr.trim() === "[DONE]")
            break

          try {
            const dataObj = JSON.parse(dataStr)
            if (dataObj.error) {
              updateMessagesForChat(targetChatId, prev => {
                const newMessages = [...prev]
                newMessages[newMessages.length - 1] = {
                  id: `${currentId.current++}`,
                  text: `Error: ${dataObj.error}`,
                  isSent: false,
                  timestamp: Date.now(),
                  isError: true
                }
                return newMessages
              })
              break
            }

            const data = JSON.parse(dataObj.message)
            // when message is not interactive, it means the authorization is completed
            if(data.type && data.type !== "interactive") {
              isAuthorizing.current = false
            }

            switch (data.type) {
              case "text":
                let updatedCurrentText = ""
                setStreamingStateMap(prev => {
                  const newMap = new Map(prev)
                  const oldState = newMap.get(targetChatId)!
                  const newState = { ...oldState, currentText: oldState.currentText + data.content }
                  newMap.set(targetChatId, newState)
                  updatedCurrentText = newState.currentText
                  return newMap
                })
                updateMessagesForChat(targetChatId, prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].text = updatedCurrentText
                  return newMessages
                })
                break

              case "tool_calls":
                const toolCalls = data.content as ToolCall[]
                if (data.content?.every((call: {name: string}) => !call.name)) {
                  continue
                }

                const tools = data.content
                  ?.filter((call: {name: string}) => call.name !== "")
                  ?.map((call: {name: string}) => call.name) || []

                const uniqTools = new Set(tools)
                const toolNameByCall = uniqTools.size === 0 ? "%name%" : Array.from(uniqTools).join(", ")

                let updatedToolState = { currentText: "", toolCallResults: "" }
                setStreamingStateMap(prev => {
                  const newMap = new Map(prev)
                  const oldState = newMap.get(targetChatId)!
                  const newState = {
                    ...oldState,
                    toolResultTotal: tools.length,
                    toolCallResults: oldState.toolCallResults + `\n<tool-call toolkey=${toolKeyRef.current} name="${toolNameByCall}">##Tool Calls:${safeBase64Encode(JSON.stringify(toolCalls))}`
                  }
                  newMap.set(targetChatId, newState)
                  updatedToolState = { currentText: newState.currentText, toolCallResults: newState.toolCallResults }
                  return newMap
                })
                updateMessagesForChat(targetChatId, prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].text = updatedToolState.currentText + updatedToolState.toolCallResults + "</tool-call>"
                  return newMessages
                })
                toolKeyRef.current++
                break

              case "tool_result":
                const result = data.content as ToolResult
                if (result.name === "install_mcp_server") {
                  loadTools()
                }

                let updatedResultState = { currentText: "", toolCallResults: "" }
                setStreamingStateMap(prev => {
                  const newMap = new Map(prev)
                  const oldState = newMap.get(targetChatId)!

                  let newToolCallResults = oldState.toolCallResults.replace("</tool-call>\n", "")
                  newToolCallResults += `##Tool Result:${safeBase64Encode(JSON.stringify(result.result))}</tool-call>\n`

                  const newToolResultCount = oldState.toolResultCount + 1
                  let newCurrentText = oldState.currentText
                  let finalToolCallResults = newToolCallResults
                  let finalToolResultTotal = oldState.toolResultTotal
                  let finalToolResultCount = newToolResultCount

                  if (oldState.toolResultTotal === newToolResultCount) {
                    newCurrentText += newToolCallResults.replace("%name%", result.name)
                    finalToolCallResults = ""
                    finalToolResultTotal = 0
                    finalToolResultCount = 0
                  }

                  const newState = {
                    ...oldState,
                    currentText: newCurrentText,
                    toolCallResults: finalToolCallResults,
                    toolResultCount: finalToolResultCount,
                    toolResultTotal: finalToolResultTotal
                  }
                  newMap.set(targetChatId, newState)
                  updatedResultState = { currentText: newState.currentText, toolCallResults: newState.toolCallResults }
                  return newMap
                })

                updateMessagesForChat(targetChatId, prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].text = updatedResultState.currentText + updatedResultState.toolCallResults.replace("%name%", result.name)
                  return newMessages
                })

                break

              case "chat_info":
                const newChatId = data.content.id
                const originalTargetChatId = targetChatId
                let movedMessages: Message[] = []

                // If this is a new chat (targetChatId was empty), move messages and streaming state to the new chatId
                if (targetChatId.startsWith("__temp__") || targetChatId !== newChatId) {
                  setMessagesMap(prev => {
                    const newMap = new Map(prev)
                    const currentMessages = newMap.get(targetChatId)
                    if (currentMessages) {
                      newMap.set(newChatId, currentMessages)
                      newMap.delete(targetChatId)
                      movedMessages = currentMessages
                    }
                    return newMap
                  })

                  setStreamingStateMap(prev => {
                    const newMap = new Map(prev)
                    const currentState = newMap.get(targetChatId)
                    if (currentState) {
                      newMap.set(newChatId, currentState)
                      newMap.delete(targetChatId)
                    }
                    return newMap
                  })

                  setChatStreamingStatusMap(prev => {
                    const newMap = new Map(prev)
                    const streamingStatus = newMap.get(targetChatId)
                    // If streamingStatus is undefined, it means the state update hasn't propagated yet
                    // Since we're in the middle of streaming (chat_info is sent during streaming),
                    // we should assume streaming is true
                    const actualStatus = streamingStatus !== undefined ? streamingStatus : true
                    newMap.set(newChatId, actualStatus)
                    newMap.delete(targetChatId)
                    return newMap
                  })
                  // Also update the global streaming state
                  setIsChatStreaming(true)
                  targetChatId = newChatId
                }

                loadHistories()

                // Only navigate if user is currently viewing this chat (check URL chatId)
                // or if this is a new chat being created (originalTargetChatId was temp and currentChatId matches)
                const isViewingThisChat = currentChatId === originalTargetChatId || currentChatId === newChatId || (!chatId && (originalTargetChatId.startsWith("__temp__") || originalTargetChatId === "" || !currentChatIdRef.current))

                if (isViewingThisChat) {
                  document.title = `${data.content.title.substring(0, 40)}${data.content.title.length > 40 ? "..." : ""} - Dive AI`
                  currentChatIdRef.current = newChatId
                  // Update the displayed messages before navigating
                  // Use movedMessages if available (from the setMessagesMap callback)
                  if (movedMessages.length > 0) {
                    setMessages(movedMessages)
                  }
                }

                if((!chatId && (originalTargetChatId.startsWith("__temp__") || originalTargetChatId === "" || !currentChatIdRef.current))) {
                  navigate(`/chat/${newChatId}`, { replace: true })
                  setCurrentChatId(newChatId)
                }
                break

              case "message_info":
                updateMessagesForChat(targetChatId, prev => {
                  const newMessages = [...prev]
                  if(data.content.userMessageId) {
                    newMessages[newMessages.length - 2].id = data.content.userMessageId
                  }
                  if(data.content.assistantMessageId) {
                    newMessages[newMessages.length - 1].id = data.content.assistantMessageId
                  }
                  return newMessages
                })
                break

              case "interactive":
                try {
                  const interactiveType = data.content.type
                  const interactiveContent = data.content.content

                  if (interactiveType === "authentication_required") {
                    if(isAuthorizing.current) {
                      continue
                    }
                    setIsLoading(true)
                    await forceRestartMcpConfig()
                    setIsLoading(false)

                    isAuthorizing.current = true

                    const authUrl = new URL(interactiveContent.auth_url)
                    const state = authUrl.searchParams.get("state")
                    if (state) {
                      setAuthorizeState(state)
                      const tool = allTools.find((_tool: Tool) => _tool.name === interactiveContent.server_name)
                      if (tool) {
                        setCurrentTool(tool)
                        setShowAuthorizePopup(true)
                      } else {
                        setShowAuthorizePopup(false)
                      }
                    } else {
                      setShowAuthorizePopup(false)
                    }
                  } else if (interactiveType === "elicitation_request") {
                    setElicitationRequest({
                      requestId: interactiveContent.request_id,
                      message: interactiveContent.message,
                      requestedSchema: interactiveContent.requested_schema,
                    })
                  }
                } catch (error) {
                  console.warn(error)
                }
                break

              case "token_usage":
                updateMessagesForChat(targetChatId, prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].resourceUsage = {
                    model: data.content.modelName,
                    total_input_tokens: data.content.inputTokens,
                    total_output_tokens: data.content.outputTokens,
                    user_token: data.content.userToken,
                    custom_prompt_token: data.content.customPromptToken,
                    system_prompt_token: data.content.systemPromptToken,
                    time_to_first_token: data.content.timeToFirstToken,
                    tokens_per_second: data.content.tokensPerSecond,
                    total_run_time: 0
                  }
                  return newMessages
                })
                break

              case "error":
                let updatedErrorText = ""
                setStreamingStateMap(prev => {
                  const newMap = new Map(prev)
                  const oldState = newMap.get(targetChatId)!
                  const newState = { ...oldState, currentText: oldState.currentText + `\n\n${data.content?.message ?? ""}` }
                  newMap.set(targetChatId, newState)
                  updatedErrorText = newState.currentText
                  return newMap
                })
                if(data.content.type === "rate_limit_exceeded") {
                  updateMessagesForChat(targetChatId, prev => {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1].text = updatedErrorText + "\n\n<rate-limit-exceeded></rate-limit-exceeded>"
                    newMessages[newMessages.length - 1].isRateLimitExceeded = true
                    newMessages[newMessages.length - 1].isError = true
                    return newMessages
                  })
                } else {
                  updateMessagesForChat(targetChatId, prev => {
                    const newMessages = [...prev]
                    newMessages[newMessages.length - 1].text = updatedErrorText
                    newMessages[newMessages.length - 1].isError = true
                    return newMessages
                  })
                }
                break

              case "agent_tool_call":
                const agentToolCalls = Array.isArray(data.content) ? data.content : [data.content]
                if (agentToolCalls.every((call: {name: string}) => !call.name)) {
                  continue
                }

                const agentTools = agentToolCalls
                  .filter((call: {name: string}) => call.name !== "")
                  .map((call: {name: string}) => call.name)

                const uniqAgentTools = new Set(agentTools)
                const agentToolName = uniqAgentTools.size === 0 ? "%name%" : Array.from(uniqAgentTools).join(", ")

                let updatedAgentToolState = { currentText: "", agentToolCallResults: "" }
                setStreamingStateMap(prev => {
                  const newMap = new Map(prev)
                  const oldState = newMap.get(targetChatId)!
                  const newState = {
                    ...oldState,
                    agentToolResultTotal: agentTools.length,
                    agentToolCallResults: oldState.agentToolCallResults + `\n<agent-tool-call toolkey=${agentToolKeyRef.current} name="${agentToolName}">##Tool Calls:${safeBase64Encode(JSON.stringify(agentToolCalls))}`
                  }
                  newMap.set(targetChatId, newState)
                  updatedAgentToolState = { currentText: newState.currentText, agentToolCallResults: newState.agentToolCallResults }
                  return newMap
                })
                updateMessagesForChat(targetChatId, prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].text = updatedAgentToolState.currentText + updatedAgentToolState.agentToolCallResults + "</agent-tool-call>"
                  return newMessages
                })
                agentToolKeyRef.current++
                break

              case "agent_tool_result":
                const agentResult = data.content as ToolResult

                let updatedAgentResultState = { currentText: "", agentToolCallResults: "" }
                setStreamingStateMap(prev => {
                  const newMap = new Map(prev)
                  const oldState = newMap.get(targetChatId)!

                  let newAgentToolCallResults = oldState.agentToolCallResults.replace("</agent-tool-call>\n", "")
                  newAgentToolCallResults += `##Tool Result:${safeBase64Encode(JSON.stringify(agentResult.result))}</agent-tool-call>\n`

                  const newAgentToolResultCount = oldState.agentToolResultCount + 1
                  let newCurrentText = oldState.currentText
                  let finalAgentToolCallResults = newAgentToolCallResults
                  let finalAgentToolResultTotal = oldState.agentToolResultTotal
                  let finalAgentToolResultCount = newAgentToolResultCount

                  if (oldState.agentToolResultTotal === newAgentToolResultCount) {
                    newCurrentText += newAgentToolCallResults.replace("%name%", agentResult.name)
                    finalAgentToolCallResults = ""
                    finalAgentToolResultTotal = 0
                    finalAgentToolResultCount = 0
                  }

                  const newState = {
                    ...oldState,
                    currentText: newCurrentText,
                    agentToolCallResults: finalAgentToolCallResults,
                    agentToolResultCount: finalAgentToolResultCount,
                    agentToolResultTotal: finalAgentToolResultTotal
                  }
                  newMap.set(targetChatId, newState)
                  updatedAgentResultState = { currentText: newState.currentText, agentToolCallResults: newState.agentToolCallResults }
                  return newMap
                })

                updateMessagesForChat(targetChatId, prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].text = updatedAgentResultState.currentText + updatedAgentResultState.agentToolCallResults.replace("%name%", agentResult.name)
                  return newMessages
                })

                break
            }
          } catch (error) {
            console.warn(error)
          }
        }
      }
    } catch (error: any) {
      updateMessagesForChat(targetChatId, prev => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          id: `${currentId.current++}`,
          text: `${error.message}`,
          isSent: false,
          timestamp: Date.now(),
          isError: true
        }
        return newMessages
      })
    } finally {
      // Clean up streaming state for this chatId
      setStreamingStateMap(prev => {
        const newMap = new Map(prev)
        newMap.delete(targetChatId)
        return newMap
      })
      setChatStreamingStatus(targetChatId, false)

      updateOAPUsage()
      loadHistories()
    }
  }, [allTools, updateMessagesForChat, setChatStreamingStatus, scrollToBottom, updateOAPUsage, loadHistories, streamingStateMap, setStreamingStateMap, setMessagesMap, setChatStreamingStatusMap])

  const handleInitialMessage = useCallback(async (message: string, files?: File[]) => {
    if (files && files.length > 0) {
      const fileList = new DataTransfer()
      files.forEach(file => fileList.items.add(file))
      await onSendMsg(message, fileList.files)
    } else {
      await onSendMsg(message)
    }
    // Only clear state if we're still on the original page (no chatId in URL yet)
    // If chat_info has already navigated us to /chat/{newChatId}, don't navigate again
    if (!window.location.pathname.includes("/chat/")) {
      navigate(location.pathname, { replace: true, state: {} })
    } else {
      navigate(window.location.pathname, { replace: true, state: {} })
    }
  }, [onSendMsg, navigate, location.pathname, chatId])

  useEffect(() => {
    const state = location.state as { initialMessage?: string, files?: File[] } | null

    if ((state?.initialMessage || state?.files) && !isInitialMessageHandled.current) {
      isInitialMessageHandled.current = true
      // Clear currentChatId when starting a new chat from welcome page
      if (!chatId) {
        currentChatIdRef.current = null
      }
      handleInitialMessage(state?.initialMessage || "", state?.files)
    }
  }, [handleInitialMessage, chatId])

  const lastChatId = useRef(chatId)
  useEffect(() => {
    if (lastChatId.current && lastChatId.current !== chatId) {
      updateStreamingCode(null)
    }

    lastChatId.current = chatId
  }, [updateStreamingCode, chatId])

  const onAuthorizeConfirm = () => {
    isAuthorizing.current = true
    setShowAuthorizePopup(false)
    openOverlay({ page: "Setting", tab: "Tools", subtab: "Connector", tabdata: { currentTool: currentTool?.name } })
  }

  const onAuthorizeCancel = async () => {
    setCancelingAuthorize(true)
    await fetch(`/api/tools/login/oauth/callback?code=''&state=${authorizeState}`)
    setCancelingAuthorize(false)
    setShowAuthorizePopup(false)
  }

  const onElicitationRespond = async (
    requestId: string,
    action: ElicitResult["action"],
    content?: ElicitResult["content"]
  ) => {
    try {
      if (requestId) {
        await fetch("/api/tools/elicitation/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: requestId, action, content })
        })
      } else {
        // local ipc
        let actionEnum = 0
        if(action === "accept") {
          actionEnum = 1
        } else if(action === "decline") {
          actionEnum = 2
        } else if(action === "cancel") {
          actionEnum = 3
        }
        await responseLocalIPCElicitation(actionEnum, content)
      }
    } catch (error) {
      console.error("Failed to respond to elicitation request:", error)
    } finally {
      setElicitationRequest(null)
    }
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-window">
          <ChatMessages
            ref={chatMessagesRef}
            key={currentChatIdRef.current || "new-chat"}
            messages={messages}
            isLoading={isChatStreaming}
            isLoadingMessages={isLoadingChat}
            onRetry={onRetry}
            onEdit={onEdit}
          />
          <ChatInput
            page="chat"
            onSendMessage={onSendMsg}
            disabled={isChatStreaming}
            onAbort={onAbort}
          />
        </div>
      </div>
      {showAuthorizePopup && currentTool && (
        <AuthorizePopup
          currentTool={currentTool}
          cancelingAuthorize={cancelingAuthorize}
          onConfirm={onAuthorizeConfirm}
          onCancel={onAuthorizeCancel}
        />
      )}
      {elicitationRequest && (
        <PopupElicitationRequest
          requestId={elicitationRequest.requestId}
          message={elicitationRequest.message}
          requestedSchema={elicitationRequest.requestedSchema}
          onRespond={onElicitationRespond}
          zIndex={1000}
        />
      )}
      {isLoading && (
        createPortal(
          <div className="global-loading-overlay">
            <div className="loading-spinner"></div>
          </div>,
          document.body
      ))}
    </div>
  )
}

const AuthorizePopup = ({ currentTool, onConfirm, onCancel, cancelingAuthorize }: { currentTool: Tool, onConfirm: () => void, onCancel: () => void, cancelingAuthorize: boolean }) => {
  const { t } = useTranslation()

  if (!currentTool)
    return null

  return (
    <PopupConfirm
      zIndex={1000}
      noBorder={true}
      footerType="center"
      disabled={cancelingAuthorize}
      confirmText={t("chat.reAuthorize.confirm")}
      onConfirm={() => {
        onConfirm()
      }}
      cancelText={cancelingAuthorize ? (
        <div className="loading-spinner" />
      ) : null}
      onCancel={() => {
        if(cancelingAuthorize)
          return

        onCancel()
      }}
    >
      <div className="chat-authorize-popup">
        <div className="chat-authorize-popup-title">
          {t("chat.reAuthorize.title")}
        </div>
        <div className="chat-authorize-popup-content">
          <div className="chat-authorize-popup-desc">
            {t("chat.reAuthorize.description")}
          </div>
          <div className="chat-authorize-popup-tool">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M17.888 4.11123C16.0704 2.29365 13.1292 2.29365 11.3138 4.11123L9.23193 6.19307L10.3276 7.28877L12.4095 5.20693C13.5653 4.05107 15.5161 3.92861 16.7923 5.20693C18.0706 6.48525 17.9481 8.43389 16.7923 9.58975L14.7104 11.6716L15.8083 12.7694L17.8901 10.6876C19.7034 8.87002 19.7034 5.92881 17.888 4.11123ZM9.59287 16.7913C8.43701 17.9472 6.48623 18.0696 5.21006 16.7913C3.93174 15.513 4.0542 13.5644 5.21006 12.4085L7.29189 10.3267L6.19404 9.22881L4.11221 11.3106C2.29463 13.1282 2.29463 16.0694 4.11221 17.8849C5.92979 19.7003 8.871 19.7024 10.6864 17.8849L12.7683 15.803L11.6726 14.7073L9.59287 16.7913ZM5.59248 4.49795C5.56018 4.46596 5.51655 4.44802 5.47109 4.44802C5.42563 4.44802 5.38201 4.46596 5.34971 4.49795L4.49893 5.34873C4.46694 5.38103 4.449 5.42466 4.449 5.47012C4.449 5.51558 4.46694 5.5592 4.49893 5.5915L16.4099 17.5024C16.4765 17.569 16.586 17.569 16.6526 17.5024L17.5034 16.6517C17.57 16.5851 17.57 16.4755 17.5034 16.4089L5.59248 4.49795Z" fill="#777989"/>
            </svg>
            <div className="chat-authorize-popup-tool-text">
              <span className="chat-authorize-popup-tool-title">{currentTool.name}</span>
              <span className="chat-authorize-popup-tool-desc">{currentTool.url}</span>
            </div>
          </div>
        </div>
      </div>
    </PopupConfirm>
  )
}

export default React.memo(ChatWindow)
