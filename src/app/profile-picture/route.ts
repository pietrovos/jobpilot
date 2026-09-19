import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

const profileUploadsRoot = path.join(process.cwd(), "uploads", "profile-pictures");
const allowedProfileImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET() {
  const user = await getCurrentUser();

  if (!user?.profileImagePath || !user.profileImageType || !allowedProfileImageTypes.has(user.profileImageType)) {
    return new Response("Not found", { status: 404 });
  }

  const absolutePath = path.resolve(profileUploadsRoot, user.profileImagePath);
  const root = path.resolve(profileUploadsRoot);

  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await readFile(absolutePath);

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": user.profileImageType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
