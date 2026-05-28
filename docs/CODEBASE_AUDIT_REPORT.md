# Hinduja Antibiotic Guide — Codebase Audit Ledger

Last revised: 2026-05-28 (post conformance-fixes PR #2).

This document is the single, authoritative audit ledger. It supersedes the
earlier `PRODUCTION_AUDIT.md` and `PROJECT_AUDIT_2026-05.md` (now deleted),
plus all interim Codex-generated audit snapshots.

## How to read this ledger

- **Resolved** — closed by code change. Each entry names the commit that closed it.
- **Open** — known follow-up work, scoped but not yet done.
- **Deferred** — explicitly out of scope for this iteration.

## Resolved

| Finding | Closed by |
|---|---|
| Working dir was 2 commits ahead / 33 behind `origin/main` and had unstaged reverts of the source-backed safety contract. | `d1ae210` reconciles to origin/main and ports forward the AMA-fields work that was unstaged on the Desktop checkout (20260525 AMA migration, AMA importer, e2e safety test, AntibiogramRiskCriterion/Footnote/AntimicrobialPearlPoint/Synergy/Antifungal types, gateway routes). |
| `qrcode` declared in `pyproject.toml` but not installed — broke `services/report-service` import and pytest collection of `tests/test_health_routes.py`. | `pip install -e ".[dev]"` (Phase 1). Already declared in `[project.dependencies]`; reconciliation in Phase 0 restored the canonical `pyproject.toml`. |
| `pytest-asyncio` declared but not installed — two async tests in `tests/test_clinical_jsonl_importer.py` failed to run. | `pip install -e ".[dev]"` (Phase 1). |
| `tests/test_mobile_auth_static.py` asserted Email-OTP strings; canonical mobile app uses Google OAuth. 5 test failures. | `739c5b8` replaces with `tests/test_mobile_auth_oauth_static.py` (asserts `signInWithOAuth`, `provider: "google"`, conditional `redirectTo` for web, misconfiguration messaging, no fake-success on errors). |
| Web preview blank in browser despite a clean bundle. Root cause: working dir was missing `.env` and `mobile/.env*` so `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` were absent and the Supabase client initialised on placeholder values, silently failing every auth/data request. | Copied `.env`, `.env.local`, `mobile/.env`, `mobile/.env.local` from the Desktop checkout (files are gitignored — not committed). After this the Expo web bundle compiles and `[env]` correctly logs `hasUrl: true` / `hasAnonKey: true`. To reproduce: see `mobile/.env.example`; populate values and restart Expo. |
| `services/protocol-engine` had two routes that returned 404 unconditionally (`GET /api/v1/protocols/{code}` because `recommendation_matrix={}` in `rules/hinduja_protocols.json`; `GET /api/v1/protocols/{code}/details` was hardcoded 404). They duplicated the guideline-service routes that already read approved-view data. | `cf9ddf2` deletes both routes. No mobile callers existed — mobile reads ground-truth views directly from Supabase. |
| `services/antibiogram-service` declared `ORGANISMS=[]` / `ANTIBIOTICS=[]` at module load and never populated them; `/sensitivity` and `/resistance-trends` returned safe-empty placeholders. | `cf9ddf2` rewires `/organisms`, `/antibiotics`, `/sensitivity`, `/resistance-trends` to read `approved_antibiogram_pathogen_rows_with_source` via new `GroundTruthRepository.organisms()`, `antibiotic_catalog()`, `sensitivity()`, `resistance_trends()` methods. All four endpoints fail closed (SAFE_EMPTY_MESSAGE) when no approved data exists. |
| Three overlapping audit docs (`CODEBASE_AUDIT_REPORT.md`, `PRODUCTION_AUDIT.md`, `PROJECT_AUDIT_2026-05.md`, `SUPABASE_SETUP.md`) — same gaps reported under different dates with no resolution status. | `d1ae210` deletes the three untracked overlapping snapshots; this file (Phase 5) replaces `CODEBASE_AUDIT_REPORT.md` with a resolved/open/deferred ledger. `SUPABASE_SETUP.md` deleted in favor of `SUPABASE_AUTH_PRODUCTION_CHECKLIST.md` and `SUPABASE_EMAIL_OTP.md`. |
| `synergy_and_antifungal.notes` (3 EUCAST/AMSP disclaimer strings) were silently dropped by the importer — no table, no row, no API, no render. | PR #2 adds `supabase/migrations/20260528_synergy_antifungal_notes.sql` (source-backed table + approved view) and extends `build_synergy_antifungal_rows()` in the importer. `EXPECTED_COUNTS["synergy_antifungal_notes_rows"] = 3` now validates. |
| Backend FastAPI gateway was missing endpoints for `synergy_testing`, `antifungal_susceptibility`, `pearl_points`, `synergy_antifungal_notes`, and `guide_metadata`. Mobile fetched direct from Supabase views so end-users saw data, but the gateway was inconsistent. | PR #2 adds `GroundTruthRepository.synergy_testing()`, `antifungal_susceptibility()`, `pearl_points()`, `synergy_antifungal_notes()`, `guide_metadata()` and matching `/api/v1/...` endpoints in `services/guideline-service/app/main.py` plus 5 nginx routes. |
| `metadata.source_document`, `surveillance_period`, `valid_till`, `document_index` were imported into `clinical_guide_documents` but never surfaced in the mobile UI. | PR #2 adds `loadGuideMetadata()` + `GuideDocumentMetadata` type in `mobile/src/clinicalData.ts` and an "About this guide" card in the Profile screen showing the source document, surveillance period, valid till, and the 7-section content index. |
| `antibiograms.*.section_notes` (AMSP-committee disclaimers about Ceftazidime-avibactam empiric recommendations) was stored in JSONB but believed un-rendered. | Already implemented in `main` at `mobile/src/AppRoot.tsx:6469-6478` (Antibiogram detail screen renders each entry under "Section Notes"). Verified during the audit; no code change required. |

After PR #2 the test suite is green: `61 passed, 0 failed` (`python3 -m pytest -q`), validator includes the new `synergy_antifungal_notes_rows: 3` count, and all 8 top-level JSON sections (A–H) are fully conformant across schema / importer / backend / mobile.

## Open

| Finding | Notes |
|---|---|
| `/api/v1/antibiotics` derives its catalog from `jsonb_object_keys(approved_antibiogram_pathogen_rows_with_source.sensitivities)`. This is fragile — keys come from the AMA transcription and can collide on near-duplicates (e.g. "Cefoperazone-Sulbactam" vs "Cef-Sulbactam"). Replace with a curated `public.antibiotics_catalog` table in a future migration, seeded from `docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json`. |
| `/api/v1/resistance-trends` returns a row per (pathogen × antibiotic × sheet × risk-type) — the mobile app may want a different shape (e.g. aggregated by pathogen with antibiotic columns). Confirm the mobile fetch shape in `mobile/src/AppRoot.tsx` and reshape if needed. |
| Pre-existing ruff lint surface: 83 errors across the repo (mostly B008 FastAPI `Depends()` defaults — intentional pattern — plus import-order and minor style). CI runs `ruff check .` so this currently fails on origin/main. Either fix or relax the rules in `pyproject.toml`. Out of scope for this audit. |
| Two Expo SDK version mismatch warnings on web bundle: `@react-native-async-storage/async-storage@3.0.2` (expected 2.2.0) and `expo-secure-store@55.0.14` (expected ~15.0.8). Non-blocking, but worth bumping to expected versions to silence the warning and rule out future incompatibilities. |
| `rules/hinduja_protocols.json` still exists but its `recommendation_matrix` is `{}` — it now only carries thresholds + risk-factor weights for the `/api/v1/protocols/evaluate` rule engine. Consider renaming it to clarify its reduced role, or extracting the weights into a smaller config. |

## Deferred

| Finding | Reason |
|---|---|
| Demo OTP logged in cleartext at `services/auth-service/app/main.py:51`. | The auth-service is not on the mobile path (mobile auth goes direct to Supabase). Fix before this service goes live, not as part of this audit. |
| No admin/reviewer UI for clinical content (must use SQL today). | Larger UX feature — out of scope. |
| No push notifications, no client-side audit logging, no RBAC beyond approved-view RLS. | Future work. |
| Production Supabase setup (email templates, redirect URLs, rate limits, OAuth provider config). | Operational task tracked in `docs/SUPABASE_AUTH_PRODUCTION_CHECKLIST.md`. |
| No CI step to build the Expo bundle or run a frontend typecheck (CI only runs Python lint + tests). | Future work — add `mobile && npx tsc --noEmit` to the workflow. |
| Stray zero-byte `20260516_source_clinical_ingestion.sql` and `Hinduja` files at the Desktop checkout's repo root. | Cosmetic; the working-dir tree (canonical) does not have them. |

## Verification

Last verified 2026-05-28 on the conformance-fixes-2026-05-28 branch.

```text
python3 -m pytest -q                                       61 passed, 0 failed
python3 -m ruff check .                                    All checks passed!
cd mobile && npx tsc --noEmit                              no errors
cd mobile && npx expo export --platform web                ~781 kB bundle, dist/ produced
python3 scripts/import_ground_truth_json_to_supabase.py validate   PASS (25 + 22 + 16 sheets + 2 synergy + 3 synergy_antifungal_notes + 11 + 4)
```

The full Supabase production import (`import-all --approve`) is pending live DB
credentials. Canonical commands + expected approved-view counts are documented
in the deploy plan and in the importer's `--help`.
