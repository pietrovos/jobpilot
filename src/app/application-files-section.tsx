"use client";

import { useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "./ui/dialog";
import { ActionForm, uploadError } from "./ui/action-form";
import type { ApplicationDetail } from "./application-types";
import type { UserDocumentItem } from "./document-types";
import { formatDateTime, formatFileSize, hasDraggedFiles, isPreviewableFile } from "./application-format";
import { DetailEmptyState, DirectoryIcon } from "./detail-primitives";
import { TimeZoneContext } from "./time-zone";

export function ApplicationFiles({
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
