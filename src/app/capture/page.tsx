import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CaptureImport } from "./capture-import";

export default async function CapturePage() {
  const user = await getCurrentUser();
  const documents = user
    ? await prisma.userDocument.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, fileName: true, fileType: true, fileSize: true, createdAt: true },
      })
    : [];

  return (
    <main id="main-content" className="site-shell min-h-screen px-4 py-8">
      <CaptureImport
        signedIn={Boolean(user)}
        documents={documents.map((document) => ({ ...document, createdAt: document.createdAt.toISOString() }))}
      />
    </main>
  );
}
