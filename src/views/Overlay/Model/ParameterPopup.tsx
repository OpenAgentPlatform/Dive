import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAtom } from "jotai"
import PopupConfirm from "../../../components/PopupConfirm"
import InfoTooltip from "../../../components/InfoTooltip"
import WrappedInput from "../../../components/WrappedInput"
import WrappedTextarea from "../../../components/WrappedTextarea"
import { useModelsProvider } from "./ModelsProvider"
import { showToastAtom } from "../../../atoms/toastState"

const ParameterPopup = ({
  onClose,
}: {
  onClose: () => void
}) => {
  const { t } = useTranslation()
  const [, showToast] = useAtom(showToastAtom)
  const { setMultiModelConfigList, multiModelConfigList, saveConfig } = useModelsProvider()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [initialParams, setInitialParams] = useState<Record<string, number>>({})
  const [initialInstructions, setInitialInstructions] = useState("")
  const { parameter, setParameter } = useModelsProvider()
  const changed = instructions !== initialInstructions || parameter.topP !== initialParams.topP || parameter.temperature !== initialParams.temperature

  useEffect(() => {
    if(!multiModelConfigList) return
    fetchInstructions()
    setInitialParams({ ...parameter })
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

  const handleParameterChange = (key: string, value: number) => {
    setInitialParams(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const validateNumber = (value: number, min: number, max: number) => {
    return value > max ? max : value < min ? min : value
  }

  const onConfirm = async () => {
    setParameter(initialParams)
    if(!multiModelConfigList?.length){
      localStorage.setItem("ConfigParameter", JSON.stringify(initialParams))
    }
    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList))
    try {
      setIsSubmitting(true)
      const response = await fetch("/api/config/customrules", {
        method: "POST",
        body: instructions
      })
      const data = await response.json()
      const _data = await saveConfig()

      if (data.success && _data.success) {
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
      setMultiModelConfigList(_multiModelConfigList)
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
        <div className="models-parameter">
          <label>{t("models.parameters")}</label>
          <div className="parameters-container">
            <div className="parameters-grid">
                <InfoTooltip
                  maxWidth={270}
                  side="left"
                  content={t("setup.topPDescription")}
                >
                <div className="parameter-label">
                  <div>TOP-P</div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 23 22" width="15" height="15">
                    <g clipPath="url(#ic_information_svg__a)">
                      <circle cx="11.5" cy="11" r="10.25" stroke="currentColor" strokeWidth="1.5"></circle>
                      <path fill="currentColor" d="M9.928 13.596h3.181c-.126-2.062 2.516-2.63 2.516-5.173 0-2.01-1.6-3.677-4.223-3.608-2.229.051-4.08 1.288-4.026 3.9h2.714c0-.824.593-1.168 1.222-1.185.593 0 1.258.326 1.222.962-.144 1.942-2.911 2.389-2.606 5.104Zm1.582 3.591c.988 0 1.779-.618 1.779-1.563 0-.963-.791-1.581-1.78-1.581-.97 0-1.76.618-1.76 1.58 0 .946.79 1.565 1.76 1.565Z"></path>
                    </g>
                    <defs>
                      <clipPath id="ic_information_svg__a">
                        <path fill="currentColor" d="M.5 0h22v22H.5z"></path>
                      </clipPath>
                    </defs>
                  </svg>
                </div>
              </InfoTooltip>
              <WrappedInput
                type="number"
                value={initialParams.topP ?? 0}
                min={0}
                max={1}
                step={0.1}
                onChange={e => handleParameterChange("topP", validateNumber(parseFloat(e.target.value), 0, 1))}
              />
            </div>
            <div className="parameters-grid">
              <InfoTooltip
                maxWidth={270}
                side="left"
                content={t("setup.temperatureDescription")}
              >
                <div className="parameter-label">
                  <div>Temperature</div>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 23 22" width="15" height="15">
                    <g clipPath="url(#ic_information_svg__a)">
                      <circle cx="11.5" cy="11" r="10.25" stroke="currentColor" strokeWidth="1.5"></circle>
                      <path fill="currentColor" d="M9.928 13.596h3.181c-.126-2.062 2.516-2.63 2.516-5.173 0-2.01-1.6-3.677-4.223-3.608-2.229.051-4.08 1.288-4.026 3.9h2.714c0-.824.593-1.168 1.222-1.185.593 0 1.258.326 1.222.962-.144 1.942-2.911 2.389-2.606 5.104Zm1.582 3.591c.988 0 1.779-.618 1.779-1.563 0-.963-.791-1.581-1.78-1.581-.97 0-1.76.618-1.76 1.58 0 .946.79 1.565 1.76 1.565Z"></path>
                    </g>
                    <defs>
                      <clipPath id="ic_information_svg__a">
                        <path fill="currentColor" d="M.5 0h22v22H.5z"></path>
                      </clipPath>
                    </defs>
                  </svg>
                </div>
              </InfoTooltip>
              <input type="number" value={initialParams.temperature ?? 0} min={0} max={1} step={0.1} onChange={e => handleParameterChange("temperature", validateNumber(parseFloat(e.target.value), 0, 1))} />
            </div>
          </div>
        </div>
        <div className="models-parameter">
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