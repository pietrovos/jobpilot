"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

type ApplicationFiltersProps = {
  q: string;
  status: string;
  sort: string;
  sortModes: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string }>;
};

export function ApplicationFilters({ q, status, sort, sortModes, statuses }: ApplicationFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function updateStatus(nextStatus: string) {
    updateParam("status", nextStatus);
  }

  function updateSort(nextSort: string) {
    updateParam("sort", nextSort);
  }

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    const draftQuery = String(new FormData(formRef.current!).get("q") ?? "").trim();
    if (draftQuery) params.set("q", draftQuery);
    else params.delete("q");

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <form ref={formRef} role="search" aria-label="Filter applications" aria-busy={pending} onSubmit={(event) => { event.preventDefault(); updateParam("q", String(new FormData(event.currentTarget).get("q") ?? "").trim()); }} className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 gap-2">
        <input
          key={q}
          aria-label="Search company, role, notes"
          name="q"
          defaultValue={q}
          placeholder="Search company, role, notes"
          autoComplete="off"
          spellCheck={false}
          className="filter-control filter-search min-w-0 flex-1 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <button type="submit" disabled={pending} className="filter-control shrink-0 px-4 py-3 text-sm font-bold text-sky-200">Search</button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
        <FilterMenu label="Filter by status" value={status} options={[{ value: "", label: "All" }, ...statuses]} disabled={pending} width="sm:w-36" onChange={updateStatus} />
        <FilterMenu label="Sort applications" value={sort} options={sortModes} disabled={pending} width="sm:w-40" onChange={updateSort} />
      </div>
      {q || status ? <button type="button" className="px-3 py-2 text-sm text-sky-200" disabled={pending} onClick={() => { const params = new URLSearchParams(searchParams); params.delete("q"); params.delete("status"); params.delete("page"); startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false })); }}>Clear filters</button> : null}
      <span role="status" className="sr-only">{pending ? "Updating applications..." : ""}</span>
    </form>
  );
}

function FilterMenu({ label, value, options, disabled, width, onChange }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  width: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = Math.min(288, options.length * 42 + 16);
      setPosition({
        top: rect.bottom + menuHeight + 8 > window.innerHeight ? Math.max(8, rect.top - menuHeight - 8) : rect.bottom + 8,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: rect.width,
      });
    };
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("mousedown", close);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;

    const option = menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?? menuRef.current?.querySelector<HTMLButtonElement>('[role="option"]');
    option?.focus();
  }, [open]);

  function choose(next: string) {
    setOpen(false);
    triggerRef.current?.focus();
    onChange(next);
  }

  return <div className="filter-select-shell relative">
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      className={`filter-control flex w-full items-center justify-between gap-3 py-3 pl-3 pr-3 text-sm text-slate-100 outline-none ${width}`}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen(true);
        } else if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <span>{selected.label}</span><span aria-hidden="true" className={`filter-arrow relative text-cyan-500 ${open ? "rotate-180" : ""}`} />
    </button>
    {open ? createPortal(
      <div ref={menuRef} id={listboxId} role="listbox" aria-label={label} className="filter-menu fixed z-[70] max-h-72 overflow-y-auto border p-1 shadow-2xl" style={position} onKeyDown={(event) => {
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        let next = index;
        if (event.key === "ArrowDown") next = (index + 1) % items.length;
        else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = items.length - 1;
        else if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return; }
        else return;
        event.preventDefault();
        items[next]?.focus();
      }}>
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} tabIndex={-1} className={`block w-full rounded px-3 py-2 text-left text-sm ${option.value === value ? "bg-cyan-400/15 text-cyan-100" : "text-slate-200 hover:bg-white/10"}`} onClick={() => choose(option.value)}>{option.label}</button>)}
      </div>, document.body) : null}
  </div>;
}
