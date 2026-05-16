-- Source-based clinical ingestion schema for Hinduja Antibiotic Guide.
--
-- Safety rule:
-- Doctor-facing treatment content must come from a source span and must start
-- as draft/pending_review. The app should query only approved rows.

create extension if not exists pgcrypto;

do $$
begin
  create type public.clinical_review_status as enum (
    'draft',
    'pending_review',
    'approved',
    'rejected',
    'retired'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.clinical_source_files (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  original_path text,
  file_sha256 text not null unique,
  mime_type text,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.clinical_source_spans (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.clinical_source_files(id) on delete cascade,
  page_number integer,
  section_heading text,
  span_start integer,
  span_end integer,
  quote text not null,
  extracted_at timestamptz not null default now(),
  unique (source_file_id, page_number, span_start, span_end)
);

create table if not exists public.clinical_recommendations (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
  syndrome text,
  infection_site text,
  setting text,
  acquisition text,
  risk_type text,
  severity_category text,
  organism text,
  pathogen text,
  drug text,
  dose text,
  route text,
  frequency text,
  duration text,
  renal_adjustment text,
  hepatic_adjustment text,
  pregnancy_lactation_caution text,
  allergy_warning text,
  contraindication text,
  stewardship_note text,
  id_consult_trigger text,
  review_status public.clinical_review_status not null default 'pending_review',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_recommendations_has_source check (source_span_id is not null),
  constraint clinical_recommendations_not_approved_without_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create index if not exists clinical_recommendations_lookup_idx
  on public.clinical_recommendations (
    syndrome,
    infection_site,
    setting,
    acquisition,
    risk_type,
    severity_category,
    review_status
  );

create index if not exists clinical_recommendations_source_idx
  on public.clinical_recommendations (source_span_id);

create table if not exists public.clinical_review_audit (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.clinical_recommendations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  from_status public.clinical_review_status,
  to_status public.clinical_review_status not null,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_clinical_recommendations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clinical_recommendations_touch_updated_at
  on public.clinical_recommendations;

create trigger clinical_recommendations_touch_updated_at
before update on public.clinical_recommendations
for each row execute function public.touch_clinical_recommendations_updated_at();

alter table public.clinical_source_files enable row level security;
alter table public.clinical_source_spans enable row level security;
alter table public.clinical_recommendations enable row level security;
alter table public.clinical_review_audit enable row level security;

drop policy if exists "authenticated read source files" on public.clinical_source_files;
drop policy if exists "authenticated read source spans" on public.clinical_source_spans;
drop policy if exists "approved recommendation read" on public.clinical_recommendations;
drop policy if exists "review audit admin read" on public.clinical_review_audit;

create policy "authenticated read source files"
on public.clinical_source_files for select
to authenticated
using (true);

create policy "authenticated read source spans"
on public.clinical_source_spans for select
to authenticated
using (true);

create policy "approved recommendation read"
on public.clinical_recommendations for select
to authenticated
using (review_status = 'approved');

create policy "review audit admin read"
on public.clinical_review_audit for select
to authenticated
using (true);

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
