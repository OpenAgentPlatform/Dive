import React, { useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import HistorySidebar from "../components/HistorySidebar"
import Header from "../components/Header"
import { useAtom } from "jotai"
import { hasConfigAtom } from "../atoms/configState"
import ConfigSidebar from "../components/ConfigSidebar"
import GlobalToast from "../components/GlobalToast"
import { themeAtom, systemTheme as _systemTheme } from "../atoms/themeState"
import Overlay from "./Overlay"

const Layout = () => {
  const [hasConfig] = useAtom(hasConfigAtom)
  const [theme] = useAtom(themeAtom)
  const [systemTheme, setSystemTheme] = useState(_systemTheme)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  return (
    <div className="app-container" data-theme={theme === "system" ? systemTheme : theme}>
      {hasConfig &&
        <>
          <Header />
          <HistorySidebar />
          <ConfigSidebar />
        </>
      }
      <Outlet />
      <Overlay />
      <GlobalToast />
    </div>
  )
}

export default React.memo(Layout)
