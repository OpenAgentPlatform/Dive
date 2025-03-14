import { atom, getDefaultStore } from "jotai"
import merge from "lodash/merge"
import { closeAllSidebarsAtom, toggleSidebarAtom } from "./sidebarState"
import { router } from "../router"
import mitt from "mitt"
import { closeAllOverlaysAtom, popLayerAtom } from "./layerState"
import { toggleKeymapModalAtom } from "./modalState"
import { currentChatIdAtom } from "./chatState"

export const ChatInputHotkeyEvent = [
    "chat-input:submit",
    "chat-input:upload-file",
    "chat-input:focus",
    "chat-input:paste-last-message"
] as const
export type ChatInputHotkeyEvent = typeof ChatInputHotkeyEvent[number]

export const ChatMessageHotkeyEvent = ["chat-message:copy-last", "chat:delete"] as const
export type ChatMessageHotkeyEvent = typeof ChatMessageHotkeyEvent[number]

export const GlobalHotkeyEvent = [
  "global:new-chat",
  "global:toggle-sidebar",
  "global:close-layer",
  "global:toggle-keymap-modal",
] as const
export type GlobalHotkeyEvent = typeof GlobalHotkeyEvent[number]

export type HotkeyEvent = ChatInputHotkeyEvent|ChatMessageHotkeyEvent|GlobalHotkeyEvent

export type Modifier = "c"|"s"|"a"|"m"
export type ModifierPressed = {
  c?: boolean
  s?: boolean
  a?: boolean
  m?: boolean
}

export const emitter = mitt<Record<HotkeyEvent, undefined>>()

function getModifierPressedFromEvent(event: KeyboardEvent): ModifierPressed {
  return {
    c: event.ctrlKey,
    s: event.shiftKey,
    a: event.altKey,
    m: event.metaKey
  }
}

function compareModifierPressed(a: ModifierPressed, b: ModifierPressed): boolean {
  return !!a.c === !!b.c && !!a.s === !!b.s && !!a.a === !!b.a && !!a.m === !!b.m
}

function getModifierPressed(mods: Modifier[]): ModifierPressed {
  return mods.reduce((acc, mod) => {
    if (mod !== "s" && mod !== "c" && mod !== "a" && mod !== "m") {
      return acc
    }

    return {
      ...acc,
      [mod]: true
    }
  }, {})
}

function parseStringWithOrder(str: string) {
  const result = []
  let current = ""
  let isInTag = false

  for (let i = 0; i < str.length; i++) {
    if (str[i] === "<") {
      if (current) {
        result.push({ type: "text", content: current })
        current = ""
      }
      isInTag = true
      continue
    }

    if (str[i] === ">") {
      if (current) {
        result.push({ type: "tag", content: current })
        current = ""
      }
      isInTag = false
      continue
    }

    current += str[i]
  }

  if (current) {
    result.push({ type: isInTag ? "tag" : "text", content: current })
  }

  return result
}

function parseHotkeyComponent(component: string, event: HotkeyEvent): Record<string, any> {
  const hotkey = parseStringWithOrder(component)
  if (!hotkey || !hotkey.length) {
    return {}
  }

  // TODO support <c-c><c-a>x in next time
  if (component.startsWith("<")) {
    return parseHotkeyTag(hotkey[0].content, event)
  }

  return parseHotkeyText(hotkey[0].content, event)
}

function parseHotkeyText(text: string, event: HotkeyEvent): Record<string, any> {
  const keys = text.split("")
  keys.reverse()
  return keys.reduce((acc, key, i) => {
    if (i === 0) {
      return {
        [key]: {
          event,
        }
      }
    }

    return {
      [key]: acc
    }
  }, {} as Record<string, any>)
}

function parseHotkeyTag(hotkey: string, event: HotkeyEvent): Record<string, any> {
  // minimal hotkey is like "c-a" if include "-" and length is less than 3, it"s invalid
  if (hotkey.includes("-") && hotkey.length < 3) {
    return {}
  }

  const buffer = hotkey.split("-")
  let key = buffer.pop()!
  if (!key) {
    key = "-"
  }

  const modifier: ModifierPressed = getModifierPressed(buffer as Modifier[])
  if (key >= "A" && key <= "Z") {
    modifier.s = true
  }

  return {
    [key.toLowerCase()]: {
      event,
      modifier,
    }
  }
}

function getHotkeyMap(hotkeys: Record<HotkeyEvent, string>) {
  return Object.keys(hotkeys).reduce((acc, event) => {
    return merge(acc, parseHotkeyComponent(hotkeys[event as HotkeyEvent], event as HotkeyEvent))
  }, {})
}

let hotkeyBuffer: string[] = []
export function handleGlobalHotkey(e: KeyboardEvent) {
  const store = getDefaultStore()

  const key = e.key.toLowerCase()
  if (key !== "control" && key !== "shift" && key !== "alt" && key !== "meta") {
    hotkeyBuffer.push(key)
  }

  const event = store.set(getHotkeyEventAtom, hotkeyBuffer, getModifierPressedFromEvent(e))

  if (event !== undefined) {
    hotkeyBuffer = []
  }

  if (event === null) {
    return
  }

  if (event) {
    e.preventDefault()
  }

  if (event && event.startsWith("global:")) {
    return store.set(handleGlobalEventAtom, event, e)
  }

  if (event) {
    emitter.emit(event)
  }
}

const handleGlobalEventAtom = atom(
  null,
  (get, set, event: GlobalHotkeyEvent, e: KeyboardEvent) => {
    switch (event) {
      case "global:close-layer":
        const lastLayer = set(popLayerAtom)
        if (lastLayer) {
          e.stopImmediatePropagation()
        }
        break
      case "global:new-chat":
        set(closeAllSidebarsAtom)
        set(closeAllOverlaysAtom)
        set(currentChatIdAtom, "")
        router.navigate("/")
        break
      case "global:toggle-sidebar":
        set(toggleSidebarAtom)
        break
      case "global:toggle-keymap-modal":
        set(toggleKeymapModalAtom)
        break
    }
  }
)

export const hotKeymapAtom = atom<Record<string, any>|null>(null)
export const rawKeymapAtom = atom<Record<string, string>>({})

export const loadHotkeyMapAtom = atom(
  null,
  async (get, set) => {
    const rawMap = await window.ipcRenderer.getHotkeyMap()
    const map = getHotkeyMap(rawMap)
    set(rawKeymapAtom, rawMap)
    set(hotKeymapAtom, map)
  }
)

export const getHotkeyEventAtom = atom(
  null,
  (get, set, keys: string[], modifierPressed: ModifierPressed) => {
    const map = get(hotKeymapAtom)
    if (!map) {
      return null
    }

    let _map
    for (const key of keys) {
      if (!_map) {
        _map = map[key]
      } else {
        _map = _map[key]
      }

      if (!_map) {
        return null
      }

      if (!("event" in _map)) {
        continue
      }

      if (!compareModifierPressed(_map.modifier, modifierPressed)) {
        return null
      }

      return _map.event
    }

    return undefined
  }
)