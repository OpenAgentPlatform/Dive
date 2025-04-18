import Store from "electron-store"

export const preferencesStore = new Store({
  name: "preferences",
  defaults: {
    autoLaunch: false,
    minimalToTray: false,
  }
})