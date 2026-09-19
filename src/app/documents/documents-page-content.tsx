"use client";

import { useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import type { UserDocumentItem } from "../document-types";
import { Dialog } from "../ui/dialog";
import { ActionForm, uploadError } from "../ui/action-form";

export function DocumentsPageContent({
  documents,
  deleteUserDocument,
  uploadUserDocuments,
}: {
  documents: UserDocumentItem[];
  deleteUserDocument: (documentId: string) => unknown | Promise<unknown>;
  uploadUserDocuments: (formData: FormData) => unknown | Promise<unknown>;
}) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<UserDocumentItem | null>(null);

  return (
    <>
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black">Documents</h1>
          <button
            type="button"
            aria-label="Add documents"
            className="grid size-12 place-items-center rounded-full border border-sky-300/45 bg-sky-400/16 text-3xl font-black leading-none text-sky-50 shadow-[0_0_28px_rgb(14_165_233/0.26)] transition hover:scale-105 hover:border-sky-100/70 hover:bg-sky-400/24 hover:text-white"
            onClick={() => setIsUploadOpen(true)}
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {documents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-slate-400">
            No documents uploaded yet.
          </div>
        ) : null}

        {documents.map((document) => (
          <article key={document.id} className="border-l-2 border-sky-400/35 bg-slate-950/30 py-5 pl-5 pr-2 transition hover:bg-sky-400/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <a href={`/documents/${document.id}`} className="break-words text-xl font-black text-sky-100 hover:underline">
                  {document.fileName}
                </a>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {formatFileSize(document.fileSize)} / {formatDateTime(document.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isPreviewableDocument(document) ? (
                  <button type="button" className="rounded-full border border-sky-300/25 px-4 py-2 text-sm font-bold text-sky-200 hover:bg-sky-400/10" onClick={() => setPreviewDocument(document)}>
                    Preview
                  </button>
                ) : null}
                <a href={`/documents/${document.id}`} className="download-button rounded-full border px-4 py-2 text-sm font-bold">
                  Download
                </a>
                <ActionForm action={deleteUserDocument.bind(null, document.id)}>
                  <button className="rounded-full border border-rose-400/30 px-4 py-2 text-sm font-bold text-rose-300 hover:bg-rose-400/10">
                    Delete
                  </button>
                </ActionForm>
              </div>
            </div>
          </article>
        ))}
      </div>

      {isUploadOpen ? createPortal(
        <UploadDocumentsDialog uploadUserDocuments={uploadUserDocuments} onClose={() => setIsUploadOpen(false)} />,
        document.body,
      ) : null}

      {previewDocument ? createPortal(
        <FilePreviewModal document={previewDocument} onClose={() => setPreviewDocument(null)} />,
        document.body,
      ) : null}
    </>
  );
}

function UploadDocumentsDialog({ uploadUserDocuments, onClose }: { uploadUserDocuments: (formData: FormData) => unknown | Promise<unknown>; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileStoreRef = useRef<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; size: number }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
  const isTooLarge = totalSize > 30 * 1024 * 1024;

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
    appendFiles(Array.from(event.dataTransfer.files).filter((file) => file.size > 0));
  }

  return (
    <Dialog label="Add documents" onClose={onClose} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/76 px-4 py-6 backdrop-blur-sm">
      <section className="status-graph-scroll max-h-[calc(100vh-3rem)] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-sky-300/15 bg-[radial-gradient(circle_at_top_left,rgb(14_165_233/0.16),transparent_34%),#0f172a] p-5 shadow-2xl shadow-sky-950/35">
        <div className="flex items-center justify-between border-b border-sky-300/10 pb-4">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-300">Add documents</p>
          <button type="button" className="border border-sky-300/15 px-4 py-2 text-sm font-black text-sky-100 hover:bg-sky-400/10" onClick={onClose}>Cancel</button>
        </div>
        <ActionForm action={uploadUserDocuments} onSuccess={onClose} className="mt-5 grid gap-3">
          <div
            className={`relative grid min-h-44 cursor-pointer place-items-center rounded-3xl border border-dashed px-5 py-5 text-center transition ${isDragging ? "border-sky-200 bg-sky-400/20 shadow-[0_0_34px_rgb(56_189_248/0.24)]" : "border-sky-400/30 bg-sky-400/10 hover:border-sky-300/60 hover:bg-sky-400/15"}`}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
            }}
            onDrop={handleDrop}
          >
            <input ref={inputRef} id="document-upload" name="files" type="file" aria-label="Documents, up to 10 MB each and 30 MB total" multiple required className="sr-only" onChange={(event) => appendFiles(Array.from(event.currentTarget.files ?? []))} />
            <label htmlFor="document-upload" className="absolute inset-0 cursor-pointer" aria-label="Choose documents" />
            <div className="pointer-events-none relative w-full">
              <span className="block text-base font-black text-sky-100">{selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} ready` : "Drop documents here"}</span>
              {selectedFiles.length > 0 ? (
                <div className="pointer-events-auto mt-3 max-h-36 overflow-y-auto rounded-2xl border border-sky-300/15 bg-slate-950/45 p-2 text-left">
                  {selectedFiles.map((file, index) => (
                    <span key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center justify-between gap-3 py-1 text-xs font-semibold text-slate-300">
                      <span className="truncate">{file.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-slate-500">{formatFileSize(file.size)}</span>
                        <button type="button" className="rounded-full border border-rose-400/30 px-2 py-0.5 text-[0.62rem] font-black text-rose-300 hover:bg-rose-400/10" onClick={(event) => { event.preventDefault(); removeFile(index); }}>Remove</button>
                      </span>
                    </span>
                  ))}
                </div>
              ) : <span className="mt-1 block text-xs font-semibold text-slate-400">or click to choose multiple files</span>}
              {selectedFiles.length > 0 ? <button type="button" className="pointer-events-auto mt-3 rounded-full border border-sky-300/25 px-3 py-1.5 text-xs font-black text-sky-200 hover:bg-sky-400/10" onClick={(event) => { event.preventDefault(); inputRef.current?.click(); }}>Add more files</button> : null}
              <span className={`mt-2 block text-[0.68rem] font-bold uppercase tracking-[0.14em] ${isTooLarge ? "text-rose-300" : "text-slate-400"}`}>{formatFileSize(totalSize)} selected / 30 MB total</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">10 MB per file, 30 MB total per upload.</p>
          {uploadError(selectedFiles) ? <p role="alert" className="text-sm text-rose-200">{uploadError(selectedFiles)}</p> : null}
          <button disabled={selectedFiles.length === 0 || Boolean(uploadError(selectedFiles))} className="justify-self-start rounded-full bg-sky-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-sky-300 disabled:opacity-50">Upload documents</button>
        </ActionForm>
      </section>
    </Dialog>
  );
}

function FilePreviewModal({ document, onClose }: { document: UserDocumentItem; onClose: () => void }) {
  return (
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
    </Dialog>
  );
}

function isPreviewableDocument(document: UserDocumentItem) {
  return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(document.fileType);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}
