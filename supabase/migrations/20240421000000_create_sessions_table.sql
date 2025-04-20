-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions (created_at);

-- Add RLS policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access
CREATE POLICY "Allow anonymous read access" ON sessions
  FOR SELECT USING (true);

-- Allow anonymous insert/update
CREATE POLICY "Allow anonymous insert/update" ON sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update" ON sessions
  FOR UPDATE USING (true); 