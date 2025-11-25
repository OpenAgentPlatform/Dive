import * as RadixTooltip from "@radix-ui/react-tooltip"
import { ReactNode, useState, useEffect, useRef } from "react"

type Props = {
  children: ReactNode
  tooltipContent: string | ReactNode
  infoTooltipContent: ReactNode
  tooltipSide?: "top" | "right" | "bottom" | "left"
  tooltipType?: "controls" | ""
  tooltipAlign?: "start" | "center" | "end"
  tooltipMaxWidth?: number
  infoTooltipSide?: "top" | "right" | "bottom" | "left"
  infoTooltipSideOffset?: number
  infoTooltipAlign?: "start" | "center" | "end"
  infoTooltipAlignOffset?: number
  openDelay?: number
  closeDelay?: number
  container?: HTMLElement | null
  infoTooltipClassName?: string
}

/** Component that displays both a regular Tooltip and an InfoTooltip from the same trigger */
const MultiTooltip = ({
  children,
  tooltipContent,
  infoTooltipContent,
  tooltipSide = "bottom",
  tooltipType = "",
  tooltipAlign = "center",
  tooltipMaxWidth = 280,
  infoTooltipSide = "top",
  infoTooltipSideOffset = 4,
  infoTooltipAlign = "center",
  infoTooltipAlignOffset = 0,
  openDelay = 0,
  closeDelay = 0,
  container,
  infoTooltipClassName
}: Props) => {
  const [open, setOpen] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const openTimerRef = useRef<NodeJS.Timeout | null>(null)
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInteractingWithInfoTooltip = useRef(false)
  const justClickedTrigger = useRef(false)

  useEffect(() => {
    if (open) {
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
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
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
          setOpen(true)
          openTimerRef.current = null
        }, openDelay)
      } else {
        setOpen(true)
      }
    } else {
      // Don't close if user just clicked trigger
      if (justClickedTrigger.current) {
        justClickedTrigger.current = false
        return
      }

      // Don't close if user is interacting with infoTooltip
      if (isInteractingWithInfoTooltip.current) {
        return
      }

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
        setOpen(false)
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
      {/* Regular Tooltip - exact same structure as Tooltip component */}
      <RadixTooltip.Root open={open} onOpenChange={handleOpenChange}>
        <RadixTooltip.Trigger
          asChild
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            // Mark that we just clicked the trigger
            justClickedTrigger.current = true
            // Clear all timers
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current)
              closeTimerRef.current = null
            }
            if (openTimerRef.current) {
              clearTimeout(openTimerRef.current)
              openTimerRef.current = null
            }
            // Keep tooltip open when clicking trigger
            setOpen(true)
          }}
          onMouseEnter={() => {
            // Reset interaction flag when entering trigger
            isInteractingWithInfoTooltip.current = false
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
                setOpen(true)
                openTimerRef.current = null
              }, openDelay)
            } else {
              setOpen(true)
            }
          }}
          onMouseLeave={() => {
            // Clear open timer if mouse leaves before delay completes
            if (openTimerRef.current) {
              clearTimeout(openTimerRef.current)
              openTimerRef.current = null
            }

            // Only start close timer if not interacting with infoTooltip
            if (!isInteractingWithInfoTooltip.current) {
              // Start close timer when mouse leaves trigger
              if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current)
              }
              closeTimerRef.current = setTimeout(() => {
                setOpen(false)
              }, closeDelay)
            }
          }}
        >
          {children}
        </RadixTooltip.Trigger>
        {tooltipContent && (
          <RadixTooltip.Portal container={container}>
            <RadixTooltip.Content
              className={`tooltip-content ${tooltipType}`}
              sideOffset={0}
              side={tooltipSide}
              style={{ maxWidth: tooltipMaxWidth, textAlign: tooltipAlign }}
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
              }}
              onMouseLeave={() => {
                // Start close timer when mouse leaves content
                if (closeTimerRef.current) {
                  clearTimeout(closeTimerRef.current)
                }
                closeTimerRef.current = setTimeout(() => {
                  setOpen(false)
                }, closeDelay)
              }}
            >
              {tooltipContent}
              <RadixTooltip.Arrow className='tooltip-arrow' />
            </RadixTooltip.Content>
          </RadixTooltip.Portal>
        )}
      </RadixTooltip.Root>

      {/* InfoTooltip with invisible trigger - exact same behavior as InfoTooltip component */}
      {infoTooltipContent && (
        <RadixTooltip.Root open={open} onOpenChange={handleOpenChange}>
          <RadixTooltip.Trigger asChild>
            <button style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} aria-hidden tabIndex={-1} />
          </RadixTooltip.Trigger>
          <RadixTooltip.Portal forceMount container={container}>
            {shouldRender && (
              <RadixTooltip.Content
                side={infoTooltipSide}
                sideOffset={infoTooltipSideOffset}
                align={infoTooltipAlign}
                alignOffset={infoTooltipAlignOffset}
                className={`infotooltip-content ${infoTooltipClassName} ${isVisible ? "visible" : ""}`}
                onMouseEnter={() => {
                  // Mark that we're interacting with infoTooltip
                  isInteractingWithInfoTooltip.current = true
                  // Clear both timers when mouse enters content
                  if (openTimerRef.current) {
                    clearTimeout(openTimerRef.current)
                    openTimerRef.current = null
                  }
                  if (closeTimerRef.current) {
                    clearTimeout(closeTimerRef.current)
                    closeTimerRef.current = null
                  }
                  setOpen(true)
                }}
                onMouseLeave={() => {
                  // Mark that we're no longer interacting with infoTooltip
                  isInteractingWithInfoTooltip.current = false
                  // Start close timer when mouse leaves content
                  if (closeTimerRef.current) {
                    clearTimeout(closeTimerRef.current)
                  }
                  closeTimerRef.current = setTimeout(() => {
                    setOpen(false)
                  }, closeDelay)
                }}
                onPointerDownOutside={(event) => {
                  event.preventDefault()
                }}
                onPointerDown={(event) => {
                  // Mark that we're interacting with infoTooltip
                  isInteractingWithInfoTooltip.current = true
                  // Keep tooltip open when clicking inside
                  event.stopPropagation()
                  // Ensure tooltip stays open
                  setOpen(true)
                }}
                onClick={(event) => {
                  // Prevent click from closing tooltip
                  event.stopPropagation()
                  event.preventDefault()
                  // Ensure tooltip stays open
                  setOpen(true)
                }}
              >
                {infoTooltipContent}
              </RadixTooltip.Content>
            )}
          </RadixTooltip.Portal>
        </RadixTooltip.Root>
      )}
    </RadixTooltip.Provider>
  )
}

export default MultiTooltip
