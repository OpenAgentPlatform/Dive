import { atom } from "jotai"
import type { ElicitRequestFormParams, ElicitResult } from "@modelcontextprotocol/sdk/types.js"
import { Message } from "../views/Chat/ChatMessages"

// Elicitation request state type using MCP SDK types
export interface ElicitationRequestState {
  requestId: string
  message: string
  requestedSchema: ElicitRequestFormParams["requestedSchema"]
}

export type ElicitationAction = ElicitResult["action"]
export type ElicitationContent = ElicitResult["content"]

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
export const isLoadingChatAtom = atom(false)
export const isChatStreamingAtom = atom<boolean>(false)

// Store drafts for different chats, key format: chatId or "__new_chat__" for new chat
export const draftMessagesAtom = atom<Record<string, DraftData>>({})

// Store messages per chatId
export const messagesMapAtom = atom<Map<string, Message[]>>(new Map())

// Store streaming status per chatId
export const chatStreamingStatusMapAtom = atom<Map<string, boolean>>(new Map())

// Store streaming state per chatId
export const streamingStateMapAtom = atom<Map<string, StreamingState>>(new Map())

// Global elicitation requests state
export const elicitationRequestsAtom = atom<ElicitationRequestState[]>([])

// Write-only atom to add elicitation request
export const addElicitationRequestAtom = atom(
  null,
  (get, set, request: ElicitationRequestState) => {
    const current = get(elicitationRequestsAtom)
    set(elicitationRequestsAtom, [...current, request])
  }
)

// Write-only atom to remove elicitation request by requestId
export const removeElicitationRequestAtom = atom(
  null,
  (get, set, requestId: string) => {
    const current = get(elicitationRequestsAtom)
    set(elicitationRequestsAtom, current.filter(req => req.requestId !== requestId))
  }
)

// Write-only atom to clear all elicitation requests
export const clearElicitationRequestsAtom = atom(
  null,
  (get, set) => {
    set(elicitationRequestsAtom, [])
  }
)

export const deleteMultiChatAtom = atom(
  null,
  async (get, set, chatIds: string[]) => {
    for (const chatId of chatIds) {
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
        console.warn("Failed to clean up chat:", error)
      }
    }
  }
)

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