import React from "react"
import { useAtomValue } from "jotai"
import { overlaysAtom } from "../../atoms/layerState"
import Setting, { Subtab, Tab } from "./Setting"
import "../../styles/overlay/_Overlay.scss"

const Overlay = () => {
  const overlays = useAtomValue(overlaysAtom)

  if (!overlays.length)
    return null

  return (
    <>
      {overlays.map((overlay, index) => {
        switch (overlay.page) {
          case "Setting":
            return (
              <Setting
                key={`setting-${index}-${overlay.tab}`}
                _tab={overlay.tab as Tab}
                _subtab={overlay.subtab as Subtab}
                _tabdata={overlay.tabdata}
              />
            )
          default:
            return null
        }
      })}
    </>
  )
}

export default React.memo(Overlay)