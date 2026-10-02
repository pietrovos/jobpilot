"use client";

import { useState, type ReactNode } from "react";
import type { ApplicationDetail } from "./application-types";
import { ActionForm, useDiscardChanges, type MutationAction } from "./ui/action-form";

type WorkspaceTheme = { button: string };
type Email = ApplicationDetail["emailLogs"][number];
type Interview = ApplicationDetail["interviews"][number];

function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function displayDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

function WorkspaceField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="workspace-field"><span>{label}</span>{children}</label>;
}

function CancelEditor({ onCancel }: { onCancel: () => void }) {
  const discard = useDiscardChanges();
  return <button type="button" className="workspace-button" onClick={() => discard(onCancel)}>Cancel</button>;
}

export function NoteEditor({ note, folderId, folderName, action, onSuccess, onCancel, theme }: {
  note?: ApplicationDetail["noteEntries"][number];
  folderId: string;
  folderName: string;
  action: MutationAction;
  onSuccess: () => void;
  onCancel: () => void;
  theme: WorkspaceTheme;
}) {
  return <ActionForm action={action} onSuccess={onSuccess} className="workspace-note-editor">
    <input type="hidden" name="folderId" value={folderId} />
    <div className="workspace-pane-bar"><span className="workspace-breadcrumb">Notes / {folderName}</span><span className="workspace-chip">{note ? "Editing" : "New note"}</span></div>
    <div className="workspace-note-page">
      <input name="title" aria-label="Note title" required autoFocus defaultValue={note?.title ?? ""} placeholder="Untitled note" className="workspace-note-title" />
      <textarea name="body" aria-label="Note body" required defaultValue={note?.body ?? ""} placeholder="Start writing…" rows={14} className="workspace-note-body" />
    </div>
    <div className="workspace-editor-footer"><CancelEditor onCancel={onCancel} /><button className={`workspace-button workspace-primary ${theme.button}`} aria-label="Save note">Save note</button></div>
  </ActionForm>;
}

function EmailEditor({ email, action, onSuccess, onCancel, theme }: {
  email?: Email;
  action: MutationAction;
  onSuccess: () => void;
  onCancel: () => void;
  theme: WorkspaceTheme;
}) {
  const [direction, setDirection] = useState<Email["direction"]>(email?.direction ?? "RECEIVED");
  return <ActionForm action={action} onSuccess={onSuccess} className="workspace-editor">
    <div className="workspace-pane-bar"><h4>{email ? "Edit email" : "Log a conversation"}</h4></div>
    <div className="workspace-form-body">
      <WorkspaceField label="Subject"><input name="subject" aria-label="Subject" required autoFocus defaultValue={email?.subject ?? ""} placeholder="e.g. Interview invitation" /></WorkspaceField>
      <div className="workspace-field-grid">
        <WorkspaceField label="Direction"><select name="direction" aria-label="Email direction" value={direction} onChange={(event) => setDirection(event.target.value as Email["direction"])}><option value="RECEIVED">Received</option><option value="SENT">Sent</option></select></WorkspaceField>
        <WorkspaceField label={direction === "SENT" ? "Sent to" : "Recipient"}><input name="recipient" aria-label={direction === "SENT" ? "Sent to" : "Recipient"} defaultValue={email?.recipient ?? ""} placeholder="Name or email address" /></WorkspaceField>
        <WorkspaceField label="Date & time"><input name="sentAt" aria-label="Date and time" type="datetime-local" required defaultValue={localDateTime(email?.sentAt ?? new Date().toISOString())} /></WorkspaceField>
        <WorkspaceField label="Link to email"><input name="emailUrl" aria-label="Email link" type="url" defaultValue={email?.emailUrl ?? ""} placeholder="https://…" /></WorkspaceField>
      </div>
      <WorkspaceField label="Conversation notes"><textarea name="notes" aria-label="Email notes" defaultValue={email?.notes ?? ""} rows={7} placeholder="What was discussed? Any follow-ups?" /></WorkspaceField>
    </div>
    <div className="workspace-editor-footer"><CancelEditor onCancel={onCancel} /><button className={`workspace-button workspace-primary ${theme.button}`} aria-label="Save email log">Save email log</button></div>
  </ActionForm>;
}

export function EmailLogSection({ application, addEmailLog, deleteEmailLog, updateEmailLog, theme, timeZone }: {
  application: ApplicationDetail;
  addEmailLog: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  deleteEmailLog: (emailId: string) => unknown | Promise<unknown>;
  updateEmailLog: (emailId: string, formData: FormData) => unknown | Promise<unknown>;
  theme: WorkspaceTheme;
  timeZone: string;
}) {
  const discard = useDiscardChanges();
  const [mode, setMode] = useState<"read" | "new" | "edit">("read");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | Email["direction"]>("ALL");
  const [query, setQuery] = useState("");
  const emails = application.emailLogs.filter((email) => (filter === "ALL" || email.direction === filter) && `${email.subject} ${email.recipient ?? ""} ${email.notes ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const selected = emails.find((email) => email.id === selectedId) ?? emails[0] ?? null;
  return <section className="workspace-shell email-workspace">
    <div className="workspace-topbar"><div><h4>Conversations</h4><p>{application.emailLogs.length} email{application.emailLogs.length === 1 ? "" : "s"} logged</p></div><button type="button" className={`workspace-button workspace-primary ${theme.button}`} aria-label="New email log" onClick={() => discard(() => setMode("new"))}>+ Log email</button></div>
    <div className="workspace-split">
      <div className="workspace-sidebar">
        <input type="search" aria-label="Search email logs" placeholder="Search conversations…" className="workspace-search" value={query} onChange={(event) => discard(() => { setQuery(event.target.value); setMode("read"); })} />
        <div className="workspace-filters" role="group" aria-label="Filter emails">{(["ALL", "RECEIVED", "SENT"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => discard(() => { setFilter(value); setMode("read"); })}>{value === "ALL" ? "All" : value === "SENT" ? "Sent" : "Received"}</button>)}</div>
        <div className="workspace-email-list status-graph-scroll" role="group" aria-label="Conversations" onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
          const index = items.indexOf(event.target as HTMLButtonElement);
          const next = index + (event.key === "ArrowDown" ? 1 : -1);
          if (index >= 0 && items[next]) { event.preventDefault(); items[next].focus(); }
        }}>
          {emails.map((email) => <button type="button" key={email.id} className={`workspace-email-row ${selected?.id === email.id && mode !== "new" ? "is-selected" : ""}`} aria-pressed={selected?.id === email.id && mode !== "new"} onClick={() => discard(() => { setSelectedId(email.id); setMode("read"); })}>
            <span className="workspace-email-row-meta"><span data-direction={email.direction} className="workspace-direction">{email.direction === "SENT" ? "↗ Sent" : "↙ Received"}</span><time dateTime={email.sentAt}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone }).format(new Date(email.sentAt))}</time></span>
            <span className="workspace-email-subject">{email.subject}</span><span className="workspace-email-contact">{email.recipient || "No contact added"}</span>
          </button>)}
          {emails.length === 0 ? <p className="workspace-sidebar-empty">{query || filter !== "ALL" ? "No matching conversations." : "Your conversations will appear here."}</p> : null}
        </div>
      </div>
      <div className="workspace-main workspace-mail-reader">
        {mode === "new" || (mode === "edit" && selected) ? <EmailEditor key={mode === "new" ? "new" : selected!.id} email={mode === "edit" ? selected! : undefined} action={mode === "edit" ? updateEmailLog.bind(null, selected!.id) : addEmailLog.bind(null, application.id)} onSuccess={() => { setMode("read"); if (mode === "new") { setFilter("ALL"); setQuery(""); setSelectedId(null); } }} onCancel={() => setMode("read")} theme={theme} /> : selected ? <>
          <div className="workspace-pane-bar"><span className="workspace-direction" data-direction={selected.direction}>{selected.direction === "SENT" ? "↗ Sent email" : "↙ Received email"}</span><div className="flex flex-wrap gap-2"><button type="button" className="workspace-button" aria-label="Edit email log" onClick={() => setMode("edit")}>Edit</button><ActionForm action={deleteEmailLog.bind(null, selected.id)} onSuccess={() => setSelectedId(null)}><button className="workspace-button workspace-danger" aria-label="Delete email log">Delete</button></ActionForm></div></div>
          <div className="workspace-reading-page"><h4 className="workspace-reading-title">{selected.subject}</h4><dl className="workspace-email-details"><div><dt>{selected.direction === "SENT" ? "To" : "Recipient"}</dt><dd>{selected.recipient || "Not recorded"}</dd></div><div><dt>Date</dt><dd><time dateTime={selected.sentAt}>{displayDate(selected.sentAt, timeZone)}</time></dd></div></dl>
            {selected.emailUrl ? <a href={selected.emailUrl} target="_blank" rel="noreferrer" className="workspace-email-link">Open original email ↗</a> : null}
            <div className="workspace-reading-notes"><p className="workspace-caption">Conversation notes</p><p className="workspace-prose">{selected.notes || "No notes added to this conversation."}</p></div>
          </div>
        </> : <div className="workspace-blank"><span aria-hidden="true" className="workspace-blank-symbol">↗</span><h4>{application.emailLogs.length ? "No conversation selected" : "No emails logged yet"}</h4><p>Keep recruiter conversations and follow-ups together. Log an email to get started.</p></div>}
      </div>
    </div>
  </section>;
}

function InterviewEditor({ interview, action, onSuccess, onCancel, theme }: {
  interview?: Interview;
  action: MutationAction;
  onSuccess: () => void;
  onCancel: () => void;
  theme: WorkspaceTheme;
}) {
  return <ActionForm action={action} onSuccess={onSuccess} className="workspace-editor">
    <div className="workspace-pane-bar"><h4>{interview ? "Edit interview round" : "Plan an interview round"}</h4></div>
    <div className="workspace-form-body">
      <WorkspaceField label="Round name"><input name="title" aria-label="Interview round name" required autoFocus defaultValue={interview?.title ?? ""} placeholder="e.g. Technical interview" /></WorkspaceField>
      <div className="workspace-field-grid">
        <WorkspaceField label="Interview format"><input name="interviewType" aria-label="Interview type" defaultValue={interview?.interviewType ?? ""} placeholder="e.g. Video call, onsite, coding" /></WorkspaceField>
        <WorkspaceField label="Scheduled for"><input name="scheduledAt" aria-label="Scheduled at" type="datetime-local" defaultValue={interview?.scheduledAt ? localDateTime(interview.scheduledAt) : ""} /></WorkspaceField>
        <WorkspaceField label="Preparation"><textarea name="studyNotes" aria-label="Study plan" defaultValue={interview?.studyNotes ?? ""} rows={7} placeholder="Topics to review, questions to prepare…" /></WorkspaceField>
        <WorkspaceField label="Interview notes"><textarea name="notes" aria-label="Interview notes" defaultValue={interview?.notes ?? ""} rows={7} placeholder="People you met, feedback, and next steps…" /></WorkspaceField>
      </div>
    </div>
    <div className="workspace-editor-footer"><CancelEditor onCancel={onCancel} /><button className={`workspace-button workspace-primary ${theme.button}`} aria-label="Save interview">Save interview</button></div>
  </ActionForm>;
}

export function InterviewSection({ application, addInterview, deleteInterview, updateInterview, theme, timeZone }: {
  application: ApplicationDetail;
  addInterview: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  deleteInterview: (interviewId: string) => unknown | Promise<unknown>;
  updateInterview: (interviewId: string, formData: FormData) => unknown | Promise<unknown>;
  theme: WorkspaceTheme;
  timeZone: string;
}) {
  const discard = useDiscardChanges();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = application.interviews.find((interview) => interview.id === editingId);
  return <section className="workspace-shell interview-workspace">
    <div className="workspace-topbar"><div><h4>Interview rounds</h4><p>{application.interviews.length} round{application.interviews.length === 1 ? "" : "s"} · {application.interviews.filter((interview) => interview.scheduledAt).length} scheduled</p></div><button type="button" className={`workspace-button workspace-primary ${theme.button}`} aria-label="Add interview" onClick={() => discard(() => { setAdding(true); setEditingId(null); })}>+ Add round</button></div>
    {adding || editing ? <InterviewEditor key={editing?.id ?? "new"} interview={editing} action={editing ? updateInterview.bind(null, editing.id) : addInterview.bind(null, application.id)} onSuccess={() => { setAdding(false); setEditingId(null); }} onCancel={() => { setAdding(false); setEditingId(null); }} theme={theme} /> : application.interviews.length === 0 ? <div className="workspace-blank"><span aria-hidden="true" className="workspace-blank-symbol">◷</span><h4>No interview rounds added yet.</h4><p>Add a round to keep the schedule, preparation, and interview notes together.</p></div> : <div className="workspace-rounds">
      {application.interviews.map((interview, index) => <article key={interview.id} className="workspace-round">
        <div className="workspace-round-header"><span className="workspace-round-number" aria-label={`Round ${index + 1}`}>{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><h4>{interview.title}</h4><p>{interview.interviewType || "Format not specified"}</p></div><div className="flex flex-wrap gap-2"><button type="button" className="workspace-button" onClick={() => discard(() => { setEditingId(interview.id); setAdding(false); })}>Edit</button><ActionForm action={deleteInterview.bind(null, interview.id)}><button className="workspace-button workspace-danger" aria-label={`Delete ${interview.title}`}>Delete</button></ActionForm></div></div>
        <div className="workspace-round-schedule"><span aria-hidden="true">◷</span>{interview.scheduledAt ? <time dateTime={interview.scheduledAt}>{displayDate(interview.scheduledAt, timeZone)}</time> : <span>Date not set</span>}</div>
        <div className="workspace-round-columns"><div><p className="workspace-caption">Preparation</p><p className={`workspace-prose ${interview.studyNotes ? "" : "workspace-muted"}`}>{interview.studyNotes || "Add topics to review and questions to prepare."}</p></div><div><p className="workspace-caption">Interview notes</p><p className={`workspace-prose ${interview.notes ? "" : "workspace-muted"}`}>{interview.notes || "Capture feedback and next steps after the round."}</p></div></div>
      </article>)}
    </div>}
  </section>;
}
