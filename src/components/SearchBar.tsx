import { useEffect, useRef, useCallback } from "react"
import { useAtom, useSetAtom, useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import {
  searchVisibleAtom,
  searchTextAtom,
  searchMatchCaseAtom,
  searchResultAtom,
  searchReadyAtom,
  closeSearchAtom,
} from "../atoms/searchState"
import {
  findInPage,
  findNext,
  findPrev,
  stopFind,
  listenSearchResult,
} from "../ipc/search"

export default function SearchBar() {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const isVisible = useAtomValue(searchVisibleAtom)
  const [searchText, setSearchText] = useAtom(searchTextAtom)
  const [matchCase, setMatchCase] = useAtom(searchMatchCaseAtom)
  const [searchResult, setSearchResult] = useAtom(searchResultAtom)
  const [searchReady, setSearchReady] = useAtom(searchReadyAtom)
  const closeSearch = useSetAtom(closeSearchAtom)

  // Focus input when search bar becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isVisible])

  // Listen for search results
  useEffect(() => {
    const unsubscribe = listenSearchResult((result) => {
      setSearchResult({
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
        finalUpdate: result.finalUpdate,
      })
      // Mark search as ready when we receive the final update
      if (result.finalUpdate) {
        setSearchReady(true)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [setSearchResult, setSearchReady])

  // Perform search when text or matchCase changes
  useEffect(() => {
    if (!isVisible) {
      return
    }

    // Reset ready state when starting a new search
    setSearchReady(false)

    const debounceTimer = setTimeout(() => {
      if (searchText) {
        findInPage(searchText, { matchCase })
      } else {
        stopFind()
        setSearchResult(null)
        setSearchReady(false)
      }
    }, 150)

    return () => clearTimeout(debounceTimer)
  }, [searchText, matchCase, isVisible, setSearchResult, setSearchReady])

  // Clean up when closing
  useEffect(() => {
    if (!isVisible) {
      stopFind()
    }
  }, [isVisible])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (!searchText) {
        return
      }
      // If search is not ready or no results, perform initial search
      if (!searchReady || !searchResult || searchResult.matches === 0) {
        findInPage(searchText, { matchCase })
        return
      }
      if (e.shiftKey) {
        findPrev(searchText, { matchCase })
      } else {
        findNext(searchText, { matchCase })
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      closeSearch()
    }
  }, [searchText, matchCase, closeSearch, searchResult, searchReady])

  const handlePrevClick = useCallback(() => {
    findPrev(searchText, { matchCase })
  }, [searchText, matchCase])

  const handleNextClick = useCallback(() => {
    findNext(searchText, { matchCase })
  }, [searchText, matchCase])

  const handleClose = useCallback(() => {
    closeSearch()
  }, [closeSearch])

  const toggleMatchCase = useCallback(() => {
    setMatchCase(!matchCase)
  }, [matchCase, setMatchCase])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value)
    setSearchReady(false)
  }, [setSearchText, setSearchReady])

  if (!isVisible) {
    return null
  }

  const hasMatches = searchResult && searchResult.matches > 0
  const matchCountText = searchResult
    ? `${searchResult.activeMatchOrdinal} / ${searchResult.matches}`
    : ""

  return (
    <div className="search-bar">
      <div className="search-bar-input-wrapper">
        <svg
          className="search-bar-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-bar-input"
          placeholder={t("search.placeholder")}
          value={searchText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
        />
        {searchText && (
          <span className={`search-bar-count ${!hasMatches && searchText ? "no-results" : ""}`}>
            {searchText && !searchResult ? "..." : matchCountText}
          </span>
        )}
      </div>

      <button
        className={`search-bar-btn match-case ${matchCase ? "active" : ""}`}
        onClick={toggleMatchCase}
        title={t("search.matchCase")}
      >
        Aa
      </button>

      <div className="search-bar-divider" />

      <button
        className="search-bar-btn"
        onClick={handlePrevClick}
        disabled={!hasMatches}
        title={t("search.previous")}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>

      <button
        className="search-bar-btn"
        onClick={handleNextClick}
        disabled={!hasMatches}
        title={t("search.next")}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div className="search-bar-divider" />

      <button
        className="search-bar-btn close"
        onClick={handleClose}
        title={t("common.close")}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}
