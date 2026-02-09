import { useEffect, useRef, useCallback } from "react"
import { useAtom, useSetAtom, useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import Input from "./Input"
import Button from "./Button"
import {
  searchVisibleAtom,
  searchTextAtom,
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
import Tooltip from "./Tooltip"

export default function SearchBar() {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const isVisible = useAtomValue(searchVisibleAtom)
  const [searchText, setSearchText] = useAtom(searchTextAtom)
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

    // Reset state when starting a new search
    setSearchReady(false)
    setSearchResult(null)

    const debounceTimer = setTimeout(() => {
      if (searchText) {
        findInPage(searchText)
      } else {
        stopFind()
        setSearchResult(null)
        setSearchReady(false)
      }
    }, 150)

    return () => clearTimeout(debounceTimer)
  }, [searchText, isVisible, setSearchResult, setSearchReady])

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
        findInPage(searchText)
        return
      }
      if (e.shiftKey) {
        findPrev(searchText)
      } else {
        findNext(searchText)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      closeSearch()
    }
  }, [searchText, closeSearch, searchResult, searchReady])

  const handlePrevClick = useCallback(() => {
    findPrev(searchText)
  }, [searchText])

  const handleNextClick = useCallback(() => {
    findNext(searchText)
  }, [searchText])

  const handleClose = useCallback(() => {
    closeSearch()
  }, [closeSearch])

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
      <Input
        ref={inputRef}
        className="search-bar-input"
        size="small"
        placeholder={t("search.placeholder")}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        value={searchText}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13.6362 13.6367L18.1817 18.1822" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round"/>
            <path d="M8.63654 15.4528C12.4021 15.4528 15.4547 12.4002 15.4547 8.63459C15.4547 4.86901 12.4021 1.81641 8.63654 1.81641C4.87096 1.81641 1.81836 4.86901 1.81836 8.63459C1.81836 12.4002 4.87096 15.4528 8.63654 15.4528Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10"/>
          </svg>
        }
        icon2={searchText ? (
          <span className="search-bar-count">
            {searchText && !searchResult ? "..." : matchCountText}
          </span>
        ) : undefined}
      />

      <div className="search-bar-divider" />

      <div className="search-bar-tool-wrapper">
        <Tooltip content={t("search.previous")}>
          <Button
            className="search-bar-btn"
            theme="TextOnly"
            color="neutral"
            size="small"
            shape="round"
            svgFill="none"
            noFocus
            onClick={handlePrevClick}
            disabled={!hasMatches}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </Button>
        </Tooltip>

        <Tooltip content={t("search.next")}>
          <Button
            className="search-bar-btn"
            theme="TextOnly"
            color="neutral"
            size="small"
            shape="round"
            svgFill="none"
            noFocus
            onClick={handleNextClick}
            disabled={!hasMatches}
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
          </Button>
        </Tooltip>

        <Tooltip content={t("common.close")}>
          <Button
            className="search-bar-btn"
            theme="TextOnly"
            color="neutral"
            size="small"
            shape="round"
            svgFill="none"
            noFocus
            onClick={handleClose}
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
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
