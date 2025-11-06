import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import React, { forwardRef, useEffect, useRef, useState } from "react"
import Input from "./Input"
import Button from "./Button"
import { useTranslation } from "react-i18next"

export type DropDownOptionType = {
  label: string | React.ReactNode
  icon?: React.ReactNode
  leftSlot?: React.ReactNode,
  rightSlot?: React.ReactNode,
  visible?: boolean
  disabled?: boolean
  noHover?: boolean
  childrenKey?: string
  onClick?: (e?: React.MouseEvent<HTMLElement>) => void
  autoClose?: boolean //if not specified, it will be true
}

export type DropDownProps = {
  children: React.ReactNode
  placement?: "top" | "right" | "bottom" | "left"
  align?: "center" | "start" | "end"
  rootKey?: string
  onKeyChange?: (key: string) => void
  options?: Record<string, {
    subOptions: DropDownOptionType[],
    preLabel?: string // For displaying the previous level name
    onBack?: (e: React.MouseEvent<HTMLElement>) => void
    showSearch?: boolean //if not specified, it will be true
  }>
  content?: React.ReactNode
  contentClassName?: string
  maxHeight?: number
  fixWidth?: number
  fixHeight?: number
  size?: "m" | "l"
  width?: "auto" | "fill"
  freeze?: boolean
  onSearch: (value: string) => void
  searchInputIndex?: number // Specify the position of the search input (0-based index)
  searchPlaceholder?: string
  searchNoResultText?: string
  searchIcon?: React.ReactNode
  onOpen?: () => void
  onClose?: () => void
}

type HistoryType = {
  key: string
  position: number
}

const DropdownItem = ({
  setIsOpen,
  autoClose = true,
  onClick,
  children,
  ...rest
}: {
  setIsOpen: (isOpen: boolean) => void;
  autoClose?: boolean;
  onClick?: (e?: React.MouseEvent<HTMLElement>) => void;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      onClick={(e) => {
        onClick?.(e)
        if(autoClose){
          setIsOpen(false)
        }
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

const DropdownSearch = forwardRef<HTMLButtonElement|null, DropDownProps>(({
  children,
  placement = "bottom",
  align = "end",
  options,
  rootKey = Object.keys(options || {})[0],
  onKeyChange,
  content,
  contentClassName,
  maxHeight,
  fixWidth = 0,
  fixHeight = 0,
  size = "l",
  width,
  freeze = false,
  onSearch,
  searchInputIndex,
  searchPlaceholder,
  searchNoResultText,
  searchIcon,
  onOpen,
  onClose,
  ...rest
}, ref) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false) //It doesn't use DropdownMenu.item, so we need to use _isOpen to control the open state
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
  const [searchText, setSearchText] = useState<string>("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Restore scroll position when switching back to main menu
  useEffect(() => {
    if (pendingScrollPosition.current !== null && !nextActiveMenu) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: pendingScrollPosition.current!, behavior: "instant" })
        pendingScrollPosition.current = null
      })
    }
  }, [activeMenu, nextActiveMenu])

  useEffect(() => {
    onSearch(searchText)
  }, [searchText])

  const goToSubMenu = (key: string) => {
    if(nextActiveMenu || freeze){
      return
    }
    setSearchText("")
    pendingScrollPosition.current = 0
    setHistory((prev) => [...prev, { key: activeMenu, position: scrollRef.current?.scrollTop || 0 }])
    setNextActiveMenu(key)
    onKeyChange?.(key)
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
    setSearchText("")
    const prev = history[history.length - 1]
    // Store the scroll position to restore later
    pendingScrollPosition.current = prev.position
    setNextActiveMenu(prev.key || rootKey)
    onKeyChange?.(prev.key || rootKey)
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

  const renderSearchInput = (menuKey: string) => {
    const isRootMenu = menuKey === rootKey

    return (
      <div
        className="item search"
        onClick={(e) => e.preventDefault()}
        onSelect={(e) => e.preventDefault()}
      >
        {!isRootMenu && (
          <Button
            className="dropdown-container-back-button"
            theme="TextOnly"
            color="neutral"
            size="small"
            shape="round"
            onClick={(e) => {
              if (freeze) {
                e.preventDefault()
                return
              }
              goBack()
              options?.[menuKey]?.onBack?.(e)
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M7.17331 11.9171L11.665 16.4087C11.8483 16.5921 11.9362 16.8059 11.9285 17.0504C11.9209 17.2948 11.8254 17.5087 11.6421 17.6921C11.4587 17.8601 11.2448 17.948 11.0004 17.9556C10.7559 17.9632 10.5421 17.8754 10.3587 17.6921L4.30872 11.6421C4.21706 11.5504 4.15213 11.4511 4.11393 11.3441C4.07574 11.2372 4.05664 11.1226 4.05664 11.0004C4.05664 10.8782 4.07574 10.7636 4.11393 10.6566C4.15213 10.5497 4.21706 10.4504 4.30872 10.3587L10.3587 4.30872C10.5268 4.14067 10.7368 4.05664 10.9889 4.05664C11.241 4.05664 11.4587 4.14067 11.6421 4.30872C11.8254 4.49206 11.9171 4.70977 11.9171 4.96185C11.9171 5.21393 11.8254 5.43164 11.6421 5.61497L7.17331 10.0837H17.4171C17.6768 10.0837 17.8945 10.1716 18.0702 10.3473C18.2459 10.523 18.3337 10.7407 18.3337 11.0004C18.3337 11.2601 18.2459 11.4778 18.0702 11.6535C17.8945 11.8292 17.6768 11.9171 17.4171 11.9171H7.17331Z" fill="currentColor"/>
            </svg>
          </Button>
        )}
        <div className="dropdown-container-back-text">
          <Input
            ref={searchInputRef}
            className="dropdown-search-input"
            size="small"
            placeholder={searchPlaceholder || t("dropdown.searchPlaceholder")}
            onChange={(e) => {
              setSearchText(e.target.value)
              setTimeout(() => {
                searchInputRef.current?.focus()
              }, 1)
            }}
            value={searchText}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                <path stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2" d="m15 15 5 5"></path>
                <path stroke="currentColor" strokeMiterlimit="10" strokeWidth="2" d="M9.5 17a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z">
                </path>
              </svg>
            }
            icon2={searchIcon}
            icon3={searchText.length > 0 &&
              <Button
                className="dropdown-container-back-button"
                theme="TextOnly"
                color="neutral"
                size="small"
                shape="round"
                onClick={() => {
                  setSearchText("")
                  setTimeout(() => {
                    searchInputRef.current?.focus()
                  }, 1)
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 18 18"
                  width="18"
                  height="18"
                  className="dropdown-search-clear"
                >
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                </svg>
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <DropdownMenu.Root
      open={isOpen}
      onOpenChange={(isOpen) => {
        setIsOpen(isOpen)
        if (isOpen) {
          onOpen?.()
          setNextActiveMenu(null)
          setActiveMenu(rootKey)
          setTransType(null)
          setListHeight(0)
          setListWidth(0)
          setSearchText("")
        } else {
          onClose?.()
          setNextActiveMenu(null)
          setActiveMenu(rootKey)
          setTransType(null)
          setListHeight(0)
          setListWidth(0)
          setSearchText("")
        }
      }}
    >
      <DropdownMenu.Trigger
        asChild
        ref={ref}
        onClick={(e) => {
          setIsOpen(!isOpen)
        }}
        {...rest}
      >
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
            onFocusCapture={(e) => {
              if ((e.target as HTMLElement).tagName === "INPUT") {
                e.stopPropagation()
              }
            }}
          >
            <div ref={mainRef} className="dropdown-container-content-wrapper">
              {activeMenu !== rootKey && options?.[activeMenu]?.showSearch !== undefined && !options?.[activeMenu]?.showSearch && (
                <div
                  key="root-back"
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
                </div>
              )}
              <div ref={scrollRef} className="dropdown-container-scroll-wrapper">
                { content && content }

                { options && options[activeMenu] && options[activeMenu].subOptions && (() => {
                  const subOptions = options[activeMenu].subOptions
                  const items: React.ReactNode[] = []
                  // Use searchInputIndex only for rootKey, otherwise use 0
                  const currentSearchIndex = activeMenu === rootKey ? searchInputIndex || 0 : 0

                  subOptions.forEach((item, index) => {
                    // Insert search input at specified index
                    if ((options[activeMenu].showSearch === undefined || options[activeMenu].showSearch)
                        && index === currentSearchIndex) {
                      items.push(
                        <React.Fragment key={`search-${index}`}>
                          {renderSearchInput(activeMenu)}
                        </React.Fragment>
                      )
                    }

                    if(item.visible === false){
                      return
                    }

                    if (item.childrenKey) {
                      //DropdownMenu.Item hover will cause re-render, so we need to use div instead
                      items.push(
                        <DropdownItem
                          setIsOpen={setIsOpen}
                          key={`activeMenu-${activeMenu}-${index}`}
                          className="item has-sub"
                          onClick={(e) => {
                            goToSubMenu(item.childrenKey!)
                            item.onClick?.(e)
                          }}
                          onSelect={(e) => e.preventDefault()}
                          autoClose={false}
                        >
                          <div className="left-slot">
                            {item.label}
                          </div>
                          <div className="right-slot">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="23" viewBox="0 0 22 23" fill="none">
                              <path d="M12.0998 11.4991L8.5248 7.92409C8.35675 7.75603 8.27272 7.54214 8.27272 7.28242C8.27272 7.0227 8.35675 6.80881 8.5248 6.64076C8.69286 6.4727 8.90675 6.38867 9.16647 6.38867C9.42619 6.38867 9.64008 6.4727 9.80814 6.64076L14.0248 10.8574C14.2081 11.0408 14.2998 11.2546 14.2998 11.4991C14.2998 11.7435 14.2081 11.9574 14.0248 12.1408L9.80814 16.3574C9.64008 16.5255 9.42619 16.6095 9.16647 16.6095C8.90675 16.6095 8.69286 16.5255 8.5248 16.3574C8.35675 16.1894 8.27272 15.9755 8.27272 15.7158C8.27272 15.456 8.35675 15.2421 8.5248 15.0741L12.0998 11.4991Z" fill="currentColor"/>
                            </svg>
                          </div>
                        </DropdownItem>
                      )
                      return
                    }

                    items.push(
                      //DropdownMenu.Item hover will cause re-render, so we need to use div instead
                      <DropdownItem
                        setIsOpen={setIsOpen}
                        key={`activeMenu-${activeMenu}-${index}`}
                        className={`item-wrapper ${item.disabled ? "disabled" : ""}`}
                        autoClose={item.autoClose ?? true}
                      >
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
                      </DropdownItem>
                    )
                  })

                  // If currentSearchIndex is beyond the array length, append at the end
                  if ((options[activeMenu].showSearch === undefined || options[activeMenu].showSearch)
                      && currentSearchIndex >= subOptions.length) {
                    items.push(
                      <React.Fragment key="search-end">
                        {renderSearchInput(activeMenu)}
                      </React.Fragment>
                    )
                  }

                  return items
                })()}
                {(options?.[activeMenu]?.showSearch === undefined || options?.[activeMenu]?.showSearch)
                  && searchText.length > 0
                  && (!options?.[activeMenu]?.subOptions || options[activeMenu].subOptions.length === 0)
                  && (
                    <div className="item no-result">
                      {searchNoResultText || t("dropdown.noSearchResultsText")}
                    </div>
                )}
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
                {nextActiveMenu !== rootKey && options?.[nextActiveMenu]?.showSearch !== undefined && !options?.[nextActiveMenu]?.showSearch && (
                  <div
                    key="next-back"
                    className="item back"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M7.17331 11.9171L11.665 16.4087C11.8483 16.5921 11.9362 16.8059 11.9285 17.0504C11.9209 17.2948 11.8254 17.5087 11.6421 17.6921C11.4587 17.8601 11.2448 17.948 11.0004 17.9556C10.7559 17.9632 10.5421 17.8754 10.3587 17.6921L4.30872 11.6421C4.21706 11.5504 4.15213 11.4511 4.11393 11.3441C4.07574 11.2372 4.05664 11.1226 4.05664 11.0004C4.05664 10.8782 4.07574 10.7636 4.11393 10.6566C4.15213 10.5497 4.21706 10.4504 4.30872 10.3587L10.3587 4.30872C10.5268 4.14067 10.7368 4.05664 10.9889 4.05664C11.241 4.05664 11.4587 4.14067 11.6421 4.30872C11.8254 4.49206 11.9171 4.70977 11.9171 4.96185C11.9171 5.21393 11.8254 5.43164 11.6421 5.61497L7.17331 10.0837H17.4171C17.6768 10.0837 17.8945 10.1716 18.0702 10.3473C18.2459 10.523 18.3337 10.7407 18.3337 11.0004C18.3337 11.2601 18.2459 11.4778 18.0702 11.6535C17.8945 11.8292 17.6768 11.9171 17.4171 11.9171H7.17331Z" fill="currentColor"/>
                    </svg>
                    {options?.[nextActiveMenu]?.preLabel ?? "Back"}
                  </div>
                )}
                <div ref={nextScrollRef} className="dropdown-container-scroll-wrapper">
                  { content && content }

                  { nextActiveMenu && options && options[nextActiveMenu] && (() => {
                    const subOptions = options[nextActiveMenu].subOptions
                    const items: React.ReactNode[] = []
                    // Use searchInputIndex only for rootKey, otherwise use 0
                    const currentSearchIndex = nextActiveMenu === rootKey ? searchInputIndex || 0 : 0

                    subOptions.forEach((item, index) => {
                      // Insert search input at specified index
                      if ((options[nextActiveMenu].showSearch === undefined || options[nextActiveMenu].showSearch)
                          && index === currentSearchIndex) {
                        items.push(
                          <React.Fragment key={`search-${index}`}>
                            {renderSearchInput(nextActiveMenu)}
                          </React.Fragment>
                        )
                      }

                      if(item.visible === false){
                        return
                      }

                      if (item.childrenKey) {
                        items.push(
                          <div
                            key={`nextActiveMenu-${nextActiveMenu}-${index}`}
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
                          </div>
                        )
                        return
                      }

                      items.push(
                        <div
                          key={`nextActiveMenu-${nextActiveMenu}-${index}`}
                          className={`item-wrapper ${item.disabled ? "disabled" : ""}`}
                        >
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
                        </div>
                      )
                    })

                    // If currentSearchIndex is beyond the array length, append at the end
                    if ((options[nextActiveMenu].showSearch === undefined || options[nextActiveMenu].showSearch)
                        && currentSearchIndex >= subOptions.length) {
                      items.push(
                        <React.Fragment key="search-end">
                          {renderSearchInput(nextActiveMenu)}
                        </React.Fragment>
                      )
                    }

                    return items
                  })()}
                  {(options?.[nextActiveMenu]?.showSearch === undefined || options?.[nextActiveMenu]?.showSearch)
                    && searchText.length > 0
                    && (!options?.[nextActiveMenu]?.subOptions || options[nextActiveMenu].subOptions.length === 0)
                    && (
                      <div className="item no-result">
                        {searchNoResultText || t("dropdown.noSearchResultsText")}
                      </div>
                  )}
                </div>
              </div>
            )}
          </DropdownMenu.Content>
        </>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
})

DropdownSearch.displayName = "DropdownSearch"
export default DropdownSearch
