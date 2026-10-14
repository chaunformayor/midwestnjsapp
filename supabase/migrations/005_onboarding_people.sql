-- ============================================================
-- Client onboarding: each person gets their own link, questionnaire,
-- and document folder. Safe to run more than once. Run in the Supabase
-- SQL editor after 004_onboarding.sql.
--
-- The agreements are still signed once per household, so they stay on
-- onboarding_engagements. A person row holds one person's own progress.
-- The engagement's own link belongs to the main client. Rows for existing
-- engagements are created by the website the first time they are opened.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.onboarding_people (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id       UUID NOT NULL REFERENCES public.onboarding_engagements(id) ON DELETE CASCADE,
  role                TEXT NOT NULL CHECK (role IN ('client','spouse')),
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  token_hash          TEXT UNIQUE,                     -- spouse only; the main client uses the engagement's link
  token_enc           TEXT,                            -- encrypted copy so an admin can copy or resend the link
  nextcloud_folder    TEXT,                            -- this person's folder (Questionnaire and Documents live inside)
  questionnaire_part  TEXT,                            -- last part this person saved
  docs_total          INTEGER NOT NULL DEFAULT 0,
  docs_done           INTEGER NOT NULL DEFAULT 0,
  submitted_at        TIMESTAMPTZ,
  last_activity_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (engagement_id, role)
);

CREATE INDEX IF NOT EXISTS onboarding_people_engagement_idx
  ON public.onboarding_people (engagement_id);

DROP TRIGGER IF EXISTS onboarding_people_updated_at ON public.onboarding_people;
CREATE TRIGGER onboarding_people_updated_at BEFORE UPDATE ON public.onboarding_people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Admins only. The website's server reads and writes this with the service role
-- after checking the person's private link.
ALTER TABLE public.onboarding_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access onboarding people" ON public.onboarding_people;
CREATE POLICY "Admins full access onboarding people" ON public.onboarding_people
  FOR ALL USING (get_my_role() = 'admin');
