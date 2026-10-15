-- ============================================================================
-- DAYBOOK SUPABASE PRODUCTION DATABASE & STORAGE SETUP
-- PostgreSQL Schema with Row Level Security (RLS) and Supabase Storage Policies
-- ============================================================================

-- 1. Create Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Notes Table (Block-based & Templates ready)
CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    folder_id TEXT DEFAULT NULL,
    is_pinned INTEGER DEFAULT 0,
    tags TEXT DEFAULT '',
    template_type TEXT DEFAULT 'blank',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Projects Table (Monthly & Long-term goals)
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'in_progress', -- 'not_started', 'in_progress', 'on_hold', 'completed'
    start_date TEXT DEFAULT NULL,
    deadline TEXT DEFAULT NULL,
    color TEXT DEFAULT '#4f46e5',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Project Milestones Table
CREATE TABLE IF NOT EXISTS public.project_milestones (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    deadline TEXT DEFAULT NULL,
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Recurring Rules Table (Feature: Recurring Tasks)
CREATE TABLE IF NOT EXISTS public.recurring_rules (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
    project_id TEXT DEFAULT NULL REFERENCES public.projects(id) ON DELETE SET NULL,
    frequency TEXT NOT NULL,         -- 'daily', 'weekly', 'monthly', 'custom_days'
    interval_val INTEGER DEFAULT 1,  -- repeat interval (e.g. 1, 2)
    by_weekdays TEXT DEFAULT '[]',   -- JSON array e.g. '[1,3,5]' (1=Mon ... 7=Sun)
    start_date TEXT NOT NULL,        -- 'YYYY-MM-DD'
    end_date TEXT DEFAULT NULL,      -- 'YYYY-MM-DD' or NULL
    due_time TEXT DEFAULT NULL,
    cancelled_dates TEXT DEFAULT '[]', -- JSON array of dates excluded e.g. '["2026-10-11"]'
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Tasks Table (Two-Level: Daily Tasks with recurrence and project linking)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_completed INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high'
    task_date TEXT NOT NULL,         -- 'YYYY-MM-DD' calendar date
    due_time TEXT DEFAULT NULL,      -- Optional time e.g. '14:30'
    due_date TEXT DEFAULT NULL,
    project_id TEXT DEFAULT NULL REFERENCES public.projects(id) ON DELETE SET NULL,
    recurring_rule_id TEXT DEFAULT NULL REFERENCES public.recurring_rules(id) ON DELETE SET NULL,
    original_date TEXT DEFAULT NULL,
    is_recurrence_exception INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Subtasks and Checklists Table (Feature Two: Subtasks and Checklists)
CREATE TABLE IF NOT EXISTS public.subtasks (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON public.subtasks(task_id);

-- 7. Daily Journal Table
CREATE TABLE IF NOT EXISTS public.journals (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date TEXT NOT NULL,
    content TEXT NOT NULL,
    mood TEXT DEFAULT 'good', -- 'great', 'good', 'neutral', 'low'
    tags TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Quick Capture Inbox Table (Feature Three: Quick Capture Inbox)
CREATE TABLE IF NOT EXISTS public.inbox_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    item_type TEXT DEFAULT 'unprocessed', -- 'unprocessed', 'task', 'note', 'idea'
    status TEXT DEFAULT 'inbox',          -- 'inbox', 'processed', 'archived'
    converted_to_type TEXT DEFAULT NULL,  -- 'task', 'note', 'project'
    converted_to_id TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 10. Victory Sounds Table (Feature: Victory Sounds)
CREATE TABLE IF NOT EXISTS public.victory_sounds (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,             -- Supabase storage object path e.g. 'sounds/user_id/victory.mp3'
    file_format TEXT NOT NULL,           -- 'mp3', 'wav', 'ogg', 'm4a', 'webm'
    file_size INTEGER DEFAULT 0,         -- bytes
    duration REAL DEFAULT 0,             -- seconds
    event_trigger TEXT DEFAULT 'task_complete', -- 'task_complete', 'milestone_complete', 'all_complete'
    is_default INTEGER DEFAULT 0,
    file_hash TEXT DEFAULT NULL,         -- SHA-256 hash for deduplication
    is_public INTEGER DEFAULT 0,         -- Future sound pack sharing
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 11. User Preferences Table (Appearance, Customizable Companion, Victory Sounds)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id TEXT PRIMARY KEY DEFAULT 'default_user',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    theme_mode TEXT DEFAULT 'system',
    accent_color TEXT DEFAULT '#4f46e5',
    font_size TEXT DEFAULT 'normal',
    layout_density TEXT DEFAULT 'comfortable',
    card_radius TEXT DEFAULT 'rounded',
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
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 12. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notes_updated ON public.notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON public.tasks(task_date, is_completed);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status, deadline);
CREATE INDEX IF NOT EXISTS idx_milestones_proj ON public.project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_journals_date ON public.journals(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON public.inbox_items(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_victory_sounds_user ON public.victory_sounds(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures users can only view and mutate their own workspace records
-- ============================================================================

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.victory_sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Permissive policy for single-user dev mode (user_id IS NULL) or authenticated user (auth.uid() = user_id)
CREATE POLICY "Allow authenticated user full access to their notes" ON public.notes
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow authenticated user full access to their projects" ON public.projects
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow authenticated user full access to their recurring rules" ON public.recurring_rules
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow authenticated user full access to their milestones" ON public.project_milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_milestones.project_id 
            AND (auth.uid() = p.user_id OR p.user_id IS NULL)
        )
    );

CREATE POLICY "Allow authenticated user full access to their tasks" ON public.tasks
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow authenticated user full access to their subtasks" ON public.subtasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tasks t 
            WHERE t.id = subtasks.task_id 
            AND (auth.uid() = t.user_id OR t.user_id IS NULL)
        )
    );

CREATE POLICY "Allow authenticated user full access to their journals" ON public.journals
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow authenticated user full access to their inbox items" ON public.inbox_items
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow authenticated user full access to their victory sounds" ON public.victory_sounds
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow authenticated user full access to their preferences" ON public.user_preferences
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- SUPABASE STORAGE CONFIGURATION
-- Buckets for Custom Companion Avatars & Private Victory Sounds
-- ============================================================================

-- 1. Companion Avatars Bucket (Public read)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('daybook-companions', 'daybook-companions', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read access to companion avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'daybook-companions');

CREATE POLICY "Allow authenticated users to upload companion avatars" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'daybook-companions' 
        AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
    );

CREATE POLICY "Allow users to delete their companion avatars" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'daybook-companions' 
        AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
    );

-- 2. Victory Sounds Bucket (Private audio by default)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('daybook-sounds', 'daybook-sounds', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated users to read their victory sounds" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'daybook-sounds'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR (storage.foldername(name))[1] = 'public'
            OR auth.role() = 'anon'
        )
    );

CREATE POLICY "Allow authenticated users to upload their victory sounds" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'daybook-sounds' 
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR auth.role() = 'anon'
        )
    );

CREATE POLICY "Allow authenticated users to update their victory sounds" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'daybook-sounds' 
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR auth.role() = 'anon'
        )
    );

CREATE POLICY "Allow authenticated users to delete their victory sounds" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'daybook-sounds' 
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR auth.role() = 'anon'
        )
    );

-- 3. Custom Backgrounds Bucket (Private wallpaper storage by default)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('daybook-backgrounds', 'daybook-backgrounds', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow users to view their custom background wallpaper" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'daybook-backgrounds'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR auth.role() = 'anon'
        )
    );

CREATE POLICY "Allow users to upload custom background wallpaper" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'daybook-backgrounds'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR auth.role() = 'anon'
        )
    );

CREATE POLICY "Allow users to delete custom background wallpaper" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'daybook-backgrounds'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR auth.role() = 'anon'
        )
    );
