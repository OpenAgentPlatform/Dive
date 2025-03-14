import React, { useCallback, useMemo } from "react"
import { keymapModalVisibleAtom } from "../../atoms/modalState"
import PopupConfirm from "../PopupConfirm"
import { useTranslation } from "react-i18next"
import { rawKeymapAtom } from "../../atoms/hotkeyState"
import { useAtom, useAtomValue } from "jotai"


const KeymapModal = () => {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useAtom(keymapModalVisibleAtom)
  const keyMap = useAtomValue(rawKeymapAtom)

  const formatHotkey = (key: string): string => {
    const metaKey = window.PLATFORM === "darwin" ? "⌘" : window.PLATFORM === "win32" ? "Win" : "Super"
    // Check if it"s a pure combination key format <c-o>
    if (key.startsWith("<") && key.endsWith(">") && !key.slice(1, -1).includes("><")) {
      const parts = key.slice(1, -1).split("-")
      const lastPart = parts[parts.length - 1]

      // Check if the last part is a single uppercase letter
      const isUpperCaseLetter =
        lastPart.length === 1 &&
        lastPart >= "A" &&
        lastPart <= "Z" &&
        // Avoid adding shift if it"s already included
        !parts.includes("s")

      // If it"s an uppercase letter, add shift to parts
      if (isUpperCaseLetter && !parts.includes("s")) {
        parts.splice(parts.length - 1, 0, "s")
      }

      return parts.map((part, index) => {
        if (index === parts.length - 1) {
          // Map special keys in the last part
          switch (part.toLowerCase()) {
            case "space": return "Space"
            case "escape": case "esc": return "Esc"
            case "backspace": case "bs": return "⌫"
            case "delete": case "del": return "⌦"
            case "enter": return "Enter"
            case "tab": return "Tab"
            case "arrowup": case "up": return "↑"
            case "arrowdown": case "down": return "↓"
            case "arrowleft": case "left": return "←"
            case "arrowright": case "right": return "→"
            case " ": return "Space"
            default:
              // Consistently display as uppercase
              return part.toUpperCase()
          }
        }

        switch (part) {
          case "c": return "Ctrl"
          case "s": return "Shift"
          case "m": return metaKey
          case "a": return "Alt"
          case "space": return "Space"
          case "tab": return "Tab"
          case "enter": return "Enter"
          case "escape": case "esc": return "Esc"
          case "backspace": case "bs": return "⌫"
          case "delete": case "del": return "⌦"
          default: return part.charAt(0).toUpperCase() + part.slice(1)
        }
      }).join(" + ")
    } else {
      // Handle mixed format <space>k or sequence format yk
      const regex = /<([^>]+)>|(.)/g
      let match
      const parts = []

      while ((match = regex.exec(key)) !== null) {
        const specialKey = match[1]
        const normalKey = match[2]

        if (specialKey) {
          // Handle special key names
          switch (specialKey.toLowerCase()) {
            case "c": parts.push("Ctrl"); break
            case "s": parts.push("Shift"); break
            case "m": parts.push(metaKey); break
            case "a": parts.push("Alt"); break
            case "space": parts.push("Space"); break
            case "tab": parts.push("Tab"); break
            case "enter": parts.push("Enter"); break
            case "escape": case "esc": parts.push("Esc"); break
            case "backspace": case "bs": parts.push("⌫"); break
            case "delete": case "del": parts.push("⌦"); break
            case "arrowup": case "up": parts.push("↑"); break
            case "arrowdown": case "down": parts.push("↓"); break
            case "arrowleft": case "left": parts.push("←"); break
            case "arrowright": case "right": parts.push("→"); break
            case " ": parts.push("Space"); break
            default: parts.push(specialKey.charAt(0) + specialKey.slice(1))
          }
        } else if (normalKey) {
          // Handle regular keys
          switch (normalKey.toLowerCase()) {
            case "space": parts.push("Space"); break
            case "escape": parts.push("Esc"); break
            case "arrowup": parts.push("↑"); break
            case "arrowdown": parts.push("↓"); break
            case "arrowleft": parts.push("←"); break
            case "arrowright": parts.push("→"); break
            default: parts.push(normalKey);
          }
        }
      }

      return parts.join(" > ")
    }
  }

  const formattedHotkeys = useMemo(() => {
    if (!keyMap)
      return []

    return Object.entries(keyMap).map(([eventKey, hotkey]) => {
      return {
        event: eventKey.replace(":", "_"),
        display: formatHotkey(hotkey)
      }
    })
  }, [keyMap])

  const hotkeyRows = useMemo(() => {
    const rows = []
    for (let i = 0; i < formattedHotkeys.length; i += 2) {
      rows.push(formattedHotkeys.slice(i, i + 2))
    }
    return rows
  }, [formattedHotkeys])

  const onClose = useCallback(() => {
    setIsVisible(false)
  }, [setIsVisible])

  if (!isVisible)
    return null

  return (
    <PopupConfirm
      onClickOutside={onClose}
      title={t("keymap.title")}
      className="keymap-container"
      zIndex={1100}
      noBackground>
      <div className="keymap-list">
        {hotkeyRows.map((row, rowIndex) => (
          <div key={rowIndex} className={`keymap-row ${row.length === 1 ? "single-item-row" : ""}`}>
            {row.map((item) => (
              <div key={item.event} className="keymap-item">
                <div className="keymap-shortcut">
                  <span className="kbd">{item.display}</span>
                </div>
                <div className="keymap-event">{t(`keymap.events.${item.event}`)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </PopupConfirm>
  )
}

export default React.memo(KeymapModal)
