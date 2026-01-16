import React, { useEffect, useRef, useCallback } from "react"

export interface SuggestionMenuItem {
  key: string
  [key: string]: unknown
}

interface SuggestionMenuProps<T extends SuggestionMenuItem> {
  show: boolean
  items: T[]
  selectedIndex: number
  onSelectedIndexChange: (index: number) => void
  onSelect: (item: T) => void
  onClose: () => void
  renderItem: (item: T, isSelected: boolean) => React.ReactNode
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  emptyContent?: React.ReactNode
  loadingContent?: React.ReactNode
  isLoading?: boolean
}

function SuggestionMenu<T extends SuggestionMenuItem>({
  show,
  items,
  selectedIndex,
  onSelectedIndexChange,
  onSelect,
  onClose,
  renderItem,
  textareaRef,
  emptyContent,
  loadingContent,
  isLoading = false,
}: SuggestionMenuProps<T>) {
  const menuRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef({ top: 0, left: 0, width: 0 })

  // Update menu position
  const updatePosition = useCallback(() => {
    if (textareaRef.current) {
      const rect = textareaRef.current.getBoundingClientRect()
      positionRef.current = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
      }
    }
  }, [textareaRef])

  // Update position when shown
  useEffect(() => {
    if (show) {
      updatePosition()
    }
  }, [show, updatePosition])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    if (show) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [show, onClose, textareaRef])

  // Scroll selected item into view
  useEffect(() => {
    if (show && menuRef.current) {
      const selectedItem = menuRef.current.querySelector(".chat-suggestion-item.selected")
      if (selectedItem) {
        selectedItem.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        })
      }
    }
  }, [selectedIndex, show])


  if (!show) return null

  updatePosition()

  return (
    <div
      ref={menuRef}
      className="chat-suggestion-menu"
      style={{
        position: "fixed",
        top: `${positionRef.current.top}px`,
        left: `${positionRef.current.left}px`,
        width: `${positionRef.current.width}px`,
      }}
    >
      {isLoading ? (
        <div className="chat-suggestion-item loading">{loadingContent}</div>
      ) : items.length === 0 ? (
        <div className="chat-suggestion-item no-results">{emptyContent}</div>
      ) : (
        items.map((item, index) => (
          <div
            key={item.key}
            className={`chat-suggestion-item ${index === selectedIndex ? "selected" : ""}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onSelectedIndexChange(index)}
          >
            {renderItem(item, index === selectedIndex)}
          </div>
        ))
      )}
    </div>
  )
}

export default SuggestionMenu
