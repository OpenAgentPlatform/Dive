import React, { useCallback, useEffect, useRef, useState } from "react"
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
  }

  return (
    <div className="chat-messages-container" onWheel={handleScroll}>
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
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <button className={`scroll-to-bottom-btn ${showScrollButton ? 'show' : ''}`} onClick={scrollToBottom}>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M4 12L11 19L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11 18L11 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

export default React.memo(ChatMessages)
