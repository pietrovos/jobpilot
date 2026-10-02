"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApplicationStatus } from "@/generated/prisma/enums";
import { ActionForm, mutationFeedback, useDiscardChanges } from "./ui/action-form";
import type { ApplicationDetail } from "./application-types";
import { daysInMonth, monthNames, pad, parseDatetimeLocal, to12Hour, to24Hour } from "./application-format";
import { statusDropdownStyles, statusLabels, statusSelectTextStyles } from "./application-status-styles";
import { Detail } from "./detail-primitives";

export function InlineEditableDetail({
  application,
  editing,
  theme,
  name,
  label,
  type = "text",
  value,
  defaultValue,
  href,
  linkClassName,
  valueClassName,
  multiline = false,
  wide = false,
  hideLabel = false,
  updateApplication,
  onEdit,
  onDone,
}: {
  application: ApplicationDetail;
  editing: boolean;
  theme: { fieldBorder: string; fieldLabel: string; fieldFocus: string; fieldInput: string; fieldGlow: string; editIcon: string; link: string; eyebrow: string; button: string; tile: string };
  name: string;
  label: string;
  type?: string;
  value: string;
  defaultValue: string;
  href?: string | null;
  linkClassName?: string;
  valueClassName?: string;
  multiline?: boolean;
  wide?: boolean;
  hideLabel?: boolean;
  updateApplication: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  onEdit: () => void;
  onDone: () => void;
}) {
  const requestDiscard = useDiscardChanges();
  const jobDescriptionRows = Math.min(24, Math.max(8, defaultValue.split("\n").length + 2));
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!editing) {
    return <Detail label={label} value={value} navigationId={hideLabel ? undefined : name} href={href} theme={theme} wide={wide} editable showEditButton={!["company", "role", "jobUrl", "notes", "jobPostedAt"].includes(name)} onEdit={onEdit} linkClassName={linkClassName} valueClassName={valueClassName} hideLabel={hideLabel} />;
  }

  return (
    <ActionForm
      action={updateApplication.bind(null, application.id)} onSuccess={() => {
        setIsFullscreen(false);
        onDone();
      }}
      className={isFullscreen ? "fixed inset-0 z-[60] grid grid-rows-[auto_1fr_auto] gap-5 overscroll-contain overflow-y-auto bg-slate-950 p-5 text-left sm:p-8" : `${name === "jobDescription" ? "detail-surface mt-4" : `border-b py-4 pr-12 ${theme.fieldGlow}`} transition ${theme.fieldBorder} ${wide ? "sm:col-span-2" : ""}`}
    >
      {isFullscreen ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${theme.fieldLabel}`}>Fullscreen editor</p>
            <h4 className="mt-1 text-xl font-black text-slate-100">Job description</h4>
          </div>
          <button type="button" className="border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10" onClick={() => setIsFullscreen(false)}>
            Exit fullscreen
          </button>
        </div>
      ) : null}
      {!isFullscreen && !hideLabel ? <span className={`text-xs font-bold uppercase tracking-[0.2em] ${theme.fieldLabel}`}>{label}</span> : null}
      {multiline ? (
        <textarea
          name={name}
          aria-label={label}
          rows={name === "jobDescription" ? jobDescriptionRows : 4}
          defaultValue={defaultValue}
          autoFocus
          className={`${isFullscreen ? "min-h-[calc(100vh-13rem)] overscroll-contain" : "mt-2"} w-full min-w-0 resize-none border-x-0 border-t-0 bg-transparent px-0 py-2 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500 ${theme.fieldFocus} ${theme.fieldBorder}`}
        />
      ) : name === "appliedAt" ? (
        <AppliedAtPicker name={name} defaultValue={defaultValue} theme={theme} />
      ) : (
        <input
          name={name}
          aria-label={label}
          required={name === "company" || name === "role"}
          type={type}
          defaultValue={defaultValue}
          autoFocus
          className={`mt-2 w-full min-w-0 border-x-0 border-t-0 bg-transparent px-0 py-2 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-500 ${theme.fieldFocus} ${theme.fieldBorder}`}
        />
      )}
      <div className="mt-3 flex gap-2">
        <button className={`rounded-full px-4 py-2 text-xs font-bold ${theme.button}`}>
          Save
        </button>
        {name === "jobDescription" ? (
          <button
            type="button"
            className="rounded-full border border-sky-300/30 px-4 py-2 text-xs font-bold text-sky-100 hover:border-sky-200/60 hover:bg-sky-400/10"
            onClick={() => setIsFullscreen((current) => !current)}
          >
            {isFullscreen ? "Standard editor" : "Fullscreen"}
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
            onClick={() => requestDiscard(() => {
              setIsFullscreen(false);
              onDone();
            })}
        >
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}

function AppliedAtPicker({
  name,
  defaultValue,
  theme,
}: {
  name: string;
  defaultValue: string;
  theme: { fieldBorder: string; fieldFocus: string };
}) {
  const initial = parseDatetimeLocal(defaultValue);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [year, setYear] = useState(initial.year);
  const [hour, setHour] = useState(to12Hour(initial.hour).hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(initial.hour >= 12 ? "PM" : "AM");
  const maxDay = daysInMonth(year, month);
  const safeDay = Math.min(day, maxDay);
  const value = `${year}-${pad(month)}-${pad(safeDay)}T${pad(to24Hour(hour, period))}:${pad(minute)}`;
  const selectClass = `new-app-input min-w-0 px-3 py-2 text-sm font-semibold ${theme.fieldFocus} ${theme.fieldBorder}`;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1.1fr_0.8fr_0.9fr_0.7fr_0.7fr_0.7fr]">
      <input name={name} type="hidden" value={new Date(value).toISOString()} />
      <select aria-label="Month" autoFocus value={month} onChange={(event) => setMonth(Number(event.target.value))} className={selectClass}>
        {monthNames.map((label, index) => (
          <option key={label} value={index + 1}>{label}</option>
        ))}
      </select>
      <select aria-label="Day" value={safeDay} onChange={(event) => setDay(Number(event.target.value))} className={selectClass}>
        {Array.from({ length: maxDay }, (_, index) => index + 1).map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select aria-label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))} className={selectClass}>
        {years.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select aria-label="Hour" value={hour} onChange={(event) => setHour(Number(event.target.value))} className={selectClass}>
        {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select aria-label="Minute" value={minute} onChange={(event) => setMinute(Number(event.target.value))} className={selectClass}>
        {Array.from({ length: 60 }, (_, index) => index).map((item) => (
          <option key={item} value={item}>{pad(item)}</option>
        ))}
      </select>
      <select aria-label="AM or PM" value={period} onChange={(event) => setPeriod(event.target.value as "AM" | "PM")} className={selectClass}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export function StatusForm({
  applicationId,
  onStatusChange,
  status,
  updateApplicationStatus,
}: {
  applicationId: string;
  onStatusChange: (applicationId: string, from: ApplicationStatus, to: ApplicationStatus) => void;
  status: ApplicationStatus;
  updateApplicationStatus: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
}) {
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const formRef = useRef<HTMLFormElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = `status-options-${applicationId}`;

  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    function closeMenu(event: MouseEvent) {
      const target = event.target as Node;

      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function updateMenuPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      setMenuPosition({
        top: rect.bottom + 208 > window.innerHeight ? Math.max(8, rect.top - 208) : rect.bottom + 8,
        left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  function chooseStatus(nextStatus: ApplicationStatus) {
    setSelectedStatus(nextStatus);
    setIsOpen(false);
    buttonRef.current?.focus();
    window.requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  const menu = isOpen
    ? createPortal(
        <div
          ref={menuRef}
          className={`fixed z-[80] w-56 overflow-hidden rounded-2xl border p-2 shadow-2xl backdrop-blur-xl ${statusDropdownStyles[selectedStatus].menu}`}
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div id={listboxId} className="grid gap-1" role="listbox" aria-label="Application status" onKeyDown={(event) => {
            const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
            const index = options.indexOf(document.activeElement as HTMLButtonElement);
            let next = index;
            if (event.key === "ArrowDown") next = (index + 1) % options.length;
            else if (event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else if (event.key === "Tab") { setIsOpen(false); buttonRef.current?.focus(); return; }
            else if (event.key.length === 1 && event.key !== " ") {
              const match = options.findIndex((option) => option.textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase()));
              if (match < 0) return;
              next = match;
            } else return;
            event.preventDefault();
            options[next]?.focus();
          }}>
            {Object.values(ApplicationStatus).map((item) => (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={item === selectedStatus}
                tabIndex={-1}
                className={`flex items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left text-sm font-bold text-slate-300 transition ${statusDropdownStyles[item].option} ${item === selectedStatus ? "bg-white/8 text-white" : ""}`}
                onClick={() => chooseStatus(item)}
              >
                <span className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${statusDropdownStyles[item].dot}`} />
                  {statusLabels[item]}
                </span>
                {item === selectedStatus ? <span className="text-xs text-sky-300">ACTIVE</span> : null}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <ActionForm ref={formRef} action={async (data) => {
      try {
        const result = await updateApplicationStatus(applicationId, data);
        if (mutationFeedback(result).success) {
          if (status !== selectedStatus) onStatusChange(applicationId, status, selectedStatus);
        } else setSelectedStatus(status);
        return result;
      } catch (error) {
        setSelectedStatus(status);
        throw error;
      }
    }} className="relative flex gap-2">
      <input name="status" type="hidden" value={selectedStatus} />
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setIsOpen(true); }
          }}
          className={`group flex min-w-44 items-center justify-between gap-3 rounded-full border px-4 py-2 text-sm font-black outline-none transition duration-200 ${statusDropdownStyles[selectedStatus].button}`}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${statusDropdownStyles[selectedStatus].dot}`} />
            <span className={statusSelectTextStyles[selectedStatus]}>{statusLabels[selectedStatus]}</span>
          </span>
          <span className={`text-xs transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>
      {menu}
    </ActionForm>
  );
}
