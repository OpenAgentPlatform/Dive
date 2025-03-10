import { ModelConfig } from "./atoms/configState"


export const getModelPrefix = (config: ModelConfig, length: number = 5) => {
 if(config.apiKey) return config.apiKey.slice(-length)
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