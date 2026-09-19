import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const companyLogoUploadsRoot = path.join(process.cwd(), "uploads", "company-logos");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const user = await getCurrentUser();
  const { applicationId } = await params;
  if (!user) return new Response("Not found", { status: 404 });

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: user.id, deletedAt: null },
    select: { companyLogoPath: true, companyLogoType: true },
  });
  if (!application?.companyLogoPath || !application.companyLogoType) return new Response("Not found", { status: 404 });

  const root = path.resolve(companyLogoUploadsRoot);
  const absolutePath = path.resolve(root, application.companyLogoPath);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(absolutePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": application.companyLogoType,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
