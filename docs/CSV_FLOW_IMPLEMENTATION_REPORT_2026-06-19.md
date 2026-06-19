# Hinduja CSV Flow Remediation — Implementation Report

Implementation date: 2026-06-19  
Approved plan: `docs/CSV_FLOW_REMEDIATION_PLAN_2026-06-19.md`

## Outcome

The repository now has one source-pinned, exact-key, fail-closed clinical flow:

```text
21 immutable CSV files + SHA-256 manifest
  -> six schema-aware adapters
  -> pending correction/source-asset governance
  -> versioned dataset release
  -> source-linked specialized tables
  -> active + non-expired exact views
  -> exact mobile key lookup
  -> found | no_source_therapy | expired | data_error
```

The bundled 2025 guide is intentionally **not activatable**. Its validity ended on 2025-12-31, five semantic/source adjudications remain unsigned, and five required non-CSV source assets remain missing. The implementation treats those as safety blockers rather than manufacturing approvals.

## Implemented components

- `docs/ground_truth/hinduja_csv_manifest.json`: all 21 file hashes, byte sizes, adapters, count contracts, and canonical record hash.
- `scripts/hinduja_csv/`: deterministic adapters for risk, ICMR, local therapy, perioperative, stewardship pearls, and AMA pearls.
- `docs/ground_truth/corrections.reviewed.json`: correction/adjudication and missing-source ledger.
- `scripts/hinduja_csv_bundle.py`: source validation, release validation, and pending candidate generation.
- `scripts/import_hinduja_csv_bundle_to_supabase.py`: pending-only, idempotent, actual-CSV provenance importer.
- `supabase/migrations/20260619_versioned_csv_release_flow.sql`: releases, source inventory, corrections, exact therapy slots, risk criteria, expiry-gated RLS, exact views, activation guard, and maintenance rollback.
- `mobile/src/protocolScenario.ts`: four-dimension exact selector and typed failure states.
- `mobile/src/antibiogramRisk.ts`: null defaults, complete-input requirement, exact source criteria, and invalid-value rejection.
- Mobile result/details/actions: stale-result invalidation and save/export/share gating on `status='found'`.
- Legacy weighted API, transformed-JSON writer, and hard-coded transcription writer: retired from supported write/treatment paths.

## Finding implementation ledger

| Finding | Implemented result | Automated/adversarial evidence |
|---|---|---|
| C-01 | All 21 files select one typed adapter; generic ambiguous CSV ingestion rejects them explicitly | Bundle coverage, per-file schema/count tests, malformed/hash mutation tests |
| C-02 | Risk-typed Protocol Result reads `approved_current_protocol_scenarios_with_source` | Exact selector/static contract and migration rehearsal |
| C-03 | Four closed enums and four strict `.eq(...)` filters; no token matching in treatment selection | Exact-pair and 48×47 cross-scenario checks |
| C-04 | Progressive and infection-level treatment fallbacks removed | Source scan and missing-exact-scenario typed error |
| C-05 | Local sheets have explicit codes; all 25 ICMR source rows remain `unmapped` pending review and route to guideline detail | Candidate mapping test and non-risk route contract |
| C-06 | Weighted evaluate/result endpoints return HTTP 410; rule file is a retirement marker | Protocol-engine tests |
| C-07 | CSV bytes are source files; row/column locators and source-value hashes replace generated JSON/page provenance | Hash/locator recomputation tests and imported source spans |
| H-01 | Candidate uses the CSV Diabetic Foot comment | Critical source-value test |
| H-02 | RTI Wards HA Type 3 retains Piperacillin/Tazobactam | Critical source-value test |
| H-03 | 40+24 pearls retain 9+5 real sections; zero bullet sections | Section/continuation tests |
| H-04 | 48 slots produce 40 therapy rows and eight null source slots | Parser, importer, view, and DB placeholder constraint tests |
| H-05 | CSV 06 acquisition conflict emits a release-blocking flag and pending correction | Release validation and activation rejection |
| H-06 | CSV 17 AMSP note is imported once; external footnotes are not attributed to the CSV | Source-value and 12-note tests |
| H-07 | Raw seven-column ICMR rows are preserved; three semantic transformations are pending adjudications | Correction-ledger and source hash tests |
| H-08 | `bolus_duration` and `infusion_duration` are separate; Vancomycin retains “initial dose” | Candidate snapshot, migration, and mobile display changes |
| H-09 | Risk starts null, requires all three exact answers, loads current source criteria, and matches Python behavior | Python and executable TypeScript adversarial tests |
| H-10 | All approved section reads are active-release and date gated; current protocol/risk views are empty for expired data | RLS migration and PostgreSQL rehearsal |
| M-01 | Active validation checks hashes, schemas, field/record hash, counts, provenance, corrections, assets, and expiry | Count-preserving mutations fail after per-file hash rewrites |
| M-02 | Tests read and parameterize all 21 CSV files | 21-file meta-test and 106-test suite |
| M-03 | `Hindujacsv/` is the manifest-owned repository source root | Clean relative paths and no developer-local source dependency |
| M-04 | Missing metadata/pathogen/synergy/antifungal/external-footnote assets are explicit activation blockers | Source inventory table and activation guard |
| M-05 | README, API flow, architecture, ingestion, and seed docs describe direct Supabase and local actions | Documentation contract test |
| M-06 | Protocol loader distinguishes permission, network, schema, malformed, missing, unavailable, expired, and legitimate blank states | Executable TypeScript error-state tests and static selector contract |
| M-07 | Details/actions/save/export/share require a current `found` result; scenario changes invalidate prior result | UI contract test and synchronous exact-key recheck |

## Source reconciliation

```text
files                         21
typed source records          195
risk criteria                   4
ICMR source rows               25
non-empty raw duration cells   20
local sheets                   16
therapy source slots           48
non-empty therapy rows         40
blank therapy slots             8
local source notes             12
perioperative rows        11 + 4 + 11
pearls                    40 + 24
source sections             9 + 5
```

Canonical record SHA-256:

```text
5d9c9a200519d7fe8f4aef3b47b115c63f4ed8e1228b8799a02261c16b4d20eb
```

## Adversarial verification

- Content, acquisition, ICMR comment/role-adjacent content, and pearl-section mutations were made while preserving record counts and updating the mutated file's manifest hash. The canonical-record gate rejected each mutation.
- All 2,256 unequal scenario-key comparisons remained unequal.
- Partial Type 2, partial Type 3, unknown, and incomplete risk inputs failed closed in Python and TypeScript.
- PostgreSQL 16 rehearsal applied every migration in order. It found and prompted repair of the pre-existing `20260525` view-column-order migration defect.
- Pending import succeeded twice, proving idempotency.
- Rehearsal database counts were 16 sheets, 48 slots, 40 therapies, and eight null slots.
- Current protocol and risk views returned zero rows for the expired/pending candidate.
- Attempts to activate the expired release and a future-dated but unresolved release were both rejected.
- An attempted `(Not enough data)` therapy update was rejected by the database constraint.

Final local gates:

```text
pytest -q                                      106 passed
python3 scripts/hinduja_csv_bundle.py validate PASS
CSV pending importer dry-run                   PASS
npm run test:clinical                          PASS
TypeScript noEmit                              PASS
ruff check .                                   PASS
git diff --check                               PASS
```

## Required external completion before activation

1. Obtain and hash a current, institutionally revalidated guide with a valid future/current `valid_through` date.
2. Have a named clinician resolve and sign the five pending adjudications, especially CSV 06 acquisition and the ICMR role/label questions.
3. Register and verify the missing non-CSV source assets.
4. Review and approve every candidate row/source asset in the target Supabase environment.
5. Commit the currently untracked `Hindujacsv/` source folder and new implementation files so a clean clone can reproduce the bundle.
6. Rehearse and apply the migration/import in staging, run shadow comparison, obtain clinical release sign-off, then activate the release.

No live Supabase database was changed by this implementation session.
