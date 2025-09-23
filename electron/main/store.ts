import Store from "electron-store"

export const preferencesStore = new Store({
  name: "preferences",
  defaults: {
    autoLaunch: false,
    minimalToTray: true,
  }
})

export const oapStore = new Store({
  name: "oap",
  defaults: {
    oap: {
      token: "",
    }
  }
})

export const hostCache = new Store({
  name: "host-cache",
  defaults: {
    lockHash: "",
  }
})