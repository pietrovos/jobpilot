import path from "node:path";
import sharp from "sharp";

export async function verifiedImage(buffer: Buffer, minimumDimension = 1) {
  const image = sharp(buffer, { limitInputPixels: 4096 * 4096, failOn: "warning" });
  const metadata = await image.metadata();
  if (!["jpeg", "png", "webp", "gif"].includes(metadata.format ?? "") ||
      !metadata.width || !metadata.height || metadata.width < minimumDimension || metadata.height < minimumDimension ||
      metadata.width > 4096 || metadata.height > 4096 || (metadata.pages ?? 1) > 1) {
    throw new Error("Unsupported image");
  }
  // Decode and re-encode, stripping metadata/trailing payloads rather than trusting MIME headers.
  const output = await image.rotate().png().toBuffer();
  if (output.length > 10 * 1024 * 1024) throw new Error("Decoded image too large");
  return { buffer: output, mimeType: "image/png", extension: ".png" };
}

export async function verifyUpload(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name).toLowerCase();
  if (extension === ".pdf" && /^%PDF-1\.[0-7]|^%PDF-2\.0/.test(buffer.subarray(0, 8).toString("ascii")) &&
      /%%EOF\s*$/.test(buffer.subarray(-1024).toString("ascii"))) {
    // PDFs remain untrusted documents and must be delivered as attachments, never inline HTML.
    return { buffer, mimeType: "application/pdf", extension: ".pdf" };
  }
  if (extension === ".txt") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error("Invalid text document");
    return { buffer, mimeType: "text/plain", extension: ".txt" };
  }
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) return verifiedImage(buffer);
  throw new Error("Upload PDF, UTF-8 text, or a non-animated PNG, JPEG, WebP or GIF image");
}
