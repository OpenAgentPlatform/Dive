import { ModelConfig } from "./atoms/configState"


export const getModelPrefix = (config: ModelConfig, length: number = 5) => {
  if (config.apiKey)
    return config.apiKey.slice(-length)

  if ((config as any).accessKeyId)
    return (config as any).accessKeyId.slice(-length)


  try {
    if(config.baseURL) {
      const url = new URL(config.baseURL)
      return url.hostname.slice(0, length)
    }
  } catch (error) {
    return config.baseURL
  }
  return ""
}

export function safeBase64Encode(str: string): string {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode(parseInt(p1, 16))))
  } catch (e) {
    console.error("Encoding error:", e)
    return ""
  }
}

export function safeBase64Decode(str: string): string {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str),
      c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""))
  } catch (e) {
    console.error("Decoding error:", e)
    return str
  }
}