import React, { useEffect, useRef, useState } from "react"
import Message from "./Message"
import { isChatStreamingAtom } from "../../atoms/chatState"
import { useAtomValue } from "jotai"

export interface Message {
  id: string
  text: string
  isSent: boolean
  timestamp: number
  files?: File[]
  isError?: boolean
  inputTokens?: number
  outputTokens?: number
  modelName?: string
  timeToFirstToken?: number
  tokensPerSecond?: number
}

interface Props {
  messages: Message[]
  isLoading?: boolean
  onRetry: (messageId: string) => void
  onEdit: (messageId: string, newText: string) => void
}

const ChatMessages = ({ messages, isLoading, onRetry, onEdit }: Props) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const mouseWheelRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isChatStreaming = useAtomValue(isChatStreamingAtom)
  const hoverTimeOutRef = useRef<NodeJS.Timeout | null>(null)
  const [isHovering, setIsHovering] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView()
    setShowScrollButton(false)
  }

  useEffect(() => {
    !mouseWheelRef.current && scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!isChatStreaming) {
      mouseWheelRef.current = false
      setShowScrollButton(false)
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
    mouseWheelRef.current = !checkIfAtBottom()
    setShowScrollButton(!checkIfAtBottom())
    if (hoverTimeOutRef.current) {
      clearTimeout(hoverTimeOutRef.current)
    }
    setIsHovering(!checkIfAtBottom())
  }

  const handleMouseMove = () => {
    if (hoverTimeOutRef.current) {
      clearTimeout(hoverTimeOutRef.current)
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
    setIsHovering(true)
  }

  const handleMouseLeave = () => {
    if (hoverTimeOutRef.current) {
      clearTimeout(hoverTimeOutRef.current)
    }
    hoverTimeOutRef.current = setTimeout(() => {
      setIsHovering(false)
    }, 5000)
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
        {messages.map((message, index) => (
          <Message
            key={index}
            text={message.text}
            isSent={message.isSent}
            timestamp={message.timestamp}
            files={message.files}
            isError={message.isError}
            isLoading={!message.isSent && index === messages.length - 1 && isLoading}
            messageId={message.id}
            onRetry={() => onRetry(message.id)}
            onEdit={(newText: string) => onEdit(message.id, newText)}
            inputTokens={message.inputTokens}
            outputTokens={message.outputTokens}
            modelName={message.modelName}
            timeToFirstToken={message.timeToFirstToken}
            tokensPerSecond={message.tokensPerSecond}
          />
        ))}
        <div className="chat-messages-end" ref={messagesEndRef} />
      </div>
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
}

export default React.memo(ChatMessages)
