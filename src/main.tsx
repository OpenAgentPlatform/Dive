import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./styles/index.scss"
import App from "./App.tsx"
import "./i18n"

if (window.ipcRenderer) {
  const port = await new Promise<number>((resolve) => {
    window.ipcRenderer.onReceivePort((port) => {
      resolve(port)
    })

    const i = setInterval(() => {
      window.ipcRenderer.port().then(port => {
        if (+port) {
          resolve(port)
          clearInterval(i)
        }
      })
    }, 1000)
  })

  console.log("host port", port)

  const originalFetch = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input !== "string" || (typeof input === "string" && !input.startsWith("/api")) && input !== "/model_verify") {
      return originalFetch(input, init)
    }

    return originalFetch(`http://localhost:${port}${input}`, {
      ...init,
      headers: {
        ...init?.headers,
        "X-Requested-With": "dive-desktop",
      },
    })
  }

  window.PLATFORM = await window.ipcRenderer.getPlatform() as any
}

// wait for host to start
await new Promise(resolve => {
  const i = setInterval(() => {
    fetch("/api/ping").then(() => {
      resolve(0)
      clearInterval(i)
    })
  }, 50)
})

window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  const selection = window.getSelection()?.toString()

  if (selection) {
    window.ipcRenderer.showSelectionContextMenu()
  }
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
