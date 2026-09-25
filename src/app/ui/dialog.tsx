"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Dialog({ children, label, onClose, onEscape, onBack, className = "", initialFocusSelector }: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  onEscape?: () => void;
  onBack?: () => void;
  className?: string;
  initialFocusSelector?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    const initialFocus = (initialFocusSelector && dialog?.querySelector<HTMLElement>(initialFocusSelector))
      || dialog?.querySelector<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])");
    initialFocus?.focus();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [initialFocusSelector]);

  return (
    <dialog ref={ref} aria-label={label} className={`ui-dialog ${className}`}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); (onEscape ?? onClose)(); }}
      onKeyDownCapture={(event) => {
        if (!onBack || event.key !== "Backspace" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.target instanceof Element && event.target.closest("dialog") !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        onBack();
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      {children}
    </dialog>
  );
}
