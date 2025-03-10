import React from "react"
import PopupWindow from "../../components/PopupWindow"
import Tools from "./Tools"
import Model from "./Model"
import System from "./System"
import { useAtomValue } from "jotai"
import { overlaysAtom } from "../../atoms/layerState"

const Overlay = () => {
  const overlays = useAtomValue(overlaysAtom)

  if (!overlays.length)
    return null

  return (
    <>
      {overlays.map((overlay, index) => {
        switch (overlay) {
          case "Tools":
            return (
              <PopupWindow key={`tools-${index}`} overlay>
                <Tools />
              </PopupWindow>
            )
          case "Model":
            return (
              <PopupWindow key={`model-${index}`} overlay>
                <Model />
              </PopupWindow>
            )
          case "System":
            return (
              <PopupWindow key={`system-${index}`} overlay>
                <System />
              </PopupWindow>
            )
          default:
            return null
        }
      })}
    </>
  )
}

export default React.memo(Overlay)
