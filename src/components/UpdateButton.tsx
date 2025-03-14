import { useSetAtom } from "jotai"
import useUpdateProgress from "../hooks/useUpdateProgress"
import { memo, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { showToastAtom } from "../atoms/toastState"

const AvailableButton = ({ newVersion }: { newVersion: string }) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="update-btn-wrap downloading">
        <span>✨</span>
        <span className="update-btn-text">{t("sidebar.update")}</span>
      </div>
      <div className="update-btn-text">
        <span>v{newVersion} &gt;</span>
      </div>
    </>
  )
}

const DownloadingButton = ({ progress, isCompleted }: { progress: number, isCompleted: boolean }) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="update-btn-wrap">
        <span>{isCompleted ? "✅" : "⏬"}</span>
        <span className="update-btn-text">
          {isCompleted ? t("update.readyToInstall") : t("update.downloading")}
        </span>
      </div>
      <div className="update-progress-container">
        {!isCompleted && (
          <>
            <div
              className="update-progress-bar"
              style={{ width: `${progress}%` }}
            />
            <span className="update-progress-text">{Math.round(progress)}%</span>
          </>
        )}
        {isCompleted && (
          <span className="update-btn-text">{t("update.clickToInstall")}</span>
        )}
      </div>
    </>
  )
}

const UpdateButton = () => {
  const showToast = useSetAtom(showToastAtom)
  const [isCompleted, setIsCompleted] = useState(false)
  const { newVersion, progress, update } = useUpdateProgress(
    useCallback(() => {
      setIsCompleted(true)
    }, []),
    useCallback((e) => {
      showToast({
        message: e.message,
        type: "error",
      })
    }, [showToast])
  )

  if (!newVersion) {
    return null
  }

  return (
    <button
      className={`sidebar-footer-btn update-btn ${progress === 0 ? "available" : "downloading"}`}
      onClick={update}
    >
      {progress === 0 ? <AvailableButton newVersion={newVersion} /> : <DownloadingButton progress={progress} isCompleted={isCompleted} />}
    </button>
  )
}

export default memo(UpdateButton)