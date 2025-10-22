import React, { useState, useEffect, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useSetAtom, useAtomValue } from "jotai"
import { closeRenameModalAtom, renameChatIdAtom, renameModalVisibleAtom } from "../../atoms/modalState"
import { showToastAtom } from "../../atoms/toastState"
import { loadHistoriesAtom, historiesAtom } from "../../atoms/historyState"
import PopupConfirm from "../PopupConfirm"
import Input from "../Input"

const RenameConfirmModal: React.FC = () => {
  const { t } = useTranslation()
  const isVisible = useAtomValue(renameModalVisibleAtom)
  const chatId = useAtomValue(renameChatIdAtom)
  const closeRenameModal = useSetAtom(closeRenameModalAtom)
  const showToast = useSetAtom(showToastAtom)
  const loadHistories = useSetAtom(loadHistoriesAtom)
  const histories = useAtomValue(historiesAtom)
  const [newName, setNewName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const chat = useMemo(() => {
    if (!chatId) {
      return null
    }
    return [...histories.starred, ...histories.normal].find(c => c.id === chatId)
  }, [chatId, histories])

  useEffect(() => {
    if (isVisible && chat) {
      setNewName(chat.title)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 0)
    }
  }, [isVisible, chat])

  const handleConfirm = async () => {
    if (!chatId || !chat) {
      return
    }

    const response = await fetch(`/api/chat/${chatId}`, {
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
    closeRenameModal()
  }

  const handleCancel = () => {
    closeRenameModal()
  }

  if (!isVisible || !chat) {
    return null
  }

  return (
    <PopupConfirm
      confirmText={t("common.confirm")}
      cancelText={t("common.cancel")}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      onClickOutside={handleCancel}
      noBorder
      footerType="center"
      zIndex={1000}
      className="rename-confirm-modal"
      disabled={newName === chat.title}
    >
      <div className="rename-confirm-modal-content">
        <Input
          label={t("sidebar.chat.renameChat")}
          ref={inputRef}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
      </div>
    </PopupConfirm>
  )
}

export default React.memo(RenameConfirmModal)
