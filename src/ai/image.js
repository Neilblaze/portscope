import { readFileSync, existsSync, statSync } from "fs";
import { extname, resolve } from "path";
import { homedir } from "os";

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};


/**
 * Extract image file paths from user input text.
 * Recognizes: /path/to/file.png, ~/file.jpg, or "./screenshot.jpeg"
 * Returns { text: string (cleaned), images: Array<{ path, base64, mimeType }> }
 */
export function extractImages(input) {
  const images = [];
  const errors = [];

  const pathRegex = /(?:^|\s)((?:~\/|\.\/|\/)[^\s]+\.(?:png|jpg|jpeg))\b/gi;
  let text = input;
  let match;

  while ((match = pathRegex.exec(input)) !== null) {
    const rawPath = match[1];
    const filePath = rawPath.startsWith("~/")
      ? resolve(homedir(), rawPath.slice(2))
      : resolve(rawPath);

    const ext = extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    if (!existsSync(filePath)) {
      errors.push(`File not found: ${rawPath}`);
      continue;
    }

    const stat = statSync(filePath);
    if (stat.size > MAX_SIZE) {
      errors.push(`File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB): ${rawPath}`);
      continue;
    }

    const buffer = readFileSync(filePath);
    images.push({
      path: filePath,
      originalPath: rawPath,
      base64: buffer.toString("base64"),
      mimeType: MIME_TYPES[ext],
      sizeKB: Math.round(stat.size / 1024),
    });

    text = text.replace(rawPath, "").trim();
  }

  return { text: text || (images.length > 0 ? "What do you see in this image?" : ""), images, errors };
}


// Build Anthropic content array with images
export function toAnthropicImageContent(text, images) {
  const content = [];
  for (const img of images) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType,
        data: img.base64,
      },
    });
  }
  if (text) {
    content.push({ type: "text", text });
  }
  return content;
}


// Build OpenAI content array with images
export function toOpenAIImageContent(text, images) {
  const content = [];
  for (const img of images) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    });
  }
  if (text) {
    content.push({ type: "text", text });
  }
  return content;
}


// Build Ollama images array (base64 strings only).
export function toOllamaImages(images) {
  return images.map((img) => img.base64);
}
