#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import express from "express";

// Add delay function for simulating processing time
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ECHO_TOOL = {
  name: "echo",
  description:
    "A simple echo tool to verify if the MCP server is working properly. It returns a characteristic response containing the input message.",
  inputSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Message to be echoed back",
      },
      delayMs: {
        type: "number",
        description: "Optional delay in milliseconds before responding",
      },
    },
    required: ["message"],
  },
};

// Create a separate server instance for each client
// This ensures that each client has its own isolated environment
function createServer() {
  return new Server(
    {
      name: "biggo-mcp-server/echo",
      version: "0.1.0",
    },
    {
      capabilities: {
        description: "A basic MCP echo server for system operation verification",
        tools: {},
      },
    }
  );
}

// Type guard to validate echo tool arguments
function isEchoArgs(args) {
  return (
    typeof args === "object" &&
    args !== null &&
    "message" in args &&
    typeof args.message === "string" &&
    (!("delayMs" in args) || typeof args.delayMs === "number")
  );
}

// Set up tool handlers for the server
function setupServerHandlers(server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [ECHO_TOOL],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      if (!args) {
        throw new Error("No parameters provided");
      }

      if (name === "echo") {
        if (!isEchoArgs(args)) {
          throw new Error("Invalid echo tool parameters");
        }

        const { message, delayMs = 0 } = args;

        // If delay is specified, wait for the specified time
        // This simulates a long-running operation
        if (delayMs > 0) {
          console.log(`Delaying response for ${delayMs}ms...`);
          await delay(delayMs);
          console.log("Delay completed, sending response");
        }

        const response = `[MCP-ECHO] Received message: ${message}`;
        return {
          content: [{ type: "text", text: response }],
          isError: false,
        };
      }

      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });
}

// Run the server based on command line arguments
async function runServer() {
  const args = process.argv.slice(2);
  const useSSE = args.includes("--sse");

  // Get default delay time if specified
  const delayArg = args.find((arg) => arg.startsWith("--delay="));
  const defaultDelay = delayArg ? parseInt(delayArg.split("=")[1], 10) : 0;

  if (defaultDelay > 0) {
    console.log(`Default delay set to ${defaultDelay}ms`);
  }

  if (useSSE) {
    // Set up Express server for SSE
    const app = express();
    const PORT = process.env.PORT || 2222;

    app.use(cors());

    // Store active SSE connections
    // We use a Map to store multiple connections, each with a unique session ID
    // This allows multiple clients to connect simultaneously without interfering with each other
    const activeConnections = new Map();

    // Set up SSE endpoint
    app.get("/sse", async (req, res) => {
      // Set SSE response headers
      // These headers are required for SSE to work properly:
      // - Content-Type: text/event-stream: Tells the client this is an SSE stream
      // - Cache-Control: no-cache: Prevents caching of events
      // - Connection: keep-alive: Keeps the connection open
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Create a new server instance for this connection
      // Each client gets its own server instance to ensure isolation
      // This prevents one client's requests from affecting another client
      const serverInstance = createServer();
      setupServerHandlers(serverInstance);

      // Create a new SSE transport
      // The first parameter ("/messages") is the endpoint where clients will POST messages
      // The second parameter is the response object that will be used to send SSE events
      const transport = new SSEServerTransport("/messages", res);

      try {
        // Connect the server to the transport
        // Note: connect() automatically calls start() on the transport
        // We don't need to call transport.start() manually
        await serverInstance.connect(transport);

        // Get the session ID generated by the transport
        // This ID is used to identify this specific connection
        const sessionId = transport.sessionId;

        // Store the connection in our Map
        // This allows us to retrieve it later when handling POST requests
        activeConnections.set(sessionId, { transport, server: serverInstance });

        console.log(`New SSE connection established with session ID: ${sessionId}`);
        console.log(`Active connections: ${activeConnections.size}`);

        // Send the session ID to the client
        // This allows the client to include this ID in subsequent POST requests
        // The format "data: {...}\n\n" is required for SSE events
        res.write(`data: ${JSON.stringify({ type: "connection", sessionId })}\n\n`);
      } catch (error) {
        console.error("Error connecting SSE transport:", error);
        res.end();
        return;
      }

      // Clean up when the client disconnects
      // This is important to prevent memory leaks and resource exhaustion
      // The "close" event is fired when the client closes the connection
      req.on("close", () => {
        try {
          const sessionId = transport.sessionId;
          console.log(`Client disconnected from SSE, session ID: ${sessionId}`);

          if (activeConnections.has(sessionId)) {
            const connection = activeConnections.get(sessionId);
            // Close the transport to free up resources
            connection.transport.close().catch((err) => {
              console.error("Error closing SSE transport:", err);
            });
            // Remove the connection from our Map
            activeConnections.delete(sessionId);
            console.log(`Active connections: ${activeConnections.size}`);
          }
        } catch (error) {
          console.error("Error during cleanup:", error);
        }
      });
    });

    // Handle POST requests
    app.post("/messages", express.json(), async (req, res) => {
      console.error(`[MCP-Server][Echo] Received - ${JSON.stringify(req.body)}`);
      // Get session ID from request headers
      // Clients can specify which connection to use by including the X-Session-ID header
      const sessionId = req.headers["x-session-id"];

      // If no delay is specified in the request, use the default delay
      // This allows us to simulate processing time for all requests
      if (
        req.body &&
        req.body.params &&
        req.body.params.arguments &&
        req.body.params.name === "echo" &&
        defaultDelay > 0 &&
        !req.body.params.arguments.delayMs
      ) {
        req.body.params.arguments.delayMs = defaultDelay;
      }

      if (!sessionId) {
        // If no session ID is provided, try to use the last active connection
        // This is a convenience for simple cases where there's only one client
        if (activeConnections.size === 0) {
          res.status(400).json({ error: "No active SSE connections" });
          return;
        }

        // Get the last session ID from the Map
        // This assumes the last connection is the most recently active one
        const lastSessionId = Array.from(activeConnections.keys()).pop();
        const connection = activeConnections.get(lastSessionId);

        try {
          // Handle the POST message using the selected connection
          // We pass the request and response objects to the transport
          // The transport will handle the JSON-RPC protocol details
          await connection.transport.handlePostMessage(
            req,
            res,
            req.body
          );
        } catch (error) {
          console.error("Error handling POST message:", error);
          if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
          }
        }
        return;
      }

      // If a session ID is provided, use the corresponding connection
      const connection = activeConnections.get(sessionId);

      if (!connection) {
        res.status(400).json({ error: "No active SSE connection for this session ID" });
        return;
      }

      try {
        // Handle the POST message using the selected connection
        await connection.transport.handlePostMessage(
          req,
          res,
          req.body
        );
      } catch (error) {
        console.error("Error handling POST message:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    });

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`MCP Echo Server with SSE is running on http://localhost:${PORT}/sse`);
      console.log(`POST messages to http://localhost:${PORT}/messages`);
      console.log(`You can specify a session ID with the X-Session-ID header`);
      if (defaultDelay > 0) {
        console.log(`Default delay for all responses: ${defaultDelay}ms`);
      }
    });
  }

  // Use standard stdio transport
  const mainServer = createServer();
  setupServerHandlers(mainServer);
  const transport = new StdioServerTransport();
  await mainServer.connect(transport);
  console.log("MCP Echo Server is running with stdio transport");
  if (defaultDelay > 0) {
    console.log(`Default delay for all responses: ${defaultDelay}ms`);
  }
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});