-- Run once in Supabase -> SQL Editor if any Daybook media bucket is missing.
INSERT INTO storage.buckets (id, name, public)
VALUES ('daybook-memories', 'daybook-memories', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('daybook-backgrounds', 'daybook-backgrounds', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('daybook-sounds', 'daybook-sounds', false)
ON CONFLICT (id) DO NOTHING;
