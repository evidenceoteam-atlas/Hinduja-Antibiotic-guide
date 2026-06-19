-- A1 / A2 (fail-closed RETIRE) — remove the legacy, release-UNGATED public read
-- path for public.clinical_recommendations.
--
-- clinical_recommendations is the only clinical table whose anon/authenticated read
-- was gated on review_status = 'approved' alone (see 20260619_zz_public_approved_
-- clinical_read.sql), bypassing the versioned active + non-expired dataset-release
-- gate that every other clinical table enforces. The hard-coded AMA transcription
-- importer that populated it is already retired, and the new exact-key protocol flow
-- (approved_current_protocol_scenarios_with_source) supersedes it.
--
-- This migration is purely data/access-layer and changes NO UI:
--   1. RLS stays enabled and every read-enabling policy is dropped, so anon and
--      authenticated receive zero rows from clinical_recommendations (and therefore
--      from the security_invoker view approved_clinical_recommendations_with_source).
--      service_role still has access for reviewer/admin tooling via RLS bypass.
--   2. The ungated clinical_recommendations branch is removed from
--      is_public_clinical_source_span, so source provenance for those rows is no
--      longer public either; every remaining branch requires an active, non-expired
--      release.
--
-- The mobile app keeps its existing query and renders its existing empty /
-- insufficient-data state when the view returns no rows. This deliberately never
-- restores the legacy fuzzy recommendation path.

-- 1) Fail-closed read: keep RLS on, drop all read-enabling policies (SELECT/ALL).
alter table public.clinical_recommendations enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'clinical_recommendations'
      and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy if exists %I on public.clinical_recommendations', pol.policyname);
  end loop;
end $$;

-- 2) Recreate the public provenance gate WITHOUT the ungated clinical_recommendations
--    branch. Verbatim from 20260619_zz_public_approved_clinical_read.sql minus that
--    branch; every remaining branch joins clinical_dataset_releases and requires
--    status = 'active' and valid_through >= current_date.
create or replace function public.is_public_clinical_source_span(p_span_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_table text;
  matched boolean;
begin
  select exists (
    select 1
    from public.patient_risk_criteria content
    join public.clinical_dataset_releases release
      on release.id = content.dataset_release_id
    where content.source_span_id = p_span_id
      and content.review_status = 'approved'
      and release.status = 'active'
      and release.valid_through >= current_date
  ) into matched;
  if matched then return true; end if;

  select exists (
    select 1
    from public.antibiogram_therapy_source_slots content
    join public.clinical_dataset_releases release
      on release.id = content.dataset_release_id
    where content.source_span_id = p_span_id
      and content.review_status = 'approved'
      and release.status = 'active'
      and release.valid_through >= current_date
  ) into matched;
  if matched then return true; end if;

  foreach target_table in array array[
    'clinical_guide_documents',
    'icmr_guideline_rows',
    'duration_guideline_rows',
    'antibiogram_sheets',
    'antibiogram_pathogen_rows',
    'antibiogram_risk_criteria',
    'antibiogram_empiric_therapy',
    'antibiogram_footnotes',
    'synergy_testing_rows',
    'antifungal_susceptibility_rows',
    'stewardship_pearl_rows',
    'antimicrobial_pearl_point_rows',
    'perioperative_procedure_recommendations',
    'perioperative_antibiotic_dosing',
    'perioperative_notes',
    'synergy_antifungal_notes'
  ]
  loop
    execute format(
      'select exists (
         select 1 from public.%I content
         join public.clinical_dataset_releases release
           on release.id = content.dataset_release_id
         where content.source_span_id = $1
           and content.review_status = ''approved''
           and release.status = ''active''
           and release.valid_through >= current_date
       )',
      target_table
    ) using p_span_id into matched;
    if matched then return true; end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.is_public_clinical_source_span(uuid) from public;
grant execute on function public.is_public_clinical_source_span(uuid) to anon, authenticated;
