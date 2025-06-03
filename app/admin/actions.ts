"use server"

import { put } from "@vercel/blob"
import { Buffer } from "buffer" // Node.js Buffer

interface UploadResult {
  urls?: string[]
  error?: string
  details?: any // For additional error details
}

export async function uploadProductImagesAction(base64Images: string[]): Promise<UploadResult> {
  // 👇 NEW VERY OBVIOUS LOGGING HERE 👇
  console.log("🚀🚀🚀 SERVER ACTION 'uploadProductImagesAction' ENTERED! 🚀🚀🚀 Timestamp:", new Date().toISOString())
  console.log(`[Server Action] Received ${base64Images.length} image(s) for upload.`)

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[Server Action] CRITICAL: BLOB_READ_WRITE_TOKEN is not configured in environment variables.")
    return { error: "File upload service is not configured correctly on the server: Missing token." }
  }
  // console.log("[Server Action] BLOB_READ_WRITE_TOKEN is present (first 10 chars):", process.env.BLOB_READ_WRITE_TOKEN.substring(0, 10));

  const uploadedUrls: string[] = []

  try {
    for (let i = 0; i < base64Images.length; i++) {
      const base64Image = base64Images[i]
      console.log(`[Server Action] Processing image ${i + 1} of ${base64Images.length}`)

      if (!base64Image || !base64Image.startsWith("data:image/")) {
        console.warn(
          `[Server Action] Invalid base64 image format provided at index ${i}:`,
          base64Image?.substring(0, 30) + "...",
        )
        continue
      }

      const parts = base64Image.split(",")
      if (parts.length !== 2) {
        console.warn(
          `[Server Action] Malformed base64 image data at index ${i}. Expected 2 parts after split, got ${parts.length}.`,
        )
        continue
      }
      const base64Data = parts[1]
      const imageTypeMatch = parts[0].match(/^data:(image\/[a-zA-Z+]+);base64$/)
      const imageType = imageTypeMatch && imageTypeMatch[1] ? imageTypeMatch[1] : "image/jpeg"
      console.log(`[Server Action] Image ${i + 1}: Type detected as ${imageType}`)

      let buffer: Buffer
      try {
        buffer = Buffer.from(base64Data, "base64")
        console.log(`[Server Action] Image ${i + 1}: Converted to Buffer, size: ${buffer.length} bytes`)
      } catch (bufferError) {
        console.error(`[Server Action] Image ${i + 1}: Error converting base64 to Buffer.`, bufferError)
        continue
      }

      const uniqueFileName = `product-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${imageType.split("/")[1] || "jpg"}`
      console.log(
        `[Server Action] Image ${i + 1}: Attempting to upload as ${uniqueFileName} with contentType ${imageType}`,
      )

      const blobResult = await put(uniqueFileName, buffer, {
        access: "public",
        contentType: imageType,
      })
      console.log(`[Server Action] Image ${i + 1}: Uploaded successfully. URL: ${blobResult.url}`)
      uploadedUrls.push(blobResult.url)
    }

    if (uploadedUrls.length === 0 && base64Images.length > 0) {
      console.warn("[Server Action] No images were successfully uploaded, though some were provided.")
      return { error: "No images were successfully uploaded. Check image formats or server logs." }
    }
    console.log("[Server Action] Successfully uploaded URLs:", uploadedUrls)
    return { urls: uploadedUrls }
  } catch (error: any) {
    console.error("[Server Action] CRITICAL ERROR during image upload process:", error)
    let errorMessage = "Unknown error during upload."
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === "string") {
      errorMessage = error
    }

    if (error.message && error.message.includes("No token found")) {
      console.error(
        "[Server Action] Specific Error: Vercel Blob 'No token found'. This means BLOB_READ_WRITE_TOKEN is missing or invalid at the time of `put` call.",
      )
      return {
        error:
          "File upload configuration error on server: The server is missing the required access token for Blob storage.",
        details: error.message,
      }
    }
    if (error.message && error.message.includes("Invalid token")) {
      console.error(
        "[Server Action] Specific Error: Vercel Blob 'Invalid token'. The BLOB_READ_WRITE_TOKEN is likely incorrect or expired.",
      )
      return {
        error: "File upload configuration error on server: The provided access token for Blob storage is invalid.",
        details: error.message,
      }
    }

    return { error: `Failed to upload images: ${errorMessage}`, details: error }
  }
}
