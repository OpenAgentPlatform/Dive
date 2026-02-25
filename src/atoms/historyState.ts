import { atom } from "jotai"

interface ChatHistory {
  starred: ChatHistoryItem[]
  normal: ChatHistoryItem[]
}
export type ChatHistoryItem = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  starredAt: string
  user_id: string
}
export type ChatHistoryPageItem = {
  chat_id: string
  message_id: string
  content_snippet: string
  title_snippet: string
  msg_created_at: string
  chat_updated_at: string
}

export const historiesAtom = atom<ChatHistory>({
  starred: [],
  normal: []
})

export const loadHistoriesAtom = atom(
  null,
  async (get, set) => {
    try {
      const response = await fetch("/api/chat/list?sort_by=msg")
      const data = await response.json()

      if (data.success) {
        set(historiesAtom, data.data as ChatHistory)
      }
    } catch (error) {
      console.warn("Failed to load chat history:", error)
    }
  }
)