import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { rimraf } from "rimraf"
import { promisify } from "util"
import { fileURLToPath } from "url"

const execPromise = promisify(exec)
const PYTHON_VERSION = "3.12"
const PLATFORM = process.argv[2] || "win-x64"
const TEMP_DIR = "./tmp"
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Helper function to copy directory recursively
function copyFolderRecursiveSync(source: string, target: string) {
  // Check if folder needs to be created or integrated
  const targetFolder = path.join(target, path.basename(source))
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true })
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source)
    files.forEach(function(file) {
      const curSource = path.join(source, file)
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder)
      } else {
        fs.copyFileSync(curSource, path.join(targetFolder, file))
      }
    })
  }
}

async function main() {
  const targetDir = path.join("bin", "python", PLATFORM)

  // Check if Python already exists in target directory
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.log(`Python v${PYTHON_VERSION} already exists in ./${targetDir}`)
    return
  }

  // Create necessary directories
  fs.mkdirSync(TEMP_DIR, { recursive: true })
  fs.mkdirSync(targetDir, { recursive: true })

  try {
    // Install Python using UV
    console.log(`Installing Python v${PYTHON_VERSION} using UV...`)

    const env = {
      ...process.env,
      UV_PYTHON_INSTALL_DIR: path.resolve(TEMP_DIR)
    }

    let command: string
    let args: string[]

    if (PLATFORM === "darwin-x64" && process.arch === "arm64" && process.platform === "darwin") {
      command = "arch"
      const uvPath = path.join(__dirname, "../bin/uv/darwin-x64/uv")
      args = ["-x86_64", uvPath, "python", "install", PYTHON_VERSION]
    } else if (PLATFORM === "darwin-arm64" && process.arch === "x64" && process.platform === "darwin") {
      command = "arch"
      const uvPath = path.join(__dirname, "../bin/uv/darwin-arm64/uv")
      args = ["-arm64", uvPath, "python", "install", PYTHON_VERSION]
    } else {
      command = "uv"
      args = ["python", "install", PYTHON_VERSION]
    }

    const { stdout, stderr } = await execPromise(`${command} ${args.join(" ")}`, { env })

    if (stderr) {
      console.error("UV stderr:", stderr)
    }

    console.log(stdout)

    // Find the installed Python directory (starts with cpython)
    const pythonDirs = fs.readdirSync(TEMP_DIR)
    const cpythonDir = pythonDirs.find(dir => dir.startsWith("cpython"))

    if (!cpythonDir) {
      throw new Error("Could not find installed Python directory in tmp folder")
    }

    const cpythonPath = path.join(TEMP_DIR, cpythonDir)

    if (!fs.existsSync(cpythonPath)) {
      throw new Error(`Python directory not found at ${cpythonPath}`)
    }

    // Copy entire Python directory contents to target directory
    console.log(`Copying entire Python directory to ./${targetDir}`)

    const files = fs.readdirSync(cpythonPath)
    for (const file of files) {
      const srcPath = path.join(cpythonPath, file)
      const destPath = path.join(targetDir, file)

      if (fs.lstatSync(srcPath).isDirectory()) {
        copyFolderRecursiveSync(srcPath, targetDir)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }

    // Cleanup temporary files
    console.log("Cleaning up...")
    rimraf(TEMP_DIR).catch(() => {})

    console.log(`Done! Python v${PYTHON_VERSION} has been installed to ./${targetDir}`)
  } catch (error) {
    console.error("Error:", error)
    if (fs.existsSync(TEMP_DIR)) {
      rimraf(TEMP_DIR).catch(() => {})
    }
    process.exit(1)
  }
}

main()
