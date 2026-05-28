create table if not exists public.synergy_antifungal_notes (
  id uuid primary key default gen_random_uuid(),
  source_span_id uuid not null references public.clinical_source_spans(id),
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
  constraint synergy_antifungal_notes_source_quote_not_blank check (length(btrim(source_quote)) > 0),
  constraint synergy_antifungal_notes_approved_has_reviewer check (
    review_status <> 'approved' or (reviewer_id is not null and reviewed_at is not null)
  )
);

create index if not exists synergy_antifungal_notes_review_idx
  on public.synergy_antifungal_notes (review_status, sort_order);
create index if not exists synergy_antifungal_notes_source_idx
  on public.synergy_antifungal_notes (source_span_id);

alter table public.synergy_antifungal_notes enable row level security;

drop policy if exists "approved synergy_antifungal_notes read" on public.synergy_antifungal_notes;
create policy "approved synergy_antifungal_notes read"
  on public.synergy_antifungal_notes
  for select
  to authenticated
  using (review_status = 'approved');

create or replace view public.approved_synergy_antifungal_notes_with_source
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
from public.synergy_antifungal_notes r
join public.clinical_source_spans s on s.id = r.source_span_id
join public.clinical_source_files f on f.id = s.source_file_id
where r.review_status = 'approved';

grant select on public.approved_synergy_antifungal_notes_with_source to authenticated;
