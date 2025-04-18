import { rmSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'
import jotaiDebugLabel from 'jotai/babel/plugin-debug-label'
import jotaiReactRefresh from 'jotai/babel/plugin-react-refresh'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function getMcpHostCommitHash() {
  try {
    return execSync('git -C mcp-host rev-parse HEAD', { cwd: path.dirname(fileURLToPath(import.meta.url)) }).toString().trim()
  } catch (error) {
    return 'unknown'
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  rmSync('dist-electron', { recursive: true, force: true })

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    build: {
      target: 'esnext',
    },
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src'),
        '@codemirror/state': path.resolve(
          __dirname,
          './node_modules/@codemirror/state/dist/index.js'
        ),
        '@codemirror/view': path.resolve(
          __dirname,
          './node_modules/@codemirror/view/dist/index.js'
        ),
        '@codemirror/lint': path.resolve(
          __dirname,
          './node_modules/@codemirror/lint/dist/index.js'
        ),
        '@codemirror/lang-json': path.resolve(
          __dirname,
          './node_modules/@codemirror/lang-json/dist/index.js'
        ),
        '@codemirror/linter': path.resolve(
          __dirname,
          './node_modules/@codemirror/linter/dist/index.js'
        ),
        '@codemirror/theme-one-dark': path.resolve(
          __dirname,
          './node_modules/@codemirror/theme-one-dark/dist/index.js'
        ),
        '@codemirror/autocomplete': path.resolve(
          __dirname,
          './node_modules/@codemirror/autocomplete/dist/index.js'
        ),
        '@codemirror/commands': path.resolve(
          __dirname,
          './node_modules/@codemirror/commands/dist/index.js'
        ),
        '@codemirror/language': path.resolve(
          __dirname,
          './node_modules/@codemirror/language/dist/index.js'
        ),
        '@codemirror/search': path.resolve(
          __dirname,
          './node_modules/@codemirror/search/dist/index.js'
        ),
        '@uiw/react-codemirror': path.resolve(
          __dirname,
          'node_modules/@uiw/react-codemirror/esm/index.js',
        ),
        '@uiw/codemirror-extensions-basic-setup': path.resolve(
          __dirname,
          'node_modules/@uiw/codemirror-extensions-basic-setup/esm/index.js'
        ),
      },
    },
    plugins: [
      react({babel: { plugins: [jotaiDebugLabel, jotaiReactRefresh] }}),
      electron({
        main: {
          // Shortcut of `build.lib.entry`
          entry: 'electron/main/index.ts',
          onstart(args) {
            if (process.env.VSCODE_DEBUG) {
              console.log(/* For `.vscode/.debug.script.mjs` */'[startup] Electron App')
            } else {
              args.startup(['.'])
            }
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
              },
            },
            define: {
              'process.env.MCP_HOST_COMMIT_HASH': JSON.stringify(getMcpHostCommitHash()),
            },
            server: {
              watch: {
                ignored: ["**/mcp-host/**"],
              },
            }
          },
        },
        preload: {
          // Shortcut of `build.rollupOptions.input`.
          // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined, // #332
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
              },
            },
            server: {
              watch: {
                ignored: ["**/mcp-host/**"],
              },
            }
          },
        },
        // Ployfill the Electron and Node.js API for Renderer process.
        // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
        // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
        renderer: {},
      }),
    ],
    server: process.env.VSCODE_DEBUG ? (() => {
      const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
      return {
        host: url.hostname,
        port: +url.port,
        watch: {
          ignored: ["**/mcp-host/**"],
          exclude: ["**/mcp-host/**"],
        },
      }
    })() : undefined,
    clearScreen: false,
  }
})
