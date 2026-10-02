"use client";

import { createContext, useContext, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { Dialog } from "./ui/dialog";
import { ActionForm, mutationFeedback, UnsavedChangesProvider, uploadError, useDiscardChanges } from "./ui/action-form";
import type { ApplicationDetail, ApplicationSummary } from "./application-types";
import type { UserDocumentItem } from "./document-types";
import { jobIdSource } from "@/lib/job-id";
import { EmailLogSection, InterviewSection, NoteEditor } from "./application-workspaces";

type DeleteTarget = {
  ids: string[];
  label: string;
};

type RankAnimation = { direction: "up" | "down"; status: ApplicationStatus };

type DetailSection = "additionalDetails" | "notes" | "files" | "emailLog" | "interviews" | "offer" | "history";
const TimeZoneContext = createContext("UTC");
const subscribeTimeZone = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const serverTimeZone = () => "UTC";

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

const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

const statusSelectTextStyles: Record<ApplicationStatus, string> = {
  APPLIED: "text-blue-200",
  INTERVIEWING: "text-fuchsia-200",
  OFFER: "text-white",
  REJECTED: "text-rose-200",
};

const statusDropdownStyles: Record<ApplicationStatus, { button: string; menu: string; option: string; dot: string }> = {
  APPLIED: {
    button: "border-blue-400/30 bg-blue-950/30 text-blue-100 shadow-[0_0_18px_rgb(37_99_235/0.12)] hover:border-blue-300/55 hover:bg-blue-500/12",
    menu: "border-blue-400/25 bg-slate-950/95 shadow-blue-950/35",
    option: "hover:border-blue-300/40 hover:bg-blue-500/12 hover:text-blue-100",
    dot: "bg-blue-400 shadow-[0_0_12px_rgb(96_165_250/0.75)]",
  },
  INTERVIEWING: {
    button: "border-fuchsia-400/35 bg-fuchsia-950/25 text-fuchsia-100 shadow-[0_0_22px_rgb(168_85_247/0.16)] hover:border-fuchsia-300/60 hover:bg-fuchsia-500/12",
    menu: "border-fuchsia-400/25 bg-slate-950/95 shadow-purple-950/40",
    option: "hover:border-fuchsia-300/45 hover:bg-fuchsia-500/12 hover:text-fuchsia-100",
    dot: "bg-fuchsia-400 shadow-[0_0_14px_rgb(232_121_249/0.78)]",
  },
  OFFER: {
    button: "border-orange-300/55 bg-orange-950/35 text-white shadow-[0_0_26px_rgb(251_146_60/0.22)] hover:border-yellow-100/75 hover:bg-orange-500/14",
    menu: "border-orange-300/35 bg-slate-950/95 shadow-orange-950/45",
    option: "hover:border-orange-200/50 hover:bg-orange-500/14 hover:text-orange-50",
    dot: "bg-yellow-300 shadow-[0_0_16px_rgb(250_204_21/0.95)]",
  },
  REJECTED: {
    button: "border-rose-400/35 bg-rose-950/25 text-rose-100 shadow-[0_0_18px_rgb(225_29_72/0.14)] hover:border-rose-300/60 hover:bg-rose-500/12",
    menu: "border-rose-400/25 bg-slate-950/95 shadow-rose-950/40",
    option: "hover:border-rose-300/45 hover:bg-rose-500/12 hover:text-rose-100",
    dot: "bg-rose-400 shadow-[0_0_14px_rgb(251_113_133/0.78)]",
  },
};

const rowStatusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "border-blue-400/25 hover:border-blue-400/70 hover:bg-blue-500/[0.08] hover:shadow-[0_0_28px_rgb(37_99_235/0.14)]",
  INTERVIEWING: "border-purple-400/35 hover:border-fuchsia-300/80 hover:bg-[radial-gradient(circle_at_18%_50%,rgb(192_132_252/0.14),transparent_34%),linear-gradient(90deg,rgb(88_28_135/0.24),rgb(15_23_42/0.28))] hover:shadow-[0_0_36px_rgb(168_85_247/0.28),inset_0_0_18px_rgb(168_85_247/0.08)]",
  OFFER: "border-orange-400/60 hover:border-yellow-100 hover:bg-[radial-gradient(circle_at_18%_50%,rgb(251_146_60/0.34),transparent_32%),radial-gradient(circle_at_75%_45%,rgb(253_186_116/0.20),transparent_28%),linear-gradient(90deg,rgb(154_52_18/0.56),rgb(15_23_42/0.25))] hover:shadow-[0_0_72px_rgb(251_146_60/0.52),0_0_26px_rgb(253_186_116/0.32),inset_0_0_34px_rgb(245_158_11/0.18)]",
  REJECTED: "border-rose-400/25 hover:border-rose-400/70 hover:bg-rose-500/[0.07] hover:shadow-[0_0_28px_rgb(225_29_72/0.14)]",
};

const rowStatusBaseStyles: Record<ApplicationStatus, string> = {
  APPLIED: "border-blue-400/25",
  INTERVIEWING: "border-purple-400/35",
  OFFER: "border-orange-400/60",
  REJECTED: "border-rose-400/25",
};

const rowStatusFocusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "focus:border-blue-400/70 focus:bg-blue-500/[0.08] focus:shadow-[0_0_28px_rgb(37_99_235/0.14)]",
  INTERVIEWING: "focus:border-fuchsia-300/80 focus:bg-[radial-gradient(circle_at_18%_50%,rgb(192_132_252/0.14),transparent_34%),linear-gradient(90deg,rgb(88_28_135/0.24),rgb(15_23_42/0.28))] focus:shadow-[0_0_36px_rgb(168_85_247/0.28),inset_0_0_18px_rgb(168_85_247/0.08)]",
  OFFER: "focus:border-yellow-100 focus:bg-[radial-gradient(circle_at_18%_50%,rgb(251_146_60/0.34),transparent_32%),radial-gradient(circle_at_75%_45%,rgb(253_186_116/0.20),transparent_28%),linear-gradient(90deg,rgb(154_52_18/0.56),rgb(15_23_42/0.25))] focus:shadow-[0_0_72px_rgb(251_146_60/0.52),0_0_26px_rgb(253_186_116/0.32),inset_0_0_34px_rgb(245_158_11/0.18)]",
  REJECTED: "focus:border-rose-400/70 focus:bg-rose-500/[0.07] focus:shadow-[0_0_28px_rgb(225_29_72/0.14)]",
};

const selectedRowStatusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "border-blue-300 bg-blue-500/[0.10] ring-2 ring-sky-300/80 ring-offset-2 ring-offset-slate-950",
  INTERVIEWING: "border-fuchsia-300 bg-[radial-gradient(circle_at_18%_50%,rgb(192_132_252/0.14),transparent_34%),linear-gradient(90deg,rgb(88_28_135/0.24),rgb(15_23_42/0.28))] ring-2 ring-sky-300/80 ring-offset-2 ring-offset-slate-950",
  OFFER: "border-yellow-100 bg-[radial-gradient(circle_at_18%_50%,rgb(251_146_60/0.34),transparent_32%),radial-gradient(circle_at_75%_45%,rgb(253_186_116/0.20),transparent_28%),linear-gradient(90deg,rgb(154_52_18/0.56),rgb(15_23_42/0.25))] ring-2 ring-sky-300/80 ring-offset-2 ring-offset-slate-950",
  REJECTED: "border-rose-300 bg-rose-500/[0.10] ring-2 ring-sky-300/80 ring-offset-2 ring-offset-slate-950",
};

const rankHoldStatusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "rank-hold rank-hold-applied",
  INTERVIEWING: "rank-hold rank-hold-interviewing",
  OFFER: "rank-hold rank-hold-offer",
  REJECTED: "rank-hold rank-hold-rejected",
};

const textStatusStyles: Record<ApplicationStatus, { title: string; role: string; metaLabel: string; metaValue: string; time: string; action: string }> = {
  APPLIED: {
    title: "rank-title rank-title-water text-blue-50 hover:text-blue-200",
    role: "text-blue-100/80",
    metaLabel: "text-blue-300/45",
    metaValue: "text-blue-50/90",
    time: "text-blue-200",
    action: "border-blue-300/20 text-blue-100 hover:bg-blue-400/10 hover:border-blue-300/45",
  },
  INTERVIEWING: {
    title: "rank-title rank-title-dark-aura text-fuchsia-50 hover:text-fuchsia-200",
    role: "text-purple-100/88",
    metaLabel: "text-fuchsia-300/52",
    metaValue: "text-purple-50/95",
    time: "text-fuchsia-200",
    action: "border-fuchsia-300/24 text-fuchsia-100 hover:bg-fuchsia-400/10 hover:border-fuchsia-300/55",
  },
  OFFER: {
    title: "rank-title rank-title-angelic text-orange-100 hover:text-orange-50",
    role: "text-orange-100",
    metaLabel: "text-orange-200/70",
    metaValue: "text-amber-50",
    time: "text-amber-100 drop-shadow-[0_0_12px_rgb(251_146_60/0.48)]",
    action: "border-orange-200/35 text-orange-50 hover:bg-orange-400/14 hover:border-yellow-100/70 hover:shadow-[0_0_18px_rgb(251_146_60/0.22)]",
  },
  REJECTED: {
    title: "text-rose-50 hover:text-rose-200",
    role: "text-rose-100/75",
    metaLabel: "text-rose-300/45",
    metaValue: "text-rose-50/85",
    time: "text-rose-200",
    action: "border-rose-300/20 text-rose-100 hover:bg-rose-400/10 hover:border-rose-300/45",
  },
};

const salaryRankStyles: Record<ApplicationStatus, string> = {
  REJECTED: "text-amber-200/70",
  APPLIED: "salary-glow-applied",
  INTERVIEWING: "text-yellow-100 salary-glow-interviewing",
  OFFER: "text-yellow-50 salary-glow-offer",
};

const gameMenuStatusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "game-menu-applied",
  INTERVIEWING: "game-menu-interviewing",
  OFFER: "game-menu-offer",
  REJECTED: "game-menu-rejected",
};

const modalStatusStyles: Record<ApplicationStatus, { overlay: string; shell: string; scrollbar: string; eyebrow: string; button: string; link: string; fieldBorder: string; fieldLabel: string; fieldFocus: string; fieldInput: string; fieldGlow: string; editIcon: string; tile: string; timeline: string; timelineItem: string }> = {
  APPLIED: {
    overlay: "details-overlay-applied",
    shell: "border-blue-400/25 bg-[radial-gradient(circle_at_top_left,rgb(37_99_235/0.12),transparent_34%),#0f172a] shadow-blue-950/30",
    scrollbar: "details-scroll-applied",
    eyebrow: "text-blue-300",
    button: "bg-blue-500 text-slate-950 hover:bg-blue-300",
    link: "text-blue-300 hover:text-blue-200",
    fieldBorder: "border-blue-400/30",
    fieldLabel: "text-blue-300",
    fieldFocus: "focus:border-blue-400",
    fieldInput: "border-blue-400/25 bg-blue-950/35 text-blue-50 focus:bg-blue-950/50 focus:shadow-[0_0_24px_rgb(59_130_246/0.2)]",
    fieldGlow: "hover:border-blue-300/55 hover:shadow-[0_8px_18px_-18px_rgb(96_165_250/0.95),0_1px_0_rgb(96_165_250/0.55)] focus-within:border-blue-300/65 focus-within:shadow-[0_8px_20px_-18px_rgb(96_165_250/1),0_1px_0_rgb(96_165_250/0.65)]",
    editIcon: "border-blue-300/45 bg-blue-400/12 text-blue-100 hover:border-blue-200/70 hover:bg-blue-400/22 hover:shadow-[0_0_20px_rgb(59_130_246/0.24)]",
    tile: "border-blue-400/18 bg-blue-950/10",
    timeline: "border-blue-400/20 bg-blue-950/20",
    timelineItem: "border border-blue-400/15 bg-blue-950/16",
  },
  INTERVIEWING: {
    overlay: "details-overlay-interviewing",
    shell: "border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_left,rgb(168_85_247/0.16),transparent_34%),#0f1020] shadow-purple-950/35",
    scrollbar: "details-scroll-interviewing",
    eyebrow: "text-fuchsia-300",
    button: "bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_18px_rgb(99_102_241/0.22)]",
    link: "text-fuchsia-300 hover:text-fuchsia-200",
    fieldBorder: "border-fuchsia-400/30",
    fieldLabel: "text-fuchsia-300",
    fieldFocus: "focus:border-fuchsia-400",
    fieldInput: "border-fuchsia-400/25 bg-fuchsia-950/30 text-fuchsia-50 focus:bg-fuchsia-950/45 focus:shadow-[0_0_24px_rgb(217_70_239/0.2)]",
    fieldGlow: "hover:border-fuchsia-300/55 hover:shadow-[0_8px_18px_-18px_rgb(232_121_249/0.95),0_1px_0_rgb(232_121_249/0.55)] focus-within:border-fuchsia-300/65 focus-within:shadow-[0_8px_20px_-18px_rgb(232_121_249/1),0_1px_0_rgb(232_121_249/0.65)]",
    editIcon: "border-fuchsia-300/45 bg-fuchsia-400/12 text-fuchsia-100 hover:border-fuchsia-200/70 hover:bg-fuchsia-400/22 hover:shadow-[0_0_22px_rgb(217_70_239/0.24)]",
    tile: "border-fuchsia-400/18 bg-fuchsia-950/10",
    timeline: "border-fuchsia-400/20 bg-fuchsia-950/20",
    timelineItem: "border border-fuchsia-400/15 bg-fuchsia-950/16",
  },
  OFFER: {
    overlay: "details-overlay-offer",
    shell: "border-orange-300/35 bg-[radial-gradient(circle_at_top_left,rgb(251_146_60/0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgb(253_186_116/0.14),transparent_30%),#140b08] shadow-orange-950/45",
    scrollbar: "details-scroll-offer",
    eyebrow: "text-orange-200 drop-shadow-[0_0_10px_rgb(251_146_60/0.35)]",
    button: "bg-orange-500 text-slate-950 hover:bg-orange-300 shadow-[0_0_22px_rgb(251_146_60/0.28)]",
    link: "text-orange-200 hover:text-yellow-100",
    fieldBorder: "border-orange-300/35",
    fieldLabel: "text-orange-200",
    fieldFocus: "focus:border-orange-300",
    fieldInput: "border-orange-300/30 bg-orange-950/30 text-orange-50 focus:bg-orange-950/45 focus:shadow-[0_0_26px_rgb(251_146_60/0.24)]",
    fieldGlow: "hover:border-orange-200/60 hover:shadow-[0_8px_18px_-18px_rgb(251_146_60/0.98),0_1px_0_rgb(251_146_60/0.58)] focus-within:border-orange-200/70 focus-within:shadow-[0_8px_22px_-18px_rgb(251_146_60/1),0_1px_0_rgb(251_146_60/0.7)]",
    editIcon: "border-orange-200/55 bg-orange-400/14 text-orange-50 hover:border-yellow-100/80 hover:bg-orange-400/24 hover:shadow-[0_0_24px_rgb(251_146_60/0.3)]",
    tile: "border-orange-300/20 bg-orange-950/10",
    timeline: "border-orange-300/25 bg-orange-950/20",
    timelineItem: "border border-orange-300/18 bg-orange-950/16",
  },
  REJECTED: {
    overlay: "details-overlay-rejected",
    shell: "border-rose-400/25 bg-[radial-gradient(circle_at_top_left,rgb(225_29_72/0.12),transparent_34%),#120b12] shadow-rose-950/30",
    scrollbar: "details-scroll-rejected",
    eyebrow: "text-rose-300",
    button: "bg-rose-500 text-white hover:bg-rose-400",
    link: "text-rose-300 hover:text-rose-200",
    fieldBorder: "border-rose-400/30",
    fieldLabel: "text-rose-300",
    fieldFocus: "focus:border-rose-400",
    fieldInput: "border-rose-400/25 bg-rose-950/30 text-rose-50 focus:bg-rose-950/45 focus:shadow-[0_0_24px_rgb(244_63_94/0.2)]",
    fieldGlow: "hover:border-rose-300/55 hover:shadow-[0_8px_18px_-18px_rgb(251_113_133/0.95),0_1px_0_rgb(251_113_133/0.55)] focus-within:border-rose-300/65 focus-within:shadow-[0_8px_20px_-18px_rgb(251_113_133/1),0_1px_0_rgb(251_113_133/0.65)]",
    editIcon: "border-rose-300/45 bg-rose-400/12 text-rose-100 hover:border-rose-200/70 hover:bg-rose-400/22 hover:shadow-[0_0_20px_rgb(244_63_94/0.24)]",
    tile: "border-rose-400/18 bg-rose-950/10",
    timeline: "border-rose-400/20 bg-rose-950/20",
    timelineItem: "border border-rose-400/15 bg-rose-950/16",
  },
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

function hasDraggedFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes("Files");
}

function withoutBorderClasses(className: string) {
  return className
    .split(" ")
    .filter((item) => item !== "border" && !item.startsWith("border-"))
    .join(" ");
}

function ApplicationDetails({
  application,
  documents,
  attachApplicationDocuments,
  addApplicationNote,
  addApplicationNoteFolder,
  addEmailLog,
  addInterview,
  deleteApplicationFile,
  deleteApplicationNote,
  deleteApplicationNoteFolder,
  deleteEmailLog,
  deleteInterview,
  moveApplicationNote,
  saveOfferDetails,
  updateApplication,
  updateApplicationNote,
  updateEmailLog,
  updateInterview,
  uploadApplicationFile,
  onDetailsChanged,
  onClose,
}: {
  application: ApplicationDetail;
  documents: UserDocumentItem[];
  attachApplicationDocuments: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addApplicationNote: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addApplicationNoteFolder: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addEmailLog: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addInterview: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  deleteApplicationFile: (fileId: string) => unknown | Promise<unknown>;
  deleteApplicationNote: (noteId: string) => unknown | Promise<unknown>;
  deleteApplicationNoteFolder: (folderId: string) => unknown | Promise<unknown>;
  deleteEmailLog: (emailLogId: string) => unknown | Promise<unknown>;
  deleteInterview: (interviewId: string) => unknown | Promise<unknown>;
  moveApplicationNote: (noteId: string, folderId: string) => unknown | Promise<unknown>;
  saveOfferDetails: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  updateApplication: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  updateApplicationNote: (noteId: string, formData: FormData) => unknown | Promise<unknown>;
  updateEmailLog: (emailLogId: string, formData: FormData) => unknown | Promise<unknown>;
  updateInterview: (interviewId: string, formData: FormData) => unknown | Promise<unknown>;
  uploadApplicationFile: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  onDetailsChanged: () => void;
  onClose: () => void;
}) {
  const timeZone = useContext(TimeZoneContext);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [activeDetailSection, setActiveDetailSection] = useState<DetailSection | null>(null);
  const [keyboardNavigatingSections, setKeyboardNavigatingSections] = useState(false);
  const detailFieldsRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const returnFocusFieldRef = useRef<string | null>(null);
  const sectionGridRef = useRef<HTMLDivElement>(null);
  const backToDetailsRef = useRef<HTMLButtonElement>(null);
  const returnFocusSectionRef = useRef<DetailSection | null>(null);
  const hasUnsavedChangesRef = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  const modalTheme = modalStatusStyles[application.status];
  const detailSectionButtons: Array<{ id: DetailSection; label: string }> = [
    { id: "additionalDetails", label: "Additional details" },
    { id: "notes", label: "Notes" },
    { id: "files", label: "Files" },
    { id: "emailLog", label: "Email log" },
    ...(application.status === "INTERVIEWING" || application.interviews.length > 0 ? [{ id: "interviews" as const, label: "Interviews" }] : []),
    ...(application.status === "OFFER" || application.offerDetails ? [{ id: "offer" as const, label: "Offer details" }] : []),
    { id: "history", label: "History" },
  ];
  const activeSectionLabel = detailSectionButtons.find((section) => section.id === activeDetailSection)?.label;

  useEffect(() => {
    if (activeDetailSection) {
      backToDetailsRef.current?.focus();
    } else if (returnFocusSectionRef.current) {
      sectionGridRef.current?.querySelector<HTMLButtonElement>(`[data-detail-section="${returnFocusSectionRef.current}"]`)?.focus();
      returnFocusSectionRef.current = null;
    }
  }, [activeDetailSection]);

  useEffect(() => {
    if (editingField || activeDetailSection || !returnFocusFieldRef.current) return;
    detailFieldsRef.current?.querySelector<HTMLElement>(`[data-detail-field="${returnFocusFieldRef.current}"]`)?.focus();
    returnFocusFieldRef.current = null;
  }, [editingField, activeDetailSection]);

  function requestDiscard(action: () => void) {
    if (hasUnsavedChangesRef.current) {
      setDiscardAction(() => action);
      setConfirmDiscard(true);
    } else {
      action();
    }
  }

  const editDescriptionWithEnter = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Enter" || event.repeat || event.altKey || event.ctrlKey || event.metaKey || activeDetailSection || editingField || confirmDiscard) return;
    const description = descriptionRef.current;
    if (!description) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
    if (target instanceof Element && description.contains(target) && target.closest("button, a")) return;
    if (!description.matches(":hover") && !(target instanceof Node && description.contains(target))) return;
    event.preventDefault();
    event.stopPropagation();
    requestDiscard(() => setEditingField("jobDescription"));
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => editDescriptionWithEnter(event);
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  function backToDetails() {
    requestDiscard(() => {
      returnFocusSectionRef.current = activeDetailSection;
      setActiveDetailSection(null);
      setEditingField(null);
    });
  }

  function finishEditingField(name: string) {
    if (!activeDetailSection) returnFocusFieldRef.current = name;
    setEditingField(null);
    if (activeDetailSection) backToDetailsRef.current?.focus();
  }

  function handleEscape() {
    if (editingField) finishEditingField(editingField);
    else if (activeDetailSection) backToDetails();
    else requestDiscard(onClose);
  }

  function handleBackspace() {
    if (editingField) requestDiscard(() => finishEditingField(editingField));
    else if (activeDetailSection) backToDetails();
    else requestDiscard(onClose);
  }

  return (
    <UnsavedChangesProvider onChange={(isDirty) => {
      hasUnsavedChangesRef.current = isDirty;
    }} onDiscardRequest={requestDiscard} onMutationSuccess={onDetailsChanged}>
    <Dialog label={`${application.company} application details`} onClose={() => activeDetailSection ? backToDetails() : requestDiscard(onClose)} onEscape={handleEscape} onBack={handleBackspace} initialFocusSelector="[data-detail-section='additionalDetails']" className={`details-overlay fixed inset-0 z-50 p-3 backdrop-blur-sm sm:p-5 ${modalTheme.overlay}`}>
      <div data-details-scroll className={`${modalTheme.scrollbar} h-full w-full overscroll-contain overflow-y-auto rounded-[0.75rem] p-5 sm:p-7 ${withoutBorderClasses(modalTheme.shell)}`}>
        {!activeDetailSection ? (
          <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                {application.companyLogoPath ? <CompanyLogo applicationId={application.id} large /> : null}
                <div className="min-w-0">
                  <h2 className={`break-words text-3xl font-black ${textStatusStyles[application.status].title}`}>{application.company}</h2>
                  <p className={`break-words font-semibold ${textStatusStyles[application.status].role}`}>{application.role}</p>
                  <div className="details-header-meta mt-3 flex flex-wrap items-start gap-x-6 gap-y-2">
                    <InlineEditableDetail application={application} editing={editingField === "appliedAt"} theme={modalTheme} label="Applied at" name="appliedAt" type="datetime-local" value={`Applied ${formatDateTime(application.appliedAt, timeZone)}`} defaultValue={toDatetimeLocal(application.appliedAt)} hideLabel updateApplication={updateApplication} onEdit={() => requestDiscard(() => setEditingField("appliedAt"))} onDone={() => setEditingField(null)} />
                    {application.salary?.trim() || editingField === "salary" ? (
                      <InlineEditableDetail application={application} editing={editingField === "salary"} theme={modalTheme} label="Salary" name="salary" value={application.salary ?? ""} defaultValue={application.salary ?? ""} valueClassName={salaryRankStyles[application.status]} hideLabel updateApplication={updateApplication} onEdit={() => requestDiscard(() => setEditingField("salary"))} onDone={() => setEditingField(null)} />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {application.jobUrl ? (
                <button
                  type="button"
                  className={`rounded-full px-5 py-3 text-sm font-bold ${modalTheme.button}`}
                  onClick={() => window.open(application.jobUrl ?? "", "_blank", "noopener,noreferrer")}
                >
                  Open job post
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/10"
                onClick={() => requestDiscard(onClose)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        {activeDetailSection ? (
          <div className="detail-workspace">
            <div className="detail-workspace-header flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.2em] ${modalTheme.eyebrow}`}>{application.company} · {application.role}</p>
                <h3 className="mt-1 text-2xl font-black text-slate-100">{activeSectionLabel}</h3>
              </div>
              <button
                ref={backToDetailsRef}
                type="button"
                className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/10"
                onClick={backToDetails}
              >
                Back to details
              </button>
            </div>
            {activeDetailSection === "additionalDetails" ? (
              <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
                {(["company", "role", "jobUrl", "jobId", "notes"] as const).map((name) => (
                  <InlineEditableDetail key={name} application={application} editing={editingField === name} theme={modalTheme} label={{ company: "Company", role: "Role", jobUrl: "Job posting link", jobId: "Job ID", notes: "Application notes" }[name]} name={name} type={name === "jobUrl" ? "url" : "text"} multiline={name === "notes"} value={name === "jobId" ? formatJobId(application.jobId, application.jobUrl) : application[name] || "Not added"} defaultValue={application[name] ?? ""} updateApplication={updateApplication} onEdit={() => requestDiscard(() => setEditingField(name))} onDone={() => finishEditingField(name)} />
                ))}
                <Detail label="Last updated" value={formatDateTime(application.updatedAt, timeZone)} navigationId="updatedAt" theme={modalTheme} />
                <InlineEditableDetail application={application} editing={editingField === "salary"} theme={modalTheme} label="Salary" name="salary" value={application.salary || "Not disclosed"} defaultValue={application.salary ?? ""} valueClassName={salaryRankStyles[application.status]} updateApplication={updateApplication} onEdit={() => requestDiscard(() => setEditingField("salary"))} onDone={() => finishEditingField("salary")} />
                <InlineEditableDetail application={application} editing={editingField === "location"} theme={modalTheme} label="Location" name="location" value={application.location || "Missing"} defaultValue={application.location ?? ""} updateApplication={updateApplication} onEdit={() => requestDiscard(() => setEditingField("location"))} onDone={() => finishEditingField("location")} />
                <InlineEditableDetail application={application} editing={editingField === "jobPostedAt"} theme={modalTheme} label="Posting date" name="jobPostedAt" value={application.jobPostedAt || "Unknown"} defaultValue={application.jobPostedAt ?? ""} updateApplication={updateApplication} onEdit={() => requestDiscard(() => setEditingField("jobPostedAt"))} onDone={() => finishEditingField("jobPostedAt")} />
              </div>
            ) : null}
            {activeDetailSection === "notes" ? (
              <ApplicationNotesSection
                application={application}
                addApplicationNote={addApplicationNote}
                addApplicationNoteFolder={addApplicationNoteFolder}
                deleteApplicationNote={deleteApplicationNote}
                deleteApplicationNoteFolder={deleteApplicationNoteFolder}
                moveApplicationNote={moveApplicationNote}
                theme={modalTheme}
                updateApplicationNote={updateApplicationNote}
                onNotesChanged={onDetailsChanged}
              />
            ) : null}
            {activeDetailSection === "files" ? (
              <ApplicationFiles
                application={application}
                documents={documents}
                attachApplicationDocuments={attachApplicationDocuments}
                deleteApplicationFile={deleteApplicationFile}
                theme={modalTheme}
                uploadApplicationFile={uploadApplicationFile}
              />
            ) : null}
            {activeDetailSection === "emailLog" ? (
              <EmailLogSection application={application} addEmailLog={addEmailLog} deleteEmailLog={deleteEmailLog} updateEmailLog={updateEmailLog} theme={modalTheme} timeZone={timeZone} />
            ) : null}
            {activeDetailSection === "interviews" ? (
              <InterviewSection application={application} addInterview={addInterview} deleteInterview={deleteInterview} updateInterview={updateInterview} theme={modalTheme} timeZone={timeZone} />
            ) : null}
            {activeDetailSection === "offer" ? (
              <OfferDetailsSection application={application} saveOfferDetails={saveOfferDetails} theme={modalTheme} />
            ) : null}
            {activeDetailSection === "history" ? <StatusHistorySection application={application} theme={modalTheme} /> : null}
          </div>
        ) : (
          <>
          <div className="mt-5 grid items-start gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <div ref={detailFieldsRef} className="detail-workspace min-w-0" onKeyDown={(event) => {
              if (event.target instanceof HTMLElement && event.key === "ArrowRight" && !event.target.closest("input, textarea, select, [contenteditable='true']")) {
                event.preventDefault();
                event.stopPropagation();
                setKeyboardNavigatingSections(true);
                sectionGridRef.current?.querySelector<HTMLButtonElement>('[data-detail-section="additionalDetails"]')?.focus();
                return;
              }
              if (!(event.target instanceof HTMLElement) || !event.target.matches("[data-detail-field]")) return;
              const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-detail-field]"));
              const index = fields.indexOf(event.target);
              if (event.key === "Enter") {
                event.preventDefault();
                requestDiscard(() => setEditingField("jobDescription"));
              } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                const next = index + (event.key === "ArrowDown" ? 1 : -1);
                if (next < 0 || next >= fields.length) return;
                event.preventDefault();
                fields[next].focus();
              }
            }}>
              <div ref={descriptionRef} data-detail-field="jobDescription" tabIndex={0} role="group" aria-label="Job description" aria-keyshortcuts="Enter">
                <InlineEditableDetail application={application} editing={editingField === "jobDescription"} theme={modalTheme} label="Job description" name="jobDescription" value={application.jobDescription || "No job description added"} defaultValue={application.jobDescription ?? ""} multiline hideLabel updateApplication={updateApplication} onEdit={() => requestDiscard(() => setEditingField("jobDescription"))} onDone={() => finishEditingField("jobDescription")} />
              </div>
            </div>
            <div className="min-w-0 border-t border-white/10 pt-4 lg:border-t-0 lg:pt-0">
              <div ref={sectionGridRef} className={`detail-section-grid grid grid-cols-3 gap-2 ${keyboardNavigatingSections ? "keyboard-navigating" : ""}`} onPointerMove={(event) => {
                if (event.pointerType === "mouse") setKeyboardNavigatingSections(false);
              }} onKeyDown={(event) => {
                const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
                const index = buttons.indexOf(event.target as HTMLButtonElement);
                if (index < 0) return;
                if (event.key === "ArrowLeft" && index % 3 === 0) {
                  event.preventDefault();
                  setKeyboardNavigatingSections(true);
                  detailFieldsRef.current?.querySelector<HTMLElement>('[data-detail-field="jobDescription"]')?.focus();
                  return;
                }
                const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
                const offset = offsets[event.key];
                const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : offset === undefined ? -1 : index + offset;
                if (next < 0 || next >= buttons.length) return;
                event.preventDefault();
                setKeyboardNavigatingSections(true);
                buttons[next].focus();
              }}>
                {detailSectionButtons.map((section) => (
                  <button
                    key={section.id}
                    data-detail-section={section.id}
                    type="button"
                    className={`game-menu-button aspect-square min-h-0 px-3 py-2 text-center text-slate-200 ${gameMenuStatusStyles[application.status]}`}
                    onClick={() => {
                      requestDiscard(() => {
                        setActiveDetailSection(section.id);
                        setEditingField(null);
                      });
                    }}
                  >
                    <span className="game-menu-button-grid">
                      <span className="min-w-0">
                        <span className="block text-sm font-black uppercase tracking-[0.08em]">{section.label}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </Dialog>
    {confirmDiscard ? (
      <DiscardChangesConfirmation
        onCancel={() => setConfirmDiscard(false)}
        onDiscard={() => {
          discardAction?.();
          setDiscardAction(null);
          setConfirmDiscard(false);
        }}
      />
    ) : null}
    </UnsavedChangesProvider>
  );
}

function CompanyLogo({ applicationId, card = false, large = false }: { applicationId: string; card?: boolean; large?: boolean }) {
  return (
    // The authenticated source route needs the browser's session cookie.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      loading="lazy"
      decoding="async"
      src={`/applications/${applicationId}/logo`}
      alt=""
      className={`${card || large ? "size-28" : "size-8"} shrink-0 object-contain`}
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
}

function DetailEmptyState({ icon, title, description }: { icon: "file" | "folder" | "mail" | "calendar-plus"; title: string; description: string }) {
  return (
    <div className="detail-empty-state">
      <span className="detail-empty-icon"><DirectoryIcon name={icon} /></span>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function ApplicationNotesSection({
  application,
  addApplicationNote,
  addApplicationNoteFolder,
  deleteApplicationNote,
  deleteApplicationNoteFolder,
  moveApplicationNote,
  theme,
  updateApplicationNote,
  onNotesChanged,
}: {
  application: ApplicationDetail;
  addApplicationNote: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addApplicationNoteFolder: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  deleteApplicationNote: (noteId: string) => unknown | Promise<unknown>;
  deleteApplicationNoteFolder: (folderId: string) => unknown | Promise<unknown>;
  moveApplicationNote: (noteId: string, folderId: string) => unknown | Promise<unknown>;
  theme: { timeline: string; timelineItem: string; eyebrow: string; button: string; fieldInput: string };
  updateApplicationNote: (noteId: string, formData: FormData) => unknown | Promise<unknown>;
  onNotesChanged: () => void;
}) {
  const timeZone = useContext(TimeZoneContext);
  const requestDiscard = useDiscardChanges();
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isNoteSidebarOpen, setIsNoteSidebarOpen] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [folderDropTargetId, setFolderDropTargetId] = useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [isMoving, startMove] = useTransition();
  const [moveError, setMoveError] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const selectedNote = application.noteEntries.find((note) => note.id === selectedNoteId) ?? application.noteEntries[0] ?? null;
  const editingNote = application.noteEntries.find((note) => note.id === editingNoteId) ?? null;
  const matchesNote = (note: ApplicationDetail["noteEntries"][number]) => `${note.title} ${note.body}`.toLowerCase().includes(noteQuery.toLowerCase());
  const rootNotes = application.noteEntries.filter((note) => note.folderId === null && matchesNote(note));

  function toggleFolder(folderId: string) {
    requestDiscard(() => {
      setSelectedFolderId(folderId);
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        if (next.has(folderId)) next.delete(folderId);
        else next.add(folderId);
        return next;
      });
    });
  }

  function isNoteDrag(event: React.DragEvent) {
    return draggedNoteId !== null || Array.from(event.dataTransfer.types).includes("application/x-jobpilot-note");
  }

  function moveNote(noteId: string, folderId: string) {
    if (isMoving) return;
    requestDiscard(() => {
      setEditingNoteId(null);
      setIsAddingNote(false);
      setMoveError("");
      startMove(async () => {
        try {
          const result = mutationFeedback(await moveApplicationNote(noteId, folderId));
          if (!result.success) { setMoveError(result.message); return; }
          if (folderId) setExpandedFolderIds((current) => new Set([...current, folderId]));
          setSelectedFolderId(folderId || null);
          setSelectedNoteId(noteId);
          onNotesChanged();
        } catch {
          setMoveError("Could not move the note. Please try again.");
        }
      });
    });
  }

  function dropHandlers(folderId: string) {
    return {
      onDragOver: (event: React.DragEvent) => {
        if (!isNoteDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setFolderDropTargetId(folderId);
      },
      onDragLeave: (event: React.DragEvent) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setFolderDropTargetId(null);
      },
      onDrop: (event: React.DragEvent) => {
        if (!isNoteDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        const noteId = event.dataTransfer.getData("application/x-jobpilot-note") || draggedNoteId;
        setDraggedNoteId(null);
        setFolderDropTargetId(null);
        if (noteId) moveNote(noteId, folderId);
      },
    };
  }

  function startNoteDrag(event: React.DragEvent, noteId: string) {
    event.stopPropagation();
    setDraggedNoteId(noteId);
    event.dataTransfer.setData("application/x-jobpilot-note", noteId);
    event.dataTransfer.setData("text/plain", noteId);
    event.dataTransfer.effectAllowed = "move";
  }

  function selectNote(noteId: string) {
    requestDiscard(() => {
      setSelectedNoteId(noteId);
      setSelectedFolderId(application.noteEntries.find((note) => note.id === noteId)?.folderId ?? null);
      setEditingNoteId(null);
      setIsAddingNote(false);
    });
  }

  return (
    <section className="workspace-shell notes-workspace">
      <div>
        <div className="workspace-topbar">
          <div className="flex min-w-0 items-center gap-2">
            <div><h4>Notebook</h4><p>{application.noteEntries.length} notes · {application.noteFolders.length} folders</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`workspace-button workspace-primary ${theme.button}`} aria-label="New note" title="New note" onClick={() => requestDiscard(() => { setIsAddingNote(true); setEditingNoteId(null); setIsAddingFolder(false); })}>
              <span>+ New note</span>
            </button>
          </div>
        </div>

        {isMoving ? <p role="status" className="mt-3 text-sm text-sky-200">Moving note…</p> : null}
        {moveError ? <p role="alert" className="mt-3 text-sm text-rose-200">{moveError}</p> : null}
        <div className={`workspace-split ${isNoteSidebarOpen ? "" : "workspace-sidebar-collapsed"}`}>
          <div className="workspace-sidebar">
            <div className="flex items-center justify-between gap-2">
            <button type="button" className="workspace-button border-0" aria-expanded={isNoteSidebarOpen} aria-label={isNoteSidebarOpen ? "Collapse notes sidebar" : "Expand notes sidebar"} title={isNoteSidebarOpen ? "Collapse notes sidebar" : "Expand notes sidebar"} onClick={() => setIsNoteSidebarOpen((current) => !current)}>
              <span className="flex items-center gap-2"><DirectoryIcon name="menu" />{isNoteSidebarOpen ? <span className="text-xs font-semibold">Notes & folders</span> : null}</span>
            </button>
            {isNoteSidebarOpen ? <button type="button" className="workspace-icon-button" aria-label="New folder" title="New folder" onClick={() => requestDiscard(() => { setIsAddingFolder((current) => !current); setIsAddingNote(false); })}><DirectoryIcon name="folder-plus" /></button> : null}
            </div>
            {isNoteSidebarOpen ? <>
            <input type="search" aria-label="Search notes" placeholder="Find a note…" value={noteQuery} onChange={(event) => setNoteQuery(event.target.value)} className="workspace-search mt-3" />
            {isAddingFolder ? <ActionForm action={addApplicationNoteFolder.bind(null, application.id)} onSuccess={() => setIsAddingFolder(false)} className="workspace-folder-form mt-3">
              <input name="name" required autoFocus aria-label="Folder name" placeholder="Folder name" />
              <div className="flex justify-end gap-2"><DiscardButton onDiscard={() => setIsAddingFolder(false)} /><button className={`workspace-button ${theme.button}`} aria-label="Create folder">Create</button></div>
            </ActionForm> : null}
            <div className="notes-explorer mt-3 status-graph-scroll" onDragEnd={() => { setDraggedNoteId(null); setFolderDropTargetId(null); }}>
            <button type="button" className={`notes-tree-root ${folderDropTargetId === "" ? "notes-drop-target" : ""}`} {...dropHandlers("")} onClick={() => setSelectedFolderId(null)} aria-label="Notes root — drop notes here to move out of folders">
              <DirectoryIcon name="folder" /><span>Notes</span><span className="ml-auto text-xs text-slate-500">{application.noteEntries.length}</span>
            </button>
            <ul role="tree" aria-label="Notes explorer" className="notes-tree" onKeyDown={(event) => {
              if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "treeitem") return;
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="treeitem"]'));
              const index = items.indexOf(event.target as HTMLButtonElement);
              const folderId = event.target.dataset.folderId;
              const parentFolderId = event.target.dataset.parentFolder;
              if (event.key === "ArrowRight" && folderId && !expandedFolderIds.has(folderId)) {
                event.preventDefault();
                setExpandedFolderIds((current) => new Set([...current, folderId]));
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                if (folderId && expandedFolderIds.has(folderId)) setExpandedFolderIds((current) => { const next = new Set(current); next.delete(folderId); return next; });
                else if (parentFolderId) items.find((item) => item.dataset.folderId === parentFolderId)?.focus();
              } else {
                const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" || event.key === "ArrowRight" ? index + 1 : event.key === "ArrowUp" ? index - 1 : -1;
                if (next >= 0 && next < items.length) { event.preventDefault(); items[next].focus(); }
              }
            }}>
              {application.noteFolders.map((folder) => {
                const isOpen = expandedFolderIds.has(folder.id) || noteQuery.length > 0;
                const notes = application.noteEntries.filter((note) => note.folderId === folder.id && (folder.name.toLowerCase().includes(noteQuery.toLowerCase()) || matchesNote(note))).sort((a, b) => a.title.localeCompare(b.title));

                return (
                  <li role="none"
                    key={folder.id}
                    data-note-folder={folder.id}
                    {...dropHandlers(folder.id)}
                  >
                    <div className={`notes-tree-row ${folderDropTargetId === folder.id ? "notes-drop-target" : ""}`}>
                      <button type="button" role="treeitem" data-folder-id={folder.id} aria-level={1} aria-selected={selectedFolderId === folder.id && !selectedNoteId} className="notes-tree-label" aria-expanded={isOpen} onClick={() => toggleFolder(folder.id)}>
                        <span aria-hidden="true" className="notes-tree-chevron">{isOpen ? "⌄" : "›"}</span>
                        <span className={theme.eyebrow}><DirectoryIcon name="folder" /></span>
                        <span className="truncate text-sm text-slate-200">{folder.name}</span>
                        <span className="ml-auto text-xs text-slate-500">{notes.length}</span>
                      </button>
                      <ActionForm action={deleteApplicationNoteFolder.bind(null, folder.id)} onSuccess={() => { if (selectedFolderId === folder.id) setSelectedFolderId(null); }}><button className="notes-tree-action" aria-label={`Delete ${folder.name}`} title="Delete folder"><DirectoryIcon name="trash" /></button></ActionForm>
                    </div>
                    {isOpen ? (
                      <ul role="group" className="notes-tree-children">
                        <NoteDirectory notes={notes} selectedNoteId={selectedNoteId} onSelect={selectNote} onEdit={(id) => requestDiscard(() => { setSelectedNoteId(id); setEditingNoteId(id); })} onDragStart={startNoteDrag} deleteApplicationNote={deleteApplicationNote} />
                        {notes.length === 0 ? <li role="none" className="px-3 py-2 text-xs text-slate-500">Empty folder · drop a note here</li> : null}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
              <NoteDirectory notes={[...rootNotes].sort((a, b) => a.title.localeCompare(b.title))} selectedNoteId={selectedNoteId} onSelect={selectNote} onEdit={(id) => requestDiscard(() => { setSelectedNoteId(id); setEditingNoteId(id); })} onDragStart={startNoteDrag} deleteApplicationNote={deleteApplicationNote} />
            </ul>
            <div className={`notes-root-drop ${folderDropTargetId === "" ? "notes-drop-target" : ""}`} {...dropHandlers("")}>Drop here to move to Notes root</div>
            </div></> : null}
          </div>
          <aside className="workspace-main note-preview">
            {isAddingNote || editingNote ? (
              <NoteEditor key={editingNote?.id ?? "new"} note={editingNote ?? undefined} folderId={editingNote?.folderId ?? selectedFolderId ?? ""} folderName={application.noteFolders.find((folder) => folder.id === (editingNote?.folderId ?? selectedFolderId))?.name ?? "Root"} action={editingNote ? updateApplicationNote.bind(null, editingNote.id) : addApplicationNote.bind(null, application.id)} onSuccess={() => { setIsAddingNote(false); setEditingNoteId(null); if (isAddingNote) setSelectedNoteId(null); }} onCancel={() => { setIsAddingNote(false); setEditingNoteId(null); }} theme={theme} />
            ) : selectedNote ? (
              <div>
                <div className="workspace-pane-bar"><span className="workspace-breadcrumb">Notes / {application.noteFolders.find((folder) => folder.id === selectedNote.folderId)?.name ?? "Root"}</span><button type="button" className="workspace-button" onClick={() => requestDiscard(() => setEditingNoteId(selectedNote.id))}>Edit note</button></div>
                <div className="workspace-note-page"><h4 className="workspace-reading-title">{selectedNote.title}</h4><p className="mt-2 text-xs text-slate-500">Updated {formatDateTime(selectedNote.updatedAt, timeZone)}</p><p className="workspace-prose mt-7">{selectedNote.body}</p></div>
                <div className="workspace-editor-footer">
                  <label className="flex min-w-0 items-center gap-2 text-xs text-slate-400">Move to
                    <select aria-label="Move note to folder" disabled={isMoving} value={selectedNote.folderId ?? ""} onChange={(event) => moveNote(selectedNote.id, event.target.value)} className={`min-w-0 max-w-48 rounded-lg border border-white/10 px-2 py-2 text-xs ${theme.fieldInput}`}>
                      <option value="">Notes root</option>
                      {application.noteFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ) : <div className="workspace-blank"><span aria-hidden="true" className="workspace-blank-symbol">✎</span><h4>Your notebook is empty</h4><p>Create a note for your company research, interview questions, or follow-ups.</p><button type="button" className={`workspace-button workspace-primary ${theme.button}`} onClick={() => setIsAddingNote(true)}>Create your first note</button></div>}
          </aside>
        </div>
      </div>
    </section>
  );
}

function NoteDirectory({ notes, selectedNoteId, onSelect, onEdit, onDragStart, deleteApplicationNote }: {
  notes: ApplicationDetail["noteEntries"];
  selectedNoteId: string | null;
  onSelect: (noteId: string) => void;
  onEdit: (noteId: string) => void;
  onDragStart: (event: React.DragEvent, noteId: string) => void;
  deleteApplicationNote: (noteId: string) => unknown | Promise<unknown>;
}) {
  return (
    <>
      {notes.map((note) => (
        <li role="none" key={note.id} data-note-id={note.id} className={`notes-tree-row ${selectedNoteId === note.id ? "notes-tree-selected" : ""}`}>
          <button type="button" role="treeitem" aria-level={note.folderId ? 2 : 1} aria-selected={selectedNoteId === note.id} data-parent-folder={note.folderId ?? undefined} draggable onDragStart={(event) => onDragStart(event, note.id)} className="notes-tree-label notes-tree-note" onClick={() => onSelect(note.id)} onDoubleClick={() => onEdit(note.id)} title={note.title}>
            <span className="text-slate-400"><DirectoryIcon name="file" /></span>
            <span className="truncate text-sm text-slate-200">{note.title}</span>
          </button>
          <button type="button" className="notes-tree-action" aria-label={`Edit ${note.title}`} title="Edit note" onClick={() => onEdit(note.id)}>✎</button>
          <ActionForm action={deleteApplicationNote.bind(null, note.id)}><button className="notes-tree-action" aria-label="Delete note" title="Delete note"><DirectoryIcon name="trash" /></button></ActionForm>
        </li>
      ))}
    </>
  );
}

function DirectoryIcon({ name }: { name: "back" | "calendar-plus" | "check" | "close" | "external" | "file" | "file-plus" | "folder" | "folder-plus" | "fullscreen" | "mail" | "mail-plus" | "menu" | "trash" }) {
  const paths = {
    back: <path d="m15 18-6-6 6-6M9 12h10" />,
    "calendar-plus": <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M12 13v5M9.5 15.5h5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    external: <><path d="M14 5h5v5M19 5l-8 8" /><path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    "file-plus": <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M12 11v6M9 14h6" /></>,
    folder: <path d="M3 6h6l2 2h10v10H3z" />,
    "folder-plus": <><path d="M3 6h6l2 2h10v10H3z" /><path d="M12 11v4M10 13h4" /></>,
    fullscreen: <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 7 9 6 9-6" /></>,
    "mail-plus": <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 7 9 6 9-6M12 10v6M9 13h6" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  };

  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75">{paths[name]}</svg>;
}

function ApplicationFiles({
  application,
  documents,
  attachApplicationDocuments,
  deleteApplicationFile,
  theme,
  uploadApplicationFile,
}: {
  application: ApplicationDetail;
  documents: UserDocumentItem[];
  attachApplicationDocuments: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  deleteApplicationFile: (fileId: string) => unknown | Promise<unknown>;
  theme: { timeline: string; eyebrow: string; button: string; fieldFocus: string; fieldInput: string };
  uploadApplicationFile: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
}) {
  const timeZone = useContext(TimeZoneContext);
  const [previewFile, setPreviewFile] = useState<ApplicationDetail["files"][number] | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; size: number }>>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isFileHovering, setIsFileHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileStoreRef = useRef<File[]>([]);
  const totalSelectedFileSize = selectedFiles.reduce((total, file) => total + file.size, 0);
  const selectedFilesTooLarge = totalSelectedFileSize > 30 * 1024 * 1024;
  const attachedDocumentIds = new Set(application.files.map((file) => file.userDocumentId));
  const availableDocuments = documents.filter((document) => !attachedDocumentIds.has(document.id));

  function syncSelectedFiles(files: File[]) {
    setSelectedFiles(files.map((file) => ({ name: file.name, size: file.size })));
  }

  function appendFiles(files: File[]) {
    if (!inputRef.current || files.length === 0) return;

    const nextFiles = [...fileStoreRef.current, ...files];
    const transfer = new DataTransfer();

    nextFiles.forEach((file) => transfer.items.add(file));
    fileStoreRef.current = nextFiles;
    inputRef.current.files = transfer.files;
    syncSelectedFiles(nextFiles);
  }

  function removeSelectedFile(indexToRemove: number) {
    if (!inputRef.current) return;

    const nextFiles = fileStoreRef.current.filter((_, index) => index !== indexToRemove);
    const transfer = new DataTransfer();

    nextFiles.forEach((file) => transfer.items.add(file));
    fileStoreRef.current = nextFiles;
    inputRef.current.files = transfer.files;
    syncSelectedFiles(nextFiles);
  }

  return (
    <section className={`detail-module mt-3 border ${theme.timeline}`}>
      <div className="detail-module-rail" />
      <div className="p-4">
        <div className="detail-toolbar">
          <div><h3 className="text-sm font-semibold text-slate-100">Application documents</h3>
          <p className="mt-1 text-sm text-slate-400">Resumes, cover letters, and supporting files.</p></div>
          <span className="detail-count">{application.files.length} attached</span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)] lg:items-start">
          <ActionForm action={uploadApplicationFile.bind(null, application.id)} onSuccess={() => { fileStoreRef.current = []; setSelectedFiles([]); if (inputRef.current) inputRef.current.value = ""; }} className="detail-surface grid gap-3 lg:col-start-1 lg:row-start-1">
            <label
              className={`relative grid min-h-44 cursor-pointer place-items-center rounded-xl border border-dashed px-5 py-6 text-center transition focus-within:ring-2 focus-within:ring-sky-300/60 ${isFileHovering ? "border-cyan-300/70 bg-cyan-400/10" : "border-white/20 bg-slate-950/30 hover:border-white/40 hover:bg-slate-900/55"}`}
              onDragEnter={(event) => {
                if (!hasDraggedFiles(event.dataTransfer)) return;

                event.preventDefault();
                setIsFileHovering(true);
              }}
              onDragOver={(event) => {
                if (!hasDraggedFiles(event.dataTransfer)) return;

                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setIsFileHovering(true);
              }}
              onDragLeave={(event) => {
                if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;

                setIsFileHovering(false);
              }}
              onDrop={(event) => { event.preventDefault(); setIsFileHovering(false); appendFiles(Array.from(event.dataTransfer.files)); }}
            >
              <input
                ref={inputRef}
                name="files"
                aria-label="Attach files, up to 10 MB each and 30 MB total"
                type="file"
                multiple
                required
                className={`absolute inset-0 cursor-pointer opacity-0 ${selectedFiles.length > 0 ? "pointer-events-none" : ""}`}
                onChange={(event) => appendFiles(Array.from(event.currentTarget.files ?? []))}
              />
              <span className="pointer-events-none">
                <span className="detail-empty-icon mx-auto mb-3"><DirectoryIcon name="file-plus" /></span>
                <span className={`block text-lg font-black ${isFileHovering ? "text-cyan-100" : "text-slate-100"}`}>
                  {selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} ready` : "Drop files here"}
                </span>
                <span className="mx-auto mt-4 block h-px w-16 bg-white/10" />
                <span className="mt-4 block text-xs font-semibold text-slate-400">or click to choose multiple files</span>
              </span>
            </label>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-950/70 ring-1 ring-white/10">
                <div
                  className={`h-full rounded-full transition-all ${selectedFilesTooLarge ? "bg-rose-400" : "bg-cyan-400"}`}
                  style={{ width: `${Math.min((totalSelectedFileSize / (30 * 1024 * 1024)) * 100, 100)}%` }}
                />
              </div>
              <p className={`mt-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] ${selectedFilesTooLarge ? "text-rose-300" : "text-slate-500"}`}>
                {selectedFiles.length > 0 ? `${formatFileSize(totalSelectedFileSize)} selected / 30 MB total` : "0 B selected / 30 MB total"}
              </p>
            </div>

            {selectedFiles.length > 0 ? (
              <div className="max-h-36 overflow-y-auto border border-white/10 bg-slate-950/35 p-2">
                {selectedFiles.map((fileName, index) => (
                  <div key={`${fileName.name}-${fileName.size}-${index}`} className="flex min-w-0 items-center justify-between gap-3 py-1 text-xs font-semibold text-slate-300">
                    <span className="truncate">{fileName.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-slate-500">{formatFileSize(fileName.size)}</span>
                      <button
                        type="button"
                        className="border border-rose-400/30 px-2 py-0.5 text-[0.62rem] font-black text-rose-300 hover:bg-rose-400/10"
                        onClick={() => removeSelectedFile(index)}
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {selectedFiles.length > 0 ? (
                <button
                  type="button"
                  className="border border-white/10 px-4 py-3 text-xs font-black text-slate-200 hover:bg-white/10"
                  onClick={() => inputRef.current?.click()}
                >
                  Add more files
                </button>
              ) : null}
              <button disabled={selectedFiles.length === 0 || Boolean(uploadError(selectedFiles))} className={`px-5 py-3 text-xs font-bold ${theme.button}`}>Upload</button>
            </div>
            <p className="text-xs text-slate-400">10 MB per file, 30 MB total per upload.</p>
            {uploadError(selectedFiles) ? <p role="alert" className="text-sm text-rose-200">{uploadError(selectedFiles)}</p> : null}
          </ActionForm>

          <ActionForm action={attachApplicationDocuments.bind(null, application.id)} onSuccess={() => setSelectedDocumentIds([])} className="detail-surface min-w-0 lg:col-start-1 lg:row-start-2">
            <h4 className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${theme.eyebrow}`}>From Documents</h4>
            {availableDocuments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">{documents.length === 0 ? "No saved documents yet. Add some in Documents first." : "All saved documents are already attached."}</p>
            ) : (
              <>
                <div className="status-graph-scroll mt-3 grid max-h-44 gap-1 overflow-y-auto border border-white/10 bg-slate-950/35 p-2">
                  {availableDocuments.map((document) => (
                    <label key={document.id} className="flex cursor-pointer items-center gap-3 px-2 py-2 text-sm hover:bg-white/5">
                      <input type="checkbox" name="documentIds" value={document.id} checked={selectedDocumentIds.includes(document.id)} onChange={(event) => setSelectedDocumentIds((current) => event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id))} className="size-4 shrink-0 accent-cyan-400" />
                      <span className="min-w-0 flex-1 truncate text-slate-200">{document.fileName}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatFileSize(document.fileSize)}</span>
                    </label>
                  ))}
                </div>
                <button disabled={selectedDocumentIds.length === 0} className={`mt-3 px-5 py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${theme.button}`}>Attach selected</button>
              </>
            )}
          </ActionForm>

          <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <h4 className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${theme.eyebrow}`}>Attached files</h4>
            {application.files.length === 0 ? (
              <DetailEmptyState icon="folder" title="No files uploaded yet." description="Drop a file into the upload area or attach a saved document from your library." />
            ) : (
              <div className="mt-4 grid gap-3">
                {application.files.map((file) => (
                  <div key={file.id} className="detail-surface flex min-w-0 flex-col gap-4 transition hover:border-white/25">
                    <div className="min-w-0">
                      <a href={`/files/${file.id}`} className={`block break-words text-sm font-black ${theme.eyebrow}`}>
                        {file.fileName}
                      </a>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatFileSize(file.fileSize)} / {formatDateTime(file.createdAt, timeZone)}
                       </p>
                      <span className="detail-count mt-2 inline-block">{file.userDocumentId ? "From your library" : "Uploaded file"}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={`/files/${file.id}`} className="detail-tool-button text-slate-200 hover:bg-white/10">Download</a>
                      {isPreviewableFile(file) ? (
                        <button
                          type="button"
                          className={`detail-tool-button ${theme.eyebrow} hover:bg-white/10`}
                          onClick={() => setPreviewFile(file)}
                        >
                          Preview
                        </button>
                      ) : null}
                      <ActionForm action={deleteApplicationFile.bind(null, file.id)}>
                        <button className="detail-tool-button border-rose-400/30 text-rose-300 hover:bg-rose-400/10">
                          Delete
                        </button>
                      </ActionForm>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewFile ? (
        <FilePreviewModal file={previewFile} theme={theme} onClose={() => setPreviewFile(null)} />
      ) : null}
    </section>
  );
}

function OfferDetailsSection({
  application,
  saveOfferDetails,
  theme,
}: {
  application: ApplicationDetail;
  saveOfferDetails: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  theme: { timeline: string; eyebrow: string; fieldInput: string; button: string };
}) {
  const offer = application.offerDetails;

  return (
    <section className={`detail-module mt-3 border ${theme.timeline}`}>
      <div className="detail-module-rail" />
      <ActionForm action={saveOfferDetails.bind(null, application.id)} className="grid gap-3 p-4">
        <div>
          <h3 className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${theme.eyebrow}`}>Offer details</h3>
          <p className="mt-2 text-sm font-semibold text-slate-300">Keep the compensation, deadline, benefits, negotiation notes, and decision details in one place.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <input name="compensation" placeholder="Compensation" defaultValue={offer?.compensation ?? ""} className={`px-3 py-3 text-sm ${theme.fieldInput}`} />
          <input name="startDate" placeholder="Start date" defaultValue={offer?.startDate ?? ""} className={`px-3 py-3 text-sm ${theme.fieldInput}`} />
          <input name="deadline" placeholder="Decision deadline" defaultValue={offer?.deadline ?? ""} className={`px-3 py-3 text-sm ${theme.fieldInput}`} />
          <textarea name="benefits" placeholder="Benefits" rows={3} defaultValue={offer?.benefits ?? ""} className={`px-3 py-3 text-sm ${theme.fieldInput}`} />
          <textarea name="equity" placeholder="Equity / bonus" rows={3} defaultValue={offer?.equity ?? ""} className={`px-3 py-3 text-sm ${theme.fieldInput}`} />
          <textarea name="negotiables" placeholder="Negotiables" rows={3} defaultValue={offer?.negotiables ?? ""} className={`px-3 py-3 text-sm ${theme.fieldInput}`} />
        </div>
        <textarea name="notes" placeholder="Decision notes, recruiter promises, questions to ask before accepting..." rows={4} defaultValue={offer?.notes ?? ""} className={`px-3 py-3 text-sm ${theme.fieldInput}`} />
        <button className={`justify-self-start px-5 py-3 text-xs font-black ${theme.button}`}>Save offer details</button>
      </ActionForm>
    </section>
  );
}

function FilePreviewModal({
  file,
  theme,
  onClose,
}: {
  file: ApplicationDetail["files"][number];
  theme: { eyebrow: string };
  onClose: () => void;
}) {
  const previewUrl = `/files/${file.id}/preview`;

  return createPortal(
    <Dialog label={`Preview ${file.fileName}`} onClose={onClose} className="fixed inset-0 z-[80] bg-slate-950/82 p-3 backdrop-blur-sm sm:p-5">
      <section className="flex h-full w-full flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${theme.eyebrow}`}>File preview</p>
            <h3 className="mt-1 break-words text-lg font-black text-slate-100">{file.fileName}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
              <a href={`/files/${file.id}`} className="download-button rounded-full border px-4 py-2 text-sm font-bold">
                Download
              </a>
            <button type="button" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-slate-900/60 p-3">
          <iframe sandbox="" src={previewUrl} title={file.fileName} className="h-full w-full rounded-xl border border-white/10 bg-white" />
        </div>
      </section>
    </Dialog>,
    document.body,
  );
}

function StatusHistorySection({
  application,
  theme,
}: {
  application: ApplicationDetail;
  theme: { timeline: string; timelineItem: string; eyebrow: string };
}) {
  const changes = application.statusChanges;

  return (
    <section className={`detail-module mt-3 border ${theme.timeline}`}>
      <div className="detail-module-rail" />
      <div className="p-4">
        <div className="detail-toolbar">
          <div><h3 className="text-sm font-semibold text-slate-100">Application timeline</h3><p className="mt-1 text-xs text-slate-400">Every status update, from your first application onward.</p></div>
          <span className="detail-count">{changes.length} updates</span>
        </div>
        {changes.length === 0 ? (
          <DetailEmptyState icon="calendar-plus" title="No status changes logged yet." description="Your status updates will appear here as the application progresses." />
        ) : (
          <ol className="detail-history mt-5 grid gap-4">
            {changes.map((change, index) => (
              <li key={change.id} className="relative pl-7 sm:pl-9">
              <span aria-hidden="true" className={`detail-history-dot ${statusSelectTextStyles[change.status]}`} />
              <article className="detail-surface flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400">Status changed to{index === 0 ? " · Latest update" : ""}</p>
                  <p className={`mt-1 text-lg font-black ${statusSelectTextStyles[change.status]}`}>{statusLabels[change.status]}</p>
                </div>
                <time className="text-xs leading-6 text-slate-400" dateTime={change.changedAt}>
                  {formatExactDateTime(change.changedAt)}
                </time>
              </article>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
  navigationId,
  href,
  theme,
  wide = false,
  editable = false,
  showEditButton = true,
  hideLabel = false,
  onEdit,
  linkClassName,
  valueClassName,
}: {
  label: string;
  value: string;
  navigationId?: string;
  href?: string | null;
  theme?: { link: string; eyebrow: string; tile?: string; editIcon?: string; fieldGlow?: string };
  wide?: boolean;
  editable?: boolean;
  showEditButton?: boolean;
  hideLabel?: boolean;
  onEdit?: () => void;
  linkClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div
      data-detail-field={navigationId}
      tabIndex={navigationId ? 0 : undefined}
      role={navigationId ? "group" : undefined}
      aria-label={navigationId ? label : undefined}
      aria-keyshortcuts={navigationId && editable ? "Enter" : undefined}
      className={`detail-field group/detail relative ${label === "Job description" ? "py-1" : `border-b border-white/10 py-4 pr-12 ${theme?.fieldGlow ?? "hover:border-white/20"}`} text-left transition ${editable ? "" : "cursor-default"} ${wide ? "sm:col-span-2" : ""}`}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.target !== event.currentTarget || !editable || !onEdit) return;
        event.preventDefault();
        onEdit();
      }}
      onDoubleClick={(event) => {
        if (!editable || !onEdit) return;
        if (event.target instanceof Element && event.target.closest("a, button")) return;

        onEdit();
      }}
    >
      {!hideLabel ? <p className={`text-xs font-bold uppercase tracking-[0.2em] ${theme?.eyebrow ?? "text-slate-500"}`}>{label}</p> : null}
      {href ? (
        <a className={`mt-2 block break-words pr-8 text-sm font-semibold ${linkClassName ?? theme?.link ?? "text-sky-300 hover:text-sky-200"}`} href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          {value}
        </a>
      ) : label === "Job description" ? (
        <JobDescriptionReadView value={value} valueClassName={valueClassName} onEdit={onEdit} />
      ) : (
        <p className={`mt-2 whitespace-pre-wrap break-words pr-8 text-sm font-semibold leading-6 ${valueClassName ?? "text-slate-200"}`}>{value}</p>
      )}
      {editable && showEditButton && label !== "Job description" ? (
        <button type="button" className={`detail-edit-pencil border ${theme?.editIcon ?? ""}`} onClick={() => onEdit?.()} aria-label={`Edit ${label}`} title={`Edit ${label}`}>
          ✎
        </button>
      ) : null}
      {navigationId && editable ? <span className="detail-field-hint mt-2 text-xs font-semibold text-slate-400">Press Enter to modify</span> : null}
    </div>
  );
}

function JobDescriptionReadView({
  value,
  valueClassName,
  onEdit,
}: {
  value: string;
  valueClassName?: string;
  onEdit?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const lines = value.split("\n").map((line) => line.trim());
  const sections = jobDescriptionSections(lines);
  const hasDescription = value !== "No job description added" && value.trim().length > 0;

  async function copyDescription() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`job-description-reader ${valueClassName ?? "text-slate-200"}`}>
      {!hasDescription ? <DetailEmptyState icon="file" title="No job description added" description="Add the posting to keep the role’s responsibilities and requirements handy." /> : <div className="job-description-content job-description-scroll status-graph-scroll" role="region" aria-label="Job description content" tabIndex={0}>
        {sections.map((section, sectionIndex) => (
          <div key={`${section.heading ?? "intro"}-${sectionIndex}`} className="job-description-section">
            {section.heading ? (
              <h4>
                {section.heading}
              </h4>
            ) : null}
            {jobDescriptionBlocks(section.lines).map((block, index) => {
              if (block.type === "paragraph") return <p key={index} data-job-description-line={block.lines[0].index}>{block.lines.map((item) => item.line).join(" ")}</p>;
              const List = block.type === "ordered" ? "ol" : "ul";
              return <List key={index} start={block.type === "ordered" ? Number.parseInt(block.lines[0].line, 10) : undefined}>
                {block.lines.map((item) => <li key={item.index} data-job-description-line={item.index}>{item.line.replace(/^(?:[-*•●▪◦‣–—]|\d+[.)])\s+/, "")}</li>)}
              </List>;
            })}
          </div>
        ))}
      </div>}
      <div className="job-description-toolbar flex items-center gap-2">
        {hasDescription ? (
          <button type="button" className="detail-tool-button text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white" onClick={() => void copyDescription()}>
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
        {onEdit ? (
          <button type="button" className="detail-tool-button border-sky-300/30 bg-sky-400/10 text-sky-100 transition hover:border-sky-200/60 hover:bg-sky-400/20 hover:text-white" onClick={onEdit}>Edit</button>
        ) : null}
      </div>
    </section>
  );
}

function jobDescriptionSections(lines: string[]) {
  const sections: Array<{ heading: string | null; lines: Array<{ line: string; index: number }> }> = [];
  let current = { heading: null as string | null, lines: [] as Array<{ line: string; index: number }> };

  lines.forEach((line, index) => {
    if (line && isJobDescriptionHeading(line)) {
      if (current.heading || current.lines.some((item) => item.line)) sections.push(current);
      current = { heading: jobDescriptionHeadingText(line), lines: [] };
      return;
    }

    current.lines.push({ line, index });
  });

  if (current.heading || current.lines.length > 0) sections.push(current);
  return sections;
}

function isJobDescriptionBullet(line: string) {
  return /^(?:[-*•●▪◦‣–—]|\d+[.)])\s+/.test(line);
}

function jobDescriptionBlocks(lines: Array<{ line: string; index: number }>) {
  const blocks: Array<{ type: "paragraph" | "ordered" | "unordered"; lines: typeof lines }> = [];
  let current: (typeof blocks)[number] | undefined;
  for (const item of lines) {
    if (!item.line) { current = undefined; continue; }
    const type = /^\d+[.)]\s+/.test(item.line) ? "ordered" : isJobDescriptionBullet(item.line) ? "unordered" : "paragraph";
    if (!current || current.type !== type) {
      current = { type, lines: [] };
      blocks.push(current);
    }
    current.lines.push(item);
  }
  return blocks;
}

function jobDescriptionHeadingText(line: string) {
  return line.replace(/^#+\s*/, "").replace(/^\*\*(.*?)\*\*$/, "$1").replace(/:$/, "");
}

function isJobDescriptionHeading(line: string) {
  const normalized = jobDescriptionHeadingText(line);

  if (normalized.length > 90 || isJobDescriptionBullet(normalized) || /[.!?]$/.test(normalized)) {
    return false;
  }

  if (/^#{1,6}\s+/.test(line) || /^\*\*.+\*\*$/.test(line)) return true;

  const commonHeadings = new Set([
    "introduction",
    "your role and responsibilities",
    "about the role",
    "what you will do",
    "preferred education",
    "required technical and professional expertise",
    "preferred technical and professional experience",
    "qualifications",
    "responsibilities",
    "requirements",
    "about the job",
    "about us",
    "about you",
    "about the company",
    "what you'll do",
    "what you’ll do",
    "what you'll bring",
    "what you’ll bring",
    "what we offer",
    "who you are",
    "who we are",
    "skills",
    "benefits",
    "preferred qualifications",
    "minimum qualifications",
    "key responsibilities",
    "equal opportunity",
    "hiring process",
    "application process",
  ]);

  if (commonHeadings.has(normalized.toLowerCase())) {
    return true;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) {
    return false;
  }

  const titleCasedWords = words.filter((word) => /^[A-Z0-9]/.test(word));
  return titleCasedWords.length / words.length >= 0.65;
}

function InlineEditableDetail({
  application,
  editing,
  theme,
  name,
  label,
  type = "text",
  value,
  defaultValue,
  href,
  linkClassName,
  valueClassName,
  multiline = false,
  wide = false,
  hideLabel = false,
  updateApplication,
  onEdit,
  onDone,
}: {
  application: ApplicationDetail;
  editing: boolean;
  theme: { fieldBorder: string; fieldLabel: string; fieldFocus: string; fieldInput: string; fieldGlow: string; editIcon: string; link: string; eyebrow: string; button: string; tile: string };
  name: string;
  label: string;
  type?: string;
  value: string;
  defaultValue: string;
  href?: string | null;
  linkClassName?: string;
  valueClassName?: string;
  multiline?: boolean;
  wide?: boolean;
  hideLabel?: boolean;
  updateApplication: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  onEdit: () => void;
  onDone: () => void;
}) {
  const requestDiscard = useDiscardChanges();
  const jobDescriptionRows = Math.min(24, Math.max(8, defaultValue.split("\n").length + 2));
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!editing) {
    return <Detail label={label} value={value} navigationId={hideLabel ? undefined : name} href={href} theme={theme} wide={wide} editable showEditButton={!["company", "role", "jobUrl", "notes", "jobPostedAt"].includes(name)} onEdit={onEdit} linkClassName={linkClassName} valueClassName={valueClassName} hideLabel={hideLabel} />;
  }

  return (
    <ActionForm
      action={updateApplication.bind(null, application.id)} onSuccess={() => {
        setIsFullscreen(false);
        onDone();
      }}
      className={isFullscreen ? "fixed inset-0 z-[60] grid grid-rows-[auto_1fr_auto] gap-5 overscroll-contain overflow-y-auto bg-slate-950 p-5 text-left sm:p-8" : `${name === "jobDescription" ? "detail-surface mt-4" : `border-b py-4 pr-12 ${theme.fieldGlow}`} transition ${theme.fieldBorder} ${wide ? "sm:col-span-2" : ""}`}
    >
      {isFullscreen ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${theme.fieldLabel}`}>Fullscreen editor</p>
            <h4 className="mt-1 text-xl font-black text-slate-100">Job description</h4>
          </div>
          <button type="button" className="border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10" onClick={() => setIsFullscreen(false)}>
            Exit fullscreen
          </button>
        </div>
      ) : null}
      {!isFullscreen && !hideLabel ? <span className={`text-xs font-bold uppercase tracking-[0.2em] ${theme.fieldLabel}`}>{label}</span> : null}
      {multiline ? (
        <textarea
          name={name}
          aria-label={label}
          rows={name === "jobDescription" ? jobDescriptionRows : 4}
          defaultValue={defaultValue}
          autoFocus
          className={`${isFullscreen ? "min-h-[calc(100vh-13rem)] overscroll-contain" : "mt-2"} w-full min-w-0 resize-none border-x-0 border-t-0 bg-transparent px-0 py-2 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500 ${theme.fieldFocus} ${theme.fieldBorder}`}
        />
      ) : name === "appliedAt" ? (
        <AppliedAtPicker name={name} defaultValue={defaultValue} theme={theme} />
      ) : (
        <input
          name={name}
          aria-label={label}
          required={name === "company" || name === "role"}
          type={type}
          defaultValue={defaultValue}
          autoFocus
          className={`mt-2 w-full min-w-0 border-x-0 border-t-0 bg-transparent px-0 py-2 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500 ${theme.fieldFocus} ${theme.fieldBorder}`}
        />
      )}
      <div className="mt-3 flex gap-2">
        <button className={`rounded-full px-4 py-2 text-xs font-bold ${theme.button}`}>
          Save
        </button>
        {name === "jobDescription" ? (
          <button
            type="button"
            className="rounded-full border border-sky-300/30 px-4 py-2 text-xs font-bold text-sky-100 hover:border-sky-200/60 hover:bg-sky-400/10"
            onClick={() => setIsFullscreen((current) => !current)}
          >
            {isFullscreen ? "Standard editor" : "Fullscreen"}
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
            onClick={() => requestDiscard(() => {
              setIsFullscreen(false);
              onDone();
            })}
        >
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}

function AppliedAtPicker({
  name,
  defaultValue,
  theme,
}: {
  name: string;
  defaultValue: string;
  theme: { fieldBorder: string; fieldFocus: string };
}) {
  const initial = parseDatetimeLocal(defaultValue);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [year, setYear] = useState(initial.year);
  const [hour, setHour] = useState(to12Hour(initial.hour).hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(initial.hour >= 12 ? "PM" : "AM");
  const maxDay = daysInMonth(year, month);
  const safeDay = Math.min(day, maxDay);
  const value = `${year}-${pad(month)}-${pad(safeDay)}T${pad(to24Hour(hour, period))}:${pad(minute)}`;
  const selectClass = `new-app-input min-w-0 px-3 py-2 text-sm font-semibold ${theme.fieldFocus} ${theme.fieldBorder}`;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1.1fr_0.8fr_0.9fr_0.7fr_0.7fr_0.7fr]">
      <input name={name} type="hidden" value={new Date(value).toISOString()} />
      <select aria-label="Month" autoFocus value={month} onChange={(event) => setMonth(Number(event.target.value))} className={selectClass}>
        {monthNames.map((label, index) => (
          <option key={label} value={index + 1}>{label}</option>
        ))}
      </select>
      <select aria-label="Day" value={safeDay} onChange={(event) => setDay(Number(event.target.value))} className={selectClass}>
        {Array.from({ length: maxDay }, (_, index) => index + 1).map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select aria-label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))} className={selectClass}>
        {years.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select aria-label="Hour" value={hour} onChange={(event) => setHour(Number(event.target.value))} className={selectClass}>
        {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select aria-label="Minute" value={minute} onChange={(event) => setMinute(Number(event.target.value))} className={selectClass}>
        {Array.from({ length: 60 }, (_, index) => index).map((item) => (
          <option key={item} value={item}>{pad(item)}</option>
        ))}
      </select>
      <select aria-label="AM or PM" value={period} onChange={(event) => setPeriod(event.target.value as "AM" | "PM")} className={selectClass}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

function StatusForm({
  applicationId,
  onStatusChange,
  status,
  updateApplicationStatus,
}: {
  applicationId: string;
  onStatusChange: (applicationId: string, from: ApplicationStatus, to: ApplicationStatus) => void;
  status: ApplicationStatus;
  updateApplicationStatus: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
}) {
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const formRef = useRef<HTMLFormElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = `status-options-${applicationId}`;

  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    function closeMenu(event: MouseEvent) {
      const target = event.target as Node;

      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function updateMenuPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      setMenuPosition({
        top: rect.bottom + 208 > window.innerHeight ? Math.max(8, rect.top - 208) : rect.bottom + 8,
        left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  function chooseStatus(nextStatus: ApplicationStatus) {
    setSelectedStatus(nextStatus);
    setIsOpen(false);
    buttonRef.current?.focus();
    window.requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  const menu = isOpen
    ? createPortal(
        <div
          ref={menuRef}
          className={`fixed z-[80] w-56 overflow-hidden rounded-2xl border p-2 shadow-2xl backdrop-blur-xl ${statusDropdownStyles[selectedStatus].menu}`}
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div id={listboxId} className="grid gap-1" role="listbox" aria-label="Application status" onKeyDown={(event) => {
            const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
            const index = options.indexOf(document.activeElement as HTMLButtonElement);
            let next = index;
            if (event.key === "ArrowDown") next = (index + 1) % options.length;
            else if (event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else if (event.key === "Tab") { setIsOpen(false); buttonRef.current?.focus(); return; }
            else if (event.key.length === 1 && event.key !== " ") {
              const match = options.findIndex((option) => option.textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase()));
              if (match < 0) return;
              next = match;
            } else return;
            event.preventDefault();
            options[next]?.focus();
          }}>
            {Object.values(ApplicationStatus).map((item) => (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={item === selectedStatus}
                tabIndex={-1}
                className={`flex items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left text-sm font-bold text-slate-300 transition ${statusDropdownStyles[item].option} ${item === selectedStatus ? "bg-white/8 text-white" : ""}`}
                onClick={() => chooseStatus(item)}
              >
                <span className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${statusDropdownStyles[item].dot}`} />
                  {statusLabels[item]}
                </span>
                {item === selectedStatus ? <span className="text-xs text-sky-300">ACTIVE</span> : null}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <ActionForm ref={formRef} action={async (data) => {
      try {
        const result = await updateApplicationStatus(applicationId, data);
        if (mutationFeedback(result).success) {
          if (status !== selectedStatus) onStatusChange(applicationId, status, selectedStatus);
        } else setSelectedStatus(status);
        return result;
      } catch (error) {
        setSelectedStatus(status);
        throw error;
      }
    }} className="relative flex gap-2">
      <input name="status" type="hidden" value={selectedStatus} />
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setIsOpen(true); }
          }}
          className={`group flex min-w-44 items-center justify-between gap-3 rounded-full border px-4 py-2 text-sm font-black outline-none transition duration-200 ${statusDropdownStyles[selectedStatus].button}`}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${statusDropdownStyles[selectedStatus].dot}`} />
            <span className={statusSelectTextStyles[selectedStatus]}>{statusLabels[selectedStatus]}</span>
          </span>
          <span className={`text-xs transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>
      {menu}
    </ActionForm>
  );
}

function DiscardButton({ onDiscard }: { onDiscard: () => void }) {
  const requestDiscard = useDiscardChanges();

  return (
    <button type="button" className="grid size-9 place-items-center text-slate-400 transition hover:text-white" aria-label="Cancel" title="Cancel" onClick={() => requestDiscard(onDiscard)}>
      <DirectoryIcon name="close" />
    </button>
  );
}

function DiscardChangesConfirmation({ onCancel, onDiscard }: { onCancel: () => void; onDiscard: () => void }) {
  return createPortal(
    <Dialog label="Discard unsaved changes" onClose={onCancel} className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[2rem] border border-amber-300/30 bg-slate-900 p-6 shadow-2xl shadow-black/50">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Unsaved changes</p>
        <h2 className="mt-3 text-2xl font-black text-slate-100">Discard your changes?</h2>
        <p className="mt-2 text-sm text-slate-300">Your edits have not been saved and will be lost.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/10" onClick={onCancel}>Keep editing</button>
          <button type="button" className="rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300" onClick={onDiscard}>Discard changes</button>
        </div>
      </section>
    </Dialog>,
    document.body,
  );
}

function DeleteConfirmation({
  target,
  action,
  onCancel,
}: {
  target: DeleteTarget;
  action: (formData: FormData) => unknown | Promise<unknown>;
  onCancel: () => void;
}) {
  const isBulk = target.ids.length > 1;

  return (
    <Dialog label="Confirm delete applications" onClose={onCancel} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[2rem] border border-rose-400/20 bg-slate-900 p-5 shadow-2xl shadow-black/50">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-300">Confirm delete</p>
        <h2 className="mt-3 text-2xl font-black text-slate-100">
          Delete {isBulk ? "these applications" : "this application"}?
        </h2>
        <p className="mt-2 break-words text-sm text-slate-400">
          Move <span className="font-bold text-slate-200">{target.label}</span> to the recycle bin? You can restore it later.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/10"
            onClick={onCancel}
          >
            Cancel
          </button>
          <ActionForm
            action={action} onSuccess={onCancel}
          >
            {target.ids.map((id) => (
              <input key={id} name="applicationIds" type="hidden" value={id} />
            ))}
            <button className="w-full rounded-full bg-rose-500 px-5 py-3 text-sm font-bold text-white hover:bg-rose-400 sm:w-auto">
              Delete {isBulk ? "applications" : "application"}
            </button>
          </ActionForm>
        </div>
      </div>
    </Dialog>
  );
}

function formatDateTime(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(date));
}

function formatApplicationDay(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone }).format(new Date(date));
}

function applicationDay(date: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(new Date(date));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatJobId(jobId: string | null, jobUrl: string | null) {
  if (!jobId) return "Not added";
  const source = jobUrl ? jobIdSource(jobUrl) : "";
  return source ? `${jobId} (${source})` : jobId;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDatetimeLocal(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return {
      month: fallback.getMonth() + 1,
      day: fallback.getDate(),
      year: fallback.getFullYear(),
      hour: fallback.getHours(),
      minute: fallback.getMinutes(),
    };
  }

  return {
    month: date.getMonth() + 1,
    day: date.getDate(),
    year: date.getFullYear(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function to12Hour(hour: number) {
  const normalized = hour % 12;
  return { hour: normalized === 0 ? 12 : normalized };
}

function to24Hour(hour: number, period: "AM" | "PM") {
  if (period === "AM") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function isPreviewableFile(file: ApplicationDetail["files"][number]) {
  return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.fileType);
}

function formatExactDateTime(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));
}

function toDatetimeLocal(date: string) {
  const value = new Date(date);
  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
