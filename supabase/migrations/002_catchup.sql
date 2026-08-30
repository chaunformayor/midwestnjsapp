-- Safe catch-up migration — skips anything already created
-- Run in Supabase SQL editor

-- Posts
CREATE TABLE IF NOT EXISTS public.posts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  content       TEXT,
  excerpt       TEXT,
  category      TEXT DEFAULT 'market-report'
                  CHECK (category IN ('market-report','deal-breakdown','strategy','education')),
  cover_image_url TEXT,
  read_time     TEXT,
  published     BOOLEAN DEFAULT FALSE,
  published_at  TIMESTAMPTZ,
  author_id     UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- cover_image_url in case posts existed without it
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Deal Submissions
CREATE TABLE IF NOT EXISTS public.deal_submissions (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submitter_id       UUID REFERENCES auth.users(id),
  submitter_email    TEXT NOT NULL,
  submitter_name     TEXT,
  submitter_phone    TEXT,
  submitter_role     TEXT,
  address            TEXT NOT NULL,
  price              TEXT,
  property_type      TEXT,
  beds               INTEGER,
  baths              NUMERIC(3,1),
  sqft               TEXT,
  year_built         TEXT,
  arv                TEXT,
  rehab_estimate     TEXT,
  rent_estimate      TEXT,
  condition          TEXT,
  occupied           TEXT,
  deadline           TEXT,
  notes              TEXT,
  status             TEXT DEFAULT 'submitted'
                       CHECK (status IN ('submitted','reviewing','presented','under_contract','closed','passed')),
  admin_notes        TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Submissions
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  inquiry_type     TEXT,
  state            TEXT,
  message          TEXT NOT NULL,
  referral_source  TEXT,
  status           TEXT DEFAULT 'new'
                     CHECK (status IN ('new','read','replied','archived')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Subscribers
CREATE TABLE IF NOT EXISTS public.subscribers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  status     TEXT DEFAULT 'active'
               CHECK (status IN ('active','unsubscribed')),
  source     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources
CREATE TABLE IF NOT EXISTS public.resources (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  type        TEXT CHECK (type IN ('template','guide','report','reference','video')),
  file_url    TEXT,
  file_name   TEXT,
  file_size   TEXT,
  published   BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at function (replace if exists)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- Triggers (drop first so IF NOT EXISTS isn't needed)
DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS deal_submissions_updated_at ON deal_submissions;
CREATE TRIGGER deal_submissions_updated_at BEFORE UPDATE ON deal_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS resources_updated_at ON resources;
CREATE TRIGGER resources_updated_at BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources          ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Policies (drop first to avoid duplicate errors)
DROP POLICY IF EXISTS "Anyone reads published posts" ON posts;
DROP POLICY IF EXISTS "Admins full access to posts" ON posts;
DROP POLICY IF EXISTS "Investors see own deals" ON deal_submissions;
DROP POLICY IF EXISTS "Investors insert deals" ON deal_submissions;
DROP POLICY IF EXISTS "Admins full access to deals" ON deal_submissions;
DROP POLICY IF EXISTS "Public can insert deals" ON deal_submissions;
DROP POLICY IF EXISTS "Admins full access contacts" ON contact_submissions;
DROP POLICY IF EXISTS "Public can insert contacts" ON contact_submissions;
DROP POLICY IF EXISTS "Admins full access subscribers" ON subscribers;
DROP POLICY IF EXISTS "Public can subscribe" ON subscribers;
DROP POLICY IF EXISTS "Investors read resources" ON resources;
DROP POLICY IF EXISTS "Admins full access resources" ON resources;

CREATE POLICY "Anyone reads published posts"  ON posts FOR SELECT USING (published = TRUE);
CREATE POLICY "Admins full access to posts"   ON posts FOR ALL    USING (get_my_role() = 'admin');

CREATE POLICY "Investors see own deals"       ON deal_submissions FOR SELECT USING (submitter_id = auth.uid());
CREATE POLICY "Investors insert deals"        ON deal_submissions FOR INSERT WITH CHECK (submitter_id = auth.uid());
CREATE POLICY "Admins full access to deals"   ON deal_submissions FOR ALL    USING (get_my_role() = 'admin');
CREATE POLICY "Public can insert deals"       ON deal_submissions FOR INSERT WITH CHECK (submitter_id IS NULL);

CREATE POLICY "Admins full access contacts"   ON contact_submissions FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Public can insert contacts"    ON contact_submissions FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Admins full access subscribers" ON subscribers FOR ALL    USING (get_my_role() = 'admin');
CREATE POLICY "Public can subscribe"           ON subscribers FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Investors read resources"      ON resources FOR SELECT USING (get_my_role() IN ('admin','investor') AND published = TRUE);
CREATE POLICY "Admins full access resources"  ON resources FOR ALL    USING (get_my_role() = 'admin');
