import { useSetAtom } from "jotai"
import useUpdateProgress from "../hooks/useUpdateProgress"
import { memo, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { showToastAtom } from "../atoms/toastState"
import Button from "./Button"
import { version } from "../../package.json"

const AvailableButton = ({ newVersion }: { newVersion: string }) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="update-btn-wrap downloading">
        <span>✨</span>
        <span className="update-btn-text">{t("sidebar.update")}</span>
      </div>
      <div className="update-btn-text">
        <span>v{newVersion}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18" height="18">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"></path>
        </svg>
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

  return (
    <div className="update-btn-container">
      <span className="update-version-text">Dive Version: v{version}</span>
      {newVersion &&
        <Button
          className={`update-btn ${progress === 0 ? "available" : "downloading"}`}
          size="fit"
          padding="xxs"
          minHeight="44px"
          onClick={update}
        >
          {progress === 0 ? <AvailableButton newVersion={newVersion} /> : <DownloadingButton progress={progress} isCompleted={isCompleted} />}
        </Button>
      }
    </div>
  )
}

export default memo(UpdateButton)