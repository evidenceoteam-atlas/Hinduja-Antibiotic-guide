-- Ensure authenticated mobile clients can read approved source-linked
-- recommendations through the Supabase Data API.
--
-- This does not grant draft writes or bypass RLS. Draft/source write access
-- remains restricted to service-role or direct DB administration workflows.

grant usage on schema public to authenticated;

grant select on public.approved_clinical_recommendations_with_source
  to authenticated;

grant select on public.clinical_recommendations
  to authenticated;

grant select on public.clinical_source_spans
  to authenticated;

grant select on public.clinical_source_files
  to authenticated;
