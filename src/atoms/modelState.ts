import { atom } from "jotai"
import { LLMGroup, ModelGroupSetting, ModelProvider } from "../../types/model"
import { defaultModelGroupSetting, getGroupTerm, getModelNamePrefix, getModelTerm, GroupTerm, ModelTerm, removeGroup, updateGroup } from "../helper/model"

export const modelSettingsAtom = atom<ModelGroupSetting>(defaultModelGroupSetting())

export const modelGroupsAtom = atom<LLMGroup[]>((get) => get(modelSettingsAtom).groups)

export const disableModelGroupAtom = atom(
  null,
  (get, set, group: LLMGroup) => {
    const settings = get(modelSettingsAtom)
    const groupTerm = getGroupTerm(group)
    const newGroups = updateGroup(groupTerm, settings.groups || [], {
      active: false
    })

    if (newGroups) {
      set(modelSettingsAtom, {
        ...settings,
        groups: newGroups
      })
    }
  }
)

export interface ModelOption {
  provider: ModelProvider
  name: string
  value: { group: GroupTerm, model: ModelTerm }
}

export const modelListAtom = atom<ModelOption[]>((get) => {
  const settings = get(modelSettingsAtom)
  return settings.groups
    .filter(group => group.active)
    .flatMap(group =>
      group.models
        .filter(m => m.active && m.verifyStatus !== "unSupportModel")
        .map(m => ({
          provider: group.modelProvider,
          name: `${getModelNamePrefix(group) ?? ""}/${m.model}`,
          value: { group: getGroupTerm(group), model: getModelTerm(m) }
        }))
    )
})

export const removeModelGroupAtom = atom(
  null,
  (get, set, group: LLMGroup) => {
    const settings = get(modelSettingsAtom)
    const groupTerm = getGroupTerm(group)
    const newGroups = removeGroup(groupTerm, settings.groups || [])
    if (newGroups) {
      set(modelSettingsAtom, {
        ...settings,
        groups: newGroups
      })
    }
  }
)
