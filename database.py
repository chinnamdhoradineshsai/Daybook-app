"""
Daybook - Database Access Layer
Supports Supabase PostgreSQL with local SQLite fallback.
Handles Two-Level Task Management (Today Tasks & Monthly Projects), Notes, Journals, and Preferences.
"""

import os
import sqlite3
import uuid
import json
import calendar
from datetime import datetime, timedelta, timezone

DATABASE_URL = os.getenv("DATABASE_URL")
IS_POSTGRES = bool(DATABASE_URL and DATABASE_URL.startswith("postgres"))

INSTANCE_DIR = os.path.join(os.path.dirname(__file__), "instance")
SQLITE_DB_PATH = os.path.join(INSTANCE_DIR, "daybook.db")


def get_db_connection():
    """Returns a database connection based on environment configuration.

    For PostgreSQL, use a compatibility cursor that converts SQLite-style
    qmark placeholders (?) into psycopg2 placeholders (%s). DictCursor is
    used because this code accesses rows both by column name and by index.
    """
    if IS_POSTGRES:
        import psycopg2
        from psycopg2.extras import DictCursor

        class CompatibleDictCursor(DictCursor):
            def execute(self, query, vars=None):
                if isinstance(query, str):
                    query = query.replace("?", "%s")
                return super().execute(query, vars)

            def executemany(self, query, vars_list):
                if isinstance(query, str):
                    query = query.replace("?", "%s")
                return super().executemany(query, vars_list)

        conn = psycopg2.connect(
            DATABASE_URL,
            cursor_factory=CompatibleDictCursor,
            connect_timeout=15,
        )
        return conn
    else:
        os.makedirs(INSTANCE_DIR, exist_ok=True)
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn


def init_db():
    """Initializes tables, migrates missing columns, and seeds initial data."""
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    conn = get_db_connection()
    try:
        cur = conn.cursor()

        # Safe SQLite column migration before creating indexes
        if not IS_POSTGRES:
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
            if cur.fetchone():
                cur.execute("PRAGMA table_info(tasks)")
                task_columns = [col[1] for col in cur.fetchall()]
                if "task_date" not in task_columns:
                    cur.execute("ALTER TABLE tasks ADD COLUMN task_date TEXT DEFAULT NULL")
                if "due_time" not in task_columns:
                    cur.execute("ALTER TABLE tasks ADD COLUMN due_time TEXT DEFAULT NULL")
                if "project_id" not in task_columns:
                    cur.execute("ALTER TABLE tasks ADD COLUMN project_id TEXT DEFAULT NULL")
                if "recurring_rule_id" not in task_columns:
                    cur.execute("ALTER TABLE tasks ADD COLUMN recurring_rule_id TEXT DEFAULT NULL")
                if "original_date" not in task_columns:
                    cur.execute("ALTER TABLE tasks ADD COLUMN original_date TEXT DEFAULT NULL")
                if "is_recurrence_exception" not in task_columns:
                    cur.execute("ALTER TABLE tasks ADD COLUMN is_recurrence_exception INTEGER DEFAULT 0")
                if "reminder" not in task_columns:
                    cur.execute("ALTER TABLE tasks ADD COLUMN reminder TEXT DEFAULT NULL")
                if "user_id" not in task_columns:
                    cur.execute("ALTER TABLE tasks ADD COLUMN user_id TEXT DEFAULT 'default_user'")

                # Populate task_date for existing tasks if null
                today_str = datetime.now().strftime("%Y-%m-%d")
                cur.execute("UPDATE tasks SET task_date = ? WHERE task_date IS NULL", (today_str,))

            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
            if cur.fetchone():
                cur.execute("PRAGMA table_info(projects)")
                proj_cols = [col[1] for col in cur.fetchall()]
                if "progress" not in proj_cols:
                    cur.execute("ALTER TABLE projects ADD COLUMN progress INTEGER DEFAULT 0")
                if "notes" not in proj_cols:
                    cur.execute("ALTER TABLE projects ADD COLUMN notes TEXT DEFAULT ''")
                if "attachments" not in proj_cols:
                    cur.execute("ALTER TABLE projects ADD COLUMN attachments TEXT DEFAULT '[]'")
                if "user_id" not in proj_cols:
                    cur.execute("ALTER TABLE projects ADD COLUMN user_id TEXT DEFAULT 'default_user'")

            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='recurring_rules'")
            if cur.fetchone():
                cur.execute("PRAGMA table_info(recurring_rules)")
                rr_cols = [col[1] for col in cur.fetchall()]
                if "cancelled_dates" not in rr_cols:
                    cur.execute("ALTER TABLE recurring_rules ADD COLUMN cancelled_dates TEXT DEFAULT '[]'")

            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences'")
            if cur.fetchone():
                cur.execute("PRAGMA table_info(user_preferences)")
                pref_columns = [col[1] for col in cur.fetchall()]
                if "dashboard_widgets" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN dashboard_widgets TEXT DEFAULT '{}'")
                if "companion_id" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN companion_id TEXT DEFAULT 'bear'")
                if "companion_name" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN companion_name TEXT DEFAULT ''")
                if "companion_size" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN companion_size TEXT DEFAULT 'regular'")
                if "companion_enabled" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN companion_enabled INTEGER DEFAULT 1")
                if "companion_image_url" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN companion_image_url TEXT DEFAULT NULL")
                if "victory_sound_enabled" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN victory_sound_enabled INTEGER DEFAULT 1")
                if "victory_sound_volume" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN victory_sound_volume REAL DEFAULT 0.7")
                if "active_task_sound_id" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN active_task_sound_id TEXT DEFAULT 'default_victory'")
                if "active_milestone_sound_id" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN active_milestone_sound_id TEXT DEFAULT NULL")
                if "sound_event_mode" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN sound_event_mode TEXT DEFAULT 'every_task'")
                if "custom_bg_enabled" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN custom_bg_enabled INTEGER DEFAULT 0")
                if "custom_bg_fit" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN custom_bg_fit TEXT DEFAULT 'cover'")
                if "custom_bg_position" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN custom_bg_position TEXT DEFAULT 'center'")
                if "custom_bg_overlay_mode" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN custom_bg_overlay_mode TEXT DEFAULT 'dark'")
                if "custom_bg_overlay_opacity" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN custom_bg_overlay_opacity REAL DEFAULT 0.45")
                if "custom_bg_blur" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN custom_bg_blur INTEGER DEFAULT 0")
                if "custom_bg_dynamic_accent" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN custom_bg_dynamic_accent INTEGER DEFAULT 1")
                if "custom_bg_accent_color" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN custom_bg_accent_color TEXT DEFAULT NULL")
                if "custom_bg_image_url" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN custom_bg_image_url TEXT DEFAULT NULL")
                if "user_name" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN user_name TEXT DEFAULT ''")
                if "user_age" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN user_age INTEGER DEFAULT NULL")
                if "health_preferences" not in pref_columns:
                    cur.execute("ALTER TABLE user_preferences ADD COLUMN health_preferences TEXT DEFAULT '{}'")

            # Ensure subtasks table exists in SQLite
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS subtasks (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    is_completed INTEGER DEFAULT 0,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
                )
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)")

            # Ensure inbox_items table exists in SQLite
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS inbox_items (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    notes TEXT DEFAULT '',
                    item_type TEXT DEFAULT 'unprocessed',
                    status TEXT DEFAULT 'inbox',
                    converted_to_type TEXT DEFAULT NULL,
                    converted_to_id TEXT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items(status, created_at DESC)")

            # Ensure victory_sounds table exists in SQLite
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS victory_sounds (
                    id TEXT PRIMARY KEY,
                    user_id TEXT DEFAULT NULL,
                    title TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_format TEXT NOT NULL,
                    file_size INTEGER DEFAULT 0,
                    duration REAL DEFAULT 0,
                    event_trigger TEXT DEFAULT 'task_complete',
                    is_default INTEGER DEFAULT 0,
                    file_hash TEXT DEFAULT NULL,
                    is_public INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            cur.execute("PRAGMA table_info(victory_sounds)")
            vs_columns = [col[1] for col in cur.fetchall()]
            if "user_id" not in vs_columns:
                cur.execute("ALTER TABLE victory_sounds ADD COLUMN user_id TEXT DEFAULT NULL")
            if "file_hash" not in vs_columns:
                cur.execute("ALTER TABLE victory_sounds ADD COLUMN file_hash TEXT DEFAULT NULL")
            if "is_public" not in vs_columns:
                cur.execute("ALTER TABLE victory_sounds ADD COLUMN is_public INTEGER DEFAULT 0")

            conn.commit()

        # Now execute table and index definitions
        if IS_POSTGRES:
            cur.execute(schema_sql)
        else:
            cur.executescript(schema_sql)

        conn.commit()

        # Seed initial data if projects table is empty
        cur.execute("SELECT COUNT(*) AS cnt FROM projects")
        row = cur.fetchone()
        count = row["cnt"] if isinstance(row, dict) or hasattr(row, "keys") else row[0]

        if count == 0:
            seed_initial_data(conn)

        # Seed default victory sounds if victory_sounds table is empty
        cur.execute("SELECT COUNT(*) AS cnt FROM victory_sounds")
        v_row = cur.fetchone()
        v_count = v_row["cnt"] if isinstance(v_row, dict) or hasattr(v_row, "keys") else v_row[0]
        if v_count == 0:
            now_str = datetime.now(timezone.utc).isoformat()
            starter_sounds = [
                ("default_victory", "Crystal Chime", "/static/uploads/sounds/crystal_chime.wav", "wav", 87318, 0.99, "task_complete", 1),
                ("sound_level_up", "Level Up Fanfare", "/static/uploads/sounds/level_up.wav", "wav", 85554, 0.97, "milestone_complete", 1),
                ("sound_zen_bell", "Zen Bell", "/static/uploads/sounds/zen_bell.wav", "wav", 105840, 1.20, "task_complete", 0),
                ("sound_arcade_win", "Arcade Win", "/static/uploads/sounds/arcade_win.wav", "wav", 58210, 0.66, "task_complete", 0),
            ]
            for s_id, s_title, s_path, s_fmt, s_sz, s_dur, s_evt, s_def in starter_sounds:
                cur.execute(
                    """
                    INSERT INTO victory_sounds (id, title, file_path, file_format, file_size, duration, event_trigger, is_default, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (s_id, s_title, s_path, s_fmt, s_sz, s_dur, s_evt, s_def, now_str, now_str),
                )
            conn.commit()

        # Seed starter memories if memories table is empty
        cur.execute("SELECT COUNT(*) AS cnt FROM memories")
        m_row = cur.fetchone()
        m_count = m_row["cnt"] if isinstance(m_row, dict) or hasattr(m_row, "keys") else m_row[0]
        if m_count == 0:
            now_str = datetime.now(timezone.utc).isoformat()
            today_str = datetime.now().strftime("%Y-%m-%d")
            starter_memories = [
                (
                    str(uuid.uuid4()),
                    "default_user",
                    "Trip to Araku Valley",
                    "Today was one of the most peaceful days. The weather was beautiful, the mountains looked amazing, and I really enjoyed spending time here.",
                    today_str,
                    "04:30 PM",
                    now_str,
                    "Araku Valley",
                    "😊 Happy",
                    json.dumps(["/static/uploads/memories/araku_valley_scenic.jpg"]),
                    json.dumps(["Travel", "Mountains", "Nature"]),
                    now_str,
                    now_str
                ),
                (
                    str(uuid.uuid4()),
                    "default_user",
                    "College Event",
                    "Presented our robotics project today! Everyone was super enthusiastic and the live demo worked flawlessly.",
                    "2026-10-08",
                    "11:00 AM",
                    now_str,
                    "College Auditorium",
                    "🎉 Excited",
                    json.dumps(["/static/uploads/memories/college_event_tech.jpg"]),
                    json.dumps(["College", "Robotics", "Celebration"]),
                    now_str,
                    now_str
                )
            ]
            for mem in starter_memories:
                cur.execute(
                    """
                    INSERT INTO memories 
                    (id, user_id, title, journal_text, date, time, timestamp, location, mood, photos, tags, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    mem
                )
            conn.commit()

    finally:
        conn.close()


def seed_initial_data(conn):
    """Seeds initial projects, notes, and tasks."""
    cur = conn.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    today_str = datetime.now().strftime("%Y-%m-%d")

    # 1. Starter Project 1: Build Daybook Workspace
    proj_id_1 = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO projects (id, title, description, status, start_date, deadline, color, created_at, updated_at)
        VALUES (?, ?, ?, 'in_progress', ?, ?, '#4f46e5', ?, ?)
        """,
        (
            proj_id_1,
            "Build Daybook Personal Workspace 🚀",
            "Develop a mobile-first, Notion-inspired productivity system with Two-Level task management and live customization.",
            today_str,
            "2026-10-31",
            now_str,
            now_str,
        ),
    )

    # Milestones for Project 1
    m1 = str(uuid.uuid4())
    m2 = str(uuid.uuid4())
    m3 = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO project_milestones (id, project_id, title, is_completed, deadline, priority, created_at, updated_at)
        VALUES (?, ?, ?, 1, '2026-10-15', 'high', ?, ?),
               (?, ?, ?, 0, '2026-10-22', 'normal', ?, ?),
               (?, ?, ?, 0, '2026-10-31', 'normal', ?, ?)
        """,
        (
            m1, proj_id_1, "Design mobile-first interface & Bear mascot", now_str, now_str,
            m2, proj_id_1, "Two-level task system: Today Tasks & Monthly Projects", now_str, now_str,
            m3, proj_id_1, "Block note editor & Supabase cloud backup", now_str, now_str,
        ),
    )

    # 2. Starter Project 2: Q4 Learning & Study Goals
    proj_id_2 = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO projects (id, title, description, status, start_date, deadline, color, created_at, updated_at)
        VALUES (?, ?, ?, 'in_progress', ?, ?, '#10b981', ?, ?)
        """,
        (
            proj_id_2,
            "Master Full-Stack Web Development 💡",
            "Learn Python Flask, PostgreSQL database management, and mobile UX design patterns.",
            today_str,
            "2026-11-15",
            now_str,
            now_str,
        ),
    )
    cur.execute(
        """
        INSERT INTO project_milestones (id, project_id, title, is_completed, deadline, priority, created_at, updated_at)
        VALUES (?, ?, ?, 1, '2026-10-20', 'normal', ?, ?),
               (?, ?, ?, 0, '2026-11-10', 'high', ?, ?)
        """,
        (
            str(uuid.uuid4()), proj_id_2, "Understand HTTP REST APIs and JSON endpoints", now_str, now_str,
            str(uuid.uuid4()), proj_id_2, "Build persistent data storage with parameterized SQL", now_str, now_str,
        ),
    )

    # 3. Ensure today's tasks have valid task_date and link to Project 1
    cur.execute(
        """
        UPDATE tasks 
        SET task_date = ?, project_id = ? 
        WHERE task_date IS NULL
        """,
        (today_str, proj_id_1),
    )

    conn.commit()


# ============================================================================
# Recurring Tasks Engine (Feature: Recurring Tasks)
# ============================================================================
def rule_applies_to_date(rule, target_date_str):
    """
    Determines if a recurring schedule rule triggers on target_date_str ('YYYY-MM-DD').
    Accurately handles leap years, month-end date clamping, weekly intervals,
    and custom weekday selections.
    """
    start_str = rule.get("start_date")
    if not start_str or target_date_str < start_str:
        return False

    end_str = rule.get("end_date")
    if end_str and target_date_str > end_str:
        return False

    cancelled = rule.get("cancelled_dates") or "[]"
    if isinstance(cancelled, str):
        try:
            cancelled_list = json.loads(cancelled)
        except Exception:
            cancelled_list = []
    else:
        cancelled_list = cancelled
    if target_date_str in cancelled_list:
        return False

    try:
        start_d = datetime.strptime(start_str, "%Y-%m-%d").date()
        target_d = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except Exception:
        return False

    freq = rule.get("frequency", "daily")
    interval = max(1, int(rule.get("interval_val") or 1))
    days_diff = (target_d - start_d).days

    if days_diff < 0:
        return False

    if freq == "daily":
        return days_diff % interval == 0

    elif freq == "weekly":
        if days_diff % 7 != 0:
            return False
        weeks_diff = days_diff // 7
        return weeks_diff % interval == 0

    elif freq == "custom_days":
        weekdays_raw = rule.get("by_weekdays") or "[]"
        if isinstance(weekdays_raw, str):
            try:
                weekdays = json.loads(weekdays_raw)
            except Exception:
                weekdays = []
        else:
            weekdays = weekdays_raw

        # Support ISO weekday: 1=Mon, 2=Tue, ..., 7=Sun (0 is normalized to 7)
        normalized_weekdays = [7 if int(w) == 0 else int(w) for w in weekdays]
        weeks_diff = days_diff // 7
        if interval > 1 and (weeks_diff % interval != 0):
            return False
        return target_d.isoweekday() in normalized_weekdays

    elif freq == "monthly":
        months_diff = (target_d.year - start_d.year) * 12 + (target_d.month - start_d.month)
        if months_diff < 0 or (months_diff % interval != 0):
            return False

        # Handle month-end clamping (e.g. Jan 31 -> Feb 28/29, Apr 30)
        _, max_days = calendar.monthrange(target_d.year, target_d.month)
        expected_day = min(start_d.day, max_days)
        return target_d.day == expected_day

    return False


def materialize_recurring_tasks(conn, target_date_str):
    """
    Idempotently materializes task occurrences for all active recurring rules
    that match target_date_str. Never produces duplicates.
    """
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM recurring_rules 
        WHERE is_active = 1 
          AND start_date <= ? 
          AND (end_date IS NULL OR end_date >= ?)
        """,
        (target_date_str, target_date_str),
    )
    rules = [dict(r) for r in cur.fetchall()]

    for rule in rules:
        if rule_applies_to_date(rule, target_date_str):
            # Check if this occurrence already exists
            cur.execute(
                """
                SELECT id FROM tasks 
                WHERE recurring_rule_id = ? 
                  AND (task_date = ? OR original_date = ?)
                LIMIT 1
                """,
                (rule["id"], target_date_str, target_date_str),
            )
            existing = cur.fetchone()
            if not existing:
                new_id = str(uuid.uuid4())
                now_str = datetime.now(timezone.utc).isoformat()
                cur.execute(
                    """
                    INSERT INTO tasks 
                    (id, title, description, priority, task_date, due_time, project_id, 
                     recurring_rule_id, original_date, is_recurrence_exception, is_completed, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
                    """,
                    (
                        new_id,
                        rule["title"],
                        rule.get("description", ""),
                        rule.get("priority", "normal"),
                        target_date_str,
                        rule.get("due_time"),
                        rule.get("project_id"),
                        rule["id"],
                        target_date_str,
                        now_str,
                        now_str,
                    ),
                )
    conn.commit()


def create_recurring_rule(title, description="", priority="normal", frequency="daily", interval_val=1, by_weekdays=None, start_date=None, end_date=None, due_time=None, project_id=None):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        rule_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        start = start_date or datetime.now().strftime("%Y-%m-%d")
        weekdays_json = json.dumps(by_weekdays if by_weekdays is not None else [])

        cur.execute(
            """
            INSERT INTO recurring_rules 
            (id, title, description, priority, project_id, frequency, interval_val, by_weekdays, start_date, end_date, due_time, cancelled_dates, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 1, ?, ?)
            """,
            (rule_id, title.strip(), description, priority, project_id, frequency, int(interval_val), weekdays_json, start, end_date, due_time, now_str, now_str),
        )
        conn.commit()

        # Materialize today's occurrence if rule applies
        today_str = datetime.now().strftime("%Y-%m-%d")
        materialize_recurring_tasks(conn, today_str)

        cur.execute("SELECT * FROM recurring_rules WHERE id = ?", (rule_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_recurring_rules():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM recurring_rules WHERE is_active = 1 ORDER BY created_at DESC")
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_recurring_rule_by_id(rule_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM recurring_rules WHERE id = ?", (rule_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# ============================================================================
# Two-Level Tasks Data Access Methods (Today Tasks)
# ============================================================================
def get_tasks(filter_status="all", task_date=None):
    """
    Retrieves daily tasks.
    Automatically materializes any active recurring tasks for task_date idempotently.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        effective_date = task_date or datetime.now().strftime("%Y-%m-%d")

        # Materialize recurring tasks for the target calendar date
        materialize_recurring_tasks(conn, effective_date)

        sql = """
            SELECT t.*, 
                   p.title AS project_title, p.color AS project_color,
                   r.frequency AS rule_frequency, r.interval_val AS rule_interval, 
                   r.by_weekdays AS rule_weekdays, r.is_active AS rule_is_active
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN recurring_rules r ON t.recurring_rule_id = r.id
            WHERE 1=1
        """
        params = []

        if task_date:
            sql += " AND (t.task_date = ? OR (t.task_date IS NULL AND ? = ?))"
            params.extend([task_date, task_date, datetime.now().strftime("%Y-%m-%d")])

        if filter_status == "pending":
            sql += " AND t.is_completed = 0"
        elif filter_status == "completed":
            sql += " AND t.is_completed = 1"

        sql += " ORDER BY t.is_completed ASC, CASE t.priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.created_at DESC"
        cur.execute(sql, params)
        rows = cur.fetchall()
        task_list = [dict(row) for row in rows]

        if task_list:
            task_ids = [t["id"] for t in task_list]
            placeholders = ",".join(["?"] * len(task_ids))
            cur.execute(
                f"SELECT * FROM subtasks WHERE task_id IN ({placeholders}) ORDER BY sort_order ASC, created_at ASC",
                task_ids,
            )
            subtask_rows = [dict(r) for r in cur.fetchall()]
            subtasks_by_task = {}
            for s in subtask_rows:
                subtasks_by_task.setdefault(s["task_id"], []).append(s)

            for t in task_list:
                t["subtasks"] = subtasks_by_task.get(t["id"], [])
                t["subtask_count"] = len(t["subtasks"])
                t["subtask_completed_count"] = sum(1 for s in t["subtasks"] if s.get("is_completed"))
        return task_list
    finally:
        conn.close()


def create_task(title, description="", priority="normal", task_date=None, due_time=None, project_id=None, recurring=None, reminder=None, user_id="default_user"):
    """
    Creates a task. If recurring dict is provided, creates a recurring rule
    and links the newly created task occurrence to it.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        task_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        assigned_date = task_date or datetime.now().strftime("%Y-%m-%d")

        rule_id = None
        if recurring and isinstance(recurring, dict) and recurring.get("frequency"):
            rule_id = str(uuid.uuid4())
            freq = recurring.get("frequency", "daily")
            interval_val = int(recurring.get("interval_val", 1))
            weekdays = recurring.get("by_weekdays", [])
            end_date = recurring.get("end_date", None)
            weekdays_json = json.dumps(weekdays)

            cur.execute(
                """
                INSERT INTO recurring_rules 
                (id, title, description, priority, project_id, frequency, interval_val, by_weekdays, start_date, end_date, due_time, cancelled_dates, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 1, ?, ?)
                """,
                (rule_id, title.strip(), description, priority, project_id, freq, interval_val, weekdays_json, assigned_date, end_date, due_time, now_str, now_str),
            )

        cur.execute(
            """
            INSERT INTO tasks (id, user_id, title, description, priority, task_date, due_time, reminder, project_id, recurring_rule_id, original_date, is_completed, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (task_id, user_id, title.strip(), description, priority, assigned_date, due_time, reminder, project_id, rule_id, assigned_date, now_str, now_str),
        )
        conn.commit()
        cur.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def toggle_task(task_id, is_completed):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        completed_at = now_str if is_completed else None

        cur.execute(
            """
            UPDATE tasks 
            SET is_completed = ?, completed_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (int(is_completed), completed_at, now_str, task_id),
        )
        conn.commit()

        # Retrieve milestone context for mascot celebration
        today_str = datetime.now().strftime("%Y-%m-%d")
        cur.execute("SELECT COUNT(*) AS total FROM tasks WHERE task_date = ?", (today_str,))
        total_tasks = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) AS completed FROM tasks WHERE task_date = ? AND is_completed = 1", (today_str,))
        completed_tasks = cur.fetchone()[0]

        milestone = None
        if is_completed:
            if total_tasks > 0 and completed_tasks == total_tasks:
                milestone = "all_completed"
            elif completed_tasks == 5:
                milestone = "five_completed"
            elif completed_tasks == 1:
                milestone = "first_completed"
            else:
                milestone = "standard"

        return {
            "task_id": task_id,
            "is_completed": bool(is_completed),
            "milestone": milestone,
            "completed_today": completed_tasks,
            "total_today": total_tasks,
        }
    finally:
        conn.close()


def reschedule_task(task_id, new_date):
    """Reschedules a task to a different calendar date."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            UPDATE tasks
            SET task_date = ?, is_recurrence_exception = 1, updated_at = ?
            WHERE id = ?
            """,
            (new_date, now_str, task_id),
        )
        conn.commit()
        cur.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_task_with_scope(task_id, data, scope="this"):
    """
    Updates a task with recurrence scope:
    - 'this': modifies this single occurrence (marks recurrence exception)
    - 'future': modifies recurring rule and future uncompleted occurrences
    - 'all': modifies recurring rule and all associated tasks
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()

        cur.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        task_row = cur.fetchone()
        if not task_row:
            return None
        task = dict(task_row)

        rule_id = task.get("recurring_rule_id")
        title = data.get("title", task["title"]).strip()
        description = data.get("description", task.get("description", ""))
        priority = data.get("priority", task.get("priority", "normal"))
        due_time = data.get("due_time", task.get("due_time"))
        reminder = data.get("reminder", task.get("reminder"))

        if not rule_id or scope == "this":
            cur.execute(
                """
                UPDATE tasks
                SET title = ?, description = ?, priority = ?, due_time = ?, reminder = ?, is_recurrence_exception = 1, updated_at = ?
                WHERE id = ?
                """,
                (title, description, priority, due_time, reminder, now_str, task_id),
            )
        elif scope == "future":
            # Update recurring rule
            cur.execute(
                """
                UPDATE recurring_rules
                SET title = ?, description = ?, priority = ?, due_time = ?, updated_at = ?
                WHERE id = ?
                """,
                (title, description, priority, due_time, now_str, rule_id),
            )
            # Update current and future uncompleted occurrences
            cur.execute(
                """
                UPDATE tasks
                SET title = ?, description = ?, priority = ?, due_time = ?, updated_at = ?
                WHERE recurring_rule_id = ? AND task_date >= ? AND is_completed = 0
                """,
                (title, description, priority, due_time, now_str, rule_id, task["task_date"]),
            )
        elif scope == "all":
            cur.execute(
                """
                UPDATE recurring_rules
                SET title = ?, description = ?, priority = ?, due_time = ?, updated_at = ?
                WHERE id = ?
                """,
                (title, description, priority, due_time, now_str, rule_id),
            )
            cur.execute(
                """
                UPDATE tasks
                SET title = ?, description = ?, priority = ?, due_time = ?, updated_at = ?
                WHERE recurring_rule_id = ?
                """,
                (title, description, priority, due_time, now_str, rule_id),
            )

        conn.commit()
        cur.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def delete_task(task_id, scope="this"):
    """
    Deletes a task with recurrence scope:
    - 'this': deletes only this specific occurrence
    - 'future': ends recurring rule before this date and removes this + future occurrences
    - 'all': deletes recurring rule and all associated occurrences
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        task_row = cur.fetchone()
        if not task_row:
            return False
        task = dict(task_row)

        rule_id = task.get("recurring_rule_id")

        if not rule_id or scope == "this":
            if rule_id and scope == "this":
                cur.execute("SELECT cancelled_dates FROM recurring_rules WHERE id = ?", (rule_id,))
                rule_row = cur.fetchone()
                if rule_row:
                    try:
                        c_dates = json.loads(rule_row[0] or "[]")
                    except Exception:
                        c_dates = []
                    if task.get("task_date") and task["task_date"] not in c_dates:
                        c_dates.append(task["task_date"])
                        cur.execute(
                            "UPDATE recurring_rules SET cancelled_dates = ?, updated_at = ? WHERE id = ?",
                            (json.dumps(c_dates), datetime.now(timezone.utc).isoformat(), rule_id),
                        )
            cur.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        elif scope == "future":
            # End rule before this task_date
            task_d = datetime.strptime(task["task_date"], "%Y-%m-%d").date()
            from datetime import timedelta
            yesterday_str = (task_d - timedelta(days=1)).strftime("%Y-%m-%d")

            cur.execute(
                "UPDATE recurring_rules SET end_date = ? WHERE id = ?",
                (yesterday_str, rule_id),
            )
            cur.execute(
                "DELETE FROM tasks WHERE recurring_rule_id = ? AND task_date >= ?",
                (rule_id, task["task_date"]),
            )
        elif scope == "all":
            cur.execute("DELETE FROM tasks WHERE recurring_rule_id = ?", (rule_id,))
            cur.execute("DELETE FROM recurring_rules WHERE id = ?", (rule_id,))

        conn.commit()
        return True
    finally:
        conn.close()


# ============================================================================
# Subtasks and Checklists Data Access Methods (Feature Two)
# ============================================================================
def get_subtasks(task_id):
    """Retrieves all subtasks for a task ordered by sort_order and created_at."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT * FROM subtasks 
            WHERE task_id = ? 
            ORDER BY sort_order ASC, created_at ASC
            """,
            (task_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def create_subtask(task_id, title):
    """Creates a new subtask attached to a parent task."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        subtask_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()

        cur.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM subtasks WHERE task_id = ?", (task_id,))
        next_order = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO subtasks (id, task_id, title, is_completed, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, 0, ?, ?, ?)
            """,
            (subtask_id, task_id, title.strip(), next_order, now_str, now_str),
        )
        conn.commit()

        cur.execute("SELECT * FROM subtasks WHERE id = ?", (subtask_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def update_subtask(subtask_id, data):
    """Updates subtask title or sort order."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()

        cur.execute("SELECT * FROM subtasks WHERE id = ?", (subtask_id,))
        row = cur.fetchone()
        if not row:
            return None
        existing = dict(row)

        title = data.get("title", existing["title"]).strip()
        sort_order = data.get("sort_order", existing["sort_order"])

        cur.execute(
            """
            UPDATE subtasks 
            SET title = ?, sort_order = ?, updated_at = ?
            WHERE id = ?
            """,
            (title, sort_order, now_str, subtask_id),
        )
        conn.commit()

        cur.execute("SELECT * FROM subtasks WHERE id = ?", (subtask_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def toggle_subtask(subtask_id, is_completed):
    """
    Toggles completion state of a subtask and calculates completion progress
    for the parent task.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()

        cur.execute("SELECT * FROM subtasks WHERE id = ?", (subtask_id,))
        subtask_row = cur.fetchone()
        if not subtask_row:
            return None
        subtask = dict(subtask_row)
        task_id = subtask["task_id"]

        cur.execute(
            """
            UPDATE subtasks 
            SET is_completed = ?, updated_at = ?
            WHERE id = ?
            """,
            (int(is_completed), now_str, subtask_id),
        )
        conn.commit()

        # Compute parent task checklist progress
        cur.execute("SELECT COUNT(*) FROM subtasks WHERE task_id = ?", (task_id,))
        total_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM subtasks WHERE task_id = ? AND is_completed = 1", (task_id,))
        completed_count = cur.fetchone()[0]

        all_completed = (total_count > 0 and completed_count == total_count)

        cur.execute("SELECT * FROM subtasks WHERE id = ?", (subtask_id,))
        updated_subtask = dict(cur.fetchone())

        return {
            "subtask": updated_subtask,
            "task_id": task_id,
            "total_subtasks": total_count,
            "completed_subtasks": completed_count,
            "all_completed": all_completed,
        }
    finally:
        conn.close()


def delete_subtask(subtask_id):
    """Deletes a subtask."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT task_id FROM subtasks WHERE id = ?", (subtask_id,))
        row = cur.fetchone()
        if not row:
            return False

        cur.execute("DELETE FROM subtasks WHERE id = ?", (subtask_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def reorder_subtasks(task_id, subtask_ids):
    """Reorders subtasks according to an ordered list of IDs."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        for idx, sid in enumerate(subtask_ids):
            cur.execute(
                "UPDATE subtasks SET sort_order = ?, updated_at = ? WHERE id = ? AND task_id = ?",
                (idx, now_str, sid, task_id),
            )
        conn.commit()
        return get_subtasks(task_id)
    finally:
        conn.close()


# ============================================================================
# Monthly Tasks & Projects Data Access Methods
# ============================================================================
def get_projects(status_filter=None, month=None):
    """
    Retrieves all projects with computed milestone completion rates.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        sql = "SELECT * FROM projects WHERE 1=1"
        params = []

        if status_filter == "active":
            sql += " AND status IN ('not_started', 'in_progress', 'on_hold')"
        elif status_filter == "completed":
            sql += " AND status = 'completed'"
        elif status_filter:
            sql += " AND status = ?"
            params.append(status_filter)

        if month:
            sql += " AND deadline LIKE ?"
            params.append(f"{month}%")

        sql += " ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'not_started' THEN 2 WHEN 'on_hold' THEN 3 ELSE 4 END, deadline ASC"
        cur.execute(sql, params)
        projects = [dict(p) for p in cur.fetchall()]

        # Compute milestone counts for each project
        for p in projects:
            cur.execute("SELECT COUNT(*) AS total FROM project_milestones WHERE project_id = ?", (p["id"],))
            total_m = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) AS completed FROM project_milestones WHERE project_id = ? AND is_completed = 1", (p["id"],))
            completed_m = cur.fetchone()[0]

            p["milestone_total"] = total_m
            p["milestone_completed"] = completed_m
            if total_m > 0:
                p["progress_percent"] = round((completed_m / total_m * 100))
            else:
                p["progress_percent"] = p.get("progress", 0) or 0

        return projects
    finally:
        conn.close()


def get_project_by_id(project_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cur.fetchone()
        if not row:
            return None
        project = dict(row)

        # Retrieve milestones
        cur.execute("SELECT * FROM project_milestones WHERE project_id = ? ORDER BY is_completed ASC, deadline ASC", (project_id,))
        milestones = [dict(m) for m in cur.fetchall()]
        project["milestones"] = milestones

        total_m = len(milestones)
        completed_m = sum(1 for m in milestones if m["is_completed"])
        project["milestone_total"] = total_m
        project["milestone_completed"] = completed_m
        if total_m > 0:
            project["progress_percent"] = round((completed_m / total_m * 100))
        else:
            project["progress_percent"] = project.get("progress", 0) or 0

        return project
    finally:
        conn.close()


def create_project(title, description="", status="in_progress", start_date=None, deadline=None, color="#4f46e5", progress=0, notes="", attachments=None, user_id="default_user"):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        project_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        start = start_date or datetime.now().strftime("%Y-%m-%d")
        attach_json = json.dumps(attachments if isinstance(attachments, list) else [])

        cur.execute(
            """
            INSERT INTO projects (id, user_id, title, description, status, start_date, deadline, progress, notes, attachments, color, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (project_id, user_id, title.strip(), description, status, start, deadline, int(progress or 0), notes or "", attach_json, color, now_str, now_str),
        )
        conn.commit()
        return get_project_by_id(project_id)
    finally:
        conn.close()


def update_project(project_id, title, description="", status="in_progress", start_date=None, deadline=None, color="#4f46e5", progress=None, notes=None, attachments=None):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cur.fetchone()
        if not row:
            return None
        existing = dict(row)

        upd_start = start_date if start_date is not None else existing.get("start_date")
        upd_prog = int(progress) if progress is not None else existing.get("progress", 0)
        upd_notes = notes if notes is not None else existing.get("notes", "")
        if attachments is not None:
            upd_attach = json.dumps(attachments if isinstance(attachments, list) else [])
        else:
            upd_attach = existing.get("attachments", "[]")

        cur.execute(
            """
            UPDATE projects
            SET title = ?, description = ?, status = ?, start_date = ?, deadline = ?, progress = ?, notes = ?, attachments = ?, color = ?, updated_at = ?
            WHERE id = ?
            """,
            (title.strip(), description, status, upd_start, deadline, upd_prog, upd_notes, upd_attach, color, now_str, project_id),
        )
        conn.commit()
        return get_project_by_id(project_id)
    finally:
        conn.close()


def delete_project(project_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM project_milestones WHERE project_id = ?", (project_id,))
        cur.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def create_milestone(project_id, title, deadline=None, priority="normal"):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        m_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            INSERT INTO project_milestones (id, project_id, title, is_completed, deadline, priority, created_at, updated_at)
            VALUES (?, ?, ?, 0, ?, ?, ?, ?)
            """,
            (m_id, project_id, title.strip(), deadline, priority, now_str, now_str),
        )
        conn.commit()
        cur.execute("SELECT * FROM project_milestones WHERE id = ?", (m_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def toggle_milestone(milestone_id, is_completed):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            UPDATE project_milestones
            SET is_completed = ?, updated_at = ?
            WHERE id = ?
            """,
            (int(is_completed), now_str, milestone_id),
        )
        # Sync project status with milestone completion
        cur.execute("SELECT project_id FROM project_milestones WHERE id = ?", (milestone_id,))
        m_row = cur.fetchone()
        if m_row:
            p_id = m_row["project_id"] if isinstance(m_row, dict) or hasattr(m_row, "keys") else m_row[0]
            cur.execute("SELECT COUNT(*) AS total FROM project_milestones WHERE project_id = ?", (p_id,))
            t_row = cur.fetchone()
            total_m = t_row["total"] if isinstance(t_row, dict) or hasattr(t_row, "keys") else t_row[0]
            cur.execute("SELECT COUNT(*) AS completed FROM project_milestones WHERE project_id = ? AND is_completed = 1", (p_id,))
            c_row = cur.fetchone()
            completed_m = c_row["completed"] if isinstance(c_row, dict) or hasattr(c_row, "keys") else c_row[0]

            if total_m > 0 and completed_m == total_m:
                cur.execute("UPDATE projects SET status = 'completed', updated_at = ? WHERE id = ?", (now_str, p_id))
            elif total_m > 0 and completed_m < total_m:
                cur.execute("UPDATE projects SET status = 'in_progress', updated_at = ? WHERE id = ? AND status = 'completed'", (now_str, p_id))

        conn.commit()
        cur.execute("SELECT * FROM project_milestones WHERE id = ?", (milestone_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def delete_milestone(milestone_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM project_milestones WHERE id = ?", (milestone_id,))
        conn.commit()
        return True
    finally:
        conn.close()


# ============================================================================
# Notes Data Access Methods (Templates & Blocks)
# ============================================================================
def get_notes(search_query=None, sort="updated"):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        sql = "SELECT * FROM notes"
        params = []

        if search_query:
            sql += " WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?"
            term = f"%{search_query}%"
            params.extend([term, term, term])

        if sort == "title":
            sql += " ORDER BY title ASC"
        else:
            sql += " ORDER BY is_pinned DESC, updated_at DESC"

        cur.execute(sql, params)
        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_note_by_id(note_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_note(title, content="", tags="", is_pinned=0, template_type="blank"):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        note_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            INSERT INTO notes (id, title, content, tags, is_pinned, template_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (note_id, title.strip(), content, tags.strip(), int(is_pinned), template_type, now_str, now_str),
        )
        conn.commit()
        return get_note_by_id(note_id)
    finally:
        conn.close()


def update_note(note_id, title, content, tags="", is_pinned=0, template_type="blank"):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            UPDATE notes 
            SET title = ?, content = ?, tags = ?, is_pinned = ?, template_type = ?, updated_at = ?
            WHERE id = ?
            """,
            (title.strip(), content, tags.strip(), int(is_pinned), template_type, now_str, note_id),
        )
        conn.commit()
        return get_note_by_id(note_id)
    finally:
        conn.close()


def delete_note(note_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        conn.commit()
        return True
    finally:
        conn.close()


# ============================================================================
# Journals Data Access Methods
# ============================================================================
def get_journals(limit=30):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM journals ORDER BY entry_date DESC, created_at DESC LIMIT ?", (limit,))
        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def create_journal(entry_date, content, mood="good", tags=""):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        journal_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            INSERT INTO journals (id, entry_date, content, mood, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (journal_id, entry_date, content.strip(), mood, tags.strip(), now_str, now_str),
        )
        conn.commit()
        cur.execute("SELECT * FROM journals WHERE id = ?", (journal_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def delete_journal(journal_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM journals WHERE id = ?", (journal_id,))
        conn.commit()
        return True
    finally:
        conn.close()


# ============================================================================
# Memories Data Access Methods (Personal Digital Diary & Memories Album)
# ============================================================================
def get_memories(date=None, month=None, query=None, limit=100):
    """
    Retrieves memories, optionally filtered by exact date ('YYYY-MM-DD'),
    month ('YYYY-MM'), or search query keyword.
    Returns memories sorted by date DESC, time DESC.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        sql = "SELECT * FROM memories WHERE 1=1"
        params = []
        if date:
            sql += " AND date = ?"
            params.append(date)
        elif month:
            sql += " AND date LIKE ?"
            params.append(f"{month}%")

        if query:
            sql += " AND (title LIKE ? OR journal_text LIKE ? OR location LIKE ? OR tags LIKE ?)"
            q_param = f"%{query}%"
            params.extend([q_param, q_param, q_param, q_param])

        sql += " ORDER BY date DESC, time DESC, created_at DESC LIMIT ?"
        params.append(limit)
        cur.execute(sql, params)
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            if isinstance(r.get("photos"), str):
                try:
                    r["photos"] = json.loads(r["photos"])
                except Exception:
                    r["photos"] = []
            elif r.get("photos") is None:
                r["photos"] = []
            if isinstance(r.get("tags"), str):
                try:
                    r["tags"] = json.loads(r["tags"])
                except Exception:
                    r["tags"] = [t.strip() for t in r["tags"].split(",") if t.strip()] if r.get("tags") else []
            elif r.get("tags") is None:
                r["tags"] = []
        return rows
    finally:
        conn.close()


def get_memory_by_id(memory_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM memories WHERE id = ?", (memory_id,))
        row = cur.fetchone()
        if not row:
            return None
        m = dict(row)
        if isinstance(m.get("photos"), str):
            try:
                m["photos"] = json.loads(m["photos"])
            except Exception:
                m["photos"] = []
        elif m.get("photos") is None:
            m["photos"] = []
        if isinstance(m.get("tags"), str):
            try:
                m["tags"] = json.loads(m["tags"])
            except Exception:
                m["tags"] = [t.strip() for t in m["tags"].split(",") if t.strip()] if m.get("tags") else []
        elif m.get("tags") is None:
            m["tags"] = []
        return m
    finally:
        conn.close()


def create_memory(title=None, journal_text="", date=None, time=None, location="", mood="😊 Happy", photos=None, tags=None, user_id="default_user"):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        mem_id = str(uuid.uuid4())
        now_dt = datetime.now()
        now_str = datetime.now(timezone.utc).isoformat()
        mem_date = date or now_dt.strftime("%Y-%m-%d")
        mem_time = time or now_dt.strftime("%I:%M %p")

        # Fallback title if user leaves title optional
        safe_title = (title or "").strip()
        if not safe_title:
            try:
                date_parsed = datetime.strptime(mem_date, "%Y-%m-%d")
                safe_title = f"Entry for {date_parsed.strftime('%b %d, %Y')}"
            except Exception:
                safe_title = "Diary Entry"

        photos_json = json.dumps(photos if isinstance(photos, list) else [])
        if isinstance(tags, list):
            tags_json = json.dumps(tags)
        elif isinstance(tags, str):
            tags_list = [t.strip().lstrip("#") for t in tags.split(",") if t.strip()]
            tags_json = json.dumps(tags_list)
        else:
            tags_json = "[]"

        cur.execute(
            """
            INSERT INTO memories 
            (id, user_id, title, journal_text, date, time, timestamp, location, mood, photos, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (mem_id, user_id, safe_title, journal_text.strip(), mem_date, mem_time, now_str, (location or "").strip(), mood, photos_json, tags_json, now_str, now_str)
        )
        conn.commit()
        return get_memory_by_id(mem_id)
    finally:
        conn.close()


def update_memory(memory_id, title=None, journal_text="", date=None, time=None, location="", mood="😊 Happy", photos=None, tags=None):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()

        safe_title = (title or "").strip()
        if not safe_title:
            if date:
                try:
                    date_parsed = datetime.strptime(date, "%Y-%m-%d")
                    safe_title = f"Entry for {date_parsed.strftime('%b %d, %Y')}"
                except Exception:
                    safe_title = "Diary Entry"
            else:
                safe_title = "Diary Entry"

        photos_json = json.dumps(photos if isinstance(photos, list) else [])
        if isinstance(tags, list):
            tags_json = json.dumps(tags)
        elif isinstance(tags, str):
            tags_list = [t.strip().lstrip("#") for t in tags.split(",") if t.strip()]
            tags_json = json.dumps(tags_list)
        else:
            tags_json = "[]"

        cur.execute(
            """
            UPDATE memories
            SET title = ?, journal_text = ?, date = ?, time = ?, location = ?, mood = ?, photos = ?, tags = ?, updated_at = ?
            WHERE id = ?
            """,
            (safe_title, journal_text.strip(), date, time, (location or "").strip(), mood, photos_json, tags_json, now_str, memory_id)
        )
        conn.commit()
        return get_memory_by_id(memory_id)
    finally:
        conn.close()


def delete_memory(memory_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def get_memory_calendar_dots(month=None):
    """
    Returns a list of date strings (['YYYY-MM-DD', ...]) that have memories.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        sql = "SELECT DISTINCT date FROM memories WHERE date IS NOT NULL"
        params = []
        if month:
            sql += " AND date LIKE ?"
            params.append(f"{month}%")
        cur.execute(sql, params)
        rows = cur.fetchall()
        return [r[0] if isinstance(r, (tuple, list)) else r["date"] for r in rows]
    finally:
        conn.close()


def get_task_calendar_dots(month=None):
    """
    Returns a list of date strings (['YYYY-MM-DD', ...]) that have active or scheduled tasks.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        sql = "SELECT DISTINCT task_date FROM tasks WHERE task_date IS NOT NULL"
        params = []
        if month:
            sql += " AND task_date LIKE ?"
            params.append(f"{month}%")
        cur.execute(sql, params)
        rows = cur.fetchall()
        return [r[0] if isinstance(r, (tuple, list)) else r["task_date"] for r in rows]
    finally:
        conn.close()


# ============================================================================
# Dashboard & Search Aggregations
# ============================================================================
def get_dashboard_data(today_date=None):
    today_str = today_date or datetime.now().strftime("%Y-%m-%d")
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        # Today's tasks count
        cur.execute("SELECT COUNT(*) FROM tasks WHERE task_date = ?", (today_str,))
        today_total = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM tasks WHERE task_date = ? AND is_completed = 1", (today_str,))
        today_completed = cur.fetchone()[0]

        today_pending = today_total - today_completed
        focus_score = round((today_completed / today_total * 100)) if today_total > 0 else 100

        # Total notes count
        cur.execute("SELECT COUNT(*) FROM notes")
        total_notes = cur.fetchone()[0]

        # Active projects count
        cur.execute("SELECT COUNT(*) FROM projects WHERE status = 'in_progress'")
        active_projects_count = cur.fetchone()[0]

        # Recent 3 notes
        cur.execute("SELECT * FROM notes ORDER BY is_pinned DESC, updated_at DESC LIMIT 3")
        recent_notes = [dict(r) for r in cur.fetchall()]

        # Today's tasks (up to 4)
        cur.execute(
            """
            SELECT t.*, p.title AS project_title, p.color AS project_color,
                   r.frequency AS rule_frequency, r.interval_val AS rule_interval, 
                   r.by_weekdays AS rule_weekdays, r.is_active AS rule_is_active
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN recurring_rules r ON t.recurring_rule_id = r.id
            WHERE t.task_date = ?
            ORDER BY t.is_completed ASC, t.created_at DESC 
            LIMIT 4
            """,
            (today_str,),
        )
        recent_tasks = [dict(r) for r in cur.fetchall()]

        if recent_tasks:
            task_ids = [t["id"] for t in recent_tasks]
            placeholders = ",".join(["?"] * len(task_ids))
            cur.execute(
                f"SELECT * FROM subtasks WHERE task_id IN ({placeholders}) ORDER BY sort_order ASC, created_at ASC",
                task_ids,
            )
            subtask_rows = [dict(r) for r in cur.fetchall()]
            subtasks_by_task = {}
            for s in subtask_rows:
                subtasks_by_task.setdefault(s["task_id"], []).append(s)

            for t in recent_tasks:
                t["subtasks"] = subtasks_by_task.get(t["id"], [])
                t["subtask_count"] = len(t["subtasks"])
                t["subtask_completed_count"] = sum(1 for s in t["subtasks"] if s.get("is_completed"))

        # Active monthly projects (up to 3)
        projects = get_projects(status_filter="active")[:3]

        # Most recent memory for Dashboard
        cur.execute("SELECT * FROM memories ORDER BY date DESC, time DESC, created_at DESC LIMIT 1")
        mem_row = cur.fetchone()
        recent_memory = None
        if mem_row:
            recent_memory = dict(mem_row)
            if isinstance(recent_memory.get("photos"), str):
                try:
                    recent_memory["photos"] = json.loads(recent_memory["photos"])
                except Exception:
                    recent_memory["photos"] = []
            if isinstance(recent_memory.get("tags"), str):
                try:
                    recent_memory["tags"] = json.loads(recent_memory["tags"])
                except Exception:
                    recent_memory["tags"] = []

        return {
            "today_date": today_str,
            "today_total": today_total,
            "today_completed": today_completed,
            "today_pending": today_pending,
            "focus_score": focus_score,
            "total_notes": total_notes,
            "active_projects_count": active_projects_count,
            "recent_notes": recent_notes,
            "recent_tasks": recent_tasks,
            "active_projects": projects,
            "recent_memory": recent_memory,
        }
    finally:
        conn.close()


def search_all(query):
    if not query or len(query.strip()) < 2:
        return {"notes": [], "tasks": [], "projects": [], "journals": []}

    term = f"%{query.strip()}%"
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        cur.execute("SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? LIMIT 10", (term, term))
        notes = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM tasks WHERE title LIKE ? OR description LIKE ? LIMIT 10", (term, term))
        tasks = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM projects WHERE title LIKE ? OR description LIKE ? LIMIT 10", (term, term))
        projects = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM journals WHERE content LIKE ? LIMIT 10", (term, term))
        journals = [dict(r) for r in cur.fetchall()]

        return {"notes": notes, "tasks": tasks, "projects": projects, "journals": journals}
    finally:
        conn.close()


# ============================================================================
# Full Workspace Export & Backup Helper (Section 22)
# ============================================================================
def export_all_data():
    """Exports entire database contents as structured JSON for user backup."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        cur.execute("SELECT * FROM notes")
        notes = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM tasks")
        tasks = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM projects")
        projects = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM project_milestones")
        milestones = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM journals")
        journals = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM user_preferences")
        preferences = [dict(r) for r in cur.fetchall()]

        return {
            "app": "Daybook",
            "version": "1.3.0",
            "export_date": datetime.now(timezone.utc).isoformat(),
            "notes": notes,
            "tasks": tasks,
            "projects": projects,
            "project_milestones": milestones,
            "journals": journals,
            "preferences": preferences,
        }
    finally:
        conn.close()


# ============================================================================
# Analytics & Consistency Engine (Weekly & Monthly Progress)
# ============================================================================
def get_analytics_data(user_id="default_user", reference_date=None):
    """
    Computes weekly and monthly task consistency, streaks, completion counts,
    and visual progress matrices for the dedicated Analytics Dashboard.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        if reference_date:
            try:
                ref = datetime.strptime(reference_date, "%Y-%m-%d")
            except Exception:
                ref = datetime.now()
        else:
            ref = datetime.now()
        today_str = ref.strftime("%Y-%m-%d")

        # 1. Fetch all tasks with valid task_date
        cur.execute("SELECT id, title, task_date, is_completed, created_at FROM tasks WHERE task_date IS NOT NULL ORDER BY task_date ASC")
        rows = [dict(r) for r in cur.fetchall()]

        # Group tasks by date string
        tasks_by_date = {}
        for r in rows:
            d = r.get("task_date")
            if not d:
                continue
            tasks_by_date.setdefault(d, []).append(r)

        # 2. Streak Calculation
        all_dates_with_tasks = sorted([d for d in tasks_by_date.keys() if d <= today_str])

        current_streak = 0
        best_streak = 0

        # Check today's progress
        today_tasks = tasks_by_date.get(today_str, [])
        today_total = len(today_tasks)
        today_done = sum(1 for t in today_tasks if t.get("is_completed"))

        date_cursor = ref.date()
        if today_total > 0 and today_done == today_total:
            start_check_date = date_cursor
        elif today_total > 0 and today_done < today_total:
            start_check_date = date_cursor - timedelta(days=1)
        else:
            start_check_date = date_cursor - timedelta(days=1)

        check_d = start_check_date
        while True:
            d_str = check_d.strftime("%Y-%m-%d")
            d_tasks = tasks_by_date.get(d_str)
            if d_tasks is not None:
                d_total = len(d_tasks)
                d_done = sum(1 for t in d_tasks if t.get("is_completed"))
                if d_total > 0 and d_done == d_total:
                    current_streak += 1
                    check_d -= timedelta(days=1)
                else:
                    break
            else:
                break

        # Calculate best_streak across all history
        if all_dates_with_tasks:
            try:
                min_date = datetime.strptime(all_dates_with_tasks[0], "%Y-%m-%d").date()
                max_date = ref.date()
                temp_d = min_date
                temp_streak = 0
                while temp_d <= max_date:
                    d_str = temp_d.strftime("%Y-%m-%d")
                    d_tasks = tasks_by_date.get(d_str)
                    if d_tasks is not None:
                        d_total = len(d_tasks)
                        d_done = sum(1 for t in d_tasks if t.get("is_completed"))
                        if d_total > 0 and d_done == d_total:
                            temp_streak += 1
                            if temp_streak > best_streak:
                                best_streak = temp_streak
                        else:
                            temp_streak = 0
                    else:
                        temp_streak = 0
                    temp_d += timedelta(days=1)
            except Exception:
                best_streak = current_streak

        best_streak = max(best_streak, current_streak)

        # 3. Weekly Progress (Monday through Sunday of current week)
        curr_weekday = ref.weekday()  # 0 = Monday, 6 = Sunday
        monday_date = (ref - timedelta(days=curr_weekday)).date()

        week_days = []
        weekly_planned = 0
        weekly_completed = 0
        weekly_missed = 0
        weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

        for i in range(7):
            day_d = monday_date + timedelta(days=i)
            day_str = day_d.strftime("%Y-%m-%d")
            d_tasks = tasks_by_date.get(day_str, [])
            d_total = len(d_tasks)
            d_done = sum(1 for t in d_tasks if t.get("is_completed"))

            weekly_planned += d_total
            weekly_completed += d_done

            is_future = day_str > today_str
            is_today = day_str == today_str
            is_past = day_str < today_str

            if is_past and d_total > d_done:
                weekly_missed += (d_total - d_done)

            status = "empty"
            if d_total > 0:
                if d_done == d_total:
                    status = "completed"
                elif is_past:
                    status = "missed"
                elif is_today:
                    status = "in_progress"
                else:
                    status = "upcoming"
            elif is_future:
                status = "upcoming"

            week_days.append({
                "day_name": weekday_names[i],
                "date": day_str,
                "day_number": day_d.day,
                "total_tasks": d_total,
                "completed_tasks": d_done,
                "status": status,
                "is_today": is_today,
                "is_future": is_future,
                "is_past": is_past,
            })

        weekly_completion_pct = round((weekly_completed / weekly_planned * 100)) if weekly_planned > 0 else 0
        weekly_consistency_score = weekly_completion_pct

        def get_consistency_label(score, has_tasks):
            if not has_tasks:
                return "Build Your Routine"
            if score >= 90:
                return "Excellent"
            elif score >= 75:
                return "Very Good"
            elif score >= 60:
                return "Good"
            elif score >= 40:
                return "Needs Improvement"
            else:
                return "Build Your Routine"

        weekly_consistency_label = get_consistency_label(weekly_consistency_score, weekly_planned > 0)

        # 4. Monthly Progress (Current Month)
        year = ref.year
        month = ref.month
        num_days = calendar.monthrange(year, month)[1]

        monthly_planned = 0
        monthly_completed = 0
        monthly_missed = 0
        active_days_count = 0
        month_heatmap = []

        for d_num in range(1, num_days + 1):
            day_str = f"{year:04d}-{month:02d}-{d_num:02d}"
            d_tasks = tasks_by_date.get(day_str, [])
            d_total = len(d_tasks)
            d_done = sum(1 for t in d_tasks if t.get("is_completed"))

            monthly_planned += d_total
            monthly_completed += d_done

            is_future = day_str > today_str
            is_today = day_str == today_str
            is_past = day_str < today_str

            if is_past and d_total > d_done:
                monthly_missed += (d_total - d_done)

            if d_done > 0:
                active_days_count += 1

            level = 0
            if d_done > 0:
                if d_done == d_total or d_done >= 3:
                    level = 3
                elif d_done >= 2 or (d_total > 0 and d_done / d_total >= 0.5):
                    level = 2
                else:
                    level = 1

            month_heatmap.append({
                "day_number": d_num,
                "date": day_str,
                "total_tasks": d_total,
                "completed_tasks": d_done,
                "level": level,
                "is_today": is_today,
                "is_future": is_future,
                "is_past": is_past,
            })

        monthly_completion_pct = round((monthly_completed / monthly_planned * 100)) if monthly_planned > 0 else 0
        monthly_consistency_score = monthly_completion_pct
        monthly_consistency_label = get_consistency_label(monthly_consistency_score, monthly_planned > 0)

        first_weekday = datetime(year, month, 1).weekday()

        return {
            "current_date": today_str,
            "has_data": len(rows) > 0,
            "streaks": {
                "current_streak": current_streak,
                "best_streak": best_streak,
            },
            "weekly": {
                "planned": weekly_planned,
                "completed": weekly_completed,
                "missed": weekly_missed,
                "completion_percentage": weekly_completion_pct,
                "consistency_score": weekly_consistency_score,
                "consistency_label": weekly_consistency_label,
                "days": week_days,
            },
            "monthly": {
                "month_name": ref.strftime("%B"),
                "year": year,
                "first_weekday": first_weekday,
                "days_in_month": num_days,
                "planned": monthly_planned,
                "completed": monthly_completed,
                "missed": monthly_missed,
                "active_days": active_days_count,
                "completion_percentage": monthly_completion_pct,
                "consistency_score": monthly_consistency_score,
                "consistency_label": monthly_consistency_label,
                "heatmap": month_heatmap,
            },
        }
    finally:
        conn.close()


# ============================================================================
# Appearance & User Preferences
# ============================================================================
def get_preferences():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM user_preferences WHERE id = 'default_user'")
        row = cur.fetchone()
        if row:
            res = dict(row)
            try:
                res["dashboard_widgets"] = json.loads(res.get("dashboard_widgets") or "{}")
            except Exception:
                res["dashboard_widgets"] = {}
            if "companion_id" not in res or not res["companion_id"]:
                res["companion_id"] = "bear"
            if "companion_size" not in res or not res["companion_size"]:
                res["companion_size"] = "regular"
            if "companion_enabled" not in res:
                res["companion_enabled"] = 1
            if "victory_sound_enabled" not in res or res["victory_sound_enabled"] is None:
                res["victory_sound_enabled"] = 1
            if "victory_sound_volume" not in res or res["victory_sound_volume"] is None:
                res["victory_sound_volume"] = 0.7
            if "active_task_sound_id" not in res or not res["active_task_sound_id"]:
                res["active_task_sound_id"] = "default_victory"
            if "sound_event_mode" not in res or not res["sound_event_mode"]:
                res["sound_event_mode"] = "every_task"
            if "custom_bg_enabled" not in res or res["custom_bg_enabled"] is None:
                res["custom_bg_enabled"] = 0
            if "custom_bg_fit" not in res or not res["custom_bg_fit"]:
                res["custom_bg_fit"] = "cover"
            if "custom_bg_position" not in res or not res["custom_bg_position"]:
                res["custom_bg_position"] = "center"
            if "custom_bg_overlay_mode" not in res or not res["custom_bg_overlay_mode"]:
                res["custom_bg_overlay_mode"] = "dark"
            if "custom_bg_overlay_opacity" not in res or res["custom_bg_overlay_opacity"] is None:
                res["custom_bg_overlay_opacity"] = 0.45
            if "custom_bg_blur" not in res or res["custom_bg_blur"] is None:
                res["custom_bg_blur"] = 0
            if "custom_bg_dynamic_accent" not in res or res["custom_bg_dynamic_accent"] is None:
                res["custom_bg_dynamic_accent"] = 1
            if "custom_bg_accent_color" not in res:
                res["custom_bg_accent_color"] = None
            if "custom_bg_image_url" not in res:
                res["custom_bg_image_url"] = None
            if "user_name" not in res or res["user_name"] is None:
                res["user_name"] = ""
            if "user_age" not in res:
                res["user_age"] = None
            if "health_preferences" not in res or not res["health_preferences"]:
                res["health_preferences"] = {}
            elif isinstance(res["health_preferences"], str):
                try:
                    res["health_preferences"] = json.loads(res["health_preferences"])
                except Exception:
                    res["health_preferences"] = {}
            return res
        return {
            "theme_mode": "system",
            "accent_color": "#4f46e5",
            "font_size": "normal",
            "layout_density": "comfortable",
            "card_radius": "rounded",
            "dashboard_widgets": {
                "metrics": True,
                "focus_card": True,
                "quick_actions": True,
                "today_tasks": True,
                "monthly_projects": True,
                "recent_notes": True,
            },
            "mascot_enabled": 1,
            "mascot_sound": 0,
            "companion_id": "bear",
            "companion_name": "",
            "companion_size": "regular",
            "companion_enabled": 1,
            "companion_image_url": None,
            "victory_sound_enabled": 1,
            "victory_sound_volume": 0.7,
            "active_task_sound_id": "default_victory",
            "active_milestone_sound_id": None,
            "sound_event_mode": "every_task",
            "custom_bg_enabled": 0,
            "custom_bg_fit": "cover",
            "custom_bg_position": "center",
            "custom_bg_overlay_mode": "dark",
            "custom_bg_overlay_opacity": 0.45,
            "custom_bg_blur": 0,
            "custom_bg_dynamic_accent": 1,
            "custom_bg_accent_color": None,
            "custom_bg_image_url": None,
            "user_name": "",
            "user_age": None,
            "health_preferences": {},
        }
    finally:
        conn.close()


def update_preferences(data):
    existing = get_preferences()
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        
        widgets = data.get("dashboard_widgets", existing.get("dashboard_widgets", {}))
        widgets_json = json.dumps(widgets) if isinstance(widgets, dict) else json.dumps({})

        theme_mode = data.get("theme_mode", existing.get("theme_mode", "dark"))
        accent_color = data.get("accent_color", existing.get("accent_color", "#8b5cf6"))
        font_size = data.get("font_size", existing.get("font_size", "normal"))
        layout_density = data.get("layout_density", existing.get("layout_density", "comfortable"))
        card_radius = data.get("card_radius", existing.get("card_radius", "rounded"))

        companion_id = data.get("companion_id", data.get("selectedId", existing.get("companion_id", "bear")))
        companion_name = data.get("companion_name", data.get("customName", existing.get("companion_name", "")))
        companion_size = data.get("companion_size", data.get("size", existing.get("companion_size", "regular")))
        companion_enabled = int(data.get("companion_enabled", data.get("enabled", existing.get("companion_enabled", 1))))
        companion_image_url = data.get("companion_image_url", existing.get("companion_image_url", None))

        mascot_enabled = int(data.get("mascot_enabled", existing.get("mascot_enabled", 1)))
        mascot_sound = int(data.get("mascot_sound", existing.get("mascot_sound", 0)))

        victory_sound_enabled = int(data.get("victory_sound_enabled", existing.get("victory_sound_enabled", 1)))
        victory_sound_volume = float(data.get("victory_sound_volume", existing.get("victory_sound_volume", 0.7)))
        active_task_sound_id = data.get("active_task_sound_id", existing.get("active_task_sound_id", "default_victory"))
        active_milestone_sound_id = data.get("active_milestone_sound_id", existing.get("active_milestone_sound_id", None))
        sound_event_mode = data.get("sound_event_mode", existing.get("sound_event_mode", "every_task"))

        custom_bg_enabled = int(data.get("custom_bg_enabled", existing.get("custom_bg_enabled", 0)))
        custom_bg_fit = data.get("custom_bg_fit", existing.get("custom_bg_fit", "cover"))
        custom_bg_position = data.get("custom_bg_position", existing.get("custom_bg_position", "center"))
        custom_bg_overlay_mode = data.get("custom_bg_overlay_mode", existing.get("custom_bg_overlay_mode", "dark"))
        custom_bg_overlay_opacity = float(data.get("custom_bg_overlay_opacity", existing.get("custom_bg_overlay_opacity", 0.45)))
        custom_bg_blur = int(data.get("custom_bg_blur", existing.get("custom_bg_blur", 0)))
        custom_bg_dynamic_accent = int(data.get("custom_bg_dynamic_accent", existing.get("custom_bg_dynamic_accent", 1)))
        custom_bg_accent_color = data.get("custom_bg_accent_color", existing.get("custom_bg_accent_color", None))
        if "custom_bg_image_url" in data:
            custom_bg_image_url = data.get("custom_bg_image_url")
        else:
            custom_bg_image_url = existing.get("custom_bg_image_url", None)

        user_name = data.get("user_name", existing.get("user_name", ""))
        user_age = data.get("user_age", existing.get("user_age", None))
        health_prefs = data.get("health_preferences", existing.get("health_preferences", {}))
        health_prefs_json = json.dumps(health_prefs) if isinstance(health_prefs, (dict, list)) else "{}"

        cur.execute(
            """
            INSERT INTO user_preferences 
            (id, theme_mode, accent_color, font_size, layout_density, card_radius, dashboard_widgets, 
             mascot_enabled, mascot_sound, companion_id, companion_name, companion_size, companion_enabled, companion_image_url,
             victory_sound_enabled, victory_sound_volume, active_task_sound_id, active_milestone_sound_id, sound_event_mode,
             custom_bg_enabled, custom_bg_fit, custom_bg_position, custom_bg_overlay_mode, custom_bg_overlay_opacity,
             custom_bg_blur, custom_bg_dynamic_accent, custom_bg_accent_color, custom_bg_image_url, 
             user_name, user_age, health_preferences, updated_at)
            VALUES ('default_user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                theme_mode = excluded.theme_mode,
                accent_color = excluded.accent_color,
                font_size = excluded.font_size,
                layout_density = excluded.layout_density,
                card_radius = excluded.card_radius,
                dashboard_widgets = excluded.dashboard_widgets,
                mascot_enabled = excluded.mascot_enabled,
                mascot_sound = excluded.mascot_sound,
                companion_id = excluded.companion_id,
                companion_name = excluded.companion_name,
                companion_size = excluded.companion_size,
                companion_enabled = excluded.companion_enabled,
                companion_image_url = CASE 
                    WHEN excluded.companion_image_url IS NOT NULL THEN excluded.companion_image_url 
                    ELSE user_preferences.companion_image_url 
                END,
                victory_sound_enabled = excluded.victory_sound_enabled,
                victory_sound_volume = excluded.victory_sound_volume,
                active_task_sound_id = excluded.active_task_sound_id,
                active_milestone_sound_id = excluded.active_milestone_sound_id,
                sound_event_mode = excluded.sound_event_mode,
                custom_bg_enabled = excluded.custom_bg_enabled,
                custom_bg_fit = excluded.custom_bg_fit,
                custom_bg_position = excluded.custom_bg_position,
                custom_bg_overlay_mode = excluded.custom_bg_overlay_mode,
                custom_bg_overlay_opacity = excluded.custom_bg_overlay_opacity,
                custom_bg_blur = excluded.custom_bg_blur,
                custom_bg_dynamic_accent = excluded.custom_bg_dynamic_accent,
                custom_bg_accent_color = excluded.custom_bg_accent_color,
                custom_bg_image_url = excluded.custom_bg_image_url,
                user_name = excluded.user_name,
                user_age = excluded.user_age,
                health_preferences = excluded.health_preferences,
                updated_at = excluded.updated_at
            """,
            (
                theme_mode,
                accent_color,
                font_size,
                layout_density,
                card_radius,
                widgets_json,
                mascot_enabled,
                mascot_sound,
                companion_id,
                companion_name,
                companion_size,
                companion_enabled,
                companion_image_url,
                victory_sound_enabled,
                victory_sound_volume,
                active_task_sound_id,
                active_milestone_sound_id,
                sound_event_mode,
                custom_bg_enabled,
                custom_bg_fit,
                custom_bg_position,
                custom_bg_overlay_mode,
                custom_bg_overlay_opacity,
                custom_bg_blur,
                custom_bg_dynamic_accent,
                custom_bg_accent_color,
                custom_bg_image_url,
                user_name,
                user_age,
                health_prefs_json,
                now_str,
            ),
        )
        conn.commit()
        return get_preferences()
    finally:
        conn.close()


# ============================================================================
# Quick Capture Inbox Methods (Feature Three)
# ============================================================================
def get_inbox_items(status="inbox"):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        if status == "all":
            cur.execute("SELECT * FROM inbox_items ORDER BY created_at DESC")
        else:
            cur.execute("SELECT * FROM inbox_items WHERE status = ? ORDER BY created_at DESC", (status,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def create_inbox_item(title, notes="", item_type="unprocessed"):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        item_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute(
            """
            INSERT INTO inbox_items (id, title, notes, item_type, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'inbox', ?, ?)
            """,
            (item_id, title.strip(), notes, item_type, now_str, now_str),
        )
        conn.commit()
        cur.execute("SELECT * FROM inbox_items WHERE id = ?", (item_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def update_inbox_item(item_id, data):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute("SELECT * FROM inbox_items WHERE id = ?", (item_id,))
        existing = cur.fetchone()
        if not existing:
            return None
        item = dict(existing)

        title = data.get("title", item["title"]).strip()
        notes = data.get("notes", item.get("notes", ""))
        item_type = data.get("item_type", item.get("item_type", "unprocessed"))
        status = data.get("status", item.get("status", "inbox"))

        cur.execute(
            """
            UPDATE inbox_items 
            SET title = ?, notes = ?, item_type = ?, status = ?, updated_at = ?
            WHERE id = ?
            """,
            (title, notes, item_type, status, now_str, item_id),
        )
        conn.commit()
        cur.execute("SELECT * FROM inbox_items WHERE id = ?", (item_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def delete_inbox_item(item_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM inbox_items WHERE id = ?", (item_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def convert_inbox_item(item_id, target_type, target_data):
    """
    Converts an inbox item into a task, note, or project.
    Marks the inbox item as 'processed' and links converted_to_id.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM inbox_items WHERE id = ?", (item_id,))
        existing = cur.fetchone()
        if not existing:
            return None
        item = dict(existing)
        now_str = datetime.now(timezone.utc).isoformat()

        converted_entity = None
        converted_id = None

        if target_type == "task":
            title = target_data.get("title") or item["title"]
            desc = target_data.get("description") or item.get("notes", "")
            prio = target_data.get("priority", "normal")
            task_date = target_data.get("task_date") or datetime.now().strftime("%Y-%m-%d")
            proj_id = target_data.get("project_id") or None
            converted_entity = create_task(title=title, description=desc, priority=prio, task_date=task_date, project_id=proj_id)
            converted_id = converted_entity["id"]

        elif target_type == "note":
            title = target_data.get("title") or item["title"]
            content = target_data.get("content") or item.get("notes", "")
            tags = target_data.get("tags", "Inbox")
            converted_entity = create_note(title=title, content=content, tags=tags)
            converted_id = converted_entity["id"]

        elif target_type == "project":
            title = target_data.get("title") or item["title"]
            desc = target_data.get("description") or item.get("notes", "")
            deadline = target_data.get("deadline")
            color = target_data.get("color", "#4f46e5")
            converted_entity = create_project(title=title, description=desc, deadline=deadline, color=color)
            converted_id = converted_entity["id"]

        cur.execute(
            """
            UPDATE inbox_items 
            SET status = 'processed', converted_to_type = ?, converted_to_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (target_type, converted_id, now_str, item_id),
        )
        conn.commit()

        cur.execute("SELECT * FROM inbox_items WHERE id = ?", (item_id,))
        updated_item = dict(cur.fetchone())

        return {
            "inbox_item": updated_item,
            "target_type": target_type,
            "converted_entity": converted_entity,
        }
    finally:
        conn.close()


# ============================================================================
# Victory Sounds Data Access Methods (Feature: Victory Sounds)
# ============================================================================
def get_victory_sounds(user_id=None):
    """
    Returns list of victory sounds available to user (built-in sounds + user's private sounds).
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        if user_id:
            cur.execute(
                """
                SELECT * FROM victory_sounds 
                WHERE user_id = ? OR user_id IS NULL 
                ORDER BY is_default DESC, created_at ASC
                """,
                (user_id,),
            )
        else:
            cur.execute("SELECT * FROM victory_sounds ORDER BY is_default DESC, created_at ASC")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_victory_sound_by_id(sound_id, user_id=None):
    """
    Retrieves a single victory sound with optional user ownership check.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        if user_id:
            cur.execute("SELECT * FROM victory_sounds WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (sound_id, user_id))
        else:
            cur.execute("SELECT * FROM victory_sounds WHERE id = ?", (sound_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def find_victory_sound_by_hash(file_hash, user_id=None):
    """
    Checks if an audio file with identical SHA-256 hash has already been uploaded,
    preventing unnecessary duplicate uploads and saving storage space.
    """
    if not file_hash:
        return None
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        if user_id:
            cur.execute("SELECT * FROM victory_sounds WHERE file_hash = ? AND (user_id = ? OR user_id IS NULL)", (file_hash, user_id))
        else:
            cur.execute("SELECT * FROM victory_sounds WHERE file_hash = ?", (file_hash,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_victory_sound(
    title,
    file_path,
    file_format,
    file_size=0,
    duration=0,
    event_trigger="task_complete",
    is_default=0,
    user_id=None,
    file_hash=None,
):
    """
    Inserts a newly uploaded victory sound into PostgreSQL or SQLite.
    Enforces user_id ownership and unsets previous default if is_default=1.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        sound_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()

        if is_default:
            if user_id:
                cur.execute(
                    "UPDATE victory_sounds SET is_default = 0 WHERE event_trigger = ? AND (user_id = ? OR user_id IS NULL)",
                    (event_trigger, user_id),
                )
            else:
                cur.execute("UPDATE victory_sounds SET is_default = 0 WHERE event_trigger = ?", (event_trigger,))

        cur.execute(
            """
            INSERT INTO victory_sounds 
            (id, user_id, title, file_path, file_format, file_size, duration, event_trigger, is_default, file_hash, is_public, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (
                sound_id,
                user_id,
                title.strip(),
                file_path,
                file_format,
                file_size,
                duration,
                event_trigger,
                int(is_default),
                file_hash,
                now_str,
                now_str,
            ),
        )
        conn.commit()
        cur.execute("SELECT * FROM victory_sounds WHERE id = ?", (sound_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def replace_victory_sound_file(
    sound_id,
    file_path,
    file_format,
    file_size=0,
    duration=0,
    file_hash=None,
    user_id=None,
):
    """
    Replaces the underlying audio file for an existing victory sound,
    keeping its sound_id, assignments, and customizations intact.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()

        if user_id:
            cur.execute("SELECT * FROM victory_sounds WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (sound_id, user_id))
        else:
            cur.execute("SELECT * FROM victory_sounds WHERE id = ?", (sound_id,))
        existing = cur.fetchone()
        if not existing:
            return None

        old_sound = dict(existing)
        cur.execute(
            """
            UPDATE victory_sounds 
            SET file_path = ?, file_format = ?, file_size = ?, duration = ?, file_hash = ?, updated_at = ?
            WHERE id = ?
            """,
            (file_path, file_format, file_size, duration, file_hash, now_str, sound_id),
        )
        conn.commit()
        cur.execute("SELECT * FROM victory_sounds WHERE id = ?", (sound_id,))
        updated = dict(cur.fetchone())
        updated["_old_file_path"] = old_sound["file_path"]
        return updated
    finally:
        conn.close()


def update_victory_sound(sound_id, data, user_id=None):
    """
    Updates victory sound title, event_trigger, or default state.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()

        if user_id:
            cur.execute("SELECT * FROM victory_sounds WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (sound_id, user_id))
        else:
            cur.execute("SELECT * FROM victory_sounds WHERE id = ?", (sound_id,))
        existing = cur.fetchone()
        if not existing:
            return None
        sound = dict(existing)

        title = data.get("title", sound["title"]).strip()
        event_trigger = data.get("event_trigger", sound.get("event_trigger", "task_complete"))
        is_default = int(data.get("is_default", sound.get("is_default", 0)))

        if is_default:
            if user_id:
                cur.execute(
                    "UPDATE victory_sounds SET is_default = 0 WHERE event_trigger = ? AND id != ? AND (user_id = ? OR user_id IS NULL)",
                    (event_trigger, sound_id, user_id),
                )
            else:
                cur.execute("UPDATE victory_sounds SET is_default = 0 WHERE event_trigger = ? AND id != ?", (event_trigger, sound_id))

        cur.execute(
            """
            UPDATE victory_sounds 
            SET title = ?, event_trigger = ?, is_default = ?, updated_at = ?
            WHERE id = ?
            """,
            (title, event_trigger, is_default, now_str, sound_id),
        )
        conn.commit()
        cur.execute("SELECT * FROM victory_sounds WHERE id = ?", (sound_id,))
        return dict(cur.fetchone())
    finally:
        conn.close()


def delete_victory_sound(sound_id, user_id=None):
    """
    Deletes a custom victory sound while protecting starter sounds.
    Returns the deleted sound record (with file_path) so file cleanup can be performed.
    """
    # Protect built-in starter sounds from deletion
    if sound_id in ("default_victory", "sound_level_up", "sound_zen_bell", "sound_arcade_win"):
        return None

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        if user_id:
            cur.execute("SELECT * FROM victory_sounds WHERE id = ? AND user_id = ?", (sound_id, user_id))
        else:
            cur.execute("SELECT * FROM victory_sounds WHERE id = ?", (sound_id,))
        row = cur.fetchone()
        if not row:
            return None

        sound = dict(row)
        cur.execute("DELETE FROM victory_sounds WHERE id = ?", (sound_id,))
        conn.commit()
        return sound
    finally:
        conn.close()
