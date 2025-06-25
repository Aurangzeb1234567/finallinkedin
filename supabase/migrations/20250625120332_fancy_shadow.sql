/*
  # Complete LinkedIn Scraper Database Schema

  1. New Tables
    - `users` - User profiles linked to auth.users
    - `apify_keys` - API keys for Apify service
    - `linkedin_profiles` - Scraped LinkedIn profile data
    - `scraping_jobs` - Track scraping operations

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Users can only access their own data

  3. Functions
    - `get_or_create_user_profile` - Automatically create user profile on first access
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id);

-- Create apify_keys table
CREATE TABLE IF NOT EXISTS apify_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  api_key text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, key_name)
);

-- Create indexes for apify_keys table
CREATE INDEX IF NOT EXISTS idx_apify_keys_user_id ON apify_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_apify_keys_active ON apify_keys(is_active);

-- Enable RLS on apify_keys table
ALTER TABLE apify_keys ENABLE ROW LEVEL SECURITY;

-- Create policies for apify_keys table
CREATE POLICY "Users can manage own API keys" ON apify_keys
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Allow insert for authenticated users" ON apify_keys
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create linkedin_profiles table
CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  linkedin_url text UNIQUE NOT NULL,
  profile_data jsonb NOT NULL DEFAULT '{}',
  tags text[] DEFAULT '{}',
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for linkedin_profiles table
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id ON linkedin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_url ON linkedin_profiles(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_updated ON linkedin_profiles(last_updated);
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_tags ON linkedin_profiles USING gin(tags);

-- Enable RLS on linkedin_profiles table
ALTER TABLE linkedin_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for linkedin_profiles table
CREATE POLICY "Users can read all profiles" ON linkedin_profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert profiles" ON linkedin_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update profiles they own" ON linkedin_profiles
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete profiles they own" ON linkedin_profiles
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create scraping_jobs table
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  apify_key_id uuid REFERENCES apify_keys(id) ON DELETE SET NULL,
  job_type text NOT NULL CHECK (job_type IN ('post_comments', 'profile_details', 'mixed')),
  input_url text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  results_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create indexes for scraping_jobs table
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user_id ON scraping_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_type ON scraping_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_created_at ON scraping_jobs(created_at);

-- Enable RLS on scraping_jobs table
ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for scraping_jobs table
CREATE POLICY "Users can manage own scraping jobs" ON scraping_jobs
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create function to get or create user profile
CREATE OR REPLACE FUNCTION get_or_create_user_profile(user_auth_id uuid)
RETURNS users AS $$
DECLARE
  user_record users;
  auth_user_record auth.users;
BEGIN
  -- First try to get existing user
  SELECT * INTO user_record FROM users WHERE auth_user_id = user_auth_id;
  
  IF FOUND THEN
    RETURN user_record;
  END IF;
  
  -- Get auth user data
  SELECT * INTO auth_user_record FROM auth.users WHERE id = user_auth_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;
  
  -- Create new user profile
  INSERT INTO users (
    auth_user_id,
    username,
    email,
    full_name
  ) VALUES (
    user_auth_id,
    COALESCE(auth_user_record.email, 'user_' || user_auth_id::text),
    COALESCE(auth_user_record.email, ''),
    COALESCE(
      auth_user_record.raw_user_meta_data->>'full_name',
      CONCAT(
        COALESCE(auth_user_record.raw_user_meta_data->>'first_name', ''),
        ' ',
        COALESCE(auth_user_record.raw_user_meta_data->>'last_name', '')
      ),
      auth_user_record.email,
      'User'
    )
  ) RETURNING * INTO user_record;
  
  RETURN user_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;