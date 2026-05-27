-- Preserve source-table fields from transcribed ICMR AMA tables.
--
-- These columns intentionally store the visible table text as reviewed source
-- strings. They do not parse or infer drug, dose, pathogen, or comment details.

alter table public.clinical_recommendations
  add column if not exists clinical_condition text,
  add column if not exists common_pathogens text,
  add column if not exists empirical_ama text,
  add column if not exists alternate_ama text,
  add column if not exists comments text,
  add column if not exists ama_role text,
  add column if not exists source_image text,
  add column if not exists source_page integer;

do $$
begin
  alter table public.clinical_recommendations
    add constraint clinical_recommendations_ama_role_check
    check (
      ama_role is null
      or ama_role in ('empirical', 'alternate')
    );
exception
  when duplicate_object then null;
end $$;

create index if not exists clinical_recommendations_ama_lookup_idx
  on public.clinical_recommendations (
    clinical_condition,
    ama_role,
    source_page,
    review_status
  );

create or replace view public.approved_clinical_recommendations_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number,
  s.section_heading,
  s.quote as source_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.clinical_recommendations r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

grant select on public.approved_clinical_recommendations_with_source
  to authenticated;
