import React, { useRef, useState, useCallback, useEffect } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import ChatMessages, { Message } from "./ChatMessages"
import ChatInput from "../../components/ChatInput"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { codeStreamingAtom } from "../../atoms/codeStreaming"
import useHotkeyEvent from "../../hooks/useHotkeyEvent"
import { showToastAtom } from "../../atoms/toastState"
import { useTranslation } from "react-i18next"
import { currentChatIdAtom, isChatStreamingAtom, lastMessageAtom } from "../../atoms/chatState"
import { safeBase64Encode } from "../../util"
import { updateOAPUsageAtom } from "../../atoms/oapState"
import { loadHistoriesAtom } from "../../atoms/historyState"
import { openOverlayAtom } from "../../atoms/layerState"
import PopupConfirm from "../../components/PopupConfirm"
import { Tool, toolsAtom } from "../../atoms/toolState"
import { authorizeStateAtom } from "../../atoms/globalState"
import "../../styles/pages/_Chat.scss"

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
  }
  files: File[]
}

const ChatWindow = () => {
  const { chatId } = useParams()
  const location = useLocation()
  const [messages, setMessages] = useState<Message[]>([])
  const currentId = useRef(0)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const currentChatId = useRef<string | null>(null)
  const navigate = useNavigate()
  const isInitialMessageHandled = useRef(false)
  const showToast = useSetAtom(showToastAtom)
  const { t } = useTranslation()
  const updateStreamingCode = useSetAtom(codeStreamingAtom)
  const setLastMessage = useSetAtom(lastMessageAtom)
  const setCurrentChatId = useSetAtom(currentChatIdAtom)
  const [isChatStreaming, setIsChatStreaming] = useAtom(isChatStreamingAtom)
  const toolCallResults = useRef<string>("")
  const toolResultCount = useRef(0)
  const toolResultTotal = useRef(0)
  const toolKeyRef = useRef(0)
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
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  const loadChat = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/chat/${id}`)
      const data = await response.json()

      if (data.success) {
        currentChatId.current = id
        document.title = `${data.data.chat.title.substring(0, 40)}${data.data.chat.title.length > 40 ? "..." : ""} - Dive AI`

        const rawToMessage = (msg: RawMessage): Message => ({
          id: msg.messageId || msg.id || String(currentId.current++),
          text: msg.content,
          isSent: msg.role === "user",
          timestamp: new Date(msg.createdAt).getTime(),
          files: msg.files
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
                  }

                  toolCallBuf.push(msg.toolCalls)
                  break
                }

                if (isLastSent) {
                  acc.push(rawToMessage(msg))
                } else {
                  acc[acc.length - 1].text += msg.content
                }
                break
            }

            return acc
          }, [])

        setMessages(convertedMessages)
      }
    } catch (error) {
      console.warn("Failed to load chat:", error)
    } finally {
      setIsChatStreaming(false)
    }
  }, [])

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
    if (chatId && chatId !== currentChatId.current) {
      if(currentChatId.current && isChatStreaming) {
        abortChat(currentChatId.current)
      }
      loadChat(chatId)
      setCurrentChatId(chatId)
    }
  }, [chatId, loadChat, setCurrentChatId])


  const abortChat = async (_chatId: string) => {
    try {
      if(readerRef.current) {
        readerRef.current.cancel()
      }
      await fetch(`/api/chat/${_chatId}/abort`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed abort:", error)
    }
  }

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [])

  const onSendMsg = useCallback(async (msg: string, files?: FileList) => {
    if (isChatStreaming)
      return

    const formData = new FormData()
    if (msg)
      formData.append("message", msg)

    if (currentChatId.current)
      formData.append("chatId", currentChatId.current)

    if (files) {
      Array.from(files).forEach(file => {
        formData.append("files", file)
      })
    }

    const userMessage: Message = {
      id: `${currentId.current++}`,
      text: msg,
      isSent: true,
      timestamp: Date.now(),
      files: files ? Array.from(files) : undefined
    }

    const aiMessage: Message = {
      id: `${currentId.current++}`,
      text: "",
      isSent: false,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage, aiMessage])
    setIsChatStreaming(true)
    scrollToBottom()

    handlePost(formData, "formData", "/api/chat")
  }, [isChatStreaming, scrollToBottom, allTools])

  const onAbort = useCallback(async () => {
    if (!isChatStreaming || !currentChatId.current)
      return

    if(readerRef.current) {
      readerRef.current.cancel()
    }

    try {
      await fetch(`/api/chat/${currentChatId.current}/abort`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed abort:", error)
    }
  }, [isChatStreaming, currentChatId.current, scrollToBottom])

  const onRetry = useCallback(async (messageId: string) => {
    if (isChatStreaming || !currentChatId.current)
      return

    let prevMessages = {} as Message
    setMessages(prev => {
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

    setMessages(prev => {
      const newMessages = [...prev]
      newMessages.push(prevMessages)
      return newMessages
    })
    setIsChatStreaming(true)
    scrollToBottom()

    const body = JSON.stringify({
      chatId: currentChatId.current,
      messageId: prevMessages.isSent ? prevMessages.id : messageId,
    })

    handlePost(body, "json", "/api/chat/retry")
  }, [isChatStreaming, currentChatId.current])

  const onEdit = useCallback(async (messageId: string, newText: string) => {
    if (isChatStreaming || !currentChatId.current)
      return

    let prevMessages = {} as Message
    setMessages(prev => {
      let newMessages = [...prev]
      const messageIndex = newMessages.findIndex(msg => msg.id === messageId)
      if (messageIndex !== -1) {
        prevMessages = newMessages[messageIndex + 1]
        prevMessages.text = ""
        prevMessages.isError = false
        newMessages = newMessages.slice(0, messageIndex+1)
      }
      return newMessages
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    setMessages(prev => {
      const newMessages = [...prev]
      newMessages.push(prevMessages)
      return newMessages
    })
    setIsChatStreaming(true)
    scrollToBottom()

    const body = new FormData()
    body.append("chatId", currentChatId.current)
    body.append("messageId", prevMessages.isSent ? prevMessages.id : messageId)
    body.append("content", newText)

    handlePost(body, "formData", "/api/chat/edit")
  }, [isChatStreaming, currentChatId.current])

  const handlePost = useCallback(async (body: any, type: "json" | "formData", url: string) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: type === "json" ? {
          "Content-Type": "application/json",
        } : {},
        body: body
      })

      readerRef.current = response.body!.getReader()
      const decoder = new TextDecoder()
      let currentText = ""
      let chunkBuf = ""
      // clear authorize state
      setAuthorizeState(null)

      while (true) {
        const { value, done } = await readerRef.current!.read()
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
              setMessages(prev => {
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
                currentText += data.content
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].text = currentText
                  return newMessages
                })
                scrollToBottom()
                break

              case "tool_calls":
                const toolCalls = data.content as ToolCall[]
                if (data.content?.every((call: {name: string}) => !call.name)) {
                  continue
                }

                const tools = data.content
                  ?.filter((call: {name: string}) => call.name !== "")
                  ?.map((call: {name: string}) => call.name) || []
                toolResultTotal.current = tools.length

                const uniqTools = new Set(tools)
                const toolName = uniqTools.size === 0 ? "%name%" : Array.from(uniqTools).join(", ")

                toolCallResults.current += `\n<tool-call toolkey=${toolKeyRef.current} name="${toolName}">##Tool Calls:${safeBase64Encode(JSON.stringify(toolCalls))}`
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].text = currentText + toolCallResults.current + "</tool-call>"
                  return newMessages
                })
                toolKeyRef.current++
                break

              case "tool_result":
                const result = data.content as ToolResult

                toolCallResults.current = toolCallResults.current.replace("</tool-call>\n", "")
                toolCallResults.current += `##Tool Result:${safeBase64Encode(JSON.stringify(result.result))}</tool-call>\n`

                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].text = currentText + toolCallResults.current.replace("%name%", result.name)
                  return newMessages
                })

                toolResultCount.current++
                if (toolResultTotal.current === toolResultCount.current) {
                  currentText += toolCallResults.current.replace("%name%", result.name)
                  toolCallResults.current = ""
                  toolResultTotal.current = 0
                  toolResultCount.current = 0
                }

                break

              case "chat_info":
                document.title = `${data.content.title.substring(0, 40)}${data.content.title.length > 40 ? "..." : ""} - Dive AI`
                currentChatId.current = data.content.id
                navigate(`/chat/${data.content.id}`, { replace: true })
                break

              case "message_info":
                setMessages(prev => {
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
                  if(isAuthorizing.current)
                    continue

                  isAuthorizing.current = true

                  const authUrl = new URL(data.content.content.auth_url)
                  const state = authUrl.searchParams.get("state")
                  if (state) {
                    setAuthorizeState(state)
                    const tool = allTools.find((_tool: Tool) => _tool.name === data.content.content.server_name)
                    if (tool) {
                      setCurrentTool(tool)
                      setShowAuthorizePopup(true)
                    } else {
                      setShowAuthorizePopup(false)
                    }
                  } else {
                    setShowAuthorizePopup(false)
                  }
                } catch (error) {
                  console.warn(error)
                }
                break

              case "error":
                currentText += `\n\n${data.content}`
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1].text = currentText
                  newMessages[newMessages.length - 1].isError = true
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
      setMessages(prev => {
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
      setIsChatStreaming(false)
      scrollToBottom()
      updateOAPUsage()
      loadHistories()
      readerRef.current = null
    }
  }, [allTools])

  const handleInitialMessage = useCallback(async (message: string, files?: File[]) => {
    if (files && files.length > 0) {
      const fileList = new DataTransfer()
      files.forEach(file => fileList.items.add(file))
      await onSendMsg(message, fileList.files)
    } else {
      await onSendMsg(message)
    }
    navigate(location.pathname, { replace: true, state: {} })
  }, [onSendMsg, navigate, location.pathname])

  useEffect(() => {
    const state = location.state as { initialMessage?: string, files?: File[] } | null

    if ((state?.initialMessage || state?.files) && !isInitialMessageHandled.current) {
      isInitialMessageHandled.current = true
      handleInitialMessage(state?.initialMessage || "", state?.files)
    }
  }, [handleInitialMessage])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

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

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-window">
          <ChatMessages
            messages={messages}
            isLoading={isChatStreaming}
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
