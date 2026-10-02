"use client";

import { useState } from "react";
import { jobDescriptionBlocks, jobDescriptionSections } from "./job-description-format";

export function CompanyLogo({ applicationId, card = false, large = false }: { applicationId: string; card?: boolean; large?: boolean }) {
  return (
    // The authenticated source route needs the browser's session cookie.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      loading="lazy"
      decoding="async"
      src={`/applications/${applicationId}/logo`}
      alt=""
      className={`${card || large ? "size-28" : "size-8"} shrink-0 object-contain`}
      onError={(event) => {
        event.currentTarget.hidden = true;
      }}
    />
  );
}

export function DetailEmptyState({ icon, title, description }: { icon: "file" | "folder" | "mail" | "calendar-plus"; title: string; description: string }) {
  return (
    <div className="detail-empty-state">
      <span className="detail-empty-icon"><DirectoryIcon name={icon} /></span>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

export function DirectoryIcon({ name }: { name: "back" | "calendar-plus" | "check" | "close" | "external" | "file" | "file-plus" | "folder" | "folder-plus" | "fullscreen" | "mail" | "mail-plus" | "menu" | "trash" }) {
  const paths = {
    back: <path d="m15 18-6-6 6-6M9 12h10" />,
    "calendar-plus": <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M12 13v5M9.5 15.5h5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    external: <><path d="M14 5h5v5M19 5l-8 8" /><path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" /></>,
    file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    "file-plus": <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M12 11v6M9 14h6" /></>,
    folder: <path d="M3 6h6l2 2h10v10H3z" />,
    "folder-plus": <><path d="M3 6h6l2 2h10v10H3z" /><path d="M12 11v4M10 13h4" /></>,
    fullscreen: <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 7 9 6 9-6" /></>,
    "mail-plus": <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 7 9 6 9-6M12 10v6M9 13h6" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  };

  return <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75">{paths[name]}</svg>;
}

export function Detail({
  label,
  value,
  navigationId,
  href,
  theme,
  wide = false,
  editable = false,
  showEditButton = true,
  hideLabel = false,
  onEdit,
  linkClassName,
  valueClassName,
}: {
  label: string;
  value: string;
  navigationId?: string;
  href?: string | null;
  theme?: { link: string; eyebrow: string; tile?: string; editIcon?: string; fieldGlow?: string };
  wide?: boolean;
  editable?: boolean;
  showEditButton?: boolean;
  hideLabel?: boolean;
  onEdit?: () => void;
  linkClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div
      data-detail-field={navigationId}
      tabIndex={navigationId ? 0 : undefined}
      role={navigationId ? "group" : undefined}
      aria-label={navigationId ? label : undefined}
      aria-keyshortcuts={navigationId && editable ? "Enter" : undefined}
      className={`detail-field group/detail relative ${label === "Job description" ? "py-1" : `border-b border-white/10 py-4 pr-12 ${theme?.fieldGlow ?? "hover:border-white/20"}`} text-left transition ${editable ? "" : "cursor-default"} ${wide ? "sm:col-span-2" : ""}`}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.target !== event.currentTarget || !editable || !onEdit) return;
        event.preventDefault();
        onEdit();
      }}
      onDoubleClick={(event) => {
        if (!editable || !onEdit) return;
        if (event.target instanceof Element && event.target.closest("a, button")) return;

        onEdit();
      }}
    >
      {!hideLabel ? <p className={`text-xs font-bold uppercase tracking-[0.2em] ${theme?.eyebrow ?? "text-slate-500"}`}>{label}</p> : null}
      {href ? (
        <a className={`mt-2 block break-words pr-8 text-sm font-semibold ${linkClassName ?? theme?.link ?? "text-sky-300 hover:text-sky-200"}`} href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          {value}
        </a>
      ) : label === "Job description" ? (
        <JobDescriptionReadView value={value} valueClassName={valueClassName} onEdit={onEdit} />
      ) : (
        <p className={`mt-2 whitespace-pre-wrap break-words pr-8 text-sm font-semibold leading-6 ${valueClassName ?? "text-slate-200"}`}>{value}</p>
      )}
      {editable && showEditButton && label !== "Job description" ? (
        <button type="button" className={`detail-edit-pencil border ${theme?.editIcon ?? ""}`} onClick={() => onEdit?.()} aria-label={`Edit ${label}`} title={`Edit ${label}`}>
          ✎
        </button>
      ) : null}
      {navigationId && editable ? <span className="detail-field-hint mt-2 text-xs font-semibold text-slate-400">Press Enter to modify</span> : null}
    </div>
  );
}

function JobDescriptionReadView({
  value,
  valueClassName,
  onEdit,
}: {
  value: string;
  valueClassName?: string;
  onEdit?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const lines = value.split("\n").map((line) => line.trim());
  const sections = jobDescriptionSections(lines);
  const hasDescription = value !== "No job description added" && value.trim().length > 0;

  async function copyDescription() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`job-description-reader ${valueClassName ?? "text-slate-200"}`}>
      {!hasDescription ? <DetailEmptyState icon="file" title="No job description added" description="Add the posting to keep the role’s responsibilities and requirements handy." /> : <div className="job-description-content job-description-scroll status-graph-scroll" role="region" aria-label="Job description content" tabIndex={0}>
        {sections.map((section, sectionIndex) => (
          <div key={`${section.heading ?? "intro"}-${sectionIndex}`} className="job-description-section">
            {section.heading ? (
              <h4>
                {section.heading}
              </h4>
            ) : null}
            {jobDescriptionBlocks(section.lines).map((block, index) => {
              if (block.type === "paragraph") return <p key={index} data-job-description-line={block.lines[0].index}>{block.lines.map((item) => item.line).join(" ")}</p>;
              const List = block.type === "ordered" ? "ol" : "ul";
              return <List key={index} start={block.type === "ordered" ? Number.parseInt(block.lines[0].line, 10) : undefined}>
                {block.lines.map((item) => <li key={item.index} data-job-description-line={item.index}>{item.line.replace(/^(?:[-*•●▪◦‣–—]|\d+[.)])\s+/, "")}</li>)}
              </List>;
            })}
          </div>
        ))}
      </div>}
      <div className="job-description-toolbar flex items-center gap-2">
        {hasDescription ? (
          <button type="button" className="detail-tool-button text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white" onClick={() => void copyDescription()}>
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
        {onEdit ? (
          <button type="button" className="detail-tool-button border-sky-300/30 bg-sky-400/10 text-sky-100 transition hover:border-sky-200/60 hover:bg-sky-400/20 hover:text-white" onClick={onEdit}>Edit</button>
        ) : null}
      </div>
    </section>
  );
}
