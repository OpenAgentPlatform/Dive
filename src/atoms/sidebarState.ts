import { atom } from "jotai"

export const sidebarVisibleAtom = atom(false)
const originalSidebarWidthAtom = atom(false)

export const toggleSidebarAtom = atom(
  null,
  (get, set) => {
    set(sidebarVisibleAtom, !get(sidebarVisibleAtom))
    set(originalSidebarWidthAtom, get(sidebarVisibleAtom))
  }
)

export const closeAllSidebarsAtom = atom(
  null,
  (get, set) => {
    set(sidebarVisibleAtom, false)
  }
)

export const handleWindowResizeAtom = atom(
  null,
  (get, set) => {
    if (window.innerWidth < 900) {
      set(sidebarVisibleAtom, false)
    } else if (window.innerWidth > 900 && get(originalSidebarWidthAtom)) {
      set(sidebarVisibleAtom, true)
    }
  }
)