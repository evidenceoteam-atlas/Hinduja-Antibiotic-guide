# Hinduja Antibiotic Guide — Claude Code Context

This file is auto-loaded as context for every Claude Code session in this repo. Read it first.

## 1. Project Overview

A clinical decision support platform for antibiotic stewardship at Hinduja Hospital. Clinicians enter an infection site, care setting (ICU/Ward), acquisition mode (Community-/Hospital-acquired), and risk factors; the system returns a risk classification (Type 1/2/3) and source-backed recommended therapy with stewardship alerts.

**Two surfaces:** a Python FastAPI microservices backend (currently mostly scaffold/demo) and an Expo React Native mobile app that reads approved clinical content directly from Supabase Postgres.

**Safety posture — non-negotiable:** the system is **fail-closed**. If no approved recommendation exists for the inputs, the app shows an "insufficient validated data" message and prompts ID consult — it does **not** guess. All clinical content carries `review_status` (`draft → in_review → approved → retired`); doctors only see `approved` rows that belong to an **active, non-expired dataset release**, via Supabase RLS.

## 2. Tech Stack

**Backend (Python 3.11):** FastAPI 0.111+, Uvicorn, SQLAlchemy 2 async, asyncpg, Alembic, Redis 5 (OTP + event bus via streams), python-jose + bcrypt (JWT), structlog, Prometheus + OpenTelemetry, ReportLab + qrcode. See [pyproject.toml](pyproject.toml).

**Mobile (TypeScript):** Expo 54, React 19, React Native 0.81, a read-only PostgREST client, and `@react-native-async-storage/async-storage`. See [mobile/package.json](mobile/package.json).

**Infra:** PostgreSQL 16 (Supabase-hosted in prod, local in dev), Redis 7-alpine, NGINX 1.27-alpine gateway, Docker Compose for local, Kubernetes/Helm under [infra/](infra/) for prod.

## 3. Repository Layout

```text
services/       9 independently deployable FastAPI services (mostly scaffolds today)
shared/         Shared Python library: clinical rules, schemas, auth, events, DB, ML, search
mobile/         Expo React Native app — entire UI is in mobile/src/AppRoot.tsx
supabase/       Postgres schema migrations for the Supabase project
Hindujacsv/     The 21 source CSVs — the authoritative clinical content (SHA-pinned by a manifest)
scripts/hinduja_csv/  Schema-aware CSV adapters + bundle validation (source of truth pipeline)
rules/          Retired weighted-protocol JSON stub (kept only as a tombstone; not a data source)
alembic/        Backend DB migrations (separate from Supabase migrations)
infra/          Dockerfile, NGINX config, Kubernetes/Helm, OpenTelemetry monitoring
tests/          pytest suite (CSV bundle fidelity, versioned-release flow, risk classifier, engine retirement)
docs/           Architecture notes, API flow, seed data, prior audits
.github/        CI workflow (ruff + pytest)
```

## 4. Architecture at a Glance

**Three layers, loosely coupled:**

1. **Backend microservices** under [services/](services/) — 9 FastAPI apps fronted by NGINX gateway on `:8080/api/v1`. Inter-service comms via Redis event bus ([shared/events/bus.py](shared/events/bus.py)). **Important:** every service `main.py` is currently 37–120 lines of demo/scaffold code with hardcoded sample data — treat them as architectural placeholders, not implementations. The legacy weighted protocol-engine endpoints are now **retired** (HTTP 410); see §5. Services: `auth-service`, `protocol-engine`, `antibiogram-service`, `guideline-service`, `case-service`, `report-service`, `alert-service`, `share-service`, `user-service`.

2. **Mobile app** — the entire UI lives in [mobile/src/AppRoot.tsx](mobile/src/AppRoot.tsx). It's a screen-router state machine (no React Navigation); the current screen state determines which view renders. The mobile app talks **directly to Supabase** for approved public clinical-content reads. It has no sign-in flow; profile details are local personalization only. The main Protocol Result reads the exact-key view `approved_current_protocol_scenarios_with_source` via [mobile/src/protocolScenario.ts](mobile/src/protocolScenario.ts).

3. **Supabase** — base schema in [supabase/migrations/20260516_source_clinical_ingestion.sql](supabase/migrations/20260516_source_clinical_ingestion.sql) (source files/spans/recommendations) and [supabase/migrations/20260526_ground_truth_sections.sql](supabase/migrations/20260526_ground_truth_sections.sql) (the 16 section tables); the versioned release flow is in [supabase/migrations/20260619_versioned_csv_release_flow.sql](supabase/migrations/20260619_versioned_csv_release_flow.sql) and public read access in [supabase/migrations/20260619_zz_public_approved_clinical_read.sql](supabase/migrations/20260619_zz_public_approved_clinical_read.sql). RLS gates every clinical table to `review_status='approved'` **and** an active, non-expired `dataset_release`; reviewers/admins see all. Audit triggers capture before/after JSON snapshots on every mutation.

## 5. Clinical Domain & Data Flow

**Source of truth — the SHA-pinned CSV bundle.** Clinical content flows from the 21 files in [Hindujacsv/](Hindujacsv/) through schema-aware adapters, not from any hardcoded Python/TS table:

```text
Hindujacsv/*.csv
  → scripts/hinduja_csv/adapters.py + bundle.py   (6 adapters; SHA + byte-size + count contracts; review flags; fail-closed candidate)
  → scripts/import_hinduja_csv_bundle_to_supabase.py   (writes a pending_review dataset release; NO --approve switch)
  → supabase/migrations/20260619_versioned_csv_release_flow.sql   (versioned releases, activation guard trigger, expiry-gated RLS)
  → approved_current_protocol_scenarios_with_source / approved_current_patient_risk_criteria_with_source
  → mobile/src/protocolScenario.ts (exact 4-field key) → AppRoot Protocol Result
```

- **Risk classification** — [shared/clinical/antibiogram_risk.py](shared/clinical/antibiogram_risk.py) and [mobile/src/antibiogramRisk.ts](mobile/src/antibiogramRisk.ts): exact-match against the reviewed Patient Risk Stratification criteria. Type 1 requires **ALL** criteria at level 1; Type 2/3 trigger on **ANY ONE** criterion; precedence Type 3 > Type 2 > Type 1. Missing/partial/invalid input → `insufficient/manual_review` (fail-closed; no default Type 2).
- **Scenario coverage** — BSI, UTI, RTI, IAI are sourced from CSV therapy sheets 03–18 (ICU/wards × community-/hospital-acquired × Type 1/2/3). The **8 hospital-acquired Type-1 cells are intentionally blank** → `availability_status='no_source_therapy'` (fail-closed, never an invented placeholder). CNS/SSTI/FN are not yet sourced as risk-typed scenarios.
- **Fail-closed lookup** — the exact 4-field key (`infection_type.location.acquisition.risk_type`) returns `found` / `no_source_therapy` / `expired` / `missing_scenario`; there is **no fuzzy fallback** on the protocol-result path.

**Retired weighted engine.** The old `JsonRuleEvaluator` ([shared/clinical/rules.py](shared/clinical/rules.py)) and [rules/hinduja_protocols.json](rules/hinduja_protocols.json) are **retired** (the JSON is a `{"status":"retired"}` tombstone; the class carries a do-not-use docstring and is never instantiated). `POST /api/v1/protocols/evaluate` and `GET /api/v1/protocols/result/{id}` now return **HTTP 410 GONE** ([services/protocol-engine/app/main.py](services/protocol-engine/app/main.py)). Do **not** reintroduce weighted scoring — it contradicted the reviewed risk criteria.

**Tests** — [tests/test_hinduja_csv_bundle.py](tests/test_hinduja_csv_bundle.py) and [tests/test_versioned_protocol_flow_static.py](tests/test_versioned_protocol_flow_static.py) pin source fidelity, blank-cell preservation, exact-key selection, and engine retirement. [tests/test_protocol_engine.py](tests/test_protocol_engine.py) asserts the 410 retirement.

**DB-backed clinical metadata** — the section tables (ICMR guidelines, duration, antibiogram sheets/pathogen/empiric/risk/footnotes, synergy, antifungal, stewardship/AMA pearls, perioperative) live in [supabase/migrations/20260526_ground_truth_sections.sql](supabase/migrations/20260526_ground_truth_sections.sql). Every row has `review_status`, `reviewer_id`, and a `dataset_release_id`.

## 6. Access and Authentication

**Mobile (live):** no authentication method. The app opens directly, reads only approved public Supabase views, and stores optional doctor profile details in local device storage. Local profile data does not authorize access.

**Backend (scaffold):** [services/auth-service/app/main.py](services/auth-service/app/main.py) retains a separate OTP + JWT scaffold using Redis and `python-jose`. It is not connected to the mobile app and contains no federated sign-in integration.

## 7. Common Commands

```bash
# Backend — full local stack (postgres + redis + 9 services + nginx)
cp .env.example .env
docker compose up --build
# Gateway then live at http://localhost:8080/api/v1

# Backend tests + lint
pytest -q
ruff check .

# Validate the source CSV bundle (hashes, schemas, fidelity counts)
python scripts/hinduja_csv_bundle.py validate
# Preview the pending-review import (no DB writes)
python scripts/import_hinduja_csv_bundle_to_supabase.py dry-run

# Mobile
cd mobile && cp .env.example .env.local
npm install
npm run web         # or: npm run ios / npm run android

# Supabase migrations (apply the whole supabase/migrations/ folder in filename order via CLI or dashboard)
```

The README's "Validate the source bundle" section has the runnable example.

## 8. Environment Variables

**Backend** — see [.env.example](.env.example): `APP_ENV`, `PROJECT_NAME`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (asyncpg), `REDIS_URL`, `JWT_SECRET`, `JWT_ISSUER`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`, `OTP_TTL_SECONDS`, `ALLOWED_ORIGINS`, `PDF_STORAGE_PATH`, `EVENT_STREAM`. The importer additionally reads `SUPABASE_DB_URL` (Postgres connection string) for `import-pending`.

**Mobile** — see [mobile/.env.example](mobile/.env.example): only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon key is intentionally public-safe; **never** put the service-role key in the mobile build). Loaded via [mobile/app.config.js](mobile/app.config.js), which reads `.env`, `.env.local`, and the parent `.env.local` in that order.

## 9. CI/CD

[.github/workflows/ci.yml](.github/workflows/ci.yml) — single backend job on push/PR: install deps, `ruff check .`, `python scripts/hinduja_csv_bundle.py validate` (CSV source-bundle fidelity), `pytest`, `pip-audit`, and `docker compose build`. **No Expo builds, no migration runners, no deploy automation, no live-DB integration tests** (the [tests/integration/](tests/integration/) scaffold runs only when `HINDUJA_TEST_DATABASE_URL` is set). Adding these is an open task.

## 10. Key Files for Navigation

| Concern | File | Lines |
|---|---|---|
| CSV adapters / bundle | [scripts/hinduja_csv/adapters.py](scripts/hinduja_csv/adapters.py), [bundle.py](scripts/hinduja_csv/bundle.py) | full files |
| CSV source manifest | [docs/ground_truth/hinduja_csv_manifest.json](docs/ground_truth/hinduja_csv_manifest.json) | full file |
| Pending-review importer | [scripts/import_hinduja_csv_bundle_to_supabase.py](scripts/import_hinduja_csv_bundle_to_supabase.py) | full file |
| Versioned release flow | [supabase/migrations/20260619_versioned_csv_release_flow.sql](supabase/migrations/20260619_versioned_csv_release_flow.sql) | full file |
| Public approved-read RLS | [supabase/migrations/20260619_zz_public_approved_clinical_read.sql](supabase/migrations/20260619_zz_public_approved_clinical_read.sql) | full file |
| Risk classifier | [shared/clinical/antibiogram_risk.py](shared/clinical/antibiogram_risk.py), [mobile/src/antibiogramRisk.ts](mobile/src/antibiogramRisk.ts) | full files |
| Mobile exact-key scenario loader | [mobile/src/protocolScenario.ts](mobile/src/protocolScenario.ts) | full file |
| Retired engine (tombstone) | [services/protocol-engine/app/main.py](services/protocol-engine/app/main.py), [rules/hinduja_protocols.json](rules/hinduja_protocols.json) | full files |
| Base schema + RLS | [supabase/migrations/20260516_source_clinical_ingestion.sql](supabase/migrations/20260516_source_clinical_ingestion.sql), [20260526_ground_truth_sections.sql](supabase/migrations/20260526_ground_truth_sections.sql) | full files |
| Bundle / flow tests | [tests/test_hinduja_csv_bundle.py](tests/test_hinduja_csv_bundle.py), [tests/test_versioned_protocol_flow_static.py](tests/test_versioned_protocol_flow_static.py) | full files |
| CI | [.github/workflows/ci.yml](.github/workflows/ci.yml) | full file |

## 11. Known Gaps & Production Blockers

- **Clinical content not yet activated.** The CSV bundle imports as `pending_review`; no `dataset_release` is `active` until a clinical reviewer signs and activates one. Until then every doctor-facing view correctly returns nothing (fail-closed by design).
- **Legacy `clinical_recommendations` path.** This older table + its `approved_clinical_recommendations_with_source` view are NOT release/expiry-gated like the rest, and are still read by some mobile Guideline reference sections — flagged for retirement/gating (see the dated CSV-flow audit/plan).
- **FastAPI services are scaffolds.** Each `services/*/app/main.py` is 37–120 lines of demo handlers with hardcoded sample data; the protocol-engine evaluator is intentionally retired (410).
- **Mobile bypasses backend.** The app reads Supabase directly, not the FastAPI gateway. Pick one architecture before scaling.
- **No admin / reviewer UI.** Clinical review, correction adjudication, and release activation are SQL/database actions today.
- **CI is backend-only.** No Expo build, no live-DB integration test for the importer/activation guard, no deploy pipeline.
- **No legal / clinical / security sign-off recorded.** Required before any patient-facing use.

## 12. Working Norms

- **Never hardcode clinical recommendations** in Python or TypeScript. Clinical content flows from [Hindujacsv/](Hindujacsv/) through the [scripts/hinduja_csv/](scripts/hinduja_csv/) adapters/bundle into the versioned Supabase release and is read through the `approved_current_*` views. Do not reintroduce the retired weighted evaluator or treat [rules/hinduja_protocols.json](rules/hinduja_protocols.json) as a data source.
- **Never bypass `review_status` or release gating.** Don't add code paths that read non-approved rows, or approved rows from a non-active/expired release, for doctors. Don't disable RLS.
- **Preserve fail-closed behavior.** If you change the risk classifier or the protocol-scenario lookup, the "no match → no recommendation, show insufficient-data message" path must still trigger, and blank source cells must stay `no_source_therapy` (never an invented placeholder).
- **Don't put secrets in the mobile bundle.** The Expo build can only see `EXPO_PUBLIC_*` vars. Service-role keys, JWT secrets, and DB URLs must never appear in `mobile/`.
- **Existing audit docs in [docs/](docs/) are historical snapshots** — don't edit them. New audit findings go in a newly-dated file.
