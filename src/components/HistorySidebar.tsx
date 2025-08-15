import React, { useState, useCallback, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { sidebarVisibleAtom } from "../atoms/sidebarState"
import { historiesAtom, loadHistoriesAtom } from "../atoms/historyState"
import Header from "./Header"
import { useTranslation } from "react-i18next"
import { showToastAtom } from "../atoms/toastState"
import Tooltip from "./Tooltip"
import { closeAllOverlaysAtom, openOverlayAtom, OverlayType } from "../atoms/layerState"
import { useSidebarLayer } from "../hooks/useLayer"
import useHotkeyEvent from "../hooks/useHotkeyEvent"
import { currentChatIdAtom, isChatStreamingAtom } from "../atoms/chatState"
import PopupConfirm from "./PopupConfirm"
import UpdateButton from "./UpdateButton"
import { DropDownOptionType } from "./DropDown"
import { isLoggedInOAPAtom, OAPLevelAtom, oapUserAtom } from "../atoms/oapState"
import { OAP_ROOT_URL } from "../../shared/oap"
import { openUrl } from "../ipc/util"
import { imgPrefix, oapLogout } from "../ipc"
import Button from "./Button"

interface Props {
  onNewChat?: () => void
}

interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

interface SideMenuProps {
  mainContainerRef: React.RefObject<HTMLDivElement>
  isMainVisible: boolean
  children: React.ReactNode
  options: DropDownOptionType[]
  className?: string
}

const DeleteConfirmModal: React.FC<DeleteConfirmProps> = ({ onConfirm, onCancel }) => {
  const { t } = useTranslation()
  const setCurrentChatId = useSetAtom(currentChatIdAtom)

  const _onConfirm = useCallback(() => {
    onConfirm()
    setCurrentChatId("")
  }, [onConfirm, setCurrentChatId])

  return (
    <PopupConfirm
      title={t("chat.confirmDelete")}
      confirmText={t("common.confirm")}
      cancelText={t("common.cancel")}
      onConfirm={_onConfirm}
      onCancel={onCancel}
      onClickOutside={onCancel}
      noBorder
      footerType="center"
      zIndex={1000}
    />
  )
}

const HistorySidebar = ({ onNewChat }: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const histories = useAtomValue(historiesAtom)
  const loadHistories = useSetAtom(loadHistoriesAtom)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const showToast = useSetAtom(showToastAtom)
  const _openOverlay = useSetAtom(openOverlayAtom)
  const closeAllOverlays = useSetAtom(closeAllOverlaysAtom)
  const [isVisible, setVisible] = useSidebarLayer(sidebarVisibleAtom)
  const [currentChatId, setCurrentChatId] = useAtom(currentChatIdAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const oapUser = useAtomValue(oapUserAtom)
  const oapLevel = useAtomValue(OAPLevelAtom)
  const isChatStreaming = useAtomValue(isChatStreamingAtom)

  const openOverlay = useCallback((overlay: OverlayType) => {
    _openOverlay(overlay)
    setVisible(false)
  }, [_openOverlay, setVisible])

  useEffect(() => {
    if (isVisible) {
      loadHistories()
      containerRef.current?.focus()
    }
  }, [isVisible, loadHistories])

  useHotkeyEvent("chat:delete", () => {
    currentChatId && setDeletingChatId(currentChatId)
  })

  const confirmDelete = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation()
    setDeletingChatId(chatId)
  }

  const handleDelete = async () => {
    if (!deletingChatId)
      return

    if (isChatStreaming) {
      return
    }

    try {
      const response = await fetch(`/api/chat/${deletingChatId}`, {
        method: "DELETE"
      })
      const data = await response.json()

      if (data.success) {
        showToast({
          message: t("chat.deleteSuccess"),
          type: "success"
        })

        if (location.pathname.includes(`/chat/${deletingChatId}`)) {
          navigate("/")
        }

        loadHistories()
      } else {
        showToast({
          message: t("chat.deleteFailed"),
          type: "error"
        })
      }
    } catch (_error) {
      showToast({
        message: t("chat.deleteFailed"),
        type: "error"
      })
    } finally {
      setDeletingChatId(null)
    }
  }

  const loadChat = useCallback((chatId: string) => {
    setVisible(false)
    setCurrentChatId(chatId)
    closeAllOverlays()
    navigate(`/chat/${chatId}`)
  }, [navigate])

  const handleNewChat = () => {
    setCurrentChatId("")
    setVisible(false)
    closeAllOverlays()
    if (onNewChat) {
      onNewChat()
    } else {
      navigate("/")
    }
  }

  const handleTools = () => {
    openOverlay("Tools")
  }

  const handleModels = () => {
    openOverlay("Model")
  }

  const handleSystem = () => {
    openOverlay("System")
  }

  const handleOAP = () => {
    openUrl(OAP_ROOT_URL)
    setVisible(false)
  }

  const handleSignOut = () => {
    oapLogout()
    setVisible(false)
  }

  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.relatedTarget as HTMLElement
    const menuItem = target?.closest(".history-sidebar-side-menu-item")
    const menuLabel = target?.closest(".history-sidebar-side-menu-trigger")

    if (containerRef.current &&
        !containerRef.current.contains(e.relatedTarget as Node) &&
        !menuItem &&
        !menuLabel) {
      setVisible(false)
    }
  }

  return (
    <>
      <div className={`history-sidebar ${isVisible ? "visible" : ""}`} tabIndex={0} onBlur={onBlur} ref={containerRef}>
        <Header />
        <div className="history-header">
          <Tooltip
            content={`${t("chat.newChatTooltip")} Ctrl + Shift + O`}
          >
            <Button
              className="new-chat-btn"
              color="blue"
              size="full"
              padding="n"
              onClick={handleNewChat}
            >
              + {t("chat.newChat")}
            </Button>
          </Tooltip>
        </div>
        <div className="history-list">
          {histories.map(chat => (
            <div
              key={chat.id}
              className={`history-item ${chat.id === currentChatId ? "active" : ""}`}
              onClick={() => loadChat(chat.id)}
            >
              <div className="history-content">
                <div className="history-title">{chat.title || t("chat.untitledChat")}</div>
                <div className="history-date">
                  {new Date(chat.createdAt).toLocaleString()}
                </div>
              </div>
              {!isChatStreaming && (
                <button
                  className="delete-btn"
                  onClick={(e) => confirmDelete(e, chat.id)}
                  title={t("chat.deleteChat")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <UpdateButton />
          <SideMenu
            className="sidebar-footer-btn"
            mainContainerRef={containerRef}
            isMainVisible={isVisible}
            options={[
              { label:
                  <button className="sidebar-footer-btn">
                    <svg className="filter" width="20" height="20" viewBox="0 0 24 24">
                      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                    </svg>
                    {t("sidebar.tools")}
                  </button>,
                onClick: handleTools,
                active: true
              },
              { label:
                  <button className="sidebar-footer-btn">
                    <svg className="filter" width="20px" height="20px" viewBox="0 0 20 20">
                      <g id="surface1">
                        <path d="M 8.015625 2.808594 C 5.308594 4.160156 5.589844 3.765625 5.589844 6.25 L 5.589844 8.367188 L 3.792969 9.292969 L 1.984375 10.21875 L 1.984375 15.367188 L 4.042969 16.425781 C 5.175781 17.015625 6.191406 17.5 6.292969 17.5 C 6.398438 17.5 7.28125 17.089844 8.28125 16.601562 L 10.074219 15.691406 L 11.851562 16.601562 C 12.839844 17.089844 13.71875 17.5 13.808594 17.5 C 14.074219 17.5 17.71875 15.632812 17.910156 15.398438 C 18.042969 15.234375 18.089844 14.5 18.058594 12.707031 L 18.015625 10.21875 L 16.21875 9.292969 L 14.410156 8.367188 L 14.410156 6.265625 C 14.410156 4.441406 14.382812 4.132812 14.160156 3.941406 C 13.765625 3.589844 10.339844 1.910156 10.042969 1.925781 C 9.898438 1.925781 8.984375 2.324219 8.015625 2.808594 Z M 11.324219 3.808594 L 12.425781 4.382812 L 11.21875 4.96875 L 10.03125 5.558594 L 8.867188 4.957031 L 7.691406 4.351562 L 8.808594 3.808594 C 9.425781 3.5 10 3.25 10.074219 3.25 C 10.160156 3.25 10.71875 3.5 11.324219 3.808594 Z M 8.234375 6.03125 L 9.410156 6.617188 L 9.410156 8.089844 C 9.410156 8.898438 9.382812 9.558594 9.339844 9.558594 C 9.292969 9.558594 8.734375 9.292969 8.089844 8.96875 L 6.910156 8.382812 L 6.910156 6.910156 C 6.910156 6.101562 6.941406 5.441406 6.984375 5.441406 C 7.03125 5.441406 7.589844 5.707031 8.234375 6.03125 Z M 13.089844 6.910156 L 13.089844 8.382812 L 11.910156 8.96875 C 11.265625 9.292969 10.707031 9.558594 10.660156 9.558594 C 10.617188 9.558594 10.589844 8.910156 10.589844 8.117188 L 10.589844 6.675781 L 11.808594 6.074219 C 12.46875 5.734375 13.03125 5.457031 13.058594 5.457031 C 13.074219 5.441406 13.089844 6.101562 13.089844 6.910156 Z M 7.425781 11.207031 L 6.265625 11.792969 L 5.074219 11.21875 L 3.898438 10.632812 L 5.074219 10.03125 L 6.25 9.441406 L 7.425781 10.03125 L 8.601562 10.617188 Z M 14.925781 11.207031 L 13.765625 11.792969 L 12.574219 11.21875 L 11.398438 10.632812 L 12.574219 10.03125 L 13.75 9.441406 L 14.925781 10.03125 L 16.101562 10.617188 Z M 5.589844 14.351562 L 5.589844 15.839844 L 3.089844 14.542969 L 3.089844 11.617188 L 5.589844 12.851562 Z M 9.351562 14.515625 C 9.308594 14.617188 8.734375 14.96875 8.089844 15.28125 L 6.910156 15.851562 L 6.910156 12.851562 L 8.132812 12.265625 L 9.339844 11.660156 L 9.382812 12.984375 C 9.398438 13.71875 9.398438 14.398438 9.351562 14.515625 Z M 13.089844 14.351562 L 13.089844 15.839844 L 10.589844 14.542969 L 10.589844 11.617188 L 13.089844 12.851562 Z M 16.851562 14.515625 C 16.808594 14.617188 16.234375 14.96875 15.589844 15.28125 L 14.410156 15.851562 L 14.410156 12.851562 L 15.632812 12.265625 L 16.839844 11.660156 L 16.882812 12.984375 C 16.898438 13.71875 16.898438 14.398438 16.851562 14.515625 Z M 16.851562 14.515625 "/>
                      </g>
                    </svg>
                    {t("sidebar.models")}
                  </button>,
                onClick: handleModels,
                active: true
              },
              { label:
                  <button className="sidebar-footer-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M13.6299 3L8.37917 3C6.44995 3 6.44995 3 5.22144 4.77778L2.3276 9.66667C1.8908 10.4044 1.8908 11.6044 2.3276 12.3333L5.22144 17.2222C6.44995 19 6.44995 19 8.37007 19L13.6299 19C15.5501 19 15.55 19 16.7786 17.2222L19.6724 12.3333C20.1092 11.6044 20.1092 10.4044 19.6724 9.66667L16.7786 4.77778C15.5501 3 15.5501 3 13.6299 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M11.0498 14.3C12.8447 14.3 14.2998 12.845 14.2998 11.05C14.2998 9.25512 12.8447 7.80005 11.0498 7.80005C9.25488 7.80005 7.7998 9.25512 7.7998 11.05C7.7998 12.845 9.25488 14.3 11.0498 14.3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {t("sidebar.system")}
                  </button>,
                onClick: handleSystem,
                active: true
              },
              { label:
                  <button className="sidebar-footer-btn oap">
                    <div className="oap-label">
                      <img src={`${imgPrefix}logo_oap.png`} alt="oap" className="provider-icon no-filter" />
                      {t("sidebar.OAPhub")}
                    </div>
                    <div className="oap-level">
                      {oapLevel}
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M8.5 16L13.5 11L8.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </div>
                  </button>,
                onClick: handleOAP,
                active: isLoggedInOAP
              },
              { label:
                  <button className="sidebar-footer-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 18" fill="none">
                      <path d="M7 1H3C1.89543 1 1 1.89543 1 3V14.5C1 15.6046 1.89543 16.5 3 16.5H7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M11 5L15 9L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <line x1="6" y1="8.75" x2="15" y2="8.75" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    {t("sidebar.signOut")}
                  </button>,
                onClick: handleSignOut,
                active: isLoggedInOAP
              }
            ].filter(item => item.active)}
          >
            <div className="sidemenu-btn">
              {isLoggedInOAP ?
                <>
                  <div className="oap-user-info">
                    {oapUser?.picture ?
                      <img className="oap-avatar" src={oapUser?.picture} onError={() => {
                        return (
                          <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#e0f2fe"></stop>
                                <stop offset="100%" stopColor="#bfdbfe"></stop>
                              </linearGradient>
                            </defs>
                            <rect width="80" height="80" fill="url(#gradient)"></rect>
                            <circle cx="40" cy="30" r="16" fill="#94a3b8"></circle>
                            <circle cx="40" cy="90" r="40" fill="#94a3b8"></circle>
                          </svg>
                        )
                      }} />
                      :
                      <svg className="oap-avatar" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#e0f2fe"></stop>
                            <stop offset="100%" stopColor="#bfdbfe"></stop>
                          </linearGradient>
                        </defs>
                        <rect width="80" height="80" fill="url(#gradient)"></rect>
                        <circle cx="40" cy="30" r="16" fill="#94a3b8"></circle>
                        <circle cx="40" cy="90" r="40" fill="#94a3b8"></circle>
                      </svg>
                    }
                    <div className="oap-username">{oapUser?.username}</div>
                  </div>
                  <span className="oap-level">{oapLevel}</span>
                </>
              :
                <div className="oap-user-info">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 22 22" fill="none">
                    <path d="M11 15C13.2091 15 15 13.2091 15 11C15 8.79086 13.2091 7 11 7C8.79086 7 7 8.79086 7 11C7 13.2091 8.79086 15 11 15Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10"/>
                    <path d="M13.5404 2.49103L12.4441 3.94267C11.3699 3.71161 10.2572 3.72873 9.19062 3.99275L8.04466 2.58391C6.85499 2.99056 5.76529 3.64532 4.84772 4.50483L5.55365 6.17806C4.82035 6.99581 4.28318 7.97002 3.98299 9.02659L2.19116 9.31422C1.94616 10.5476 1.96542 11.8188 2.24768 13.0442L4.05324 13.2691C4.38773 14.3157 4.96116 15.27 5.72815 16.0567L5.07906 17.7564C6.02859 18.5807 7.14198 19.1945 8.34591 19.5574L9.44108 18.1104C10.5154 18.3413 11.6283 18.3245 12.6951 18.0613L13.8405 19.4692C15.0302 19.0626 16.12 18.4079 17.0375 17.5483L16.3321 15.876C17.0654 15.0576 17.6027 14.0829 17.9031 13.0259L19.6949 12.7382C19.9396 11.5049 19.9203 10.2337 19.6384 9.00827L17.8291 8.77918C17.4946 7.73265 16.9211 6.77831 16.1541 5.99166L16.8023 4.29248C15.8544 3.46841 14.7427 2.85442 13.5404 2.49103Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10"/>
                  </svg>
                  {t("sidebar.manageAndSettings")}
                </div>
              }
            </div>
          </SideMenu>
        </div>
      </div>
      {deletingChatId && (
        <DeleteConfirmModal
          onConfirm={handleDelete}
          onCancel={() => setDeletingChatId(null)}
        />
      )}
    </>
  )
}

const SideMenu = ({ children, options, className, isMainVisible, mainContainerRef }: SideMenuProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      updatePosition()
    }
  }, [isOpen])

  useEffect(() => {
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const menuItem = target.closest(".history-sidebar-side-menu-item")

      if (menuItem) {
        return
      }

      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const updatePosition = () => {
    setTimeout(() => {
      const mainContainerRect = mainContainerRef.current?.getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()
      const menuRect = menuRef.current?.getBoundingClientRect()
      const windowHeight = window.innerHeight

      let top = containerRect?.top ?? menuPosition.top ?? 0
      const menuHeight = menuRect?.height ?? 0
      if (top + menuHeight > windowHeight) {
        top = windowHeight - menuHeight - 5
      }

      setMenuPosition({
        top,
        left: mainContainerRect ? mainContainerRect.left + mainContainerRect.width : menuPosition.left
      })
    }, 0)
  }


  return (
    <div className={`history-sidebar-side-menu-container ${className}`}
      ref={containerRef}
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="history-sidebar-side-menu-trigger" ref={triggerRef}>
        {children}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="16" height="16">
          <path fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9H7l4 4.5L15 9Z"></path>
        </svg>
      </div>
      {isMainVisible && isOpen &&
        <div
          ref={menuRef}
          className="history-sidebar-side-menu"
          style={{
            position: "fixed",
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          { options && options.map((item, index) => {
            if(item.visible === false){
              return null
            }

            return (
              <div
                key={index}
                className={`item history-sidebar-side-menu-item ${item.disabled ? "disabled" : ""}`}
                onClick={item.onClick}
              >
                { item.leftSlot &&
                  <div className={"left-slot"}>
                    {item.leftSlot}
                  </div>
                }
                { item.icon && item.icon}
                {item.label}
                { item.rightSlot &&
                  <div className={"right-slot"}>
                    {item.rightSlot}
                  </div>
                }
              </div>
            )
          })}
        </div>
      }
    </div>
  )
}

export default React.memo(HistorySidebar)