import { Anthropic } from "@anthropic-ai/sdk"
import { ipcMain, BrowserWindow } from "electron"
import { Ollama } from "ollama"
import OpenAI from "openai"

export function ipcLlmHandler(win: BrowserWindow) {
  ipcMain.handle("llm:openaiModelList", async (_, apiKey: string) => {
    try {
      const client = new OpenAI({ apiKey })
      const models = await client.models.list()
      return models.data.map((model) => model.id)
    } catch (error) {
      return []
    }
  })

  ipcMain.handle("llm:anthropicModelList", async (_, apiKey: string, baseURL: string) => {
    try {
      const client = new Anthropic({ apiKey, baseURL })
      const models = await client.models.list()
      return models.data.map((model) => model.id)
    } catch (error) {
      return []
    }
  })

  ipcMain.handle("llm:ollamaModelList", async (_, baseURL: string) => {
    try {
      const ollama = new Ollama({ host: baseURL })
      const list = await ollama.list()
      return list.models.map((model) => model.name)
    } catch (error) {
      return []
    }
  })

  ipcMain.handle("llm:openaiCompatibleModelList", async (_, apiKey: string, baseURL: string) => {
    try {
      const client = new OpenAI({ apiKey, baseURL })
      const list = await client.models.list()
      return list.data.map((model) => model.id)
    } catch (error) {
      return []
    }
  })
}