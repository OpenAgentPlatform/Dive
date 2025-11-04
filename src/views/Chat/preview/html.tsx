import React, { useEffect, useState } from "react"

interface HtmlPreviewProps {
  html: string
}

const HtmlPreview: React.FC<HtmlPreviewProps> = ({ html }) => {
  const [src, setSrc] = useState("")

  useEffect(() => {
    // Clean up previous blob URL
    if (src && src.startsWith("blob:")) {
      URL.revokeObjectURL(src)
    }

    // Create blob URL instead of data URI for better isolation
    const blob = new Blob([html], { type: "text/html" })
    const blobUrl = URL.createObjectURL(blob)
    setSrc(blobUrl)

    // Cleanup on unmount
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [html])

  if (!src) {
    return null
  }

  return (
    <iframe
      className="html-preview"
      sandbox="allow-scripts allow-same-origin allow-forms"
      title="HTML Preview"
      src={src}
    />
  )
}

export default React.memo(HtmlPreview)
