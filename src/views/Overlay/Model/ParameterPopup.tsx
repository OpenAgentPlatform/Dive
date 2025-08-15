import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSetAtom } from "jotai"
import PopupConfirm from "../../../components/PopupConfirm"
import WrappedTextarea from "../../../components/WrappedTextarea"
import { showToastAtom } from "../../../atoms/toastState"

const ParameterPopup = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation()
  const showToast = useSetAtom(showToastAtom)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [initialInstructions, setInitialInstructions] = useState("")
  const changed = instructions !== initialInstructions

  useEffect(() => {
    fetchInstructions()
  }, [])

  const fetchInstructions = async () => {
    try {
      const response = await fetch("/api/config/customrules")
      const data = await response.json()
      if (data.success) {
        setInstructions(data.rules)
        setInitialInstructions(data.rules)
      }
    } catch (error) {
      console.error("Failed to fetch custom rules:", error)
    }
  }

  const onConfirm = async () => {
    try {
      setIsSubmitting(true)
      const response = await fetch("/api/config/customrules", {
        method: "POST",
        body: instructions
      })
      const data = await response.json()
      if (data.success) {
        showToast({
          message: t("models.parameterSaved"),
          type: "success"
        })
        setInitialInstructions(instructions)
        setIsSubmitting(false)
        onClose()
      }
    } catch (error) {
      console.error("Failed to save custom rules:", error)
      showToast({
        message: t("models.parameterSaveFailed"),
        type: "error"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PopupConfirm
      zIndex={900}
      className="models-parameter-popup-confirm"
      onConfirm={onConfirm}
      confirmText={
        isSubmitting ? (
          <div className="loading-spinner"></div>
        ) : t("tools.save")
      }
      onCancel={onClose}
      onClickOutside={onClose}
      disabled={!changed || isSubmitting}
    >
      <div className="models-parameter-popup">
        <div className="models-parameter instructions">
          <label>{t("modelConfig.customInstructions")}</label>
          <div className="instructions-content">
            <WrappedTextarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder={t("modelConfig.customInstructionsPlaceholder")}
            />
            <div className="instructions-description">{t("modelConfig.customInstructionsDescription")}</div>
          </div>
        </div>
      </div>
    </PopupConfirm>
  )
}

export default ParameterPopup