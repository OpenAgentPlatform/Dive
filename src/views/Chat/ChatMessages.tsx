import React, { useEffect, useRef } from "react"
import Message from "./Message"
import { ToolCall, ToolResult } from "./ToolPanel"

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
  onEdit: (messageId: string, newText: string) => void
}

const ChatMessages = ({ messages, isLoading, onRetry, onEdit }: Props) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView()
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="chat-messages">
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
          onEdit={(newText: string) => onEdit(message.id, newText)}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}

export default React.memo(ChatMessages)
