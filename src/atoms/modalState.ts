import { atom } from "jotai"

export const keymapModalVisibleAtom = atom(false)
export const isKeymapClickedAtom = atom(false)

export const toggleKeymapModalAtom = atom(
  (get) => get(keymapModalVisibleAtom),
  (get, set) => set(keymapModalVisibleAtom, !get(keymapModalVisibleAtom))
)

export const renameChatIdAtom = atom<string | null>(null)
export const renameModalVisibleAtom = atom(false)

export const openRenameModalAtom = atom(
  null,
  (get, set, chatId: string) => {
    set(renameChatIdAtom, chatId)
    set(renameModalVisibleAtom, true)
  }
)

export const closeRenameModalAtom = atom(
  null,
  (get, set) => {
    set(renameModalVisibleAtom, false)
    set(renameChatIdAtom, null)
  }
)
