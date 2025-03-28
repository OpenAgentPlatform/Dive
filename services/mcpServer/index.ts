import { ToolDefinition } from "@langchain/core/language_models/base";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import path from "path";
import { handleConnectToServer } from "../connectServer.js";
import { SystemCommandManager } from "../syscmd/index.js";
import logger from "../utils/logger.js";
import { convertToOpenAITools, loadConfigAndServers } from "../utils/toolHandler.js";
import { iServerConfig, iTool } from "../utils/types.js";
import { IMCPServerManager } from "./interface.js";

export class MCPServerManager implements IMCPServerManager {
  private static instance: MCPServerManager;
  private servers: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport | SSEClientTransport | WebSocketClientTransport> = new Map();
  private toolToServerMap: Map<string, Client> = new Map();
  private availableTools: ToolDefinition[] = [];
  private toolInfos: iTool[] = [];
  // SSE/Websocket 開起來的Client
  private tempClients: Map<string, Client> = new Map();
  public configPath: string;

  private constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), "config.json");
  }

  public static getInstance(configPath?: string): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager(configPath);
    } else if (configPath && configPath !== MCPServerManager.instance.configPath) {
      // If a new config path is provided and different from current, update config and reinitialize
      MCPServerManager.instance.configPath = configPath;
      MCPServerManager.instance.initialize().catch((error) => {
        logger.error("Failed to reinitialize MCPServerManager:", error);
      });
    }
    return MCPServerManager.instance;
  }

  async initialize(): Promise<void> {
    // Clear all states
    this.servers.clear();
    this.transports.clear();
    this.toolToServerMap.clear();
    this.availableTools = [];
    this.toolInfos = [];
    this.tempClients.clear();

    // Load and connect all servers
    await this.connectAllServers();
  }

  async connectAllServers(): Promise<{ serverName: string; error: unknown }[]> {
    const errorArray: { serverName: string; error: unknown }[] = [];
    const { config, servers } = await loadConfigAndServers(this.configPath);
    // only connect enabled servers
    const enabledServers = Object.keys(config.mcpServers).filter((serverName) => config.mcpServers[serverName].enabled);
    logger.info(`Connect to ${enabledServers.length} enabled servers...`);

    const allEnabledSpecificEnv = enabledServers.reduce((acc, serverName) => {
      return { ...acc, ...config.mcpServers[serverName].env };
    }, {});

    // async connect all servers
    const connectionResults = await Promise.allSettled(
      enabledServers.map((serverName) =>
        this.connectSingleServer(serverName, config.mcpServers[serverName], allEnabledSpecificEnv)
      )
    );

    // collect error
    connectionResults.forEach((result) => {
      if (result.status === "rejected") {
        errorArray.push({
          serverName: "unknown",
          error: result.reason,
        });
      } else if (!result.value.success) {
        errorArray.push({
          serverName: result.value.serverName,
          error: result.value.error,
        });
      }
    });

    logger.info("Connect all MCP servers completed");
    logger.info("All available tools:");
    for (const [serverName, client] of this.servers) {
      const toolInfo = this.toolInfos.find((info) => info.name === serverName);
      if (toolInfo?.enabled) {
        logger.info(`${serverName}:`);
        toolInfo.tools.forEach((tool) => {
          logger.info(`  - ${tool.name}`);
        });
      }
    }

    return errorArray;
  }

  async connectSingleServer(
    serverName: string,
    config: iServerConfig,
    allSpecificEnv: any
  ): Promise<{ success: boolean; serverName: string; error?: unknown }> {
    try {
      const updatedConfig = { ...config };
      if (!updatedConfig.transport) {
        updatedConfig.transport = "command";
        logger.debug(`No transport specified for server ${serverName}, defaulting to "command" transport`);
      }

      const { client, transport, tempClient } = await handleConnectToServer(serverName, updatedConfig, allSpecificEnv);
      this.servers.set(serverName, client);
      this.transports.set(serverName, transport);
      tempClient && this.tempClients.set(serverName, tempClient)

      // Load server tools and capabilities
      const response = await client.listTools();
      const capabilities = await client.getServerCapabilities();

      // Create tool information
      const tools_ = response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      }));

      // Update toolInfos
      this.toolInfos.push({
        name: serverName,
        description: (capabilities?.description as string) || "",
        tools: tools_,
        enabled: config.enabled || false,
        icon: (capabilities?.icon as string) || "",
      });

      // Load tools if server is enabled
      if (config.enabled) {
        const langChainTools = convertToOpenAITools(response.tools);
        this.availableTools.push(...langChainTools);

        // Record tool to server mapping
        response.tools.forEach((tool) => {
          this.toolToServerMap.set(tool.name, client);
        });
      }

      return {
        success: true,
        serverName,
      };
    } catch (error: any) {
      return {
        success: false,
        serverName,
        error: error.message,
      };
    }
  }

  async syncServersWithConfigForce(): Promise<{ serverName: string; error: unknown }[]> {
    logger.info("Syncing servers with configuration...");
    let errorArray: { serverName: string; error: unknown }[] = [];
    await this.disconnectAllServers();
    errorArray = await this.connectAllServers();
    return errorArray;
  }

  async syncServersWithConfig(): Promise<{ serverName: string; error: unknown }[]> {
    logger.info("Syncing servers with configuration...");
    const errorArray: { serverName: string; error: unknown }[] = [];

    try {
      // Get configuration differences
      const { config: newConfig } = await loadConfigAndServers(this.configPath);
      const currentServers = new Set(this.servers.keys());
      const configuredServers = new Set(Object.keys(newConfig.mcpServers || {}));

      // Handle servers to be removed
      for (const serverName of currentServers) {
        if (!configuredServers.has(serverName)) {
          logger.info(`Removing server: ${serverName}`);
          await this.disconnectSingleServer(serverName);
        }
      }

      // Handle new or updated servers
      for (const serverName of configuredServers) {
        const serverConfig = newConfig.mcpServers[serverName];

        if (!currentServers.has(serverName)) {
          // New server
          logger.info(`Adding new server: ${serverName}`);
          const result = await this.connectSingleServer(serverName, serverConfig, {});
          if (!result.success) {
            errorArray.push({
              serverName,
              error: result.error,
            });
          }
        } else {
          // Existing server, check properties
          // check command, args(string[]), env(Record<string, string>)
          const isPropertiesChanged = this.checkPropertiesChanged(serverName, serverConfig);
          if (isPropertiesChanged) {
            logger.info(`Properties changed for server: ${serverName}`);
            await this.disconnectSingleServer(serverName);
            const result = await this.connectSingleServer(serverName, serverConfig, {});
            if (!result.success) {
              errorArray.push({
                serverName,
                error: result.error,
              });
            }
          } else {
            // check enabled
            const isCurrentlyEnabled = this.toolInfos.find((info) => info.name === serverName)?.enabled;
            if (serverConfig.enabled && !isCurrentlyEnabled) {
              logger.info(`Enabling server: ${serverName}`);
              await this.updateServerEnabledState(serverName, true);
            } else if (!serverConfig.enabled && isCurrentlyEnabled) {
              logger.info(`Disabling server: ${serverName}`);
              await this.updateServerEnabledState(serverName, false);
            }
          }
        }
      }

      logger.info("Server configuration sync completed");
      return errorArray;
    } catch (error) {
      logger.error("Error during server configuration sync:", error);
      throw error;
    }
  }

  async disconnectSingleServer(serverName: string): Promise<void> {
    try {
      const client = this.servers.get(serverName);
      if (client) {
        // Get tools list before disconnecting
        try {
          const response = await client.listTools();
          const toolsToRemove = new Set(response.tools.map((tool) => tool.name));

          // Remove tools from availableTools
          this.availableTools = this.availableTools.filter((tool) => !toolsToRemove.has(tool.function.name));

          // Clean up tool to server mapping
          toolsToRemove.forEach((toolName) => {
            this.toolToServerMap.delete(toolName);
          });
        } catch (error) {
          logger.error(`Error getting tools list for server ${serverName}:`, error);
        }

        // Close transport and clean up server
        const transport = this.transports.get(serverName);
        if (transport) {
          await transport.close();
        }
        const tempClient = this.tempClients.get(serverName)
        if (tempClient){
          await tempClient.close()
        }
        this.transports.delete(serverName);
        this.servers.delete(serverName);

        // Remove from toolInfos
        this.toolInfos = this.toolInfos.filter((info) => info.name !== serverName);

        logger.info(`Server ${serverName} disconnected`);
      }
    } catch (error) {
      logger.error(`Error disconnecting server ${serverName}:`, error);
    }
  }

  async updateServerEnabledState(serverName: string, enabled: boolean): Promise<void> {
    // Update enabled status in tool info
    const toolInfo = this.toolInfos.find((info) => info.name === serverName);
    if (!toolInfo) {
      logger.warn(`Cannot update state for server ${serverName}: tool info not found`);
      return;
    }
    toolInfo.enabled = enabled;

    // Get all tool names for this server
    const serverTools = new Set(toolInfo.tools.map((tool) => tool.name));

    // Update availableTools
    if (enabled) {
      // If enabling, add server's tools to availableTools
      const client = this.servers.get(serverName);
      if (client) {
        const response = await client.listTools();
        const langChainTools = convertToOpenAITools(response.tools);
        this.availableTools.push(...langChainTools);
      }
    } else {
      // If disabling, remove server's tools from availableTools
      this.availableTools = this.availableTools.filter((tool) => !serverTools.has(tool.function.name));
    }
  }

  checkPropertiesChanged(serverName: string, config: iServerConfig) {
    const client = this.servers.get(serverName);
    if (!client) return true;
    const currentParams = (client?.transport as any)._serverParams as iServerConfig;

    // check transport type changed
    if (currentParams.transport !== config.transport) return true;

    // if command transport, check command, args and env
    if (config.transport === "command" && currentParams.transport === "command") {
      const currentCommand = currentParams.command || "";
      const newCommand = SystemCommandManager.getInstance().getValue(config.command || "") || config.command || "";
      const currentArgs = currentParams.args || [];
      const newArgs = config.args || [];

      return (
        currentCommand !== newCommand ||
        currentArgs.join(",") !== newArgs.join(",") ||
        JSON.stringify(currentParams.env) !== JSON.stringify(config.env)
      );
    }

    // if sse or websocket transport, check url
    if (
      (config.transport === "sse" || config.transport === "websocket") &&
      (currentParams.transport === "sse" || currentParams.transport === "websocket")
    ) {
      return currentParams.url !== config.url;
    }

    return false;
  }

  getAvailableTools(): ToolDefinition[] {
    return this.availableTools;
  }

  getToolInfos(): iTool[] {
    return this.toolInfos;
  }

  getToolToServerMap(): Map<string, Client> {
    return this.toolToServerMap;
  }

  async disconnectAllServers(): Promise<void> {
    logger.info("Disconnect all MCP servers...");
    for (const serverName of this.servers.keys()) {
      const transport = this.transports.get(serverName);
      if (transport) {
        await transport.close();
      }
    }
    for (const serverName of this.tempClients.keys()){
      logger.debug(`[${serverName}] Disconnecting temp client`);
      const client = this.tempClients.get(serverName)
      if (client){
        await client.close()
      }
    }
    this.servers.clear();
    this.transports.clear();
    this.toolToServerMap.clear();
    this.availableTools = [];
    this.toolInfos = [];
    logger.info("Disconnect all MCP servers completed");
  }

  // async reconnectServers(): Promise<{ serverName: string; error: unknown }[]> {
  //   logger.info("Reconnect all MCP servers...");
  //   await this.disconnectAllServers();
  //   const errorArray = await this.connectAllServers();
  //   logger.info("Reconnect all MCP servers completed");
  //   return errorArray;
  // }
}
