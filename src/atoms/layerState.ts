import { atom } from "jotai"
import mitt from "mitt"

export type OverlayType = "Tools" | "System" | "Model"
export type LayerType = {
  type: "Overlay" | "Modal" | "Sidebar" | "Surface"
  id: string
}

export type LayerEvent = "popped"
export const emitter = mitt<Record<LayerEvent, LayerType>>()

export const layersStackAtom = atom<LayerType[]>([])

export const pushLayerAtom = atom(
  null,
  (get, set, layer: LayerType) => {
    const currentLayers = get(layersStackAtom)
    const index = currentLayers.findIndex((l) => l.id === layer.id)
    if (index !== -1) {
      currentLayers.splice(index, 1)
    }
    set(layersStackAtom, [...currentLayers, layer])
  }
)

export const popLayerAtom = atom(
  null,
  (get, set) => {
    const currentLayers = get(layersStackAtom)
    const lastLayer = currentLayers.pop()
    set(layersStackAtom, currentLayers)
    
    if (lastLayer?.type === "Overlay") {
      set(closeOverlayAtom, lastLayer.id as OverlayType)
      return
    }

    if (lastLayer) {
      emitter.emit("popped", lastLayer)
    }
  }
)

export const closeLayerAtom = atom(
  null,
  (get, set, id: string) => {
    const currentLayers = get(layersStackAtom)
    const filteredLayers = currentLayers.filter((l) => l.id !== id)
    set(layersStackAtom, filteredLayers)
  }
)

export const pushOverlayLayerAtom = atom(
  null,
  (get, set, id: string) => {
    set(pushLayerAtom, { type: "Overlay", id })
  }
)

export const pushModalLayerAtom = atom(
  null,
  (get, set, id: string) => {
    set(pushLayerAtom, { type: "Modal", id })
  }
)

export const pushSidebarLayerAtom = atom(
  null,
  (get, set, id: string) => {
    set(pushLayerAtom, { type: "Sidebar", id })
  }
)

export const overlaysAtom = atom<OverlayType[]>([])

export const openOverlayAtom = atom(
  null,
  (get, set, overlay: OverlayType) => {
    const currentOverlays = get(overlaysAtom)
    const filteredOverlays = currentOverlays.filter(o => o !== overlay)
    set(overlaysAtom, [...filteredOverlays, overlay])
    set(pushOverlayLayerAtom, overlay)
  }
)

export const closeOverlayAtom = atom(
  null,
  (get, set, overlay: OverlayType) => {
    const currentOverlays = get(overlaysAtom)
    const filteredOverlays = currentOverlays.filter((o) => o !== overlay)
    set(overlaysAtom, filteredOverlays)
    set(closeLayerAtom, overlay)
  }
)

export const closeAllOverlaysAtom = atom(
  null,
  (get, set) => {
    set(overlaysAtom, [])
    set(layersStackAtom, get(layersStackAtom).filter((l) => l.type !== "Overlay"))
  }
)