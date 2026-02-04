import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "kavia_notes_v1";

/**
 * Generates a reasonably unique id for notes without extra dependencies.
 * Combines timestamp + random suffix.
 */
function generateId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Loads notes from localStorage with basic validation.
 * Returns an empty array when no data exists or data is invalid.
 */
function loadNotesFromStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Ensure minimal shape
    return parsed
      .filter((n) => n && typeof n === "object" && typeof n.id === "string")
      .map((n) => ({
        id: n.id,
        title: typeof n.title === "string" ? n.title : "Untitled",
        content: typeof n.content === "string" ? n.content : "",
        updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
        createdAt: typeof n.createdAt === "number" ? n.createdAt : n.updatedAt ?? Date.now(),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Persists notes to localStorage.
 */
function saveNotesToStorage(notes) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/**
 * Derives a title from note content when title isn't explicitly set.
 */
function deriveTitle({ title, content }) {
  const trimmedTitle = (title ?? "").trim();
  if (trimmedTitle) return trimmedTitle;
  const firstLine = (content ?? "").trim().split("\n")[0]?.trim() ?? "";
  return firstLine || "Untitled";
}

/**
 * Formats a timestamp for small UI usage.
 */
function formatUpdatedAt(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// PUBLIC_INTERFACE
function App() {
  /** App state is entirely client-side (no backend). */
  const [notes, setNotes] = useState(() => loadNotesFromStorage());
  const [selectedId, setSelectedId] = useState(() => (loadNotesFromStorage()[0]?.id ?? null));
  const [query, setQuery] = useState("");

  /** Editor draft state (so we can debounce/commit safely). */
  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  );

  const [draftTitle, setDraftTitle] = useState(selectedNote?.title ?? "");
  const [draftContent, setDraftContent] = useState(selectedNote?.content ?? "");

  const titleInputRef = useRef(null);

  /** Keep drafts in sync when selection changes. */
  useEffect(() => {
    setDraftTitle(selectedNote?.title ?? "");
    setDraftContent(selectedNote?.content ?? "");
  }, [selectedId]); // intentionally only on id change

  /** Persist notes on change. */
  useEffect(() => {
    saveNotesToStorage(notes);
  }, [notes]);

  /** Ensure selectedId remains valid when notes change. */
  useEffect(() => {
    if (notes.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !notes.some((n) => n.id === selectedId)) {
      setSelectedId(notes[0].id);
    }
  }, [notes, selectedId]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const t = (n.title ?? "").toLowerCase();
      const c = (n.content ?? "").toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [notes, query]);

  // PUBLIC_INTERFACE
  function createNote() {
    const now = Date.now();
    const newNote = {
      id: generateId(),
      title: "Untitled",
      content: "",
      createdAt: now,
      updatedAt: now,
    };

    setNotes((prev) => [newNote, ...prev]);
    setSelectedId(newNote.id);

    // Focus title input after render
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select?.();
    }, 0);
  }

  // PUBLIC_INTERFACE
  function deleteSelectedNote() {
    if (!selectedNote) return;

    const ok = window.confirm(`Delete "${deriveTitle(selectedNote)}"? This cannot be undone.`);
    if (!ok) return;

    setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
  }

  // PUBLIC_INTERFACE
  function commitDraft(partial) {
    if (!selectedNote) return;

    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === selectedNote.id);
      if (idx === -1) return prev;

      const next = [...prev];
      const updated = {
        ...next[idx],
        ...partial,
        updatedAt: Date.now(),
      };
      updated.title = deriveTitle(updated);

      next[idx] = updated;
      // Sort by most recently updated
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      return next;
    });
  }

  // PUBLIC_INTERFACE
  function clearAllNotes() {
    if (notes.length === 0) return;
    const ok = window.confirm("Clear all notes? This will remove everything from this browser.");
    if (!ok) return;
    setNotes([]);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="notesApp">
      <header className="appHeader">
        <div className="headerLeft">
          <div className="appBrand" aria-label="App name">
            Notes
          </div>
          <div className="appSubtle">Client-side. Stored in this browser.</div>
        </div>

        <div className="headerActions">
          <button className="btnPrimary" onClick={createNote} type="button">
            + Add note
          </button>
          <button
            className="btnDangerGhost"
            onClick={deleteSelectedNote}
            type="button"
            disabled={!selectedNote}
            aria-disabled={!selectedNote}
            title={!selectedNote ? "Select a note to delete" : "Delete selected note"}
          >
            Delete
          </button>
          <button
            className="btnGhost"
            onClick={clearAllNotes}
            type="button"
            disabled={notes.length === 0}
            aria-disabled={notes.length === 0}
            title={notes.length === 0 ? "No notes to clear" : "Clear all notes"}
          >
            Clear all
          </button>
        </div>
      </header>

      <main className="appMain">
        <aside className="sidebar" aria-label="Notes list">
          <div className="sidebarTop">
            <label className="searchLabel" htmlFor="notesSearch">
              Search
            </label>
            <input
              id="notesSearch"
              className="searchInput"
              placeholder="Title or content…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
            />
            <div className="sidebarMeta">
              {filteredNotes.length} / {notes.length} notes
            </div>
          </div>

          <div className="notesList" role="list">
            {filteredNotes.length === 0 ? (
              <div className="emptyList">
                <div className="emptyTitle">No matching notes</div>
                <div className="emptyHint">Try a different search, or add a new note.</div>
              </div>
            ) : (
              filteredNotes.map((n) => {
                const isActive = n.id === selectedId;
                const subtitle = (n.content || "").trim().replace(/\s+/g, " ").slice(0, 80);
                return (
                  <button
                    key={n.id}
                    className={`noteRow ${isActive ? "active" : ""}`}
                    onClick={() => setSelectedId(n.id)}
                    type="button"
                    role="listitem"
                    aria-current={isActive ? "true" : "false"}
                  >
                    <div className="noteRowTitle">{deriveTitle(n)}</div>
                    <div className="noteRowSubtitle">{subtitle || "No content"}</div>
                    <div className="noteRowMeta">{formatUpdatedAt(n.updatedAt)}</div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="detail" aria-label="Note editor">
          {!selectedNote ? (
            <div className="emptyDetail">
              <div className="emptyTitle">No note selected</div>
              <div className="emptyHint">Create a note to start writing.</div>
              <button className="btnPrimary" onClick={createNote} type="button">
                + Add note
              </button>
            </div>
          ) : (
            <div className="editor">
              <div className="editorHeader">
                <div className="editorTitleBlock">
                  <label className="fieldLabel" htmlFor="noteTitle">
                    Title
                  </label>
                  <input
                    ref={titleInputRef}
                    id="noteTitle"
                    className="titleInput"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => commitDraft({ title: draftTitle })}
                    placeholder="Untitled"
                    type="text"
                  />
                </div>

                <div className="editorMeta" aria-label="Note metadata">
                  <div>
                    <span className="metaLabel">Updated</span>
                    <span className="metaValue">{formatUpdatedAt(selectedNote.updatedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="editorBody">
                <label className="fieldLabel" htmlFor="noteContent">
                  Content
                </label>
                <textarea
                  id="noteContent"
                  className="contentInput"
                  value={draftContent}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftContent(val);
                    // Keep the app feeling responsive: commit content as user types.
                    commitDraft({ content: val, title: draftTitle });
                  }}
                  placeholder="Write your note here…"
                  spellCheck
                />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
