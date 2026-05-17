# Source-Based Clinical Ingestion

The Hinduja Antibiotic Guide must fail closed unless a recommendation is
traceable to an uploaded institutional source and has been clinician-approved.

## Supported Source Files

Use `scripts/clinical_ingest.py` for:

- PDF
- DOCX
- CSV
- Markdown / text

Example:

```bash
python scripts/clinical_ingest.py \
  "/Users/sravya/Downloads/Antibiotic protocol pocket guide.pdf" \
  --output /tmp/antibiotic_protocol_pocket_guide.draft.jsonl
```

The extractor preserves:

- source filename
- file SHA-256
- page number when available
- nearby section heading when detectable
- source quote/span
- extraction timestamp

It does not infer antibiotic names, doses, durations, routes, renal adjustments,
pregnancy cautions, organisms, alternatives, or warnings. Structured clinical
fields remain `NULL` until a reviewer fills them from the source quote.

The extractor rejects empty clinical recommendation rows. A draft
recommendation must contain source provenance and at least explicit treatment
text in the `drug` field. Dose, route, frequency, duration, setting,
acquisition, risk type, and warnings are populated only when they are present in
the extracted source span; otherwise they stay `NULL`.

## Database Workflow

Apply:

```text
supabase/migrations/20260516_source_clinical_ingestion.sql
```

The migration creates:

- `clinical_source_files`
- `clinical_source_spans`
- `clinical_recommendations`
- `clinical_review_audit`
- `approved_clinical_recommendations_with_source`

All imported rows must start as `pending_review`. A row cannot be approved unless
it has a reviewer and review timestamp. Every recommendation has a required
`source_span_id`.

## Secure Draft Import

Draft clinical imports must use an admin-only credential. Do not use the mobile
anon key for draft/source tables, and do not grant `anon` access to
`clinical_source_files`, `clinical_source_spans`, or draft
`clinical_recommendations`.

Preferred direct database import:

```bash
SUPABASE_DB_URL='postgresql://...' \
python scripts/import_clinical_jsonl_to_supabase.py \
  /tmp/antibiotic_protocol_pocket_guide.draft.jsonl
```

Service-role REST import:

```bash
SUPABASE_URL='https://your-project.supabase.co' \
SUPABASE_SERVICE_ROLE_KEY='your-service-role-key' \
python scripts/import_clinical_jsonl_to_supabase.py \
  /tmp/antibiotic_protocol_pocket_guide.draft.jsonl
```

The service-role key is server/admin only. Never put it in Expo, mobile,
frontend, Vercel public env vars, or committed files. The importer intentionally
refuses anon-key-only REST imports with:

```text
Draft clinical import requires service role or DB URL. Do not use anon key.
```

The importer preserves the extracted fields exactly, skips duplicate source
files/spans/recommendations, and keeps all recommendations as `pending_review`.
It prints insert/skip counts and the current
`approved_clinical_recommendations_with_source` row count.

If earlier imports created empty approved or pending rows with all clinical
fields `NULL`, run the cleanup script with admin/service-role privileges before
importing corrected draft rows:

```bash
psql "$SUPABASE_DB_URL" \
  -f supabase/sql/cleanup_empty_clinical_recommendations.sql
```

## Review And Approval

1. Upload/extract source guide files.
2. Review each source quote against the original guide.
3. Populate only fields explicitly present in the source.
4. Leave absent fields as `NULL` or `not specified in source`.
5. Set `review_status = 'approved'` only after clinician review.

Do not approve AI-generated, inferred, or substituted clinical values.

## Mobile App Behavior

The mobile app queries only:

```text
approved_clinical_recommendations_with_source
```

If no approved recommendation matches the selected infection, setting,
acquisition, and risk type, the app shows:

```text
No approved recommendation available. Refer institutional guideline / ID specialist.
```

The app must never call AI to generate doctor-facing antibiotic treatment
recommendations at runtime.

## Source Citation Verification

Each displayed approved recommendation includes source filename, page number
when available, and the source quote. Admin/reviewer audit exports should include
the same fields so reviewers can compare every row against the uploaded guide.
