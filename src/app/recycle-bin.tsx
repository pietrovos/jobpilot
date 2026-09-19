"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "./ui/dialog";
import { ActionForm } from "./ui/action-form";

type DeletedApplicationItem = {
  id: string;
  company: string;
  role: string;
};

type RecycleBinProps = {
  applications: DeletedApplicationItem[];
  restoreDeletedApplication: (deletedApplicationId: string) => unknown | Promise<unknown>;
};

export function RecycleBin({ applications, restoreDeletedApplication }: RecycleBinProps) {
  const [isOpen, setIsOpen] = useState(false);


  return (
    <>
      <button
        type="button"
        aria-label="Open recycle bin"
        className="recycle-trigger fixed bottom-5 right-5 z-40 grid size-14 place-items-center border text-2xl backdrop-blur transition hover:-translate-y-1"
        onClick={() => setIsOpen(true)}
      >
        ♻
        {applications.length > 0 ? (
          <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-sm bg-cyan-300 text-xs font-black text-slate-950 shadow-[0_0_18px_rgb(34_211_238/0.45)]">
            {applications.length}
          </span>
        ) : null}
      </button>

      {isOpen
        ? createPortal(
            <Dialog label="Recycle bin" onClose={() => setIsOpen(false)} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/78 px-4 py-6 backdrop-blur-sm">
              <section className="status-graph-scroll max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto rounded-[0.75rem] border border-white/10 bg-slate-950/90 p-5 shadow-2xl shadow-black/50" onClick={(event) => event.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black">Recycle bin</h2><button type="button" onClick={() => setIsOpen(false)} className="border border-white/20 px-4 py-2">Close</button></div>
                {applications.length === 0 ? <p className="py-5 text-slate-400">The recycle bin is empty.</p> : null}
                <p className="mb-4 text-sm text-slate-400">Deleted applications and their attachments are retained for 30 days. Older legacy entries can only restore their saved basic details.</p>
                <div className="grid gap-3">
                  {applications.map((application) => (
                    <article key={application.id} className="flex flex-col justify-between gap-4 border-l-2 border-slate-400/25 bg-slate-950/30 py-5 pl-5 pr-3 transition hover:border-slate-300/60 hover:bg-white/[0.04] sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <h3 className="break-words text-xl font-black text-slate-100">{application.company}</h3>
                        <p className="break-words font-semibold text-slate-400">{application.role}</p>
                      </div>
                      <ActionForm action={restoreDeletedApplication.bind(null, application.id)}>
                        <button className="w-full rounded-full bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 sm:w-auto">
                          Restore
                        </button>
                      </ActionForm>
                    </article>
                  ))}
                </div>
              </section>
            </Dialog>,
            document.body,
          )
        : null}
    </>
  );
}
