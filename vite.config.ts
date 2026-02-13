import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import jotaiDebugLabel from "jotai/babel/plugin-debug-label"
import jotaiReactRefresh from "jotai/babel/plugin-react-refresh"

const host = process.env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    build: {
      host: host || false,
      // Tauri uses Chromium on Windows and WebKit on macOS and Linux
      target:
        process.env.TAURI_ENV_PLATFORM == "windows"
          ? "chrome105"
          : "safari13",
      // don"t minify for debug builds
      minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" as const : false,
      // produce sourcemaps for debug builds
      sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
    resolve: {
      alias: {
        "@": path.join(__dirname, "src"),
        "@codemirror/state": path.resolve(
          __dirname,
          "./node_modules/@codemirror/state/dist/index.js"
        ),
        "@codemirror/view": path.resolve(
          __dirname,
          "./node_modules/@codemirror/view/dist/index.js"
        ),
        "@codemirror/lint": path.resolve(
          __dirname,
          "./node_modules/@codemirror/lint/dist/index.js"
        ),
        "@codemirror/lang-json": path.resolve(
          __dirname,
          "./node_modules/@codemirror/lang-json/dist/index.js"
        ),
        "@codemirror/linter": path.resolve(
          __dirname,
          "./node_modules/@codemirror/linter/dist/index.js"
        ),
        "@codemirror/theme-one-dark": path.resolve(
          __dirname,
          "./node_modules/@codemirror/theme-one-dark/dist/index.js"
        ),
        "@codemirror/autocomplete": path.resolve(
          __dirname,
          "./node_modules/@codemirror/autocomplete/dist/index.js"
        ),
        "@codemirror/commands": path.resolve(
          __dirname,
          "./node_modules/@codemirror/commands/dist/index.js"
        ),
        "@codemirror/language": path.resolve(
          __dirname,
          "./node_modules/@codemirror/language/dist/index.js"
        ),
        "@codemirror/search": path.resolve(
          __dirname,
          "./node_modules/@codemirror/search/dist/index.js"
        ),
        "@uiw/react-codemirror": path.resolve(
          __dirname,
          "node_modules/@uiw/react-codemirror/esm/index.js",
        ),
        "@uiw/codemirror-extensions-basic-setup": path.resolve(
          __dirname,
          "node_modules/@uiw/codemirror-extensions-basic-setup/esm/index.js"
        ),
      },
    },
    plugins: [
      react({babel: { plugins: [jotaiDebugLabel, jotaiReactRefresh] }}),
    ],
    server: {
      strictPort: true,
      watch: {
        ignored: ["**/mcp-host/**", "**/src-tauri/**", "**/target/**", "**/release/**"],
        exclude: ["**/mcp-host/**"],
      },
    },
    envPrefix: ["VITE_", "TAURI_ENV_*"],
  }
})
