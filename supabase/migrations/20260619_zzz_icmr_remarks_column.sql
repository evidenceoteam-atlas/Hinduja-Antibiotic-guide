-- A6 — Preserve ICMR "Remarks" independently of "Duration".
--
-- Until now the importer could only persist an ICMR row's Remarks via
-- duration_guideline_rows, and that insert is skipped when Duration is empty
-- (import_hinduja_csv_bundle_to_supabase.py only writes duration_guideline_rows
-- under `if row["duration"]`). icmr_guideline_rows had no Remarks column, so an
-- ICMR row with non-empty Remarks but empty Duration would silently lose its
-- Remarks. No such row exists in the current SHA-pinned bundle (all empty-Duration
-- ICMR rows also have empty Remarks), so this is a latent-defect fix with no data
-- change today. Additive + idempotent: safe to re-run; alters no existing row.

alter table public.icmr_guideline_rows
  add column if not exists remarks text;
