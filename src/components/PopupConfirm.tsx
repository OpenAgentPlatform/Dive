import { useEffect } from "react";
import { Behavior, useLayer } from "../hooks/useLayer";
import PopupWindow, { PopupStylePorps } from "./PopupWindow";
import { useTranslation } from "react-i18next"
import Tooltip from "./Tooltip";

type PopupConfirmProps = PopupStylePorps & {
	title?: string
	children?: React.ReactNode
	className?: string
	noBorder?: boolean
	showClose?: boolean
	confirmText?: string | React.ReactNode
	confirmTooltip?: string
	disabled?: boolean
	cancelText?: string | React.ReactNode
	cancelTooltip?: string
	footerHint?: React.ReactNode | string
	footerType?: "center" | "flex-end"
	listenHotkey?: boolean
	onClickOutside?: () => void
	onConfirm?: () => void
	onCancel?: () => void
}

export default function PopupConfirm({ title, children, zIndex, noBackground, className, noBorder, showClose, onClickOutside, onConfirm, confirmText, confirmTooltip, disabled, onCancel, cancelText, cancelTooltip, footerHint, footerType, listenHotkey=true }: PopupConfirmProps) {
	const { t } = useTranslation()
  
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [])
	
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault()
				e.stopPropagation()
				onConfirm?.()
			}
		}

		if(listenHotkey) {
			window.addEventListener("keydown", handleKeyDown)
		}
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [onConfirm])
  
  useLayer({
    type: "Modal",
    behavior: Behavior.autoPush,
    onClose: () => {
      onCancel ? onCancel() : onClickOutside?.()
    }
  })
	
	const windowProps = {
		onClickOutside,
		zIndex,
		noBackground,
	}

	const ConfirmButton = () => {
  const buttonElement = (
			<button
				className="confirm-btn"
				onClick={onConfirm}
				disabled={disabled}
			>
				{confirmText || t("common.confirm")}
			</button>
  )

  return confirmTooltip ? (
    <Tooltip content={confirmTooltip}>
      {buttonElement}
    </Tooltip>
  ) : buttonElement
}

const CancelButton = () => {
	const buttonElement = (
		<button
			className="cancel-btn"
			onClick={onCancel}
		>
			{cancelText || t("common.cancel")}
		</button>
	)

	return cancelTooltip ? (
			<Tooltip content={cancelTooltip}>
					{buttonElement}
			</Tooltip>
	) : buttonElement
}

	return (
		<PopupWindow {...windowProps}>
			<div className={`popup-confirm ${noBorder ? "no-border" : ""} ${className || ""}`}>
				{showClose && (
					<div className="close-btn" onClick={onClickOutside}>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</div>
				)}
				{title &&
					<div className="popup-confirm-header">
						<h3>{title}</h3>
					</div>
				}
				{children &&
					<div className="popup-confirm-content">
						{children}
					</div>
				}
				<div className={`popup-confirm-footer ${footerHint ? "space-between" : footerType}`}>
					{footerHint &&
						<div className="popup-confirm-footer-hint">
							{footerHint}
						</div>
					}
					<div className="popup-confirm-footer-btn">
						{onCancel && CancelButton()}
						{onConfirm && ConfirmButton()}
					</div>
				</div>
			</div>
		</PopupWindow>
	)
}
