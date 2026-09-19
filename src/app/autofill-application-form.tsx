"use client";

import { useActionState, useEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { createApplication, extractJobPost, type ExtractJobState } from "./actions";
import type { UserDocumentItem } from "./document-types";
import { Dialog } from "./ui/dialog";
import { ActionForm, uploadError } from "./ui/action-form";

const initialExtractState: ExtractJobState = {
  message: "",
  values: {
    company: "",
    role: "",
    location: "",
    salary: "",
    jobUrl: "",
    companyLogoUrl: "",
    jobPostedAt: "",
    jobDescription: "",
    notes: "",
  },
};

export function AutofillApplicationForm({
  variant = "panel",
  documents = [],
  onAutofillReady,
  onSuccess,
}: {
  variant?: "panel" | "modal";
  documents?: UserDocumentItem[];
  onAutofillReady?: () => void;
  onSuccess?: () => void;
}) {
  const [extractState, extractAction, isExtracting] = useActionState(
    extractJobPost,
    initialExtractState,
  );
  const [linkPulse, setLinkPulse] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const values = extractState.values;
  const hasAutofillResult = values.jobUrl.length > 0;

  useEffect(() => {
    if (hasAutofillResult) {
      onAutofillReady?.();
    }
  }, [hasAutofillResult, onAutofillReady]);

  return (
    <div className={variant === "panel" ? "new-app-shell border bg-slate-950/55 p-5 shadow-xl shadow-black/30 backdrop-blur" : ""}>
      <form
        action={extractAction}
        className={hasAutofillResult ? "border-b border-emerald-300/20 pb-5" : ""}
      >
        <div className="grid gap-3 sm:grid-cols-[15rem_1fr] sm:items-center">
          <label htmlFor="autofillUrl" className="text-sm font-black uppercase tracking-[0.18em] text-sky-500">
            Autofill from a link (optional)
          </label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              id="autofillUrl"
              name="autofillUrl"
              type="url"
              required
              autoFocus
              defaultValue={values.jobUrl}
              placeholder="Example: https://www.linkedin.com/jobs/view/..."
              className={`new-app-input min-w-0 flex-1 px-4 py-3 font-normal normal-case tracking-normal ${linkPulse ? "new-app-link-captured" : ""}`}
              onPaste={() => {
                setLinkPulse(false);
                window.setTimeout(() => setLinkPulse(true), 0);
                window.setTimeout(() => setLinkPulse(false), 1500);
              }}
            />
            <button
              className="border border-sky-700/45 bg-sky-950/40 px-5 py-3 font-black text-sky-400 transition hover:bg-sky-900/55 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isExtracting}
            >
              {isExtracting ? "Checking..." : "Autofill"}
            </button>
          </div>
        </div>
        {extractState.message ? (
          <p role="status" className="mt-2 text-sm font-semibold text-sky-200">{extractState.message}</p>
        ) : null}
      </form>

      {!hasAutofillResult && !manualEntry ? <button type="button" className="mt-5 border border-sky-300/30 px-4 py-3 font-bold text-sky-100" onClick={() => { setManualEntry(true); onAutofillReady?.(); }}>Enter details manually</button> : null}
      {hasAutofillResult || manualEntry ? (
        <ActionForm
          key={JSON.stringify(values)}
          action={createApplication}
          onSuccess={onSuccess}
          className="mt-5 grid gap-10 xl:grid-cols-[minmax(0,1.25fr)_minmax(26rem,0.75fr)]"
        >
          <input name="companyLogoUrl" type="hidden" defaultValue={values.companyLogoUrl} />
          <input name="jobPostedAt" type="hidden" defaultValue={values.jobPostedAt} />
          <div className="new-app-panel grid min-w-0 content-start gap-3 p-5">
            <p className="text-sm font-semibold normal-case tracking-normal text-slate-400">
              Example text is shown as placeholder only; replace it with the job&apos;s details.
            </p>
            <Field name="company" label="Company" placeholder="Example: Lakeside Medical" defaultValue={values.company} required />
            <Field name="jobUrl" label="Job posting link (optional)" type="url" defaultValue={values.jobUrl} />
            <Field
              name="role"
              label="Role"
              placeholder="Example: Patient Care Coordinator"
              defaultValue={values.role}
              required
            />
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field
                name="location"
                label="Location"
                placeholder="Example: Hybrid / Chicago"
                defaultValue={values.location}
              />
              <Field name="salary" label="Salary" placeholder="Example: $55k-$70k" defaultValue={values.salary} />
            </div>
            <input name="status" type="hidden" value="APPLIED" />
            <label className="group/field grid min-w-0 gap-1 border-b border-sky-800/45 py-3 text-sm font-black uppercase tracking-[0.16em] text-sky-500 transition hover:border-sky-600/60">
              Job description
              <textarea
                name="jobDescription"
                placeholder="Example: Responsibilities, qualifications, and benefits..."
                rows={7}
                defaultValue={values.jobDescription}
                className="new-app-input min-h-44 w-full min-w-0 resize-none px-3 py-3 font-normal normal-case tracking-normal"
              />
            </label>
            <label className="group/field grid min-w-0 gap-1 border-b border-sky-800/45 py-3 text-sm font-black uppercase tracking-[0.16em] text-sky-500 transition hover:border-sky-600/60">
              Notes
              <textarea
                name="notes"
                placeholder="Example: Recruiter name, requirements, interview prep, or referral info..."
                rows={5}
                defaultValue=""
                className="new-app-input w-full min-w-0 resize-none px-3 py-3 font-normal normal-case tracking-normal"
              />
            </label>
          </div>
          <div className="grid min-w-0 content-start gap-6 border-l-0 border-sky-800/45 xl:border-l xl:pl-10">
            <NewApplicationFileDrop />
            <div className="border-t border-white/10 pt-5">
              <ExistingDocumentPicker documents={documents} />
            </div>
            <button className="mt-2 w-full border border-fuchsia-300/35 bg-fuchsia-400/12 px-5 py-3 font-black uppercase tracking-[0.18em] text-fuchsia-100 transition hover:bg-fuchsia-400/20 hover:text-white focus:border-fuchsia-100 focus:bg-fuchsia-400/24 focus:outline-none focus:shadow-[0_0_24px_rgb(217_70_239/0.22)]">
              Save application
            </button>
          </div>
        </ActionForm>
      ) : null}
    </div>
  );
}

function NewApplicationFileDrop() {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileStoreRef = useRef<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; size: number }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
  const isTooLarge = totalSize > 30 * 1024 * 1024;

  function syncSelectedFiles(files: File[]) {
    inputRef.current?.setCustomValidity(uploadError(files));
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

  function removeFile(indexToRemove: number) {
    if (!inputRef.current) return;

    const nextFiles = fileStoreRef.current.filter((_, index) => index !== indexToRemove);
    const transfer = new DataTransfer();

    nextFiles.forEach((file) => transfer.items.add(file));
    fileStoreRef.current = nextFiles;
    inputRef.current.files = transfer.files;
    syncSelectedFiles(nextFiles);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files).filter((file) => file.size > 0);
    appendFiles(droppedFiles);
  }

  return (
    <div
      className={`new-app-panel relative grid min-h-32 cursor-pointer place-items-center border-dashed px-5 py-5 text-center transition ${
        isDragging
          ? "border-cyan-200 bg-cyan-400/12 shadow-[0_0_24px_rgb(34_211_238/0.18)]"
          : "border-cyan-300/20 hover:border-fuchsia-300/35 hover:bg-cyan-400/5"
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        id="new-application-files"
        name="files"
        type="file"
        aria-label="Attach files, up to 10 MB each and 30 MB total"
        multiple
        className="sr-only"
        onChange={(event) => appendFiles(Array.from(event.currentTarget.files ?? []))}
      />
      <label htmlFor="new-application-files" className="absolute inset-0 cursor-pointer" aria-label="Attach files" />
      <div className="pointer-events-none relative">
        <span className="block text-sm font-black uppercase tracking-[0.18em] text-sky-500">
          {selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} ready` : "Drop one or more files here"}
        </span>
        {selectedFiles.length > 0 ? (
          <div className="pointer-events-auto status-graph-scroll mt-3 max-h-28 overflow-y-auto border-y border-cyan-300/15 py-2 text-left">
            {selectedFiles.map((fileName, index) => (
              <span key={`${fileName.name}-${fileName.size}-${index}`} className="flex min-w-0 items-center justify-between gap-3 py-1 text-xs font-semibold text-slate-300">
                <span className="truncate">{fileName.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-slate-500">{formatFileSize(fileName.size)}</span>
                  <button
                    type="button"
                    className="rounded-full border border-rose-400/30 px-2 py-0.5 text-[0.62rem] font-black text-rose-300 hover:bg-rose-400/10"
                    onClick={(event) => {
                      event.preventDefault();
                      removeFile(index);
                    }}
                  >
                    Remove
                  </button>
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="mt-1 block text-xs font-semibold text-slate-400">or click to choose resumes, cover letters, and docs</span>
        )}
        {selectedFiles.length > 0 ? (
          <button
            type="button"
            className="pointer-events-auto mt-3 border border-sky-800/60 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-sky-500 hover:bg-sky-950/50"
            onClick={(event) => {
              event.preventDefault();
              inputRef.current?.click();
            }}
          >
            Add more files
          </button>
        ) : null}
        <span role="status" className={`mt-2 block text-[0.68rem] font-bold uppercase tracking-[0.14em] ${isTooLarge ? "text-rose-300" : "text-slate-400"}`}>
          {selectedFiles.length > 0 ? `${formatFileSize(totalSize)} selected / 30 MB total` : "0 B selected / 30 MB total"}
        </span>
        <span className="mt-1 block text-xs text-slate-400">10 MB per file maximum.</span>
        {uploadError(selectedFiles) ? <span role="alert" className="block text-sm text-rose-200">{uploadError(selectedFiles)}</span> : null}
      </div>
    </div>
  );
}

function ExistingDocumentPicker({ documents }: { documents: UserDocumentItem[] }) {
  const [previewDocument, setPreviewDocument] = useState<UserDocumentItem | null>(null);

  if (documents.length === 0) {
    return (
      <div className="new-app-panel p-4 text-sm font-semibold text-slate-400">
        No account documents yet. Upload files above or use the Documents button later.
      </div>
    );
  }

  return (
    <fieldset className="new-app-panel p-4">
      <legend className="px-2 text-xs font-black uppercase tracking-[0.22em] text-sky-500">Attach saved documents</legend>
      <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto pr-1 status-graph-scroll">
        {documents.map((document) => (
          <label key={document.id} className="flex cursor-pointer items-center gap-3 border-b border-sky-800/45 py-3 hover:bg-sky-950/35">
            <input name="documentIds" type="checkbox" value={document.id} className="size-4 accent-sky-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-sky-500">{document.fileName}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">{formatFileSize(document.fileSize)}</span>
            </span>
            {isPreviewableDocument(document) ? (
              <button
                type="button"
                className="shrink-0 border border-sky-800/60 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-sky-500 hover:bg-sky-950/50"
                onClick={(event) => {
                  event.preventDefault();
                  setPreviewDocument(document);
                }}
              >
                Preview
              </button>
            ) : null}
          </label>
        ))}
      </div>
      {previewDocument ? <DocumentPreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} /> : null}
    </fieldset>
  );
}

function DocumentPreviewModal({ document, onClose }: { document: UserDocumentItem; onClose: () => void }) {
  return createPortal(
    <Dialog label={`Preview ${document.fileName}`} onClose={onClose} className="fixed inset-0 z-[80] bg-slate-950/82 p-3 backdrop-blur-sm sm:p-5">
      <section className="flex h-full w-full flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="break-words text-lg font-black text-slate-100">{document.fileName}</h3>
          <button type="button" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10" onClick={onClose}>Close</button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-900/60 p-3">
          <iframe sandbox="" src={`/documents/${document.id}/preview`} title={document.fileName} className="h-full w-full rounded-xl border border-white/10 bg-white" />
        </div>
      </section>
    </Dialog>,
    globalThis.document.body,
  );
}

function isPreviewableDocument(document: UserDocumentItem) {
  return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(document.fileType);
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue = "",
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const isMissing = required && value.trim().length === 0;

  return (
    <label className="group/field grid min-w-0 gap-1 border-b border-sky-800/45 py-3 text-sm font-black uppercase tracking-[0.16em] text-sky-500 transition hover:border-sky-600/60">
      <span className="flex items-center gap-2">
        {label}
        {isMissing ? <MissingBadge required={required} /> : null}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        onChange={(event) => setValue(event.target.value)}
        required={required}
        className="new-app-input w-full min-w-0 px-3 py-3 font-normal normal-case tracking-normal"
      />
    </label>
  );
}

function MissingBadge({ required = false }: { required?: boolean }) {
  return (
    <span aria-hidden="true" className="border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wide text-rose-200">
      {required ? "Missing required" : "Missing"}
    </span>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
