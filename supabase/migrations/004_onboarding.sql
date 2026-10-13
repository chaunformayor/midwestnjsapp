-- ============================================================
-- Client onboarding: engagements and MIS business details
-- Safe to run more than once. Run in the Supabase SQL editor.
--
-- Client answers and uploaded documents are NOT stored here.
-- They live in Nextcloud (MIS Clients/<client folder>). This table
-- only tracks who was invited, the agreed fees, and progress.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.onboarding_engagements (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash          TEXT UNIQUE NOT NULL,            -- SHA-256 of the client's private link token
  client_name         TEXT NOT NULL,
  client_email        TEXT NOT NULL,
  spouse_name         TEXT,
  spouse_email        TEXT,
  engagement_type     TEXT NOT NULL DEFAULT 'estate'
                        CHECK (engagement_type IN ('estate','invest','portfolio','custom')),
  focus               TEXT NOT NULL DEFAULT '',
  modules             TEXT[] NOT NULL DEFAULT '{}',    -- optional questionnaire sections
  fees                JSONB NOT NULL DEFAULT '{}'::jsonb,
  pay_methods         TEXT[] NOT NULL DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'invited'
                        CHECK (status IN ('invited','signing','signed','submitted','canceled')),
  sign_details        JSONB,                           -- names, emails, address, payment option as sent for signature
  libresign_uuid      TEXT,
  libresign_status    INTEGER,
  signers_status      JSONB,                           -- [{name, signed_at}]
  nextcloud_folder    TEXT,
  questionnaire_part  TEXT,                            -- last part the client saved
  docs_total          INTEGER NOT NULL DEFAULT 0,
  docs_done           INTEGER NOT NULL DEFAULT 0,
  invited_at          TIMESTAMPTZ DEFAULT NOW(),
  sent_for_signature_at TIMESTAMPTZ,
  signed_at           TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  last_activity_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS onboarding_engagements_created_at_idx
  ON public.onboarding_engagements (created_at DESC);
CREATE INDEX IF NOT EXISTS onboarding_engagements_libresign_uuid_idx
  ON public.onboarding_engagements (libresign_uuid);

CREATE TABLE IF NOT EXISTS public.onboarding_settings (
  id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  entity_type     TEXT NOT NULL DEFAULT '',   -- e.g. limited liability company
  office_address  TEXT NOT NULL DEFAULT '',
  signer_name     TEXT NOT NULL DEFAULT 'Chaun',
  signer_title    TEXT NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.onboarding_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS onboarding_engagements_updated_at ON public.onboarding_engagements;
CREATE TRIGGER onboarding_engagements_updated_at BEFORE UPDATE ON public.onboarding_engagements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS onboarding_settings_updated_at ON public.onboarding_settings;
CREATE TRIGGER onboarding_settings_updated_at BEFORE UPDATE ON public.onboarding_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Admins only. Clients never query these tables directly; the website's
-- server reads them with the service role after checking the private link.
ALTER TABLE public.onboarding_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_settings    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access onboarding" ON public.onboarding_engagements;
CREATE POLICY "Admins full access onboarding" ON public.onboarding_engagements
  FOR ALL USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admins full access onboarding settings" ON public.onboarding_settings;
CREATE POLICY "Admins full access onboarding settings" ON public.onboarding_settings
  FOR ALL USING (get_my_role() = 'admin');

-- Encrypted copy of the private link token, so an admin can copy or resend
-- the same link later. The hash above is what the site uses to look it up.
ALTER TABLE public.onboarding_engagements ADD COLUMN IF NOT EXISTS token_enc TEXT;
