"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ActionForm } from "./ui/action-form";
import { SubmitButton } from "./ui/submit-button";

export function AccountMenu({
  name,
  hasProfilePicture,
  primaryLink,
  returnTo,
  signOut,
  uploadProfilePicture,
  archiveControl,
}: {
  name: string;
  hasProfilePicture: boolean;
  primaryLink: { href: string; label: string };
  returnTo: "/" | "/documents";
  signOut: () => void | Promise<void>;
  uploadProfilePicture: (formData: FormData) => unknown | Promise<unknown>;
  archiveControl?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fileError, setFileError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (menuRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false); }}>
      <button
        ref={triggerRef}
        type="button"
        className="group grid size-12 place-items-center overflow-hidden rounded-full border border-sky-300/25 bg-slate-950/70 text-sm font-black text-sky-100 shadow-[0_0_22px_rgb(14_165_233/0.14)] transition hover:border-sky-200/55 hover:bg-sky-400/12"
        aria-label="Account options"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
      >
        {hasProfilePicture ? (
          <span className="h-full w-full bg-cover bg-center" style={{ backgroundImage: "url('/profile-picture')" }} />
        ) : (
          initials(name)
        )}
      </button>

      {isOpen ? (
        <div id={menuId} className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-72 max-w-[calc(100vw-2rem)] border border-sky-300/20 bg-slate-950/98 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="border-b border-white/10 pb-3 text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-500">Profile</p>
            <ActionForm ref={uploadFormRef} action={uploadProfilePicture} onSuccess={() => uploadFormRef.current?.reset()} className="mt-3">
              <input name="returnTo" type="hidden" value={returnTo} />
              <label className="group relative mx-auto grid size-20 cursor-pointer place-items-center overflow-hidden rounded-full border border-sky-300/25 bg-slate-950/80 text-xl font-black text-sky-100 shadow-[0_0_28px_rgb(14_165_233/0.16)] transition hover:border-sky-200/60 hover:bg-sky-400/12">
                {hasProfilePicture ? (
                  <span className="h-full w-full bg-cover bg-center transition group-hover:scale-105" style={{ backgroundImage: "url('/profile-picture')" }} />
                ) : (
                  initials(name)
                )}
                <span className="absolute inset-0 grid place-items-center bg-slate-950/62 text-lg text-sky-100 opacity-0 transition group-hover:opacity-100" aria-hidden="true">
                  ✎
                </span>
                <input
                  name="profilePicture"
                  type="file"
                  aria-label="Upload profile picture"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    setFileError("");
                    if (!file) return;
                    if (file.size > 3 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
                      setFileError("Choose a PNG, JPEG, WebP, or GIF image up to 3 MB.");
                      event.currentTarget.value = "";
                      return;
                    }
                    uploadFormRef.current?.requestSubmit();
                  }}
                />
              </label>
              {fileError ? <p role="alert" className="mt-2 text-sm text-rose-200">{fileError}</p> : null}
            </ActionForm>
            <p className="mx-auto mt-2 max-w-56 truncate text-sm font-bold text-slate-200">{name}</p>
          </div>

          <div className="mt-3 grid gap-2">
            <Link href={primaryLink.href} className="border border-white/10 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-sky-300/35 hover:bg-sky-400/10" onClick={() => setIsOpen(false)}>
              {primaryLink.label}
            </Link>
            {archiveControl}
            <Link href="/settings" className="border border-white/10 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-sky-300/35 hover:bg-sky-400/10" onClick={() => setIsOpen(false)}>Account settings</Link>
            <form action={signOut}>
              <SubmitButton className="w-full border border-rose-400/25 px-4 py-3 text-left text-sm font-bold text-rose-200 transition hover:bg-rose-400/10">
                Sign out
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "JP";
}
