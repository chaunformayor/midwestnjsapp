-- Storage bucket for investor resources
-- Run in Supabase SQL editor

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('resources', 'resources', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Resources: public read" ON storage.objects;
DROP POLICY IF EXISTS "Resources: admin insert" ON storage.objects;
DROP POLICY IF EXISTS "Resources: admin delete" ON storage.objects;
DROP POLICY IF EXISTS "Resources: admin update" ON storage.objects;

-- Anyone can read (bucket is public, but only investors reach the URLs via the portal)
CREATE POLICY "Resources: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'resources');

-- Only admins can upload
CREATE POLICY "Resources: admin insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resources'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Only admins can delete
CREATE POLICY "Resources: admin delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resources'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Only admins can update
CREATE POLICY "Resources: admin update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'resources'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
