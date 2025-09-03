import React from "react"
import PopupWindow from "../../components/PopupWindow"
import "../../styles/overlay/_Setting.scss"
import Model from "./Model"
import Tools from "./Tools"
import System from "./System"
import Account from "./Account"
import { useSetAtom } from "jotai"
import { openOverlayAtom } from "../../atoms/layerState"

const tabs = ["Tools", "Model", "Account", "System"] as const
export type Tab = (typeof tabs)[number]

const Setting = ({ _tab }: { _tab: Tab }) => {
  const openOverlay = useSetAtom(openOverlayAtom)

  return (
    <PopupWindow overlay>
      <div className="setting-container">
        <div className="setting-sidebar">
          {tabs.map((__tab) => (
            <div
              key={__tab}
              className={`setting-sidebar-item ${__tab === _tab ? "active" : ""}`}
              onClick={() => openOverlay({ page: "Setting", tab: __tab })}
            >
              {__tab}
            </div>
          ))}
        </div>
        <div className="setting-content">
          {(() => {
            switch (_tab) {
              case "Model":
                return <Model />
              case "Tools":
                return <Tools />
              case "Account":
                return <Account />
              case "System":
                return <System />
              default:
                return null
            }
          })()}
        </div>
      </div>
    </PopupWindow>
  )
}

export default React.memo(Setting)