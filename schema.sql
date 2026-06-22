-- 1. Create Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    token_number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    called_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'called'))
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

-- 4. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_settings;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_settings ENABLE ROW LEVEL SECURITY;

-- 6. Create Public RLS Policies
CREATE POLICY "Allow public select" ON public.patients FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.patients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.patients FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.patients FOR DELETE USING (true);

CREATE POLICY "Allow public select settings" ON public.queue_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert settings" ON public.queue_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update settings" ON public.queue_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete settings" ON public.queue_settings FOR DELETE USING (true);
