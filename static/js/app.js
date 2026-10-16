/**
 * DAYBOOK — Core Client Application Controller
 * Connects Frontend UI to Flask REST API & SQLite / Supabase Database
 * Implements Two-Level Task Management (Today Tasks & Monthly Projects),
 * Reusable Block Editor, Global Search, and Motivational Bear Celebrations
 */

// ============================================================================
// 1. Application State
// ============================================================================
const AppState = {
  currentView: "view-dashboard",
  selectedTaskDate: getLocalDateString(new Date()),
  activeTaskFilter: "all",
  activeProjectFilter: "active",
  activeMood: "😊 Happy",
  dashboardData: null,
  projectsList: [],
  notes: [],
  tasks: [],
  journals: [],
  memories: [],
  editorPhotos: [],
  memoryCalendarDots: [],
  homeCalDate: new Date(),
  journalCalDate: new Date(),
  journalSelectedDate: getLocalDateString(new Date()),
  activeLightbox: { photos: [], index: 0 },
};

function getLocalDateString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ============================================================================
// 2. Global Toast Feedback
// ============================================================================
function showToast(message, duration = 2400) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, duration);
}
window.showToast = showToast;

// ============================================================================
// 3. Navigation & Screen Management
// ============================================================================
function switchView(targetViewId) {
  if (!targetViewId) return;

  document.querySelectorAll(".view-screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  const targetScreen = document.getElementById(targetViewId);
  if (targetScreen) {
    targetScreen.classList.add("active");
    AppState.currentView = targetViewId;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Update bottom dock active state
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === targetViewId);
  });

  // Reload data for target view
  if (targetViewId === "view-dashboard") loadDashboard();
  if (targetViewId === "view-notes") loadNotes();
  if (targetViewId === "view-inbox") loadInbox();
  if (targetViewId === "view-tasks") {
    AppState.selectedTaskDate = getLocalDateString(new Date());
    loadProjectsDropdown();
    loadTasks();
    if (window.HealthManager) window.HealthManager.renderCard();
  }
  if (targetViewId === "view-projects") loadProjects();
  if (targetViewId === "view-journal") loadMemories();
  if (targetViewId === "view-analytics") loadAnalyticsDashboard();
  if (targetViewId === "view-settings") {
    if (window.CompanionManager && window.CompanionManager.renderGallery) {
      window.CompanionManager.renderGallery();
    }
    loadSettingsSounds();
    const p = getUserProfile();
    applyUserProfile(p.name, p.age);
  }
}
window.switchView = switchView;

// Hash-based navigation support (e.g. #view-settings)
window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace("#", "");
  if (hash && document.getElementById(hash)) {
    switchView(hash);
  }
});

function initNavigation() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.target));
  });

  document.querySelectorAll("[data-target]").forEach((link) => {
    if (!link.classList.contains("nav-item")) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        switchView(link.dataset.target);
      });
    }
  });

  // Quick Action Chips on Dashboard
  document.querySelectorAll(".quick-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const action = chip.dataset.action;
      if (action === "quick-capture") {
        openQuickCaptureModal();
      }
      if (action === "open-inbox") {
        switchView("view-inbox");
      }
      if (action === "new-note") {
        if (window.NoteEditor) window.NoteEditor.openEditor();
      }
      if (action === "new-task") {
        switchView("view-tasks");
        const input = document.getElementById("new-task-input");
        if (input) input.focus();
      }
      if (action === "new-project") {
        openProjectModal();
      }
      if (action === "new-journal") {
        switchView("view-journal");
        const area = document.getElementById("journal-quick-entry");
        if (area) area.focus();
      }
    });
  });

  // Top Bar Quick Capture Button
  const topCaptureBtn = document.getElementById("btn-top-quick-capture");
  if (topCaptureBtn) {
    topCaptureBtn.addEventListener("click", () => openQuickCaptureModal());
  }

  // Center dock (+) action button: Quick Capture Modal
  const centerBtn = document.getElementById("btn-center-add");
  if (centerBtn) {
    centerBtn.addEventListener("click", () => {
      openQuickCaptureModal();
    });
  }

  // Global Keyboard Shortcut: Alt + C for Quick Capture
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      openQuickCaptureModal();
    }
  });

  // Hero Focus button
  const heroBtn = document.getElementById("btn-hero-action");
  if (heroBtn) {
    heroBtn.addEventListener("click", () => switchView("view-tasks"));
  }

  // Top Bar Search Trigger
  const searchBtn = document.getElementById("btn-quick-search");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      switchView("view-search");
      const searchInput = document.getElementById("global-search-input");
      if (searchInput) searchInput.focus();
    });
  }

  // Header quick theme toggle
  const themeToggle = document.getElementById("btn-theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      if (window.ThemeManager) window.ThemeManager.setPreference("themeMode", next);
      showToast(`Switched to ${next} theme`);
    });
  }
}

// ============================================================================
// 4. Personal Daily Dashboard Engine (Live Clock, Calendar & Quick Cards)
// ============================================================================
function initLiveClock() {
  function update() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = String(hours % 12 || 12).padStart(2, "0");
    const timeStr = `${displayHours}:${minutes} ${ampm}`;

    const clockEl = document.getElementById("home-live-clock");
    if (clockEl) clockEl.textContent = timeStr;

    const userProfile = (typeof getUserProfile === "function") ? getUserProfile() : { name: "", age: "" };
    const name = userProfile && userProfile.name ? userProfile.name.trim() : "";

    let greeting = "Good Evening 👋";
    if (hours >= 5 && hours < 12) {
      greeting = name ? `Good morning, ${name} ☀️` : "Good morning ☀️";
    } else if (hours >= 12 && hours < 17) {
      greeting = name ? `Good afternoon, ${name} 👋` : "Good afternoon 👋";
    } else if (hours >= 17 && hours < 22) {
      greeting = name ? `Good evening, ${name} 🌙` : "Good evening 🌙";
    } else {
      greeting = name ? `Good night, ${name} 🌙` : "Good night 🌙";
    }
    const greetingEl = document.getElementById("home-greeting-text");
    if (greetingEl) greetingEl.textContent = greeting;

    const mottoEl = document.getElementById("home-greeting-motto");
    if (mottoEl) mottoEl.textContent = "Let's make today meaningful.";

    const dateOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    const dateStr = now.toLocaleDateString("en-US", dateOptions);
    const dateEl = document.getElementById("home-live-date");
    if (dateEl) dateEl.textContent = dateStr;
  }
  update();
  window.refreshLiveClockGreeting = update;
  setInterval(update, 1000);
}

// ============================================================================
// Quick Create Menu Controller (+ Button for Tasks, Projects, Memories, Notes)
// ============================================================================
function initQuickCreateMenu() {
  const modal = document.getElementById("quick-create-menu-modal");
  const topBtn = document.getElementById("btn-top-quick-capture");
  const fabBtn = document.getElementById("btn-floating-add");
  const closeBtn = document.getElementById("btn-close-quick-create");

  function openMenu(e) {
    if (e) e.stopPropagation();
    if (modal) modal.classList.add("active");
  }

  function closeMenu() {
    if (modal) modal.classList.remove("active");
  }

  if (topBtn) topBtn.addEventListener("click", openMenu);
  if (fabBtn) fabBtn.addEventListener("click", openMenu);
  if (closeBtn) closeBtn.addEventListener("click", closeMenu);

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeMenu();
    });
  }

  // Keyboard shortcut: Escape to close
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeMenu();
    }
  });

  // Action 1: Add New Task
  const actTask = document.getElementById("qc-action-task");
  if (actTask) {
    actTask.addEventListener("click", () => {
      closeMenu();
      switchView("view-tasks");
      setTimeout(() => {
        const input = document.getElementById("new-task-title");
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    });
  }

  // Action 2: Add New Project
  const actProject = document.getElementById("qc-action-project");
  if (actProject) {
    actProject.addEventListener("click", () => {
      closeMenu();
      switchView("view-projects");
      const btn = document.getElementById("btn-open-new-project");
      if (btn) btn.click();
    });
  }

  // Action 3: Write Diary Memory
  const actMemory = document.getElementById("qc-action-memory");
  if (actMemory) {
    actMemory.addEventListener("click", () => {
      closeMenu();
      switchView("view-journal");
      openCreateMemoryModal();
    });
  }

  // Action 4: Create Note
  const actNote = document.getElementById("qc-action-note");
  if (actNote) {
    actNote.addEventListener("click", () => {
      closeMenu();
      switchView("view-notes");
      if (window.NoteEditor) window.NoteEditor.openEditor();
    });
  }
}


function renderHomeRecentMemory(recent) {
  const container = document.getElementById("home-recent-memory-card");
  if (!container) return;

  if (recent) {
    const photos = Array.isArray(recent.photos) ? recent.photos : [];
    const coverUrl = photos.length > 0 ? photos[0] : "/static/uploads/memories/araku_valley_scenic.jpg";
    const text = recent.journal_text || recent.description || "";
    const shortText = text.length > 130 ? text.substring(0, 127) + "..." : text;
    const mood = recent.mood || "😊 Happy";
    let formattedDate = recent.date;
    try {
      const d = new Date(recent.date + "T00:00:00");
      formattedDate = d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) {}

    container.innerHTML = `
      <div class="home-memory-inner" id="home-recent-memory-clickable">
        <div class="home-memory-cover-wrap">
          <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(recent.title)}" class="home-memory-cover-img" onerror="this.src='/static/uploads/memories/araku_valley_scenic.jpg'">
          <span class="home-memory-mood-pill">${escapeHtml(mood)}</span>
        </div>
        <div class="home-memory-body">
          <div class="home-memory-eyebrow">RECENT MEMORY PREVIEW</div>
          <h3 class="home-memory-title">${escapeHtml(recent.title)}</h3>
          <p class="home-memory-snippet">"${escapeHtml(shortText)}"</p>
          <div class="home-memory-footer">
            <span class="home-memory-date">📅 ${escapeHtml(formattedDate)}${recent.time ? " • 🕓 " + escapeHtml(recent.time) : ""}</span>
            <div class="home-memory-links-row">
              <button type="button" class="btn btn-sm btn-primary home-write-btn" id="btn-home-write-entry">+ Write Today</button>
              <button type="button" class="home-memory-link" id="btn-home-view-all-memories">View All Memories →</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const writeBtn = document.getElementById("btn-home-write-entry");
    if (writeBtn) {
      writeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        switchView("view-journal");
        openCreateMemoryModal();
      });
    }

    const viewAllBtn = document.getElementById("btn-home-view-all-memories");
    if (viewAllBtn) {
      viewAllBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        switchView("view-journal");
      });
    }

    const clickTarget = document.getElementById("home-recent-memory-clickable");
    if (clickTarget) {
      clickTarget.addEventListener("click", () => {
        switchView("view-journal");
        openMemoryDetail(recent);
      });
    }
  } else {
    container.innerHTML = `
      <div class="home-memory-empty" id="home-create-memory-prompt">
        <div class="home-memory-empty-icon">📔</div>
        <div class="home-memory-empty-content">
          <h3 class="home-memory-title">Capture Your Life's Moments</h3>
          <p class="home-memory-snippet">Save your everyday experiences, reflections, and special moments in your personal diary.</p>
          <div class="home-memory-links-row" style="margin-top: 10px;">
            <button type="button" class="btn btn-sm btn-primary home-write-btn" id="btn-home-write-entry-empty">+ Write Today's Entry</button>
            <button type="button" class="home-memory-link" id="btn-home-view-all-memories-empty">View All Memories →</button>
          </div>
        </div>
      </div>
    `;

    const writeBtnEmpty = document.getElementById("btn-home-write-entry-empty");
    if (writeBtnEmpty) {
      writeBtnEmpty.addEventListener("click", (e) => {
        e.stopPropagation();
        switchView("view-journal");
        openCreateMemoryModal();
      });
    }

    const viewAllBtnEmpty = document.getElementById("btn-home-view-all-memories-empty");
    if (viewAllBtnEmpty) {
      viewAllBtnEmpty.addEventListener("click", (e) => {
        e.stopPropagation();
        switchView("view-journal");
      });
    }

    const promptBtn = document.getElementById("home-create-memory-prompt");
    if (promptBtn) {
      promptBtn.addEventListener("click", () => {
        switchView("view-journal");
        openCreateMemoryModal();
      });
    }
  }
}

async function loadDashboard() {
  try {
    const res = await fetch("/api/dashboard");
    if (!res.ok) throw new Error("Failed to load dashboard data");
    const data = await res.json();
    AppState.dashboardData = data;

    // 1. Today's Tasks Remaining Count
    const pending = data.today_pending !== undefined ? data.today_pending : 0;
    const tasksCountLabel = document.getElementById("home-tasks-remaining-label");
    if (tasksCountLabel) {
      if (pending === 0 && data.today_total > 0) {
        tasksCountLabel.textContent = "All tasks completed today! 🎉";
      } else {
        tasksCountLabel.textContent = `${pending} task${pending === 1 ? "" : "s"} remaining`;
      }
    }

    // 2. Active Projects Count
    const activeProjects = data.active_projects_count !== undefined 
      ? data.active_projects_count 
      : (data.active_projects ? data.active_projects.length : 0);
    const projectsCountLabel = document.getElementById("home-projects-active-label");
    if (projectsCountLabel) {
      projectsCountLabel.textContent = `${activeProjects} Active Project${activeProjects === 1 ? "" : "s"}`;
    }

    // 3. Memories Subtitle Label
    const memCountLabel = document.getElementById("home-memories-count-label");
    if (memCountLabel) {
      if (data.recent_memory) {
        memCountLabel.textContent = `Latest: ${data.recent_memory.title || "Daily Diary"}`;
      } else {
        memCountLabel.textContent = "Daily Diary & Life Moments";
      }
    }

    // 4. Render Recent Memory Card (Shows strictly ONE memory preview)
    renderHomeRecentMemory(data.recent_memory);
  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

// ============================================================================
// 5. Two-Level Tasks: Today Tasks Engine (Section 23 - A)
// ============================================================================
function updateDateDisplay() {
  const label = document.getElementById("tasks-active-date-label");
  const hiddenPicker = document.getElementById("tasks-date-picker-hidden");
  if (!label) return;

  const todayStr = getLocalDateString(new Date());
  const selected = new Date(AppState.selectedTaskDate + "T00:00:00");
  const options = { weekday: "short", month: "short", day: "numeric" };
  const formatted = selected.toLocaleDateString(undefined, options);

  if (AppState.selectedTaskDate === todayStr) {
    label.textContent = `Today • ${formatted}`;
  } else {
    label.textContent = formatted;
  }

  if (hiddenPicker) hiddenPicker.value = AppState.selectedTaskDate;
}

async function loadTasks() {
  updateDateDisplay();

  try {
    const url = `/api/tasks?filter=${AppState.activeTaskFilter}&date=${AppState.selectedTaskDate}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load tasks");
    const tasks = await res.json();
    AppState.tasks = tasks;

    const container = document.getElementById("tasks-list-all");
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <span class="empty-icon">✅</span>
          <p class="empty-title">No tasks for this date</p>
          <p class="empty-subtitle">Add a task above or plan upcoming days.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.map((task) => generateTaskItemHtml(task, true)).join("");
    bindTaskCheckboxes(container);
    bindTaskDeleteButtons(container);
    bindTaskRescheduleButtons(container);
    bindTaskEditButtons(container);
    bindSubtasksToggleButtons(container);
    bindSubtaskCheckboxes(container);
    bindSubtaskAddForms(container);
    bindSubtaskActions(container);
  } catch (err) {
    console.error("Error loading tasks:", err);
  }
}

function formatRecurrenceBadge(task) {
  if (!task.recurring_rule_id) return "";
  const freq = task.rule_frequency || "daily";
  let label = "🔁 Repeating";
  if (freq === "daily") {
    label = "🔁 Daily";
  } else if (freq === "weekly") {
    label = "🔁 Weekly";
  } else if (freq === "monthly") {
    label = "🔁 Monthly";
  } else if (freq === "custom_days") {
    try {
      const days = typeof task.rule_weekdays === "string" ? JSON.parse(task.rule_weekdays || "[]") : (task.rule_weekdays || []);
      const dayNames = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun" };
      const formatted = days.map((d) => dayNames[d] || d).join(", ");
      label = `🔁 ${formatted || "Custom"}`;
    } catch (e) {
      label = "🔁 Custom";
    }
  }
  return `<span class="task-recurring-tag" title="Recurring Task">${label}</span>`;
}

function generateSubtaskItemHtml(s) {
  const isChecked = s.is_completed ? "checked" : "";
  const completedClass = s.is_completed ? "completed" : "";
  return `
    <div class="subtask-item ${completedClass}" data-subtask-id="${s.id}">
      <label class="custom-checkbox subtask-checkbox">
        <input type="checkbox" ${isChecked} data-subtask-id="${s.id}">
        <span class="checkmark"></span>
      </label>
      <span class="subtask-title" data-subtask-id="${s.id}">${escapeHtml(s.title)}</span>
      <div class="subtask-actions">
        <button type="button" class="subtask-icon-btn subtask-edit-btn" data-edit-subtask-id="${s.id}" title="Edit step">✏️</button>
        <button type="button" class="subtask-icon-btn subtask-move-up-btn" data-move-up="${s.id}" title="Move up">▲</button>
        <button type="button" class="subtask-icon-btn subtask-move-down-btn" data-move-down="${s.id}" title="Move down">▼</button>
        <button type="button" class="subtask-icon-btn subtask-delete-btn" data-delete-subtask-id="${s.id}" title="Delete step">✕</button>
      </div>
    </div>
  `;
}

function generateTaskItemHtml(task, showActions = false) {
  const isChecked = task.is_completed ? "checked" : "";
  const completedClass = task.is_completed ? "completed" : "";
  const priority = task.priority || "normal";
  const projectTag = task.project_title ? `<span class="task-project-tag">${escapeHtml(task.project_title)}</span>` : "";
  const recurringBadge = formatRecurrenceBadge(task);

  // Check overdue: incomplete and due date is in the past
  const todayStr = getLocalDateString(new Date());
  const isOverdue = !task.is_completed && task.task_date && task.task_date < todayStr;
  const overdueClass = isOverdue ? "is-overdue" : "";
  const overdueBadge = isOverdue ? `<span class="task-overdue-tag">Overdue</span>` : "";

  // Priority with Notion dot
  let priorityLabel = "Normal";
  if (priority === "high") priorityLabel = "High";
  if (priority === "low") priorityLabel = "Low";
  const priorityTag = `<span class="task-priority-tag ${priority}"><span class="priority-dot"></span>${priorityLabel}</span>`;

  // Time tag if due_time exists
  const dueTimeTag = task.due_time ? `<span class="task-time-tag">🕒 ${escapeHtml(task.due_time)}</span>` : "";

  // Reminder tag if reminder exists
  const reminderTag = task.reminder ? `<span class="task-time-tag">🔔 ${escapeHtml(task.reminder)}</span>` : "";

  const subtasks = task.subtasks || [];
  const subtaskCount = subtasks.length;
  const completedCount = subtasks.filter((s) => s.is_completed).length;
  const percent = subtaskCount > 0 ? Math.round((completedCount / subtaskCount) * 100) : 0;
  const allSubtasksDone = subtaskCount > 0 && completedCount === subtaskCount;

  const subtaskBadge = subtaskCount > 0
    ? `<span class="subtasks-badge ${allSubtasksDone ? "all-done" : ""}" title="${completedCount} of ${subtaskCount} steps completed">☑ ${completedCount}/${subtaskCount}</span>`
    : "";

  const progressBarHtml = subtaskCount > 0 && showActions
    ? `
      <div class="subtasks-progress-wrap">
        <div class="subtasks-progress-bar">
          <div class="subtasks-progress-fill" style="width: ${percent}%;"></div>
        </div>
        <span class="subtasks-progress-label">${completedCount} of ${subtaskCount} steps completed</span>
      </div>
    `
    : "";

  const toggleLabel = subtaskCount > 0
    ? `Checklist (${subtaskCount}) ▾`
    : `+ Checklist`;

  const renderedSubtasks = subtasks.map(generateSubtaskItemHtml).join("");

  return `
    <div class="task-item-card ${completedClass} ${overdueClass}" data-task-id="${task.id}">
      <div class="task-item-main-row">
        <label class="custom-checkbox">
          <input type="checkbox" ${isChecked} data-task-id="${task.id}">
          <span class="checkmark"></span>
        </label>
        <div class="task-info">
          <div class="task-title-line">
            <span class="task-title">${escapeHtml(task.title)}</span>
          </div>
          <div class="task-meta-row">
            ${priorityTag}
            ${overdueBadge}
            ${dueTimeTag}
            ${reminderTag}
            ${recurringBadge}
            ${projectTag}
            ${subtaskBadge}
          </div>
          ${progressBarHtml}
        </div>
        <div class="task-actions-group">
          ${
            showActions
              ? `
            <button class="task-edit-btn" data-edit-task-id="${task.id}" title="Edit Task">✎</button>
            <button class="task-subtasks-toggle-btn" data-toggle-subtasks="${task.id}" title="Toggle Checklist">${toggleLabel}</button>
            <button class="task-reschedule-btn" data-reschedule-id="${task.id}" title="Move to tomorrow">Move →</button>
            <button class="task-delete-btn" data-delete-task-id="${task.id}" data-is-recurring="${task.recurring_rule_id ? 'true' : 'false'}" aria-label="Delete">✕</button>
          `
              : `
            <span class="task-quick-action-indicator" title="Click to view details">›</span>
          `
          }
        </div>
      </div>

      ${
        showActions
          ? `
        <div class="subtasks-container" id="subtasks-for-${task.id}" style="${subtaskCount > 0 ? "display: block;" : "display: none;"}">
          <div class="subtasks-list" data-parent-task-id="${task.id}">
            ${renderedSubtasks}
          </div>
          <form class="subtask-add-form" data-parent-task-id="${task.id}">
            <input type="text" placeholder="Add a step..." class="subtask-quick-input" required>
            <button type="submit" class="subtask-add-btn">+ Add Step</button>
          </form>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function bindSubtasksToggleButtons(container) {
  container.querySelectorAll("[data-toggle-subtasks]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.toggleSubtasks;
      const subtasksSection = document.getElementById(`subtasks-for-${taskId}`);
      if (subtasksSection) {
        const isHidden = subtasksSection.style.display === "none";
        subtasksSection.style.display = isHidden ? "block" : "none";
        if (isHidden) {
          const input = subtasksSection.querySelector(".subtask-quick-input");
          if (input) input.focus();
        }
      }
    });
  });
}

function bindSubtaskCheckboxes(container) {
  container.querySelectorAll('.subtask-checkbox input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
      e.stopPropagation();
      const subtaskId = e.target.dataset.subtaskId;
      const isCompleted = e.target.checked;
      const item = e.target.closest(".subtask-item");
      if (item) item.classList.toggle("completed", isCompleted);

      try {
        const res = await fetch(`/api/subtasks/${subtaskId}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: isCompleted }),
        });
        if (!res.ok) throw new Error("Failed to toggle subtask");
        const data = await res.json();

        // Update progress bar & label in parent task card
        const card = e.target.closest(".task-item-card");
        if (card) {
          const total = data.total_subtasks;
          const completed = data.completed_subtasks;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const fill = card.querySelector(".subtasks-progress-fill");
          const label = card.querySelector(".subtasks-progress-label");
          const badge = card.querySelector(".subtasks-badge");
          if (fill) fill.style.width = `${pct}%`;
          if (label) label.textContent = `${completed} of ${total} steps completed`;
          if (badge) {
            badge.textContent = `☑️ ${completed}/${total}`;
            badge.classList.toggle("all-done", data.all_completed);
          }

          if (data.all_completed) {
            showToast("All checklist steps completed! 🎉");
          }
        }
      } catch (err) {
        e.target.checked = !isCompleted;
        if (item) item.classList.toggle("completed", !isCompleted);
        showToast("Error updating step");
      }
    });
  });
}

function bindSubtaskAddForms(container) {
  container.querySelectorAll(".subtask-add-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const taskId = form.dataset.parentTaskId;
      const input = form.querySelector(".subtask-quick-input");
      const title = input.value.trim();
      if (!title) return;

      try {
        const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (res.ok) {
          input.value = "";
          showToast("Step added ✅");
          loadTasks();
        }
      } catch (err) {
        showToast("Error adding step");
      }
    });
  });
}

function bindSubtaskActions(container) {
  // Delete step
  container.querySelectorAll("[data-delete-subtask-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const subtaskId = btn.dataset.deleteSubtaskId;
      try {
        const res = await fetch(`/api/subtasks/${subtaskId}`, { method: "DELETE" });
        if (res.ok) {
          showToast("Step removed");
          loadTasks();
        }
      } catch (err) {
        showToast("Error removing step");
      }
    });
  });

  // Edit step
  container.querySelectorAll("[data-edit-subtask-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const subtaskId = btn.dataset.editSubtaskId;
      const item = btn.closest(".subtask-item");
      const titleSpan = item.querySelector(".subtask-title");
      const currentTitle = titleSpan.textContent;
      const newTitle = prompt("Edit checklist step:", currentTitle);
      if (newTitle !== null && newTitle.trim() && newTitle.trim() !== currentTitle) {
        try {
          const res = await fetch(`/api/subtasks/${subtaskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle.trim() }),
          });
          if (res.ok) {
            titleSpan.textContent = newTitle.trim();
            showToast("Step updated ✏️");
          }
        } catch (err) {
          showToast("Error updating step");
        }
      }
    });
  });

  // Move Up
  container.querySelectorAll("[data-move-up]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const item = btn.closest(".subtask-item");
      const prev = item.previousElementSibling;
      if (!prev) return;
      const list = item.parentElement;
      list.insertBefore(item, prev);
      await syncSubtasksOrder(list);
    });
  });

  // Move Down
  container.querySelectorAll("[data-move-down]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const item = btn.closest(".subtask-item");
      const next = item.nextElementSibling;
      if (!next) return;
      const list = item.parentElement;
      list.insertBefore(next, item);
      await syncSubtasksOrder(list);
    });
  });
}

async function syncSubtasksOrder(listElement) {
  const parentTaskId = listElement.dataset.parentTaskId;
  const items = Array.from(listElement.querySelectorAll(".subtask-item"));
  const subtaskIds = items.map((i) => i.dataset.subtaskId);
  try {
    await fetch(`/api/tasks/${parentTaskId}/subtasks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtask_ids: subtaskIds }),
    });
  } catch (e) {
    console.error("Error reordering subtasks:", e);
  }
}

function bindTaskCheckboxes(container) {
  container.querySelectorAll('.task-item-main-row > .custom-checkbox > input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
      const taskId = e.target.dataset.taskId;
      const isCompleted = e.target.checked;
      const taskCard = e.target.closest(".task-item-card");

      if (taskCard) taskCard.classList.toggle("completed", isCompleted);

      try {
        const res = await fetch(`/api/tasks/${taskId}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: isCompleted }),
        });

        if (!res.ok) throw new Error("Failed to update task");
        const result = await res.json();

        // VICTORY SOUND CELEBRATION (Guarded against repeated playback on refresh/sync)
        if (isCompleted && window.SoundManager) {
          window.SoundManager.playTaskVictory(taskId);
        }

        // ANIMAL COMPANION CELEBRATION (Idempotent to prevent duplicate popups on reload/sync)
        if (isCompleted && window.Mascot) {
          if (window.Mascot.celebrateTaskCompletion) {
            window.Mascot.celebrateTaskCompletion(taskId, result.milestone);
          } else {
            window.Mascot.celebrate(result.milestone);
          }
        }

        loadDashboard();
        if (AppState.currentView === "view-analytics" && typeof loadAnalyticsDashboard === "function") {
          loadAnalyticsDashboard();
        }
      } catch (err) {
        e.target.checked = !isCompleted;
        if (taskCard) taskCard.classList.toggle("completed", !isCompleted);
        showToast("Error updating task");
      }
    });
  });
}

let pendingDeleteTaskId = null;

function openRecurringScopeModal(taskId) {
  pendingDeleteTaskId = taskId;
  const modal = document.getElementById("recurring-scope-modal");
  if (modal) modal.classList.add("active");
}

function closeRecurringScopeModal() {
  pendingDeleteTaskId = null;
  const modal = document.getElementById("recurring-scope-modal");
  if (modal) modal.classList.remove("active");
}

async function executeTaskDelete(taskId, scope = "this") {
  try {
    const res = await fetch(`/api/tasks/${taskId}?scope=${scope}`, { method: "DELETE" });
    if (res.ok) {
      if (scope === "this") showToast("Occurrence deleted ✅");
      else if (scope === "future") showToast("Future repetitions stopped 🛑");
      else showToast("Recurring series deleted 🗑️");
      loadTasks();
      loadDashboard();
      if (AppState.currentView === "view-analytics" && typeof loadAnalyticsDashboard === "function") {
        loadAnalyticsDashboard();
      }
    }
  } catch (err) {
    showToast("Error deleting task");
  } finally {
    closeRecurringScopeModal();
  }
}

function bindTaskDeleteButtons(container) {
  container.querySelectorAll("[data-delete-task-id]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.deleteTaskId;
      const isRecurring = btn.dataset.isRecurring === "true";
      if (isRecurring) {
        openRecurringScopeModal(taskId);
      } else {
        executeTaskDelete(taskId, "this");
      }
    });
  });
}

function bindTaskRescheduleButtons(container) {
  container.querySelectorAll("[data-reschedule-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = btn.dataset.rescheduleId;
      // Reschedule to tomorrow
      const cur = new Date(AppState.selectedTaskDate + "T00:00:00");
      cur.setDate(cur.getDate() + 1);
      const tomorrowStr = getLocalDateString(cur);

      try {
        const res = await fetch(`/api/tasks/${taskId}/reschedule`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_date: tomorrowStr }),
        });
        if (res.ok) {
          showToast(`Task rescheduled to ${tomorrowStr} 📅`);
          loadTasks();
          loadDashboard();
          if (AppState.currentView === "view-analytics" && typeof loadAnalyticsDashboard === "function") {
            loadAnalyticsDashboard();
          }
        }
      } catch (e) {
        showToast("Reschedule failed");
      }
    });
  });
}

function bindTaskEditButtons(container) {
  container.querySelectorAll("[data-edit-task-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.editTaskId;
      const task = (AppState.tasks || []).find((t) => String(t.id) === String(taskId));
      if (task) openTaskEditModal(task);
    });
  });
}

function openTaskEditModal(task) {
  const modal = document.getElementById("task-edit-modal");
  if (!modal || !task) return;

  const idEl = document.getElementById("edit-task-id");
  const titleEl = document.getElementById("edit-task-title");
  const descEl = document.getElementById("edit-task-desc");
  const prioEl = document.getElementById("edit-task-priority");
  const timeEl = document.getElementById("edit-task-time");
  const remEl = document.getElementById("edit-task-reminder");

  if (idEl) idEl.value = task.id;
  if (titleEl) titleEl.value = task.title || "";
  if (descEl) descEl.value = task.description || "";
  if (prioEl) prioEl.value = task.priority || "normal";
  if (timeEl) timeEl.value = task.due_time || "";
  if (remEl) remEl.value = task.reminder || "";

  modal.classList.add("active");
}

function closeTaskEditModal() {
  const modal = document.getElementById("task-edit-modal");
  if (modal) modal.classList.remove("active");
}

async function loadProjectsDropdown() {
  const select = document.getElementById("new-task-project");
  if (!select) return;

  try {
    const res = await fetch("/api/projects?status=active");
    if (res.ok) {
      const projects = await res.json();
      AppState.projectsList = projects;
      select.innerHTML = `<option value="">No Project (Standalone)</option>` +
        projects.map((p) => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join("");
    }
  } catch (e) {
    // fallback
  }
}

function initTasksListeners() {
  // Date Stepper controls
  const prevBtn = document.getElementById("btn-prev-day");
  const nextBtn = document.getElementById("btn-next-day");
  const datePickerHidden = document.getElementById("tasks-date-picker-hidden");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const d = new Date(AppState.selectedTaskDate + "T00:00:00");
      d.setDate(d.getDate() - 1);
      AppState.selectedTaskDate = getLocalDateString(d);
      loadTasks();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const d = new Date(AppState.selectedTaskDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      AppState.selectedTaskDate = getLocalDateString(d);
      loadTasks();
    });
  }

  if (datePickerHidden) {
    datePickerHidden.addEventListener("change", (e) => {
      if (e.target.value) {
        AppState.selectedTaskDate = e.target.value;
        loadTasks();
      }
    });
  }

  // Filter tabs
  document.querySelectorAll("[data-task-filter]").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("[data-task-filter]").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      AppState.activeTaskFilter = tab.dataset.taskFilter;
      loadTasks();
    });
  });

  // Recurrence schedule controls (Feature One)
  const recurringFreq = document.getElementById("new-task-recurring-freq");
  const customDaysRow = document.getElementById("recurring-custom-days-row");
  if (recurringFreq && customDaysRow) {
    recurringFreq.addEventListener("change", () => {
      const val = recurringFreq.value;
      const weekdaysGroup = customDaysRow.querySelector(".recurring-weekdays-group");
      if (val === "custom_days") {
        customDaysRow.style.display = "flex";
        if (weekdaysGroup) weekdaysGroup.style.display = "flex";
      } else if (val !== "none") {
        customDaysRow.style.display = "flex";
        if (weekdaysGroup) weekdaysGroup.style.display = "none";
      } else {
        customDaysRow.style.display = "none";
      }
    });
  }

  // Weekday pill toggle buttons
  document.querySelectorAll(".weekday-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      pill.classList.toggle("active");
    });
  });

  // Recurring Task Scope Modal buttons
  const scopeModal = document.getElementById("recurring-scope-modal");
  if (scopeModal) {
    scopeModal.querySelectorAll("[data-scope]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (pendingDeleteTaskId) {
          executeTaskDelete(pendingDeleteTaskId, btn.dataset.scope);
        }
      });
    });
    const cancelBtn = document.getElementById("btn-cancel-scope");
    const closeBtn = document.getElementById("btn-close-scope-modal");
    if (cancelBtn) cancelBtn.addEventListener("click", closeRecurringScopeModal);
    if (closeBtn) closeBtn.addEventListener("click", closeRecurringScopeModal);
    scopeModal.addEventListener("click", (e) => {
      if (e.target === scopeModal) closeRecurringScopeModal();
    });
  }

  // Add task form
  const form = document.getElementById("form-add-task");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("new-task-input");
      const prioritySelect = document.getElementById("new-task-priority");
      const projectSelect = document.getElementById("new-task-project");
      const recurringFreqSelect = document.getElementById("new-task-recurring-freq");
      const recurringEndInput = document.getElementById("new-task-recurring-end");
      const title = input.value.trim();
      if (!title) return;

      let recurringPayload = null;
      if (recurringFreqSelect && recurringFreqSelect.value !== "none") {
        const freq = recurringFreqSelect.value;
        const activeDays = Array.from(document.querySelectorAll(".weekday-pill.active")).map((p) =>
          parseInt(p.dataset.day)
        );
        recurringPayload = {
          frequency: freq,
          interval_val: 1,
          by_weekdays: freq === "custom_days" ? activeDays : [],
          end_date: recurringEndInput && recurringEndInput.value ? recurringEndInput.value : null,
        };
      }

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title,
            priority: prioritySelect.value,
            task_date: AppState.selectedTaskDate,
            project_id: projectSelect ? projectSelect.value || null : null,
            recurring: recurringPayload,
          }),
        });

        if (res.ok) {
          input.value = "";
          if (recurringFreqSelect) recurringFreqSelect.value = "none";
          if (customDaysRow) customDaysRow.style.display = "none";
          showToast(recurringPayload ? "Recurring task series created 🔁" : "Task added ✅");
          loadTasks();
          loadDashboard();
          if (AppState.currentView === "view-analytics" && typeof loadAnalyticsDashboard === "function") {
            loadAnalyticsDashboard();
          }
        }
      } catch (err) {
        showToast("Error creating task");
      }
    });
  }

  // Task Edit Modal bindings
  const editTaskForm = document.getElementById("form-edit-task");
  const closeTaskEditBtn = document.getElementById("btn-close-task-edit");
  const cancelTaskEditBtn = document.getElementById("btn-cancel-task-edit");
  if (closeTaskEditBtn) closeTaskEditBtn.addEventListener("click", closeTaskEditModal);
  if (cancelTaskEditBtn) cancelTaskEditBtn.addEventListener("click", closeTaskEditModal);

  if (editTaskForm) {
    editTaskForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const taskId = document.getElementById("edit-task-id").value;
      const title = document.getElementById("edit-task-title").value.trim();
      const description = document.getElementById("edit-task-desc").value.trim();
      const priority = document.getElementById("edit-task-priority").value;
      const dueTime = document.getElementById("edit-task-time").value.trim();
      const reminder = document.getElementById("edit-task-reminder").value.trim();

      if (!title) return;

      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title,
            description: description,
            priority: priority,
            due_time: dueTime,
            reminder: reminder,
          }),
        });

        if (res.ok) {
          closeTaskEditModal();
          showToast("Task updated! ✅");
          loadTasks();
          loadDashboard();
          if (AppState.currentView === "view-analytics" && typeof loadAnalyticsDashboard === "function") {
            loadAnalyticsDashboard();
          }
        } else {
          showToast("Failed to update task");
        }
      } catch (err) {
        showToast("Error updating task");
      }
    });
  }
}

// ============================================================================
// 6. Two-Level Tasks: Monthly Projects & Milestones (Section 23 - B)
// ============================================================================
async function loadProjects() {
  try {
    const url = `/api/projects?status=${AppState.activeProjectFilter}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load projects");
    const projects = await res.json();

    const container = document.getElementById("projects-list-all");
    if (!container) return;

    if (projects.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <span class="empty-icon">🎯</span>
          <p class="empty-title">No projects in this view</p>
          <p class="empty-subtitle">Tap "+ New Project" above to organize multi-day goals.</p>
        </div>
      `;
      return;
    }

    // Load full milestone details for each project card
    const projectCardsHtml = await Promise.all(
      projects.map(async (p) => {
        try {
          const detailRes = await fetch(`/api/projects/${p.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            return generateProjectCardHtml(detail, true);
          }
        } catch (e) {}
        return generateProjectCardHtml(p, true);
      })
    );

    container.innerHTML = projectCardsHtml.join("");
    bindProjectActions(container);
  } catch (err) {
    console.error("Projects load error:", err);
  }
}

function generateProjectCardHtml(p, showMilestones = false) {
  const total = p.milestone_total || 0;
  const completed = p.milestone_completed || 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : (p.progress_percent || 0);

  // Auto-align status so 100% completed project shows completed status
  let effectiveStatus = p.status || "in_progress";
  if (total > 0 && completed === total) {
    effectiveStatus = "completed";
  } else if (total > 0 && completed < total && effectiveStatus === "completed") {
    effectiveStatus = "in_progress";
  }
  const statusLabel = effectiveStatus.replace("_", " ");

  let deadlineText = "No deadline";
  if (p.deadline) {
    try {
      const d = new Date(p.deadline + "T00:00:00");
      deadlineText = `Due ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    } catch (e) {
      deadlineText = `Due ${p.deadline}`;
    }
  }

  const progressStatsHtml = total > 0
    ? `<span>${percent}% completed</span><span>${completed} of ${total} milestones</span>`
    : `<span>In progress</span><span>No milestones yet</span>`;

  let milestonesHtml = "";
  if (showMilestones && p.milestones && p.milestones.length > 0) {
    milestonesHtml = `
      <div class="project-milestones-container">
        <div class="project-milestones-header">Milestones & Action Items (${completed}/${total})</div>
        ${p.milestones
          .map(
            (m) => `
          <div class="milestone-item ${m.is_completed ? "completed" : ""}">
            <label class="custom-checkbox">
              <input type="checkbox" ${m.is_completed ? "checked" : ""} data-milestone-id="${m.id}">
              <span class="checkmark"></span>
            </label>
            <span class="milestone-title">${escapeHtml(m.title)}</span>
            <button class="task-delete-btn" data-delete-milestone-id="${m.id}">✕</button>
          </div>
        `
          )
          .join("")}
        <form class="add-milestone-bar" data-project-id="${p.id}">
          <input type="text" placeholder="+ Add milestone..." class="add-milestone-input" required>
          <button type="submit" class="btn btn-primary btn-sm">Add</button>
        </form>
      </div>
    `;
  } else if (showMilestones) {
    milestonesHtml = `
      <div class="project-milestones-container">
        <form class="add-milestone-bar" data-project-id="${p.id}">
          <input type="text" placeholder="+ Add first milestone..." class="add-milestone-input" required>
          <button type="submit" class="btn btn-primary btn-sm">Add</button>
        </form>
      </div>
    `;
  }

  return `
    <article class="project-card" data-project-id="${p.id}">
      <div class="project-card-header">
        <div>
          <h3 class="project-card-title">${escapeHtml(p.title)}</h3>
          <span class="project-card-deadline">${deadlineText}</span>
        </div>
        <span class="project-status-pill ${effectiveStatus}">${statusLabel}</span>
      </div>
      ${p.description ? `<p class="project-card-desc">${escapeHtml(p.description)}</p>` : ""}
      
      <div class="project-progress-wrap">
        <div class="project-progress-bar-track">
          <div class="project-progress-bar-fill" style="width: ${percent}%;"></div>
        </div>
        <div class="project-progress-stats">
          ${progressStatsHtml}
        </div>
      </div>

      ${milestonesHtml}
    </article>
  `;
}

function bindProjectActions(container) {
  // Milestone checkboxes
  container.querySelectorAll("input[data-milestone-id]").forEach((cb) => {
    cb.addEventListener("change", async (e) => {
      const mId = e.target.dataset.milestoneId;
      const isCompleted = e.target.checked;
      try {
        const res = await fetch(`/api/milestones/${mId}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: isCompleted }),
        });
        if (res.ok) {
          if (isCompleted && window.SoundManager) {
            window.SoundManager.playMilestoneVictory(mId);
          }
          if (isCompleted && window.Mascot) {
            if (window.Mascot.celebrateTaskCompletion) {
              window.Mascot.celebrateTaskCompletion(mId, "standard");
            } else {
              window.Mascot.celebrate("standard");
            }
          }
          loadProjects();
          if (AppState.currentView === "view-analytics" && typeof loadAnalyticsDashboard === "function") {
            loadAnalyticsDashboard();
          }
          loadDashboard();
        }
      } catch (err) {
        showToast("Error updating milestone");
      }
    });
  });

  // Delete milestone
  container.querySelectorAll("[data-delete-milestone-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mId = btn.dataset.deleteMilestoneId;
      try {
        await fetch(`/api/milestones/${mId}`, { method: "DELETE" });
        showToast("Milestone removed");
        loadProjects();
        loadDashboard();
      } catch (err) {
        showToast("Error removing milestone");
      }
    });
  });

  // Add milestone inline form
  container.querySelectorAll(".add-milestone-bar").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const projId = form.dataset.projectId;
      const input = form.querySelector(".add-milestone-input");
      const title = input.value.trim();
      if (!title) return;

      try {
        const res = await fetch(`/api/projects/${projId}/milestones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title }),
        });
        if (res.ok) {
          input.value = "";
          showToast("Milestone added 🎯");
          loadProjects();
          loadDashboard();
        }
      } catch (err) {
        showToast("Error adding milestone");
      }
    });
  });

  // Project Card click opens Project Details Modal
  container.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button, input, form, label, .add-milestone-bar")) return;
      const projId = card.dataset.projectId;
      openProjectDetailModal(projId);
    });
  });
}

let activeDetailProjectId = null;

function openProjectDetailModal(projId) {
  const p = (AppState.projectsList || []).find((proj) => String(proj.id) === String(projId));
  const modal = document.getElementById("project-detail-modal");
  if (!modal || !p) return;
  activeDetailProjectId = p.id;

  const titleEl = document.getElementById("project-detail-title");
  const descEl = document.getElementById("project-detail-desc");
  const statusBadge = document.getElementById("project-detail-status-badge");
  const progressNum = document.getElementById("project-detail-progress-num");
  const progressBar = document.getElementById("project-detail-progress-bar");
  const progressSlider = document.getElementById("project-progress-slider");

  if (titleEl) titleEl.textContent = p.title || "Project Details";
  if (descEl) descEl.textContent = p.description || "No project description.";
  if (statusBadge) {
    statusBadge.textContent = (p.status || "in_progress").replace("_", " ").toUpperCase();
  }

  const prog = p.progress_percent !== undefined ? p.progress_percent : (p.progress || 0);
  if (progressNum) progressNum.textContent = `${prog}%`;
  if (progressBar) progressBar.style.width = `${prog}%`;
  if (progressSlider) progressSlider.value = prog;

  modal.classList.add("active");
}

function closeProjectDetailModal() {
  const modal = document.getElementById("project-detail-modal");
  if (modal) modal.classList.remove("active");
  activeDetailProjectId = null;
}

function openProjectModal() {
  const modal = document.getElementById("project-modal");
  if (modal) modal.classList.add("active");
}

function closeProjectModal() {
  const modal = document.getElementById("project-modal");
  if (modal) modal.classList.remove("active");
}

function initProjectsListeners() {
  const openBtn = document.getElementById("btn-open-new-project");
  const closeBtn = document.getElementById("btn-close-project-modal");
  const cancelBtn = document.getElementById("btn-cancel-project");
  const form = document.getElementById("form-create-project");

  if (openBtn) openBtn.addEventListener("click", openProjectModal);
  if (closeBtn) closeBtn.addEventListener("click", closeProjectModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeProjectModal);

  // Project Detail Modal controls
  const closeDetailBtn = document.getElementById("btn-close-project-detail");
  if (closeDetailBtn) closeDetailBtn.addEventListener("click", closeProjectDetailModal);

  const progressSlider = document.getElementById("project-progress-slider");
  if (progressSlider) {
    progressSlider.addEventListener("input", async (e) => {
      const val = parseInt(e.target.value, 10);
      const numEl = document.getElementById("project-detail-progress-num");
      const barEl = document.getElementById("project-detail-progress-bar");
      if (numEl) numEl.textContent = `${val}%`;
      if (barEl) barEl.style.width = `${val}%`;

      if (activeDetailProjectId) {
        try {
          await fetch(`/api/projects/${activeDetailProjectId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ progress: val }),
          });
          loadProjects();
          loadDashboard();
        } catch (err) {}
      }
    });
  }

  // Project filter tabs
  document.querySelectorAll("[data-project-filter]").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("[data-project-filter]").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      AppState.activeProjectFilter = tab.dataset.projectFilter;
      loadProjects();
    });
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("project-title-input").value.trim();
      const desc = document.getElementById("project-desc-input").value.trim();
      const status = document.getElementById("project-status-select").value;
      const deadline = document.getElementById("project-deadline-input").value || null;

      if (!title) return;

      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title,
            description: desc,
            status: status,
            deadline: deadline,
          }),
        });

        if (res.ok) {
          closeProjectModal();
          form.reset();
          showToast("Project created 🚀");
          loadProjects();
          loadDashboard();
        }
      } catch (err) {
        showToast("Error creating project");
      }
    });
  }
}

// ============================================================================
// 7. Notes Management
// ============================================================================
async function loadNotes(searchQuery = "") {
  try {
    const url = searchQuery ? `/api/notes?q=${encodeURIComponent(searchQuery)}` : "/api/notes";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load notes");
    const notes = await res.json();
    AppState.notes = notes;

    const container = document.getElementById("notes-list-all");
    if (!container) return;

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card">
          <span class="empty-icon">📝</span>
          <p class="empty-title">No notes found</p>
          <p class="empty-subtitle">Tap "+ New Note" to write your thoughts.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = notes
      .map((note) => {
        const pinBadge = note.is_pinned ? `<span class="note-card-badge">Pinned</span>` : "";
        const tag = note.tags || "General";
        const snippet = note.content ? escapeHtml(note.content.substring(0, 110)) + "..." : "Empty note";

        return `
        <article class="note-card" data-note-id="${note.id}">
          ${pinBadge}
          <h3 class="note-card-title">${escapeHtml(note.title)}</h3>
          <p class="note-card-snippet">${snippet}</p>
          <div class="note-card-footer">
            <span class="note-tag">${escapeHtml(tag)}</span>
            <span class="note-date">Updated recently</span>
          </div>
        </article>
      `;
      })
      .join("");

    container.querySelectorAll(".note-card").forEach((card) => {
      card.addEventListener("click", () => {
        if (window.NoteEditor) window.NoteEditor.openEditor(card.dataset.noteId);
      });
    });
  } catch (err) {
    console.error("Error loading notes:", err);
  }
}
window.loadNotes = loadNotes;
window.loadDashboard = loadDashboard;

function initNotesListeners() {
  const createBtn = document.getElementById("btn-create-note");
  if (createBtn) {
    createBtn.addEventListener("click", () => {
      if (window.NoteEditor) window.NoteEditor.openEditor();
    });
  }

  const filterInput = document.getElementById("notes-filter-input");
  if (filterInput) {
    filterInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const cards = document.querySelectorAll("#notes-list-all .note-card");
      cards.forEach((card) => {
        const title = (card.querySelector(".note-card-title")?.textContent || "").toLowerCase();
        const snippet = (card.querySelector(".note-card-snippet")?.textContent || "").toLowerCase();
        const tag = (card.querySelector(".note-tag")?.textContent || "").toLowerCase();
        const matches = !q || title.includes(q) || snippet.includes(q) || tag.includes(q);
        card.style.display = matches ? "" : "none";
      });
    });
  }
}

// ============================================================================
// 8. Journal – Memories & Personal Digital Diary Album
// ============================================================================
function formatMemoryDate(dateStr) {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, monthIdx, day);
      return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    }
  } catch (e) {}
  return dateStr;
}

function getMemoryMonthLabel(dateStr) {
  if (!dateStr) return "Recent Memories";
  try {
    const parts = dateStr.split("-");
    if (parts.length >= 2) {
      const year = parts[0];
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${monthNames[mIdx]} ${year}`;
    }
  } catch (e) {}
  return "Recent Memories";
}

async function loadMemories(searchQuery = "") {
  try {
    // 0. Update prominent today's date in hero card
    const todayBanner = document.getElementById("memories-prominent-today-date");
    if (todayBanner) {
      const now = new Date();
      todayBanner.textContent = now.toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    const url = searchQuery ? `/api/memories?q=${encodeURIComponent(searchQuery)}` : "/api/memories";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load memories");
    const memories = await res.json();
    AppState.memories = memories;

    const container = document.getElementById("memory-timeline-container");
    if (!container) return;

    if (memories.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card memory-empty-card">
          <span class="empty-icon">📔</span>
          <p class="empty-title">${searchQuery ? "No matching diary entries" : "Your digital diary is ready"}</p>
          <p class="empty-subtitle">${searchQuery ? "Try searching with different keywords." : "What made today special? Record your moments, feelings, and memories."}</p>
          ${!searchQuery ? `<button class="btn btn-primary btn-sm" id="btn-empty-create-memory">+ Write Today's Entry</button>` : ""}
        </div>
      `;
      const emptyBtn = document.getElementById("btn-empty-create-memory");
      if (emptyBtn) emptyBtn.addEventListener("click", () => openCreateMemoryModal());
      return;
    }

    // Group memories by Month and Year (reverse chronological)
    const groups = {};
    memories.forEach((m) => {
      const groupKey = getMemoryMonthLabel(m.date);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(m);
    });

    let timelineHtml = "";
    Object.keys(groups).forEach((monthKey) => {
      const groupMemories = groups[monthKey];
      timelineHtml += `
        <div class="memory-month-section">
          <div class="memory-month-badge">${escapeHtml(monthKey)}</div>
          <div class="memory-cards-grid">
            ${groupMemories.map((m) => renderMemoryCardHtml(m)).join("")}
          </div>
        </div>
      `;
    });

    container.innerHTML = timelineHtml;

    // Bind card clicks to open detail modal or edit action
    container.querySelectorAll(".memory-timeline-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        const editBtn = e.target.closest(".btn-card-edit-action");
        const memoryId = card.dataset.memoryId;
        const memory = (AppState.memories || []).find((m) => String(m.id) === String(memoryId));
        if (!memory) return;
        if (editBtn) {
          e.stopPropagation();
          openEditMemoryModal(memory);
          return;
        }
        openMemoryDetail(memory);
      });
    });
  } catch (err) {
    console.error("Memories error:", err);
  }
}

function renderMemoryCardHtml(m) {
  const photos = Array.isArray(m.photos) ? m.photos : [];
  const photoCount = photos.length;
  const mood = m.mood || "😊 Happy";
  const journalText = m.journal_text || m.description || "";
  const shortText = journalText.length > 220 ? journalText.substring(0, 215) + "..." : (journalText || "No written reflection recorded for this day.");
  const formattedDate = formatMemoryDate(m.date);
  const tags = Array.isArray(m.tags) ? m.tags : (m.tags ? String(m.tags).split(",") : []);

  // Show small, elegant photo preview when photos exist
  let photosPreviewHtml = "";
  if (photoCount > 0) {
    const previewThumbs = photos.slice(0, 3).map((url, idx) => `
      <div class="diary-mini-thumb" data-thumb-idx="${idx}">
        <img src="${escapeHtml(url)}" alt="Attached photo ${idx + 1}" loading="lazy" onerror="this.parentElement.style.display='none'">
      </div>
    `).join("");

    photosPreviewHtml = `
      <div class="diary-card-photos-preview">
        <div class="diary-mini-thumbs-strip">
          ${previewThumbs}
          ${photoCount > 3 ? `<span class="diary-more-photos-pill">+${photoCount - 3}</span>` : ""}
        </div>
        <span class="diary-photos-count-label">📷 ${photoCount} photo${photoCount > 1 ? "s" : ""}</span>
      </div>
    `;
  }

  let tagsHtml = "";
  if (tags && tags.length > 0) {
    tagsHtml = `
      <div class="memory-card-tags">
        ${tags.map((t) => `<span class="memory-tag-chip">#${escapeHtml(t.trim())}</span>`).join("")}
      </div>
    `;
  }

  const displayTitle = m.title || "Diary Reflection";

  return `
    <article class="memory-timeline-card diary-entry-card" data-memory-id="${m.id}">
      <div class="diary-card-header">
        <div class="diary-card-date-badge">
          <span class="diary-card-calendar-icon">📅</span>
          <span class="diary-card-date-str">${escapeHtml(formattedDate)}</span>
          ${m.time ? `<span class="diary-card-time-str">🕓 ${escapeHtml(m.time)}</span>` : ""}
        </div>
        <span class="memory-card-mood-pill-inline">${escapeHtml(mood)}</span>
      </div>

      <div class="diary-card-body">
        <h3 class="diary-card-title">${escapeHtml(displayTitle)}</h3>
        ${m.location ? `<div class="memory-card-location">📍 ${escapeHtml(m.location)}</div>` : ""}
        <p class="diary-card-excerpt">"${escapeHtml(shortText)}"</p>
        ${photosPreviewHtml}
        ${tagsHtml}
      </div>

      <div class="diary-card-footer">
        <span class="diary-read-prompt">Read entry & view album →</span>
        <button type="button" class="btn btn-sm btn-subtle btn-card-edit-action" data-action="edit" title="Edit this memory">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          <span>Edit</span>
        </button>
      </div>
    </article>
  `;
}


// ----------------------------------------------------------------------------
// Create & Edit Memory Modal Controller
// ----------------------------------------------------------------------------
function openCreateMemoryModal(prefilledDate = null, forceNew = false) {
  const targetDate = prefilledDate || getLocalDateString(new Date());

  // If not forceNew, check if entry exists and open edit
  if (!forceNew) {
    const existing = (AppState.memories || []).find((m) => m.date === targetDate);
    if (existing) {
      openEditMemoryModal(existing);
      showToast(`Opened your entry for ${formatMemoryDate(targetDate)} to update ✏️`);
      return;
    }
  }

  const modal = document.getElementById("memory-editor-modal");
  if (!modal) return;

  const form = document.getElementById("form-memory-editor");
  if (form) form.reset();

  document.getElementById("memory-edit-id").value = "";
  document.getElementById("memory-editor-mode-label").textContent = "WRITE TODAY'S ENTRY";
  document.getElementById("memory-editor-sheet-title").textContent = "Dear Diary";

  document.getElementById("memory-input-date").value = targetDate;

  // Format current time like "4:30 PM"
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  document.getElementById("memory-input-time").value = `${displayHours}:${minutes} ${ampm}`;

  document.getElementById("memory-input-title").value = "";
  document.getElementById("memory-input-location").value = "";
  document.getElementById("memory-input-text").value = "";
  document.getElementById("memory-input-tags").value = "";

  selectEditorMood("😊 Happy");

  AppState.editorPhotos = [];
  renderEditorPhotoThumbnails();

  modal.classList.add("active");
}

function openEditMemoryModal(memory) {
  const modal = document.getElementById("memory-editor-modal");
  if (!modal || !memory) return;

  closeMemoryDetail();

  document.getElementById("memory-edit-id").value = memory.id;
  document.getElementById("memory-editor-mode-label").textContent = "EDIT DIARY ENTRY";
  document.getElementById("memory-editor-sheet-title").textContent = "Edit Entry";

  document.getElementById("memory-input-title").value = memory.title || "";
  document.getElementById("memory-input-date").value = memory.date || getLocalDateString(new Date());
  document.getElementById("memory-input-time").value = memory.time || "";
  document.getElementById("memory-input-location").value = memory.location || "";
  document.getElementById("memory-input-text").value = memory.journal_text || memory.description || "";

  const tags = Array.isArray(memory.tags) ? memory.tags.join(", ") : (memory.tags || "");
  document.getElementById("memory-input-tags").value = tags;

  selectEditorMood(memory.mood || "😊 Happy");

  AppState.editorPhotos = Array.isArray(memory.photos) ? [...memory.photos] : [];
  renderEditorPhotoThumbnails();

  modal.classList.add("active");
}

function closeMemoryEditorModal() {
  const modal = document.getElementById("memory-editor-modal");
  if (modal) modal.classList.remove("active");
}

function selectEditorMood(moodText) {
  const picker = document.getElementById("memory-moods-picker");
  const input = document.getElementById("memory-selected-mood");
  if (!picker || !input) return;

  input.value = moodText;
  picker.querySelectorAll(".mood-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.mood === moodText);
  });
}

// Asynchronous client-side image optimization (prevents UI freeze on multi-megapixel photos)
function compressImageForUpload(file) {
  if (!file || !file.type.startsWith("image/") || file.type.includes("svg") || file.type.includes("gif")) {
    return Promise.resolve({
      file: file,
      previewUrl: URL.createObjectURL(file),
      isOptimized: false,
    });
  }

  // Fast check: If already small (< 600KB), return as is without heavy processing
  if (file.size <= 600 * 1024) {
    return Promise.resolve({
      file: file,
      previewUrl: URL.createObjectURL(file),
      isOptimized: false,
    });
  }

  return new Promise((resolve) => {
    // Fast path: use createImageBitmap if supported for non-blocking decode
    if (typeof window.createImageBitmap === "function") {
      createImageBitmap(file)
        .then((bitmap) => {
          const maxDim = 1600;
          let width = bitmap.width;
          let height = bitmap.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          let canvas;
          if (typeof OffscreenCanvas !== "undefined") {
            canvas = new OffscreenCanvas(width, height);
          } else {
            canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
          }

          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) {
            bitmap.close();
            return resolve({ file: file, previewUrl: URL.createObjectURL(file), isOptimized: false });
          }

          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();

          if (canvas.convertToBlob) {
            canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 })
              .then((blob) => {
                if (blob && blob.size < file.size) {
                  const optFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  });
                  resolve({ file: optFile, previewUrl: URL.createObjectURL(blob), isOptimized: true });
                } else {
                  resolve({ file: file, previewUrl: URL.createObjectURL(file), isOptimized: false });
                }
              })
              .catch(() => resolve({ file: file, previewUrl: URL.createObjectURL(file), isOptimized: false }));
          } else if (canvas.toBlob) {
            canvas.toBlob(
              (blob) => {
                if (blob && blob.size < file.size) {
                  const optFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  });
                  resolve({ file: optFile, previewUrl: URL.createObjectURL(blob), isOptimized: true });
                } else {
                  resolve({ file: file, previewUrl: URL.createObjectURL(file), isOptimized: false });
                }
              },
              "image/jpeg",
              0.82
            );
          } else {
            resolve({ file: file, previewUrl: URL.createObjectURL(file), isOptimized: false });
          }
        })
        .catch(() => fallbackCanvasCompress(file, resolve));
    } else {
      fallbackCanvasCompress(file, resolve);
    }
  });
}

function fallbackCanvasCompress(file, resolve) {
  const tempUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      const maxDim = 1600;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        URL.revokeObjectURL(tempUrl);
        return resolve({ file: file, previewUrl: tempUrl, isOptimized: false });
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(tempUrl);
          if (blob && blob.size < file.size) {
            const optFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve({ file: optFile, previewUrl: URL.createObjectURL(blob), isOptimized: true });
          } else {
            resolve({ file: file, previewUrl: URL.createObjectURL(file), isOptimized: false });
          }
        },
        "image/jpeg",
        0.82
      );
    } catch (_) {
      URL.revokeObjectURL(tempUrl);
      resolve({ file: file, previewUrl: URL.createObjectURL(file), isOptimized: false });
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(tempUrl);
    resolve({ file: file, previewUrl: URL.createObjectURL(file), isOptimized: false });
  };
  img.src = tempUrl;
}

function renderEditorPhotoThumbnails() {
  const container = document.getElementById("memory-photos-preview-wrap");
  if (!container) return;

  const photos = AppState.editorPhotos || [];

  if (photos.length === 0) {
    container.onclick = null;
    container.innerHTML = `
      <div class="diary-photos-empty-hint" id="memory-photos-empty-hint">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.6;margin-bottom:4px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
        <div>Photos are optional. Tap <strong>Add Photos</strong>, <strong>Camera</strong>, or drag & drop images here.</div>
      </div>
    `;
    const hint = document.getElementById("memory-photos-empty-hint");
    if (hint) {
      hint.onclick = () => {
        const fileIn = document.getElementById("memory-file-input");
        if (fileIn) fileIn.click();
      };
    }
    return;
  }

  // Preserve horizontal scroll position across re-renders
  const existingScroll = container.querySelector(".diary-photo-thumbs-scroll");
  const prevScrollLeft = existingScroll ? existingScroll.scrollLeft : 0;

  let html = `<div class="diary-photo-thumbs-scroll">`;
  photos.forEach((url, idx) => {
    const isCover = idx === 0;
    const isPending = url && url.startsWith("blob:");
    html += `
      <div class="diary-photo-thumb${isCover ? " is-cover" : ""}" data-photo-index="${idx}">
        <img src="${escapeHtml(url)}" alt="Photo ${idx + 1}" class="diary-thumb-img" loading="lazy" decoding="async">
        
        <!-- Always accessible Delete Button at top right (even during upload) -->
        <button type="button" class="diary-thumb-action-delete" data-remove-photo-idx="${idx}" title="Remove photo" aria-label="Remove photo">✕</button>
        
        <!-- Cover badge if this is the cover photo -->
        ${isCover ? `<span class="diary-thumb-cover-pill">★ Cover</span>` : ""}
        
        <!-- Uploading status badge if pending (small, non-blocking at top left) -->
        ${isPending && !isCover ? `
          <div class="diary-thumb-upload-pill">
            <div class="diary-thumb-spinner-micro"></div>
            <span>Saving...</span>
          </div>
        ` : ""}

        <!-- Bottom action bar with reorder & set-cover controls (always enabled) -->
        <div class="diary-thumb-bottom-bar">
          ${idx > 0 ? `<button type="button" class="diary-thumb-move-btn" data-move-left-idx="${idx}" title="Move left">‹</button>` : `<span class="diary-thumb-spacer"></span>`}
          ${!isCover ? `<button type="button" class="diary-thumb-set-cover-btn" data-cover-idx="${idx}" title="Set as Cover">★ Cover</button>` : `<span class="diary-thumb-spacer"></span>`}
          ${idx < photos.length - 1 ? `<button type="button" class="diary-thumb-move-btn" data-move-right-idx="${idx}" title="Move right">›</button>` : `<span class="diary-thumb-spacer"></span>`}
        </div>
      </div>`;
  });
  html += `</div>`;

  container.innerHTML = html;

  const newScroll = container.querySelector(".diary-photo-thumbs-scroll");
  if (newScroll && prevScrollLeft > 0) {
    newScroll.scrollLeft = prevScrollLeft;
  }

  // Delegated event handling for smooth interactions
  container.onclick = (e) => {
    // 1. Delete photo
    const delBtn = e.target.closest("[data-remove-photo-idx]");
    if (delBtn) {
      e.stopPropagation();
      const idx = parseInt(delBtn.dataset.removePhotoIdx, 10);
      const url = AppState.editorPhotos[idx];
      if (url && url.startsWith("blob:")) {
        try { URL.revokeObjectURL(url); } catch (_) {}
      }
      AppState.editorPhotos.splice(idx, 1);
      renderEditorPhotoThumbnails();
      return;
    }

    // 2. Set as cover
    const coverBtn = e.target.closest("[data-cover-idx]");
    if (coverBtn) {
      e.stopPropagation();
      const idx = parseInt(coverBtn.dataset.coverIdx, 10);
      if (idx > 0 && idx < AppState.editorPhotos.length) {
        const [photo] = AppState.editorPhotos.splice(idx, 1);
        AppState.editorPhotos.unshift(photo);
        renderEditorPhotoThumbnails();
      }
      return;
    }

    // 3. Move left
    const leftBtn = e.target.closest("[data-move-left-idx]");
    if (leftBtn) {
      e.stopPropagation();
      const idx = parseInt(leftBtn.dataset.moveLeftIdx, 10);
      if (idx > 0) {
        [AppState.editorPhotos[idx], AppState.editorPhotos[idx - 1]] =
          [AppState.editorPhotos[idx - 1], AppState.editorPhotos[idx]];
        renderEditorPhotoThumbnails();
      }
      return;
    }

    // 4. Move right
    const rightBtn = e.target.closest("[data-move-right-idx]");
    if (rightBtn) {
      e.stopPropagation();
      const idx = parseInt(rightBtn.dataset.moveRightIdx, 10);
      if (idx < AppState.editorPhotos.length - 1) {
        [AppState.editorPhotos[idx], AppState.editorPhotos[idx + 1]] =
          [AppState.editorPhotos[idx + 1], AppState.editorPhotos[idx]];
        renderEditorPhotoThumbnails();
      }
      return;
    }

    // 5. Clicking on the thumbnail image directly opens quick lightbox preview
    const thumbImg = e.target.closest(".diary-thumb-img");
    if (thumbImg) {
      const card = thumbImg.closest(".diary-photo-thumb");
      if (card && card.dataset.photoIndex !== undefined) {
        const idx = parseInt(card.dataset.photoIndex, 10);
        openLightbox(AppState.editorPhotos, idx);
      }
    }
  };
}

async function handlePhotoFilesUpload(files) {
  if (!files || files.length === 0) return;
  const rawList = Array.from(files).filter((f) => f && f.type && f.type.startsWith("image/"));
  if (rawList.length === 0) {
    showToast("Please choose an image file.");
    return;
  }

  // Upload one image at a time. This avoids decoding several large phone photos
  // into canvas memory at once, which was causing browser/tab crashes.
  const uploadPromise = (async () => {
    let successCount = 0;
    for (const file of rawList) {
      if (file.size > 20 * 1024 * 1024) {
        showToast(`${file.name} is too large. Maximum 20 MB per photo.`);
        continue;
      }

      const tempUrl = URL.createObjectURL(file);
      AppState.editorPhotos = (AppState.editorPhotos || []).concat([tempUrl]);
      renderEditorPhotoThumbnails();

      try {
        const formData = new FormData();
        formData.append("photos", file, file.name);
        const res = await fetch("/api/memories/upload", { method: "POST", body: formData });
        let data = {};
        try { data = await res.json(); } catch (_) {}
        if (!res.ok || !data.urls || !data.urls[0]) {
          throw new Error(data.error || `Photo upload failed (${res.status})`);
        }

        const currentPos = AppState.editorPhotos.indexOf(tempUrl);
        if (currentPos !== -1) AppState.editorPhotos[currentPos] = data.urls[0];
        successCount += 1;
      } catch (err) {
        const currentPos = AppState.editorPhotos.indexOf(tempUrl);
        if (currentPos !== -1) AppState.editorPhotos.splice(currentPos, 1);
        console.error("Photo upload failed:", err);
        showToast(err.message || "Photo upload failed. Please try a smaller JPG/PNG.");
      } finally {
        try { URL.revokeObjectURL(tempUrl); } catch (_) {}
        renderEditorPhotoThumbnails();
      }
    }
    if (successCount > 0) {
      showToast(`${successCount} photo${successCount > 1 ? "s" : ""} saved ✨`);
    }
  })();

  AppState.activePhotoUploadPromise = uploadPromise;
  try {
    await uploadPromise;
  } finally {
    if (AppState.activePhotoUploadPromise === uploadPromise) {
      AppState.activePhotoUploadPromise = null;
    }
  }
}

// ----------------------------------------------------------------------------
// Memory Detail Reader & Fullscreen Lightbox Controller
// ----------------------------------------------------------------------------
function openMemoryDetail(memory) {
  AppState.currentMemory = memory;
  const modal = document.getElementById("memory-detail-modal");
  if (!modal || !memory) return;

  const photos = Array.isArray(memory.photos) ? memory.photos : [];
  const coverWrap = document.getElementById("memory-detail-cover-wrap");
  const coverImg = document.getElementById("memory-detail-cover-img");

  if (photos.length > 0) {
    coverWrap.style.display = "block";
    coverImg.src = photos[0];
    coverImg.onclick = () => openLightbox(photos, 0);
  } else {
    coverWrap.style.display = "none";
  }

  const moodEl = document.getElementById("memory-detail-mood");
  if (moodEl) moodEl.textContent = memory.mood || "😊 Happy";

  const titleEl = document.getElementById("memory-detail-title");
  if (titleEl) titleEl.textContent = memory.title || "Diary Reflection";

  const dateText = document.getElementById("memory-detail-date-text");
  if (dateText) dateText.textContent = formatMemoryDate(memory.date);

  const timeWrap = document.getElementById("memory-detail-time");
  const timeText = document.getElementById("memory-detail-time-text");
  if (memory.time) {
    if (timeWrap) timeWrap.style.display = "inline-flex";
    if (timeText) timeText.textContent = memory.time;
  } else if (timeWrap) {
    timeWrap.style.display = "none";
  }

  const locWrap = document.getElementById("memory-detail-location-wrap");
  const locText = document.getElementById("memory-detail-location-text");
  if (memory.location) {
    if (locWrap) locWrap.style.display = "inline-flex";
    if (locText) locText.textContent = memory.location;
  } else if (locWrap) {
    locWrap.style.display = "none";
  }

  // Tags
  const tagsRow = document.getElementById("memory-detail-tags-row");
  const tags = Array.isArray(memory.tags) ? memory.tags : (memory.tags ? String(memory.tags).split(",") : []);
  if (tagsRow) {
    if (tags.length > 0) {
      tagsRow.innerHTML = tags.map((t) => `<span class="memory-tag-chip">#${escapeHtml(t.trim())}</span>`).join("");
      tagsRow.style.display = "flex";
    } else {
      tagsRow.innerHTML = "";
      tagsRow.style.display = "none";
    }
  }

  // Formatted paragraphs for serene reading experience
  const bodyEl = document.getElementById("memory-detail-body-text");
  if (bodyEl) {
    const rawText = memory.journal_text || memory.description || "";
    if (rawText.trim()) {
      const paragraphs = rawText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      bodyEl.innerHTML = paragraphs.map((p) => `<p class="diary-reading-paragraph">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
    } else {
      bodyEl.innerHTML = `<p class="diary-reading-paragraph" style="color: var(--text-tertiary); font-style: italic;">No written reflection recorded for this day.</p>`;
    }
  }

  // Photo Gallery Section
  const gallerySection = document.getElementById("memory-detail-gallery-section");
  const galleryGrid = document.getElementById("memory-detail-gallery-grid");
  const countSpan = document.getElementById("memory-detail-photos-count");

  if (photos.length > 0) {
    if (gallerySection) gallerySection.style.display = "block";
    if (countSpan) countSpan.textContent = photos.length;
    if (galleryGrid) {
      galleryGrid.innerHTML = photos
        .map((pUrl, idx) => `
          <div class="memory-gallery-tile" data-gallery-idx="${idx}" title="Click to open fullscreen view">
            <img src="${escapeHtml(pUrl)}" alt="Photo ${idx + 1}" class="gallery-tile-img" loading="lazy">
          </div>
        `)
        .join("");

      galleryGrid.querySelectorAll(".memory-gallery-tile").forEach((tile) => {
        tile.addEventListener("click", () => {
          const idx = parseInt(tile.dataset.galleryIdx, 10);
          openLightbox(photos, idx);
        });
      });
    }
  } else if (gallerySection) {
    gallerySection.style.display = "none";
  }

  modal.classList.add("active");
}

function closeMemoryDetail() {
  const modal = document.getElementById("memory-detail-modal");
  if (modal) modal.classList.remove("active");
  AppState.currentMemory = null;
}

// ----------------------------------------------------------------------------
// Fullscreen Photo Lightbox Controller
// ----------------------------------------------------------------------------
function openLightbox(photos, startIndex = 0) {
  if (!photos || photos.length === 0) return;
  const modal = document.getElementById("photo-lightbox-modal");
  if (!modal) return;

  AppState.activeLightbox = {
    photos: photos,
    index: Math.max(0, Math.min(startIndex, photos.length - 1)),
  };

  renderLightboxCurrentPhoto();
  modal.classList.add("active");
}

function closeLightbox() {
  const modal = document.getElementById("photo-lightbox-modal");
  if (modal) modal.classList.remove("active");
  AppState.activeLightbox = { photos: [], index: 0 };
}

function renderLightboxCurrentPhoto() {
  const { photos, index } = AppState.activeLightbox;
  if (!photos || photos.length === 0) return;

  const imgEl = document.getElementById("lightbox-active-img");
  const counterEl = document.getElementById("lightbox-counter");
  const prevBtn = document.getElementById("btn-lightbox-prev");
  const nextBtn = document.getElementById("btn-lightbox-next");

  if (imgEl) imgEl.src = photos[index];
  if (counterEl) counterEl.textContent = `${index + 1} of ${photos.length}`;

  if (photos.length > 1) {
    if (prevBtn) prevBtn.style.display = "flex";
    if (nextBtn) nextBtn.style.display = "flex";
    // Preload next and previous images off-thread to ensure instant switching
    const nextIdx = (index + 1) % photos.length;
    const prevIdx = (index - 1 + photos.length) % photos.length;
    const pre1 = new Image(); pre1.src = photos[nextIdx];
    const pre2 = new Image(); pre2.src = photos[prevIdx];
  } else {
    if (prevBtn) prevBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "none";
  }
}

function lightboxNextPhoto() {
  const { photos, index } = AppState.activeLightbox;
  if (!photos || photos.length === 0) return;
  AppState.activeLightbox.index = (index + 1) % photos.length;
  renderLightboxCurrentPhoto();
}

function lightboxPrevPhoto() {
  const { photos, index } = AppState.activeLightbox;
  if (!photos || photos.length === 0) return;
  AppState.activeLightbox.index = (index - 1 + photos.length) % photos.length;
  renderLightboxCurrentPhoto();
}

// ----------------------------------------------------------------------------
// Initialize Journal & Memories Event Listeners
// ----------------------------------------------------------------------------
function initJournalListeners() {
  // Search Memories Input (real-time filter with debounce)
  const searchInput = document.getElementById("memory-search-input");
  if (searchInput) {
    let searchDebounce = null;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        loadMemories(e.target.value.trim());
      }, 250);
    });
  }

  // Create Memory Modal Openers & Closers
  const btnOpenCreate = document.getElementById("btn-open-create-memory");
  const btnHeroWriteToday = document.getElementById("btn-hero-write-today");
  const btnCloseEditor = document.getElementById("btn-close-memory-editor");
  const btnCancelEditor = document.getElementById("btn-cancel-memory-editor");

  if (btnOpenCreate) {
    btnOpenCreate.addEventListener("click", () => {
      openCreateMemoryModal();
    });
  }
  if (btnHeroWriteToday) btnHeroWriteToday.addEventListener("click", () => openCreateMemoryModal(null, false));
  if (btnCloseEditor) btnCloseEditor.addEventListener("click", closeMemoryEditorModal);
  if (btnCancelEditor) btnCancelEditor.addEventListener("click", closeMemoryEditorModal);

  // Date input change in editor: Offer to switch to existing entry for that day
  const dateInput = document.getElementById("memory-input-date");
  if (dateInput) {
    dateInput.addEventListener("change", (e) => {
      const newDate = e.target.value;
      if (!newDate) return;
      const currentEditId = document.getElementById("memory-edit-id").value;
      const existingForDate = (AppState.memories || []).find(
        (m) => m.date === newDate && String(m.id) !== String(currentEditId)
      );
      if (existingForDate) {
        if (confirm(`You already wrote an entry for ${formatMemoryDate(newDate)}: "${existingForDate.title}". Would you like to edit it instead?`)) {
          openEditMemoryModal(existingForDate);
        }
      }
    });
  }

  // 11 Mood Selector Pills
  const moodsPicker = document.getElementById("memory-moods-picker");
  if (moodsPicker) {
    moodsPicker.querySelectorAll(".mood-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        selectEditorMood(pill.dataset.mood);
      });
    });
  }

  // File Upload & Camera Listeners
  const fileInput = document.getElementById("memory-file-input");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      handlePhotoFilesUpload(e.target.files);
      e.target.value = "";
    });
  }

  const cameraInput = document.getElementById("memory-camera-input");
  if (cameraInput) {
    cameraInput.addEventListener("change", (e) => {
      handlePhotoFilesUpload(e.target.files);
      e.target.value = "";
    });
  }

  // Drag and drop photos directly onto the upload preview zone
  const dropZone = document.getElementById("memory-photos-preview-wrap");
  if (dropZone) {
    ["dragenter", "dragover"].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add("drag-over");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove("drag-over");
      });
    });
    dropZone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handlePhotoFilesUpload(e.dataTransfer.files);
      }
    });
  }

  // Form Submission
  const memoryForm = document.getElementById("form-memory-editor");
  if (memoryForm) {
    memoryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const editId = document.getElementById("memory-edit-id").value;
      const title = document.getElementById("memory-input-title").value.trim();
      const date = document.getElementById("memory-input-date").value;
      const time = document.getElementById("memory-input-time").value.trim();
      const location = document.getElementById("memory-input-location").value.trim();
      const mood = document.getElementById("memory-selected-mood").value || "😊 Happy";
      const journalText = document.getElementById("memory-input-text").value.trim();
      const tagsStr = document.getElementById("memory-input-tags").value.trim();

      const tags = tagsStr
        ? tagsStr.split(",").map((t) => t.trim().replace(/^#/, "")).filter((t) => t.length > 0)
        : [];

      // Validate: Title is optional, but user should write something or attach photos
      if (!journalText && !title && (!AppState.editorPhotos || AppState.editorPhotos.length === 0)) {
        showToast("Please write something or attach photos for your diary entry");
        return;
      }
      if (!date) {
        showToast("Please select a date for your diary entry");
        return;
      }

      // If photos are actively uploading, await the upload so no image is lost
      if (AppState.activePhotoUploadPromise) {
        const submitBtn = document.getElementById("btn-submit-memory");
        const prevText = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Saving photos...</span>`;
        }
        await AppState.activePhotoUploadPromise;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = prevText;
        }
      }

      // Ensure all photos are valid URLs and no temporary blob URLs leak into the database
      const sanitizedPhotos = [];
      for (const p of (AppState.editorPhotos || [])) {
        if (p && p.startsWith("blob:")) {
          try {
            const blobRes = await fetch(p);
            const blob = await blobRes.blob();
            const b64 = await new Promise((res) => {
              const r = new FileReader();
              r.onloadend = () => res(r.result);
              r.readAsDataURL(blob);
            });
            sanitizedPhotos.push(b64);
          } catch (_) {}
        } else if (p) {
          sanitizedPhotos.push(p);
        }
      }

      const payload = {
        title: title,
        journal_text: journalText,
        date: date,
        time: time,
        location: location,
        mood: mood,
        photos: sanitizedPhotos,
        tags: tags,
      };

      try {
        const isEdit = Boolean(editId);
        const url = isEdit ? `/api/memories/${editId}` : "/api/memories";
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          closeMemoryEditorModal();
          showToast(isEdit ? "Diary entry updated! ✨" : "Diary entry saved in My Memories! 📖✨");

          if (window.SoundManager && window.SoundManager.playTaskVictory) {
            window.SoundManager.playTaskVictory();
          }

          loadMemories();
          loadDashboard();
        } else {
          showToast("Failed to save entry");
        }
      } catch (err) {
        showToast("Error connecting to server");
      }
    });
  }

  // Memory Detail Modal Buttons
  const btnCloseDetail = document.getElementById("btn-close-memory-detail");
  const btnEditDetail = document.getElementById("btn-edit-memory-detail");
  const btnDeleteDetail = document.getElementById("btn-delete-memory-detail");

  if (btnCloseDetail) btnCloseDetail.addEventListener("click", closeMemoryDetail);
  if (btnEditDetail) {
    btnEditDetail.addEventListener("click", () => {
      if (AppState.currentMemory) openEditMemoryModal(AppState.currentMemory);
    });
  }
  if (btnDeleteDetail) {
    btnDeleteDetail.addEventListener("click", async () => {
      if (!AppState.currentMemory) return;
      if (confirm(`Are you sure you want to delete this diary entry? This action cannot be undone.`)) {
        try {
          const res = await fetch(`/api/memories/${AppState.currentMemory.id}`, { method: "DELETE" });
          if (res.ok) {
            closeMemoryDetail();
            showToast("Diary entry deleted");
            loadMemories();
            loadDashboard();
          }
        } catch (e) {
          showToast("Error deleting memory");
        }
      }
    });
  }

  // Lightbox Buttons
  const btnCloseLb = document.getElementById("btn-close-lightbox");
  const btnPrevLb = document.getElementById("btn-lightbox-prev");
  const btnNextLb = document.getElementById("btn-lightbox-next");

  if (btnCloseLb) btnCloseLb.addEventListener("click", closeLightbox);
  if (btnPrevLb) btnPrevLb.addEventListener("click", lightboxPrevPhoto);
  if (btnNextLb) btnNextLb.addEventListener("click", lightboxNextPhoto);

  // Keyboard Navigation for Lightbox & Modals
  window.addEventListener("keydown", (e) => {
    const lbModal = document.getElementById("photo-lightbox-modal");
    if (lbModal && lbModal.classList.contains("active")) {
      if (e.key === "ArrowLeft") lightboxPrevPhoto();
      if (e.key === "ArrowRight") lightboxNextPhoto();
      if (e.key === "Escape") closeLightbox();
    }
  });

  // Touch Swipe Gesture for Lightbox on Mobile
  const touchStage = document.getElementById("lightbox-touch-stage");
  if (touchStage) {
    let touchStartX = 0;
    touchStage.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    touchStage.addEventListener("touchend", (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchStartX - touchEndX;
      if (diffX > 45) {
        // Swiped Left -> Next
        lightboxNextPhoto();
      } else if (diffX < -45) {
        // Swiped Right -> Prev
        lightboxPrevPhoto();
      }
    }, { passive: true });
  }
}

// ============================================================================
// 9. Global Search Engine (Section 22 - 3)
// ============================================================================
function initSearch() {
  const input = document.getElementById("global-search-input");
  const container = document.getElementById("search-results-container");
  if (!input || !container) return;

  let debounceTimer = null;
  input.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

    if (query.length < 2) {
      container.innerHTML = `
        <div class="empty-state-card">
          <span class="empty-icon">🔍</span>
          <p class="empty-title">Search Daybook</p>
          <p class="empty-subtitle">Type 2 or more characters to search across everything.</p>
        </div>
      `;
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Search failed");
        const results = await res.json();

        const totalCount =
          (results.notes || []).length +
          (results.tasks || []).length +
          (results.projects || []).length +
          (results.journals || []).length;

        if (totalCount === 0) {
          container.innerHTML = `
            <div class="empty-state-card">
              <span class="empty-icon">📂</span>
              <p class="empty-title">No matches found</p>
              <p class="empty-subtitle">Try different keywords or check spelling.</p>
            </div>
          `;
          return;
        }

        let html = "";
        if (results.projects && results.projects.length > 0) {
          html += `<h3 class="section-title" style="margin: 12px 0;">Projects (${results.projects.length})</h3>`;
          html += results.projects
            .map((p) => `<div class="project-card"><h4 class="project-card-title">${escapeHtml(p.title)}</h4><p class="project-card-desc">${escapeHtml(p.description || "")}</p></div>`)
            .join("");
        }

        if (results.notes && results.notes.length > 0) {
          html += `<h3 class="section-title" style="margin: 12px 0;">Notes (${results.notes.length})</h3>`;
          html += results.notes
            .map(
              (n) => `
            <div class="note-card" onclick="if(window.NoteEditor) window.NoteEditor.openEditor('${n.id}')">
              <h4 class="note-card-title">${escapeHtml(n.title)}</h4>
              <p class="note-card-snippet">${escapeHtml((n.content || "").substring(0, 90))}...</p>
            </div>
          `
            )
            .join("");
        }

        if (results.tasks && results.tasks.length > 0) {
          html += `<h3 class="section-title" style="margin: 12px 0;">Tasks (${results.tasks.length})</h3>`;
          html += results.tasks.map((t) => generateTaskItemHtml(t)).join("");
        }

        if (results.journals && results.journals.length > 0) {
          html += `<h3 class="section-title" style="margin: 12px 0;">Journals (${results.journals.length})</h3>`;
          html += results.journals
            .map(
              (j) => `
            <div class="journal-entry-card">
              <span class="journal-entry-date">${escapeHtml(j.entry_date)}</span>
              <p class="journal-entry-body">${escapeHtml(j.content)}</p>
            </div>
          `
            )
            .join("");
        }

        container.innerHTML = html;
        bindTaskCheckboxes(container);
      } catch (err) {
        container.innerHTML = `<p class="empty-subtitle">Error during search</p>`;
      }
    }, 280);
  });
}

// ============================================================================
// 10. Utilities & Health Check
// ============================================================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function verifyBackendStatus() {
  const badge = document.getElementById("badge-backend-status");
  const detail = document.getElementById("status-backend-detail");
  const dbDetail = document.getElementById("status-db-detail");

  try {
    const res = await fetch("/api/health");
    if (res.ok) {
      const data = await res.json();
      if (badge) badge.textContent = "Online";
      if (detail) detail.textContent = `Flask Server v${data.version} connected`;
      if (dbDetail) dbDetail.textContent = data.database_type;
    }
  } catch (err) {
    if (badge) {
      badge.textContent = "Offline";
      badge.className = "badge";
    }
    if (detail) detail.textContent = "Cannot reach server";
  }
}

// ============================================================================
// 10. Quick Capture Inbox Controller (Feature Three)
// ============================================================================
let activeInboxFilter = "inbox";
let activeCaptureType = "task";

function openQuickCaptureModal(defaultType = "task") {
  activeCaptureType = defaultType;
  const modal = document.getElementById("quick-capture-modal");
  const titleInput = document.getElementById("quick-capture-title");
  const notesInput = document.getElementById("quick-capture-notes");
  if (titleInput) titleInput.value = "";
  if (notesInput) notesInput.value = "";

  document.querySelectorAll(".quick-type-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.captureType === activeCaptureType);
  });

  if (modal) {
    modal.classList.add("active");
    setTimeout(() => {
      if (titleInput) titleInput.focus();
    }, 120);
  }
}

function closeQuickCaptureModal() {
  const modal = document.getElementById("quick-capture-modal");
  if (modal) modal.classList.remove("active");
}

function initQuickCapture() {
  // Category Pill click listeners
  document.querySelectorAll(".quick-type-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      activeCaptureType = pill.dataset.captureType;
      document.querySelectorAll(".quick-type-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
    });
  });

  // Close buttons
  const closeBtn = document.getElementById("btn-close-quick-capture");
  if (closeBtn) closeBtn.addEventListener("click", closeQuickCaptureModal);
  const cancelBtn = document.getElementById("btn-cancel-quick-capture");
  if (cancelBtn) cancelBtn.addEventListener("click", closeQuickCaptureModal);

  // Form submission
  const form = document.getElementById("form-quick-capture");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("quick-capture-title").value.trim();
      const notes = document.getElementById("quick-capture-notes").value.trim();
      if (!title) return;

      const payload = {
        title,
        notes,
        item_type: activeCaptureType,
      };

      try {
        const res = await fetch("/api/inbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const item = await res.json();
          showToast("Captured to Inbox ⚡");
          if (window.OfflineStorage && window.OfflineStorage.saveInboxItemLocally) {
            window.OfflineStorage.saveInboxItemLocally(item);
          }
        } else {
          throw new Error("Server error");
        }
      } catch (err) {
        // Offline queue fallback
        if (window.OfflineStorage && window.OfflineStorage.enqueueAction) {
          window.OfflineStorage.enqueueAction("CREATE_INBOX_ITEM", payload);
          showToast("Saved offline to Inbox 📴");
        }
      }

      closeQuickCaptureModal();
      if (AppState.currentView === "view-inbox") {
        loadInbox(activeInboxFilter);
      }
    });
  }

  // Inbox Action trigger button inside view-inbox
  const inboxActionBtn = document.getElementById("btn-inbox-quick-capture-action");
  if (inboxActionBtn) {
    inboxActionBtn.addEventListener("click", () => openQuickCaptureModal());
  }

  // Inbox Filter Tabs
  document.querySelectorAll(".inbox-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".inbox-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeInboxFilter = btn.dataset.inboxFilter;
      loadInbox(activeInboxFilter);
    });
  });

  // Convert modal close & cancel listeners
  const closeConvertBtn = document.getElementById("btn-close-convert-modal");
  if (closeConvertBtn) closeConvertBtn.addEventListener("click", closeInboxConvertModal);
  const cancelConvertBtn = document.getElementById("btn-cancel-convert");
  if (cancelConvertBtn) cancelConvertBtn.addEventListener("click", closeInboxConvertModal);

  // Convert type selector tabs (Task / Note / Project)
  document.querySelectorAll(".convert-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".convert-type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.convertTarget;
      document.getElementById("convert-fields-task").style.display = target === "task" ? "block" : "none";
      document.getElementById("convert-fields-note").style.display = target === "note" ? "block" : "none";
      document.getElementById("convert-fields-project").style.display = target === "project" ? "block" : "none";
    });
  });

  // Convert Form Submit
  const convertForm = document.getElementById("form-convert-inbox");
  if (convertForm) {
    convertForm.addEventListener("submit", handleInboxConvertSubmit);
  }
}

async function loadInbox(filter = activeInboxFilter) {
  const container = document.getElementById("inbox-items-list");
  if (!container) return;

  try {
    const res = await fetch(`/api/inbox?status=${filter}`);
    if (!res.ok) throw new Error("Failed to load inbox");
    const items = await res.json();

    // Update counts
    const unprocCountEl = document.getElementById("inbox-count-unprocessed");
    const allCountEl = document.getElementById("inbox-count-all");
    const unprocRes = await fetch("/api/inbox?status=inbox");
    if (unprocRes.ok) {
      const unprocItems = await unprocRes.json();
      if (unprocCountEl) unprocCountEl.textContent = unprocItems.length;
    }
    const allRes = await fetch("/api/inbox?status=all");
    if (allRes.ok) {
      const allItems = await allRes.json();
      if (allCountEl) allCountEl.textContent = allItems.length;
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="width:100%;">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📥</div>
          <p class="empty-title">Inbox Zero — All Clear!</p>
          <p class="empty-subtitle">Tap "+ Quick Capture" to capture ideas, notes, or tasks at the speed of thought.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map((item) => renderInboxItemCard(item)).join("");
    bindInboxItemEvents(container);
  } catch (err) {
    if (window.OfflineStorage && window.OfflineStorage.getLocalInboxItems) {
      const localItems = await window.OfflineStorage.getLocalInboxItems();
      if (localItems.length > 0) {
        container.innerHTML = localItems.map((item) => renderInboxItemCard(item)).join("");
        bindInboxItemEvents(container);
        return;
      }
    }
    container.innerHTML = `<p class="empty-subtitle">Unable to load inbox items right now.</p>`;
  }
}

function renderInboxItemCard(item) {
  const typeIcons = {
    task: "📋 Task",
    note: "📝 Note",
    idea: "💡 Idea",
    unprocessed: "⚡ Quick Capture",
  };
  const iconLabel = typeIcons[item.item_type] || "⚡ Item";

  let statusBadge = "";
  if (item.status === "processed") {
    statusBadge = `<span class="badge badge-success">✓ Processed (${item.converted_to_type || "Organized"})</span>`;
  } else if (item.status === "archived") {
    statusBadge = `<span class="badge badge-default">Archived</span>`;
  } else {
    statusBadge = `<span class="badge badge-info">Inbox</span>`;
  }

  const createdTime = item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  return `
    <div class="inbox-item-card ${item.status}" data-item-id="${item.id}">
      <div class="inbox-card-top">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="inbox-type-pill">${iconLabel}</span>
          ${statusBadge}
        </div>
        <span class="inbox-time-text">${createdTime}</span>
      </div>

      <h3 class="inbox-item-title">${escapeHtml(item.title)}</h3>
      ${item.notes ? `<p class="inbox-item-notes">${escapeHtml(item.notes)}</p>` : ""}

      <div class="inbox-card-actions">
        ${
          item.status !== "processed"
            ? `<button class="btn btn-sm btn-primary btn-convert-inbox" data-item-id="${item.id}">Convert →</button>`
            : ""
        }
        ${
          item.status === "inbox"
            ? `<button class="btn btn-sm btn-outline btn-mark-processed" data-item-id="${item.id}">Mark Done</button>`
            : `<button class="btn btn-sm btn-outline btn-mark-inbox" data-item-id="${item.id}">Move to Inbox</button>`
        }
        ${
          item.status !== "archived"
            ? `<button class="btn btn-sm btn-outline btn-archive-inbox" data-item-id="${item.id}">Archive</button>`
            : ""
        }
        <button class="btn btn-sm btn-outline btn-danger-soft btn-delete-inbox" data-item-id="${item.id}">Delete</button>
      </div>
    </div>
  `;
}

function bindInboxItemEvents(container) {
  // Convert
  container.querySelectorAll(".btn-convert-inbox").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.itemId;
      openInboxConvertModal(id);
    });
  });

  // Mark done / processed
  container.querySelectorAll(".btn-mark-processed").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.itemId;
      await updateInboxItemStatus(id, "processed");
    });
  });

  // Move to inbox
  container.querySelectorAll(".btn-mark-inbox").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.itemId;
      await updateInboxItemStatus(id, "inbox");
    });
  });

  // Archive
  container.querySelectorAll(".btn-archive-inbox").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.itemId;
      await updateInboxItemStatus(id, "archived");
    });
  });

  // Delete
  container.querySelectorAll(".btn-delete-inbox").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.itemId;
      if (confirm("Delete this inbox item?")) {
        try {
          await fetch(`/api/inbox/${id}`, { method: "DELETE" });
          showToast("Item deleted");
          loadInbox(activeInboxFilter);
        } catch (e) {
          showToast("Failed to delete item");
        }
      }
    });
  });
}

async function updateInboxItemStatus(id, status) {
  try {
    const res = await fetch(`/api/inbox/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      showToast(`Item marked as ${status}`);
      loadInbox(activeInboxFilter);
    }
  } catch (err) {
    showToast("Error updating item status");
  }
}

let activeConvertItem = null;

async function openInboxConvertModal(itemId) {
  try {
    const res = await fetch(`/api/inbox?status=all`);
    const items = await res.json();
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    activeConvertItem = item;
    const modal = document.getElementById("inbox-convert-modal");
    document.getElementById("convert-item-id").value = item.id;
    document.getElementById("convert-input-title").value = item.title;
    document.getElementById("convert-input-desc").value = item.notes || "";

    const dateInput = document.getElementById("convert-task-date");
    if (dateInput) dateInput.value = getLocalDateString(new Date());

    const projSelect = document.getElementById("convert-task-project");
    if (projSelect) {
      projSelect.innerHTML = `<option value="">No Project</option>` + AppState.projectsList.map((p) => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join("");
    }

    const defaultTarget = item.item_type === "note" ? "note" : "task";
    document.querySelectorAll(".convert-type-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.convertTarget === defaultTarget);
    });
    document.getElementById("convert-fields-task").style.display = defaultTarget === "task" ? "block" : "none";
    document.getElementById("convert-fields-note").style.display = defaultTarget === "note" ? "block" : "none";
    document.getElementById("convert-fields-project").style.display = defaultTarget === "project" ? "block" : "none";

    if (modal) modal.classList.add("active");
  } catch (err) {
    showToast("Unable to open conversion dialog");
  }
}

function closeInboxConvertModal() {
  const modal = document.getElementById("inbox-convert-modal");
  if (modal) modal.classList.remove("active");
  activeConvertItem = null;
}

async function handleInboxConvertSubmit(e) {
  e.preventDefault();
  if (!activeConvertItem) return;

  const itemId = activeConvertItem.id;
  const activeBtn = document.querySelector(".convert-type-btn.active");
  const targetType = activeBtn ? activeBtn.dataset.convertTarget : "task";

  const title = document.getElementById("convert-input-title").value.trim();
  const desc = document.getElementById("convert-input-desc").value.trim();

  let targetData = {
    title,
    description: desc,
    content: desc,
  };

  if (targetType === "task") {
    targetData.priority = document.getElementById("convert-task-priority").value;
    targetData.task_date = document.getElementById("convert-task-date").value || getLocalDateString(new Date());
    targetData.project_id = document.getElementById("convert-task-project").value || null;
  } else if (targetType === "note") {
    targetData.tags = document.getElementById("convert-note-tags").value.trim() || "Inbox";
  } else if (targetType === "project") {
    targetData.deadline = document.getElementById("convert-project-deadline").value || null;
  }

  try {
    const res = await fetch(`/api/inbox/${itemId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: targetType,
        target_data: targetData,
      }),
    });

    if (res.ok) {
      showToast(`Converted to ${targetType}! 🎉`);
      closeInboxConvertModal();
      loadInbox(activeInboxFilter);
      loadDashboard();
    } else {
      throw new Error("Conversion failed");
    }
  } catch (err) {
    showToast("Failed to convert item");
  }
}

// ============================================================================
// 11. Victory Sounds & Audio Settings Controller (Feature: Victory Sounds)
// ============================================================================
async function loadSettingsSounds() {
  if (!window.SoundManager) return;

  const sounds = await window.SoundManager.loadSoundsList();
  const isMuted = window.SoundManager.isMuted();
  const volume = window.SoundManager.getVolume();
  const activeTaskId = window.SoundManager.getActiveTaskSoundId();
  const activeMilestoneId = window.SoundManager.getActiveMilestoneSoundId();
  const soundEventMode = window.SoundManager.getSoundEventMode ? window.SoundManager.getSoundEventMode() : "every_task";

  let cachedIds = new Set();
  if (window.OfflineStorage && window.OfflineStorage.getAllCachedAudioIds) {
    try {
      const keys = await window.OfflineStorage.getAllCachedAudioIds();
      cachedIds = new Set(keys);
    } catch (e) {}
  }

  const masterToggle = document.getElementById("pref-victory-sound-toggle");
  if (masterToggle) masterToggle.checked = !isMuted;

  const volumeSlider = document.getElementById("pref-victory-sound-volume");
  const volumeDisplay = document.getElementById("sound-volume-display");
  if (volumeSlider) volumeSlider.value = volume;
  if (volumeDisplay) volumeDisplay.textContent = `${Math.round(volume * 100)}%`;

  const eventModeSelect = document.getElementById("select-sound-event-mode");
  if (eventModeSelect) eventModeSelect.value = soundEventMode;

  const taskSelect = document.getElementById("select-default-task-sound");
  if (taskSelect) {
    taskSelect.innerHTML = sounds
      .map((s) => `<option value="${s.id}" ${s.id === activeTaskId ? "selected" : ""}>${escapeHtml(s.title)} (${s.file_format.toUpperCase()})</option>`)
      .join("");
  }

  const milestoneSelect = document.getElementById("select-default-milestone-sound");
  if (milestoneSelect) {
    milestoneSelect.innerHTML = `<option value="">Same as Task Sound</option>` + sounds
      .map((s) => `<option value="${s.id}" ${s.id === activeMilestoneId ? "selected" : ""}>${escapeHtml(s.title)} (${s.file_format.toUpperCase()})</option>`)
      .join("");
  }

  const grid = document.getElementById("sound-library-grid");
  const countBadge = document.getElementById("sound-library-count");
  if (countBadge) countBadge.textContent = `${sounds.length} Sound${sounds.length === 1 ? "" : "s"}`;

  if (grid) {
    grid.innerHTML = sounds.map((s) => renderSoundCard(s, activeTaskId, activeMilestoneId, cachedIds)).join("");
    bindSoundCardEvents(grid);
  }
}

function renderSoundCard(sound, activeTaskId, activeMilestoneId, cachedIds = new Set()) {
  const isDefaultTask = sound.id === activeTaskId;
  const isDefaultMilestone = sound.id === activeMilestoneId;
  const isBuiltIn = sound.id.startsWith("sound_") || sound.id === "default_victory";
  const durationText = sound.duration ? `${sound.duration.toFixed(1)}s` : "< 2s";
  const sizeKb = sound.file_size ? `${Math.round(sound.file_size / 1024)} KB` : "";
  const isCached = cachedIds.has(sound.id);

  return `
    <div class="sound-library-card ${isDefaultTask ? "active-task" : ""}" data-sound-id="${sound.id}">
      <div class="sound-card-header">
        <div class="sound-card-title-group">
          <strong class="sound-title-text">${escapeHtml(sound.title)}</strong>
          <div class="sound-badges-row">
            <span class="badge badge-info">${sound.file_format.toUpperCase()}</span>
            <span class="sound-meta-text">${durationText} ${sizeKb ? `• ${sizeKb}` : ""}</span>
            ${isBuiltIn ? `<span class="badge badge-default">Built-in</span>` : `<span class="badge badge-success">Custom</span>`}
            ${isCached ? `<span class="badge badge-success" title="Cached in IndexedDB for 100% offline play">💾 Offline Ready</span>` : `<span class="badge badge-default" title="Available in cloud">☁️ Cloud</span>`}
            ${isDefaultTask ? `<span class="badge badge-success">✓ Task Default</span>` : ""}
            ${isDefaultMilestone ? `<span class="badge badge-info">✓ Milestone</span>` : ""}
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-outline btn-sound-preview" data-sound-path="${sound.file_path}" title="Preview Sound">
          ▶ Play
        </button>
      </div>

      <div class="sound-card-footer">
        <div style="display:flex; gap:6px; align-items:center;">
          <button type="button" class="btn-sound-action btn-set-default" data-sound-id="${sound.id}">
            ${isDefaultTask ? "Active Task Sound" : "Set as Task Sound"}
          </button>
          ${!isCached ? `<button type="button" class="btn-sound-action btn-cache-sound" data-sound-id="${sound.id}" title="Make available offline">⬇️ Save Offline</button>` : ""}
        </div>
        ${
          !isBuiltIn
            ? `
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-sound-action btn-replace-sound" data-sound-id="${sound.id}" data-sound-title="${escapeHtml(sound.title)}" title="Replace audio file">🔄 Replace</button>
            <button type="button" class="btn-sound-action btn-rename-sound" data-sound-id="${sound.id}" title="Rename">✏️ Rename</button>
            <button type="button" class="btn-sound-action danger btn-delete-sound" data-sound-id="${sound.id}" title="Delete">🗑️ Delete</button>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
}

function bindSoundCardEvents(grid) {
  // Preview
  grid.querySelectorAll(".btn-sound-preview").forEach((btn) => {
    btn.addEventListener("click", () => {
      const path = btn.dataset.soundPath;
      if (window.SoundManager) {
        window.SoundManager.previewSound(path);
        btn.textContent = "🔊 Playing...";
        setTimeout(() => {
          btn.textContent = "▶ Play";
        }, 1200);
      }
    });
  });

  // Set default task sound
  grid.querySelectorAll(".btn-set-default").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const soundId = btn.dataset.soundId;
      if (window.SoundManager) {
        window.SoundManager.setActiveTaskSoundId(soundId);
        showToast("Set as task completion sound! 🎵");
        loadSettingsSounds();
      }
    });
  });

  // Offline cache download
  grid.querySelectorAll(".btn-cache-sound").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const soundId = btn.dataset.soundId;
      btn.textContent = "⏳ Saving...";
      btn.disabled = true;
      try {
        if (window.SoundManager && window.SoundManager.downloadAndCacheSound) {
          await window.SoundManager.downloadAndCacheSound(soundId);
          showToast("Sound cached for offline playback! 💾");
          loadSettingsSounds();
        }
      } catch (e) {
        showToast("Failed to cache sound offline");
        btn.disabled = false;
        btn.textContent = "⬇️ Save Offline";
      }
    });
  });

  // Replace audio file
  grid.querySelectorAll(".btn-replace-sound").forEach((btn) => {
    btn.addEventListener("click", () => {
      const soundId = btn.dataset.soundId;
      const soundTitle = btn.dataset.soundTitle || "";
      openSoundUploadModal(soundId, soundTitle);
    });
  });

  // Rename
  grid.querySelectorAll(".btn-rename-sound").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const soundId = btn.dataset.soundId;
      const newTitle = prompt("Enter new name for this sound:");
      if (newTitle && newTitle.trim()) {
        try {
          await window.SoundManager.updateSound(soundId, { title: newTitle.trim() });
          showToast("Sound renamed! ✅");
          loadSettingsSounds();
        } catch (e) {
          showToast("Failed to rename sound");
        }
      }
    });
  });

  // Delete
  grid.querySelectorAll(".btn-delete-sound").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const soundId = btn.dataset.soundId;
      if (confirm("Delete this custom sound from your library?")) {
        try {
          await window.SoundManager.deleteSound(soundId);
          showToast("Sound deleted! 🗑️");
          loadSettingsSounds();
        } catch (e) {
          showToast("Failed to delete sound");
        }
      }
    });
  });
}

function initSoundLibrary() {
  const masterToggle = document.getElementById("pref-victory-sound-toggle");
  if (masterToggle) {
    masterToggle.addEventListener("change", (e) => {
      if (window.SoundManager) {
        window.SoundManager.setMuted(!e.target.checked);
        showToast(e.target.checked ? "Victory sounds enabled 🔊" : "Victory sounds muted 🔇");
      }
    });
  }

  const volumeSlider = document.getElementById("pref-victory-sound-volume");
  const volumeDisplay = document.getElementById("sound-volume-display");
  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (volumeDisplay) volumeDisplay.textContent = `${Math.round(val * 100)}%`;
      if (window.SoundManager) window.SoundManager.setVolume(val);
    });
  }

  const testVolBtn = document.getElementById("btn-test-sound-volume");
  if (testVolBtn) {
    testVolBtn.addEventListener("click", () => {
      if (window.SoundManager) {
        const activeId = window.SoundManager.getActiveTaskSoundId();
        window.SoundManager.previewSound(activeId);
      }
    });
  }

  const eventModeSelect = document.getElementById("select-sound-event-mode");
  if (eventModeSelect) {
    eventModeSelect.addEventListener("change", (e) => {
      if (window.SoundManager && window.SoundManager.setSoundEventMode) {
        window.SoundManager.setSoundEventMode(e.target.value);
        showToast("Celebration trigger mode updated");
      }
    });
  }

  const taskSelect = document.getElementById("select-default-task-sound");
  if (taskSelect) {
    taskSelect.addEventListener("change", (e) => {
      if (window.SoundManager) {
        window.SoundManager.setActiveTaskSoundId(e.target.value);
        showToast("Default task sound updated");
        loadSettingsSounds();
      }
    });
  }

  const previewTaskBtn = document.getElementById("btn-preview-task-sound");
  if (previewTaskBtn) {
    previewTaskBtn.addEventListener("click", () => {
      if (taskSelect && taskSelect.value && window.SoundManager) {
        window.SoundManager.previewSound(taskSelect.value);
      }
    });
  }

  const milestoneSelect = document.getElementById("select-default-milestone-sound");
  if (milestoneSelect) {
    milestoneSelect.addEventListener("change", (e) => {
      if (window.SoundManager) {
        window.SoundManager.setActiveMilestoneSoundId(e.target.value || null);
        showToast("Milestone sound updated");
        loadSettingsSounds();
      }
    });
  }

  const previewMilestoneBtn = document.getElementById("btn-preview-milestone-sound");
  if (previewMilestoneBtn) {
    previewMilestoneBtn.addEventListener("click", () => {
      const targetId = (milestoneSelect && milestoneSelect.value) || (taskSelect && taskSelect.value);
      if (targetId && window.SoundManager) {
        window.SoundManager.previewSound(targetId);
      }
    });
  }

  const uploadOpenBtn = document.getElementById("btn-open-sound-upload");
  if (uploadOpenBtn) {
    uploadOpenBtn.addEventListener("click", () => openSoundUploadModal());
  }

  const closeSoundModalBtn = document.getElementById("btn-close-sound-modal");
  if (closeSoundModalBtn) closeSoundModalBtn.addEventListener("click", closeSoundUploadModal);
  const cancelSoundModalBtn = document.getElementById("btn-cancel-sound-upload");
  if (cancelSoundModalBtn) cancelSoundModalBtn.addEventListener("click", closeSoundUploadModal);

  const filePicker = document.getElementById("sound-file-picker");
  let selectedAudioFile = null;
  let localPreviewController = null;

  if (filePicker) {
    filePicker.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const validation = window.SoundManager.validateAudioFile(file);
      if (!validation.valid) {
        showToast(validation.error);
        filePicker.value = "";
        return;
      }

      selectedAudioFile = file;

      const previewCard = document.getElementById("sound-file-preview-card");
      const nameEl = document.getElementById("sound-preview-filename");
      const metaEl = document.getElementById("sound-preview-meta");
      const titleInput = document.getElementById("sound-custom-title");

      if (nameEl) nameEl.textContent = file.name;
      if (titleInput && !titleInput.value) {
        titleInput.value = file.name.replace(/\.[^/.]+$/, "");
      }

      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      if (metaEl) metaEl.textContent = `${sizeMb} MB • Detecting duration...`;
      if (previewCard) previewCard.style.display = "flex";

      const tempAudio = new Audio(URL.createObjectURL(file));
      tempAudio.addEventListener("loadedmetadata", () => {
        if (metaEl) metaEl.textContent = `${sizeMb} MB • ${tempAudio.duration.toFixed(1)}s`;
      });
    });
  }

  const localPreviewBtn = document.getElementById("btn-preview-local-sound");
  if (localPreviewBtn) {
    localPreviewBtn.addEventListener("click", () => {
      if (!selectedAudioFile) return;
      if (localPreviewController) {
        localPreviewController.stop();
        localPreviewController = null;
        localPreviewBtn.textContent = "▶ Play Preview";
        return;
      }

      localPreviewController = window.SoundManager.previewLocalFile(selectedAudioFile);
      localPreviewBtn.textContent = "⏹ Stop Preview";
      if (localPreviewController && localPreviewController.audio) {
        localPreviewController.audio.onended = () => {
          localPreviewBtn.textContent = "▶ Play Preview";
          localPreviewController = null;
        };
      }
    });
  }

  const soundForm = document.getElementById("form-upload-sound");
  if (soundForm) {
    soundForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedAudioFile) {
        showToast("Please choose an audio file first.");
        return;
      }

      const replaceId = document.getElementById("sound-replace-id") ? document.getElementById("sound-replace-id").value : "";
      const title = document.getElementById("sound-custom-title").value.trim() || selectedAudioFile.name;
      const eventTrigger = document.getElementById("sound-event-trigger") ? document.getElementById("sound-event-trigger").value : "task_complete";
      const isDefault = document.getElementById("sound-set-default") ? document.getElementById("sound-set-default").checked : false;

      const submitBtn = document.getElementById("btn-submit-sound-upload");
      const progressWrap = document.getElementById("sound-upload-progress-wrap");
      const progressFill = document.getElementById("sound-upload-progress-fill");
      const statusText = document.getElementById("sound-upload-status-text");

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = replaceId ? "Replacing..." : "Uploading...";
      }
      if (progressWrap) progressWrap.style.display = "block";
      if (progressFill) progressFill.style.width = "70%";
      if (statusText) statusText.textContent = replaceId ? "Replacing audio file..." : "Uploading audio to library...";

      try {
        if (replaceId) {
          await window.SoundManager.replaceSound(replaceId, selectedAudioFile);
          showToast("Audio replaced successfully! 🎵");
        } else {
          await window.SoundManager.uploadSound(selectedAudioFile, title, eventTrigger, isDefault);
          showToast("Audio uploaded to Sound Library! 🎵");
        }
        if (progressFill) progressFill.style.width = "100%";
        closeSoundUploadModal();
        loadSettingsSounds();
      } catch (err) {
        showToast(err.message || "Failed to process audio.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = replaceId ? "Replace Audio File" : "Save to Sound Library";
        }
        if (progressWrap) progressWrap.style.display = "none";
        selectedAudioFile = null;
      }
    });
  }
}

function openSoundUploadModal(replaceId = null, soundTitle = "") {
  const modal = document.getElementById("sound-upload-modal");
  const form = document.getElementById("form-upload-sound");
  if (form) form.reset();

  const replaceInput = document.getElementById("sound-replace-id");
  const eyebrowEl = document.getElementById("sound-modal-eyebrow");
  const titleEl = document.getElementById("sound-modal-title");
  const promptText = document.getElementById("sound-picker-prompt-text");
  const submitBtn = document.getElementById("btn-submit-sound-upload");
  const optionsRow = document.getElementById("sound-options-row");
  const titleInput = document.getElementById("sound-custom-title");
  const previewCard = document.getElementById("sound-file-preview-card");
  const progressWrap = document.getElementById("sound-upload-progress-wrap");

  if (previewCard) previewCard.style.display = "none";
  if (progressWrap) progressWrap.style.display = "none";

  if (replaceId) {
    if (replaceInput) replaceInput.value = replaceId;
    if (eyebrowEl) eyebrowEl.textContent = "REPLACE AUDIO FILE";
    if (titleEl) titleEl.textContent = `Replace Audio: ${soundTitle || "Sound"}`;
    if (promptText) promptText.textContent = "Choose replacement audio file from device";
    if (submitBtn) submitBtn.textContent = "Replace Audio File";
    if (titleInput) titleInput.value = soundTitle;
    if (optionsRow) optionsRow.style.display = "none";
  } else {
    if (replaceInput) replaceInput.value = "";
    if (eyebrowEl) eyebrowEl.textContent = "CUSTOM AUDIO";
    if (titleEl) titleEl.textContent = "Upload Victory Sound";
    if (promptText) promptText.textContent = "Choose an audio file from your device";
    if (submitBtn) submitBtn.textContent = "Save to Sound Library";
    if (titleInput) titleInput.value = "";
    if (optionsRow) optionsRow.style.display = "flex";
  }

  if (modal) modal.classList.add("active");
}

function closeSoundUploadModal() {
  const modal = document.getElementById("sound-upload-modal");
  const replaceInput = document.getElementById("sound-replace-id");
  if (replaceInput) replaceInput.value = "";
  if (modal) modal.classList.remove("active");
}

// ============================================================================
// 12. User Profile & Onboarding Controller (Section 7, 8, 9, 10)
// ============================================================================
function getUserProfile() {
  let name = localStorage.getItem("daybook_user_name") || "";
  let age = localStorage.getItem("daybook_user_age") || "";
  if (!name && AppState.preferences && AppState.preferences.user_name) {
    name = AppState.preferences.user_name;
    localStorage.setItem("daybook_user_name", name);
  }
  if (!age && AppState.preferences && AppState.preferences.user_age) {
    age = String(AppState.preferences.user_age);
    localStorage.setItem("daybook_user_age", age);
  }
  return { name: name.trim(), age: age.trim() };
}

async function saveUserProfile(name, age) {
  name = (name || "").trim();
  age = (age || "").trim();

  localStorage.setItem("daybook_user_name", name);
  if (age) {
    localStorage.setItem("daybook_user_age", age);
  } else {
    localStorage.removeItem("daybook_user_age");
  }

  if (!AppState.preferences) AppState.preferences = {};
  AppState.preferences.user_name = name;
  AppState.preferences.user_age = age ? parseInt(age, 10) : null;

  try {
    const response = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_name: name,
        user_age: age ? parseInt(age, 10) : null,
      }),
    });
    if (!response.ok) {
      let detail = "";
      try { detail = (await response.json()).error || ""; } catch (_) {}
      throw new Error(detail || `Profile save failed (${response.status})`);
    }
  } catch (err) {
    console.warn("Failed to persist user profile to backend:", err);
  }

  applyUserProfile(name, age);
}

function applyUserProfile(name, age) {
  // Update Settings Profile display
  const nameDisplay = document.getElementById("settings-profile-name-display") || document.getElementById("profile-settings-name-val");
  const ageDisplay = document.getElementById("settings-profile-age-display") || document.getElementById("profile-settings-age-val");
  if (nameDisplay) nameDisplay.textContent = name || "Not set";
  if (ageDisplay) ageDisplay.textContent = age ? `Age: ${age}` : "Age: Not set";

  // Update profile/avatar initials wherever they are rendered.
  const topAvatar = document.getElementById("top-avatar-initial");
  const settingsAvatar = document.getElementById("settings-profile-avatar");
  const initial = name ? name.charAt(0).toUpperCase() : "D";
  if (topAvatar) topAvatar.textContent = initial;
  if (settingsAvatar) settingsAvatar.textContent = initial;

  // Update dynamic greeting on Home
  if (window.refreshLiveClockGreeting) {
    window.refreshLiveClockGreeting();
  }

  // Update Dashboard header if visible
  const dashTitle = document.getElementById("analytics-dashboard-title");
  if (dashTitle) {
    dashTitle.textContent = name ? `${name}'s Progress` : "Your Progress";
  }
}

function initUserProfile() {
  const profile = getUserProfile();
  if (profile.name) {
    applyUserProfile(profile.name, profile.age);
  } else {
    // Show first-time onboarding modal
    const onboardingModal = document.getElementById("first-time-onboarding-modal");
    if (onboardingModal) {
      onboardingModal.classList.add("active");
    }
  }

  // Onboarding Form
  const onboardingForm = document.getElementById("form-first-time-onboarding");
  if (onboardingForm) {
    // Disable native HTML5 validation to prevent it from blocking our JS handler
    onboardingForm.setAttribute("novalidate", "true");

    const handleOnboardingSubmit = async (e) => {
      if (e) e.preventDefault();
      const nameInput = document.getElementById("onboarding-user-name") || document.getElementById("onboarding-input-name");
      const ageInput = document.getElementById("onboarding-user-age") || document.getElementById("onboarding-input-age");
      const name = nameInput ? nameInput.value.trim() : "";
      const age = ageInput ? ageInput.value.trim() : "";

      console.log("[Onboarding] name:", JSON.stringify(name), "age:", JSON.stringify(age));

      if (!name) {
        showToast("Please enter your name");
        if (nameInput) nameInput.focus();
        return;
      }

      await saveUserProfile(name, age);
      const modal = document.getElementById("first-time-onboarding-modal");
      if (modal) modal.classList.remove("active");
      applyUserProfile(name, age);
      showToast(`Welcome to Daybook, ${name}! 👋`);
    };

    onboardingForm.addEventListener("submit", handleOnboardingSubmit);

    // Fallback: direct click handler on the continue button
    const continueBtn = document.getElementById("btn-onboarding-continue");
    if (continueBtn) {
      continueBtn.addEventListener("click", (e) => {
        // If the form submit event didn't fire (e.g. due to native validation), handle it here
        e.preventDefault();
        e.stopPropagation();
        handleOnboardingSubmit(null);
      });
    }
  }

  // Edit Profile in Settings
  const btnOpenEdit = document.getElementById("btn-edit-profile-trigger") || document.getElementById("btn-open-edit-profile");
  const editModal = document.getElementById("edit-profile-modal");
  const btnCloseEdit = document.getElementById("btn-close-edit-profile");
  const btnCancelEdit = document.getElementById("btn-cancel-edit-profile");
  const formEdit = document.getElementById("form-edit-profile");

  if (btnOpenEdit && editModal) {
    btnOpenEdit.addEventListener("click", () => {
      const p = getUserProfile();
      const inName = document.getElementById("edit-profile-name") || document.getElementById("edit-input-name");
      const inAge = document.getElementById("edit-profile-age") || document.getElementById("edit-input-age");
      if (inName) inName.value = p.name;
      if (inAge) inAge.value = p.age;
      editModal.classList.add("active");
      if (inName) inName.focus();
    });
  }

  if (btnCloseEdit && editModal) {
    btnCloseEdit.addEventListener("click", () => editModal.classList.remove("active"));
  }
  if (btnCancelEdit && editModal) {
    btnCancelEdit.addEventListener("click", () => editModal.classList.remove("active"));
  }

  if (formEdit && editModal) {
    formEdit.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inName = document.getElementById("edit-profile-name") || document.getElementById("edit-input-name");
      const inAge = document.getElementById("edit-profile-age") || document.getElementById("edit-input-age");
      const name = inName ? inName.value.trim() : "";
      const age = inAge ? inAge.value.trim() : "";

      if (!name) {
        showToast("Please enter your name");
        return;
      }

      await saveUserProfile(name, age);
      editModal.classList.remove("active");
      showToast("Profile updated successfully ✨");
    });
  }
}

// ============================================================================
// 13. Dashboard Analytics Controller (5th Navigation Item)
// ============================================================================
function getConsistencyLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Very Good";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs Improvement";
  return "Build Your Routine";
}

async function loadAnalyticsDashboard() {
  try {
    const res = await fetch("/api/analytics");
    if (!res.ok) throw new Error("Failed to load analytics");
    const data = await res.json();
    AppState.analyticsData = data;
    renderAnalyticsDashboard(data);
  } catch (err) {
    console.error("Analytics load error:", err);
    renderAnalyticsDashboard(null);
  }
}

function renderAnalyticsDashboard(data) {
  const profile = getUserProfile();
  const dashTitle = document.getElementById("analytics-dashboard-title") || document.getElementById("analytics-header-title");
  if (dashTitle) {
    dashTitle.textContent = profile.name ? `${profile.name}'s Progress` : "Your Progress";
  }

  const emptyState = document.getElementById("analytics-empty-state");
  const statsWrap = document.getElementById("analytics-stats-content") || document.getElementById("analytics-content-container");

  // Empty state button
  const startBtn = document.getElementById("btn-analytics-start-task");
  if (startBtn && !startBtn.dataset.bound) {
    startBtn.dataset.bound = "true";
    startBtn.addEventListener("click", () => switchView("view-tasks"));
  }

  if (!data) {
    if (emptyState) emptyState.style.display = "block";
    if (statsWrap) statsWrap.style.display = "none";
    return;
  }

  const { weekly, monthly, streaks } = data;
  const hasAnyTasks = (weekly.planned > 0 || monthly.planned > 0 || (data.has_data === true));

  if (!hasAnyTasks) {
    if (emptyState) emptyState.style.display = "block";
  } else {
    if (emptyState) emptyState.style.display = "none";
  }
  if (statsWrap) statsWrap.style.display = "grid";

  // 1. Top Summary Cards
  const topWeekly = document.getElementById("stat-weekly-consistency") || document.getElementById("dash-summary-weekly-consistency");
  const topMonthly = document.getElementById("stat-monthly-consistency") || document.getElementById("dash-summary-monthly-consistency");
  const topCurrent = document.getElementById("stat-current-streak") || document.getElementById("dash-summary-current-streak");
  const topBest = document.getElementById("stat-best-streak") || document.getElementById("dash-summary-best-streak");

  const topWeeklyLabel = document.getElementById("stat-weekly-label");
  const topMonthlyLabel = document.getElementById("stat-monthly-label");

  const weeklyScore = Math.round(weekly.consistency_score || 0);
  const monthlyScore = Math.round(monthly.consistency_score || 0);

  if (topWeekly) topWeekly.textContent = `${weeklyScore}%`;
  if (topMonthly) topMonthly.textContent = `${monthlyScore}%`;
  if (topCurrent) topCurrent.textContent = `${streaks.current_streak || 0} Day${streaks.current_streak === 1 ? "" : "s"}`;
  if (topBest) topBest.textContent = `${streaks.best_streak || 0} Day${streaks.best_streak === 1 ? "" : "s"}`;

  const weekLabelText = weekly.consistency_label || getConsistencyLabel(weeklyScore);
  const monthLabelText = monthly.consistency_label || getConsistencyLabel(monthlyScore);

  if (topWeeklyLabel) topWeeklyLabel.textContent = weekLabelText;
  if (topMonthlyLabel) topMonthlyLabel.textContent = monthLabelText;

  // 2. This Week Section
  const weekCircleBar = document.getElementById("weekly-circle-bar");
  const weekScoreText = document.getElementById("weekly-score-text");
  const weekScoreLabel = document.getElementById("weekly-score-label");
  const weekStreakBadge = document.getElementById("weekly-streak-badge");

  if (weekCircleBar) {
    const circ = 301.6;
    const offset = circ * (1 - weeklyScore / 100);
    weekCircleBar.style.strokeDashoffset = offset;
  }
  if (weekScoreText) weekScoreText.textContent = `${weeklyScore}%`;
  if (weekScoreLabel) weekScoreLabel.textContent = weekLabelText;
  if (weekStreakBadge) weekStreakBadge.textContent = `🔥 ${streaks.current_streak || 0} Day${streaks.current_streak === 1 ? "" : "s"} Streak`;

  const weekPlanned = document.getElementById("metric-week-planned");
  const weekTasksRatio = document.getElementById("metric-week-completed") || document.getElementById("analytics-week-tasks-ratio");
  const weekMissed = document.getElementById("metric-week-missed") || document.getElementById("analytics-week-missed");
  const weekCurrentStreak = document.getElementById("metric-week-streak") || document.getElementById("analytics-week-current-streak");
  const weekBestStreak = document.getElementById("analytics-week-best-streak");
  const weekProgressBar = document.getElementById("analytics-week-progress-bar");

  const wPlanned = weekly.planned ?? 0;
  const wCompleted = weekly.completed ?? 0;
  const wMissed = weekly.missed ?? 0;

  if (weekPlanned) weekPlanned.textContent = wPlanned;
  if (weekTasksRatio) weekTasksRatio.textContent = `${wCompleted} / ${wPlanned}`;
  if (weekMissed) weekMissed.textContent = wMissed;
  if (weekCurrentStreak) weekCurrentStreak.textContent = `${streaks.current_streak || 0} Day${streaks.current_streak === 1 ? "" : "s"}`;
  if (weekBestStreak) weekBestStreak.textContent = `${streaks.best_streak || 0} Day${streaks.best_streak === 1 ? "" : "s"}`;
  if (weekProgressBar) weekProgressBar.style.width = `${weeklyScore}%`;

  // Weekly Mon–Sun Visualization Grid
  const weeklyGrid = document.getElementById("weekly-days-grid") || document.getElementById("analytics-weekly-days-grid");
  if (weeklyGrid && Array.isArray(weekly.days)) {
    weeklyGrid.innerHTML = weekly.days
      .map((d) => {
        let icon = "⭘";
        let statusClass = "status-upcoming";
        if (d.status === "completed") {
          icon = "✅";
          statusClass = "status-completed";
        } else if (d.status === "missed") {
          icon = "❌";
          statusClass = "status-missed";
        } else if (d.status === "in_progress") {
          icon = "⏳";
          statusClass = "status-progress";
        }
        const isToday = d.is_today ? " is-today" : "";
        return `
          <div class="weekly-day-cell ${statusClass}${isToday}" title="${d.day_name} (${d.date}): ${d.completed_tasks}/${d.total_tasks} tasks">
            <span class="weekly-day-name">${d.day_name}</span>
            <span class="weekly-day-status">${icon}</span>
            <span class="weekly-day-date">${d.date.split("-")[2]}</span>
          </div>
        `;
      })
      .join("");
  }

  // 3. This Month Section
  const monthCircleBar = document.getElementById("monthly-circle-bar");
  const monthScoreText = document.getElementById("monthly-score-text");
  const monthScoreLabel = document.getElementById("monthly-score-label");
  const monthStreakBadge = document.getElementById("monthly-streak-badge");

  if (monthCircleBar) {
    const circ = 301.6;
    const offset = circ * (1 - monthlyScore / 100);
    monthCircleBar.style.strokeDashoffset = offset;
  }
  if (monthScoreText) monthScoreText.textContent = `${monthlyScore}%`;
  if (monthScoreLabel) monthScoreLabel.textContent = monthLabelText;
  if (monthStreakBadge) monthStreakBadge.textContent = `⭐ ${streaks.best_streak || 0} Day${streaks.best_streak === 1 ? "" : "s"} Record`;

  const monthPlanned = document.getElementById("metric-month-planned");
  const monthTasksRatio = document.getElementById("metric-month-completed") || document.getElementById("analytics-month-tasks-ratio");
  const monthMissed = document.getElementById("metric-month-missed") || document.getElementById("analytics-month-missed");
  const monthActiveDays = document.getElementById("metric-month-active-days") || document.getElementById("analytics-month-active-days");
  const monthBestStreak = document.getElementById("metric-month-best-streak") || document.getElementById("analytics-month-best-streak");
  const monthProgressBar = document.getElementById("analytics-month-progress-bar");

  const mPlanned = monthly.planned ?? 0;
  const mCompleted = monthly.completed ?? 0;
  const mMissed = monthly.missed ?? 0;

  if (monthPlanned) monthPlanned.textContent = mPlanned;
  if (monthTasksRatio) monthTasksRatio.textContent = `${mCompleted} / ${mPlanned}`;
  if (monthMissed) monthMissed.textContent = mMissed;
  if (monthActiveDays) monthActiveDays.textContent = `${monthly.active_days || 0} Day${monthly.active_days === 1 ? "" : "s"}`;
  if (monthBestStreak) monthBestStreak.textContent = `${streaks.best_streak || 0} Day${streaks.best_streak === 1 ? "" : "s"}`;
  if (monthProgressBar) monthProgressBar.style.width = `${monthlyScore}%`;

  // Update monthly heatmap header title
  const heatmapTitle = document.getElementById("monthly-heatmap-title");
  if (heatmapTitle && monthly.month_name) {
    heatmapTitle.textContent = `${monthly.month_name} Heatmap`;
  }

  // Monthly Calendar Heatmap Grid
  const heatmapGrid = document.getElementById("monthly-heatmap-grid") || document.getElementById("analytics-monthly-heatmap-grid");
  if (heatmapGrid && Array.isArray(monthly.heatmap)) {
    let blanks = "";
    const offsetDays = monthly.first_weekday || 0;
    for (let i = 0; i < offsetDays; i++) {
      blanks += `<div class="heatmap-cell heatmap-blank"></div>`;
    }

    const cells = monthly.heatmap
      .map((d) => {
        const isToday = d.is_today ? " is-today" : "";
        return `
          <div class="heatmap-cell level-${d.level}${isToday}" title="Day ${d.day_number} (${d.date}): ${d.completed_tasks}/${d.total_tasks} completed">
            <span class="heatmap-day-number">${d.day_number}</span>
          </div>
        `;
      })
      .join("");

    heatmapGrid.innerHTML = blanks + cells;
  }
}

// ============================================================================
// 14. Terms & Conditions Modal Controller
// ============================================================================
function initTermsModal() {
  const termsModal = document.getElementById("terms-conditions-modal");
  const btnOpen = document.getElementById("btn-settings-terms");
  const btnClose = document.getElementById("btn-close-terms-modal");
  const btnCloseBottom = document.getElementById("btn-close-terms-bottom");

  if (btnOpen && termsModal) {
    btnOpen.addEventListener("click", () => {
      termsModal.classList.add("active");
    });
  }

  if (btnClose && termsModal) {
    btnClose.addEventListener("click", () => {
      termsModal.classList.remove("active");
    });
  }

  if (btnCloseBottom && termsModal) {
    btnCloseBottom.addEventListener("click", () => {
      termsModal.classList.remove("active");
    });
  }

  if (termsModal) {
    termsModal.addEventListener("click", (e) => {
      if (e.target === termsModal) termsModal.classList.remove("active");
    });
  }
}

// ============================================================================
// 15. Application Initialization
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initLiveClock();
  initQuickCreateMenu();
  initTasksListeners();
  initProjectsListeners();
  initNotesListeners();
  initJournalListeners();
  initSearch();
  initQuickCapture();
  initSoundLibrary();
  initUserProfile();
  initTermsModal();

  // Initialize Theme Engine
  if (window.ThemeManager) {
    window.ThemeManager.init();
  }

  // Initialize Reusable Block Note Editor
  if (window.NoteEditor) {
    window.NoteEditor.init();
  }

  // Initialize Animal Companion Gallery
  if (window.CompanionManager) {
    window.CompanionManager.init();
  }

  // Initialize Victory Sounds Engine
  if (window.SoundManager) {
    window.SoundManager.init();
  }

  // Initialize Offline & Sync Network Watchers
  if (window.OfflineStorage) {
    window.OfflineStorage.initNetworkWatchers(window.DaybookConfig ? window.DaybookConfig.getBaseUrl() : "");
  }

  // Initial Data Loads
  loadDashboard();
  verifyBackendStatus();

  // Initial hash routing (e.g. http://localhost:5000/#view-settings)
  if (window.location.hash) {
    const initialView = window.location.hash.replace("#", "");
    if (initialView && document.getElementById(initialView)) {
      switchView(initialView);
    }
  }

  console.log("🚀 Daybook v1.3.0 Initialized with Dashboard Analytics & Health & Wellness!");
});
