"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { ActionForm, mutationFeedback, uploadError } from "./ui/action-form";
import type { ApplicationDetail, ApplicationSummary } from "./application-types";
import type { UserDocumentItem } from "./document-types";
import { ApplicationDetails } from "./application-details";
import { StatusForm } from "./application-editors";
import { applicationDay, formatApplicationDay, formatDateTime, hasDraggedFiles } from "./application-format";
import { rankHoldStatusStyles, rowStatusBaseStyles, rowStatusFocusStyles, rowStatusStyles, salaryRankStyles, selectedRowStatusStyles, textStatusStyles } from "./application-status-styles";
import { DeleteConfirmation, type DeleteTarget } from "./confirmation-dialogs";
import { CompanyLogo } from "./detail-primitives";
import { TimeZoneContext, browserTimeZone, serverTimeZone, subscribeTimeZone } from "./time-zone";

type RankAnimation = { direction: "up" | "down"; status: ApplicationStatus };

type ApplicationListProps = {
  applications: ApplicationSummary[];
  documents: UserDocumentItem[];
  attachApplicationDocuments: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addApplicationNote: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addApplicationNoteFolder: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addEmailLog: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addInterview: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  deleteApplicationNote: (noteId: string) => unknown | Promise<unknown>;
  deleteApplicationNoteFolder: (folderId: string) => unknown | Promise<unknown>;
  deleteApplications: (formData: FormData) => unknown | Promise<unknown>;
  deleteApplicationFile: (fileId: string) => unknown | Promise<unknown>;
  deleteEmailLog: (emailLogId: string) => unknown | Promise<unknown>;
  deleteInterview: (interviewId: string) => unknown | Promise<unknown>;
  moveApplicationNote: (noteId: string, folderId: string) => unknown | Promise<unknown>;
  reorderApplications: (formData: FormData) => unknown | Promise<unknown>;
  refreshCompanyLogo: (applicationId: string) => unknown | Promise<unknown>;
  saveOfferDetails: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  sortMode: string;
  canReorder?: boolean;
  updateApplication: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  updateApplicationNote: (noteId: string, formData: FormData) => unknown | Promise<unknown>;
  updateEmailLog: (emailLogId: string, formData: FormData) => unknown | Promise<unknown>;
  updateInterview: (interviewId: string, formData: FormData) => unknown | Promise<unknown>;
  updateApplicationStatus: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  uploadApplicationFile: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
};

export function ApplicationList({
  applications,
  documents,
  attachApplicationDocuments,
  addApplicationNote,
  addApplicationNoteFolder,
  addEmailLog,
  addInterview,
  deleteApplications,
  deleteApplicationFile,
  deleteApplicationNote,
  deleteApplicationNoteFolder,
  deleteEmailLog,
  deleteInterview,
  moveApplicationNote,
  reorderApplications,
  refreshCompanyLogo,
  saveOfferDetails,
  sortMode,
  canReorder = true,
  updateApplication,
  updateApplicationNote,
  updateEmailLog,
  updateInterview,
  updateApplicationStatus,
  uploadApplicationFile,
}: ApplicationListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFiltered = !canReorder || Boolean(searchParams.get("q")?.trim() || searchParams.get("status"));
  const [operationMessage, setOperationMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [detailsApplication, setDetailsApplication] = useState<ApplicationDetail | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [fileDropTargetId, setFileDropTargetId] = useState<string | null>(null);
  const [optimisticOrderIds, setOptimisticOrderIds] = useState<string[] | null>(null);
  const [sortNotice, setSortNotice] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<string[]>([]);
  const timeZone = useSyncExternalStore(subscribeTimeZone, browserTimeZone, serverTimeZone);
  const [rankAnimations, setRankAnimations] = useState<Record<string, RankAnimation>>({});
  const dragStartOrderIds = useRef<string[] | null>(null);
  const droppedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [keyboardNavigatingList, setKeyboardNavigatingList] = useState(false);
  const [, startTransition] = useTransition();
  const orderedApplications = sortMode === "custom" && optimisticOrderIds
    ? orderApplications(applications, optimisticOrderIds)
    : applications;
  const dayGroups: Array<{ day: string; applications: ApplicationSummary[] }> = [];
  for (const application of orderedApplications) {
    const day = applicationDay(application.appliedAt, timeZone);
    const lastGroup = dayGroups.at(-1);
    if (lastGroup?.day === day) lastGroup.applications.push(application);
    else dayGroups.push({ day, applications: [application] });
  }
  const activeDetailsApplication = detailsApplication;
  const selectedCount = selectedIds.length;

  useEffect(() => {
    function focusFirstApplication(event: KeyboardEvent) {
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      if (document.activeElement !== document.body && document.activeElement !== document.documentElement) return;
      if (document.querySelector("dialog[open]")) return;
      const first = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-application-id]") ?? []).find((card) => !card.closest("[hidden]"));
      if (!first) return;
      event.preventDefault();
      setKeyboardNavigatingList(true);
      first.focus();
    }

    window.addEventListener("keydown", focusFirstApplication);
    return () => window.removeEventListener("keydown", focusFirstApplication);
  }, []);

  function handleArticleKeyDown(event: React.KeyboardEvent<HTMLElement>, application: ApplicationSummary) {
    if (event.key === "Escape" && event.target !== event.currentTarget) {
      if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable], [role='listbox']")) return;
      if (event.currentTarget.querySelector('[aria-haspopup="listbox"][aria-expanded="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus();
      return;
    }
    if (event.target !== event.currentTarget) return;
    const index = orderedApplications.findIndex((item) => item.id === application.id);
    if (index < 0) return;
    if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) {
      event.preventDefault();
      setKeyboardNavigatingList(true);
      const step = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
      for (let next = index + step; next >= 0 && next < orderedApplications.length; next += step) {
        if (collapsedDays.includes(applicationDay(orderedApplications[next].appliedAt, timeZone))) continue;
        listRef.current?.querySelector<HTMLElement>(`[data-application-id="${orderedApplications[next].id}"]`)?.focus();
        break;
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void openDetails(application);
    }
  }

  function toggleSelection(applicationId: string) {
    setSelectedIds((current) =>
      current.includes(applicationId)
        ? current.filter((item) => item !== applicationId)
        : [...current, applicationId],
    );
  }

  async function openDetails(application: ApplicationSummary) {
    setOperationMessage("Loading application details...");
    try {
      const response = await fetch(`/applications/${application.id}/details`);
      if (!response.ok) throw new Error("Could not load application details");

      setDetailsApplication(await response.json() as ApplicationDetail);
      setOperationMessage("");
    } catch {
      setOperationMessage("Could not load application details. Please try again.");
    }
  }

  function getMovedApplications(targetId: string) {
    if (!draggedId || draggedId === targetId) return;

    const draggedIsSelected = selectedIds.includes(draggedId);
    const movingIds = draggedIsSelected ? selectedIds : [draggedId];
    const movingIdSet = new Set(movingIds);

    if (movingIdSet.has(targetId)) return;

    const firstMovingIndex = orderedApplications.findIndex((application) => movingIdSet.has(application.id));
    const targetIndex = orderedApplications.findIndex((application) => application.id === targetId);

    if (firstMovingIndex === -1 || targetIndex === -1) return;

    const movingApplications = orderedApplications.filter((application) => movingIdSet.has(application.id));
    if (movingApplications.length === 0) return;

    const remainingApplications = orderedApplications.filter((application) => !movingIdSet.has(application.id));
    const targetIndexAfterRemoval = remainingApplications.findIndex((application) => application.id === targetId);
    const insertIndex = targetIndex > firstMovingIndex ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
    const next = [...remainingApplications];
    next.splice(insertIndex, 0, ...movingApplications);

    return next;
  }

  function previewMove(targetId: string) {
    const next = getMovedApplications(targetId);

    if (!next) return;

    setOptimisticOrderIds(next.map((application) => application.id));
    return next;
  }

  function saveCustomOrder(nextApplications: ApplicationSummary[]) {
    if (isFiltered) return;
    const params = new URLSearchParams(searchParams);
    params.set("sort", "custom");
    const query = params.toString();

    if (sortMode !== "custom") {
      router.replace(query ? `${pathname}?${query}` : pathname);
    }

    startTransition(async () => {
      const formData = new FormData();
      nextApplications.forEach((application) => formData.append("applicationIds", application.id));
      try {
        const result = mutationFeedback(await reorderApplications(formData));
        if (!result.success) setOptimisticOrderIds(null);
        setOperationMessage(result.message);
      } catch {
        setOptimisticOrderIds(null);
        setOperationMessage("Could not save the order. Please try again.");
      }
    });
  }

  function notifyCustomSortRequired() {
    setSortNotice(true);
    window.setTimeout(() => setSortNotice(false), 4200);
  }

  function animateRankChange(applicationId: string, from: ApplicationStatus, to: ApplicationStatus) {
    const direction = statusRank(to) > statusRank(from) ? "up" : "down";

    setRankAnimations((current) => ({ ...current, [applicationId]: { direction, status: to } }));
    window.setTimeout(() => {
      setRankAnimations((current) => {
        const next = { ...current };
        delete next[applicationId];
        return next;
      });
    }, 2600);
  }

  function uploadDroppedFiles(applicationId: string, files: File[]) {
    if (files.length === 0) return;
    const error = uploadError(files);
    if (error) { setOperationMessage(error); return; }
    setOperationMessage("Uploading files...");

    startTransition(async () => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      try {
        setOperationMessage(mutationFeedback(await uploadApplicationFile(applicationId, formData)).message);
      } catch {
        setOperationMessage("Upload failed. Please try again.");
      }
    });
  }

  if (orderedApplications.length === 0) {
    return (
      <div className="mt-5 rounded-3xl border border-dashed border-white/15 p-8 text-center text-slate-400">
        No applications match this view yet.
      </div>
    );
  }

  return (
    <TimeZoneContext.Provider value={timeZone}>
    <div ref={listRef} className="mt-6 grid gap-5" onPointerMove={(event) => {
      if (event.pointerType === "mouse") setKeyboardNavigatingList(false);
    }}>
      {operationMessage ? <p role="status" className="text-sm text-sky-200">{operationMessage}</p> : null}
      {isFiltered && sortMode === "custom" ? <p className="text-sm text-slate-400">Reordering is available for unfiltered lists of up to 30 applications.</p> : null}
      {sortNotice ? (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 border border-rose-400/40 bg-rose-950/95 px-4 py-3 text-sm font-bold text-rose-100 shadow-2xl shadow-rose-950/40">
          Switch sorting to Custom before moving applications.
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="mb-2 flex flex-col gap-3 border-b border-sky-400/20 bg-sky-400/5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-sky-100">
            {selectedCount} selected. Ctrl-click another application to add or remove it.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </button>
            <button
              type="button"
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-400"
              onClick={() => setDeleteTarget({ ids: selectedIds, label: `${selectedCount} selected applications` })}
            >
              Delete selected
            </button>
          </div>
        </div>
      ) : null}

      {dayGroups.map((group, groupIndex) => {
        const isCollapsed = collapsedDays.includes(group.day);
        const dayLabel = formatApplicationDay(group.applications[0].appliedAt, timeZone);
        return (
          <section key={`${group.day}-${groupIndex}`} className="grid gap-4" aria-label={`Applications applied ${dayLabel}`}>
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() => setCollapsedDays((current) => isCollapsed ? current.filter((day) => day !== group.day) : [...current, group.day])}
              className="flex w-full items-center justify-between gap-3 border border-sky-300/20 bg-slate-900/65 px-5 py-3 text-left text-sm font-bold text-sky-100 transition hover:border-sky-300/45 hover:bg-sky-950/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              <span>{dayLabel} <span className="ml-2 font-medium text-slate-400">({group.applications.length})</span></span>
              <span aria-hidden="true" className={`text-sky-300 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>⌄</span>
            </button>
            <div hidden={isCollapsed} className="grid gap-5">
      {group.applications.map((application) => {
        const isSelected = selectedIds.includes(application.id);
        const textTheme = textStatusStyles[application.status];
        const canDrag = sortMode === "custom" && !isFiltered;
        const rankAnimation = rankAnimations[application.id];
        const isFileDropTarget = fileDropTargetId === application.id;

        return (
          <article
            key={application.id}
            data-application-id={application.id}
            tabIndex={-1}
            aria-label={`${application.company} application`}
            draggable={canDrag}
            className={`application-card relative border-l-2 py-6 pl-5 pr-2 transition-all duration-200 ease-out ${
              isSelected
                ? selectedRowStatusStyles[application.status]
                : `bg-slate-950/30 ${keyboardNavigatingList ? rowStatusBaseStyles[application.status] : rowStatusStyles[application.status]} ${rowStatusFocusStyles[application.status]}`
            } ${isFileDropTarget ? "border-cyan-300 bg-cyan-400/10 shadow-[0_0_34px_rgb(34_211_238/0.22)]" : ""} ${rankAnimation ? rankHoldStatusStyles[rankAnimation.status] : ""} ${rankAnimation?.direction === "up" ? "rank-transition-up" : ""} ${rankAnimation?.direction === "down" ? "rank-transition-down" : ""} ${rankAnimation ? `rank-transition-${rankAnimation.status.toLowerCase()}` : ""} ${draggedId === application.id ? "opacity-45" : canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
            onDragStart={(event) => {
              if (!canDrag) {
                event.preventDefault();
                notifyCustomSortRequired();
                return;
              }
              setDraggedId(application.id);
              dragStartOrderIds.current = orderedApplications.map((item) => item.id);
              droppedRef.current = false;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", application.id);
            }}
            onDragEnter={(event) => {
              if (hasDraggedFiles(event.dataTransfer)) {
                event.preventDefault();
                setFileDropTargetId(application.id);
                return;
              }

              if (!canDrag) return;
              event.preventDefault();
              previewMove(application.id);
            }}
            onDragOver={(event) => {
              if (hasDraggedFiles(event.dataTransfer)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setFileDropTargetId(application.id);
                return;
              }

              if (!canDrag) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              previewMove(application.id);
            }}
            onDragLeave={(event) => {
              if (!hasDraggedFiles(event.dataTransfer)) return;
              if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;

              setFileDropTargetId(null);
            }}
            onDrop={(event) => {
              const droppedFiles = Array.from(event.dataTransfer.files);
              if (droppedFiles.length > 0) {
                event.preventDefault();
                setFileDropTargetId(null);
                uploadDroppedFiles(application.id, droppedFiles);
                return;
              }
              if (hasDraggedFiles(event.dataTransfer)) {
                event.preventDefault();
                setFileDropTargetId(null);
                return;
              }

              if (!canDrag) return;
              event.preventDefault();
              droppedRef.current = true;
              const next = getMovedApplications(application.id) ?? orderedApplications;
              setOptimisticOrderIds(next.map((item) => item.id));
              saveCustomOrder(next);
              setDraggedId(null);
            }}
            onDragEnd={() => {
              setFileDropTargetId(null);
              if (!droppedRef.current) {
                setOptimisticOrderIds(dragStartOrderIds.current);
              }
              setDraggedId(null);
              dragStartOrderIds.current = null;
              droppedRef.current = false;
            }}
            onClick={(event) => {
              if (!event.ctrlKey && !event.metaKey) return;
              if (event.target instanceof Element && event.target.closest("a, button, form, input, select")) return;

              event.preventDefault();
              toggleSelection(application.id);
            }}
            onKeyDown={(event) => handleArticleKeyDown(event, application)}
            onDoubleClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a, button, form, input, select")) return;

               void openDetails(application);
            }}
          >
            {isFileDropTarget ? (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center border border-cyan-300/60 bg-slate-950/75 text-sm font-black uppercase tracking-[0.18em] text-cyan-100 backdrop-blur-[1px]">
                Drop files to upload
              </div>
            ) : null}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 items-center gap-5">
                {application.companyLogoPath ? <CompanyLogo applicationId={application.id} card /> : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`min-w-0 break-words text-2xl font-black ${textTheme.title}`}>
                      {application.company}
                    </h3>
                    {!application.companyLogoPath && application.jobUrl ? (
                      <ActionForm action={refreshCompanyLogo.bind(null, application.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] text-slate-400 hover:border-sky-300/45 hover:text-sky-200"
                        >
                          Fetch logo
                        </button>
                      </ActionForm>
                    ) : null}
                    {isSelected ? (
                      <span className="rounded-full bg-sky-400 px-3 py-1 text-xs font-black text-slate-950">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className={`break-words text-lg font-semibold ${textTheme.role}`}>{application.role}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-semibold text-slate-300">
                    <InlineMeta label="Location" value={application.location || "No location added"} theme={textTheme} />
                    <InlineMeta
                      label="Salary"
                      value={application.salary || "N/A"}
                      theme={textTheme}
                      valueClassName={salaryRankStyles[application.status]}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    isSelected
                      ? "border-sky-300 bg-sky-400/15 text-sky-100"
                      : "border-white/10 text-slate-200 hover:border-sky-300/35 hover:bg-sky-400/10"
                  }`}
                  onClick={() => toggleSelection(application.id)}
                >
                  {isSelected ? "Selected" : "Select"}
                </button>
                <button
                  type="button"
                  className={`rounded-full border px-4 py-2 text-sm font-bold ${textTheme.action}`}
                  onClick={() => void openDetails(application)}
                >
                  View details
                </button>
                <button
                  type="button"
                  className="rounded-full border border-rose-400/30 px-4 py-2 text-sm font-bold text-rose-300 hover:bg-rose-400/10"
                  onClick={() => setDeleteTarget({ ids: [application.id], label: application.company })}
                >
                  Delete
                </button>
              </div>
            </div>

            {application.notes ? (
              <p className="mt-3 rounded-2xl bg-slate-900 p-3 text-sm text-slate-300">{application.notes}</p>
            ) : null}

            <div className="mt-5 flex flex-col justify-between gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-center">
              <p className={`text-sm font-semibold ${textTheme.time}`}>Applied {formatDateTime(application.appliedAt, timeZone)}</p>
                <StatusForm
                  key={`${application.id}-${application.status}`}
                  applicationId={application.id}
                  status={application.status}
                  onStatusChange={animateRankChange}
                  updateApplicationStatus={updateApplicationStatus}
                />
            </div>
          </article>
        );
      })}
            </div>
          </section>
        );
      })}

      {activeDetailsApplication
        ? createPortal(
            <ApplicationDetails
              application={activeDetailsApplication}
              documents={documents}
              attachApplicationDocuments={attachApplicationDocuments}
              addApplicationNote={addApplicationNote}
              addApplicationNoteFolder={addApplicationNoteFolder}
              deleteApplicationFile={deleteApplicationFile}
              addEmailLog={addEmailLog}
              addInterview={addInterview}
              deleteApplicationNote={deleteApplicationNote}
              deleteApplicationNoteFolder={deleteApplicationNoteFolder}
              deleteEmailLog={deleteEmailLog}
              deleteInterview={deleteInterview}
              moveApplicationNote={moveApplicationNote}
              saveOfferDetails={saveOfferDetails}
              updateApplication={updateApplication}
              updateApplicationNote={updateApplicationNote}
              updateEmailLog={updateEmailLog}
              updateInterview={updateInterview}
              uploadApplicationFile={uploadApplicationFile}
              onDetailsChanged={() => void openDetails(activeDetailsApplication)}
              onClose={() => setDetailsApplication(null)}
            />,
            document.body,
          )
        : null}

      {deleteTarget
        ? createPortal(
            <DeleteConfirmation
              target={deleteTarget}
              action={deleteApplications}
              onCancel={() => setDeleteTarget(null)}
            />,
            document.body,
          )
        : null}
    </div>
    </TimeZoneContext.Provider>
  );
}

function InlineMeta({
  label,
  value,
  theme,
  money = false,
  valueClassName,
}: {
  label: string;
  value: string;
  theme: { metaLabel: string; metaValue: string };
  money?: boolean;
  valueClassName?: string;
}) {
  return (
    <span className="min-w-0 break-words">
      <span className={theme.metaLabel}>{label}</span>
      <span className="mx-1.5 text-slate-600">/</span>
      <span className={money ? "text-yellow-300 drop-shadow-[0_0_12px_rgb(250_204_21/0.52)]" : valueClassName ?? theme.metaValue}>{value}</span>
    </span>
  );
}

function orderApplications(applications: ApplicationSummary[], orderedIds: string[]) {
  const applicationById = new Map(applications.map((application) => [application.id, application]));
  const ordered = orderedIds
    .map((id) => applicationById.get(id))
    .filter((application): application is ApplicationSummary => Boolean(application));
  const orderedIdSet = new Set(orderedIds);
  const missing = applications.filter((application) => !orderedIdSet.has(application.id));

  return [...ordered, ...missing];
}

function statusRank(status: ApplicationStatus) {
  if (status === "REJECTED") return -1;
  if (status === "APPLIED") return 0;
  if (status === "INTERVIEWING") return 1;
  if (status === "OFFER") return 2;

  return 0;
}
