import React from "react"
import Zoom from "../../components/Zoom"
import "@/styles/components/_Zoom.scss"
import { convertLocalFileSrc } from "../../ipc/util"

interface FilePreviewProps {
  files: (File | string)[]
}

const FilePreview: React.FC<FilePreviewProps> = ({ files }) => {
  const isImageFile = (file: File | string) => {
    if (typeof file === "string") {
      return /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    }
    return file.type.startsWith("image/")
  }

  const getFileName = (file: File | string) => {
    if (typeof file === "string") {
      return file.split("/").pop()?.split("-")?.[1] || file
    }
    return file.name
  }

  const getImageSrc = (file: File | string) => {
    if (typeof file === "string") {
      if (!file.startsWith("http") && !file.startsWith("data:") && !file.startsWith("local-file:///")) {
        const normalizedPath = file.replace(/\\/g, "/")
        return convertLocalFileSrc(normalizedPath)
      }
      return file
    }
    return URL.createObjectURL(file)
  }

  return (
    <div className="message-files">
      {files.map((file, index) => (
        isImageFile(file) ? (
          <Zoom
            key={index}
            allowCopy={true}
            allowDownload={true}
          >
            <img
              src={getImageSrc(file)}
              className="message-image"
            />
          </Zoom>
        ) : (
          <div key={index} className="file-item">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
            <span className="file-name">{getFileName(file)}</span>
          </div>
        )
      ))}
    </div>
  )
}

export default React.memo(FilePreview)