import "@/styles/components/_ModelSelect.scss"
import { useTranslation } from "react-i18next"
import Select from "./Select"
import { useEffect, useState } from "react"
import { ModelProvider, PROVIDER_ICONS } from "../atoms/interfaceState"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { configAtom, configListAtom, ModelConfig, saveAllConfigAtom } from "../atoms/configState"
import { openOverlayAtom } from "../atoms/layerState"
import { showToastAtom } from "../atoms/toastState"
import { getModelPrefix } from "../util"
import Tooltip from "./Tooltip"

interface ModelSelectProps {
  key: string
  name: string
  model: ModelProvider
}

const ModelSelect = () => {
  const { t } = useTranslation()
  const config = useAtomValue(configAtom)
  const configList = useAtomValue(configListAtom)
  const saveAllConfig = useSetAtom(saveAllConfigAtom)
  const [modelList, setModelList] = useState<ModelSelectProps[]>([])
  const [model, setModel] = useState<string>(config?.activeProvider ?? "")
  const openOverlay = useSetAtom(openOverlayAtom)
  const [, showToast] = useAtom(showToastAtom)

  useEffect(() => {
    if (!configList) return
    const _modelsList: ModelSelectProps[] = []
    Object.entries(configList as Record<string, ModelConfig>)
    .forEach(([key, config]) => {
      if(!config.model || !config.active) return
      _modelsList.push({
        key: key,
        name: `${getModelPrefix(config, 4)}/${config.model}`,
        model: config.modelProvider
      })
    })
    setModelList([..._modelsList])
  }, [configList])

  useEffect(() => {
    setModel(config?.activeProvider ?? "")
  }, [config?.activeProvider])

  const handleModelChange = async (value: string) => {
    const _model = model
    setModel(value)
    try {
      const data = await saveAllConfig({ providerConfigs: configList as Record<string, ModelConfig>, activeProvider: value as ModelProvider })
      if (data.success) {
        showToast({
          message: t("setup.saveSuccess"),
          type: "success"
        })
      }
    } catch (error) {
      setModel(_model)
    }
  }

  return (
    <div className="model-select">
      <Select
        options={modelList.map((model) => ({
          value: model.key,
          label: (
              <div className="model-select-label" key={model.key}>
              <img
                src={PROVIDER_ICONS[model.model]}
                alt={model.model}
                className={`model-select-label-icon ${model.model === "ollama" || model.model === "openai_compatible" ? "no-filter" : ""}`}
              />
              <span className="model-select-label-text">
                {model.name}
              </span>
                </div>
            )
          })
        )}
        placeholder={modelList.length === 0 ? t("models.noModelAlertOption") : ""}
        value={model}
        onSelect={handleModelChange}
        className={`${modelList.length === 0 ? "disabled" : ""}`}
        contentClassName="model-select-content"
      />
      <Tooltip
        content={t("chat.modelSettings")}
      >
        <button
          className="model-select-add-btn"
          onClick={() => openOverlay("Model")}
        >
          <svg width="20px" height="20px" viewBox="0 0 20 20">
            <g id="surface1">
              <path d="M 8.015625 2.808594 C 5.308594 4.160156 5.589844 3.765625 5.589844 6.25 L 5.589844 8.367188 L 3.792969 9.292969 L 1.984375 10.21875 L 1.984375 15.367188 L 4.042969 16.425781 C 5.175781 17.015625 6.191406 17.5 6.292969 17.5 C 6.398438 17.5 7.28125 17.089844 8.28125 16.601562 L 10.074219 15.691406 L 11.851562 16.601562 C 12.839844 17.089844 13.71875 17.5 13.808594 17.5 C 14.074219 17.5 17.71875 15.632812 17.910156 15.398438 C 18.042969 15.234375 18.089844 14.5 18.058594 12.707031 L 18.015625 10.21875 L 16.21875 9.292969 L 14.410156 8.367188 L 14.410156 6.265625 C 14.410156 4.441406 14.382812 4.132812 14.160156 3.941406 C 13.765625 3.589844 10.339844 1.910156 10.042969 1.925781 C 9.898438 1.925781 8.984375 2.324219 8.015625 2.808594 Z M 11.324219 3.808594 L 12.425781 4.382812 L 11.21875 4.96875 L 10.03125 5.558594 L 8.867188 4.957031 L 7.691406 4.351562 L 8.808594 3.808594 C 9.425781 3.5 10 3.25 10.074219 3.25 C 10.160156 3.25 10.71875 3.5 11.324219 3.808594 Z M 8.234375 6.03125 L 9.410156 6.617188 L 9.410156 8.089844 C 9.410156 8.898438 9.382812 9.558594 9.339844 9.558594 C 9.292969 9.558594 8.734375 9.292969 8.089844 8.96875 L 6.910156 8.382812 L 6.910156 6.910156 C 6.910156 6.101562 6.941406 5.441406 6.984375 5.441406 C 7.03125 5.441406 7.589844 5.707031 8.234375 6.03125 Z M 13.089844 6.910156 L 13.089844 8.382812 L 11.910156 8.96875 C 11.265625 9.292969 10.707031 9.558594 10.660156 9.558594 C 10.617188 9.558594 10.589844 8.910156 10.589844 8.117188 L 10.589844 6.675781 L 11.808594 6.074219 C 12.46875 5.734375 13.03125 5.457031 13.058594 5.457031 C 13.074219 5.441406 13.089844 6.101562 13.089844 6.910156 Z M 7.425781 11.207031 L 6.265625 11.792969 L 5.074219 11.21875 L 3.898438 10.632812 L 5.074219 10.03125 L 6.25 9.441406 L 7.425781 10.03125 L 8.601562 10.617188 Z M 14.925781 11.207031 L 13.765625 11.792969 L 12.574219 11.21875 L 11.398438 10.632812 L 12.574219 10.03125 L 13.75 9.441406 L 14.925781 10.03125 L 16.101562 10.617188 Z M 5.589844 14.351562 L 5.589844 15.839844 L 3.089844 14.542969 L 3.089844 11.617188 L 5.589844 12.851562 Z M 9.351562 14.515625 C 9.308594 14.617188 8.734375 14.96875 8.089844 15.28125 L 6.910156 15.851562 L 6.910156 12.851562 L 8.132812 12.265625 L 9.339844 11.660156 L 9.382812 12.984375 C 9.398438 13.71875 9.398438 14.398438 9.351562 14.515625 Z M 13.089844 14.351562 L 13.089844 15.839844 L 10.589844 14.542969 L 10.589844 11.617188 L 13.089844 12.851562 Z M 16.851562 14.515625 C 16.808594 14.617188 16.234375 14.96875 15.589844 15.28125 L 14.410156 15.851562 L 14.410156 12.851562 L 15.632812 12.265625 L 16.839844 11.660156 L 16.882812 12.984375 C 16.898438 13.71875 16.898438 14.398438 16.851562 14.515625 Z M 16.851562 14.515625 "></path>
            </g>
          </svg>
        </button>
      </Tooltip>
    </div>
  )
}

export default ModelSelect
