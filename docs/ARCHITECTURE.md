# System Architecture

## Clinical data lineage

```text
Hindujacsv source bytes + SHA-256 manifest
  -> six deterministic schema-aware adapters
  -> pending correction/adjudication ledger
  -> versioned dataset release
  -> source-linked specialized tables
  -> active + non-expired approved views
  -> exact mobile scenario query
```

Raw source values and reviewer-approved corrections are separate records. Generated JSON is an artifact, never a source. CSV locators use logical row/column coordinates; PDF pages remain null unless a verified PDF crosswalk exists.

## Dataset releases

`clinical_dataset_releases` owns guide validity and activation. Activation is rejected unless the release has:

- clinician reviewer evidence and a current validity date;
- 21 verified CSV assets and no unresolved required source assets;
- no unresolved required correction records;
- 16 approved local antibiogram sheets;
- 48 approved source slots;
- exactly 40 non-empty approved therapy rows; and
- four approved risk-criterion rows.

All legacy approved-view RLS policies are release- and expiry-gated. The 2025 legacy JSON is attached to an expired release.

## Mobile

The mobile app uses Supabase directly. Treatment selection never uses substring, token-overlap, ranking, progressive fallback, or infection-only fallback. Fuzzy matching remains limited to navigation/search.

The treatment view expands each approved sheet across Type 1/2/3 and left-joins the 40 non-empty therapies. The eight blank source cells remain source slots with null therapy and return `no_source_therapy`; they are not manufactured treatment rows.

## Services

FastAPI services still provide authentication-related scaffolding, dashboard metadata, guidelines, reports, sharing, and operational endpoints. The weighted protocol evaluator is retired with HTTP 410. A future API protocol endpoint must delegate to the exact Supabase selector rather than introduce another recommendation store.

## Rollback

`supabase/sql/disable_active_dataset_release.sql` enters a fail-closed maintenance state by removing the active release pointer. Rollback never re-enables the fuzzy or weighted recommendation paths.
