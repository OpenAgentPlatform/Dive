import { atom } from "jotai"
import { Message } from "../views/Chat/ChatMessages"

export interface FilePreview {
  type: "image" | "file"
  url?: string
  name: string
  size: string
}

export interface DraftData {
  message: string
  files: File[]
  previews: FilePreview[]
}

export interface StreamingState {
  currentText: string
  toolCallResults: string
  toolResultCount: number
  toolResultTotal: number
  agentToolCallResults: string
  agentToolResultCount: number
  agentToolResultTotal: number
  chatReader: ReadableStreamDefaultReader<Uint8Array> | null
}

export const lastMessageAtom = atom<string>("")
export const currentChatIdAtom = atom<string>("")
export const isChatStreamingAtom = atom<boolean>(false)

// Store drafts for different chats, key format: chatId or "__new_chat__" for new chat
export const draftMessagesAtom = atom<Record<string, DraftData>>({})

// Store messages per chatId
export const messagesMapAtom = atom<Map<string, Message[]>>(new Map())

// Store streaming status per chatId
export const chatStreamingStatusMapAtom = atom<Map<string, boolean>>(new Map())

// Store streaming state per chatId
export const streamingStateMapAtom = atom<Map<string, StreamingState>>(new Map())

export const deleteChatAtom = atom(
  null,
  async (get, set, chatId: string) => {
    try {
      if (chatId) {
        const draftMessages = get(draftMessagesAtom)
        if(chatId in draftMessages) {
          delete draftMessages[chatId]
          set(draftMessagesAtom, draftMessages)
        }
        const messagesMap = get(messagesMapAtom)
        if(messagesMap.has(chatId)) {
          messagesMap.delete(chatId)
          set(messagesMapAtom, messagesMap)
        }
        const chatStreamingStatusMap = get(chatStreamingStatusMapAtom)
        if(chatStreamingStatusMap.has(chatId)) {
          chatStreamingStatusMap.delete(chatId)
          set(chatStreamingStatusMapAtom, chatStreamingStatusMap)
        }
        const streamingStateMap = get(streamingStateMapAtom)
        if(streamingStateMap.has(chatId)) {
          const reader = streamingStateMap.get(chatId)!.chatReader
          if(reader) {
            reader.cancel()
          }
          await fetch(`/api/chat/${chatId}/abort`, {
            method: "POST",
          })
          streamingStateMap.delete(chatId)
          set(streamingStateMapAtom, streamingStateMap)
        }
      }
    } catch (error) {
      console.warn("Failed to delete chat:", error)
    }
  }
)