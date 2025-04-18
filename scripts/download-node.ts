import fs from "fs"
import path from "path"
import https from "https"
import { Extract as unzipper } from "unzipper"
import tar from "tar"
import { rimraf } from "rimraf"

const NODE_VERSION = "20.19.0"
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

async function extract(filePath: string, destPath: string, isZip: boolean): Promise<void> {
  if (isZip) {
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(unzipper({ path: destPath }))
        .on("close", resolve)
        .on("error", reject)
    })
  } else {
    await tar.x({
      file: filePath,
      cwd: destPath
    })
  }
}

async function main() {
  const targetDir = path.join("bin", "node", PLATFORM)

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.log(`Node.js v${NODE_VERSION} already exists in ./${targetDir}`)
    return
  }

  fs.mkdirSync("temp", { recursive: true })
  fs.mkdirSync(targetDir, { recursive: true })

  const isWin = PLATFORM === "win-x64"
  const fileName = `node-v${NODE_VERSION}-${PLATFORM}${isWin ? ".zip" : ".tar.gz"}`
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${fileName}`
  const tempFile = path.join("temp", fileName)

  try {
    console.log(`Downloading Node.js v${NODE_VERSION}...`)
    await downloadFile(url, tempFile)

    console.log("Extracting...")
    await extract(tempFile, "temp", isWin)

    console.log("Moving files...")
    const extractedPath = path.join("temp", `node-v${NODE_VERSION}-${PLATFORM}`)
    const files = fs.readdirSync(extractedPath)
    for (const file of files) {
      fs.renameSync(
        path.join(extractedPath, file),
        path.join(targetDir, file)
      )
    }

    console.log("Cleaning up...")
    rimraf("temp").catch(() => {})

    console.log(`Done! Node.js v${NODE_VERSION} has been downloaded to ./${targetDir}`)
  } catch (error) {
    console.error("Error:", error)
    if (fs.existsSync("temp")) {
      rimraf("temp").catch(() => {})
    }
    process.exit(1)
  }
}

main()