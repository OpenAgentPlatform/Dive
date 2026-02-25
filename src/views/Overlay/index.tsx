import React from "react"
import { useAtomValue } from "jotai"
import { overlaysAtom } from "../../atoms/layerState"
import Setting, { Subtab, Tab } from "./Setting"
import "../../styles/overlay/_Overlay.scss"
import History from "./History"

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
              <div key={`setting-${index}-${overlay.tab}`}>
                <Setting
                  _tab={overlay.tab as Tab}
                  _subtab={overlay.subtab as Subtab}
                  _tabdata={overlay.tabdata}
                />
                <div className="overlay-mask"></div>
              </div>
            )
          case "History":
            return (
              <div key={`history-${index}`}>
                <History
                  _tabdata={overlay.tabdata}
                />
                <div className="overlay-mask"></div>
              </div>
            )
          default:
            return null
        }
      })}
    </>
  )
}

export default React.memo(Overlay)