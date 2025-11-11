import React from "react"
import { createPortal } from "react-dom"

const LoadingOverlay: React.FC = () => {
  return createPortal(
    <div className="global-loading-overlay">
      <div className="loading-spinner"></div>
    </div>,
    document.body
  )
}

export default LoadingOverlay
