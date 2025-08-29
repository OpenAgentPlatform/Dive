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