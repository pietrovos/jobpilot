import { ApplicationStatus } from "@/generated/prisma/enums";
import {
  addApplicationNote,
  addApplicationNoteFolder,
  addEmailLog,
  addInterview,
  attachApplicationDocuments,
  deleteApplicationNote,
  deleteApplicationNoteFolder,
  deleteApplications,
  deleteApplicationFile,
  deleteEmailLog,
  deleteInterview,
  moveApplicationNote,
  reorderApplications,
  refreshCompanyLogo,
  restoreDeletedApplication,
  saveOfferDetails,
  signOut,
  updateApplication,
  updateApplicationNote,
  updateEmailLog,
  updateInterview,
  updateApplicationStatus,
  uploadApplicationFile,
  uploadProfilePicture,
} from "./actions";
import { AccountMenu } from "./account-menu";
import { AddApplicationDialog } from "./add-application-dialog";
import { ApplicationFilters } from "./application-filters";
import { ApplicationList } from "./application-list";
import type { ApplicationSummary } from "./application-types";
import { RecycleBin } from "./recycle-bin";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

const sortModes = [
  { value: "custom", label: "Custom" },
  { value: "applied-desc", label: "Newest" },
  { value: "applied-asc", label: "Oldest" },
  { value: "company-asc", label: "Company A-Z" },
  { value: "status-asc", label: "Status" },
] as const;

type SortMode = (typeof sortModes)[number]["value"];

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const q = single(params.q).trim();
  const status = single(params.status);
  const profileMessage = single(params.profile) === "invalid"
    ? "Profile picture must be a JPG, PNG, WebP, or GIF image under 3 MB and between 64px and 4096px."
    : "";
  const sort = sortModes.some((mode) => mode.value === single(params.sort))
    ? (single(params.sort) as SortMode)
    : "applied-desc";
  const validStatus = Object.values(ApplicationStatus).includes(status as ApplicationStatus)
    ? (status as ApplicationStatus)
    : undefined;

  const pageSize = 30;
  const requestedPage = Number(single(params.page));
  const requestedPageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const where = {
      userId: user.id,
      deletedAt: null,
      ...(validStatus ? { status: validStatus } : {}),
      ...(q
        ? {
            OR: [
              { company: { contains: q } },
              { role: { contains: q } },
              { location: { contains: q } },
              { jobDescription: { contains: q } },
               { notes: { contains: q } },
               { noteEntries: { some: { OR: [{ title: { contains: q } }, { body: { contains: q } }] } } },
            ],
          }
        : {}),
    };
  const applicationCount = await prisma.application.count({ where });
  const page = Math.min(requestedPageNumber, Math.max(1, Math.ceil(applicationCount / pageSize)));
  const applications = await prisma.application.findMany({
    where,
    orderBy: [...orderForSort(sort), { id: "asc" }],
    take: pageSize,
    skip: (page - 1) * pageSize,
    select: {
      id: true,
      company: true,
      role: true,
      status: true,
      location: true,
      salary: true,
      jobUrl: true,
      companyLogoPath: true,
      notes: true,
      appliedAt: true,
      createdAt: true,
    },
  });
  const deletedApplications = await prisma.application.findMany({
    where: { userId: user.id, deletedAt: { gte: retentionCutoff() } },
    orderBy: { deletedAt: "desc" },
    select: { id: true, company: true, role: true },
    take: 1000,
  });
  const legacyDeletedApplications = await prisma.deletedApplication.findMany({
    where: { userId: user.id },
    select: { id: true, company: true, role: true },
    take: 100,
  });
  const userDocuments = await prisma.userDocument.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      createdAt: true,
    },
  });
  const documentItems = userDocuments.map((document) => ({
    id: document.id,
    fileName: document.fileName,
    fileType: document.fileType,
    fileSize: document.fileSize,
    createdAt: document.createdAt.toISOString(),
  }));

  const applicationItems: ApplicationSummary[] = applications.map((application) => ({
    id: application.id,
    company: application.company,
    role: application.role,
    status: application.status,
    location: application.location,
    salary: application.salary,
    jobUrl: application.jobUrl,
    companyLogoPath: application.companyLogoPath,
    notes: application.notes,
    appliedAt: (application.appliedAt ?? application.createdAt).toISOString(),
  }));

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
              primaryLink={{ href: "/documents", label: "Documents" }}
              returnTo="/"
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
          <div>
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black">Applications</h1>
                <AddApplicationDialog documents={documentItems} />
              </div>
              <ApplicationFilters
                q={q}
                status={validStatus ?? ""}
                sort={sort}
                sortModes={[...sortModes]}
                statuses={Object.values(ApplicationStatus).map((item) => ({
                  value: item,
                  label: statusLabels[item],
                }))}
              />
            </div>

            <ApplicationList
              applications={applicationItems}
              documents={documentItems}
              attachApplicationDocuments={attachApplicationDocuments}
              addApplicationNote={addApplicationNote}
              addApplicationNoteFolder={addApplicationNoteFolder}
              addEmailLog={addEmailLog}
              addInterview={addInterview}
              deleteApplicationNote={deleteApplicationNote}
              deleteApplicationNoteFolder={deleteApplicationNoteFolder}
              deleteApplications={deleteApplications}
              deleteApplicationFile={deleteApplicationFile}
              deleteEmailLog={deleteEmailLog}
              deleteInterview={deleteInterview}
              moveApplicationNote={moveApplicationNote}
              reorderApplications={reorderApplications}
              refreshCompanyLogo={refreshCompanyLogo}
              saveOfferDetails={saveOfferDetails}
              sortMode={sort}
              canReorder={applicationCount <= pageSize && !q && !validStatus}
              updateApplication={updateApplication}
              updateApplicationNote={updateApplicationNote}
              updateEmailLog={updateEmailLog}
              updateInterview={updateInterview}
              updateApplicationStatus={updateApplicationStatus}
              uploadApplicationFile={uploadApplicationFile}
            />

            <nav aria-label="Application pages" className="my-6 flex items-center gap-5 text-sm">
              {page > 1 ? <Link href={pageHref(page - 1, q, validStatus ?? "", sort)}>Previous</Link> : null}
              <span>{applicationCount} applications · Page {page} of {Math.max(1, Math.ceil(applicationCount / pageSize))}</span>
              {page * pageSize < applicationCount ? <Link href={pageHref(page + 1, q, validStatus ?? "", sort)}>Next</Link> : null}
            </nav>
            <RecycleBin
              applications={[...deletedApplications, ...legacyDeletedApplications].map((application) => ({
                id: application.id,
                company: application.company,
                role: application.role,
              }))}
              restoreDeletedApplication={restoreDeletedApplication}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function pageHref(page: number, q: string, status: string, sort: string) {
  return `/?${new URLSearchParams({ page: String(page), q, status, sort })}`;
}

function retentionCutoff() {
  return new Date(Date.now() - 30 * 86400000);
}

function orderForSort(sort: SortMode) {
  if (sort === "custom") return [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }];
  if (sort === "applied-desc") return [{ appliedAt: "desc" as const }, { createdAt: "desc" as const }];
  if (sort === "applied-asc") return [{ appliedAt: "asc" as const }, { createdAt: "asc" as const }];
  if (sort === "company-asc") return [{ company: "asc" as const }, { createdAt: "desc" as const }];
  if (sort === "status-asc") return [{ status: "asc" as const }, { createdAt: "desc" as const }];

  return [{ appliedAt: "desc" as const }, { createdAt: "desc" as const }];
}
