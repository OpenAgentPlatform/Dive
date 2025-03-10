import Store from "electron-store"

export const store = new Store({
  name: "preferences",
  defaults: {
    autoLaunch: false,
    minimalToTray: false,
  }
})