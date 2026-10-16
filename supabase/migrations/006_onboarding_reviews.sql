-- ============================================================
-- Client review: the weights the admin sets, and each saved review.
-- Safe to run more than once. Run in the Supabase SQL editor after
-- 005_onboarding_people.sql.
-- ============================================================

-- The admin's weight (0 to 5) for each scoring area. Empty means "use the defaults".
ALTER TABLE public.onboarding_settings
  ADD COLUMN IF NOT EXISTS review_weights JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.onboarding_reviews (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id   UUID NOT NULL REFERENCES public.onboarding_engagements(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id),
  model           TEXT NOT NULL DEFAULT '',
  weights         JSONB NOT NULL DEFAULT '{}'::jsonb,   -- the weights used for this review
  scores          JSONB NOT NULL DEFAULT '{}'::jsonb,   -- computed scores, per person and combined
  review          JSONB NOT NULL DEFAULT '{}'::jsonb,   -- the recommendations (client wording may be edited by the admin)
  included        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- recommendation ids chosen for the client PDF
  client_pdf_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS onboarding_reviews_engagement_idx
  ON public.onboarding_reviews (engagement_id, created_at DESC);

DROP TRIGGER IF EXISTS onboarding_reviews_updated_at ON public.onboarding_reviews;
CREATE TRIGGER onboarding_reviews_updated_at BEFORE UPDATE ON public.onboarding_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Admins only. Clients never see reviews unless the admin makes them a PDF.
ALTER TABLE public.onboarding_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access onboarding reviews" ON public.onboarding_reviews;
CREATE POLICY "Admins full access onboarding reviews" ON public.onboarding_reviews
  FOR ALL USING (get_my_role() = 'admin');
