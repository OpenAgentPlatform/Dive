export function safeBase64Encode(str: string): string {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode(parseInt(p1, 16))))
  } catch (e) {
    console.error("Encoding error:", e)
    return ""
  }
}

export function safeBase64Decode(str: string): string {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str),
      c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""))
  } catch (e) {
    console.error("Decoding error:", e)
    return str
  }
}

export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

/**
 * Create File object from img DOM element using Canvas API
 */
export async function getFileFromImageUrl(
  url: string,
  filename?: string,
  quality?: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const imgElement = document.createElement("img")
    imgElement.src = url

    // Create canvas element
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      reject(new Error("Cannot get 2D context"))
      return
    }

    // Check if image source is cross-origin
    const isCrossOrigin = (src: string): boolean => {
      try {
        const imgUrl = new URL(src, window.location.href)
        const currentUrl = new URL(window.location.href)
        return imgUrl.origin !== currentUrl.origin
      } catch {
        return false
      }
    }

    // Create a new image element to ensure proper CORS handling
    const createCORSImage = (): Promise<HTMLImageElement> => {
      return new Promise((resolveImg, rejectImg) => {
        const newImg = new Image()

        // Set crossOrigin before setting src for cross-origin images
        if (isCrossOrigin(imgElement.src)) {
          newImg.crossOrigin = "anonymous"
        }

        newImg.onload = () => resolveImg(newImg)
        newImg.onerror = () => rejectImg(new Error("Failed to load image with CORS"))

        // Set src after crossOrigin
        newImg.src = imgElement.src
      })
    }

    // Process image when ready
    const processImage = async () => {
      try {
        let imageToUse = imgElement

        // For cross-origin images, create a new image with proper CORS
        if (isCrossOrigin(imgElement.src)) {
          try {
            imageToUse = await createCORSImage()
          } catch (corsError) {
            // If CORS fails, try alternative methods
            console.warn("CORS image loading failed, trying alternative methods:", corsError)
            // Fall back to fetch method for cross-origin images
            return await getFileFromImageUsingFetch(imgElement.src, filename)
          }
        }

        // Set canvas dimensions to match image natural size
        canvas.width = imageToUse.naturalWidth
        canvas.height = imageToUse.naturalHeight

        // Draw image onto canvas
        ctx.drawImage(imageToUse, 0, 0)

        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            // Create File object from blob
            const file = new File(
              [blob],
              filename || "image.png",
              {
                type: blob.type,
                lastModified: Date.now()
              }
            )
            resolve(file)
          } else {
            reject(new Error("Failed to convert canvas to blob"))
          }
        }, "image/png", quality || 0.9)

      } catch (error) {
        // If canvas method fails due to security, try fetch method
        if (error instanceof DOMException && error.name === "SecurityError") {
          console.warn("Canvas security error, falling back to fetch method:", error)
          try {
            const file = await getFileFromImageUsingFetch(imgElement.src, filename)
            resolve(file)
          } catch (fetchError) {
            const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)
            reject(new Error(`Both canvas and fetch methods failed: ${error.message}, ${fetchErrorMessage}`))
          }
        } else {
          reject(error)
        }
      }
    }

    // Check if image is already loaded
    if (imgElement.complete && imgElement.naturalHeight !== 0) {
      processImage()
    } else {
      // Wait for image to load
      imgElement.onload = processImage
      imgElement.onerror = () => reject(new Error("Image failed to load"))
    }
  })
}

/**
 * Alternative method using fetch for cross-origin images
 */
async function getFileFromImageUsingFetch(
  imageSrc: string,
  filename?: string
): Promise<File> {
  try {
    const response = await fetch(imageSrc)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const blob = await response.blob()
    const file = new File(
      [blob],
      filename || getFilenameFromUrl(imageSrc),
      {
        type: blob.type || "image/png",
        lastModified: Date.now()
      }
    )

    return file
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Fetch method failed: ${errorMessage}`)
  }
}

/**
 * Get filename from URL
 */
function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split("/").pop() || "image"

    // Add extension if missing
    if (!filename.includes(".")) {
      return filename + ".png"
    }

    return filename
  } catch {
    return "image.png"
  }
}