# Source-Based Clinical Ingestion

## Hinduja CSV bundle

`Hindujacsv/` is an immutable, repository-owned source directory. Its 21 files are pinned in `docs/ground_truth/hinduja_csv_manifest.json`. Never rewrite a source file in place; changed bytes require a new manifest and release key.

Validate hashes, schemas, exact counts, source locators, therapy blanks, section ownership, and deterministic record hashes:

```bash
python3 scripts/hinduja_csv_bundle.py validate
```

Preview the pending database import:

```bash
python3 scripts/import_hinduja_csv_bundle_to_supabase.py dry-run
```

After applying `supabase/migrations/20260619_versioned_csv_release_flow.sql`, an administrator can import a pending release:

```bash
SUPABASE_DB_URL='postgresql://...' \
python3 scripts/import_hinduja_csv_bundle_to_supabase.py import-pending
```

The importer deliberately has no approval flag. It registers actual CSV bytes, logical row/column spans, source-value hashes, all 48 therapy source slots, only 40 non-empty therapy records, and the correction/source-asset blockers. Clinical approval and release activation are separate audited actions.

## Clinical authority boundary

`docs/ground_truth/corrections.reviewed.json` records source contradictions and semantic transformations. Acquisition, recommendation role, treatment options, dose qualifiers, duration, warnings, and section moves require a named clinician and review timestamp. Missing non-CSV assets remain explicit activation blockers.

The bundled candidate is expired and pending review. `validate-release` must fail until a new valid release, all required source assets, and all clinical approvals exist:

```bash
python3 scripts/hinduja_csv_bundle.py validate-release
```

## Generic source ingestion

`scripts/clinical_ingest.py` remains available for genuinely headered generic CSVs plus PDF, DOCX, Markdown, and text. It rejects headerless/sectioned/ambiguous CSVs rather than reporting a misleading zero-row success. The Hinduja sources must use their schema-aware adapters.

## Legacy reviewed JSON

`docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json` is retained as a legacy artifact for comparison. It is not the source asset for CSV-backed content and must not be activated. The canonical pending import is generated from the immutable source bundle.
