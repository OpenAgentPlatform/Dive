import React, { useRef, useState, useEffect } from "react"
import "@/styles/components/_VideoPlayer.scss"
import Button from "./Button"
import DropDown from "./DropDown"
import Tooltip from "./Tooltip"
import MultiTooltip from "./MultiTooltip"
import { Trans, useTranslation } from "react-i18next"
import { showToastAtom } from "../atoms/toastState"
import { useSetAtom } from "jotai"
import { downloadFile } from "../ipc/util"

interface VideoPlayerProps {
  src: string
  thumbnailUrl?: string
  size?: "sm" | "md" | "lg"
  className?: string
  autoPlay?: boolean
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  thumbnailUrl,
  size = "md",
  className = "",
  autoPlay = false,
}) => {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [videoAspectRatio, setVideoAspectRatio] = useState("16/9")
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isHoveringControls, setIsHoveringControls] = useState(false)
  const [isDropDownOpen, setIsDropDownOpen] = useState(false)
  const [isMouseInContainer, setIsMouseInContainer] = useState(false)
  const showToast = useSetAtom(showToastAtom)

  const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

  // Toggle play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  // Handle progress bar change
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setVolume(newVolume)
      setIsMuted(newVolume === 0)
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
      setVolume(!isMuted ? 0 : 1)
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Change playback rate
  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate
      setPlaybackRate(rate)
    }
  }

  // Format time display
  const formatTime = (time: number) => {
    if (isNaN(time)) {
      return "0:00"
    }

    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Download video
  const handleDownload = async () => {
    await downloadFile(src)

    showToast({
      message: t("toast.downloadedVideo"),
      type: "info"
    })
  }

  // Handle mouse enter video area
  const handleMouseEnter = () => {
    setShowControls(true)
    setIsMouseInContainer(true)
  }

  // Handle mouse move - reset hide timer
  const handleMouseMove = () => {
    setShowControls(true)

    // Clear previous timer
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
    }

    // Set new timer, hide controls after 5 seconds (if not hovering controls and DropDown is not open)
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (!isHoveringControls && !isDropDownOpen) {
        setShowControls(false)
      }
    }, 5000)
  }

  // Handle mouse leave video area - hide immediately
  const handleMouseLeave = () => {
    setIsMouseInContainer(false)
    // Clear all timers
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
      hideControlsTimeoutRef.current = null
    }
    // If DropDown is open, don't hide controls
    if (isDropDownOpen) {
      return
    }
    // Hide immediately, regardless of hovering controls
    setShowControls(false)
    setIsHoveringControls(false)
  }

  // Handle mouse enter interactive elements (buttons, progress bar, volume control)
  const handleInteractiveElementEnter = () => {
    setIsHoveringControls(true)
    setShowControls(true)
    // Clear hide timer
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
      hideControlsTimeoutRef.current = null
    }
  }

  // Handle mouse leave interactive elements
  const handleInteractiveElementLeave = () => {
    setIsHoveringControls(false)
  }

  // Handle speed button click (set state early to prevent triggering handleMouseLeave when dropdown opens)
  const handleSpeedButtonClick = () => {
    // Set state early
    setIsDropDownOpen(true)
    setShowControls(true)
    // Clear hide timer
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
      hideControlsTimeoutRef.current = null
    }
  }

  // Handle DropDown open
  const handleDropDownOpen = () => {
    setIsDropDownOpen(true)
    setShowControls(true)
    // Clear hide timer
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current)
      hideControlsTimeoutRef.current = null
    }
  }

  // Handle DropDown close
  const handleDropDownClose = () => {
    setIsDropDownOpen(false)
    // If mouse is not in container (closed outside video), hide controls immediately
    if (!isMouseInContainer) {
      setShowControls(false)
      setIsHoveringControls(false)
    }
  }

  // Reset state when src changes
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVideoAspectRatio("16/9") // Default aspect ratio
  }, [src])

  // Listen for video metadata loading
  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)

      // Calculate video's actual aspect ratio
      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight

      if (videoWidth && videoHeight) {
        setVideoAspectRatio(`${videoWidth}/${videoHeight}`)

        // Calculate dimensions that fit within constraints
        // Constraints: min-width: 320px, max-width: 720px, max-height: 275px
        let width = videoWidth
        let height = videoHeight
        const aspectRatio = videoWidth / videoHeight

        // Apply max-width constraint
        if (width > 720) {
          width = 720
          height = width / aspectRatio
        }

        // Apply max-height constraint
        if (height > 275) {
          height = 275
          width = height * aspectRatio
        }

        // Apply min-width constraint
        if (width < 320) {
          width = 320
          height = width / aspectRatio
        }

        setVideoDimensions({ width, height })
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      // Don't auto-show controls when video ends, follow mouse position rules
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("ended", handleEnded)

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("ended", handleEnded)
    }
  }, [])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      // Only set isFullscreen to true if THIS VideoPlayer's container is in fullscreen
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current)
      }
    }
  }, [])

  // Keyboard shortcuts (only work in fullscreen mode)
  useEffect(() => {
    // Only add event listener when this VideoPlayer is in fullscreen
    if (!isFullscreen) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for handled keys
      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault()
          togglePlay()
          break
        case "KeyF":
          e.preventDefault()
          toggleFullscreen()
          break
        case "KeyM":
          e.preventDefault()
          toggleMute()
          break
        case "ArrowLeft":
          e.preventDefault()
          // Skip backward 5 seconds
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, currentTime - 5)
          }
          break
        case "ArrowRight":
          e.preventDefault()
          // Skip forward 5 seconds
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(duration, currentTime + 5)
          }
          break
        case "ArrowUp":
          e.preventDefault()
          // Volume up
          if (videoRef.current) {
            const newVolume = Math.min(1, volume + 0.1)
            videoRef.current.volume = newVolume
            setVolume(newVolume)
            setIsMuted(false)
          }
          break
        case "ArrowDown":
          e.preventDefault()
          // Volume down
          if (videoRef.current) {
            const newVolume = Math.max(0, volume - 0.1)
            videoRef.current.volume = newVolume
            setVolume(newVolume)
            setIsMuted(newVolume === 0)
          }
          break
        case "Escape":
          // ESC key exits fullscreen (browser default behavior)
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isFullscreen, currentTime, duration, volume])

  const sizeClasses = {
    sm: "max-w-[320px]",
    md: "max-w-[560px]",
    lg: "max-w-[720px]",
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className={`video-player-root ${sizeClasses[size]} ${isFullscreen ? "fullscreen" : ""} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        aspectRatio: isFullscreen ? "auto" : videoAspectRatio,
        width: isFullscreen ? "100vw" : (videoDimensions ? `${videoDimensions.width}px` : undefined),
        height: isFullscreen ? "100vh" : (videoDimensions ? `${videoDimensions.height}px` : undefined),
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={thumbnailUrl}
        autoPlay={autoPlay}
        onClick={togglePlay}
      />

      <div
        className={`controls-container horizontal ${showControls ? "hover" : ""}`}
      >
        <div className="controls-inner" data-controls>
          <Tooltip
            content={
              isFullscreen ? (
                isPlaying ?
                  <Trans i18nKey="videoPlayer.hoykeys.pause" components={{
                    key: <div className="key" />
                  }} />
                :
                  <Trans i18nKey="videoPlayer.hoykeys.play" components={{
                    key: <div className="key" />
                  }} />
              )
              : (
                isPlaying ? t("videoPlayer.pause") : t("videoPlayer.play")
              )
            }
            type={isFullscreen ? "controls" : undefined}
            container={isFullscreen ? containerRef.current : undefined}
          >
            <Button
              shape="round"
              size="small"
              theme="TextOnly"
              color="neutralGray"
              className="video-player-play-button"
              onClick={togglePlay}
              onMouseEnter={handleInteractiveElementEnter}
              onMouseLeave={handleInteractiveElementLeave}
              data-play-icon
              noFocus
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </Button>
          </Tooltip>

          {/* Volume control */}
          <div
            className="volume-control-wrapper"
            onMouseEnter={handleInteractiveElementEnter}
            onMouseLeave={handleInteractiveElementLeave}
          >
            <MultiTooltip
              tooltipContent={isFullscreen ? undefined : t("videoPlayer.volume")}
              tooltipSide="bottom"
              infoTooltipContent={
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                  style={{
                    background: `linear-gradient(to right, var(--text-invert) 0%, var(--text-invert) ${volume * 100}%, var(--bg-gray-op-medium) ${volume * 100}%, var(--bg-gray-op-medium) 100%)`,
                  }}
                />
              }
              infoTooltipSide="top"
              infoTooltipSideOffset={17}
              infoTooltipAlign="start"
              infoTooltipAlignOffset={0}
              infoTooltipClassName="volume-slider-wrapper"
              closeDelay={200}
              container={isFullscreen ? containerRef.current : undefined}
            >
              <Button
                shape="round"
                size="small"
                theme="TextOnly"
                color="neutralGray"
                className="volume-button"
                noFocus
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  // Mute icon
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : (
                  // Volume icon - always render all arcs, control display with class
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3z"/>
                    <path
                      className={`volume-arc volume-arc-1 ${volume > 0.33 ? "active" : ""}`}
                      d="M14 8.03c1.48.73 2.5 2.25 2.5 4.02s-1.02 3.29-2.5 4.03"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      pathLength="100"
                    />
                    <path
                      className={`volume-arc volume-arc-2 ${volume > 0.66 ? "active" : ""}`}
                      d="M16.5 5.5c2.5 1.5 4 4.3 4 6.5s-1.5 5-4 6.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      pathLength="100"
                    />
                  </svg>
                )}
              </Button>
            </MultiTooltip>
          </div>

          {/* Time display */}
          <div className="time-display-inline">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Progress bar */}
          <div
            className="progress-bar-wrapper"
            onMouseEnter={handleInteractiveElementEnter}
            onMouseLeave={handleInteractiveElementLeave}
          >
            <input
              step="0.01"
              type="range"
              className="progress-bar"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleProgressChange}
              style={{
                background: `linear-gradient(to right, var(--text-invert) 0%, var(--text-invert) ${progress}%, var(--bg-gray-op-medium) ${progress}%, var(--bg-gray-op-medium) 100%)`,
              }}
            />
          </div>

          {/* Playback speed control */}
          <div
            className="speed-button-wrapper"
            onMouseEnter={handleInteractiveElementEnter}
            onMouseLeave={handleInteractiveElementLeave}
            onPointerDown={handleSpeedButtonClick}
          >
            <DropDown
              options={{
                "root": {
                  subOptions: playbackSpeeds.map((speed) => ({
                    label: `${speed}x`,
                    onClick: () => changePlaybackRate(speed),
                  })),
                },
              }}
              placement="top"
              align="start"
              rootKey="root"
              size="m"
              width="fill"
              contentClassName="speed-menu"
              fixWidth={80}
              bottom={15}
              onOpen={handleDropDownOpen}
              onClose={handleDropDownClose}
              container={isFullscreen ? containerRef.current : undefined}
            >
              <Tooltip container={isFullscreen ? containerRef.current : undefined} content={t("videoPlayer.playbackSpeed")}>
                <Button
                  shape="round"
                  size="small"
                  theme="TextOnly"
                  color="neutralGray"
                  className="speed-button"
                  noFocus
                >
                  {playbackRate}x
                </Button>
              </Tooltip>
            </DropDown>
          </div>

          {/* Download button */}
          <Tooltip
            container={isFullscreen ? containerRef.current : undefined}
            content={t("videoPlayer.download")}
          >
            <Button
              shape="round"
              size="small"
              theme="TextOnly"
              color="neutralGray"
              className="video-player-download-button"
              noFocus
              onClick={handleDownload}
              onMouseEnter={handleInteractiveElementEnter}
              onMouseLeave={handleInteractiveElementLeave}
              aria-label="Download"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
            </Button>
          </Tooltip>

          {/* Fullscreen button */}
          <Tooltip
            content={
              isFullscreen ?
                <Trans i18nKey="videoPlayer.hoykeys.exitFullscreen" components={{
                  key: <div className="key" />
                }} />
              : t("videoPlayer.fullscreen")
            }
            type={isFullscreen ? "controls" : undefined}
            container={isFullscreen ? containerRef.current : undefined}>
            <Button
              shape="round"
              size="small"
              theme="TextOnly"
              color="neutralGray"
              className="video-player-fullscreen-button"
              noFocus
              onClick={toggleFullscreen}
              onMouseEnter={handleInteractiveElementEnter}
              onMouseLeave={handleInteractiveElementLeave}
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
