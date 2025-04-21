-- Create scripts table
CREATE TABLE IF NOT EXISTS scripts (
  id SERIAL PRIMARY KEY,
  stage INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Create index on stage for faster queries
CREATE INDEX IF NOT EXISTS scripts_stage_idx ON scripts (stage);
CREATE INDEX IF NOT EXISTS scripts_active_idx ON scripts (active);

-- Add RLS policies
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access
CREATE POLICY "Allow anonymous read access" ON scripts
  FOR SELECT USING (true);

-- Allow authenticated insert/update/delete
CREATE POLICY "Allow authenticated insert" ON scripts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON scripts
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON scripts
  FOR DELETE USING (auth.role() = 'authenticated');

-- Insert some default scripts
INSERT INTO scripts (stage, prompt, active)
VALUES 
  (1, 'Hello! I''m your AI assistant. How can I help you today?', true),
  (2, 'I see you''re interested in our services. Would you like to learn more about our features?', true),
  (3, 'Great! Would you like to register to get full access to all features?', true); 