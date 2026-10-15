/**
 * DAYBOOK — Reusable Block-Based Note Editor & Templates Engine
 * Section 22: Content Blocks, Templates, Autosave & Data Integrity
 */

const NoteEditor = (() => {
  // Built-in note templates
  const TEMPLATES = {
    blank: {
      name: "Blank Note",
      title: "",
      content: "",
    },
    daily_plan: {
      name: "Daily Planner",
      title: "Daily Plan — " + new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      content: `## 🎯 Top 3 Priorities
- [ ] 1. 
- [ ] 2. 
- [ ] 3. 

## ⏰ Schedule & Focus Blocks
- 09:00 - 12:00: Deep work & main priority
- 13:00 - 15:00: Tasks, communications & reviews
- 15:00 - 17:00: Project wrap-up & tomorrow planning

## 📝 Evening Reflection
- What went well today?
- What could be improved tomorrow?`,
    },
    journal: {
      name: "Daily Journal",
      title: "Evening Reflection — " + new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
      content: `## ☀️ Gratitude
1. 
2. 
3. 

## 💭 Thoughts & Reflections
Write freely about your day, lessons learned, or moments of clarity...

## 🌟 Tomorrow's Intentions
- Primary intention for tomorrow:`,
    },
    project: {
      name: "Project Plan",
      title: "Project: [Project Name]",
      content: `## 🎯 Objective
What is the core problem being solved and the desired outcome?

---

## 📋 Key Milestones & Deliverables
- [ ] Phase 1: Requirements & User Flow
- [ ] Phase 2: Technical Design & Architecture
- [ ] Phase 3: Core Implementation
- [ ] Phase 4: Testing & Polish
- [ ] Phase 5: Launch

---

## 📌 Resources & References
- Link / Notes:`,
    },
    study: {
      name: "Study Notes",
      title: "Study Notes: [Topic Name]",
      content: `## 📚 Core Concept Summary
Explain the main concept in simple terms as if teaching someone else.

---

## 🔑 Key Terms & Definitions
- Concept A: 
- Concept B: 

---

## ❓ Review Questions
- [ ] How does this work under the hood?
- [ ] What is the most common pitfall to avoid?`,
    },
  };

  // State
  let activeNoteId = null;
  let autosaveTimer = null;
  let isSaving = false;

  /**
   * Inserts block text at the current cursor position in textarea
   */
  function insertBlock(prefix, suffix = "") {
    const textarea = document.getElementById("editor-note-content");
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const selectedText = text.substring(start, end);
    const replacement = prefix + selectedText + suffix;

    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);

    triggerAutosave();
    updateStats();
  }

  /**
   * Applies a pre-defined template to the editor
   */
  function applyTemplate(templateKey) {
    const template = TEMPLATES[templateKey];
    if (!template) return;

    const titleInput = document.getElementById("editor-note-title");
    const contentArea = document.getElementById("editor-note-content");
    const tagInput = document.getElementById("editor-note-tags");

    if (titleInput && (!titleInput.value.trim() || titleInput.value === "Untitled Note")) {
      titleInput.value = template.title || "";
    }

    if (contentArea) {
      if (contentArea.value.trim().length > 0) {
        if (!confirm("Replace current note content with template?")) return;
      }
      contentArea.value = template.content || "";
    }

    if (tagInput && !tagInput.value.trim()) {
      const defaultTags = { daily_plan: "Plan", journal: "Journal", project: "Project", study: "Study" };
      tagInput.value = defaultTags[templateKey] || "";
    }

    triggerAutosave();
    updateStats();
    if (window.showToast) window.showToast(`Applied ${template.name} template 📋`);
  }

  /**
   * Updates word count & character count stats
   */
  function updateStats() {
    const content = document.getElementById("editor-note-content")?.value || "";
    const statsElem = document.getElementById("editor-stats-count");
    if (!statsElem) return;

    const words = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;
    const chars = content.length;
    statsElem.textContent = `${words} words • ${chars} chars`;
  }

  /**
   * Debounced autosave mechanism
   */
  function triggerAutosave() {
    clearTimeout(autosaveTimer);
    const statusElem = document.getElementById("editor-save-status");
    if (statusElem) statusElem.textContent = "Unsaved changes...";

    autosaveTimer = setTimeout(() => {
      saveNote(true);
    }, 1200);
  }

  /**
   * Saves the note to Flask backend (manual or autosave)
   */
  async function saveNote(isAutosave = false) {
    const titleInput = document.getElementById("editor-note-title");
    const contentArea = document.getElementById("editor-note-content");
    const tagInput = document.getElementById("editor-note-tags");
    const pinCheckbox = document.getElementById("editor-note-pin");
    const statusElem = document.getElementById("editor-save-status");

    if (!titleInput) return;
    const title = titleInput.value.trim();
    if (!title) {
      if (!isAutosave && window.showToast) window.showToast("Please enter a note title");
      return;
    }

    if (isSaving) return;
    isSaving = true;
    if (statusElem) statusElem.textContent = "Saving...";

    const payload = {
      title: title,
      content: contentArea ? contentArea.value : "",
      tags: tagInput ? tagInput.value.trim() : "",
      is_pinned: pinCheckbox && pinCheckbox.checked ? 1 : 0,
    };

    try {
      let res;
      if (activeNoteId) {
        res = await fetch(`/api/notes/${activeNoteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const savedNote = await res.json();
        activeNoteId = savedNote.id;

        if (statusElem) statusElem.textContent = "Saved ✓";
        if (!isAutosave) {
          if (window.showToast) window.showToast("Note saved ✨");
          closeEditor();
        }

        // Notify app to refresh note lists
        if (window.loadNotes) window.loadNotes();
        if (window.loadDashboard) window.loadDashboard();
      } else {
        throw new Error("Save failed");
      }
    } catch (err) {
      if (statusElem) statusElem.textContent = "Save failed ✕";
      if (!isAutosave && window.showToast) window.showToast("Error saving note");
    } finally {
      isSaving = false;
    }
  }

  /**
   * Opens the Editor modal
   */
  async function openEditor(noteId = null) {
    const modal = document.getElementById("note-editor-modal");
    const titleInput = document.getElementById("editor-note-title");
    const tagInput = document.getElementById("editor-note-tags");
    const pinCheckbox = document.getElementById("editor-note-pin");
    const contentArea = document.getElementById("editor-note-content");
    const modeLabel = document.getElementById("editor-modal-mode");
    const statusElem = document.getElementById("editor-save-status");

    activeNoteId = noteId;

    if (noteId) {
      if (modeLabel) modeLabel.textContent = "EDIT NOTE";
      if (statusElem) statusElem.textContent = "Loading...";
      try {
        const res = await fetch(`/api/notes/${noteId}`);
        if (res.ok) {
          const note = await res.json();
          if (titleInput) titleInput.value = note.title || "";
          if (tagInput) tagInput.value = note.tags || "";
          if (pinCheckbox) pinCheckbox.checked = Boolean(note.is_pinned);
          if (contentArea) contentArea.value = note.content || "";
          if (statusElem) statusElem.textContent = "Ready to edit";
        }
      } catch (e) {
        if (statusElem) statusElem.textContent = "Error loading";
      }
    } else {
      if (modeLabel) modeLabel.textContent = "NEW NOTE";
      if (titleInput) titleInput.value = "";
      if (tagInput) tagInput.value = "";
      if (pinCheckbox) pinCheckbox.checked = false;
      if (contentArea) contentArea.value = "";
      if (statusElem) statusElem.textContent = "Draft";
    }

    modal.classList.add("active");
    updateStats();
    if (titleInput) titleInput.focus();
  }

  function closeEditor() {
    clearTimeout(autosaveTimer);
    const modal = document.getElementById("note-editor-modal");
    if (modal) modal.classList.remove("active");
    activeNoteId = null;
  }

  /**
   * Binds editor toolbar and template chips
   */
  function init() {
    // Toolbar Block Buttons
    document.querySelectorAll("[data-block-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.blockAction;
        if (action === "heading") insertBlock("\n## ", "\n");
        if (action === "checklist") insertBlock("\n- [ ] ");
        if (action === "bullet") insertBlock("\n• ");
        if (action === "divider") insertBlock("\n\n---\n\n");
      });
    });

    // Template Chips
    document.querySelectorAll("[data-template-key]").forEach((chip) => {
      chip.addEventListener("click", () => {
        applyTemplate(chip.dataset.templateKey);
      });
    });

    // Content live autosave & stats
    const titleInput = document.getElementById("editor-note-title");
    const contentArea = document.getElementById("editor-note-content");

    if (titleInput) titleInput.addEventListener("input", triggerAutosave);
    if (contentArea) {
      contentArea.addEventListener("input", () => {
        triggerAutosave();
        updateStats();
      });
    }

    // Modal close & save triggers
    const closeBtn = document.getElementById("btn-close-editor");
    const cancelBtn = document.getElementById("btn-cancel-note");
    const saveBtn = document.getElementById("btn-save-note");

    if (closeBtn) closeBtn.addEventListener("click", closeEditor);
    if (cancelBtn) cancelBtn.addEventListener("click", closeEditor);
    if (saveBtn) saveBtn.addEventListener("click", () => saveNote(false));
  }

  return {
    init,
    openEditor,
    closeEditor,
    insertBlock,
    applyTemplate,
    saveNote,
  };
})();

window.NoteEditor = NoteEditor;
