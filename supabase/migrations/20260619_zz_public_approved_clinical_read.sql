-- The mobile application no longer authenticates users. Allow the public
-- publishable-key role to read only reviewed/current clinical content while
-- preserving every existing write and draft restriction.

grant usage on schema public to anon, authenticated;

do $$
declare
  target_table text;
begin
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
    if to_regclass('public.' || target_table) is not null then
      execute format(
        'grant select on public.%I to anon, authenticated',
        target_table
      );
      execute format(
        'drop policy if exists "approved %s current read" on public.%I',
        target_table,
        target_table
      );
      execute format(
        'drop policy if exists "approved %s read" on public.%I',
        target_table,
        target_table
      );
      execute format(
        'drop policy if exists "approved %s public current read" on public.%I',
        target_table,
        target_table
      );
      execute format(
        'create policy "approved %s public current read" on public.%I
         for select to anon, authenticated using (
           review_status = ''approved'' and exists (
             select 1
             from public.clinical_dataset_releases release
             where release.id = dataset_release_id
               and release.status = ''active''
               and release.valid_through >= current_date
           )
         )',
        target_table,
        target_table
      );
    end if;
  end loop;
end $$;

drop policy if exists "authenticated read dataset release metadata"
  on public.clinical_dataset_releases;
drop policy if exists "public read dataset release metadata"
  on public.clinical_dataset_releases;
create policy "public read dataset release metadata"
on public.clinical_dataset_releases for select
to anon, authenticated
using (status in ('approved', 'active', 'expired'));

drop policy if exists "approved current patient risk read"
  on public.patient_risk_criteria;
drop policy if exists "approved public current patient risk read"
  on public.patient_risk_criteria;
create policy "approved public current patient risk read"
on public.patient_risk_criteria for select
to anon, authenticated
using (
  review_status = 'approved'
  and exists (
    select 1
    from public.clinical_dataset_releases release
    where release.id = dataset_release_id
      and release.status = 'active'
      and release.valid_through >= current_date
  )
);

drop policy if exists "approved current therapy source slot read"
  on public.antibiogram_therapy_source_slots;
drop policy if exists "approved public current therapy source slot read"
  on public.antibiogram_therapy_source_slots;
create policy "approved public current therapy source slot read"
on public.antibiogram_therapy_source_slots for select
to anon, authenticated
using (
  review_status = 'approved'
  and exists (
    select 1
    from public.clinical_dataset_releases release
    where release.id = dataset_release_id
      and release.status = 'active'
      and release.valid_through >= current_date
  )
);

drop policy if exists "approved recommendation read"
  on public.clinical_recommendations;
drop policy if exists "approved public recommendation read"
  on public.clinical_recommendations;
create policy "approved public recommendation read"
on public.clinical_recommendations for select
to anon, authenticated
using (review_status = 'approved');

-- Source provenance is public only when at least one approved/current row
-- references it. The SECURITY DEFINER function avoids recursive RLS checks;
-- callers receive only a boolean and cannot use it to read draft content.
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
    from public.clinical_recommendations content
    where content.source_span_id = p_span_id
      and content.review_status = 'approved'
  ) into matched;
  if matched then return true; end if;

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
grant execute on function public.is_public_clinical_source_span(uuid)
  to anon, authenticated;

drop policy if exists "authenticated read source spans"
  on public.clinical_source_spans;
drop policy if exists "public approved source spans"
  on public.clinical_source_spans;
create policy "public approved source spans"
on public.clinical_source_spans for select
to anon, authenticated
using (public.is_public_clinical_source_span(id));

drop policy if exists "authenticated read source files"
  on public.clinical_source_files;
drop policy if exists "public approved source files"
  on public.clinical_source_files;
create policy "public approved source files"
on public.clinical_source_files for select
to anon, authenticated
using (
  exists (
    select 1
    from public.clinical_source_spans span
    where span.source_file_id = id
      and public.is_public_clinical_source_span(span.id)
  )
);

grant select on
  public.clinical_dataset_releases,
  public.patient_risk_criteria,
  public.antibiogram_therapy_source_slots,
  public.clinical_recommendations,
  public.clinical_source_spans,
  public.clinical_source_files
to anon, authenticated;

grant select on
  public.approved_current_protocol_scenarios_with_source,
  public.approved_current_patient_risk_criteria_with_source,
  public.approved_dataset_release_status,
  public.approved_clinical_recommendations_with_source,
  public.approved_clinical_guide_documents_with_source,
  public.approved_icmr_guideline_rows_with_source,
  public.approved_duration_guideline_rows_with_source,
  public.approved_antibiogram_sheets_with_source,
  public.approved_antibiogram_pathogen_rows_with_source,
  public.approved_antibiogram_risk_criteria_with_source,
  public.approved_antibiogram_empiric_therapy_with_source,
  public.approved_antibiogram_footnotes_with_source,
  public.approved_synergy_testing_rows_with_source,
  public.approved_antifungal_susceptibility_rows_with_source,
  public.approved_synergy_antifungal_notes_with_source,
  public.approved_stewardship_pearl_rows_with_source,
  public.approved_antimicrobial_pearl_point_rows_with_source,
  public.approved_perioperative_procedure_recommendations_with_source,
  public.approved_perioperative_antibiotic_dosing_with_source,
  public.approved_perioperative_notes_with_source
to anon, authenticated;
