"use client";

import { createContext, useCallback, useContext, useEffect, useEffectEvent, useId, useMemo, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";

export type MutationAction = (formData: FormData) => unknown | Promise<unknown>;

type UnsavedChangesContextValue = {
  markDirty: (formId: string) => void;
  markSaved: (formId: string) => void;
  requestDiscard: (action: () => void) => void;
  onMutationSuccess?: () => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children, onChange, onDiscardRequest, onMutationSuccess }: { children: ReactNode; onChange: (hasUnsavedChanges: boolean) => void; onDiscardRequest?: (action: () => void) => void; onMutationSuccess?: () => void }) {
  const dirtyFormIds = useRef(new Set<string>());

  const update = useCallback((formId: string, isDirty: boolean) => {
    if (isDirty) dirtyFormIds.current.add(formId);
    else dirtyFormIds.current.delete(formId);
    onChange(dirtyFormIds.current.size > 0);
  }, [onChange]);
  const requestDiscard = useCallback((action: () => void) => {
    if (dirtyFormIds.current.size === 0) {
      action();
      return;
    }
    if (!onDiscardRequest) return;
    onDiscardRequest(() => {
      dirtyFormIds.current.clear();
      onChange(false);
      action();
    });
  }, [onChange, onDiscardRequest]);
  const value = useMemo(() => ({ markDirty: (formId: string) => update(formId, true), markSaved: (formId: string) => update(formId, false), requestDiscard, onMutationSuccess }), [onMutationSuccess, requestDiscard, update]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useDiscardChanges() {
  return useContext(UnsavedChangesContext)?.requestDiscard ?? ((action: () => void) => action());
}

export function mutationFeedback(result: unknown): { success: boolean; message: string } {
  if (result && typeof result === "object" && "success" in result) {
    const success = result.success === true;
    return { success, message: "message" in result && typeof result.message === "string" ? result.message : success ? "Saved." : "Could not save. Check your entries and try again." };
  }
  return { success: false, message: "The server did not confirm success. Check the saved data before trying again." };
}

export function uploadError(files: Array<{ size: number }>) {
  if (files.some((file) => file.size > 10 * 1024 * 1024)) return "Each file must be 10 MB or smaller.";
  if (files.reduce((total, file) => total + file.size, 0) > 30 * 1024 * 1024) return "Choose no more than 30 MB of files per upload.";
  return "";
}

// Convert local wall-clock inputs in the browser, not in the server's timezone.
export function normalizeDateTimes(data: FormData, form: HTMLFormElement) {
  form.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]').forEach((input) => {
    if (input.name && input.value) data.set(input.name, new Date(input.value).toISOString());
  });
}

export function ActionForm({ action, onSuccess, children, onChange, ...props }: Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: MutationAction;
  onSuccess?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const unsavedChanges = useContext(UnsavedChangesContext);
  const formId = useId();

  const markSavedOnUnmount = useEffectEvent(() => unsavedChanges?.markSaved(formId));
  useEffect(() => () => markSavedOnUnmount(), [formId]);

  return (
    <form {...props} aria-busy={pending} onChange={(event) => {
      setFeedback(null);
      unsavedChanges?.markDirty(formId);
      onChange?.(event);
    }} onSubmit={(event) => {
      event.preventDefault();
      if (busy.current) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      const error = uploadError(data.getAll("files").filter((file): file is File => file instanceof File));
      if (error) { setFeedback({ success: false, message: error }); return; }
      normalizeDateTimes(data, form);
      busy.current = true;
      setFeedback(null);
      startTransition(async () => {
        try {
          const result = mutationFeedback(await action(data));
          setFeedback(result);
          if (result.success) {
            unsavedChanges?.markSaved(formId);
            onSuccess?.();
            unsavedChanges?.onMutationSuccess?.();
          }
        } catch {
          setFeedback({ success: false, message: "Could not complete the request. Your entries are still here. Please try again." });
        } finally {
          busy.current = false;
        }
      });
    }}>
      {children}
      {pending ? <p role="status" className="text-sm text-sky-200">Saving...</p> : null}
      {feedback ? <p role={feedback.success ? "status" : "alert"} className={`text-sm ${feedback.success ? "text-sky-200" : "text-rose-200"}`}>{feedback.message}</p> : null}
    </form>
  );
}
