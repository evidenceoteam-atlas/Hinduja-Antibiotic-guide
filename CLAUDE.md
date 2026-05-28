ile filter logic, the "no match → no recommendation, show insufficient-data message" path must still trigger.
- **Don't put secrets in the mobile bundle.** The Expo build can only see `EXPO_PUBLIC_*` vars. Service-role keys, JWT secrets, DB URLs must never a# Hinduja Antibiotic Guide — Claude Code Context

This file is auto-loaded as context for every Claude Code session in this repo. Read it first.

## 1. Project Overview

A clinical decision support platform for antibiotic stewardship at Hinduja Hospital. Clinicians enter an infection site, care setting (ICU/Ward), acquisition mode (Community-/Hospital-acquired), and risk factors; the system returns a risk classification (Type 1/2/3) and recommended therapy with stewardship alerts.

**Two surfaces:** a Python FastAPI microservices backend (currently mostly scaffold/demo) and an Expo React Native mobile app that reads approved clinical content directly from Supabase Postgres.

**Safety posture — non-negotiable:** the system is **fail-closed**. If no approved recommendation exists for the inputs, the app shows an "insufficient validated data" message and prompts ID consult — it does **not** guess. All clinical content carries `review_status` (`draft → in_review → approved → retired`); doctors only see `approved` rows via Supabase RLS.

## 2. Tech Stack

**Backend (Python 3.11):** FastAPI 0.111+, Uvicorn, SQLAlchemy 2 async, asyncpg, Alembic, Redis 5 (OTP + event bus via streams), python-jose + bcrypt (JWT), structlog, Prometheus + OpenTelemetry, ReportLab + qrcode. See [pyproject.toml](pyproject.toml).

**Mobile (TypeScript):** Expo 54, React 19, React Native 0.81, `@supabase/supabase-js` 2.105+, `expo-secure-store`, `@react-native-async-storage/async-storage`. See [mobile/package.json](mobile/package.json).

**Infra:** PostgreSQL 16 (Supabase-hosted in prod, local in dev), Redis 7-alpine, NGINX 1.27-alpine gateway, Docker Compose for local, Kubernetes/Helm under [infra/](infra/) for prod.

## 3. Repository Layout

```text
services/       9 independently deployable FastAPI services (mostly scaffolds today)
shared/         Shared Python library: clinical rules, schemas, auth, events, DB, ML, search
mobile/         Expo React Native app — entire UI is in mobile/src/AppRoot.tsx
supabase/       Postgres schema migrations for the Supabase project
rules/          JSON-driven clinical protocol matrices (hot-swappable without redeploy)
alembic/        Backend DB migrations (separate from Supabase migrations)
infra/          Dockerfile, NGINX config, Kubernetes/Helm, OpenTelemetry monitoring
tests/          pytest suite (currently focused on the rules engine)
docs/           Architecture notes, API flow, seed data, prior audits
.github/        CI workflow (ruff + pytest only)
```

## 4. Architecture at a Glance

**Three layers, loosely coupled:**

1. **Backend microservices** under [services/](services/) — 9 FastAPI apps fronted by NGINX gateway on `:8080/api/v1`. Inter-service comms via Redis event bus ([shared/events/bus.py](shared/events/bus.py)). **Important:** every service `main.py` is currently 37–120 lines of demo/scaffold code with hardcoded sample data — treat them as architectural placeholders, not implementations. Services: `auth-service`, `protocol-engine`, `antibiogram-service`, `guideline-service`, `case-service`, `report-service`, `alert-service`, `share-service`, `user-service`.

2. **Mobile app** — the entire UI lives in [mobile/src/AppRoot.tsx](mobile/src/AppRoot.tsx) (~5,446 lines). It's a screen-router state machine (no React Navigation); the `currentScreen` state determines which view renders. The mobile app talks **directly to Supabase** for clinical content reads and auth; the FastAPI backend is not currently the data source for the mobile app.

3. **Supabase** — Postgres schema in [supabase/migrations/001_clinical_decision_support.sql](supabase/migrations/001_clinical_decision_support.sql). RLS policies gate every clinical table to `review_status='approved'` for doctors; reviewers/admins see all. Audit triggers capture before/after JSON snapshots on every mutation.

## 5. Clinical Domain & Data Flow

**Risk scoring engine** — [shared/clinical/rules.py](shared/clinical/rules.py):

- `JsonRuleEvaluator` ([rules.py:59](shared/clinical/rules.py#L59)) — declarative, JSON-driven. **No clinical pathways hardcoded in Python.**
- Inputs: `infection_code`, `setting` (`ICU`|`Ward`), `acquisition` (`Community-acquired`|`Hospital-acquired`), list of `{key, value: bool}` risk factors.
- Scoring: each true risk factor adds its weight from `rules.risk_weights`; setting and acquisition add context weights; total score is bucketed by `thresholds` into `Type 1 / 2 / 3`.
- Matrix lookup: `recommendation_matrix[infection_code][setting][acquisition][risk_type]`. **If empty, fails closed** ([rules.py:96-119](shared/clinical/rules.py#L96)) — returns `insufficient_validated_data=True`, empty therapy list, ID consult required.
- Stewardship alerts triggered automatically for Type 3 and for carbapenem recommendations ([rules.py:155-165](shared/clinical/rules.py#L155)).

**Rule data** — [rules/hinduja_protocols.json](rules/hinduja_protocols.json):

- Only **UTI** has populated pathways. **BSI, RTI, IAI, CNS, SSTI, FN are empty placeholders by design** — fail-closed until clinical reviewers populate them.

**Evaluation API** — `POST /api/v1/protocols/evaluate` in [services/protocol-engine/app/main.py:73](services/protocol-engine/app/main.py#L73). On evaluation, publishes `protocol.generated` (and `alert.triggered` if alerts present) to the Redis event bus.

**Tests** — [tests/test_protocol_engine.py](tests/test_protocol_engine.py) exercises Type 2 happy path, Type 3 alert path, and the fail-closed pathway. Tests read the live JSON file, so rules-data edits are validated by CI.

**DB-backed clinical metadata** — [supabase/migrations/001_clinical_decision_support.sql](supabase/migrations/001_clinical_decision_support.sql) defines `antibiotics`, `infections`, `treatment_guidelines`, `guideline_antibiotics`, `renal_adjustments`, `hepatic_adjustments`, `pregnancy_lactation_safety`, `contraindications`, `allergy_cross_reactivity`, `adverse_effects`, `drug_interactions`, `references`. Every row has `review_status`, `last_reviewed_at`, `reviewer_id`.

## 6. Auth Flow

**Mobile (live):** Supabase email OTP via [mobile/src/supabase.ts](mobile/src/supabase.ts). Storage is platform-aware — `localStorage` on web, `expo-secure-store` on native. `auth.signInWithOtp({ shouldCreateUser: true })` sends the magic-link / OTP; the app uses 6-digit OTP entry. Session restoration + `onAuthStateChange` wired into [mobile/src/AppRoot.tsx](mobile/src/AppRoot.tsx).

**Backend (scaffold):** [services/auth-service/app/main.py](services/auth-service/app/main.py) implements its own OTP + JWT flow using Redis for hashes and `python-jose` for tokens — but it hardcodes `DEMO_USER_ID` and returns `Dr. Ananya Sharma` as the profile ([auth-service/app/main.py:32-33](services/auth-service/app/main.py#L32), [:106-115](services/auth-service/app/main.py#L106)). The mobile app does not call this; it goes directly to Supabase. Decide before launch: keep Supabase-only, or finish the FastAPI auth path.

## 7. Common Commands

```bash
# Backend — full local stack (postgres + redis + 9 services + nginx)
cp .env.example .env
docker compose up --build
# Gateway then live at http://localhost:8080/api/v1

# Backend tests + lint
pytest -q
ruff check .

# Mobile
cd mobile && cp .env.example .env.local
npm install
npm run web         # or: npm run ios / npm run android

# Supabase migration (run before first mobile use against a real project)
# Apply supabase/migrations/001_clinical_decision_support.sql via Supabase CLI or dashboard.

# Alembic (backend Postgres, separate from Supabase)
alembic upgrade head
```

Sample evaluation curl is in [README.md](README.md#L48-L63).

## 8. Environment Variables

**Backend** — see [.env.example](.env.example): `APP_ENV`, `PROJECT_NAME`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (asyncpg), `REDIS_URL`, `JWT_SECRET`, `JWT_ISSUER`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`, `OTP_TTL_SECONDS`, `ALLOWED_ORIGINS`, `PDF_STORAGE_PATH`, `EVENT_STREAM`.

**Mobile** — see [mobile/.env.example](mobile/.env.example): only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon key is intentionally public-safe; **never** put the service-role key in the mobile build). Loaded via [mobile/app.config.js](mobile/app.config.js), which reads `.env`, `.env.local`, and the parent `.env.local` in that order.

## 9. CI/CD

[.github/workflows/ci.yml](.github/workflows/ci.yml) — single job on push/PR: install backend deps, `ruff check .`, `pytest -q`. **No Docker builds, no Expo builds, no migration runners, no deploy automation.** Adding these is an open task.

## 10. Key Files for Navigation

| Concern | File | Lines |
|---|---|---|
| Rules engine core | [shared/clinical/rules.py](shared/clinical/rules.py) | 59–175 |
| Clinical rule data | [rules/hinduja_protocols.json](rules/hinduja_protocols.json) | full file |
| Protocol eval API | [services/protocol-engine/app/main.py](services/protocol-engine/app/main.py) | 73–89 |
| Backend auth scaffold | [services/auth-service/app/main.py](services/auth-service/app/main.py) | full file |
| Mobile screen router | [mobile/src/AppRoot.tsx](mobile/src/AppRoot.tsx) | ~40–68 (cases) |
| Mobile clinical fetch | [mobile/src/AppRoot.tsx](mobile/src/AppRoot.tsx) | ~1235–1328 |
| Supabase client | [mobile/src/supabase.ts](mobile/src/supabase.ts) | full file |
| DB schema + RLS | [supabase/migrations/001_clinical_decision_support.sql](supabase/migrations/001_clinical_decision_support.sql) | full file |
| Rules engine tests | [tests/test_protocol_engine.py](tests/test_protocol_engine.py) | full file |
| Local stack | [docker-compose.yml](docker-compose.yml) | full file |
| CI | [.github/workflows/ci.yml](.github/workflows/ci.yml) | full file |
| Detailed audit | [docs/PROJECT_AUDIT_2026-05.md](docs/PROJECT_AUDIT_2026-05.md) | companion to this file |

## 11. Known Gaps & Production Blockers

Short list — see [docs/PROJECT_AUDIT_2026-05.md](docs/PROJECT_AUDIT_2026-05.md) for severity and remediation detail.

- **Clinical content not entered.** Only UTI has rule pathways; all DB clinical tables need reviewer-approved rows with source references before any infection beyond UTI returns recommendations.
- **FastAPI services are scaffolds.** Each `services/*/app/main.py` is 37–120 lines of demo handlers with hardcoded sample data (`DEMO_USER_ID`, `Dr. Ananya Sharma`, seeded sensitivity tables, hardcoded alerts).
- **Mobile bypasses backend.** The app reads Supabase directly, not the FastAPI gateway. Pick one architecture before scaling.
- **Supabase OTP not production-configured.** Email templates, redirect URLs, rate limits need dashboard setup.
- **No admin / reviewer UI.** There is no way to enter, diff, or approve clinical content through the app — must be done via SQL today.
- **CI is minimal.** No frontend/Docker/Expo builds, no deploy pipeline, no migration runner.
- **No legal / clinical / security sign-off recorded.** Required before any patient-facing use.
- **Hardcoded Supabase project hostname check** in mobile diagnostics — would fail on project migration.

## 12. Working Norms

- **Never hardcode clinical recommendations** in Python or TypeScript. Clinical pathways belong in [rules/hinduja_protocols.json](rules/hinduja_protocols.json) (risk-stratified protocols) or the Supabase tables (drug/dose metadata). The Python rule evaluator ([shared/clinical/rules.py](shared/clinical/rules.py)) is intentionally data-driven — keep it that way.
- **Never bypass `review_status`.** Don't add code paths that read non-approved rows for doctors. Don't disable RLS.
- **Preserve fail-closed behavior.** If you change the evaluator or the mobppear in `mobile/`.
- **Existing audit docs in [docs/](docs/) are historical snapshots** — don't edit them. New audit findings go in [docs/PROJECT_AUDIT_2026-05.md](docs/PROJECT_AUDIT_2026-05.md) or a newly-dated file.
