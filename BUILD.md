## Table of Contents Build Dive

- [Development Requirements](#development-requirements)
- [Development](#development)
  - [Clone Repository](#clone-repository)
  - [Update Repository](#update-repository)
  - [Install dependencies](#install-dependencies)
  - [Start development server](#start-development-server)
  - [Development Configuration](#development-configuration)
- [Build for production](#build-for-production)
  - [Cross-platform Build for Windows](#cross-platform-build-for-windows)
- [Scripts](#scripts)
- [Package Scripts](#package-scripts)
- [MCP Server Setup](#mcp-server-setup)
  - [1. Add New MCP Server via GUI](#1-add-new-mcp-server-via-gui)
  - [2. Edit config.json directly](#2-edit-configjson-directly)
  - [3. Using Config Editor](#3-using-config-editor)
  - [4. Custom Scripts](#4-custom-scripts)
- [Project Architecture](#project-architecture)

## Development Requirements

- Node.js LTS+
- [uv](https://github.com/astral-sh/uv) (for run mcp client)

## Development

### Clone Repository

```bash
git clone --recurse-submodules https://github.com/OpenAgentPlatform/Dive.git
cd Dive
```

### Update Repository

```bash
git pull
git submodule update --init --recursive
```

### Install dependencies

```bash
npm install
```

Navigate to mcp-host directory and sync dependencies for mcp host:
```bash
cd mcp-host
uv sync
```

### Start development server

```bash
npm run dev
```

### Development Configuration

When running Dive in development mode, the configuration file will be automatically generated in the `.config` directory of your project root. This is different from the production environment where configuration files are stored in the user's home directory.

This allows developers to have separate configurations for development and production environments, making it easier to test different MCP server setups without affecting the production configuration.

To access or modify the development configuration:
```
/path/to/project/.config/mcp_config.json
/path/to/project/.config/command_alias.json
/path/to/project/.config/model_config.json
/path/to/project/.config/dive_httpd.json
/path/to/project/.config/customrules
```

## Build for production

```bash
npm run package
```

### Cross-platform Build for Windows

If you are on macOS or Linux and want to build for Windows:

1. Download Windows binaries
```bash
npm run download:windows-bin
```

2. Build using Docker
```bash
./scripts/docker/build-win.sh
```

## Scripts

- `dev` - Start Electron development server
- `build` - Build Electron application

## Package Scripts

- `package` - Create application directory
- `package:windows` - Create Windows distributable package
- `package:linux` - Create Linux distributable package
- `docker:build-win` - Build Windows version using Docker

## MCP Server Setup

After first launch, you can find the `config.json` file in these locations:

- macOS: `~/.dive/config`
- Windows: `%USERPROFILE%\.dive\config`
- Linux: `~/.dive/config`

There are four ways to configure MCP servers:

### 1. Add New MCP Server via GUI

1. Click the menu button in the top-left corner to open the sidebar
2. Click "MCP Server Management" at the bottom
3. Click the "Add MCP Server" button
4. Paste your MCP server configuration in JSON format
5. Click "Save" to add the new server

Example configuration:
```json
{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"]
    }
  }
}
```

### 2. Edit config.json directly

You can edit the `config.json` file directly in the above locations following each MCP server's documentation.

### 3. Using Config Editor

1. Click the menu button in the top-left corner to open the sidebar
2. Click "MCP Server Management" at the bottom
3. Click the "Edit Config" button on the page

### 4. Custom Scripts

You can add your own MCP server scripts in the `.dive/scripts` directory in your home folder, then update the `config.json` accordingly.

Example:

1. Create a new file `echo.js` in `~/.dive/scripts`
2. Update `config.json`:

```json
{
  "mcpServers": {
    "echo": {
      "enabled": true,
      "command": "node",
      "args": [
        "echo.js"
      ]
    }
  }
}
```

## Project Architecture

```
src/
├── atoms/              # Global state management
│   ├── configState.ts    # Model configuration state
│   ├── interfaceState.ts # UI interface state
│   └── historyState.ts   # Chat history state
│
├── components/         # Reusable UI components
│   ├── ModelConfigForm  # Model settings form
│   ├── Toast           # Toast notifications
│   └── Header          # App header
│
├── views/             # Page components
│   ├── Chat/           # Chat interface
│   ├── Setup/          # Initial setup
│   └── Welcome/        # Welcome page
│
├── styles/            # SCSS stylesheets
│   ├── components/     # Component styles
│   └── pages/         # Page-specific styles
│
└── hooks/             # Custom React hooks

electron/
├── main/             # Main process
│   └── index.ts       # Main entry
└── preload/          # Preload scripts
    └── index.ts       # Bridge between main and renderer

mcp-host              # git submodule for [dive-mcp-host](https://github.com/OpenAgentPlatform/dive-mcp-host)
```
