import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./styles/index.scss"
import App from "./App.tsx"
import "./i18n"

if (window.ipcRenderer) {
  const originalFetch = window.fetch
  let port: number | null = null
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input !== "string" || (typeof input === "string" && !input.startsWith("/api"))) {
      return originalFetch(input, init)
    }

    port = port ?? (await window.ipcRenderer.port())
    return originalFetch(`http://localhost:${port}${input}`, init)
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
