import { atom } from "jotai"
import { Tab } from "./layerState"

export const newVersionAtom = atom<string | null>(null)

export const commonFlashAtom = atom<string | null>(null)

// for connector re-authorize callback
export const authorizeStateAtom = atom<string | null>(null)
export const settingTabAtom = atom<Tab>("Tools")
