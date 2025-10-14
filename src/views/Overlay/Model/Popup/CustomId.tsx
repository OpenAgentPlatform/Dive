import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import PopupConfirm from "../../../../components/PopupConfirm"
import { useModelsProvider } from "../ModelsProvider"
import Input from "../../../../components/Input"

type Props = {
  onAddCustomModelID: (name: string) => void
}

const CustomIdPopup = ({ onAddCustomModelID }: Props) => {
  const { t } = useTranslation()
  const [showCustomModelID, setShowCustomModelID] = useState(false)
  const [customModelID, setCustomModelID] = useState("")
  const [customModelIDError, setCustomModelIDError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const { getLatestBuffer } = useModelsProvider()
  const { models } = getLatestBuffer()

  useEffect(() => {
    autoFocus()
  }, [showCustomModelID])

  const autoFocus = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
    inputRef.current?.focus()
  }

  const addCustomModelID = (name: string) => {
    setCustomModelIDError("")
    if (name.length == 0) {
      // check if the model id is empty
      setCustomModelIDError(t("models.customModelID.Error.empty"))
      return
    } else if (models.find((model) => model.model === name)) {
      // check if the model id is already in the list
      setCustomModelIDError(t("models.customModelID.Error.exist"))
      return
    }

    setShowCustomModelID(false)
    setCustomModelID("")
    setCustomModelIDError("")
    onAddCustomModelID(name)
  }

  const handleCustomModelIDChange = (name: string) => {
    setCustomModelID(name)
    setCustomModelIDError("")
  }

  const handleCustomModelIDClose = () => {
    setShowCustomModelID(false)
    setCustomModelID("")
    setCustomModelIDError("")
  }
  return (
    <>
      <button
        className="model-list-add-key"
        onClick={() => setShowCustomModelID(true)}
      >
        {t("models.customModelID.add")}
      </button>
      {showCustomModelID && (
        <PopupConfirm
          zIndex={900}
          className="model-customID-popup"
          onConfirm={() => addCustomModelID(customModelID)}
          onCancel={handleCustomModelIDClose}
          onClickOutside={handleCustomModelIDClose}
          footerType="center"
          noBorder={true}
        >
          <div className="model-popup-content">
            <Input
              label={t("models.customModelID.title")}
              value={customModelID}
              onChange={(e) => handleCustomModelIDChange(e.target.value)}
              placeholder={t("models.customModelID.placeholder")}
              size="small"
              error={customModelIDError ? true : false}
              information={customModelIDError ? customModelIDError : ""}
            />
          </div>
        </PopupConfirm>
      )}
    </>
  )
}

export default CustomIdPopup
