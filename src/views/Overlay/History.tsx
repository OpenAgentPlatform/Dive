import React, { startTransition, useCallback, useEffect, useRef, useState } from "react"
import PopupWindow from "../../components/PopupWindow"
import "../../styles/overlay/_History.scss"
import { useTranslation } from "react-i18next"
import Input from "../../components/Input"
import Button from "../../components/Button"
import Tooltip from "../../components/Tooltip"
import { chatStreamingStatusMapAtom, currentChatIdAtom, deleteMultiChatAtom } from "../../atoms/chatState"
import { useScrollTo } from "../../hooks/useScroll"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { closeAllOverlaysAtom } from "../../atoms/layerState"
import { useNavigate } from "react-router-dom"
import { ChatHistoryPageItem, historiesAtom, loadHistoriesAtom } from "../../atoms/historyState"
import Dropdown from "../../components/DropDown"
import { showToastAtom } from "../../atoms/toastState"
import { openRenameModalAtom } from "../../atoms/modalState"
import PopupConfirm from "../../components/PopupConfirm"
import CheckBox from "../../components/CheckBox"

const HighlightText: React.FC<{ text: string; keyword: string }> = ({ text, keyword }) => {
  if (!keyword.trim() || !text) {
    return <>{text}</>
  }

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "gi"))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase()
          ? <mark key={i} className="search-highlight">{part}</mark>
          : part
      )}
    </>
  )
}

interface DeleteConfirmProps {
  deletingChatIds: string[]
  onConfirm: () => void
  onCancel: () => void
  onFinish: () => void
}

const DeleteConfirmModal: React.FC<DeleteConfirmProps> = ({ deletingChatIds, onConfirm, onCancel, onFinish }) => {
  const { t } = useTranslation()
  const setCurrentChatId = useSetAtom(currentChatIdAtom)
  const currentChatId = useAtomValue(currentChatIdAtom)

  const _onConfirm = useCallback(() => {
    onConfirm()
    if (deletingChatIds.includes(currentChatId)) {
      setCurrentChatId("")
    }
  }, [onConfirm, setCurrentChatId, deletingChatIds, currentChatId])

  return (
    <PopupConfirm
      title={deletingChatIds.length > 1 ? t("chat.confirmDeleteMultiple", { count:  deletingChatIds.length}) : t("chat.confirmDelete")}
      confirmText={t("common.confirm")}
      cancelText={t("common.cancel")}
      onConfirm={_onConfirm}
      onCancel={onCancel}
      onClickOutside={onCancel}
      noBorder
      footerType="center"
      zIndex={1000}
      className="delete-confirm-modal"
      onFinish={onFinish}
    >
      {t("chat.confirmDeleteDescription")}
    </PopupConfirm>
  )
}

const History = ({_tabdata }: { _tabdata?: any }) => {
  const { t } = useTranslation()
  const closeAllOverlays = useSetAtom(closeAllOverlaysAtom)
  const navigate = useNavigate()
  const loadHistories = useSetAtom(loadHistoriesAtom)
  const histories = useAtomValue(historiesAtom)
  const [currentChatId, setCurrentChatId] = useAtom(currentChatIdAtom)
  const [searchText, setSearchText] = useState("")
  const [searchResult, setSearchResult] = useState<ChatHistoryPageItem[]>([])
  const [selecting, setSelecting] = useState(false)
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set())
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false)
  const [deletingChatIds, setDeletingChatIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultContainerRef = useRef<HTMLDivElement>(null)
  const showToast = useSetAtom(showToastAtom)
  const openRenameModal = useSetAtom(openRenameModalAtom)
  const deleteMultiChat = useSetAtom(deleteMultiChatAtom)
  const chatStreamingStatusMap = useAtomValue(chatStreamingStatusMapAtom)
  const messageScrollTo = useScrollTo("chat-messages")
  const sidebarScrollTo = useScrollTo("history-sidebar")

  const handleNavigateToMessage = (chat: ChatHistoryPageItem) => {
    startTransition(() => {
      setCurrentChatId(chat.chat_id)
      closeAllOverlays()
      navigate(`/chat/${chat.chat_id}`, { replace: true })
      if (chat.message_id) {
        messageScrollTo(chat.message_id, (container, targetId) => {
          const el = container.querySelector(`[data-scroll-in-id="${targetId}"]`)
          if (el) {
            setTimeout(() => {
              el.scrollIntoView({ behavior: "instant", block: "start" })
              el.classList.add("highlight-flash")
              setTimeout(() => el.classList.remove("highlight-flash"), 700)
            }, 100)
            return true
          }
          return false
        })
      }
      if (chat.chat_id) {
        sidebarScrollTo(chat.chat_id, (container, targetId) => {
          const el = container.querySelector(`[data-scroll-in-id="${targetId}"]`)
          if (el) {
            setTimeout(() => {
              el.scrollIntoView({ behavior: "instant", block: "start" })
            }, 100)
            return true
          }
          return false
        })
      }
    })
  }

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    const scrollToHighlights = () => {
      if (!resultContainerRef.current || searchText?.length === 0 || searchResult?.length === 0) {
        return
      }
      const items = resultContainerRef.current.querySelectorAll(".history-page-result-item")
      items.forEach(item => {
        const detail = item.querySelector(".history-page-result-item-detail")
        const mark = detail?.querySelector("mark")
        if (detail && mark) {
          (mark as HTMLElement).scrollIntoView({ block: "nearest", inline: "start" })
        }
      })
    }

    requestAnimationFrame(() => {
      scrollToHighlights()
    })

    window.addEventListener("resize", scrollToHighlights)
    return () => window.removeEventListener("resize", scrollToHighlights)
  }, [searchResult])

  // For auto-search when searchText changes (with debounce)
  useEffect(() => {
    const abortController = new AbortController()
    searchAbortRef.current = abortController
    setLoading(true)
    const timeoutId = setTimeout(async () => {
      searchTimeoutRef.current = null
      try {
        const response = await fetch("/api/chat/search", {
          method: "POST",
          headers: {
            "accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: searchText,
            max_length: 100
          }),
          signal: abortController.signal
        })
        const data = await response.json()
        if (data.success && data.data) {
          setSearchResult(data.data)
        } else {
          setSearchResult([])
        }
        await new Promise((e) => setTimeout(e, 150))
        setLoading(false)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }
        setSearchResult([])
        setLoading(false)
      }
    }, 300)
    searchTimeoutRef.current = timeoutId

    return () => {
      clearTimeout(timeoutId)
      searchTimeoutRef.current = null
      abortController.abort()
    }
  }, [searchText])

  // For auto-search when histories changes (no debounce, no loading)
  useEffect(() => {
    // Clear pending searchText debounce to avoid duplicate requests
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = null
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
    }

    const abortController = new AbortController()
    searchAbortRef.current = abortController
    const doFetch = async () => {
      try {
        const response = await fetch("/api/chat/search", {
          method: "POST",
          headers: {
            "accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: searchText,
            max_length: 100
          }),
          signal: abortController.signal
        })
        const data = await response.json()
        if (data.success && data.data) {
          setSearchResult(data.data)
        } else {
          setSearchResult([])
        }
        setLoading(false)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }
        setSearchResult([])
        setLoading(false)
      }
    }
    doFetch()

    return () => {
      abortController.abort()
    }
  }, [histories])

  // For manual search calls (star, rename, delete)
  const doSearch = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/chat/search", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: searchText,
          max_length: 100
        })
      })
      const data = await response.json()
      if (data.success && data.data) {
        setSearchResult(data.data)
      } else {
        setSearchResult([])
      }
      setLoading(false)
    } catch (_error) {
      setSearchResult([])
      setLoading(false)
    }
  }, [searchText])

  const handleSearch = (text: string) => {
    setSearchText(text)
  }

  const isAllSelected = searchResult.length > 0 && searchResult.every(chat => selectedChats.has(chat.chat_id))

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedChats(new Set())
    } else {
      const allIds = new Set(searchResult.map(chat => chat.chat_id))
      setSelectedChats(allIds)
    }
  }

  const handleCancelSelecting = () => {
    setSelecting(false)
    setSelectedChats(new Set())
  }

  const handleDeleteSelected = () => {
    if (selectedChats.size === 0) {
      return
    }
    setDeletingChatIds(Array.from(selectedChats))
  }

  const toggleSelectChat = (chatId: string) => {
    setSelectedChats(prev => {
      const newSet = new Set(prev)
      if (newSet.has(chatId)) {
        newSet.delete(chatId)
      } else {
        newSet.add(chatId)
      }
      return newSet
    })
  }

  const handleNewChat = () => {
    startTransition(() => {
      setCurrentChatId("")
      closeAllOverlays()
      navigate("/")
      loadHistories()
    })
  }

  const handleStarChat = async (chat: ChatHistoryPageItem) => {
    const isStarred = histories.starred.some(c => c.id === chat.chat_id)
    const response = await fetch(`/api/chat/${chat.chat_id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        star: !isStarred
      })
    })
    const data = await response.json()
    if (!isStarred && !data?.success) {
      showToast({
        message: t("sidebar.chat.starFailed"),
        type: "error"
      })
    }
    startTransition(() => {
      loadHistories()
    })
  }

  const confirmRename = (chat: ChatHistoryPageItem) => {
    startTransition(() => {
      openRenameModal(chat.chat_id)
    })
    setTimeout(() => {
      setIsSubMenuOpen(true)
    }, 0)
  }

  const confirmDelete = (chat: ChatHistoryPageItem) => {
    setDeletingChatIds([chat.chat_id])
    setTimeout(() => {
      setIsSubMenuOpen(true)
    }, 0)
  }

  const handleDelete = async () => {
    if (deletingChatIds.length === 0)
      return

    setLoading(true)
    try {
      const response = await fetch("/api/chat/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(deletingChatIds)
      })
      const data = await response.json()

      if (data.success) {
        await deleteMultiChat(deletingChatIds)
      }
    } catch (_error) {
      setLoading(false)
    }
    setSelectedChats(new Set())
    setSelecting(false)
    setDeletingChatIds([])
    startTransition(() => {
      loadHistories()
    })
    await doSearch()
  }

  const isStarred = (chat: ChatHistoryPageItem) => {
    return histories.starred.some(c => c.id === chat.chat_id)
  }

  return (
    <PopupWindow overlay>
      <div className="history-page-container">
        <div className="history-page-header">
          <div className="history-page-header-title">
            {t("historyPage.headerTitle")}
            <Tooltip
              content={`${t("chat.newChatTooltip")} Ctrl + Shift + O`}
            >
              <Button
                className="new-chat-btn"
                theme="Color"
                color="primary"
                size="medium"
                noFocus
                svgFill="none"
                onClick={handleNewChat}
                >
                  <div>
                    <span>+ {t("chat.newChat")}</span>
                  </div>
                </Button>
            </Tooltip>
          </div>
          <Input
            ref={searchInputRef}
            size="medium"
            type={"text"}
            value={searchText}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t("historyPage.inputPlaceholder")}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                <path stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2" d="m15 15 5 5"></path>
                <path stroke="currentColor" strokeMiterlimit="10" strokeWidth="2" d="M9.5 17a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z">
                </path>
              </svg>
            }
            icon3={searchText.length > 0 &&
              <Button
                theme="TextOnly"
                color="neutral"
                size="small"
                shape="round"
                onClick={() => {
                  setSearchText("")
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 18 18"
                  width="18"
                  height="18"
                  className="dropdown-search-clear"
                >
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                </svg>
              </Button>
            }
          />
        </div>
        <div className="history-page-content-wrapper">
          {loading ?
              <div className="loading-wrapper">
                <div className="history-page-loading"></div>
              </div>
            :
            searchResult?.length === 0 ?
              <div className="no-result-wrapper">
                <div className="no-result">
                  {searchText?.length === 0 ? t("historyPage.noHistory") : t("historyPage.noResult")}
                </div>
              </div>
            :
              <div className={`history-page-content ${selecting && "selecting"}`}>
                <div className="history-page-result-tool">
                  {selecting ?
                    <>
                      <div className="history-page-result-tool-left">
                        <Button
                          theme="TextOnly"
                          color="neutral"
                          size="medium"
                          shape="round"
                          noFocus
                          onClick={handleCancelSelecting}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 18 18"
                            width="22"
                            height="22"
                            className="dropdown-search-clear"
                          >
                            <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                          </svg>
                        </Button>
                        <Button
                          theme="TextOnly"
                          color="primary"
                          size="medium"
                          noFocus
                          onClick={handleSelectAll}
                        >
                          {isAllSelected ? t("common.deselectAll") : t("common.selectAll")}
                        </Button>
                        <span className="result-count">
                          { selectedChats.size === 0 ?
                            t("historyPage.recordsCount", { count: searchResult.length })
                          :
                            t("historyPage.selectedRecords", { count: selectedChats.size })
                          }
                        </span>
                      </div>
                      <div className="history-page-result-tool-right">
                        <Button
                          theme="TextOnly"
                          color="neutral"
                          size="medium"
                          shape="round"
                          svgFill="none"
                          noFocus
                          onClick={handleDeleteSelected}
                          disabled={selectedChats.size === 0}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M3.27295 5.45312H20.7275" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M18.5455 7.63672V19.8956C18.5197 20.4286 18.2757 20.93 17.8667 21.2901C17.4578 21.6502 16.9173 21.8395 16.3637 21.8167H7.63641C7.08276 21.8395 6.5423 21.6502 6.13336 21.2901C5.72443 20.93 5.48035 20.4286 5.45459 19.8956V7.63672" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                            <path d="M8.72705 10.9531L15.2725 17.4986" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                            <path d="M15.2725 10.9531L8.72705 17.4986" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                            <path d="M14.7725 2.18359H9.22705C8.95091 2.18359 8.72705 2.40745 8.72705 2.68359V4.95632C8.72705 5.23246 8.95091 5.45632 9.22705 5.45632H14.7725C15.0486 5.45632 15.2725 5.23246 15.2725 4.95632V2.68359C15.2725 2.40745 15.0486 2.18359 14.7725 2.18359Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                          </svg>
                        </Button>
                      </div>
                    </>
                    :
                    <>
                      <div className="history-page-result-tool-left">
                        <span className="result-count">{t(searchText?.length === 0 ? "historyPage.totalRecordsCount" : "historyPage.searchFound", { count: searchResult.length })}</span>
                      </div>
                      <div className="history-page-result-tool-right">
                        <Button
                          theme="Color"
                          color="neutral"
                          size="medium"
                          onClick={() => setSelecting(true)}
                        >
                          {t("common.select")}
                        </Button>
                      </div>
                    </>
                  }
                </div>
                <div className="history-page-result-wrapper">
                  <div className="history-page-result-wrapper-left"></div>
                  <div className="history-page-result-wrapper-right" ref={resultContainerRef}>
                    {searchResult.map((chat) => (
                      <div
                        key={chat.chat_id}
                        className={`history-page-result-item ${chat.chat_id === currentChatId ? "active" : ""} ${selectedChats.has(chat.chat_id) ? "selected" : ""}`}
                        onClick={() => {
                          if (selecting) {
                            toggleSelectChat(chat.chat_id)
                          } else {
                            handleNavigateToMessage(chat)
                          }
                        }}
                      >
                        {selecting && (
                          <div
                            className="history-page-result-checkbox"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelectChat(chat.chat_id)
                            }}
                          >
                            <CheckBox
                              checked={selectedChats.has(chat.chat_id)}
                              onChange={(e) => {
                                e.stopPropagation()
                                toggleSelectChat(chat.chat_id)
                              }}
                            />
                          </div>
                        )}
                        <div className="history-page-result-item-content">
                          <div className="history-page-result-item-title">{chat.title_snippet ? <HighlightText text={chat.title_snippet} keyword={searchText} /> : t("chat.untitledChat")}</div>
                          {chat.content_snippet &&
                            <div className="history-page-result-item-detail">
                              <HighlightText text={chat.content_snippet} keyword={searchText} />
                            </div>
                          }
                          <div className="history-page-result-item-date">
                            {new Date(chat.msg_created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="history-page-result-item-right" onClick={e => e.stopPropagation()}>
                          {!selecting && <div onClick={e => e.stopPropagation()}>
                            <Dropdown
                              onClose={() => {
                                setIsSubMenuOpen(false)
                              }}
                              onOpen={() => {
                                setIsSubMenuOpen(true)
                              }}
                              placement="right"
                              options={{
                                "root": {
                                  subOptions: [
                                    {
                                      label: (
                                        <div className="sidebar-chat-menu-item">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                                            <g clipPath="url(#clip0_2089_64)">
                                              <mask id="path-1-inside-1_2089_64" fill="white">
                                                <path d="M21.2782 7.77818C21.6686 8.16871 21.6687 8.8019 21.2782 9.19239L18.4497 12.0208C18.0593 12.4113 17.4261 12.4112 17.0355 12.0208L16.4141 11.3993L13.4234 14.39C13.9195 16.4017 13.6245 18.5683 12.5388 20.3956C11.9746 21.3452 10.6806 21.3369 9.89956 20.5558L1.41428 12.0705C0.633267 11.2895 0.624898 9.99552 1.57448 9.43131C3.49137 8.2924 5.78188 8.02298 7.87491 8.62477L10.7572 5.74248L9.96447 4.94975C9.57394 4.55922 9.57394 3.92606 9.96447 3.53554L12.7929 0.707109C13.1834 0.316584 13.8166 0.316584 14.2071 0.707109L21.2782 7.77818Z"/>
                                              </mask>
                                              <path d="M21.2782 7.77818L22.6926 6.36419L22.6924 6.36396L21.2782 7.77818ZM21.2782 9.19239L22.6924 10.6066L22.6924 10.6066L21.2782 9.19239ZM18.4497 12.0208L19.864 13.435L18.4497 12.0208ZM17.0355 12.0208L15.6213 13.435L15.6216 13.4353L17.0355 12.0208ZM16.4141 11.3993L17.8283 9.98512L16.4141 8.57091L14.9998 9.98512L16.4141 11.3993ZM13.4234 14.39L12.0091 12.9758L11.2114 13.7736L11.4815 14.869L13.4234 14.39ZM12.5388 20.3956L14.2582 21.4172L14.2582 21.4172L12.5388 20.3956ZM1.41428 12.0705L2.42865e-05 13.4847L6.30616e-05 13.4847L1.41428 12.0705ZM1.57448 9.43131L0.552894 7.71191L0.552882 7.71191L1.57448 9.43131ZM7.87491 8.62477L7.32226 10.5469L8.45541 10.8727L9.28913 10.039L7.87491 8.62477ZM10.7572 5.74248L12.1714 7.1567L13.5856 5.74248L12.1714 4.32827L10.7572 5.74248ZM9.96447 3.53554L8.55025 2.12132L9.96447 3.53554ZM12.7929 0.707109L11.3787 -0.707105L11.3787 -0.707105L12.7929 0.707109ZM21.2782 7.77818L19.8637 9.19216C19.4736 8.80193 19.4732 8.16897 19.864 7.77818L21.2782 9.19239L22.6924 10.6066C23.8642 9.43484 23.8635 7.53549 22.6926 6.36419L21.2782 7.77818ZM21.2782 9.19239L19.864 7.77818L17.0355 10.6066L18.4497 12.0208L19.864 13.435L22.6924 10.6066L21.2782 9.19239ZM18.4497 12.0208L17.0355 10.6066C17.4263 10.2158 18.0593 10.2163 18.4495 10.6064L17.0355 12.0208L15.6216 13.4353C16.7929 14.6062 18.6922 14.6068 19.864 13.435L18.4497 12.0208ZM17.0355 12.0208L18.4497 10.6066L17.8283 9.98512L16.4141 11.3993L14.9998 12.8136L15.6213 13.435L17.0355 12.0208ZM16.4141 11.3993L14.9998 9.98512L12.0091 12.9758L13.4234 14.39L14.8376 15.8043L17.8283 12.8136L16.4141 11.3993ZM13.4234 14.39L11.4815 14.869C11.8545 16.3813 11.6312 18.0076 10.8194 19.374L12.5388 20.3956L14.2582 21.4172C15.6177 19.129 15.9845 16.4221 15.3652 13.9111L13.4234 14.39ZM12.5388 20.3956L10.8194 19.374C10.8555 19.3133 10.9212 19.2426 11.0126 19.1908C11.0987 19.142 11.1752 19.1281 11.2233 19.1262C11.3069 19.123 11.3235 19.1513 11.3138 19.1416L9.89956 20.5558L8.48534 21.97C9.91605 23.4007 12.8432 23.7988 14.2582 21.4172L12.5388 20.3956ZM9.89956 20.5558L11.3138 19.1416L2.82849 10.6563L1.41428 12.0705L6.30616e-05 13.4847L8.48534 21.97L9.89956 20.5558ZM1.41428 12.0705L2.82853 10.6564C2.81882 10.6466 2.84714 10.6632 2.84392 10.7468C2.84206 10.7949 2.82807 10.8714 2.7793 10.9575C2.72754 11.0489 2.6568 11.1146 2.59608 11.1507L1.57448 9.43131L0.552882 7.71191C-1.8287 9.12695 -1.43055 12.0541 2.42865e-05 13.4847L1.41428 12.0705ZM1.57448 9.43131L2.59607 11.1507C4.02999 10.2988 5.74973 10.0948 7.32226 10.5469L7.87491 8.62477L8.42756 6.70264C5.81403 5.9512 2.95275 6.28603 0.552894 7.71191L1.57448 9.43131ZM7.87491 8.62477L9.28913 10.039L12.1714 7.1567L10.7572 5.74248L9.34299 4.32827L6.4607 7.21056L7.87491 8.62477ZM10.7572 5.74248L12.1714 4.32827L11.3787 3.53554L9.96447 4.94975L8.55025 6.36396L9.34299 7.1567L10.7572 5.74248ZM9.96447 4.94975L11.3787 3.53554C11.7692 3.92606 11.7692 4.55922 11.3787 4.94975L9.96447 3.53554L8.55025 2.12132C7.37868 3.2929 7.37868 5.19239 8.55025 6.36396L9.96447 4.94975ZM9.96447 3.53554L11.3787 4.94975L14.2071 2.12132L12.7929 0.707109L11.3787 -0.707105L8.55025 2.12132L9.96447 3.53554ZM12.7929 0.707109L14.2071 2.12132C13.8166 2.51185 13.1834 2.51185 12.7929 2.12132L14.2071 0.707109L15.6213 -0.707105C14.4497 -1.87868 12.5503 -1.87868 11.3787 -0.707105L12.7929 0.707109ZM14.2071 0.707109L12.7929 2.12132L19.864 9.19239L21.2782 7.77818L22.6924 6.36396L15.6213 -0.707105L14.2071 0.707109Z" fill="currentColor" mask="url(#path-1-inside-1_2089_64)"/>
                                              <path d="M1.21387 19.3719C0.823341 19.7624 0.823341 20.3956 1.21387 20.7861C1.60439 21.1767 2.23755 21.1767 2.62808 20.7861L1.92097 20.079L1.21387 19.3719ZM6 16L5.29289 15.2929L1.21387 19.3719L1.92097 20.079L2.62808 20.7861L6.70711 16.7071L6 16Z" fill="currentColor"/>
                                            </g>
                                            <defs>
                                              <clipPath id="clip0_2089_64">
                                                <rect width="22" height="22" fill="currentColor"/>
                                              </clipPath>
                                            </defs>
                                          </svg>
                                          {isStarred(chat) ? t("sidebar.chat.unStarChat") : t("sidebar.chat.starChat")}
                                        </div>
                                      ),
                                      onClick: (_e) => handleStarChat(chat),
                                    },
                                    {
                                      label: (
                                        <div className="sidebar-chat-menu-item">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                                            <path d="M3 13.6689V19.0003H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M2.99991 13.5986L12.5235 4.12082C13.9997 2.65181 16.3929 2.65181 17.869 4.12082V4.12082C19.3452 5.58983 19.3452 7.97157 17.869 9.44058L8.34542 18.9183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                          {t("sidebar.chat.renameChat")}
                                        </div>
                                      ),
                                      onClick: (_e) => confirmRename(chat),
                                    },
                                    {
                                      label: (
                                        <div className="sidebar-chat-menu-item">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                                            <path d="M3 5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M17 7V18.2373C16.9764 18.7259 16.7527 19.1855 16.3778 19.5156C16.0029 19.8457 15.5075 20.0192 15 19.9983H7C6.49249 20.0192 5.99707 19.8457 5.62221 19.5156C5.24735 19.1855 5.02361 18.7259 5 18.2373V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                                            <path d="M8 10.04L14 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                                            <path d="M14 10.04L8 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                                            <path d="M13.5 2H8.5C8.22386 2 8 2.22386 8 2.5V4.5C8 4.77614 8.22386 5 8.5 5H13.5C13.7761 5 14 4.77614 14 4.5V2.5C14 2.22386 13.7761 2 13.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                                          </svg>
                                          {t("sidebar.chat.deleteChat")}
                                        </div>
                                      ),
                                      onClick: (_e) => confirmDelete(chat),
                                    }]
                                  }
                              }}
                            >
                              <div className="history-page-result-menu">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="18" height="18">
                                  <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                                </svg>
                              </div>
                            </Dropdown>
                          </div>}
                          {chatStreamingStatusMap.get(chat.chat_id) &&
                            <div className="history-item-loading"></div>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            }
        </div>
      </div>
      {deletingChatIds.length > 0 && (
        <DeleteConfirmModal
          deletingChatIds={deletingChatIds}
          onConfirm={handleDelete}
          onCancel={() => {
            setDeletingChatIds([])
          }}
          onFinish={() => {
            setIsSubMenuOpen(false)
          }}
        />
      )}
    </PopupWindow>
  )
}

export default React.memo(History)
