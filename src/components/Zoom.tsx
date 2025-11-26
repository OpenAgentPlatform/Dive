import React, { useState, useRef, ReactElement } from "react"
import * as Portal from "@radix-ui/react-portal"
import { DismissableLayer } from "@radix-ui/react-dismissable-layer"
import Tooltip from "./Tooltip"
import { useTranslation } from "react-i18next"
import { useSetAtom } from "jotai"
import { showToastAtom } from "../atoms/toastState"
import { copyBlobImage, copyImage, downloadFile } from "../ipc/util"
import Button from "./Button"

type ZoomProps = {
  children: React.ReactNode
  allowCopy?: boolean
  allowDownload?: boolean
}

export default function Zoom({
  children,
  allowCopy = false,
  allowDownload = false,
}: ZoomProps) {
  const { t } = useTranslation()
  const showToast = useSetAtom(showToastAtom)
  const root = document.body
  const [isZoomed, setIsZoomed] = useState(false)
  const [isZoomedIn, setIsZoomedIn] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ width: 0, height: 0 })
  const childRef = useRef<HTMLDivElement>(null)

  const isHttp = () => {
    if (!childRef.current) {
      return false
    }
    const img = childRef.current.querySelector("img")
    if (!img) {
      return false
    }
    return img.src.startsWith("http")
  }

  const [hasError, setHasError] = useState(false)

  const isValidChild = React.isValidElement(children)

  let childWithErrorHandler = children
  if (isValidChild && (children as ReactElement).type === "img") {
    childWithErrorHandler = React.cloneElement(children as ReactElement, {
      onError: () => setHasError(true)
    })
  }

  if (hasError) {
    return <>{children}</>
  }

  const handleZoom = () => {
    if (!childRef.current) {
      return
    }
    const rect = childRef.current.getBoundingClientRect()
    setPosition({
      x: rect.left,
      y: rect.top
    })
    setSize({
      width: rect.width,
      height: rect.height
    })
    setIsZoomedIn(false)
    setIsZoomed(true)
    setTimeout(() => {
      setIsZoomedIn(true)
      setPosition({
        x: 0,
        y: 0
      })
    }, 1)
  }

  const handleZoomOut = () => {
    if (!childRef.current) {
      return
    }
    const rect = childRef.current.getBoundingClientRect()
    setPosition({
      x: rect.left,
      y: rect.top
    })
    setIsZoomedIn(false)
    setTimeout(() => {
      setIsZoomed(false)
    }, 200)
  }

  const handleCopyUrl = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (childRef.current) {
      try {
        const img = childRef.current.querySelector("img")
        if (!img) {
          return
        }
        await navigator.clipboard.writeText(img.src)
        showToast({
          message: t("toast.copiedToClipboard"),
          type: "info"
        })
      } catch (err) {
        console.error("Failed to copy text: ", err)
      }
    }
  }

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (childRef.current) {
      const img = childRef.current.querySelector("img")
      if (!img) {
        return
      }

      ;(img.src.startsWith("blob:") ? copyBlobImage(img) : copyImage(img.src))
        .then(() => {
          showToast({
            message: t("toast.copiedToClipboard"),
            type: "info"
          })
        })
        .catch(e => {
          showToast({
            message: e.toString(),
            type: "error"
          })
        })
    }
  }

  const handleDownload = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (childRef.current) {
      const img = childRef.current.querySelector("img")
      if (!img) {
        return
      }

      await downloadFile(img.src)

      showToast({
        message: t("toast.downloadedImage"),
        type: "info"
      })
    }
  }

  return (
    <>
      <div className="zoom-container">
        <div className="zoom-child" ref={childRef}>
          {childWithErrorHandler}
        </div>
        <div className="zoom-tools">
          <Tooltip content={t("common.zoomInImage")}>
            <Button
              onClick={handleZoom}
              shape="round"
              size="small"
              theme="TextOnly"
              color="neutralGray"
              noFocus
              svgFill="none"
              className="zoom-button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M15.5 15.5L19.5 19.5" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round"/>
                <path d="M9.5 17C13.6421 17 17 13.6421 17 9.5C17 5.35786 13.6421 2 9.5 2C5.35786 2 2 5.35786 2 9.5C2 13.6421 5.35786 17 9.5 17Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10"/>
                <path d="M6.5 9.5H12.5" stroke="currentColor"/>
                <path d="M9.5 12.5V6.5" stroke="currentColor"/>
              </svg>
            </Button>
          </Tooltip>
          {allowCopy && isHttp() && (
            <Tooltip content={t("common.copyImageUrl")}>
              <Button
                onClick={handleCopyUrl}
                shape="round"
                size="small"
                theme="TextOnly"
                color="neutralGray"
                noFocus
                className="zoom-button"
              >
              <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C7.22,12.88 7.22,9.71 9.17,7.76V7.76L12.71,4.22C14.66,2.27 17.83,2.27 19.78,4.22C21.73,6.17 21.73,9.34 19.78,11.29L18.29,12.78C18.3,11.96 18.17,11.14 17.89,10.36L18.36,9.88C19.54,8.71 19.54,6.81 18.36,5.64C17.19,4.46 15.29,4.46 14.12,5.64L10.59,9.17C9.41,10.34 9.41,12.24 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C16.78,11.12 16.78,14.29 14.83,16.24V16.24L11.29,19.78C9.34,21.73 6.17,21.73 4.22,19.78C2.27,17.83 2.27,14.66 4.22,12.71L5.71,11.22C5.7,12.04 5.83,12.86 6.11,13.65L5.64,14.12C4.46,15.29 4.46,17.19 5.64,18.36C6.81,19.54 8.71,19.54 9.88,18.36L13.41,14.83C14.59,13.66 14.59,11.76 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z"></path>
              </svg>
              </Button>
            </Tooltip>
          )}
          {allowCopy && (
            <Tooltip content={t("common.copyImage")}>
              <Button
                onClick={handleCopy}
                shape="round"
                size="small"
                theme="TextOnly"
                color="neutralGray"
                noFocus
                svgFill="none"
                className="zoom-button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                  <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                  <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                  <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Button>
            </Tooltip>
          )}
          {allowDownload && (
            <Tooltip content={t("common.downloadImage")}>
              <Button
                onClick={handleDownload}
                shape="round"
                size="small"
                theme="TextOnly"
                color="neutralGray"
                noFocus
                className="zoom-button"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                </svg>
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {isZoomed && (
        <Portal.Root container={root}>
          <div className="zoom-overlay" onClick={handleZoomOut}>
            <DismissableLayer onEscapeKeyDown={handleZoomOut}>
              <div
                className="zoom-content"
                style={{
                  width: isZoomedIn ? "100%" : `${size.width}px`,
                  height: isZoomedIn ? "100%" : `${size.height}px`,
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  transition: "transform 0.2s ease-in-out, width 0.2s ease-in-out, height 0.2s ease-in-out"
                }}
              >
                {childWithErrorHandler}
              </div>
              <div className="zoom-tools">
                {allowCopy && (
                  <Tooltip content={t("common.copyImage")}>
                    <Button
                      onClick={handleCopy}
                      shape="round"
                      size="small"
                      theme="TextOnly"
                      color="neutralGray"
                      noFocus
                      svgFill="none"
                      className="zoom-button"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                        <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                        <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                        <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Button>
                  </Tooltip>
                )}
                {allowDownload && (
                  <Tooltip content={t("common.downloadImage")}>
                    <Button
                      onClick={handleDownload}
                      shape="round"
                      size="small"
                      theme="TextOnly"
                      color="neutralGray"
                      noFocus
                      className="zoom-button"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                      </svg>
                    </Button>
                  </Tooltip>
                )}
                <Tooltip content={t("common.close")}>
                  <Button
                    onClick={handleZoomOut}
                    shape="round"
                    size="small"
                    theme="TextOnly"
                    color="neutralGray"
                    noFocus
                    svgFill="none"
                    className="zoom-button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M18.9997 3.0003L3 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M18.9997 18.9997L3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </Button>
                </Tooltip>
              </div>
            </DismissableLayer>
          </div>
        </Portal.Root>
      )}
    </>
  )
}
