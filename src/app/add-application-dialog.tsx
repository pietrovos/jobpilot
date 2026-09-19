"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AutofillApplicationForm } from "./autofill-application-form";
import type { UserDocumentItem } from "./document-types";
import { Dialog } from "./ui/dialog";

export function AddApplicationDialog({ documents }: { documents: UserDocumentItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);


  return (
    <>
      <button
        type="button"
        aria-label="Add application"
        className="grid size-12 place-items-center rounded-full border border-sky-300/45 bg-sky-400/16 text-3xl font-black leading-none text-sky-50 shadow-[0_0_28px_rgb(14_165_233/0.26)] transition hover:scale-105 hover:border-sky-100/70 hover:bg-sky-400/24 hover:text-white"
        onClick={() => setIsOpen(true)}
      >
        +
      </button>

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
