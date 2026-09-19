import { open } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const privateFileHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'self'",
  "Referrer-Policy": "no-referrer",
};

export async function privateFileResponse(rootPath: string, storagePath: string, fileName: string, disposition: "attachment" | "inline", range?: string | null) {
  const absolutePath = path.resolve(rootPath, storagePath);
  if (!absolutePath.startsWith(`${path.resolve(rootPath)}${path.sep}`)) {
    return new Response("Not found", { status: 404, headers: privateFileHeaders });
  }
  let file;
  try {
    file = await open(absolutePath, "r");
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("Not a regular file");
    const signature = Buffer.alloc(16);
    await file.read(signature, 0, 16, 0);
    // Only raster formats may render inline. Existing uploads remain untrusted too.
    const mime = signature.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ? "image/png"
      : signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff ? "image/jpeg"
      : /^GIF8[79]a/.test(signature.toString("ascii")) ? "image/gif"
      : signature.toString("ascii", 0, 4) === "RIFF" && signature.toString("ascii", 8, 12) === "WEBP" ? "image/webp"
      : "application/octet-stream";
    const headers = new Headers(privateFileHeaders);
    headers.set("Content-Type", mime);
    headers.set("Accept-Ranges", "bytes");
    const safeName = fileName.replace(/["\\\r\n]/g, "_");
    headers.set("Content-Disposition", `${mime === "application/octet-stream" ? "attachment" : disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    let start = 0;
    let end = stat.size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        if (match[1]) {
          start = Number(match[1]);
          end = match[2] ? Math.min(Number(match[2]), end) : end;
        } else {
          start = Math.max(0, stat.size - Number(match[2]));
        }
      }
      if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
        await file.close();
        headers.set("Content-Range", `bytes */${stat.size}`);
        return new Response(null, { status: 416, headers });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    }
    headers.set("Content-Length", String(Math.max(0, end - start + 1)));
    if (!stat.size) {
      await file.close();
      return new Response(null, { headers });
    }
    const stream = file.createReadStream({ start, end, autoClose: true });
    stream.on("error", (error) => console.error("Private file stream failed", { code: (error as NodeJS.ErrnoException).code }));
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
  } catch (error) {
    await file?.close().catch(() => undefined);
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") console.error("Private file unavailable", { code: code ?? "INVALID_FILE" });
    return new Response(code === "ENOENT" ? "Not found" : "File temporarily unavailable", { status: code === "ENOENT" ? 404 : 503, headers: privateFileHeaders });
  }
}
