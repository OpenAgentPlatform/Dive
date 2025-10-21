import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { forwardRef, useLayoutEffect, useRef, useState } from "react"
import "@/styles/components/_SelectSearch.scss"
import WrappedInput from "./WrappedInput"
import React from "react"

interface Props<T = string>{
  options: {
    value: T,
    label: React.ReactNode | string,
    info?: string,
  }[]
  value: T
  onSelect: (value: T) => void
  placeholder?: string
  size?: "l" | "m" | "s"
  type?: "color" | "outline"
  className?: string
  searchClassName?: string
  contentClassName?: string
  error?: boolean
  fill?: boolean
  maxHeight?: number
  autoWidth?: boolean
  fullWidth?: boolean
  align?: "center" | "start" | "end"
  leftSlotType?: "col" | "row"
  searchPlaceholder?: string
  noResultText?: string
  searchCaseSensitive?: "weak" | "strong"
}

/** SelectSearch */
function Index<T>(
  props: Props<T> & { ref?: React.ForwardedRef<HTMLButtonElement> }
) {
  return <SelectSearch {...(props as unknown as Props<string>)} />
}

const SelectSearch = forwardRef<HTMLButtonElement|null, Props>(({
  options,
  value,
  onSelect,
  placeholder,
  className,
  searchClassName,
  contentClassName,
  size = "m",
  type = "color",
  error,
  fill,
  maxHeight,
  autoWidth = true,
  fullWidth,
  align = "start",
  leftSlotType = "col",
  searchPlaceholder = "Search...",
  noResultText = "No result",
  searchCaseSensitive = "weak",
  ...rest
}, ref) => {
  const [searchText, setSearchText] = useState("")
  const currentOption = options.find((option) => option.value === value) || null
  const displayLabel = currentOption && currentOption.label || placeholder || "Select..."
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [width, setWidth] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    if (triggerRef.current) {
      setWidth(triggerRef.current.offsetWidth)
    }
  }, [])

  const searchOptions = options.filter((option) => {
    const label = option?.label
    return typeof label === "string" ? (searchCaseSensitive === "weak" ? label.toLowerCase().includes(searchText.toLowerCase()) : label.includes(searchText)) : false
  })

  return (
    <DropdownMenu.Root onOpenChange={() => setSearchText("")}>
      <DropdownMenu.Trigger asChild ref={ref} {...rest}>
        <button
          className={`select-button ${className} ${error ? "error" : ""} ${fill ? "fill" : ""} ${type} ${size}`}
          color="neutralGrey"
          ref={triggerRef}
        >
          <span>{displayLabel}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="16" height="16">
            <path fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9H7l4 4.5L15 9Z"></path>
          </svg>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          style={maxHeight
            ? {
                maxHeight: `${maxHeight}px`,
                width: fullWidth ? `${width}px` : "",
                maxWidth: fullWidth ? "unset" : "",
              }
            : {
                width: fullWidth ? `${width}px` : "",
                maxWidth: fullWidth ? "unset" : "",
              }
          }
          align={align}
          side='bottom'
          sideOffset={0}
          alignOffset={0}
          className={`select-search-content-wrapper ${contentClassName} ${size} ${!autoWidth ? "fixed-width" : ""}`}
        >
          <div className={`select-search-wrapper ${searchClassName}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="20" height="20">
              <path stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2" d="m15 15 5 5"></path>
              <path stroke="currentColor" strokeMiterlimit="10" strokeWidth="2" d="M9.5 17a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z">
              </path>
            </svg>
            <WrappedInput
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={searchPlaceholder}
              className="select-search-input"
            />
            {searchText.length > 0 &&
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 18 18"
                width="22"
                height="22"
                className="select-search-clear"
                onClick={() => setSearchText("")}
              >
                <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
              </svg>
            }
          </div>
          {searchOptions?.length > 0 ?
            searchOptions.map((item, index) => {
              return (
                <DropdownMenu.Item
                  key={index}
                  className="item"
                  onSelect={(e)=>{
                    e.stopPropagation()
                    onSelect(item.value)
                    setSearchText("")
                  }}
                >
                  <div className={`left-slot ${leftSlotType}`}>
                    <div className="label">{item.label}</div>
                    {item.info &&
                      <div className="info">{item.info}</div>
                    }
                  </div>
                  <div className="right-slot">
                    { value === item.value &&
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="m4.67 10.424 4.374 4.748 8.478-7.678"></path>
                      </svg>
                    }
                  </div>
                </DropdownMenu.Item>
              )
            })
          :
            <div className="no-result">{noResultText}</div>
          }
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
})

SelectSearch.displayName = "SelectSearch"
export default React.memo(Index)
