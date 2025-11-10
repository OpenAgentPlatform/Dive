import "@/styles/components/_ModelSelect.scss"
import { useTranslation } from "react-i18next"
import Select from "./Select"
import { useCallback, useEffect, useMemo, useState } from "react"
import { isProviderIconNoFilter, PROVIDER_ICONS } from "../atoms/interfaceState"
import { useAtomValue, useSetAtom } from "jotai"
import { configAtom, writeRawConfigAtom } from "../atoms/configState"
import { openOverlayAtom } from "../atoms/layerState"
import { showToastAtom } from "../atoms/toastState"
import Tooltip from "./Tooltip"
import { systemThemeAtom, userThemeAtom } from "../atoms/themeState"
import { modelSettingsAtom } from "../atoms/modelState"
import { getGroupTerm, getModelTerm, getTermFromRawModelConfig, GroupTerm, intoRawModelConfig, matchOpenaiCompatible, ModelTerm, queryGroup, queryModel } from "../helper/model"
import isEqual from "lodash/isEqual"

const DEFAULT_MODEL = {group: {}, model: {}}

const ModelSelect = () => {
  const { t } = useTranslation()
  const config = useAtomValue(configAtom)
  const saveAllConfig = useSetAtom(writeRawConfigAtom)
  const [model, setModel] = useState<{group: GroupTerm, model: ModelTerm}>(DEFAULT_MODEL)
  const openOverlay = useSetAtom(openOverlayAtom)
  const showToast = useSetAtom(showToastAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const userTheme = useAtomValue(userThemeAtom)
  const settings = useAtomValue(modelSettingsAtom)

  const getModelNamePrefix = (group: GroupTerm) => {
    switch (group.modelProvider) {
      case "oap":
        return "OAP"
      case "bedrock":
        return `***${group.extra?.credentials?.accessKeyId?.slice(-4)}`
      case "lmstudio":
        return "LMStudio"
      default:
        if (group.apiKey) {
          return `***${group.apiKey.slice(-4)}`
        }

        if (group.baseURL) {
          return `***${group.baseURL.slice(-4)}`
        }
    }
  }

  const equalCustomizer = useCallback((a: {group: GroupTerm, model: ModelTerm}, b: {group: GroupTerm, model: ModelTerm}) => {
    if (b.group.modelProvider !== "openai_compatible" && b.group.baseURL) {
      const matchProvider = matchOpenaiCompatible(b.group.baseURL)
      if (matchProvider !== "openai_compatible") {
        b.group.modelProvider = matchProvider
      }
    }

    if (b.group.modelProvider === "openai" && b.group.baseURL) {
      b.group.modelProvider = "openai_compatible"
    }

    // For OAP provider, don't compare apiKey
    if (a.group.modelProvider === "oap" && b.group.modelProvider === "oap") {
      const { apiKey: _, ...aGroupWithoutApiKey } = a.group
      const { apiKey: __, ...bGroupWithoutApiKey } = b.group
      return isEqual({ group: aGroupWithoutApiKey, model: a.model }, { group: bGroupWithoutApiKey, model: b.model })
    }

    return isEqual(a, b)
  }, [])

  const modelList = useMemo(() => {
    const data =  Object.values(settings.groups)
      .filter((group) => group.active)
      .flatMap((group) =>
        group.models
          .filter((model) => model.active)
          .map((model) => ({
            provider: group.modelProvider,
            name: `${getModelNamePrefix(group)}/${model.model}`,
            value: {group: getGroupTerm(group), model: getModelTerm(model)},
          })
      ))

    data.sort((a, b) => {
      if (equalCustomizer(a.value, model)) {
        return -100
      }

      if (equalCustomizer(b.value, model)) {
        return 100
      }

      return a.provider === "oap" ? -1 : 0
    })

    return data
  }, [settings, model])

  useEffect(() => {
    setModel(getTermFromRawModelConfig(config) ?? DEFAULT_MODEL)
  }, [config])

  const handleModelChange = async (value: {group: GroupTerm, model: ModelTerm}) => {
    const _model = model
    setModel(value)
    try {
      const group = queryGroup(value.group, settings.groups)
      if (group.length === 0) {
        throw new Error("Group not found")
      }

      const model = queryModel(value.model, group[0])
      if (model.length === 0) {
        throw new Error("Model not found")
      }

      const data = await saveAllConfig(intoRawModelConfig(settings, group[0], model[0])!)
      localStorage.setItem("selectedModel", JSON.stringify({group: value.group, model: value.model}))
      if (data.success) {
        console.log(data)
      }
    } catch (error) {
      console.error(error)
      showToast({
        message: t("setup.saveFailed"),
        type: "error"
      })
      setModel(_model)
    }
  }

  return (
    <div className="model-select">
      <Select
        options={modelList.map((model, i) => ({
          value: model.value,
          label: (
              <div className="model-select-label" key={i}>
                <img
                  src={PROVIDER_ICONS[model.provider]}
                  alt={model.provider}
                  className={`model-select-label-icon ${isProviderIconNoFilter(model.provider, userTheme, systemTheme) ? "no-filter" : ""}`}
                />
                <span className="model-select-label-text">
                  {model.name}
                </span>
              </div>
            )
          })
        )}
        placeholder={modelList.length === 0 ? t("models.noModelAlertOption") : t("models.selectModelPlaceHolder")}
        value={model!}
        onSelect={handleModelChange}
        className={`${modelList.length === 0 ? "disabled" : ""}`}
        contentClassName="model-select-content"
        equalCustomizer={equalCustomizer}
      />
      <Tooltip
        content={t("chat.modelSettings")}
      >
        <button
          className="model-select-add-btn"
          onClick={() => openOverlay({ page: "Setting", tab: "Model" })}
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
