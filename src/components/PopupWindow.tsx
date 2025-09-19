import React from "react"
import * as Portal from "@radix-ui/react-portal"
import { DismissableLayer } from "@radix-ui/react-dismissable-layer"
import { useAtom } from "jotai"
import { sidebarVisibleAtom } from "../atoms/sidebarState"

export type PopupStylePorps = {
  zIndex?: number
  noBackground?: boolean
}

type PopupWindowProps = PopupStylePorps & {
  children: React.ReactNode
  overlay?: boolean
  onClickOutside?: () => void
  onFinish?: () => void
}

export default function PopupWindow({
  children,
  zIndex = 100,
  onClickOutside = () => {},
  overlay = false,
  noBackground = false,
  onFinish = () => {},
}: PopupWindowProps) {
  const [isSidebarVisible] = useAtom(sidebarVisibleAtom)
  const root = document.body

  return (
    <Portal.Root container={root}>
      <div className={`container-wrapper ${noBackground ? "transparent" : ""} ${overlay ? "overlay" : ""} ${!isSidebarVisible ? "full-width" : ""}`} style={{ zIndex }}>
        <DismissableLayer onPointerDownOutside={() => {
          onClickOutside()
          onFinish()
        }}>
          {children}
        </DismissableLayer>
      </div>
    </Portal.Root>
  )
}
