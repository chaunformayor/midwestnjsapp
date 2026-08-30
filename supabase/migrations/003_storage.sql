-- Storage policies for the "resources" bucket
-- Create the bucket first via: Supabase Dashboard > Storage > New bucket
--   Name: resources | Public: ON | File size limit: 50 MB
-- Then run this SQL.

CREATE POLICY "Resources: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'resources');

CREATE POLICY "Resources: admin insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resources'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Resources: admin delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resources'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
