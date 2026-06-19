# Hinduja Antibiotic Guide

Clinical decision-support application with a source-controlled Hinduja CSV ingestion pipeline and a fail-closed mobile protocol flow.

## Safety status

The bundled 2025 guide expired on 2025-12-31. It is reproducible but cannot become an active doctor-facing release. A clinician-reviewed, non-expired replacement release and the missing non-CSV source assets are required before protocol display is enabled.

## Supported runtime flow

The mobile app has no sign-in flow. It reads approved, public clinical views from Supabase and stores optional doctor profile details locally for report personalization. For BSI, UTI, RTI, and IAI, treatment selection uses one exact key:

```text
infection_type + location + acquisition + risk_type
```

The query target is `approved_current_protocol_scenarios_with_source`. It exposes only the active, non-expired dataset release and returns `available` or `no_source_therapy`. Permission, network, schema, malformed-row, missing-scenario, and expired-release states fail closed.

The former weighted `/api/v1/protocols/evaluate` and dummy result endpoints return HTTP 410 and are not supported runtime paths.

## Validate the source bundle

```bash
python3 scripts/hinduja_csv_bundle.py validate
python3 scripts/import_hinduja_csv_bundle_to_supabase.py dry-run
pytest -q
cd mobile && ./node_modules/.bin/tsc --noEmit
```

The activation check is expected to fail for the bundled candidate until clinical governance resolves its blockers:

```bash
python3 scripts/hinduja_csv_bundle.py validate-release --as-of 2026-06-19
```

## Repository layout

```text
Hindujacsv/                 Immutable CSV source bytes
scripts/hinduja_csv/        Six schema-aware adapters and validation gates
docs/ground_truth/          Hash manifest and correction/adjudication ledger
supabase/migrations/        Versioned releases, provenance, exact current views
mobile/src/                 Direct-Supabase exact selector and fail-closed UI
services/                   Supporting FastAPI services; weighted engine retired
tests/                      Source-fidelity, mutation, flow, and contract tests
```

See [Architecture](docs/ARCHITECTURE.md), [Runtime Flow](docs/API_FLOW.md), and [Source Ingestion](docs/SOURCE_INGESTION.md).
