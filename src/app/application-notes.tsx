"use client";

import { useContext, useState, useTransition } from "react";
import { ActionForm, mutationFeedback, useDiscardChanges } from "./ui/action-form";
import type { ApplicationDetail } from "./application-types";
import { NoteEditor } from "./application-workspaces";
import { formatDateTime } from "./application-format";
import { DiscardButton } from "./confirmation-dialogs";
import { DirectoryIcon } from "./detail-primitives";
import { TimeZoneContext } from "./time-zone";

export function ApplicationNotesSection({
  application,
  addApplicationNote,
  addApplicationNoteFolder,
  deleteApplicationNote,
  deleteApplicationNoteFolder,
  moveApplicationNote,
  theme,
  updateApplicationNote,
  onNotesChanged,
}: {
  application: ApplicationDetail;
  addApplicationNote: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  addApplicationNoteFolder: (applicationId: string, formData: FormData) => unknown | Promise<unknown>;
  deleteApplicationNote: (noteId: string) => unknown | Promise<unknown>;
  deleteApplicationNoteFolder: (folderId: string) => unknown | Promise<unknown>;
  moveApplicationNote: (noteId: string, folderId: string) => unknown | Promise<unknown>;
  theme: { timeline: string; timelineItem: string; eyebrow: string; button: string; fieldInput: string };
  updateApplicationNote: (noteId: string, formData: FormData) => unknown | Promise<unknown>;
  onNotesChanged: () => void;
}) {
  const timeZone = useContext(TimeZoneContext);
  const requestDiscard = useDiscardChanges();
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isNoteSidebarOpen, setIsNoteSidebarOpen] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [folderDropTargetId, setFolderDropTargetId] = useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [isMoving, startMove] = useTransition();
  const [moveError, setMoveError] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const selectedNote = application.noteEntries.find((note) => note.id === selectedNoteId) ?? application.noteEntries[0] ?? null;
  const editingNote = application.noteEntries.find((note) => note.id === editingNoteId) ?? null;
  const matchesNote = (note: ApplicationDetail["noteEntries"][number]) => `${note.title} ${note.body}`.toLowerCase().includes(noteQuery.toLowerCase());
  const rootNotes = application.noteEntries.filter((note) => note.folderId === null && matchesNote(note));

  function toggleFolder(folderId: string) {
    requestDiscard(() => {
      setSelectedFolderId(folderId);
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        if (next.has(folderId)) next.delete(folderId);
        else next.add(folderId);
        return next;
      });
    });
  }

  function isNoteDrag(event: React.DragEvent) {
    return draggedNoteId !== null || Array.from(event.dataTransfer.types).includes("application/x-jobpilot-note");
  }

  function moveNote(noteId: string, folderId: string) {
    if (isMoving) return;
    requestDiscard(() => {
      setEditingNoteId(null);
      setIsAddingNote(false);
      setMoveError("");
      startMove(async () => {
        try {
          const result = mutationFeedback(await moveApplicationNote(noteId, folderId));
          if (!result.success) { setMoveError(result.message); return; }
          if (folderId) setExpandedFolderIds((current) => new Set([...current, folderId]));
          setSelectedFolderId(folderId || null);
          setSelectedNoteId(noteId);
          onNotesChanged();
        } catch {
          setMoveError("Could not move the note. Please try again.");
        }
      });
    });
  }

  function dropHandlers(folderId: string) {
    return {
      onDragOver: (event: React.DragEvent) => {
        if (!isNoteDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setFolderDropTargetId(folderId);
      },
      onDragLeave: (event: React.DragEvent) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setFolderDropTargetId(null);
      },
      onDrop: (event: React.DragEvent) => {
        if (!isNoteDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        const noteId = event.dataTransfer.getData("application/x-jobpilot-note") || draggedNoteId;
        setDraggedNoteId(null);
        setFolderDropTargetId(null);
        if (noteId) moveNote(noteId, folderId);
      },
    };
  }

  function startNoteDrag(event: React.DragEvent, noteId: string) {
    event.stopPropagation();
    setDraggedNoteId(noteId);
    event.dataTransfer.setData("application/x-jobpilot-note", noteId);
    event.dataTransfer.setData("text/plain", noteId);
    event.dataTransfer.effectAllowed = "move";
  }

  function selectNote(noteId: string) {
    requestDiscard(() => {
      setSelectedNoteId(noteId);
      setSelectedFolderId(application.noteEntries.find((note) => note.id === noteId)?.folderId ?? null);
      setEditingNoteId(null);
      setIsAddingNote(false);
    });
  }

  return (
    <section className="workspace-shell notes-workspace">
      <div>
        <div className="workspace-topbar">
          <div className="flex min-w-0 items-center gap-2">
            <div><h4>Notebook</h4><p>{application.noteEntries.length} notes · {application.noteFolders.length} folders</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`workspace-button workspace-primary ${theme.button}`} aria-label="New note" title="New note" onClick={() => requestDiscard(() => { setIsAddingNote(true); setEditingNoteId(null); setIsAddingFolder(false); })}>
              <span>+ New note</span>
            </button>
          </div>
        </div>

        {isMoving ? <p role="status" className="mt-3 text-sm text-sky-200">Moving note…</p> : null}
        {moveError ? <p role="alert" className="mt-3 text-sm text-rose-200">{moveError}</p> : null}
        <div className={`workspace-split ${isNoteSidebarOpen ? "" : "workspace-sidebar-collapsed"}`}>
          <div className="workspace-sidebar">
            <div className="flex items-center justify-between gap-2">
            <button type="button" className="workspace-button border-0" aria-expanded={isNoteSidebarOpen} aria-label={isNoteSidebarOpen ? "Collapse notes sidebar" : "Expand notes sidebar"} title={isNoteSidebarOpen ? "Collapse notes sidebar" : "Expand notes sidebar"} onClick={() => setIsNoteSidebarOpen((current) => !current)}>
              <span className="flex items-center gap-2"><DirectoryIcon name="menu" />{isNoteSidebarOpen ? <span className="text-xs font-semibold">Notes & folders</span> : null}</span>
            </button>
            {isNoteSidebarOpen ? <button type="button" className="workspace-icon-button" aria-label="New folder" title="New folder" onClick={() => requestDiscard(() => { setIsAddingFolder((current) => !current); setIsAddingNote(false); })}><DirectoryIcon name="folder-plus" /></button> : null}
            </div>
            {isNoteSidebarOpen ? <>
            <input type="search" aria-label="Search notes" placeholder="Find a note…" value={noteQuery} onChange={(event) => setNoteQuery(event.target.value)} className="workspace-search mt-3" />
            {isAddingFolder ? <ActionForm action={addApplicationNoteFolder.bind(null, application.id)} onSuccess={() => setIsAddingFolder(false)} className="workspace-folder-form mt-3">
              <input name="name" required autoFocus aria-label="Folder name" placeholder="Folder name" />
              <div className="flex justify-end gap-2"><DiscardButton onDiscard={() => setIsAddingFolder(false)} /><button className={`workspace-button ${theme.button}`} aria-label="Create folder">Create</button></div>
            </ActionForm> : null}
            <div className="notes-explorer mt-3 status-graph-scroll" onDragEnd={() => { setDraggedNoteId(null); setFolderDropTargetId(null); }}>
            <button type="button" className={`notes-tree-root ${folderDropTargetId === "" ? "notes-drop-target" : ""}`} {...dropHandlers("")} onClick={() => setSelectedFolderId(null)} aria-label="Notes root — drop notes here to move out of folders">
              <DirectoryIcon name="folder" /><span>Notes</span><span className="ml-auto text-xs text-slate-500">{application.noteEntries.length}</span>
            </button>
            <ul role="tree" aria-label="Notes explorer" className="notes-tree" onKeyDown={(event) => {
              if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "treeitem") return;
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="treeitem"]'));
              const index = items.indexOf(event.target as HTMLButtonElement);
              const folderId = event.target.dataset.folderId;
              const parentFolderId = event.target.dataset.parentFolder;
              if (event.key === "ArrowRight" && folderId && !expandedFolderIds.has(folderId)) {
                event.preventDefault();
                setExpandedFolderIds((current) => new Set([...current, folderId]));
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                if (folderId && expandedFolderIds.has(folderId)) setExpandedFolderIds((current) => { const next = new Set(current); next.delete(folderId); return next; });
                else if (parentFolderId) items.find((item) => item.dataset.folderId === parentFolderId)?.focus();
              } else {
                const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" || event.key === "ArrowRight" ? index + 1 : event.key === "ArrowUp" ? index - 1 : -1;
                if (next >= 0 && next < items.length) { event.preventDefault(); items[next].focus(); }
              }
            }}>
              {application.noteFolders.map((folder) => {
                const isOpen = expandedFolderIds.has(folder.id) || noteQuery.length > 0;
                const notes = application.noteEntries.filter((note) => note.folderId === folder.id && (folder.name.toLowerCase().includes(noteQuery.toLowerCase()) || matchesNote(note))).sort((a, b) => a.title.localeCompare(b.title));

                return (
                  <li role="none"
                    key={folder.id}
                    data-note-folder={folder.id}
                    {...dropHandlers(folder.id)}
                  >
                    <div className={`notes-tree-row ${folderDropTargetId === folder.id ? "notes-drop-target" : ""}`}>
                      <button type="button" role="treeitem" data-folder-id={folder.id} aria-level={1} aria-selected={selectedFolderId === folder.id && !selectedNoteId} className="notes-tree-label" aria-expanded={isOpen} onClick={() => toggleFolder(folder.id)}>
                        <span aria-hidden="true" className="notes-tree-chevron">{isOpen ? "⌄" : "›"}</span>
                        <span className={theme.eyebrow}><DirectoryIcon name="folder" /></span>
                        <span className="truncate text-sm text-slate-200">{folder.name}</span>
                        <span className="ml-auto text-xs text-slate-500">{notes.length}</span>
                      </button>
                      <ActionForm action={deleteApplicationNoteFolder.bind(null, folder.id)} onSuccess={() => { if (selectedFolderId === folder.id) setSelectedFolderId(null); }}><button className="notes-tree-action" aria-label={`Delete ${folder.name}`} title="Delete folder"><DirectoryIcon name="trash" /></button></ActionForm>
                    </div>
                    {isOpen ? (
                      <ul role="group" className="notes-tree-children">
                        <NoteDirectory notes={notes} selectedNoteId={selectedNoteId} onSelect={selectNote} onEdit={(id) => requestDiscard(() => { setSelectedNoteId(id); setEditingNoteId(id); })} onDragStart={startNoteDrag} deleteApplicationNote={deleteApplicationNote} />
                        {notes.length === 0 ? <li role="none" className="px-3 py-2 text-xs text-slate-500">Empty folder · drop a note here</li> : null}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
              <NoteDirectory notes={[...rootNotes].sort((a, b) => a.title.localeCompare(b.title))} selectedNoteId={selectedNoteId} onSelect={selectNote} onEdit={(id) => requestDiscard(() => { setSelectedNoteId(id); setEditingNoteId(id); })} onDragStart={startNoteDrag} deleteApplicationNote={deleteApplicationNote} />
            </ul>
            <div className={`notes-root-drop ${folderDropTargetId === "" ? "notes-drop-target" : ""}`} {...dropHandlers("")}>Drop here to move to Notes root</div>
            </div></> : null}
          </div>
          <aside className="workspace-main note-preview">
            {isAddingNote || editingNote ? (
              <NoteEditor key={editingNote?.id ?? "new"} note={editingNote ?? undefined} folderId={editingNote?.folderId ?? selectedFolderId ?? ""} folderName={application.noteFolders.find((folder) => folder.id === (editingNote?.folderId ?? selectedFolderId))?.name ?? "Root"} action={editingNote ? updateApplicationNote.bind(null, editingNote.id) : addApplicationNote.bind(null, application.id)} onSuccess={() => { setIsAddingNote(false); setEditingNoteId(null); if (isAddingNote) setSelectedNoteId(null); }} onCancel={() => { setIsAddingNote(false); setEditingNoteId(null); }} theme={theme} />
            ) : selectedNote ? (
              <div>
                <div className="workspace-pane-bar"><span className="workspace-breadcrumb">Notes / {application.noteFolders.find((folder) => folder.id === selectedNote.folderId)?.name ?? "Root"}</span><button type="button" className="workspace-button" onClick={() => requestDiscard(() => setEditingNoteId(selectedNote.id))}>Edit note</button></div>
                <div className="workspace-note-page"><h4 className="workspace-reading-title">{selectedNote.title}</h4><p className="mt-2 text-xs text-slate-500">Updated {formatDateTime(selectedNote.updatedAt, timeZone)}</p><p className="workspace-prose mt-7">{selectedNote.body}</p></div>
                <div className="workspace-editor-footer">
                  <label className="flex min-w-0 items-center gap-2 text-xs text-slate-400">Move to
                    <select aria-label="Move note to folder" disabled={isMoving} value={selectedNote.folderId ?? ""} onChange={(event) => moveNote(selectedNote.id, event.target.value)} className={`min-w-0 max-w-48 rounded-lg border border-white/10 px-2 py-2 text-xs ${theme.fieldInput}`}>
                      <option value="">Notes root</option>
                      {application.noteFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ) : <div className="workspace-blank"><span aria-hidden="true" className="workspace-blank-symbol">✎</span><h4>Your notebook is empty</h4><p>Create a note for your company research, interview questions, or follow-ups.</p><button type="button" className={`workspace-button workspace-primary ${theme.button}`} onClick={() => setIsAddingNote(true)}>Create your first note</button></div>}
          </aside>
        </div>
      </div>
    </section>
  );
}

function NoteDirectory({ notes, selectedNoteId, onSelect, onEdit, onDragStart, deleteApplicationNote }: {
  notes: ApplicationDetail["noteEntries"];
  selectedNoteId: string | null;
  onSelect: (noteId: string) => void;
  onEdit: (noteId: string) => void;
  onDragStart: (event: React.DragEvent, noteId: string) => void;
  deleteApplicationNote: (noteId: string) => unknown | Promise<unknown>;
}) {
  return (
    <>
      {notes.map((note) => (
        <li role="none" key={note.id} data-note-id={note.id} className={`notes-tree-row ${selectedNoteId === note.id ? "notes-tree-selected" : ""}`}>
          <button type="button" role="treeitem" aria-level={note.folderId ? 2 : 1} aria-selected={selectedNoteId === note.id} data-parent-folder={note.folderId ?? undefined} draggable onDragStart={(event) => onDragStart(event, note.id)} className="notes-tree-label notes-tree-note" onClick={() => onSelect(note.id)} onDoubleClick={() => onEdit(note.id)} title={note.title}>
            <span className="text-slate-400"><DirectoryIcon name="file" /></span>
            <span className="truncate text-sm text-slate-200">{note.title}</span>
          </button>
          <button type="button" className="notes-tree-action" aria-label={`Edit ${note.title}`} title="Edit note" onClick={() => onEdit(note.id)}>✎</button>
          <ActionForm action={deleteApplicationNote.bind(null, note.id)}><button className="notes-tree-action" aria-label="Delete note" title="Delete note"><DirectoryIcon name="trash" /></button></ActionForm>
        </li>
      ))}
    </>
  );
}
