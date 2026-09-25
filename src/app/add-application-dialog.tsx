"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AutofillApplicationForm } from "./autofill-application-form";
import type { UserDocumentItem } from "./document-types";
import { Dialog } from "./ui/dialog";

export function AddApplicationDialog({ documents }: { documents: UserDocumentItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    function openWithShortcut(event: KeyboardEvent) {
      if (event.key !== "Enter" || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return;
      if (isOpen) { event.preventDefault(); event.stopPropagation(); return; }
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(true);
    }

    window.addEventListener("keydown", openWithShortcut, true);
    return () => window.removeEventListener("keydown", openWithShortcut, true);
  }, [isOpen]);

  return (
    <>
      <span className="group relative inline-flex shrink-0">
        <button
          type="button"
          aria-label="Add application"
          aria-keyshortcuts="Shift+Enter"
          className="grid size-12 place-items-center rounded-full border border-sky-300/45 bg-sky-400/16 text-3xl font-black leading-none text-sky-50 shadow-[0_0_28px_rgb(14_165_233/0.26)] transition hover:scale-105 hover:border-sky-100/70 hover:bg-sky-400/24 hover:text-white"
          onClick={() => setIsOpen(true)}
        >
          +
        </button>
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded border border-sky-300/30 bg-slate-950 px-3 py-1.5 text-xs font-bold text-sky-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          Shift + Enter
        </span>
      </span>

      {isOpen
        ? createPortal(
            <AddApplicationModal
              documents={documents}
              isExpanded={isExpanded}
              onAutofillReady={() => setIsExpanded(true)}
              onClose={() => {
                setIsOpen(false);
                setIsExpanded(false);
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function AddApplicationModal({
  documents,
  isExpanded,
  onAutofillReady,
  onClose,
}: {
  documents: UserDocumentItem[];
  isExpanded: boolean;
  onAutofillReady: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog label="Add application" onClose={onClose}
      className="details-overlay fixed inset-0 z-50 grid place-items-center bg-slate-950/76 px-4 py-6 backdrop-blur-sm"
    >
      <div className={`new-app-shell status-graph-scroll w-full overflow-y-auto border bg-slate-950/95 shadow-2xl shadow-black/45 ${isExpanded ? "h-[calc(100vh-3rem)] max-w-[92rem]" : "max-h-[calc(100vh-3rem)] max-w-3xl"}`}>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black text-sky-100">Add application</h2><button type="button" onClick={onClose} className="border border-white/20 px-4 py-2 text-sm font-bold">Cancel</button></div>
          <AutofillApplicationForm variant="modal" documents={documents} onAutofillReady={onAutofillReady} onSuccess={onClose} />
        </div>
      </div>
    </Dialog>
  );
}
