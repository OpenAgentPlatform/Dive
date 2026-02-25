import { atom } from "jotai"
import { router } from "../router"
import { overlaysAtom } from "./layerState"
import { currentChatIdAtom } from "./chatState"

export interface SearchResult {
  activeMatchOrdinal: number
  matches: number
  finalUpdate?: boolean
}

// Per-chat search state
interface ChatSearchState {
  visible: boolean
  text: string
}

// Map of chatId -> search state
const searchStateMapAtom = atom<Record<string, ChatSearchState>>({})

// Search bar visibility (derived from current chatId, hidden when overlays open)
export const searchVisibleAtom = atom(
  (get) => {
    const chatId = get(currentChatIdAtom)
    if (!chatId) {
      return false
    }
    if (get(overlaysAtom).length > 0) {
      return false
    }
    return get(searchStateMapAtom)[chatId]?.visible ?? false
  },
  (get, set, newVisible: boolean) => {
    const chatId = get(currentChatIdAtom)
    if (!chatId) {
      return
    }
    const map = get(searchStateMapAtom)
    const current = map[chatId] ?? { visible: false, text: "" }
    set(searchStateMapAtom, { ...map, [chatId]: { ...current, visible: newVisible } })
  }
)

// Current search query (derived from current chatId)
export const searchTextAtom = atom(
  (get) => {
    const chatId = get(currentChatIdAtom)
    if (!chatId) {
      return ""
    }
    return get(searchStateMapAtom)[chatId]?.text ?? ""
  },
  (get, set, newText: string) => {
    const chatId = get(currentChatIdAtom)
    if (!chatId) {
      return
    }
    const map = get(searchStateMapAtom)
    const current = map[chatId] ?? { visible: false, text: "" }
    set(searchStateMapAtom, { ...map, [chatId]: { ...current, text: newText } })
  }
)

// Search result (match count and current index)
export const searchResultAtom = atom<SearchResult | null>(null)

// Whether initial search is ready for navigation
export const searchReadyAtom = atom(false)

// Toggle search visibility (only allowed on /chat/:chatId)
export const toggleSearchAtom = atom(
  (get) => get(searchVisibleAtom),
  (get, set) => {
    const isVisible = get(searchVisibleAtom)
    if (!isVisible) {
      // Only open if on /chat/:chatId and no overlays open
      const pathname = router.state.location.pathname
      if (!pathname.match(/^\/chat\/.+/)) {
        return
      }
      if (get(overlaysAtom).length > 0) {
        return
      }
    }
    set(searchVisibleAtom, !isVisible)
    if (isVisible) {
      // When closing, clear search state
      set(searchTextAtom, "")
      set(searchResultAtom, null)
      set(searchReadyAtom, false)
    }
  }
)

// Open search
export const openSearchAtom = atom(
  null,
  (get, set) => {
    set(searchVisibleAtom, true)
  }
)

// Close search
export const closeSearchAtom = atom(
  null,
  (get, set) => {
    set(searchVisibleAtom, false)
    set(searchTextAtom, "")
    set(searchResultAtom, null)
    set(searchReadyAtom, false)
  }
)
