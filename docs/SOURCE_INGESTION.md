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
