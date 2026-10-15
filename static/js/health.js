/**
 * Daybook - Health & Wellness Module
 * Rule-based daily movement, strength, nutrition, and wellness tracker.
 * Fully local, offline-ready, zero external APIs.
 */

(function () {
  "use strict";

  const STORAGE_PREFS_KEY = "daybook_health_prefs";
  const STORAGE_PLAN_PREFIX = "daybook_health_plan_";
  const STORAGE_HISTORY_KEY = "daybook_health_history";

  function getTodayDateStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const HealthManager = {
    todayDate: getTodayDateStr(),
    prefs: null,
    todayPlan: null,

    init() {
      this.todayDate = getTodayDateStr();
      this.loadPrefs();
      this.loadTodayPlan();
      this.renderCard();
      this.bindGlobalEvents();
    },

    loadPrefs() {
      try {
        const raw = localStorage.getItem(STORAGE_PREFS_KEY);
        if (raw) {
          this.prefs = JSON.parse(raw);
        }
      } catch (e) {
        console.warn("Failed to parse health prefs from localStorage:", e);
      }

      if (!this.prefs) {
        this.prefs = {
          isConfigured: false,
          goal: "fitness",
          experience: "beginner",
          workoutPref: "walking",
          equipment: "bodyweight",
          limitations: "",
          weight: null,
        };
      }
    },

    savePrefs(newPrefs) {
      this.prefs = { ...this.prefs, ...newPrefs, isConfigured: true };
      try {
        localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(this.prefs));
      } catch (e) {
        console.warn("Failed to save health prefs:", e);
      }

      // Also persist to server preferences if available
      try {
        fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ health_preferences: this.prefs }),
        }).catch(() => {});
      } catch (_) {}

      // Regenerate today's plan to reflect new preferences
      this.generatePlan(true);
      this.renderCard();
      this.renderModalContent();
    },

    loadTodayPlan() {
      const planKey = STORAGE_PLAN_PREFIX + this.todayDate;
      try {
        const raw = localStorage.getItem(planKey);
        if (raw) {
          this.todayPlan = JSON.parse(raw);
          return;
        }
      } catch (e) {
        console.warn("Failed to load today's health plan:", e);
      }

      // If already configured, generate deterministic plan for today
      if (this.prefs && this.prefs.isConfigured) {
        this.generatePlan(false);
      } else {
        this.todayPlan = {
          date: this.todayDate,
          isRestDay: false,
          tasks: this.getSampleTasks(),
        };
      }
    },

    saveTodayPlan() {
      if (!this.todayPlan) return;
      const planKey = STORAGE_PLAN_PREFIX + this.todayDate;
      try {
        localStorage.setItem(planKey, JSON.stringify(this.todayPlan));
      } catch (e) {
        console.warn("Failed to persist today's health plan:", e);
      }

      // Update history for dashboard tracking
      this.updateHistory();
    },

    updateHistory() {
      if (!this.todayPlan) return;
      const total = this.todayPlan.tasks.length;
      const completed = this.todayPlan.tasks.filter((t) => t.isCompleted).length;
      try {
        let history = {};
        const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
        if (raw) history = JSON.parse(raw);
        history[this.todayDate] = { total, completed, isRestDay: !!this.todayPlan.isRestDay };
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
      } catch (e) {
        console.warn("Failed to update health history:", e);
      }
    },

    getSampleTasks() {
      return [
        {
          id: "ht_sample_walk",
          category: "walking",
          categoryLabel: "Daily Movement",
          title: "Take a 20-minute refreshing walk",
          detail: "A gentle outdoor stroll or brisk indoor pace to revitalize your body and mind.",
          isCompleted: false,
        },
        {
          id: "ht_sample_strength",
          category: "strength",
          categoryLabel: "Strength & Mobility",
          title: "Light bodyweight mobility & stretching",
          detail: "3 rounds of 10 gentle bodyweight squats, 8 knee push-ups, and a 20-second plank.",
          isCompleted: false,
        },
        {
          id: "ht_sample_nutrition",
          category: "nutrition",
          categoryLabel: "Nourishment",
          title: "Enjoy a balanced, protein-rich meal",
          detail: "Include wholesome foods like lentils, eggs, tofu, beans, or lean protein.",
          isCompleted: false,
        },
        {
          id: "ht_sample_hydration",
          category: "recovery",
          categoryLabel: "Hydration & Rest",
          title: "Drink 8 glasses of water & aim for 7+ hours sleep",
          detail: "Keep a water bottle nearby and prepare an evening wind-down routine.",
          isCompleted: false,
        },
      ];
    },

    generatePlan(forceRegenerate = false) {
      if (!forceRegenerate && this.todayPlan && this.todayPlan.date === this.todayDate) {
        return;
      }

      const goal = (this.prefs && this.prefs.goal) || "fitness";
      const exp = (this.prefs && this.prefs.experience) || "beginner";
      const workoutPref = (this.prefs && this.prefs.workoutPref) || "walking";
      const equip = (this.prefs && this.prefs.equipment) || "bodyweight";
      const isRestDay = this.todayPlan ? !!this.todayPlan.isRestDay : false;

      const tasks = [];

      // Category 1: Walking & Movement
      let walkTitle = "Take a 20-minute brisk walk";
      let walkDetail = "An energizing, comfortable walk outdoors or during a work break.";
      if (exp === "beginner") {
        walkTitle = "Take a 15–20 minute gentle walk";
        walkDetail = "Focus on steady, comfortable breathing and posture.";
      } else if (exp === "advanced") {
        walkTitle = "Take a 35–45 minute power walk or light jog";
        walkDetail = "Sustain a brisk, cardiovascular-stimulating cadence.";
      }
      tasks.push({
        id: `ht_${this.todayDate}_walk`,
        category: "walking",
        categoryLabel: "Movement",
        title: walkTitle,
        detail: walkDetail,
        isCompleted: false,
      });

      // Category 2: Strength / Gym / Home Workout
      if (isRestDay) {
        tasks.push({
          id: `ht_${this.todayDate}_recovery`,
          category: "recovery",
          categoryLabel: "Rest & Recovery",
          title: "Active recovery: 15-minute gentle full-body mobility",
          detail: "Gentle hip openers, shoulder rolls, hamstring stretches, and mindful deep breathing.",
          isCompleted: false,
        });
      } else if (workoutPref === "gym") {
        let gymTitle = "Gym Strength: Dumbbell Press, Lat Pulldowns & Squats";
        let gymDetail = "3 sets of 8–10 repetitions with 60–90s rest periods. Warm up thoroughly.";
        if (exp === "beginner") {
          gymTitle = "Gym Fundamentals: Dumbbell bench press & goblet squats";
          gymDetail = "3 sets of 10 controlled repetitions. Focus on pristine form before weight.";
        } else if (exp === "advanced") {
          gymTitle = "Progressive Gym Circuit: Deadlifts, overhead press & weighted pull-ups";
          gymDetail = "4 sets of 6–8 repetitions with progressive overload and proper rest.";
        }
        tasks.push({
          id: `ht_${this.todayDate}_gym`,
          category: "strength",
          categoryLabel: "Gym Workout",
          title: gymTitle,
          detail: gymDetail,
          isCompleted: false,
        });
      } else if (workoutPref === "home") {
        let homeTitle = "Home Circuit: Push-ups, Squats, & Core Hold";
        let homeDetail = "3 rounds: 10–12 push-ups, 15 bodyweight squats, 30s plank. 45s rest.";
        if (equip === "dumbbells") {
          homeTitle = "Dumbbell Routine: Goblet squats, Romanian deadlifts & floor press";
          homeDetail = "3 sets of 10–12 reps with controlled tempo and good posture.";
        } else if (equip === "bands") {
          homeTitle = "Resistance Band Session: Banded squats, chest press & seated rows";
          homeDetail = "3 sets of 12–15 continuous tension repetitions.";
        }
        tasks.push({
          id: `ht_${this.todayDate}_home`,
          category: "strength",
          categoryLabel: "Home Workout",
          title: homeTitle,
          detail: homeDetail,
          isCompleted: false,
        });
      } else if (workoutPref === "walking") {
        tasks.push({
          id: `ht_${this.todayDate}_movement_break`,
          category: "walking",
          categoryLabel: "Daily Activity",
          title: "Take three 3-minute movement breaks during sitting sessions",
          detail: "Stand, stretch your calves and back, and take a quick posture reset.",
          isCompleted: false,
        });
      } else {
        // Combination
        tasks.push({
          id: `ht_${this.todayDate}_combo`,
          category: "strength",
          categoryLabel: "Functional Strength",
          title: "Functional Core & Mobility Session (15 mins)",
          detail: "Bird-dogs, glute bridges, side planks, and cat-cow stretches (3 sets).",
          isCompleted: false,
        });
      }

      // Category 3: Nourishing Nutrition (Positive, non-restrictive)
      let nutritionTitle = "Enjoy a wholesome, protein-rich meal";
      let nutritionDetail = "Fuel your body with eggs, lentils, chickpeas, tofu, beans, or lean protein.";
      if (goal === "strength") {
        nutritionTitle = "Fuel strength: prioritize high-protein meals & whole grains";
        nutritionDetail = "Ensure adequate protein distribution across your meals with complex carbs.";
      } else if (goal === "habits") {
        nutritionTitle = "Add a colorful fruit or vegetable serving to your plate";
        nutritionDetail = "Incorporate leafy greens, berries, or citrus fruits for micronutrients.";
      }
      tasks.push({
        id: `ht_${this.todayDate}_nutrition`,
        category: "nutrition",
        categoryLabel: "Nutrition",
        title: nutritionTitle,
        detail: nutritionDetail,
        isCompleted: false,
      });

      // Category 4: Hydration & Rest
      tasks.push({
        id: `ht_${this.todayDate}_hydration`,
        category: "recovery",
        categoryLabel: "Hydration",
        title: "Drink 8 glasses (2 Liters) of clean water",
        detail: "Keep your hydration steady across morning, afternoon, and evening.",
        isCompleted: false,
      });

      this.todayPlan = {
        date: this.todayDate,
        isRestDay: isRestDay,
        tasks: tasks,
      };

      this.saveTodayPlan();
    },

    toggleTask(taskId) {
      if (!this.todayPlan || !this.todayPlan.tasks) return;
      const task = this.todayPlan.tasks.find((t) => t.id === taskId);
      if (!task) return;

      task.isCompleted = !task.isCompleted;
      this.saveTodayPlan();

      // Trigger celebration / sound if task was just marked completed
      if (task.isCompleted && window.SoundManager && window.SoundManager.playTaskVictory) {
        window.SoundManager.playTaskVictory(taskId);
      }

      this.renderCard();
      this.renderModalContent();
    },

    setRestDay(enableRestDay) {
      if (!this.todayPlan) return;
      this.todayPlan.isRestDay = !!enableRestDay;
      this.generatePlan(true);
      this.renderCard();
      this.renderModalContent();
      if (window.showToast) {
        window.showToast(enableRestDay ? "Rest day mode enabled 🌿" : "Active workout mode restored ⚡");
      }
    },

    regeneratePlanWithConfirm() {
      const hasCompleted = this.todayPlan && this.todayPlan.tasks.some((t) => t.isCompleted);
      if (hasCompleted) {
        const ok = confirm("You have completed health tasks today. Regenerating will replace your daily plan. Continue?");
        if (!ok) return;
      }
      this.generatePlan(true);
      this.renderCard();
      this.renderModalContent();
      if (window.showToast) {
        window.showToast("Daily wellness plan refreshed ✨");
      }
    },

    getStats() {
      if (!this.todayPlan || !this.todayPlan.tasks || this.todayPlan.tasks.length === 0) {
        return { total: 0, completed: 0, remaining: 0, percentage: 0 };
      }
      const total = this.todayPlan.tasks.length;
      const completed = this.todayPlan.tasks.filter((t) => t.isCompleted).length;
      const remaining = total - completed;
      const percentage = Math.round((completed / total) * 100);
      return { total, completed, remaining, percentage };
    },

    renderCard() {
      const card = document.getElementById("health-wellness-today-card");
      if (!card) return;

      const stats = this.getStats();
      const isRestDay = this.todayPlan && this.todayPlan.isRestDay;
      const isConfigured = this.prefs && this.prefs.isConfigured;

      const circ = 106.8;
      const offset = circ * (1 - (stats.percentage || 0) / 100);

      card.innerHTML = `
        <div class="health-card-header">
          <div class="health-card-header-left">
            <div class="health-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                <path d="M12 5v4"></path>
              </svg>
            </div>
            <div>
              <div class="health-card-eyebrow">DAILY ROUTINE</div>
              <h3 class="health-card-title">Health &amp; Wellness</h3>
              <p class="health-card-subtitle">${isRestDay ? "Rest & mindful recovery" : "Daily movement &amp; wellness plan"}</p>
            </div>
          </div>

          <!-- Circular Mini Progress Score -->
          <div class="health-circle-score-wrap" title="${stats.completed} of ${stats.total} completed (${stats.percentage}%)">
            <svg class="health-circle-score-svg" width="46" height="46" viewBox="0 0 46 46">
              <circle class="health-circle-track" cx="23" cy="23" r="17" fill="none" stroke-width="3.5" />
              <circle class="health-circle-bar" cx="23" cy="23" r="17" fill="none" stroke-width="3.5"
                stroke-linecap="round" stroke-dasharray="106.8" stroke-dashoffset="${offset}" transform="rotate(-90 23 23)" />
            </svg>
            <div class="health-circle-score-val">${stats.percentage}%</div>
          </div>
        </div>

        <!-- Progress Track -->
        <div class="health-progress-wrap" role="progressbar" aria-valuenow="${stats.percentage}" aria-valuemin="0" aria-valuemax="100">
          <div class="health-progress-bar" style="width: ${stats.percentage}%;"></div>
        </div>

        <div class="health-card-meta-row">
          <span class="health-meta-counter"><strong>${stats.completed}</strong> of <strong>${stats.total}</strong> habits completed</span>
          ${isRestDay ? `<span class="health-rest-pill">🌿 Rest Day</span>` : `<span class="health-active-pill">⚡ Active Plan</span>`}
        </div>

        <!-- Interactive Task Previews with real working checkboxes -->
        <div class="health-card-tasks">
          ${(this.todayPlan && this.todayPlan.tasks ? this.todayPlan.tasks.slice(0, 4) : [])
            .map(
              (t) => `
            <div class="health-card-task-item ${t.isCompleted ? "completed" : ""}" data-health-task-id="${t.id}">
              <label class="health-custom-check">
                <input type="checkbox" ${t.isCompleted ? "checked" : ""} data-health-check="${t.id}" aria-label="${escapeHtml(t.title)}">
                <span class="health-check-box"></span>
              </label>
              <div class="health-card-task-info">
                <span class="health-card-task-title">${escapeHtml(t.title)}</span>
                <span class="health-card-task-tag ${t.category}">${escapeHtml(t.categoryLabel)}</span>
              </div>
            </div>
          `
            )
            .join("")}
        </div>

        <!-- Action Row -->
        <div class="health-card-action-row">
          <button type="button" class="btn-view-health-plan" id="btn-open-health-plan">
            <span>${isConfigured ? "View Health Plan" : "Set Up Health Routine"}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      `;

      // Checkbox click handlers on card
      card.querySelectorAll('input[data-health-check]').forEach((input) => {
        input.addEventListener("change", (e) => {
          e.stopPropagation();
          const taskId = input.getAttribute("data-health-check");
          HealthManager.toggleTask(taskId);
        });
      });

      // View health plan button
      const openBtn = card.querySelector("#btn-open-health-plan");
      if (openBtn) {
        openBtn.addEventListener("click", () => {
          if (!HealthManager.prefs || !HealthManager.prefs.isConfigured) {
            HealthManager.openOnboarding();
          } else {
            HealthManager.openModal();
          }
        });
      }
    },

    renderModalContent() {
      const modal = document.getElementById("health-plan-modal");
      if (!modal) return;

      const stats = this.getStats();
      const isRestDay = this.todayPlan && this.todayPlan.isRestDay;
      const tasks = (this.todayPlan && this.todayPlan.tasks) || [];

      // Update counters
      const countEl = modal.querySelector("#health-modal-completed-count");
      if (countEl) countEl.textContent = `${stats.completed} of ${stats.total} completed (${stats.percentage}%)`;

      const barEl = modal.querySelector("#health-modal-progress-bar");
      if (barEl) barEl.style.width = `${stats.percentage}%`;

      // Render tasks list
      const listContainer = modal.querySelector("#health-modal-tasks-list");
      if (listContainer) {
        listContainer.innerHTML = tasks
          .map(
            (t) => `
          <div class="health-modal-task-card ${t.isCompleted ? "completed" : ""}" data-health-task-id="${t.id}">
            <div class="health-task-checkbox-col">
              <label class="health-custom-check">
                <input type="checkbox" ${t.isCompleted ? "checked" : ""} data-modal-health-check="${t.id}">
                <span class="health-check-box"></span>
              </label>
            </div>
            <div class="health-task-body">
              <div class="health-task-title-row">
                <h4 class="health-task-title">${escapeHtml(t.title)}</h4>
                <span class="health-category-badge ${t.category}">${escapeHtml(t.categoryLabel)}</span>
              </div>
              <p class="health-task-detail">${escapeHtml(t.detail)}</p>
            </div>
          </div>
        `
          )
          .join("");

        // Checkbox listeners
        listContainer.querySelectorAll("input[data-modal-health-check]").forEach((input) => {
          input.addEventListener("change", (e) => {
            const taskId = input.getAttribute("data-modal-health-check");
            HealthManager.toggleTask(taskId);
          });
        });
      }

      // Rest Day toggle button text
      const restBtn = modal.querySelector("#btn-toggle-rest-day");
      if (restBtn) {
        restBtn.textContent = isRestDay ? "⚡ Switch to Active Plan" : "🌿 Take a Rest Day";
      }

      // Profile summary badge
      const profileBadge = modal.querySelector("#health-profile-summary-badge");
      if (profileBadge && this.prefs) {
        const goalMap = {
          fitness: "General Fitness",
          strength: "Build Strength",
          habits: "Daily Habits",
          stamina: "Stamina & Endurance",
          gym: "Gym Routine",
          home: "Home Workouts",
        };
        const goalText = goalMap[this.prefs.goal] || "Wellness";
        const expText = this.prefs.experience ? this.prefs.experience.charAt(0).toUpperCase() + this.prefs.experience.slice(1) : "Beginner";
        const weightText = this.prefs.weight ? ` • ${this.prefs.weight} kg` : "";
        profileBadge.textContent = `${goalText} • ${expText}${weightText}`;
      }
    },

    openModal() {
      const modal = document.getElementById("health-plan-modal");
      if (!modal) return;
      this.renderModalContent();
      modal.classList.add("active");
    },

    closeModal() {
      const modal = document.getElementById("health-plan-modal");
      if (modal) modal.classList.remove("active");
    },

    openOnboarding() {
      const modal = document.getElementById("health-onboarding-modal");
      if (!modal) return;

      // Populate existing preferences if present
      if (this.prefs) {
        const goalEl = modal.querySelector(`input[name="health-goal"][value="${this.prefs.goal}"]`);
        if (goalEl) goalEl.checked = true;

        const expEl = modal.querySelector(`input[name="health-exp"][value="${this.prefs.experience}"]`);
        if (expEl) expEl.checked = true;

        const prefEl = modal.querySelector(`input[name="health-pref"][value="${this.prefs.workoutPref}"]`);
        if (prefEl) prefEl.checked = true;

        const equipEl = modal.querySelector(`input[name="health-equip"][value="${this.prefs.equipment}"]`);
        if (equipEl) equipEl.checked = true;

        const weightIn = modal.querySelector("#health-input-weight");
        if (weightIn && this.prefs.weight) weightIn.value = this.prefs.weight;

        const limitIn = modal.querySelector("#health-input-limitations");
        if (limitIn && this.prefs.limitations) limitIn.value = this.prefs.limitations;
      }

      modal.classList.add("active");
    },

    closeOnboarding() {
      const modal = document.getElementById("health-onboarding-modal");
      if (modal) modal.classList.remove("active");
    },

    bindGlobalEvents() {
      // Modal Close buttons
      const closePlanBtn = document.getElementById("btn-close-health-modal");
      if (closePlanBtn) {
        closePlanBtn.addEventListener("click", () => this.closeModal());
      }

      const closeOnboardingBtn = document.getElementById("btn-close-health-onboarding");
      if (closeOnboardingBtn) {
        closeOnboardingBtn.addEventListener("click", () => this.closeOnboarding());
      }

      // Rest Day toggle
      const restBtn = document.getElementById("btn-toggle-rest-day");
      if (restBtn) {
        restBtn.addEventListener("click", () => {
          const isRest = this.todayPlan && this.todayPlan.isRestDay;
          this.setRestDay(!isRest);
        });
      }

      // Regenerate Plan
      const regenBtn = document.getElementById("btn-regenerate-health-plan");
      if (regenBtn) {
        regenBtn.addEventListener("click", () => {
          this.regeneratePlanWithConfirm();
        });
      }

      // Edit Preferences trigger
      const editPrefsBtn = document.getElementById("btn-edit-health-prefs");
      if (editPrefsBtn) {
        editPrefsBtn.addEventListener("click", () => {
          this.closeModal();
          this.openOnboarding();
        });
      }

      // Onboarding form submit
      const form = document.getElementById("form-health-onboarding");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const goalEl = form.querySelector('input[name="health-goal"]:checked');
          const expEl = form.querySelector('input[name="health-exp"]:checked');
          const prefEl = form.querySelector('input[name="health-pref"]:checked');
          const equipEl = form.querySelector('input[name="health-equip"]:checked');
          const weightIn = form.querySelector("#health-input-weight");
          const limitIn = form.querySelector("#health-input-limitations");

          const weightVal = weightIn && weightIn.value ? parseFloat(weightIn.value) : null;
          const limitVal = limitIn ? limitIn.value.trim() : "";

          this.savePrefs({
            goal: goalEl ? goalEl.value : "fitness",
            experience: expEl ? expEl.value : "beginner",
            workoutPref: prefEl ? prefEl.value : "walking",
            equipment: equipEl ? equipEl.value : "bodyweight",
            weight: weightVal && !isNaN(weightVal) && weightVal > 20 && weightVal < 300 ? weightVal : null,
            limitations: limitVal,
          });

          this.closeOnboarding();
          this.openModal();
          if (window.showToast) {
            window.showToast("Your Health & Wellness routine is ready ✨");
          }
        });
      }
    },
  };

  window.HealthManager = HealthManager;

  // Initialize once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => HealthManager.init());
  } else {
    HealthManager.init();
  }
})();
