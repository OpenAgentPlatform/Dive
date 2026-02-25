import React, { useCallback, useEffect, useRef } from "react"
import mitt from "mitt"

type ScrollHandler = (container: HTMLElement, targetId: string) => boolean | void

type ScrollPayload = {
  containerId: string
  targetId: string
  handler: ScrollHandler
}

type ScrollEvents = {
  scrollTo: ScrollPayload
}

const emitter = mitt<ScrollEvents>()
const pendingScrollMap = new Map<string, { targetId: string; handler: ScrollHandler }>()

export function useScrollTo(containerId: string) {
  return useCallback((targetId: string, handler: ScrollHandler) => {
    emitter.emit("scrollTo", { containerId, targetId, handler })
  }, [containerId])
}

export function useRegisterScroll<T extends HTMLElement>(
  containerId: string,
  ref: React.RefObject<T | null>,
  deps?: readonly unknown[]
) {
  // Re-evaluate pending requests whenever dependencies change.
  useEffect(() => {
    const pending = pendingScrollMap.get(containerId)
    const container = ref.current
    if (pending && container) {
      const success = pending.handler(container, pending.targetId)
      if (success !== false) {
        pendingScrollMap.delete(containerId)
      }
    }
  }, deps)

  // Monitor calls to scrollTo()
  useEffect(() => {
    const wrappedHandler = (payload: ScrollPayload) => {
      if (payload.containerId !== containerId) {
        return
      }
      const container = ref.current
      if (!container) {
        pendingScrollMap.set(containerId, { targetId: payload.targetId, handler: payload.handler })
        return
      }
      const success = payload.handler(container, payload.targetId)
      if (success === false) {
        pendingScrollMap.set(containerId, { targetId: payload.targetId, handler: payload.handler })
      } else {
        pendingScrollMap.delete(containerId)
      }
    }
    emitter.on("scrollTo", wrappedHandler)
    return () => {
      emitter.off("scrollTo", wrappedHandler)
    }
  }, [containerId, ref])
}
