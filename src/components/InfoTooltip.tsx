import * as RadixTooltip from "@radix-ui/react-tooltip"
import { ReactNode, forwardRef, useState, useEffect, useRef } from "react"

type Props = {
  children: ReactNode
  content: string | ReactNode
  className?: string
  maxWidth?: number
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  align?: "start" | "center" | "end"
  alignOffset?: number
  openDelay?: number
  closeDelay?: number
  container?: HTMLElement | null
}

/** info hint tooltip */
const InfoTooltip = forwardRef<HTMLButtonElement | null, Props>(({children, content, side = "top", maxWidth, className, sideOffset = 4, align = "center", alignOffset = 0, openDelay = 0, closeDelay = 0, container, ...rest}, ref) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const openTimerRef = useRef<NodeJS.Timeout | null>(null)
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (internalOpen) {
      // Clear timers (if user quickly re-enters after leaving)
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      setShouldRender(true)
      // Small delay to ensure DOM is updated before fade-in
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
      // Wait for fade-out animation to complete before removing from DOM
      const timer = setTimeout(() => setShouldRender(false), 200)
      return () => clearTimeout(timer)
    }
  }, [internalOpen])

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // If there's already an open timer running from manual onMouseEnter, don't create another one
      if (openTimerRef.current) {
        return
      }

      // Clear close timer
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }

      // Apply open delay
      if (openDelay > 0) {
        openTimerRef.current = setTimeout(() => {
          setInternalOpen(true)
          openTimerRef.current = null
        }, openDelay)
      } else {
        setInternalOpen(true)
      }
    } else {
      // Clear open timer if closing before delay completes
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }

      // Delayed close
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
      closeTimerRef.current = setTimeout(() => {
        setInternalOpen(false)
      }, closeDelay)
    }
  }

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current)
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  return (
    <RadixTooltip.Provider delayDuration={0} skipDelayDuration={0}>
      <RadixTooltip.Root open={internalOpen} onOpenChange={handleOpenChange} delayDuration={0}>
        <RadixTooltip.Trigger
          asChild
          ref={ref} {...rest}
          // avoid trigger tooltip when click icon
          onClick={(event) => event.preventDefault()}
          onMouseEnter={() => {
            // Clear close timer when mouse enters trigger
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current)
              closeTimerRef.current = null
            }

            // Clear any existing open timer
            if (openTimerRef.current) {
              clearTimeout(openTimerRef.current)
              openTimerRef.current = null
            }

            // Set open timer with delay
            if (openDelay > 0) {
              openTimerRef.current = setTimeout(() => {
                setInternalOpen(true)
                openTimerRef.current = null
              }, openDelay)
            } else {
              setInternalOpen(true)
            }
          }}
          onMouseLeave={() => {
            // Clear open timer if mouse leaves before delay completes
            if (openTimerRef.current) {
              clearTimeout(openTimerRef.current)
              openTimerRef.current = null
            }
          }}
        >
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal forceMount container={container}>
          {shouldRender && (
            <RadixTooltip.Content
              className={`infotooltip-content ${className} ${isVisible ? "visible" : ""}`}
              sideOffset={sideOffset}
              align={align}
              alignOffset={alignOffset}
              side={side}
              style={maxWidth ? {maxWidth: maxWidth + "px"} : {}}
              onMouseEnter={() => {
                // Clear both timers when mouse enters content
                if (openTimerRef.current) {
                  clearTimeout(openTimerRef.current)
                  openTimerRef.current = null
                }
                if (closeTimerRef.current) {
                  clearTimeout(closeTimerRef.current)
                  closeTimerRef.current = null
                }
                setInternalOpen(true)
              }}
              onMouseLeave={(event) => {
                // Check if mouse is leaving to outside (not to a child element)
                const relatedTarget = event.relatedTarget as HTMLElement
                const currentTarget = event.currentTarget as Node

                // If mouse is moving to a child element, don't close
                if (relatedTarget && currentTarget.contains(relatedTarget)) {
                  return
                }

                // Check if mouse is moving to a Radix Portal content (nested tooltip)
                if (relatedTarget) {
                  const isRadixContent = relatedTarget.closest("[data-radix-popper-content-wrapper]") ||
                                          relatedTarget.closest(".infotooltip-content") ||
                                          relatedTarget.hasAttribute("data-radix-popper-content-wrapper")
                  if (isRadixContent) {
                    return
                  }
                }

                // Start close timer when mouse truly leaves content
                if (closeTimerRef.current) {
                  clearTimeout(closeTimerRef.current)
                }
                closeTimerRef.current = setTimeout(() => {
                  setInternalOpen(false)
                }, closeDelay)
              }}
              // avoid trigger tooltip when click icon
              onPointerDownOutside={(event) => {
                event.preventDefault()
              }}
            >
              {content}
            </RadixTooltip.Content>
          )}
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
})

InfoTooltip.displayName = "InfoTooltip"

export default InfoTooltip
