-- ============================================================================
-- DAYBOOK DATABASE SCHEMA
-- Compatible with PostgreSQL (Supabase) and SQLite
-- Two-Level Task Management & Product Enhancements
-- ============================================================================

-- 1. Notes Table (Block-based & Templates ready)
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    folder_id TEXT DEFAULT NULL,
    is_pinned INTEGER DEFAULT 0,
    tags TEXT DEFAULT '',
    template_type TEXT DEFAULT 'blank', -- 'blank', 'daily_plan', 'journal', 'study', 'project'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projects Table (Monthly & Long-term goals)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default_user',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'in_progress', -- 'not_started', 'in_progress', 'on_hold', 'completed'
    start_date TEXT DEFAULT NULL,
    deadline TEXT DEFAULT NULL,
    color TEXT DEFAULT '#4f46e5',
    progress INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    attachments TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Project Milestones Table
CREATE TABLE IF NOT EXISTS project_milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    deadline TEXT DEFAULT NULL,
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 4. Recurring Rules Table (Feature: Recurring Tasks)
CREATE TABLE IF NOT EXISTS recurring_rules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
    project_id TEXT DEFAULT NULL,
    frequency TEXT NOT NULL,         -- 'daily', 'weekly', 'monthly', 'custom_days'
    interval_val INTEGER DEFAULT 1,  -- repeat interval (e.g. every 1 day, every 2 weeks)
    by_weekdays TEXT DEFAULT '[]',   -- JSON array e.g. '[1,3,5]' (0=Sun, 1=Mon...6=Sat)
    start_date TEXT NOT NULL,        -- 'YYYY-MM-DD'
    end_date TEXT DEFAULT NULL,      -- 'YYYY-MM-DD' or NULL
    due_time TEXT DEFAULT NULL,
    cancelled_dates TEXT DEFAULT '[]', -- JSON array of dates excluded e.g. '["2026-10-11"]'
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- 5. Tasks Table (Two-Level: Daily Tasks with recurrence and project linking)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default_user',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_completed INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
    task_date TEXT NOT NULL,         -- 'YYYY-MM-DD' calendar date
    due_time TEXT DEFAULT NULL,      -- Optional time e.g. '14:30'
    reminder TEXT DEFAULT NULL,
    due_date TEXT DEFAULT NULL,      -- Backward compatibility
    project_id TEXT DEFAULT NULL,    -- Optional link to parent project
    recurring_rule_id TEXT DEFAULT NULL, -- Link to recurring schedule
    original_date TEXT DEFAULT NULL,     -- Original scheduled date (prevents duplicate generation)
    is_recurrence_exception INTEGER DEFAULT 0, -- 1 if modified specifically for this occurrence
    completed_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (recurring_rule_id) REFERENCES recurring_rules(id) ON DELETE SET NULL
);

-- 6. Subtasks and Checklists Table (Feature Two)
CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);

-- 7. Daily Journal Table
CREATE TABLE IF NOT EXISTS journals (
    id TEXT PRIMARY KEY,
    entry_date TEXT NOT NULL,
    content TEXT NOT NULL,
    mood TEXT DEFAULT 'good', -- 'great', 'good', 'neutral', 'low'
    tags TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7B. Memories Table (Personal Digital Diary & Memories Album)
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default_user',
    title TEXT NOT NULL,
    journal_text TEXT DEFAULT '',
    date TEXT NOT NULL,              -- 'YYYY-MM-DD'
    time TEXT DEFAULT '',            -- '4:30 PM' or '16:30'
    timestamp TEXT DEFAULT NULL,     -- ISO timestamp
    location TEXT DEFAULT '',
    mood TEXT DEFAULT '😊 Happy',
    photos TEXT DEFAULT '[]',        -- JSON array of photo URLs
    tags TEXT DEFAULT '[]',          -- JSON array of tag strings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memories_date ON memories(date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);

-- 8. Quick Capture Inbox Table (Feature Three)
CREATE TABLE IF NOT EXISTS inbox_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    item_type TEXT DEFAULT 'unprocessed', -- 'unprocessed', 'task', 'note', 'idea'
    status TEXT DEFAULT 'inbox',          -- 'inbox', 'processed', 'archived'
    converted_to_type TEXT DEFAULT NULL,  -- 'task', 'note', 'project'
    converted_to_id TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items(status, created_at DESC);

-- 9. Victory Sounds Table (Feature: Victory Sounds)
CREATE TABLE IF NOT EXISTS victory_sounds (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT NULL,           -- Owner's authenticated user ID
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,             -- local relative path or Supabase storage object path
    file_format TEXT NOT NULL,           -- 'mp3', 'wav', 'ogg', 'm4a', 'webm'
    file_size INTEGER DEFAULT 0,         -- bytes
    duration REAL DEFAULT 0,             -- seconds
    event_trigger TEXT DEFAULT 'task_complete', -- 'task_complete', 'milestone_complete', 'all_complete'
    is_default INTEGER DEFAULT 0,
    file_hash TEXT DEFAULT NULL,         -- SHA-256 hash for deduplication
    is_public INTEGER DEFAULT 0,         -- Ready for future sound pack sharing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. User Preferences & Appearance Table
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY DEFAULT 'default_user',
    theme_mode TEXT DEFAULT 'system',         -- 'light', 'dark', 'system'
    accent_color TEXT DEFAULT '#4f46e5',
    font_size TEXT DEFAULT 'normal',           -- 'compact', 'normal', 'large'
    layout_density TEXT DEFAULT 'comfortable', -- 'comfortable', 'compact'
    card_radius TEXT DEFAULT 'rounded',        -- 'rounded', 'subtle'
    dashboard_widgets TEXT DEFAULT '{"metrics":true,"focus_card":true,"quick_actions":true,"today_tasks":true,"monthly_projects":true,"recent_notes":true}',
    mascot_enabled INTEGER DEFAULT 1,
    mascot_sound INTEGER DEFAULT 0,
    companion_id TEXT DEFAULT 'bear',
    companion_name TEXT DEFAULT '',
    companion_size TEXT DEFAULT 'regular',
    companion_enabled INTEGER DEFAULT 1,
    companion_image_url TEXT DEFAULT NULL,
    victory_sound_enabled INTEGER DEFAULT 1,
    victory_sound_volume REAL DEFAULT 0.7,
    active_task_sound_id TEXT DEFAULT 'default_victory',
    active_milestone_sound_id TEXT DEFAULT NULL,
    sound_event_mode TEXT DEFAULT 'every_task', -- 'every_task' or 'selected_events'
    custom_bg_enabled INTEGER DEFAULT 0,
    custom_bg_fit TEXT DEFAULT 'cover',         -- 'cover', 'contain'
    custom_bg_position TEXT DEFAULT 'center',   -- 'center', 'top', 'bottom', 'left', 'right'
    custom_bg_overlay_mode TEXT DEFAULT 'dark', -- 'dark', 'light', 'auto'
    custom_bg_overlay_opacity REAL DEFAULT 0.45,
    custom_bg_blur INTEGER DEFAULT 0,
    custom_bg_dynamic_accent INTEGER DEFAULT 1,
    custom_bg_accent_color TEXT DEFAULT NULL,
    custom_bg_image_url TEXT DEFAULT NULL,
    user_name TEXT DEFAULT '',
    user_age INTEGER DEFAULT NULL,
    health_preferences TEXT DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(task_date, is_completed);
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(recurring_rule_id, task_date);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status, deadline);
CREATE INDEX IF NOT EXISTS idx_milestones_proj ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_journals_date ON journals(entry_date DESC);
