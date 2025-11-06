import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { forwardRef, useEffect, useRef, useState } from "react"

export type DropDownOptionType = {
  label: string | React.ReactNode
  icon?: React.ReactNode
  leftSlot?: React.ReactNode,
  rightSlot?: React.ReactNode,
  visible?: boolean
  disabled?: boolean
  noHover?: boolean
  childrenKey?: string
  onClick?: (e: React.MouseEvent<HTMLElement>) => void
}

export type DropDownProps = {
  children: React.ReactNode
  placement?: "top" | "right" | "bottom" | "left"
  align?: "center" | "start" | "end"
  rootKey?: string
  options?: Record<string, {
    subOptions: DropDownOptionType[],
    preLabel?: string // For displaying the previous level name
    onBack?: (e: React.MouseEvent<HTMLElement>) => void
  }>
  content?: React.ReactNode
  contentClassName?: string
  maxHeight?: number
  fixWidth?: number
  fixHeight?: number
  size?: "m" | "l"
  width?: "auto" | "fill"
  freeze?: boolean
  onOpen?: () => void
  onClose?: () => void
}

type HistoryType = {
  key: string
  position: number
}

const Dropdown = forwardRef<HTMLButtonElement|null, DropDownProps>(({
  children,
  placement = "bottom",
  align = "end",
  options,
  rootKey = Object.keys(options || {})[0],
  content,
  contentClassName,
  maxHeight,
  fixWidth = 0,
  fixHeight = 0,
  size = "l",
  width,
  freeze = false,
  onOpen,
  onClose,
  ...rest
}, ref) => {
  const [activeMenu, setActiveMenu] = useState(rootKey) // current menu
  const [nextActiveMenu, setNextActiveMenu] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryType[]>([]) // history of parent menu
  const [transType, setTransType] = useState<"prev" | "next" | null>("next")
  const [isTransing, setIsTransing] = useState<boolean>(false)
  const [listHeight, setListHeight] = useState<number>(0)
  const [listWidth, setListWidth] = useState<number>(0)
  const mainRef = useRef<HTMLDivElement>(null)
  const newRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nextScrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollPosition = useRef<number | null>(null)

  // Restore scroll position when switching back to main menu
  useEffect(() => {
    if (pendingScrollPosition.current !== null && !nextActiveMenu) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: pendingScrollPosition.current!, behavior: "instant" })
        pendingScrollPosition.current = null
      })
    }
  }, [activeMenu, nextActiveMenu])

  const goToSubMenu = (key: string) => {
    if(nextActiveMenu || freeze){
      return
    }
    pendingScrollPosition.current = 0
    setHistory((prev) => [...prev, { key: activeMenu, position: scrollRef.current?.scrollTop || 0 }])
    setNextActiveMenu(key)
    setTransType("next")
    setIsTransing(false)
    const oldHeight = fixHeight > 0 ? fixHeight : mainRef.current?.clientHeight || 0
    const oldWidth = fixWidth > 0 ? fixWidth : mainRef.current?.clientWidth || 0
    setListHeight(oldHeight)
    setListWidth(oldWidth)
    setTimeout(() => {
      const newHeight = fixHeight > 0 ? fixHeight : newRef.current?.clientHeight || 0
      const newWidth = fixWidth > 0 ? fixWidth : newRef.current?.clientWidth || 0
      setListHeight(newHeight)
      setListWidth(newWidth)
      setIsTransing(true)
    }, 1)
    setTimeout(() => {
      setNextActiveMenu(null)
      setActiveMenu(key)
      setTransType(null)
      setIsTransing(false)
      setTimeout(() => {
        setListHeight(0)
        setListWidth(0)
      }, 100)
    }, 300)
  }

  const goBack = () => {
    if(nextActiveMenu || freeze){
      return
    }
    const prev = history[history.length - 1]
    // Store the scroll position to restore later
    pendingScrollPosition.current = prev.position
    setNextActiveMenu(prev.key || rootKey)
    setTransType("prev")
    setIsTransing(false)
    const oldHeight = fixHeight > 0 ? fixHeight : mainRef.current?.clientHeight || 0
    const oldWidth = fixWidth > 0 ? fixWidth : mainRef.current?.clientWidth || 0
    setListHeight(oldHeight)
    setListWidth(oldWidth)
    setTimeout(() => {
      const newHeight = fixHeight > 0 ? fixHeight : newRef.current?.clientHeight || 0
      const newWidth = fixWidth > 0 ? fixWidth : newRef.current?.clientWidth || 0
      setListHeight(newHeight)
      setListWidth(newWidth)
      setIsTransing(true)
      nextScrollRef.current?.scrollTo({ top: prev.position, behavior: "instant" })
    }, 1)
    setTimeout(() => {
      setNextActiveMenu(null)
      setActiveMenu(prev.key || rootKey)
      setTransType(null)
      setHistory((prev) => prev.slice(0, -1))
      setIsTransing(false)
      setTimeout(() => {
        setListHeight(0)
        setListWidth(0)
      }, 100)
    }, 300)
  }

  return (
    <DropdownMenu.Root
      onOpenChange={(isOpen) => {
        if (isOpen) {
          onOpen?.()
          setNextActiveMenu(null)
          setActiveMenu(rootKey)
          setTransType(null)
          setListHeight(0)
          setListWidth(0)
        } else {
          onClose?.()
          setNextActiveMenu(null)
          setActiveMenu(rootKey)
          setTransType(null)
          setListHeight(0)
          setListWidth(0)
        }
      }}
    >
      <DropdownMenu.Trigger asChild ref={ref} {...rest} >
        {children}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <>
          <DropdownMenu.Content
            style={
              {
                "--max-height": maxHeight ? `${maxHeight}px` : undefined,
                "--fix-width": fixWidth > 0 ? fixWidth+"px" : undefined,
                "--fix-height": fixHeight > 0 ? fixHeight+"px" : undefined,
                width: `${fixWidth > 0 ? fixWidth+"px" : listWidth > 0 ? listWidth+"px" : "auto"}`,
                height: `${fixHeight > 0 ? fixHeight+"px" : listHeight > 0 ? listHeight+"px" : "auto"}`
              } as React.CSSProperties
            }
            // style={maxHeight ? {maxHeight: `${maxHeight}px`} : {}}
            align={align}
            side={placement}
            collisionPadding={{ left: 16, right: 16 }}
            className={`dropdown-container-wrapper ${size} ${width === "fill" ? "fill" : ""} ${contentClassName}`}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (freeze) {
                e.preventDefault()
                return
              }
            }}
          >
            <div ref={mainRef} className="dropdown-container-content-wrapper">
              {activeMenu !== rootKey && (
                <DropdownMenu.Item
                  className="item back"
                  onClick={(e) => {
                    if (freeze) {
                      e.preventDefault()
                      return
                    }
                    goBack()
                    options?.[activeMenu]?.onBack?.(e)
                  }}
                  onSelect={(e) => e.preventDefault()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M7.17331 11.9171L11.665 16.4087C11.8483 16.5921 11.9362 16.8059 11.9285 17.0504C11.9209 17.2948 11.8254 17.5087 11.6421 17.6921C11.4587 17.8601 11.2448 17.948 11.0004 17.9556C10.7559 17.9632 10.5421 17.8754 10.3587 17.6921L4.30872 11.6421C4.21706 11.5504 4.15213 11.4511 4.11393 11.3441C4.07574 11.2372 4.05664 11.1226 4.05664 11.0004C4.05664 10.8782 4.07574 10.7636 4.11393 10.6566C4.15213 10.5497 4.21706 10.4504 4.30872 10.3587L10.3587 4.30872C10.5268 4.14067 10.7368 4.05664 10.9889 4.05664C11.241 4.05664 11.4587 4.14067 11.6421 4.30872C11.8254 4.49206 11.9171 4.70977 11.9171 4.96185C11.9171 5.21393 11.8254 5.43164 11.6421 5.61497L7.17331 10.0837H17.4171C17.6768 10.0837 17.8945 10.1716 18.0702 10.3473C18.2459 10.523 18.3337 10.7407 18.3337 11.0004C18.3337 11.2601 18.2459 11.4778 18.0702 11.6535C17.8945 11.8292 17.6768 11.9171 17.4171 11.9171H7.17331Z" fill="currentColor"/>
                  </svg>
                  <div className="dropdown-container-back-text">
                    {options?.[activeMenu]?.preLabel ?? "Back"}
                  </div>
                </DropdownMenu.Item>
              )}
              <div ref={scrollRef} className="dropdown-container-scroll-wrapper">
                { content && content }

                { options && options[activeMenu] && options[activeMenu].subOptions && options[activeMenu].subOptions.map((item, index) => {
                  if(item.visible === false){
                    return null
                  }

                  if (item.childrenKey) {
                    return (
                      <DropdownMenu.Item
                        key={index}
                        className="item has-sub"
                        onClick={(e) => {
                          goToSubMenu(item.childrenKey!)
                          item.onClick?.(e)
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div className="left-slot">
                          {item.label}
                        </div>
                        <div className="right-slot">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="23" viewBox="0 0 22 23" fill="none">
                            <path d="M12.0998 11.4991L8.5248 7.92409C8.35675 7.75603 8.27272 7.54214 8.27272 7.28242C8.27272 7.0227 8.35675 6.80881 8.5248 6.64076C8.69286 6.4727 8.90675 6.38867 9.16647 6.38867C9.42619 6.38867 9.64008 6.4727 9.80814 6.64076L14.0248 10.8574C14.2081 11.0408 14.2998 11.2546 14.2998 11.4991C14.2998 11.7435 14.2081 11.9574 14.0248 12.1408L9.80814 16.3574C9.64008 16.5255 9.42619 16.6095 9.16647 16.6095C8.90675 16.6095 8.69286 16.5255 8.5248 16.3574C8.35675 16.1894 8.27272 15.9755 8.27272 15.7158C8.27272 15.456 8.35675 15.2421 8.5248 15.0741L12.0998 11.4991Z" fill="currentColor"/>
                          </svg>
                        </div>
                      </DropdownMenu.Item>
                    )
                  }

                  return (
                    <DropdownMenu.Item key={index} disabled={item.disabled}>
                      <div
                        className={`item ${item.disabled ? "disabled" : ""} ${item.noHover ? "no-hover" : ""}`}
                        onClick={(e) => {
                          if(freeze) {
                            e.preventDefault()
                            return
                          }
                          item.onClick?.(e)
                        }}
                      >
                        { item.leftSlot &&
                          <div className={"left-slot"}>
                            {item.leftSlot}
                          </div>
                        }
                        { item.icon && item.icon }
                        { item.label }
                        { item.rightSlot &&
                          <div className={"right-slot"}>
                            {item.rightSlot}
                          </div>
                        }
                      </div>
                    </DropdownMenu.Item>
                  )
                })}
              </div>
            </div>
            {/* only for submenu transition */}
            {nextActiveMenu && (
              <div
                ref={newRef}
                className={`dropdown-container-content-wrapper new ${transType} ${isTransing ? "transing" : ""}`}
                style={
                  {
                    height: `${fixHeight > 0 ? "100%" : undefined}`
                  } as React.CSSProperties
                }
              >
                {nextActiveMenu !== rootKey && (
                  <DropdownMenu.Item className="item back">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M7.17331 11.9171L11.665 16.4087C11.8483 16.5921 11.9362 16.8059 11.9285 17.0504C11.9209 17.2948 11.8254 17.5087 11.6421 17.6921C11.4587 17.8601 11.2448 17.948 11.0004 17.9556C10.7559 17.9632 10.5421 17.8754 10.3587 17.6921L4.30872 11.6421C4.21706 11.5504 4.15213 11.4511 4.11393 11.3441C4.07574 11.2372 4.05664 11.1226 4.05664 11.0004C4.05664 10.8782 4.07574 10.7636 4.11393 10.6566C4.15213 10.5497 4.21706 10.4504 4.30872 10.3587L10.3587 4.30872C10.5268 4.14067 10.7368 4.05664 10.9889 4.05664C11.241 4.05664 11.4587 4.14067 11.6421 4.30872C11.8254 4.49206 11.9171 4.70977 11.9171 4.96185C11.9171 5.21393 11.8254 5.43164 11.6421 5.61497L7.17331 10.0837H17.4171C17.6768 10.0837 17.8945 10.1716 18.0702 10.3473C18.2459 10.523 18.3337 10.7407 18.3337 11.0004C18.3337 11.2601 18.2459 11.4778 18.0702 11.6535C17.8945 11.8292 17.6768 11.9171 17.4171 11.9171H7.17331Z" fill="currentColor"/>
                    </svg>
                    {options?.[nextActiveMenu]?.preLabel ?? "Back"}
                  </DropdownMenu.Item>
                )}
                <div ref={nextScrollRef} className="dropdown-container-scroll-wrapper">
                  { content && content }

                  { nextActiveMenu && options && options[nextActiveMenu] && options[nextActiveMenu].subOptions.map((item, index) => {
                    if(item.visible === false){
                      return null
                    }

                    if (item.childrenKey) {
                      return (
                        <DropdownMenu.Item
                          key={index}
                          className="item has-sub"
                        >
                          <div className="left-slot">
                            {item.label}
                          </div>
                          <div className="right-slot">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="23" viewBox="0 0 22 23" fill="none">
                              <path d="M12.0998 11.4991L8.5248 7.92409C8.35675 7.75603 8.27272 7.54214 8.27272 7.28242C8.27272 7.0227 8.35675 6.80881 8.5248 6.64076C8.69286 6.4727 8.90675 6.38867 9.16647 6.38867C9.42619 6.38867 9.64008 6.4727 9.80814 6.64076L14.0248 10.8574C14.2081 11.0408 14.2998 11.2546 14.2998 11.4991C14.2998 11.7435 14.2081 11.9574 14.0248 12.1408L9.80814 16.3574C9.64008 16.5255 9.42619 16.6095 9.16647 16.6095C8.90675 16.6095 8.69286 16.5255 8.5248 16.3574C8.35675 16.1894 8.27272 15.9755 8.27272 15.7158C8.27272 15.456 8.35675 15.2421 8.5248 15.0741L12.0998 11.4991Z" fill="currentColor"/>
                            </svg>
                          </div>
                        </DropdownMenu.Item>
                      )
                    }

                    return (
                      <DropdownMenu.Item key={index} disabled={item.disabled}>
                        <div className={`item ${item.disabled ? "disabled" : ""} ${item.noHover ? "no-hover" : ""}`}>
                          { item.leftSlot &&
                            <div className={"left-slot"}>
                              {item.leftSlot}
                            </div>
                          }
                          { item.icon && item.icon}
                          { item.label }
                          { item.rightSlot &&
                            <div className={"right-slot"}>
                              {item.rightSlot}
                            </div>
                          }
                        </div>
                      </DropdownMenu.Item>
                    )
                  })}
                </div>
              </div>
            )}
          </DropdownMenu.Content>
        </>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
})

Dropdown.displayName = "Dropdown"
export default Dropdown
