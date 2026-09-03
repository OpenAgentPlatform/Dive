## MCP Setup Options

Dive offers two ways to access MCP tools: **OAP Cloud Services** (recommended for beginners) and **Local MCP Servers** (for advanced users).

### Option 1: Local MCP Servers 🛠️

For advanced users who prefer local control. The system comes with a default echo MCP Server, and you can add more powerful tools like Fetch and Youtube-dl.

![Set MCP](./docs/ToolsManager.png)

### Option 2: OAP Cloud Services ☁️

The easiest way to get started! Access enterprise-grade MCP tools instantly:

1.  **Sign up** at [OAPHub.ai](https://oaphub.ai/)
2.  **Connect** to Dive using one-click deep links or configuration files
3.  **Enjoy** managed MCP servers with zero setup - no Python, Docker, or complex dependencies required

Benefits:
- ✅ Zero configuration needed
- ✅ Cross-platform compatibility
- ✅ Enterprise-grade reliability
- ✅ Automatic updates and maintenance

#### Quick Local Setup

Add this JSON configuration to your Dive MCP settings to enable local tools:

```json
 "mcpServers":{
    "fetch": {
      "command": "uvx",
      "args": [
        "mcp-server-fetch",
        "--ignore-robots-txt"
      ],
      "enabled": true
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/allowed/files"
      ],
      "enabled": true
    },
    "youtubedl": {
      "command": "npx",
      "args": [
        "@kevinwatt/yt-dlp-mcp"
      ],
      "enabled": true
    }
  }
```

#### Using Streamable HTTP for Cloud MCP Services

You can connect to external cloud MCP servers via Streamable HTTP transport. Here's the Dive configuration example for SearXNG service from OAPHub:

```json
{
  "mcpServers": {
    "SearXNG_MCP_Server": {
      "transport": "streamable",
      "url": "https://proxy.oaphub.ai/v1/mcp/181672830075666436",
      "headers": {
        "Authorization": "GLOBAL_CLIENT_TOKEN"
      }
    }
  }
}
```

Reference: [@https://oaphub.ai/mcp/181672830075666436](https://oaphub.ai/mcp/181672830075666436)

#### Using SSE Server (Non-Local MCP)

You can also connect to external MCP servers (not local ones) via SSE (Server-Sent Events). Add this configuration to your Dive MCP settings:

```json
{
  "mcpServers": {
    "MCP_SERVER_NAME": {
      "enabled": true,
      "transport": "sse",
      "url": "YOUR_SSE_SERVER_URL"
    }
  }
}
```

#### Web Search with You.com

You.com hosts a remote MCP server for web search and URL content extraction, so no local process or extra dependency is needed — connect via Streamable HTTP like any other cloud MCP service.

For basic keyless search, use the free profile (no signup or API key required) — it exposes the `you-search` tool:

```json
{
  "mcpServers": {
    "you": {
      "transport": "streamable",
      "url": "https://api.you.com/mcp?profile=free"
    }
  }
}
```

With an API key from [you.com/platform/api-keys](https://you.com/platform/api-keys) you get the full toolset (`you-search`, `you-contents`, `you-research`):

```json
{
  "mcpServers": {
    "you": {
      "transport": "streamable",
      "url": "https://api.you.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_YDC_API_KEY"
      }
    }
  }
}
```

Once connected, the web search tools appear in the Tools Manager alongside your other MCP tools, and the agent can use them whenever a question needs current information from the web.

#### Additional Setup for yt-dlp-mcp

yt-dlp-mcp requires the yt-dlp package. Install it based on your operating system:

#### Windows

```bash
winget install yt-dlp
```

#### MacOS

```bash
brew install yt-dlp
```

#### Linux

```bash
pip install yt-dlp
```
