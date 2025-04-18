import fs from "fs"
import path from "path"
import https from "https"
import { Extract as unzipper } from "unzipper"
import { rimraf } from "rimraf"

const PYTHON_VERSION = "3.12.10"
const PLATFORM = process.argv[2] || "win-x64"

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (response) => {
      response.pipe(file)
      file.on("finish", () => {
        file.close()
        resolve()
      })
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err))
    })
  })
}

async function extract(filePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(unzipper({ path: destPath }))
      .on("close", resolve)
      .on("error", reject)
  })
}

async function main() {
  const targetDir = path.join("bin", "python", PLATFORM)

  // Check if Python already exists in target directory
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.log(`Python v${PYTHON_VERSION} already exists in ./${targetDir}`)
    return
  }

  // Create necessary directories
  fs.mkdirSync("temp", { recursive: true })
  fs.mkdirSync(targetDir, { recursive: true })

  const fileName = `python-${PYTHON_VERSION}-embed-amd64.zip`
  const url = `https://www.python.org/ftp/python/${PYTHON_VERSION}/${fileName}`
  const tempFile = path.join("temp", fileName)

  try {
    // Download Python
    console.log(`Downloading Python v${PYTHON_VERSION}...`)
    await downloadFile(url, tempFile)

    // Extract files
    console.log("Extracting...")
    await extract(tempFile, targetDir)

    // Cleanup temporary files
    console.log("Cleaning up...")
    rimraf("temp").catch(() => {})

    console.log(`Done! Python v${PYTHON_VERSION} has been downloaded to ./${targetDir}`)
  } catch (error) {
    console.error("Error:", error)
    if (fs.existsSync("temp")) {
      rimraf("temp").catch(() => {})
    }
    process.exit(1)
  }
}

main()