import { useSetAtom } from "jotai"
import useUpdateProgress from "../hooks/useUpdateProgress"
import { memo, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { showToastAtom } from "../atoms/toastState"
import Button from "./Button"

const AvailableButton = ({ newVersion }: { newVersion: string }) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="update-btn-wrap downloading">
        <span className="update-btn-icon">✨</span>
        <span className="update-btn-text">{t("sidebar.update")}</span>
      </div>
      <div className="update-btn-text">
        <span>v{newVersion}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 17 16" fill="none">
          <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
        </svg>
      </div>
    </>
  )
}

const DownloadingButton = ({ progress, isCompleted }: { progress: number, isCompleted: boolean }) => {
  const { t } = useTranslation()

  return (
    <div className="update-btn-downloading">
      {!isCompleted ? (
        <>
          <div className="update-btn-wrap">
            <div className="update-btn-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="17" viewBox="0 0 14 17" fill="none">
                <path d="M0.333984 16.8333V15.1667H13.6673V16.8333H0.333984ZM7.00065 13.5L1.16732 6H4.50065V0.166667H9.50065V6H12.834L7.00065 13.5ZM7.00065 10.7917L9.41732 7.66667H7.83398V1.83333H6.16732V7.66667H4.58398L7.00065 10.7917Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="update-btn-downloading-text">
              <span>{`${parseFloat(progress.toFixed(2))}%`}</span>
              <span>{t("update.downloading")}</span>
            </div>
          </div>
          <div className="update-progress-container">
            <div
              className="update-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      ) : (
        <div className="update-btn-wrap">
          <div className="update-btn-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" viewBox="0 0 18 17" fill="none">
            <path d="M7.83268 12.3333L13.7077 6.45834L12.541 5.29167L7.83268 10L5.45768 7.625L4.29102 8.79167L7.83268 12.3333ZM8.99935 16.8333C7.84657 16.8333 6.76324 16.6146 5.74935 16.1771C4.73546 15.7396 3.85352 15.1458 3.10352 14.3958C2.35352 13.6458 1.75977 12.7639 1.32227 11.75C0.884766 10.7361 0.666016 9.65278 0.666016 8.5C0.666016 7.34723 0.884766 6.26389 1.32227 5.25C1.75977 4.23612 2.35352 3.35417 3.10352 2.60417C3.85352 1.85417 4.73546 1.26042 5.74935 0.822922C6.76324 0.385422 7.84657 0.166672 8.99935 0.166672C10.1521 0.166672 11.2355 0.385422 12.2493 0.822922C13.2632 1.26042 14.1452 1.85417 14.8952 2.60417C15.6452 3.35417 16.2389 4.23612 16.6764 5.25C17.1139 6.26389 17.3327 7.34723 17.3327 8.5C17.3327 9.65278 17.1139 10.7361 16.6764 11.75C16.2389 12.7639 15.6452 13.6458 14.8952 14.3958C14.1452 15.1458 13.2632 15.7396 12.2493 16.1771C11.2355 16.6146 10.1521 16.8333 8.99935 16.8333ZM8.99935 15.1667C10.8605 15.1667 12.4368 14.5208 13.7285 13.2292C15.0202 11.9375 15.666 10.3611 15.666 8.5C15.666 6.63889 15.0202 5.0625 13.7285 3.77084C12.4368 2.47917 10.8605 1.83334 8.99935 1.83334C7.13824 1.83334 5.56185 2.47917 4.27018 3.77084C2.97852 5.0625 2.33268 6.63889 2.33268 8.5C2.33268 10.3611 2.97852 11.9375 4.27018 13.2292C5.56185 14.5208 7.13824 15.1667 8.99935 15.1667Z" fill="currentColor"/>
          </svg>
          </div>
          <span className="update-btn-downloading-text">
            <span>{t("update.readyToInstall")}</span>
            <span className="update-btn-install-text">{t("update.clickToInstall")}</span>
          </span>
        </div>
      )}
    </div>
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
      {newVersion &&
        <Button
          className={`update-btn ${progress === 0 ? "available" : "downloading"}`}
          size="fit"
          padding="xxs"
          minHeight="33px"
          onClick={update}
        >
          {progress === 0 ? <AvailableButton newVersion={newVersion} /> : <DownloadingButton progress={progress} isCompleted={isCompleted} />}
        </Button>
      }
    </div>
  )
}

export default memo(UpdateButton)