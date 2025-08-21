import { atom } from "jotai"

interface ChatHistoryResponse {
  starred: ChatHistory[]
  normal: ChatHistory[]
}
export interface ChatHistory {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  starredAt: string
  user_id: string
  type: "normal" | "starred"
}

export const historiesAtom = atom<ChatHistory[]>([])

export const loadHistoriesAtom = atom(
  null,
  async (get, set) => {
    try {
      const response = await fetch("/api/chat/list?sort_by=msg")
      const data = await response.json()

      if (data.success) {
        const response: ChatHistoryResponse = data.data
        const historyList: ChatHistory[] = []
        Object.entries(response).forEach(([key, value]) => {
          historyList.push(...value.map((item: ChatHistory) => ({ ...item, type: key })))
        })
        set(historiesAtom, historyList)
      }
    } catch (error) {
      console.warn("Failed to load chat history:", error)
    }
  }
)