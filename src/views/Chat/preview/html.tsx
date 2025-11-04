import React, { useEffect, useState } from "react"

interface HtmlPreviewProps {
  html: string
}

const HtmlPreview: React.FC<HtmlPreviewProps> = ({ html }) => {
  const [src, setSrc] = useState("")

  useEffect(() => {
    const encodedHtml = encodeURIComponent(html)
    const dataUri = `data:text/html;charset=utf-8,${encodedHtml}`
    setSrc(dataUri)
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
