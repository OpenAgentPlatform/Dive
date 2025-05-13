import { useAtom } from "jotai"
import { InterfaceModelConfig, InterfaceModelConfigMap, modelVerifyListAtom, verifyModelWithConfig } from "../../../atoms/configState"
import { useRef } from "react"

export interface ModelVerifyDetail {
  name: string
  status: ModelVerifyStatus
  detail?: Record<string, any>
}

export type ModelVerifyStatus = "verifying" | "abort" | "ignore" | "success" | "successInPrompt" | "unSupportTool" | "unSupportModel" | "unVerified" | "error"

export const useModelVerify = () => {
  const [allVerifiedList, setAllVerifiedList] = useAtom(modelVerifyListAtom)
  const detail = useRef<ModelVerifyDetail[]>([])
  const pending = useRef<Set<Promise<void>>>(new Set())
  const controllers = useRef<Set<AbortController>>(new Set())
  const isAbort = useRef(false)
  const abortTimeout = useRef<NodeJS.Timeout | null>(null)

  const verify = async (needVerifyList: InterfaceModelConfigMap, onComplete: () => void, onUpdate?: (detail: ModelVerifyDetail[]) => void, onAbort?: () => void, timeout?: number) => {
    detail.current = []
    Object.entries(needVerifyList).forEach(([key, value]) => {
      detail.current.push({name: value.model ?? "", status: "verifying", detail: {}})
    })

    onUpdate?.(detail.current)

    const entries = Object.entries(needVerifyList)
    const maxConcurrent = 10
    let nextIndex = 0

    if(timeout) {
      abortTimeout.current = setTimeout(() => {
        abort()
        if(abortTimeout.current)
          clearTimeout(abortTimeout.current)
        abortTimeout.current = null
        isAbort.current = true
      }, timeout)
    }

    const addNewTask = () => {
      if (isAbort.current || nextIndex >= entries.length)
        return null

      const [key, value] = entries[nextIndex++]
      const _value = value as InterfaceModelConfig
      const _key = _value.apiKey ?? _value.baseURL

      const controller = new AbortController()
      controllers.current.add(controller)

      const task = verifyModel(_value, controller.signal)
        .then(verifyResult => {
          const verifiedList = allVerifiedList[_key as string] ?? {}
          verifiedList[_value.model as string] = verifyResult
          allVerifiedList[_key as string] = verifiedList
          setAllVerifiedList({...allVerifiedList})
          const _detail = [...detail.current]
          _detail.find(item => item.name === _value.model)!.detail = verifyResult ?? {success: false}
          _detail.find(item => item.name === _value.model)!.status = getVerifyStatus(verifyResult ?? {success: false})
          detail.current = _detail
          onUpdate?.(detail.current)
        })
        .catch(error => {
          const _detail = [...detail.current]
          const _detailItem = _detail.find(item => item.name === _value.model)!
          if (error.name === "AbortError") {
            _detailItem.status = "abort"
          } else {
            _detailItem.status = "error"
            _detailItem.detail = error.message
          }
          detail.current = _detail
          onUpdate?.(detail.current)
        })
        .finally(() => {
          controllers.current.delete(controller)
          pending.current.delete(task)
          const newTask = addNewTask()
          if (newTask) {
            pending.current.add(newTask)
          }
        })

      return task
    }

    while (!isAbort.current && pending.current.size < maxConcurrent && nextIndex < entries.length) {
      pending.current.add(addNewTask()!)
    }

    while (!isAbort.current && pending.current.size > 0) {
      await Promise.race(Array.from(pending.current))
    }

    if(!isAbort.current) {
      await onComplete()
    } else {
      await onAbort?.()
    }
    isAbort.current = false
  }

  const abort = () => {
    detail.current = []
    isAbort.current = true
    pending.current = new Set()
    controllers.current.forEach(controller => {
      controller.abort()
    })
    controllers.current = new Set()
    if(abortTimeout.current)
      clearTimeout(abortTimeout.current)
    abortTimeout.current = null
  }

  return { verify, abort }
}

const verifyModel = async (modelConfig: InterfaceModelConfig, signal?: AbortSignal) => {
  try {
    return await verifyModelWithConfig(modelConfig, signal)
  } catch (error) {
    console.error("Failed to verify model:", error)
    return false
  }
}

export const getVerifyStatus = (data: any) => {
  if(data === "ignore") {
    return "ignore"
  }else if(data && data.connecting && data.connecting.success && data.supportTools && data.supportTools.success) {
    return "success"
  }else if(data && data.connecting && data.connecting.success && !(data.supportTools && data.supportTools.success) && data.supportToolsInPrompt && data.supportToolsInPrompt.success) {
    return "successInPrompt"
  }else if(data && data.connecting && data.connecting.success && !(data.supportTools && data.supportTools.success) && !(data.supportToolsInPrompt && data.supportToolsInPrompt.success)) {
    return "unSupportTool"
  }else if(data && data.connecting && !data.connecting.success) {
    return "unSupportModel"
  }else if(data && !data.success) {
    return "unSupportTool"
  }

  return "unVerified"
}