import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import Message from "./Message"
import { isChatStreamingAtom } from "../../atoms/chatState"
import { useAtomValue } from "jotai"
import { ResourceUsage } from "./TokenUsagePopup"
import ActiveToolsPanel, { ActiveToolCall } from "./ActiveToolsPanel"

export interface Message {
  id: string
  text: string
  isSent: boolean
  timestamp: number
  files?: File[]
  isError?: boolean
  isRateLimitExceeded?: boolean
  resourceUsage?: ResourceUsage
}

interface Props {
  messages: Message[]
  isLoading?: boolean
  isLoadingMessages?: boolean
  onRetry: (messageId: string) => void
  onEdit: (messageId: string, newText: string) => void
  activeToolCalls?: Map<string, ActiveToolCall>
}

export interface ChatMessagesRef {
  scrollToBottom: () => void
  scrollToMessage: (messageId: string) => void
}

const ChatMessages = forwardRef<ChatMessagesRef, Props>(({ messages, isLoading, isLoadingMessages, onRetry, onEdit, activeToolCalls }, ref) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const mouseWheelRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isChatStreaming = useAtomValue(isChatStreamingAtom)
  const hoverTimeOutRef = useRef<NodeJS.Timeout | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const scrollToBottom = () => {
    // Reset dynamic padding when scrolling to bottom
    if (messagesEndRef.current) {
      messagesEndRef.current.style.minHeight = "0"
    }
    messagesEndRef.current?.scrollIntoView()
    setShowScrollButton(false)
  }

  const scrollToMessage = (messageId: string) => {
    // Use setTimeout to ensure DOM has updated after state change
    setTimeout(() => {
      const messageElement = messageRefsMap.current.get(messageId)
      if (!messageElement || !scrollContainerRef.current || !messagesEndRef.current) {
        return
      }

      const container = scrollContainerRef.current
      const containerHeight = container.clientHeight
      const endElement = messagesEndRef.current

      // Get all message elements and find the target message index
      const messageIds = Array.from(messageRefsMap.current.keys())
      const targetIndex = messageIds.indexOf(messageId)

      // Calculate height of messages from target to end (user message + AI response)
      let messagesHeight = 0
      for (let i = targetIndex; i < messageIds.length; i++) {
        const el = messageRefsMap.current.get(messageIds[i])
        if (el) {
          messagesHeight += el.offsetHeight
        }
      }

      // Calculate needed padding: container height - messages height after target
      // Subtract existing padding-bottom (85px) from .chat-messages
      const existingPadding = 85
      const neededPadding = Math.max(0, containerHeight - messagesHeight - existingPadding)

      endElement.style.minHeight = `${neededPadding}px`

      // Force layout reflow
      void container.offsetHeight

      // Scroll to position the message at the top with smooth animation
      container.scrollTo({
        top: messageElement.offsetTop,
        behavior: "smooth"
      })
      setShowScrollButton(true)
    }, 100)
  }

  // Expose scrollToBottom and scrollToMessage to parent component
  useImperativeHandle(ref, () => ({
    scrollToBottom,
    scrollToMessage
  }))

  useEffect(() => {
    if (!isChatStreaming) {
      mouseWheelRef.current = false
    }
  }, [isChatStreaming])

  const checkIfAtBottom = () => {
    if (scrollContainerRef.current) {
      const element = scrollContainerRef.current
      const isAtBottom = Math.abs(
        (element.scrollHeight - element.scrollTop) - element.clientHeight
      ) < 50

      return isAtBottom
    }
    return false
  }

  const handleScroll = (_: React.WheelEvent<HTMLDivElement>) => {
    setTimeout(() => {
      mouseWheelRef.current = !checkIfAtBottom()
      setShowScrollButton(!checkIfAtBottom())
      if (hoverTimeOutRef.current) {
        clearTimeout(hoverTimeOutRef.current)
      }
      setIsHovering(!checkIfAtBottom())
    }, 100)
  }

  const handleMouseMove = () => {
    if (hoverTimeOutRef.current) {
      clearTimeout(hoverTimeOutRef.current)
    }
    if (checkIfAtBottom()) {
      return
    }
    setIsHovering(true)
    hoverTimeOutRef.current = setTimeout(() => {
      setIsHovering(false)
    }, 5000)
  }

  const handleMouseEnter = () => {
    if (hoverTimeOutRef.current) {
      clearTimeout(hoverTimeOutRef.current)
    }
    if (checkIfAtBottom()) {
      return
    }
    setIsHovering(true)
  }

  const handleMouseLeave = () => {
    if (hoverTimeOutRef.current) {
      clearTimeout(hoverTimeOutRef.current)
    }
    setIsHovering(false)
  }

  const handleBtnEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (hoverTimeOutRef.current) {
      clearTimeout(hoverTimeOutRef.current)
    }
    setIsHovering(true)
  }

  const handleBtnMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (hoverTimeOutRef.current) {
      clearTimeout(hoverTimeOutRef.current)
    }
    setIsHovering(true)
  }

  const handleBtnLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (hoverTimeOutRef.current) {
      clearTimeout(hoverTimeOutRef.current)
    }
    hoverTimeOutRef.current = setTimeout(() => {
      setIsHovering(false)
    }, 5000)
  }

  return (
    <div className="chat-messages-container" onWheel={handleScroll} onMouseMove={handleMouseMove} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="chat-messages" ref={scrollContainerRef}>
        {isLoadingMessages ? (
          <div className="chat-messages-loading">
            <div className="loading-spinner" />
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              ref={(el) => {
                if (el) {
                  messageRefsMap.current.set(message.id, el)
                } else {
                  messageRefsMap.current.delete(message.id)
                }
              }}
            >
              <Message
                text={message.text}
                isSent={message.isSent}
                timestamp={message.timestamp}
                files={message.files}
                isError={message.isError}
                isRateLimitExceeded={message.isRateLimitExceeded}
                isLoading={!message.isSent && index === messages.length - 1 && isLoading}
                messageId={message.id}
                onRetry={() => onRetry(message.id)}
                onEdit={(newText: string) => onEdit(message.id, newText)}
                resourceUsage={message.resourceUsage}
              />
            </div>
          ))
        )}
        <div className="chat-messages-end" ref={messagesEndRef} />
      </div>
      {activeToolCalls && activeToolCalls.size > 0 && (
        <ActiveToolsPanel toolCalls={activeToolCalls} />
      )}
      <div className="scroll-to-bottom-btn-container">
        <button className={`scroll-to-bottom-btn ${showScrollButton && isHovering ? "show" : ""}`} onClick={scrollToBottom} onMouseEnter={handleBtnEnter} onMouseLeave={handleBtnLeave} onMouseMove={handleBtnMove}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 22 22" fill="none">
            <path d="M4 12L11 19L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 18L11 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
})

ChatMessages.displayName = "ChatMessages"

export default React.memo(ChatMessages)
