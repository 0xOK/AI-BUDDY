-- Create scripts table
CREATE TABLE IF NOT EXISTS scripts (
  id SERIAL PRIMARY KEY,
  stage INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on stage for faster lookups
CREATE INDEX IF NOT EXISTS idx_scripts_stage ON scripts(stage);

-- Insert initial onboarding scripts
INSERT INTO scripts (stage, prompt) VALUES
  (1, 'Hello! I''m your AI assistant. How can I help you today?'),
  (2, 'I see you''re interested in our services. Would you like to learn more about our features?'),
  (3, 'Great! Would you like to register to get full access to all features?');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_scripts_updated_at
  BEFORE UPDATE ON scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 