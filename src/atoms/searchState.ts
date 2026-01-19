import { atom } from "jotai"

export interface SearchResult {
  activeMatchOrdinal: number
  matches: number
  finalUpdate?: boolean
}

// Search bar visibility
export const searchVisibleAtom = atom(false)

// Current search query
export const searchTextAtom = atom("")

// Case sensitivity toggle
export const searchMatchCaseAtom = atom(false)

// Search result (match count and current index)
export const searchResultAtom = atom<SearchResult | null>(null)

// Whether initial search is ready for navigation
export const searchReadyAtom = atom(false)

// Reset search ready state when text changes
export const setSearchTextAtom = atom(
  (get) => get(searchTextAtom),
  (get, set, newText: string) => {
    set(searchTextAtom, newText)
    set(searchReadyAtom, false)
  }
)

// Toggle search visibility
export const toggleSearchAtom = atom(
  (get) => get(searchVisibleAtom),
  (get, set) => {
    const isVisible = get(searchVisibleAtom)
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
