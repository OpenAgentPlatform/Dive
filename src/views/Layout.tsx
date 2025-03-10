import React from "react"
import { Outlet } from "react-router-dom"
import HistorySidebar from "../components/HistorySidebar"
import Header from "../components/Header"
import { useAtom } from "jotai"
import { hasConfigAtom } from "../atoms/configState"
import GlobalToast from "../components/GlobalToast"
import { themeAtom, systemThemeAtom } from "../atoms/themeState"
import Overlay from "./Overlay"
import KeymapModal from "../components/Modal/KeymapModal"

const Layout = () => {
  const [hasConfig] = useAtom(hasConfigAtom)
  const [theme] = useAtom(themeAtom)
  const [systemTheme] = useAtom(systemThemeAtom)

  return (
    <div className="app-container" data-theme={theme === "system" ? systemTheme : theme}>
      {hasConfig &&
        <>
          <Header showHelpButton showModelSelect />
          <HistorySidebar />
        </>
      }
      <Outlet />
      <Overlay />
      <GlobalToast />
      <KeymapModal />
    </div>
  )
}

export default React.memo(Layout)
