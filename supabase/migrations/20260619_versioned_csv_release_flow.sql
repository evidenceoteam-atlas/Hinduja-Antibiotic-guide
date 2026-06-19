-- Versioned, source-fidelitous clinical release flow.
--
-- This migration is additive. Existing rows are attached to an expired legacy
-- release so no current doctor-facing protocol becomes active automatically.

create extension if not exists pgcrypto;

create table if not exists public.clinical_dataset_releases (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique,
  guide_version text not null,
  source_manifest_sha256 text not null,
  status text not null default 'pending_review',
  valid_from date,
  valid_through date not null,
  clinical_reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  activated_at timestamptz,
  supersedes_release_id uuid references public.clinical_dataset_releases(id),
  activation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_dataset_release_status check (
    status in ('pending_review', 'approved', 'active', 'expired', 'retired')
  ),
  constraint clinical_dataset_release_manifest_hash check (
    source_manifest_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint clinical_dataset_release_dates check (
    valid_from is null or valid_from <= valid_through
  ),
  constraint clinical_dataset_release_review_evidence check (
    status not in ('approved', 'active')
    or (clinical_reviewer_id is not null and reviewed_at is not null)
  ),
  constraint clinical_dataset_release_activation_evidence check (
    status <> 'active' or activated_at is not null
  )
);

create unique index if not exists clinical_dataset_one_active_idx
  on public.clinical_dataset_releases ((status))
  where status = 'active';

create table if not exists public.clinical_source_corrections (
  id uuid primary key default gen_random_uuid(),
  dataset_release_id uuid not null references public.clinical_dataset_releases(id) on delete cascade,
  correction_id text not null,
  source_file_sha256 text not null,
  source_locator jsonb not null,
  field_name text not null,
  source_value text,
  proposed_value text,
  reason text not null,
  classification text not null,
  required_for_activation boolean not null default true,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dataset_release_id, correction_id),
  constraint clinical_source_correction_classification check (
    classification in ('formatting', 'source_export_error', 'clinical_change')
  ),
  constraint clinical_source_correction_approval_evidence check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.clinical_release_source_assets (
  id uuid primary key default gen_random_uuid(),
  dataset_release_id uuid not null references public.clinical_dataset_releases(id) on delete cascade,
  asset_key text not null,
  asset_kind text not null,
  source_file_id uuid references public.clinical_source_files(id),
  required_for_activation boolean not null default true,
  verification_status text not null default 'missing',
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dataset_release_id, asset_key),
  constraint clinical_release_asset_kind check (asset_kind in ('csv', 'pdf', 'image', 'table', 'other')),
  constraint clinical_release_asset_verification check (verification_status in ('missing', 'verified', 'rejected')),
  constraint clinical_release_asset_source check (
    verification_status <> 'verified' or source_file_id is not null
  ),
  constraint clinical_release_asset_review_evidence check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.patient_risk_criteria (
  id uuid primary key default gen_random_uuid(),
  dataset_release_id uuid not null references public.clinical_dataset_releases(id) on delete cascade,
  source_span_id uuid not null references public.clinical_source_spans(id),
  criterion_code text not null,
  criterion_label text not null,
  type_1 text not null,
  type_2 text not null,
  type_3 text not null,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dataset_release_id, criterion_code),
  constraint patient_risk_criterion_code check (
    criterion_code in ('definition', 'hospital_contact', 'antibiotic_exposure', 'co_morbidities')
  ),
  constraint patient_risk_approval_evidence check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

alter table public.clinical_source_spans
  add column if not exists source_locator jsonb,
  add column if not exists source_value_sha256 text;

alter table public.perioperative_antibiotic_dosing
  add column if not exists bolus_duration text,
  add column if not exists infusion_duration text;

alter table public.clinical_guide_documents
  add column if not exists valid_through date;

alter table public.icmr_guideline_rows
  add column if not exists infection_code text not null default 'unmapped';

alter table public.icmr_guideline_rows
  add constraint icmr_guideline_infection_code check (
    infection_code in ('BSI', 'UTI', 'RTI', 'IAI', 'CNS', 'SSTI', 'FN', 'unmapped')
  );

do $$
declare
  legacy_release_id uuid;
  target_table text;
begin
  insert into public.clinical_dataset_releases (
    release_key,
    guide_version,
    source_manifest_sha256,
    status,
    valid_through,
    clinical_reviewer_id,
    reviewed_at,
    activation_note
  )
  values (
    'legacy-reviewed-json-2025',
    '2025-legacy-json',
    '5b7d5ac9230b7a54b3e0897ab510c23738f17eb7ba4f4236555851586943e16c',
    'expired',
    date '2025-12-31',
    null,
    null,
    'Backfilled legacy content. Deliberately unavailable to current protocol views.'
  )
  on conflict (release_key) do update set updated_at = now()
  returning id into legacy_release_id;

  if legacy_release_id is null then
    select id into legacy_release_id
    from public.clinical_dataset_releases
    where release_key = 'legacy-reviewed-json-2025';
  end if;

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
        'alter table public.%I add column if not exists dataset_release_id uuid references public.clinical_dataset_releases(id)',
        target_table
      );
      execute format(
        'update public.%I set dataset_release_id = $1 where dataset_release_id is null',
        target_table
      ) using legacy_release_id;
      execute format(
        'alter table public.%I alter column dataset_release_id set not null',
        target_table
      );
    end if;
  end loop;
end $$;

alter table public.antibiogram_sheets
  drop constraint if exists antibiogram_sheets_unique_sheet;

alter table public.antibiogram_sheets
  add constraint antibiogram_sheets_release_sheet_unique
  unique (dataset_release_id, infection_type, location, acquisition);

alter table public.antibiogram_empiric_therapy
  add constraint antibiogram_therapy_release_slot_unique
  unique (dataset_release_id, sheet_key, risk_type);

alter table public.antibiogram_sheets
  add constraint antibiogram_sheet_infection_code check (infection_type in ('BSI', 'UTI', 'RTI', 'IAI')),
  add constraint antibiogram_sheet_location_code check (location in ('ICU', 'wards')),
  add constraint antibiogram_sheet_acquisition_code check (acquisition in ('community_acquired', 'hospital_acquired'));

alter table public.antibiogram_empiric_therapy
  add constraint antibiogram_therapy_risk_code check (risk_type in ('1', '2', '3')),
  add constraint antibiogram_therapy_not_placeholder check (
    length(btrim(empiric_therapy)) > 0
    and lower(btrim(empiric_therapy)) <> '(not enough data)'
  ) not valid;

create table if not exists public.antibiogram_therapy_source_slots (
  id uuid primary key default gen_random_uuid(),
  dataset_release_id uuid not null references public.clinical_dataset_releases(id) on delete cascade,
  antibiogram_sheet_id uuid not null references public.antibiogram_sheets(id) on delete cascade,
  source_span_id uuid not null references public.clinical_source_spans(id),
  sheet_key text not null,
  risk_type text not null,
  source_value text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dataset_release_id, sheet_key, risk_type),
  constraint antibiogram_source_slot_risk_code check (risk_type in ('1', '2', '3')),
  constraint antibiogram_source_slot_review_evidence check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create index if not exists dataset_release_current_idx
  on public.clinical_dataset_releases (status, valid_through);
create index if not exists correction_release_review_idx
  on public.clinical_source_corrections (dataset_release_id, required_for_activation, review_status);
create index if not exists release_source_asset_status_idx
  on public.clinical_release_source_assets (
    dataset_release_id, asset_kind, required_for_activation, verification_status, review_status
  );
create index if not exists patient_risk_release_idx
  on public.patient_risk_criteria (dataset_release_id, criterion_code, review_status);
create index if not exists therapy_slot_release_idx
  on public.antibiogram_therapy_source_slots (dataset_release_id, sheet_key, risk_type, review_status);

create unique index if not exists icmr_release_source_unique
  on public.icmr_guideline_rows (dataset_release_id, clinical_condition, source_span_id);
create unique index if not exists duration_release_source_unique
  on public.duration_guideline_rows (dataset_release_id, infection, source_span_id);
create unique index if not exists antibiogram_footnote_release_unique
  on public.antibiogram_footnotes (dataset_release_id, sheet_key, note);
create unique index if not exists perioperative_procedure_release_unique
  on public.perioperative_procedure_recommendations (dataset_release_id, procedure, source_span_id);
create unique index if not exists perioperative_dosing_release_unique
  on public.perioperative_antibiotic_dosing (dataset_release_id, drug, source_span_id);
create unique index if not exists perioperative_note_release_unique
  on public.perioperative_notes (dataset_release_id, note_type, sort_order, source_span_id);
create unique index if not exists stewardship_pearl_release_unique
  on public.stewardship_pearl_rows (dataset_release_id, section_name, sort_order, source_span_id);
create unique index if not exists ama_pearl_release_unique
  on public.antimicrobial_pearl_point_rows (dataset_release_id, section_name, sort_order, source_span_id);

create or replace function public.guard_clinical_dataset_activation()
returns trigger
language plpgsql
as $$
declare
  unresolved_corrections integer;
  approved_sheets integer;
  approved_slots integer;
  approved_therapies integer;
  approved_risk_criteria integer;
  verified_csv_assets integer;
  unresolved_source_assets integer;
begin
  new.updated_at = now();
  if new.status <> 'active' then
    return new;
  end if;
  if new.valid_through < current_date then
    raise exception 'Cannot activate expired dataset release %', new.release_key;
  end if;
  if new.clinical_reviewer_id is null or new.reviewed_at is null then
    raise exception 'Clinical reviewer evidence is required for activation';
  end if;
  select count(*) into unresolved_corrections
  from public.clinical_source_corrections
  where dataset_release_id = new.id
    and required_for_activation
    and review_status <> 'approved';
  if unresolved_corrections <> 0 then
    raise exception 'Dataset release has % unresolved correction(s)', unresolved_corrections;
  end if;
  select count(*) into verified_csv_assets
  from public.clinical_release_source_assets
  where dataset_release_id = new.id
    and asset_kind = 'csv'
    and verification_status = 'verified';
  select count(*) into unresolved_source_assets
  from public.clinical_release_source_assets
  where dataset_release_id = new.id
    and required_for_activation
    and (verification_status <> 'verified' or review_status <> 'approved');
  if verified_csv_assets <> 21 or unresolved_source_assets <> 0 then
    raise exception 'Dataset source inventory is incomplete: verified CSV assets %, unresolved required assets %',
      verified_csv_assets, unresolved_source_assets;
  end if;
  select count(*) into approved_sheets
  from public.antibiogram_sheets
  where dataset_release_id = new.id and review_status = 'approved';
  select count(*) into approved_slots
  from public.antibiogram_therapy_source_slots
  where dataset_release_id = new.id and review_status = 'approved';
  select count(*) into approved_therapies
  from public.antibiogram_empiric_therapy
  where dataset_release_id = new.id and review_status = 'approved';
  select count(*) into approved_risk_criteria
  from public.patient_risk_criteria
  where dataset_release_id = new.id and review_status = 'approved';
  if approved_sheets <> 16 or approved_slots <> 48 or approved_therapies <> 40 or approved_risk_criteria <> 4 then
    raise exception 'Dataset release is incomplete: sheets %, slots %, therapies %, risk criteria %',
      approved_sheets, approved_slots, approved_therapies, approved_risk_criteria;
  end if;
  new.activated_at = coalesce(new.activated_at, now());
  return new;
end;
$$;

drop trigger if exists clinical_dataset_release_activation_guard
  on public.clinical_dataset_releases;
create trigger clinical_dataset_release_activation_guard
before insert or update on public.clinical_dataset_releases
for each row execute function public.guard_clinical_dataset_activation();

create or replace view public.approved_current_protocol_scenarios_with_source
with (security_invoker = true)
as
select
  r.id as dataset_release_id,
  r.release_key,
  r.guide_version,
  r.valid_through,
  s.id as antibiogram_sheet_id,
  s.infection_type,
  s.location,
  s.acquisition,
  s.infection_type || '.' || s.location || '.' || s.acquisition as sheet_key,
  risk.risk_type,
  s.sheet_title,
  s.section_notes,
  case when t.id is null then 'no_source_therapy' else 'available' end as availability_status,
  t.id as therapy_id,
  t.empiric_therapy,
  slot.source_value,
  span.source_locator,
  span.source_value_sha256,
  span.quote as source_quote,
  source_file.filename as source_filename,
  source_file.file_sha256 as source_file_sha256
from public.clinical_dataset_releases r
join public.antibiogram_sheets s
  on s.dataset_release_id = r.id and s.review_status = 'approved'
cross join (values ('1'::text), ('2'::text), ('3'::text)) as risk(risk_type)
join public.antibiogram_therapy_source_slots slot
  on slot.dataset_release_id = r.id
 and slot.antibiogram_sheet_id = s.id
 and slot.risk_type = risk.risk_type
 and slot.review_status = 'approved'
join public.clinical_source_spans span on span.id = slot.source_span_id
join public.clinical_source_files source_file on source_file.id = span.source_file_id
left join public.antibiogram_empiric_therapy t
  on t.dataset_release_id = r.id
 and t.sheet_key = slot.sheet_key
 and t.risk_type = risk.risk_type
 and t.review_status = 'approved'
where r.status = 'active'
  and r.valid_through >= current_date;

create or replace view public.approved_current_patient_risk_criteria_with_source
with (security_invoker = true)
as
select
  criteria.*,
  release.release_key,
  release.guide_version,
  release.valid_through,
  span.source_locator,
  span.source_value_sha256,
  span.quote as source_quote,
  source_file.filename as source_filename,
  source_file.file_sha256 as source_file_sha256
from public.patient_risk_criteria criteria
join public.clinical_dataset_releases release on release.id = criteria.dataset_release_id
join public.clinical_source_spans span on span.id = criteria.source_span_id
join public.clinical_source_files source_file on source_file.id = span.source_file_id
where criteria.review_status = 'approved'
  and release.status = 'active'
  and release.valid_through >= current_date;

create or replace view public.approved_dataset_release_status
with (security_invoker = true)
as
select
  release.id as dataset_release_id,
  release.release_key,
  release.guide_version,
  case
    when release.valid_through < current_date then 'expired'
    else release.status
  end as effective_status,
  release.valid_from,
  release.valid_through,
  release.updated_at
from public.clinical_dataset_releases release
where release.status in ('approved', 'active', 'expired')
order by release.created_at desc
limit 1;

alter table public.clinical_dataset_releases enable row level security;
alter table public.clinical_source_corrections enable row level security;
alter table public.clinical_release_source_assets enable row level security;
alter table public.patient_risk_criteria enable row level security;
alter table public.antibiogram_therapy_source_slots enable row level security;

-- Replace the legacy "approved regardless of age" policies. Existing approved
-- reference views use security_invoker, so this also expiry-gates every section
-- without changing their public column contracts.
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
      execute format('drop policy if exists "approved %s read" on public.%I', target_table, target_table);
      execute format('drop policy if exists "approved %s current read" on public.%I', target_table, target_table);
      execute format(
        'create policy "approved %s current read" on public.%I for select to authenticated using (
          review_status = ''approved'' and exists (
            select 1 from public.clinical_dataset_releases release
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

drop policy if exists "authenticated read dataset release metadata" on public.clinical_dataset_releases;
create policy "authenticated read dataset release metadata"
on public.clinical_dataset_releases for select
to authenticated
using (status in ('approved', 'active', 'expired'));

drop policy if exists "approved current patient risk read" on public.patient_risk_criteria;
create policy "approved current patient risk read"
on public.patient_risk_criteria for select
to authenticated
using (
  review_status = 'approved'
  and exists (
    select 1 from public.clinical_dataset_releases release
    where release.id = dataset_release_id
      and release.status = 'active'
      and release.valid_through >= current_date
  )
);

drop policy if exists "approved current therapy source slot read" on public.antibiogram_therapy_source_slots;
create policy "approved current therapy source slot read"
on public.antibiogram_therapy_source_slots for select
to authenticated
using (
  review_status = 'approved'
  and exists (
    select 1 from public.clinical_dataset_releases release
    where release.id = dataset_release_id
      and release.status = 'active'
      and release.valid_through >= current_date
  )
);

grant select on
  public.approved_current_protocol_scenarios_with_source,
  public.approved_current_patient_risk_criteria_with_source,
  public.approved_dataset_release_status
to authenticated;

-- Fail-closed maintenance switch. It deliberately never restores the legacy
-- fuzzy recommendation path.
create or replace function public.enter_clinical_dataset_maintenance(p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clinical_dataset_releases
  set status = 'approved', activation_note = p_reason, updated_at = now()
  where status = 'active';
end;
$$;

revoke all on function public.enter_clinical_dataset_maintenance(text) from public;
grant execute on function public.enter_clinical_dataset_maintenance(text) to service_role;
