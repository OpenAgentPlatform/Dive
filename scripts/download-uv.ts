import fs from "fs"
import path from "path"
import https from "https"
import { Extract as unzipper } from "unzipper"
import { rimraf } from "rimraf"

const UV_VERSION = "0.6.9"

type Platform = "darwin" | "win32" | "linux"
type Arch = "arm64" | "x64"
type UVConfig = {
  filename: string
  extractCmd: string
}

const getUVConfig = (platform: Platform, arch: Arch): UVConfig => {
  const configs: Record<Platform, Record<Arch, UVConfig>> = {
    darwin: {
      arm64: {
        filename: "uv-aarch64-apple-darwin.tar.gz",
        extractCmd: "tar"
      },
      x64: {
        filename: "uv-x86_64-apple-darwin.tar.gz",
        extractCmd: "tar"
      }
    },
    win32: {
      x64: {
        filename: "uv-x86_64-pc-windows-msvc.zip",
        extractCmd: "unzip"
      },
      arm64: {
        filename: "uv-x86_64-pc-windows-msvc.zip", // Windows only has x64 version currently
        extractCmd: "unzip"
      }
    },
    linux: {
      x64: {
        filename: "uv-x86_64-unknown-linux-gnu.tar.gz",
        extractCmd: "tar"
      },
      arm64: {
        filename: "uv-armv7-unknown-linux-gnueabihf.tar.gz",
        extractCmd: "tar"
      }
    }
  }

  return configs[platform][arch]
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
    }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          downloadFile(redirectUrl, dest).then(resolve).catch(reject)
          return
        }
      }

      if (response.statusCode === 200) {
        const file = fs.createWriteStream(dest)
        response.pipe(file)
        file.on("finish", () => {
          console.log("UV downloaded successfully", file.path)
          file.close()
          resolve()
        })
      } else {
        reject(new Error(`HTTP Status Code: ${response.statusCode}`))
      }
    })

    request.on("error", (err) => {
      console.error("Error downloading UV:", err)
      fs.unlink(dest, () => reject(err))
    })
  })
}

async function extract(filePath: string, destPath: string, extractCmd: string): Promise<void> {
  if (extractCmd === "unzip") {
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(unzipper({ path: destPath }))
        .on("close", resolve)
        .on("error", reject)
    })
  } else if (extractCmd === "tar") {
    const { execSync } = require("child_process")

    try {
      // Create a temporary directory for extraction
      const tempExtractPath = path.join(process.cwd(), "temp", "extract")
      fs.mkdirSync(tempExtractPath, { recursive: true })
      fs.mkdirSync(destPath, { recursive: true })

      // Extract to temporary directory first
      execSync(`tar -xzf "${filePath}" -C "${tempExtractPath}"`)

      // Move files from the inner directory to the target directory
      const innerDir = fs.readdirSync(tempExtractPath)[0]
      const innerPath = path.join(tempExtractPath, innerDir)

      // Move all files from inner directory to destination
      const files = fs.readdirSync(innerPath)
      for (const file of files) {
        fs.renameSync(
          path.join(innerPath, file),
          path.join(destPath, file)
        )
      }

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    }
  } else {
    return Promise.reject(new Error(`Unsupported extraction command: ${extractCmd}`))
  }
}

async function main() {
  // Parse command line arguments or use defaults
  const args = process.argv.slice(2)
  const platform = (args[0] as Platform) || process.platform as Platform
  const arch = (args[1] as Arch) || (process.arch === "arm64" ? "arm64" : "x64")

  // Validate platform and architecture
  if (platform !== "darwin" && platform !== "win32" && platform !== "linux") {
    console.error("Error: Platform must be either 'darwin' or 'win32' or 'linux'")
    process.exit(1)
  }

  if (arch !== "arm64" && arch !== "x64") {
    console.error("Error: Architecture must be either 'arm64' or 'x64'")
    process.exit(1)
  }

  // Get UV configuration for the specified platform and architecture
  const uvConfig = getUVConfig(platform, arch)
  const UV_FILENAME = uvConfig.filename
  const UV_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${UV_FILENAME}`

  // Determine target directory
  let platformDir
  if (platform === "win32") {
    platformDir = "win"
  } else if (platform === "darwin") {
    platformDir = "darwin"
  } else if (platform === "linux") {
    platformDir = "linux"
  }

  const targetDir = path.join(process.cwd(), "bin", "uv", `${platformDir}-${arch}`)

  if (fs.existsSync(path.join(targetDir, platform === "win32" ? "uv.exe" : "uv"))) {
    console.log(`UV v${UV_VERSION} already exists in ./${targetDir}`)
    return
  }

  fs.mkdirSync(path.join(process.cwd(), "temp"), { recursive: true })
  fs.mkdirSync(targetDir, { recursive: true })

  const tempFile = path.join(process.cwd(), "temp", UV_FILENAME)

  try {
    console.log(`Downloading UV v${UV_VERSION} for ${platform}-${arch}...`)
    await downloadFile(UV_URL, tempFile)

    console.log("Extracting...")
    await extract(tempFile, targetDir, uvConfig.extractCmd)

    console.log("Cleaning up...")
    rimraf("temp").catch(() => {})

    console.log(`Done! UV v${UV_VERSION} has been downloaded to ./${targetDir}`)
  } catch (error) {
    console.error("Error:", error)
    if (fs.existsSync("temp")) {
      rimraf("temp").catch(() => {})
    }
    process.exit(1)
  }
}

main()