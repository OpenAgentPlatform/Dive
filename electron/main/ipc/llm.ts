import { Anthropic } from "@anthropic-ai/sdk"
import { ipcMain, BrowserWindow } from "electron"
import { Ollama } from "ollama"
import OpenAI from "openai"
import { Mistral } from "@mistralai/mistralai"
import {
  BedrockClient,
  ListFoundationModelsCommand,
} from "@aws-sdk/client-bedrock"

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

  ipcMain.handle("llm:googleGenaiModelList", async (_, apiKey: string) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      const response = await fetch(url)
      const data = await response.json() as { models: { name: string }[] }
      return data.models.map((model) => model.name)
    } catch (error) {
      return []
    }
  })

  ipcMain.handle("llm:mistralaiModelList", async (_, apiKey: string) => {
    try {
      const client = new Mistral({ apiKey })
      const models = await client.models.list()
      return models.data?.map((model) => model.id) ?? []
    } catch (error) {
      return []
    }
  })

  ipcMain.handle("llm:bedrockModelList", async (_, accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string) => {
    try {
      let modelPrefix = ""
      if (region.startsWith("us-")) {
        modelPrefix = "us."
      } else if (region.startsWith("eu-")) {
        modelPrefix = "eu."
      } else if (region.startsWith("ap-")) {
        modelPrefix = "apac."
      }

      const client = new BedrockClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
          sessionToken,
        }
      })
      const command = new ListFoundationModelsCommand({})
      const response = await client.send(command)
      const models = response.modelSummaries
      return models?.map((model) => `${modelPrefix}${model.modelId}`) ?? []
    } catch (error) {
      console.error(error)
      return []
    }
  })
}
