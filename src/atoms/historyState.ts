import { atom } from 'jotai'

export interface ChatHistory {
  id: string
  title: string
  createdAt: string
}

export const historiesAtom = atom<ChatHistory[]>([])

export const loadHistoriesAtom = atom(
  null,
  async (get, set) => {
    try {
      const response = await fetch("/api/chat/list?sort_by=msg")
      const data = await response.json()

      if (data.success) {
        set(historiesAtom, data.data)
      }
    } catch (error) {
      console.warn("Failed to load chat history:", error)
    }
  }
)