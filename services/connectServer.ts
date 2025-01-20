import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import logger from "./utils/logger.js";
import { iServerConfig } from "./utils/types.js";

// Connect to specified server
export async function handleConnectToServer(
  serverName: string,
  serverConfig: iServerConfig
) {
  logger.debug(`============`);
  logger.debug(`Attempting to connect to server: ${serverName}`);

  // Check specific command 'node'
  if (serverConfig.command === "node") {
    serverConfig.command = process.execPath; // This will use the full path of the current Node.js process
  }

  // Establish transport
  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
    env: serverConfig.env,
  });

  // Debug logs
  logger.debug(
    `Executing command: ${serverConfig.command} ${serverConfig.args.join(" ")}`
  );
  serverConfig.env && logger.debug(`Environment: ${JSON.stringify(serverConfig.env, null, 2)}`);
  logger.debug("Working directory:", process.cwd());

  try {
    // Establish Client
    const client = new Client(
      { name: "mcp-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);

    // List MCP-Server available tools
    const response = await client.listTools();
    const tools = response.tools;
    logger.info(
      `Connected to server ${serverName} with tools: [${tools
        .map((tool) => tool.name)
        .join(", ")}]`
    );

    return { client, transport };
  } catch (error) {
    logger.error(`Error connecting to server ${serverName}: ${error}`);
    logger.error(`Server config: ${JSON.stringify(serverConfig, null, 2)}`);
    throw error;
  }
}

