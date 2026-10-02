"use client";

import { useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import { Dialog } from "./ui/dialog";
import { ActionForm, UnsavedChangesProvider } from "./ui/action-form";
import type { ApplicationDetail } from "./application-types";
import type { UserDocumentItem } from "./document-types";
import { EmailLogSection, InterviewSection } from "./application-workspaces";
import { InlineEditableDetail } from "./application-editors";
import { ApplicationFiles } from "./application-files-section";
import { formatDateTime, formatExactDateTime, formatJobId, toDatetimeLocal } from "./application-format";
import { ApplicationNotesSection } from "./application-notes";
import { gameMenuStatusStyles, modalStatusStyles, salaryRankStyles, statusLabels, statusSelectTextStyles, textStatusStyles, withoutBorderClasses } from "./application-status-styles";
import { DiscardChangesConfirmation } from "./confirmation-dialogs";
import { CompanyLogo, Detail, DetailEmptyState } from "./detail-primitives";
import { TimeZoneContext } from "./time-zone";

type DetailSection = "additionalDetails" | "notes" | "files" | "emailLog" | "interviews" | "offer" | "history";
export function ApplicationDetails({
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
