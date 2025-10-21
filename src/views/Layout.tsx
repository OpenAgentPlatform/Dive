import React from "react"
import { Outlet } from "react-router-dom"
import HistorySidebar from "../components/HistorySidebar"
import Header from "../components/Header"
import { useAtom, useAtomValue } from "jotai"
import { isConfigNotInitializedAtom } from "../atoms/configState"
import GlobalToast from "../components/GlobalToast"
import { themeAtom, systemThemeAtom } from "../atoms/themeState"
import Overlay from "./Overlay"
import KeymapModal from "../components/Modal/KeymapModal"
import RenameConfirmModal from "../components/Modal/RenameConfirmModal"
import CodeModal from "./Chat/CodeModal"
import { overlaysAtom } from "../atoms/layerState"

const Layout = () => {
  const isConfigNotInitialized = useAtomValue(isConfigNotInitializedAtom)
  const [theme] = useAtom(themeAtom)
  const [systemTheme] = useAtom(systemThemeAtom)
  const overlays = useAtomValue(overlaysAtom)

  return (
    <div className="app-container" data-theme={theme === "system" ? systemTheme : theme}>
      <div className="app-content">
        {!isConfigNotInitialized && <HistorySidebar />}
        <div className="outlet-container">
          {!isConfigNotInitialized && <Header showHelpButton={overlays.length === 0} showModelSelect={overlays.length === 0} />}
          <Outlet />
        </div>
        <CodeModal />
      </div>
      <Overlay />
      <GlobalToast />
      <KeymapModal />
      <RenameConfirmModal />
    </div>
  )
}

export default React.memo(Layout)
