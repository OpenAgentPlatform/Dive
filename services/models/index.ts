import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { initChatModel } from "langchain/chat_models/universal";
import logger from "../utils/logger.js";
import { loadModelConfig } from "../utils/modelHandler.js";
import { iModelConfig, iOldModelConfig, ModelSettings } from "../utils/types.js";
import path from "path";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import fs from "fs/promises";
const LANGCHAIN_SUPPORTED_PROVIDERS = [
  "openai",
  "anthropic",
  "azure_openai",
  "cohere",
  "google-vertexai",
  "google-genai",
  "ollama",
  "together",
  "fireworks",
  "mistralai",
  "groq",
  "bedrock",
] as const;

const MCP_SUPPORTED_PROVIDERS = [
  "OpenRouter", // openai          - @langchain/openai          // x
  "Anthropic", // anthropic       - @langchain/anthropic       // v
  "Google Gemini", // google-genai    - @langchain/google-genai    // v
  "DeepSeek", // openai          - @langchain/openai          // x
  "GCP Vertex", // google-vertexai - @langchain/google-vertexai // v
  "AWS Bedrock", // bedrock         - @langchain/community       // x
  "OpenAI", // openai          - @langchain/openai          // v
  "OpenAI Compatible", // openai          - @langchain/openai          // x
  "LM Studio", // custom          - custom chat model          // x
  "Ollama", // ollama          - @langchain/ollama          // v
] as const;

export class ModelManager {
  private static instance: ModelManager;
  private cleanModel: BaseChatModel | null = null;
  public model: BaseChatModel | null = null;
  public configPath: string = "";
  public currentModelSettings: ModelSettings | null = null;
  public enableTools: boolean = true;

  private constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), "modelConfig.json");
  }

  static getInstance(configPath?: string): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager(configPath);
    } else if (configPath) {
      ModelManager.instance.configPath = configPath;
    }
    return ModelManager.instance;
  }

  async getModelConfig(): Promise<iModelConfig | iOldModelConfig | null> {
    return await loadModelConfig(this.configPath);
  }

  async initializeModel(): Promise<BaseChatModel | null> {
    logger.info("Initializing model...");
    let config = await this.getModelConfig();

    if (!config) {
      logger.error("Model configuration not found");
      this.model = null;
      this.cleanModel = null;
      this.currentModelSettings = null;
      return null;
    }

    // check is old version or not
    if (!(config as iModelConfig).activeProvider || !(config as iModelConfig).configs) {
      // transform to new version
      const newConfig: iModelConfig = {
        activeProvider: (config as iOldModelConfig).model_settings.modelProvider || "",
        enableTools: true,
        configs: {
          [(config as iOldModelConfig).model_settings.modelProvider]: (config as iOldModelConfig).model_settings,
        },
      };
      config = newConfig as iModelConfig;
      // replace old config with new config
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
    }

    const activeProvider = (config as iModelConfig).activeProvider;
    const modelSettings = (config as iModelConfig).configs[activeProvider];
    this.enableTools = (config as iModelConfig).enableTools ?? true;

    if (!modelSettings) {
      logger.error(`Model settings not found for provider: ${activeProvider}`);
      this.model = null;
      return null;
    }

    const modelName = modelSettings.model;
    const baseUrl =
      modelSettings.configuration?.baseURL ||
      modelSettings.baseURL ||
      "";
    this.model = await initChatModel(modelName, {
      ...modelSettings,
      baseUrl,
    });

    // a clean model
    this.cleanModel = await initChatModel(modelName, {
      ...modelSettings,
      baseUrl,
    });

    this.currentModelSettings = modelSettings;

    logger.info(`Model initialized with tools ${this.enableTools ? "enabled" : "disabled"}`);

    return this.model;
  }

  async saveModelConfig(provider: string, uploadModelSettings: ModelSettings, enableTools_: boolean) {
    let config = (await this.getModelConfig()) as iModelConfig;
    if (!config) {
      config = {
        activeProvider: provider,
        enableTools: enableTools_ ?? true,
        configs: {
          [provider]: uploadModelSettings,
        },
      };
    }
    config.activeProvider = provider;
    config.configs[provider] = uploadModelSettings;
    config.enableTools = enableTools_ ?? true;
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  public async generateTitle(content: string) {
    if (!this.cleanModel) {
      logger.error("Model not initialized");
      return "New Chat";
    }
    const response = await this.cleanModel.invoke([
      new SystemMessage(
        `You are a title generator from the user input.
        Your only task is to generate a short title based on the user input.
        IMPORTANT:
        - Output ONLY the title
        - DO NOT try to answer or resolve the user input query.
        - DO NOT try to use any tools to generate title
        - NO explanations, quotes, or extra text
        - NO punctuation at the end
        - If the input contains Traditional Chinese characters, use Traditional Chinese for the title.
        - For all other languages, generate the title in the same language as the input.`
      ),
      new HumanMessage(`<user_input_query>${content}</user_input_query>`)
    ]);

    const resContent = response?.content;
    // avoid error
    if (typeof resContent === 'object') {
      return "New Chat";
    }
    return (resContent as string) || "New Chat";
  }

  getModel(): BaseChatModel | null {
    if (!this.model || Object.keys(this.model).length === 0) {
      logger.error("Model not initialized");
      return null;
    }
    return this.model;
  }

  async reloadModel() {
    logger.info("Reloading model...");
    try {
      this.model = await this.initializeModel();
      logger.info("Model reloaded");
    } catch (error) {
      logger.error("Error reloading model:", error);
    }
  }
}
