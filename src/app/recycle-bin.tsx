"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node) || triggerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open recycle bin"
        aria-expanded={isOpen}
        aria-controls="recycle-bin-panel"
        className="recycle-trigger fixed bottom-5 right-5 z-40 grid size-14 place-items-center border backdrop-blur transition hover:-translate-y-1"
        onClick={() => setIsOpen((open) => !open)}
      >
        <TrashIcon className="size-6" />
        {applications.length > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-6 place-items-center rounded-full bg-cyan-300 px-1.5 py-1 text-xs font-black leading-none text-slate-950 shadow-[0_0_18px_rgb(34_211_238/0.45)]">
            {applications.length}
          </span>
        ) : null}
      </button>

      {isOpen
        ? createPortal(
            <section ref={panelRef} id="recycle-bin-panel" role="dialog" aria-label="Recycle bin" className="recycle-shell status-graph-scroll fixed bottom-24 right-5 z-50 max-h-[calc(100dvh-7rem)] w-[min(25rem,calc(100vw-2.5rem))] overflow-y-auto border p-5 text-slate-100">
              <header className="mb-5 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><TrashIcon className="size-5" /></span>
                  <div>
                    <h2 className="text-base font-bold leading-tight">Recycle bin</h2>
                    <p className="mt-1 text-xs text-slate-400">{applications.length} {applications.length === 1 ? "application" : "applications"}</p>
                  </div>
                </div>
                <button ref={closeRef} type="button" aria-label="Close recycle bin" onClick={() => { setIsOpen(false); triggerRef.current?.focus(); }} className="recycle-close grid size-9 shrink-0 place-items-center border text-slate-400 transition" title="Close">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-4"><path d="M5 5l14 14M19 5L5 19" /></svg>
                </button>
              </header>
              {applications.length === 0 ? (
                <div className="recycle-empty flex flex-col items-center border px-5 py-8 text-center">
                  <span className="mb-3 grid size-12 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400"><TrashIcon className="size-6" /></span>
                  <p className="font-semibold">The recycle bin is empty.</p>
                  <p className="mt-1 text-sm text-slate-400">Deleted applications will appear here.</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {applications.map((application) => (
                    <article key={application.id} className="recycle-card flex items-center justify-between gap-3 border px-4 py-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-bold text-slate-100">{application.company}</h3>
                        <p className="mt-0.5 break-words text-xs text-slate-400">{application.role}</p>
                      </div>
                      <ActionForm action={restoreDeletedApplication.bind(null, application.id)}>
                        <button className="recycle-restore shrink-0 px-3 py-2 text-xs font-bold transition">Restore</button>
                      </ActionForm>
                    </article>
                  ))}
                </div>
              )}
              <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">Deleted applications and attachments are kept for 30 days. Older legacy entries may only restore basic details.</p>
            </section>,
            document.body,
          )
        : null}
    </>
  );
}

function TrashIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
    </svg>
  );
}
