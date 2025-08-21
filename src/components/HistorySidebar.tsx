import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { sidebarVisibleAtom } from "../atoms/sidebarState"
import { ChatHistory, historiesAtom, loadHistoriesAtom } from "../atoms/historyState"
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
import Dropdown, { DropDownOptionType } from "./DropDown"
import { isLoggedInOAPAtom, OAPLevelAtom, oapUserAtom } from "../atoms/oapState"
import { OAP_ROOT_URL } from "../../shared/oap"
import { openUrl } from "../ipc/util"
import { imgPrefix } from "../ipc"
import Button from "./Button"
import { createPortal } from "react-dom"

interface Props {
  onNewChat?: () => void
}

interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

interface RenameConfirmProps {
  chat: ChatHistory | null
  onConfirm: (newName: string) => void
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
      className="delete-confirm-modal"
    >
      {t("chat.confirmDeleteDescription")}
    </PopupConfirm>
  )
}

const RenameConfirmModal: React.FC<RenameConfirmProps> = ({ chat, onConfirm, onCancel }) => {
  const { t } = useTranslation()
  const [newName, setNewName] = useState(chat?.title ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 0)
  }, [])

  return (
    <PopupConfirm
      confirmText={t("common.confirm")}
      cancelText={t("common.cancel")}
      onConfirm={() => onConfirm(newName)}
      onCancel={onCancel}
      onClickOutside={onCancel}
      noBorder
      footerType="center"
      zIndex={1000}
      className="rename-confirm-modal"
      disabled={newName === chat?.title}
    >
      <div className="rename-confirm-modal-content">
        {t("sidebar.chat.renameChat")}
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
      </div>
    </PopupConfirm>
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
  const [renamingChat, setRenamingChat] = useState<ChatHistory | null>(null)

  const openOverlay = useCallback((overlay: OverlayType) => {
    _openOverlay(overlay)
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

  const handleStarChat = async (chat: ChatHistory) => {
    const response = await fetch(`/api/chat/${chat.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        star: chat.type === "starred" ? false : true
      })
    })
    const data = await response.json()
    if (chat.type === "normal" && !data?.success) {
      showToast({
        message: t("sidebar.chat.starFailed"),
        type: "error"
      })
    }
    loadHistories()
  }

  const confirmRename = (chat: ChatHistory) => {
    setRenamingChat(chat)
  }

  const handleRename = async (newName: string) => {
    if (!renamingChat)
      return

    const response = await fetch(`/api/chat/${renamingChat.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: newName
      })
    })
    const data = await response.json()
    if (!data?.success) {
      showToast({
        message: t("sidebar.chat.renameFailed"),
        type: "error"
      })
    }
    loadHistories()

    setRenamingChat(null)
  }

  const loadChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId)
    closeAllOverlays()
    navigate(`/chat/${chatId}`)
  }, [navigate])

  const handleNewChat = () => {
    setCurrentChatId("")
    closeAllOverlays()
    if (onNewChat) {
      onNewChat()
    } else {
      navigate("/")
    }
  }

  const handleTools = () => {
    setCurrentChatId("")
    closeAllOverlays()
    openOverlay("Tools")
  }

  const handleModels = () => {
    setCurrentChatId("")
    closeAllOverlays()
    openOverlay("Model")
  }

  const handleSystem = () => {
    setCurrentChatId("")
    closeAllOverlays()
    openOverlay("System")
  }

  const handleOAP = () => {
    closeAllOverlays()
    openUrl(`${OAP_ROOT_URL}/u/dashboard`)
  }

  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.relatedTarget as HTMLElement
    const menuItem = target?.closest(".history-sidebar-side-menu-item")
    const menuLabel = target?.closest(".history-sidebar-side-menu-trigger")

    if (containerRef.current &&
        !containerRef.current.contains(e.relatedTarget as Node) &&
        !menuItem &&
        !menuLabel) {
      // setVisible(false)
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
          {histories.sort((a, b) => a.type === "starred" ? -1 : 1).map((chat: ChatHistory) => (
            <div
              key={chat.id}
              className={`history-item ${chat.id === currentChatId ? "active" : ""}`}
              onClick={() => loadChat(chat.id)}
            >
              <div className="history-content">
                {chat.type === "starred" && (
                  <div className="history-star">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <mask id="path-1-inside-1_2277_3661" fill="white">
                        <path d="M12.9081 5.08098C13.1034 5.27624 13.1034 5.59283 12.9081 5.78809L12.201 6.4952C12.0058 6.69046 11.6892 6.69046 11.4939 6.4952L11.1272 6.12852L8.34853 8.90723C8.66427 10.0988 8.48374 11.3943 7.80577 12.4662C7.51057 12.9329 6.86566 12.9291 6.47512 12.5387L1.52537 7.589C1.13484 7.19848 1.13045 6.55291 1.59718 6.25765C2.67395 5.57658 3.97673 5.39734 5.17277 5.71904L7.94526 2.94654L7.60483 2.60611C7.40958 2.41085 7.40957 2.09426 7.60483 1.899L8.31194 1.19189C8.50719 0.996637 8.82378 0.996645 9.01904 1.19189L12.9081 5.08098Z"/>
                      </mask>
                      <path d="M12.9081 5.08098C13.1034 5.27624 13.1034 5.59283 12.9081 5.78809L12.201 6.4952C12.0058 6.69046 11.6892 6.69046 11.4939 6.4952L11.1272 6.12852L8.34853 8.90723C8.66427 10.0988 8.48374 11.3943 7.80577 12.4662C7.51057 12.9329 6.86566 12.9291 6.47512 12.5387L1.52537 7.589C1.13484 7.19848 1.13045 6.55291 1.59718 6.25765C2.67395 5.57658 3.97673 5.39734 5.17277 5.71904L7.94526 2.94654L7.60483 2.60611C7.40958 2.41085 7.40957 2.09426 7.60483 1.899L8.31194 1.19189C8.50719 0.996637 8.82378 0.996645 9.01904 1.19189L12.9081 5.08098Z" fill="currentColor"/>
                      <path d="M12.201 6.4952L12.9081 7.2023L12.9081 7.2023L12.201 6.4952ZM11.1272 6.12852L11.8344 5.42142L11.1272 4.71431L10.4201 5.42142L11.1272 6.12852ZM8.34853 8.90723L7.64143 8.20012L7.23449 8.60706L7.38189 9.16336L8.34853 8.90723ZM7.80577 12.4662L8.65087 13.0009L8.65091 13.0008L7.80577 12.4662ZM6.47512 12.5387L5.76801 13.2459L5.76823 13.2461L6.47512 12.5387ZM1.59718 6.25765L1.06262 5.41252L1.06257 5.41256L1.59718 6.25765ZM5.17277 5.71904L4.91303 6.68471L5.47118 6.83484L5.87988 6.42614L5.17277 5.71904ZM7.94526 2.94654L8.65237 3.65365L9.35948 2.94654L8.65237 2.23943L7.94526 2.94654ZM7.60483 2.60611L6.8977 3.31319L6.89772 3.31322L7.60483 2.60611ZM7.60483 1.899L6.89772 1.19189L6.89772 1.1919L7.60483 1.899ZM9.01904 1.19189L9.72615 0.484788L9.72613 0.484763L9.01904 1.19189ZM12.9081 5.08098L12.201 5.78809C12.0058 5.59283 12.0058 5.27624 12.201 5.08098L12.9081 5.78809L13.6152 6.4952C14.201 5.90941 14.201 4.95966 13.6152 4.37388L12.9081 5.08098ZM12.9081 5.78809L12.201 5.08098L11.4939 5.78809L12.201 6.4952L12.9081 7.2023L13.6152 6.4952L12.9081 5.78809ZM12.201 6.4952L11.4939 5.78809C11.6892 5.59283 12.0058 5.59283 12.201 5.78809L11.4939 6.4952L10.7868 7.2023C11.3726 7.78809 12.3223 7.78809 12.9081 7.2023L12.201 6.4952ZM11.4939 6.4952L12.201 5.78809L11.8344 5.42142L11.1272 6.12852L10.4201 6.83563L10.7868 7.2023L11.4939 6.4952ZM11.1272 6.12852L10.4201 5.42142L7.64143 8.20012L8.34853 8.90723L9.05564 9.61434L11.8344 6.83563L11.1272 6.12852ZM8.34853 8.90723L7.38189 9.16336C7.62806 10.0924 7.48632 11.1006 6.96064 11.9317L7.80577 12.4662L8.65091 13.0008C9.48117 11.6881 9.70047 10.1052 9.31518 8.6511L8.34853 8.90723ZM7.80577 12.4662L6.96068 11.9316C6.9775 11.905 7.0074 11.8744 7.04805 11.8522C7.08636 11.8312 7.12011 11.8252 7.14146 11.8245C7.17878 11.8232 7.18643 11.8358 7.182 11.8314L6.47512 12.5387L5.76823 13.2461C6.49375 13.9711 7.92905 14.1419 8.65087 13.0009L7.80577 12.4662ZM6.47512 12.5387L7.18222 11.8316L2.23248 6.88189L1.52537 7.589L0.818262 8.29611L5.76801 13.2459L6.47512 12.5387ZM1.52537 7.589L2.23248 6.88189C2.22798 6.8774 2.24048 6.88474 2.23922 6.92169C2.2385 6.94289 2.23257 6.97662 2.21159 7.015C2.18931 7.05575 2.15858 7.0858 2.1318 7.10275L1.59718 6.25765L1.06257 5.41256C-0.0795107 6.13505 0.0935972 7.57144 0.818262 8.29611L1.52537 7.589ZM1.59718 6.25765L2.13174 7.10278C2.96671 6.57465 3.98059 6.43392 4.91303 6.68471L5.17277 5.71904L5.43251 4.75336C3.97287 4.36076 2.3812 4.5785 1.06262 5.41252L1.59718 6.25765ZM5.17277 5.71904L5.87988 6.42614L8.65237 3.65365L7.94526 2.94654L7.23816 2.23943L4.46566 5.01193L5.17277 5.71904ZM7.94526 2.94654L8.65237 2.23943L8.31194 1.899L7.60483 2.60611L6.89772 3.31322L7.23816 3.65365L7.94526 2.94654ZM7.60483 2.60611L8.31196 1.89903C8.50718 2.09426 8.50723 2.41082 8.31194 2.60611L7.60483 1.899L6.89772 1.1919C6.31192 1.7777 6.31198 2.72743 6.8977 3.31319L7.60483 2.60611ZM7.60483 1.899L8.31194 2.60611L9.01904 1.899L8.31194 1.19189L7.60483 0.484788L6.89772 1.19189L7.60483 1.899ZM8.31194 1.19189L9.01904 1.899C8.82375 2.09429 8.50719 2.09424 8.31196 1.89903L9.01904 1.19189L9.72613 0.484763C9.14037 -0.100953 8.19064 -0.101019 7.60483 0.484788L8.31194 1.19189ZM9.01904 1.19189L8.31194 1.899L12.201 5.78809L12.9081 5.08098L13.6152 4.37388L9.72615 0.484788L9.01904 1.19189Z" fill="currentColor" mask="url(#path-1-inside-1_2277_3661)"/>
                      <path d="M0.969304 12.0316C0.67641 12.3245 0.67641 12.7993 0.969304 13.0922C1.2622 13.3851 1.73707 13.3851 2.02996 13.0922L1.49963 12.5619L0.969304 12.0316ZM4.21973 9.8418L3.6894 9.31147L0.969304 12.0316L1.49963 12.5619L2.02996 13.0922L4.75006 10.3721L4.21973 9.8418Z" fill="currentColor"/>
                    </svg>
                    {t("sidebar.chat.starredChat")}
                  </div>
                )}
                <div className="history-title">{chat.title || t("chat.untitledChat")}</div>
                <div className="history-date">
                  {new Date(chat.createdAt).toLocaleString()}
                </div>
              </div>
              {!isChatStreaming && (
                <div onClick={e => e.stopPropagation()}>
                  <Dropdown
                    placement="right"
                    options={[
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
                            {chat.type === "starred" ? t("sidebar.chat.unStarChat") : t("sidebar.chat.starChat")}
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
                        onClick: (e) => confirmRename(chat),
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
                        onClick: (e) => confirmDelete(e, chat.id),
                      }
                    ]}
                  >
                    <div className="sidebar-chat-menu">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="18" height="18">
                        <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                      </svg>
                    </div>
                  </Dropdown>
                </div>
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
      {renamingChat && (
        <RenameConfirmModal
          chat={renamingChat}
          onConfirm={handleRename}
          onCancel={() => setRenamingChat(null)}
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
    if (!isMainVisible) {
      setIsOpen(false)
    }
  }, [isMainVisible])

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
        left: (mainContainerRect?.left ?? 0) + (mainContainerRect?.width ?? 0)
      })
    }, 0)
  }

  const SideMenuList = () => {
    return createPortal(
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
              {item.leftSlot &&
                <div className={"left-slot"}>
                  {item.leftSlot}
                </div>
              }
              {item.icon && item.icon}
              {item.label}
              {item.rightSlot &&
                <div className={"right-slot"}>
                  {item.rightSlot}
                </div>
              }
            </div>
          )
        })}
      </div>,
      document.body
    )
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
        <SideMenuList />
      }
    </div>
  )
}

export default React.memo(HistorySidebar)