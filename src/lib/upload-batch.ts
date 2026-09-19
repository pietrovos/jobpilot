import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyUpload } from "./verified-upload";

export type StoredUpload = { fileName: string; fileType: string; fileSize: number; storagePath: string };

// Bytes are staged first; commit must atomically write all metadata. A process crash
// can leave unreferenced files, which offline maintenance reconciles later.
export async function withUploadBatch<T>(root: string, directory: string, files: File[], commit: (uploads: StoredUpload[]) => Promise<T>) {
  const uploads: StoredUpload[] = [];
  const paths: string[] = [];
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(root, directory);
  if (!target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Invalid upload directory");
  try {
    if (files.length) await mkdir(target, { recursive: true });
    for (const file of files) {
      const verified = await verifyUpload(file);
      const base = path.basename(file.name, path.extname(file.name)).replace(/[^a-zA-Z0-9._ -]/g, "-").trim().slice(0, 140) || "document";
      const fileName = base + verified.extension;
      const storagePath = path.join(directory, `${randomUUID()}-${fileName}`);
      const absolute = path.join(resolvedRoot, storagePath);
      paths.push(absolute);
      await writeFile(absolute, verified.buffer, { flag: "wx" });
      uploads.push({ storagePath, fileName, fileType: verified.mimeType, fileSize: verified.buffer.length });
    }
    return await commit(uploads);
  } catch (error) {
    await Promise.all(paths.map(async (file) => {
      try { await unlink(file); }
      catch (cleanupError) {
        const code = (cleanupError as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") console.error("Upload rollback requires maintenance", { code });
      }
    }));
    throw error;
  }
}
