import React, { useEffect, useRef } from "react"
import Message from "./Message"
import { ToolCall, ToolResult } from "./ToolPanel"
import { isChatStreamingAtom } from "../../atoms/chatState"
import { useAtomValue } from "jotai"

export interface Message {
  id: string
  text: string
  isSent: boolean
  timestamp: number
  files?: File[]
  isError?: boolean
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

interface Props {
  messages: Message[]
  isLoading?: boolean
  onRetry: (messageId: string) => void
}

const ChatMessages = ({ messages, isLoading, onRetry }: Props) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mouseWheelRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isChatStreaming = useAtomValue(isChatStreamingAtom)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView()
  }

  useEffect(() => {
    !mouseWheelRef.current && scrollToBottom()
  }, [messages])

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
    ) < 1

    return isAtBottom
  }
  return false
}

  const handleScroll = (_: React.WheelEvent<HTMLDivElement>) => {
    mouseWheelRef.current = !checkIfAtBottom()
  }

  return (
    <div className="chat-messages" onWheel={handleScroll} ref={scrollContainerRef}>
      {messages.map((message, index) => (
        <Message
          key={message.id}
          text={message.text}
          isSent={message.isSent}
          timestamp={message.timestamp}
          files={message.files}
          isError={message.isError}
          isLoading={!message.isSent && index === messages.length - 1 && isLoading}
          toolCalls={message.toolCalls}
          toolResults={message.toolResults}
          messageId={message.id}
          onRetry={() => onRetry(message.id)}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}

export default React.memo(ChatMessages)
