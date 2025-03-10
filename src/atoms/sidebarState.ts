import { atom } from "jotai"

export const sidebarVisibleAtom = atom(false)

export const toggleSidebarAtom = atom(
  null,
  (get, set) => {
    set(sidebarVisibleAtom, !get(sidebarVisibleAtom))
  }
)

export const closeAllSidebarsAtom = atom(
  null,
  (get, set) => {
    set(sidebarVisibleAtom, false)
  }
)
