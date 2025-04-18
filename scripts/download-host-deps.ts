import spawn from "cross-spawn"
import path from "node:path"

spawn("uv", ["sync", "--frozen"], { stdio: "inherit", cwd: path.join(__dirname, "..", "mcp-host") })