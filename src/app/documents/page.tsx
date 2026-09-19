import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteUserDocument, signOut, uploadProfilePicture, uploadUserDocuments } from "../actions";
import { AccountMenu } from "../account-menu";
import { DocumentsPageContent } from "./documents-page-content";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type DocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const documents = await prisma.userDocument.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const params = (await searchParams) ?? {};
  const profileMessage = single(params.profile) === "invalid"
    ? "Profile picture must be a JPG, PNG, WebP, or GIF image under 3 MB and between 64px and 4096px."
    : "";

  return (
    <main id="main-content" className="site-shell min-h-screen">
      <div className="flex w-full flex-col px-4 sm:px-6 lg:px-10 2xl:px-14">
        <header className="site-topbar sticky top-0 z-40 flex flex-col justify-between gap-4 py-5 backdrop-blur-xl sm:flex-row sm:items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="site-logo grid size-11 place-items-center rounded-2xl text-lg font-black">JP</div>
            <div>
              <p className="site-brand text-sm uppercase tracking-[0.35em]">JobPilot</p>
            </div>
          </Link>
          <div className="flex items-center gap-5">
            {user.isGuest ? (
              <Link href="/signup" className="border border-cyan-300/30 bg-cyan-400/8 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 shadow-[0_0_18px_rgb(34_211_238/0.1)] transition hover:-translate-y-0.5 hover:border-cyan-100/60 hover:bg-cyan-400/14 hover:shadow-[0_0_24px_rgb(34_211_238/0.18)]">
                Sign up
              </Link>
            ) : null}
          <AccountMenu
            name={user.name}
            hasProfilePicture={Boolean(user.profileImagePath)}
            primaryLink={{ href: "/", label: "Applications" }}
            returnTo="/documents"
            signOut={signOut}
            uploadProfilePicture={uploadProfilePicture}
          />
          </div>
        </header>

        <section className="py-8">
          {profileMessage ? (
            <div className="mb-5 border border-rose-400/30 bg-rose-950/40 px-4 py-3 text-sm font-bold text-rose-100">
              {profileMessage}
            </div>
          ) : null}
          <DocumentsPageContent
            documents={documents.map((document) => ({
              id: document.id,
              fileName: document.fileName,
              fileType: document.fileType,
              fileSize: document.fileSize,
              createdAt: document.createdAt.toISOString(),
            }))}
            deleteUserDocument={deleteUserDocument}
            uploadUserDocuments={uploadUserDocuments}
          />
        </section>
      </div>
    </main>
  );
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
