-- Ground-truth section schema for the reviewed Hinduja Antibiotic Guide JSON.
--
-- This migration is schema-only. It preserves the existing source-backed
-- clinical safety model by requiring each clinical row to carry a reviewed
-- source span and by exposing doctor-facing reads through approved views.

create extension if not exists pgcrypto;

create or replace function public.touch_ground_truth_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clinical_guide_documents (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  source_document text not null,
  institution_address text,
  contact text,
  surveillance_period text,
  valid_till text,
  document_index jsonb not null default '[]'::jsonb,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_guide_documents_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint clinical_guide_documents_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.icmr_guideline_rows (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  clinical_condition text not null,
  common_pathogens text,
  empirical_ama text,
  alternate_ama text,
  comments text,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint icmr_guideline_rows_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint icmr_guideline_rows_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.duration_guideline_rows (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  infection text not null,
  duration text not null,
  remarks text,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint duration_guideline_rows_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint duration_guideline_rows_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.antibiogram_sheets (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  infection_type text not null,
  location text not null,
  acquisition text not null,
  sheet_title text not null,
  surveillance text,
  type_totals jsonb not null default '{}'::jsonb,
  section_notes jsonb not null default '[]'::jsonb,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint antibiogram_sheets_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint antibiogram_sheets_unique_sheet unique (infection_type, location, acquisition),
  constraint antibiogram_sheets_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.antibiogram_pathogen_rows (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  antibiogram_sheet_id uuid references public.antibiogram_sheets(id) on delete cascade,
  sheet_key text not null,
  risk_type text not null,
  sno integer,
  pathogen_name text not null,
  isolate_count integer,
  has_footnote_marker boolean not null default false,
  prevalence_pct numeric(6,2),
  sensitivities jsonb not null default '{}'::jsonb,
  raw_sensitivity_text text,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint antibiogram_pathogen_rows_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint antibiogram_pathogen_rows_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.antibiogram_risk_criteria (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  antibiogram_sheet_id uuid references public.antibiogram_sheets(id) on delete cascade,
  sheet_key text not null,
  criterion_name text not null,
  type_1 text,
  type_2 text,
  type_3 text,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint antibiogram_risk_criteria_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint antibiogram_risk_criteria_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.antibiogram_empiric_therapy (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  antibiogram_sheet_id uuid references public.antibiogram_sheets(id) on delete cascade,
  sheet_key text not null,
  risk_type text not null,
  empiric_therapy text not null,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint antibiogram_empiric_therapy_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint antibiogram_empiric_therapy_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.antibiogram_footnotes (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  antibiogram_sheet_id uuid references public.antibiogram_sheets(id) on delete cascade,
  sheet_key text not null,
  risk_type text,
  note text not null,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint antibiogram_footnotes_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint antibiogram_footnotes_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.synergy_testing_rows (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  organism text not null,
  total_tested text,
  negative_for_synergy text,
  positive_for_synergy text,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint synergy_testing_rows_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint synergy_testing_rows_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.antifungal_susceptibility_rows (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  organism_group text not null,
  species text not null,
  drug text not null,
  susceptibility_value text,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint antifungal_susceptibility_rows_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint antifungal_susceptibility_rows_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.stewardship_pearl_rows (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  section_name text not null,
  pearl_text text not null,
  sort_order integer not null default 0,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stewardship_pearl_rows_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint stewardship_pearl_rows_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.antimicrobial_pearl_point_rows (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  section_name text not null,
  pearl_text text not null,
  sort_order integer not null default 0,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint antimicrobial_pearl_point_rows_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint antimicrobial_pearl_point_rows_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.perioperative_procedure_recommendations (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  procedure text not null,
  preferred_drug text not null,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perioperative_procedure_recommendations_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint perioperative_procedure_recommendations_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.perioperative_antibiotic_dosing (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  drug text not null,
  standard_dose text,
  weight_based_dose text,
  bolus_or_infusion_duration text,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perioperative_antibiotic_dosing_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint perioperative_antibiotic_dosing_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.perioperative_notes (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  note_type text not null default 'general',
  note_text text not null,
  sort_order integer not null default 0,
  source_quote text not null,
  source_page integer,
  source_section text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perioperative_notes_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint perioperative_notes_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create index if not exists clinical_guide_documents_review_idx on public.clinical_guide_documents (review_status);
create index if not exists clinical_guide_documents_source_idx on public.clinical_guide_documents (source_span_id);
create index if not exists icmr_guideline_rows_lookup_idx on public.icmr_guideline_rows (clinical_condition, review_status);
create index if not exists icmr_guideline_rows_source_idx on public.icmr_guideline_rows (source_span_id);
create index if not exists duration_guideline_rows_lookup_idx on public.duration_guideline_rows (infection, review_status);
create index if not exists duration_guideline_rows_source_idx on public.duration_guideline_rows (source_span_id);
create index if not exists antibiogram_sheets_lookup_idx on public.antibiogram_sheets (infection_type, location, acquisition, review_status);
create index if not exists antibiogram_sheets_source_idx on public.antibiogram_sheets (source_span_id);
create index if not exists antibiogram_pathogen_rows_lookup_idx on public.antibiogram_pathogen_rows (sheet_key, risk_type, pathogen_name, review_status);
create index if not exists antibiogram_pathogen_rows_sheet_idx on public.antibiogram_pathogen_rows (antibiogram_sheet_id);
create index if not exists antibiogram_pathogen_rows_source_idx on public.antibiogram_pathogen_rows (source_span_id);
create index if not exists antibiogram_risk_criteria_lookup_idx on public.antibiogram_risk_criteria (sheet_key, criterion_name, review_status);
create index if not exists antibiogram_risk_criteria_sheet_idx on public.antibiogram_risk_criteria (antibiogram_sheet_id);
create index if not exists antibiogram_risk_criteria_source_idx on public.antibiogram_risk_criteria (source_span_id);
create index if not exists antibiogram_empiric_therapy_lookup_idx on public.antibiogram_empiric_therapy (sheet_key, risk_type, review_status);
create index if not exists antibiogram_empiric_therapy_sheet_idx on public.antibiogram_empiric_therapy (antibiogram_sheet_id);
create index if not exists antibiogram_empiric_therapy_source_idx on public.antibiogram_empiric_therapy (source_span_id);
create index if not exists antibiogram_footnotes_lookup_idx on public.antibiogram_footnotes (sheet_key, risk_type, review_status);
create index if not exists antibiogram_footnotes_sheet_idx on public.antibiogram_footnotes (antibiogram_sheet_id);
create index if not exists antibiogram_footnotes_source_idx on public.antibiogram_footnotes (source_span_id);
create index if not exists synergy_testing_rows_lookup_idx on public.synergy_testing_rows (organism, review_status);
create index if not exists synergy_testing_rows_source_idx on public.synergy_testing_rows (source_span_id);
create index if not exists antifungal_susceptibility_rows_lookup_idx on public.antifungal_susceptibility_rows (organism_group, species, drug, review_status);
create index if not exists antifungal_susceptibility_rows_source_idx on public.antifungal_susceptibility_rows (source_span_id);
create index if not exists stewardship_pearl_rows_lookup_idx on public.stewardship_pearl_rows (section_name, sort_order, review_status);
create index if not exists stewardship_pearl_rows_source_idx on public.stewardship_pearl_rows (source_span_id);
create index if not exists antimicrobial_pearl_point_rows_lookup_idx on public.antimicrobial_pearl_point_rows (section_name, sort_order, review_status);
create index if not exists antimicrobial_pearl_point_rows_source_idx on public.antimicrobial_pearl_point_rows (source_span_id);
create index if not exists perioperative_procedure_recommendations_lookup_idx on public.perioperative_procedure_recommendations (procedure, review_status);
create index if not exists perioperative_procedure_recommendations_source_idx on public.perioperative_procedure_recommendations (source_span_id);
create index if not exists perioperative_antibiotic_dosing_lookup_idx on public.perioperative_antibiotic_dosing (drug, review_status);
create index if not exists perioperative_antibiotic_dosing_source_idx on public.perioperative_antibiotic_dosing (source_span_id);
create index if not exists perioperative_notes_lookup_idx on public.perioperative_notes (note_type, sort_order, review_status);
create index if not exists perioperative_notes_source_idx on public.perioperative_notes (source_span_id);

alter table public.clinical_guide_documents enable row level security;
alter table public.icmr_guideline_rows enable row level security;
alter table public.duration_guideline_rows enable row level security;
alter table public.antibiogram_sheets enable row level security;
alter table public.antibiogram_pathogen_rows enable row level security;
alter table public.antibiogram_risk_criteria enable row level security;
alter table public.antibiogram_empiric_therapy enable row level security;
alter table public.antibiogram_footnotes enable row level security;
alter table public.synergy_testing_rows enable row level security;
alter table public.antifungal_susceptibility_rows enable row level security;
alter table public.stewardship_pearl_rows enable row level security;
alter table public.antimicrobial_pearl_point_rows enable row level security;
alter table public.perioperative_procedure_recommendations enable row level security;
alter table public.perioperative_antibiotic_dosing enable row level security;
alter table public.perioperative_notes enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
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
    'perioperative_notes'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_ground_truth_updated_at()',
      table_name || '_touch_updated_at',
      table_name
    );

    execute format('drop policy if exists "approved %s read" on public.%I', table_name, table_name);
    execute format(
      'create policy "approved %s read" on public.%I for select to authenticated using (review_status = ''approved'')',
      table_name,
      table_name
    );
  end loop;
end $$;

create or replace view public.approved_clinical_guide_documents_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.clinical_guide_documents r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_icmr_guideline_rows_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.icmr_guideline_rows r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_duration_guideline_rows_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.duration_guideline_rows r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_antibiogram_sheets_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.antibiogram_sheets r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_antibiogram_pathogen_rows_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.antibiogram_pathogen_rows r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_antibiogram_risk_criteria_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.antibiogram_risk_criteria r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_antibiogram_empiric_therapy_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.antibiogram_empiric_therapy r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_antibiogram_footnotes_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.antibiogram_footnotes r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_synergy_testing_rows_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.synergy_testing_rows r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_antifungal_susceptibility_rows_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.antifungal_susceptibility_rows r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_stewardship_pearl_rows_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.stewardship_pearl_rows r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_antimicrobial_pearl_point_rows_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.antimicrobial_pearl_point_rows r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_perioperative_procedure_recommendations_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.perioperative_procedure_recommendations r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_perioperative_antibiotic_dosing_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.perioperative_antibiotic_dosing r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

create or replace view public.approved_perioperative_notes_with_source
with (security_invoker = true)
as
select
  r.*,
  s.page_number as source_span_page_number,
  s.section_heading as source_span_section_heading,
  s.quote as source_span_quote,
  s.extracted_at,
  f.filename as source_filename,
  f.file_sha256 as source_file_sha256
from public.perioperative_notes r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

grant select on
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
  public.approved_stewardship_pearl_rows_with_source,
  public.approved_antimicrobial_pearl_point_rows_with_source,
  public.approved_perioperative_procedure_recommendations_with_source,
  public.approved_perioperative_antibiotic_dosing_with_source,
  public.approved_perioperative_notes_with_source
to authenticated;
