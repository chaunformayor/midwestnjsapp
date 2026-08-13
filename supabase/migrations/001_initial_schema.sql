-- ============================================================
-- MIDWEST INVESTOR SERVICES — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- ---- Profiles (extends auth.users) ----
CREATE TABLE public.profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email         TEXT NOT NULL,
  full_name     TEXT,
  phone         TEXT,
  state         TEXT,
  role          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (role IN ('admin', 'investor', 'pending')),
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES auth.users(id),
  notes         TEXT,  -- internal admin notes about this investor
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---- Blog Posts ----
CREATE TABLE public.posts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  content       TEXT,          -- Tiptap HTML
  excerpt       TEXT,
  category      TEXT DEFAULT 'market-report'
                  CHECK (category IN ('market-report','deal-breakdown','strategy','education')),
  read_time     TEXT,
  published     BOOLEAN DEFAULT FALSE,
  published_at  TIMESTAMPTZ,
  author_id     UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Deal Submissions ----
CREATE TABLE public.deal_submissions (
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

-- ---- Contact Submissions ----
CREATE TABLE public.contact_submissions (
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

-- ---- Email Subscribers ----
CREATE TABLE public.subscribers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  status     TEXT DEFAULT 'active'
               CHECK (status IN ('active','unsubscribed')),
  source     TEXT,  -- 'footer', 'blog', 'portal'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Portal Resources ----
CREATE TABLE public.resources (
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

-- ---- Updated_at triggers ----
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at        BEFORE UPDATE ON profiles        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER posts_updated_at           BEFORE UPDATE ON posts           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER deal_submissions_updated_at BEFORE UPDATE ON deal_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER resources_updated_at       BEFORE UPDATE ON resources       FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources          ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Profiles
CREATE POLICY "Users can read own profile"    ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles"      ON profiles FOR SELECT USING (get_my_role() = 'admin');
CREATE POLICY "Admins update all profiles"    ON profiles FOR UPDATE USING (get_my_role() = 'admin');

-- Posts: published posts are public; admins can CRUD all
CREATE POLICY "Anyone reads published posts"  ON posts FOR SELECT USING (published = TRUE);
CREATE POLICY "Admins full access to posts"   ON posts FOR ALL    USING (get_my_role() = 'admin');

-- Deal submissions
CREATE POLICY "Investors see own deals"       ON deal_submissions FOR SELECT USING (submitter_id = auth.uid());
CREATE POLICY "Investors insert deals"        ON deal_submissions FOR INSERT WITH CHECK (submitter_id = auth.uid());
CREATE POLICY "Admins full access to deals"   ON deal_submissions FOR ALL    USING (get_my_role() = 'admin');
-- Allow unauthenticated deal submissions (public form)
CREATE POLICY "Public can insert deals"       ON deal_submissions FOR INSERT WITH CHECK (submitter_id IS NULL);

-- Contact submissions
CREATE POLICY "Admins full access contacts"   ON contact_submissions FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "Public can insert contacts"    ON contact_submissions FOR INSERT WITH CHECK (TRUE);

-- Subscribers
CREATE POLICY "Admins full access subscribers" ON subscribers FOR ALL    USING (get_my_role() = 'admin');
CREATE POLICY "Public can subscribe"           ON subscribers FOR INSERT WITH CHECK (TRUE);

-- Resources
CREATE POLICY "Investors read resources"      ON resources FOR SELECT USING (get_my_role() IN ('admin','investor') AND published = TRUE);
CREATE POLICY "Admins full access resources"  ON resources FOR ALL    USING (get_my_role() = 'admin');

-- ============================================================
-- SEED: First admin user
-- After running this schema, sign up at /signup, then run:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'info@midwestinvestorservices.com';
-- ============================================================
