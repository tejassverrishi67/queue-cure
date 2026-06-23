-- 1. Create Patients Table with constraints
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    token_number TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    called_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called'))
);

-- 2. Create Settings Table
CREATE TABLE IF NOT EXISTS public.queue_settings (
    id INT PRIMARY KEY DEFAULT 1,
    current_token TEXT,
    last_token_index INT NOT NULL DEFAULT 0,
    average_consultation_time INT NOT NULL DEFAULT 5,
    CONSTRAINT single_row CHECK (id = 1)
);

-- 3. Populate default settings row
INSERT INTO public.queue_settings (id, current_token, last_token_index, average_consultation_time)
VALUES (1, NULL, 0, 5)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Full Replica Identity for rich real-time update payloads
ALTER TABLE public.patients REPLICA IDENTITY FULL;
ALTER TABLE public.queue_settings REPLICA IDENTITY FULL;

-- 5. Create Performance Indexes for rapid sorting and lookups
CREATE INDEX IF NOT EXISTS idx_patients_status_created_at 
ON public.patients (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_patients_token_number 
ON public.patients (token_number);

-- 6. Enable Realtime Replication in Supabase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'patients') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'queue_settings') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_settings;
    END IF;
  END IF;
END $$;

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_settings ENABLE ROW LEVEL SECURITY;

-- 8. Reset and Apply Public RLS Policies for Anonymous Client Access
DROP POLICY IF EXISTS "Allow public select" ON public.patients;
DROP POLICY IF EXISTS "Allow public insert" ON public.patients;
DROP POLICY IF EXISTS "Allow public update" ON public.patients;
DROP POLICY IF EXISTS "Allow public delete" ON public.patients;

DROP POLICY IF EXISTS "Allow public select settings" ON public.queue_settings;
DROP POLICY IF EXISTS "Allow public insert settings" ON public.queue_settings;
DROP POLICY IF EXISTS "Allow public update settings" ON public.queue_settings;
DROP POLICY IF EXISTS "Allow public delete settings" ON public.queue_settings;

CREATE POLICY "Allow public select" ON public.patients FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.patients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.patients FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.patients FOR DELETE USING (true);

CREATE POLICY "Allow public select settings" ON public.queue_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert settings" ON public.queue_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update settings" ON public.queue_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete settings" ON public.queue_settings FOR DELETE USING (true);

-- 9. Add is_emergency column to Patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN NOT NULL DEFAULT FALSE;

-- 10. Create Emergency Requests Table
CREATE TABLE IF NOT EXISTS public.emergency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_number TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(reason) <= 250),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

-- 11. Enable Full Replica Identity for rich real-time update payloads
ALTER TABLE public.emergency_requests REPLICA IDENTITY FULL;

-- 12. Enable Realtime Replication for emergency_requests table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'emergency_requests') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_requests;
    END IF;
  END IF;
END $$;

-- 13. Enable Row Level Security (RLS)
ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

-- 14. Reset and Apply Public RLS Policies for Emergency Requests
DROP POLICY IF EXISTS "Allow public select emergency_requests" ON public.emergency_requests;
DROP POLICY IF EXISTS "Allow public insert emergency_requests" ON public.emergency_requests;
DROP POLICY IF EXISTS "Allow public update emergency_requests" ON public.emergency_requests;
DROP POLICY IF EXISTS "Allow public delete emergency_requests" ON public.emergency_requests;

CREATE POLICY "Allow public select emergency_requests" ON public.emergency_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert emergency_requests" ON public.emergency_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update emergency_requests" ON public.emergency_requests FOR UPDATE USING (true);
CREATE POLICY "Allow public delete emergency_requests" ON public.emergency_requests FOR DELETE USING (true);

