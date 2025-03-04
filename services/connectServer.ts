import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { EventSource } from "eventsource";
import { SystemCommandManager } from "./syscmd/index.js";
import logger from "./utils/logger.js";
import { iServerConfig } from "./utils/types.js";

// add EventSource to global scope
if (typeof globalThis.EventSource === "undefined") {
  globalThis.EventSource = EventSource as any;
}

// Connect to specified server
export async function handleConnectToServer(serverName: string, serverConfig: iServerConfig, allSpecificEnv: any) {
  logger.debug(`============`);
  logger.debug(`Runtime Platform: ${process.platform}`);
  logger.debug(`Attempting to connect to server: ${serverName}`);

  // choose different transport implementation based on transport type
  let transport;
  let tempClient;

  if (serverConfig.transport === "sse" && serverConfig.url) {
    logger.debug(`Using SSE transport with URL: ${serverConfig.url}`);
    const SSE_CONNECTION_TIMEOUT = 10000; // 10 seconds

    if (serverConfig.command){
      const command = SystemCommandManager.getInstance().getValue(serverConfig.command) || serverConfig.command;
      const allSpecificEnv_ =
        process.platform === "win32" ? { ...allSpecificEnv, PYTHONIOENCODING: "utf-8" } : allSpecificEnv;
      const defaultEnv = getDefaultEnvironment();
      const tempTransport = new StdioClientTransport({
        command: command!,
        args: serverConfig.args || [],
        env: { ...defaultEnv, ...allSpecificEnv_ },
      });
      tempClient = new Client({ name: "mcp-client", version: "1.0.0" }, { capabilities: {} });
      await tempClient.connect(tempTransport);
    }

    try {
      const url = new URL(serverConfig.url);
      transport = new SSEClientTransport(url);
      const connectionTimeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`SSE connection timed out after ${SSE_CONNECTION_TIMEOUT}ms`));
        }, SSE_CONNECTION_TIMEOUT);
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          setImmediate(resolve);
        }),
        connectionTimeoutPromise,
      ]);

      logger.debug(`SSE transport created successfully for URL: ${serverConfig.url}`);
    } catch (error) {
      logger.error(`Failed to create SSE transport: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  } else if (serverConfig.transport === "websocket" && serverConfig.url) {
    logger.debug(`Using WebSocket transport with URL: ${serverConfig.url}`);
    const WS_CONNECTION_TIMEOUT = 10000; // 10 seconds

    try {
      const url = new URL(serverConfig.url);
      transport = new WebSocketClientTransport(url);
      const connectionTimeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`WebSocket connection timed out after ${WS_CONNECTION_TIMEOUT}ms`));
        }, WS_CONNECTION_TIMEOUT);
      });

      await Promise.race([
        new Promise<void>((resolve) => {
          setImmediate(resolve);
        }),
        connectionTimeoutPromise,
      ]);

      logger.debug(`WebSocket transport created successfully for URL: ${serverConfig.url}`);
    } catch (error) {
      logger.error(`Failed to create WebSocket transport: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  } else if (serverConfig.transport === "command" && serverConfig.command) {
    // use stdio transport
    // Check specific command 'node'
    const command = SystemCommandManager.getInstance().getValue(serverConfig.command) || serverConfig.command;
    const allSpecificEnv_ =
      process.platform === "win32" ? { ...allSpecificEnv, PYTHONIOENCODING: "utf-8" } : serverConfig.env;
    const defaultEnv = getDefaultEnvironment();

    // Establish transport
    transport = new StdioClientTransport({
      command: command,
      args: serverConfig.args || [],
      env: { ...defaultEnv, ...allSpecificEnv_ },
    });

    // Debug logs
    logger.debug(`Using Stdio transport with command: ${command} ${serverConfig.args?.join(" ") || ""}`);
    serverConfig.env && logger.debug(`Environment: ${JSON.stringify(serverConfig.env, null, 2)}`);
  } else {
    throw new Error(`Invalid transport configuration for server ${serverName}`);
  }

  logger.debug("Working directory:", process.cwd());

  try {
    // Establish Client
    const client = new Client({ name: "mcp-client", version: "1.0.0" }, { capabilities: {} });

    await client.connect(transport);

    // List MCP-Server available tools
    const response = await client.listTools();
    const tools = response.tools;
    logger.info(`Connected to server ${serverName} with tools: [${tools.map((tool) => tool.name).join(", ")}]`);

    return { client, transport, tempClient };
  } catch (error) {
    logger.error(`Error connecting to server ${serverName}: ${error}`);
    logger.error(`Server config: ${JSON.stringify(serverConfig, null, 2)}`);
    throw error;
  }
}
