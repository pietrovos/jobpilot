"use client";

import { createPortal } from "react-dom";
import { Dialog } from "./ui/dialog";
import { ActionForm, useDiscardChanges } from "./ui/action-form";
import { DirectoryIcon } from "./detail-primitives";

export type DeleteTarget = {
  ids: string[];
  label: string;
};

export function DiscardButton({ onDiscard }: { onDiscard: () => void }) {
  const requestDiscard = useDiscardChanges();

  return (
    <button type="button" className="grid size-9 place-items-center text-slate-400 transition hover:text-white" aria-label="Cancel" title="Cancel" onClick={() => requestDiscard(onDiscard)}>
      <DirectoryIcon name="close" />
    </button>
  );
}

export function DiscardChangesConfirmation({ onCancel, onDiscard }: { onCancel: () => void; onDiscard: () => void }) {
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

export function DeleteConfirmation({
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
