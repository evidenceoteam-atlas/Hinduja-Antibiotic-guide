# Hinduja Antibiotic Guide — CSV and Flow Remediation Plan

Plan date: 2026-06-19  
Source audit: `docs/CSV_FLOW_COMPREHENSIVE_AUDIT_2026-06-19.md`  
Scope: all findings C-01–C-07, H-01–H-10, and M-01–M-07, plus all 21 CSV files.

## Outcome

The finished system will have one source-controlled, reviewable data lineage and one exact clinical-selection path:

```text
immutable source bundle + SHA-256 manifest
  -> typed CSV adapters (raw/source-preserving)
  -> reviewed corrections/adjudication ledger
  -> versioned dataset release (pending -> approved -> active/expired)
  -> source-linked specialized tables
  -> approved_current_protocol_scenarios_with_source
  -> exact mobile query: infection + location + acquisition + risk
  -> found | no_source_therapy | expired | data_error
```

The plan deliberately does not create another recommendation store. The existing specialized antibiogram tables remain the canonical home for local empiric therapy. `clinical_recommendations` and the weighted rule matrix are removed from the active local-antibiogram flow.

## Architecture decisions

### A-01 — Current mobile architecture remains direct Supabase

The mobile app already reads approved Supabase views directly. The remediation will document and test that architecture instead of pretending the mobile client calls the FastAPI workflow. The legacy `/protocols/evaluate` route will be disabled/removed from the supported flow until it can delegate to the same exact database selector.

### A-02 — Exact keys are mandatory for treatment selection

The canonical key is:

```text
(dataset_release_id, infection_type, location, acquisition, risk_type)
```

Allowed values are closed enums:

- `infection_type`: `BSI | UTI | RTI | IAI`
- `location`: `ICU | wards`
- `acquisition`: `community_acquired | hospital_acquired`
- `risk_type`: `1 | 2 | 3`

Fuzzy text matching remains permitted only for user search. It cannot select, rank, or fall back to clinical treatment content.

### A-03 — CSV values remain source values; corrections are separate records

Raw source text, normalized display text, and reviewer-approved corrections must be distinguishable. No normalization may silently change treatment role, drug options, qualifiers, section ownership, acquisition, or source page.

### A-04 — A dataset release controls validity

Every doctor-facing row belongs to a `clinical_dataset_release`. Approved views expose only the single active, non-expired release. A release cannot become active without source hashes, completed adjudications, reviewer identity, review timestamp, and the full verification gate.

### A-05 — Blank source therapy remains absent

The eight blank Type 1 cells remain null/absent. They do not create `antibiogram_empiric_therapy` records. The exact selector returns `no_source_therapy`; the UI renders the institutional fallback message.

## Safety constraints

- No automatic clinical approval during migration.
- No production write is part of this plan document.
- No destructive table removal until the new path has passed shadow comparison and one release rollback window.
- No expired release may be returned by an approved/current view.
- No treatment result may be produced from search aliases, substring matching, token overlap, or an infection-only fallback.
- Any unresolved source contradiction remains `pending_review` and unavailable to the doctor-facing app.

## Delivery phases and gates

| Phase | Deliverable | Findings addressed | Exit gate |
|---|---|---|---|
| 0 | Clinical safety freeze and architecture record | C-06, H-10, M-05, M-07 | Expired/legacy paths cannot produce or share a protocol |
| 1 | Immutable source package and typed parsers | C-01, C-07, M-03, M-04 | All 21 files parse to expected typed records with verified hashes |
| 2 | Clinical adjudication and regenerated canonical dataset | H-01–H-08 | Every non-literal change has a signed correction record; zero unresolved rows in active candidate |
| 3 | Versioned schema, true provenance, exact scenario view | C-02, C-07, H-04, H-10 | Additive migration passes; current view returns only active, non-expired exact rows |
| 4 | Exact risk and scenario selection | C-03–C-06, H-09 | Full scenario isolation and risk truth tables pass in Python and TypeScript |
| 5 | Mobile flow, errors, and action gating | C-02–C-05, M-06, M-07 | UI distinguishes no-data/error/expired and cannot continue on non-success |
| 6 | Validators, tests, docs, and source governance | M-01–M-05 | Mutation/adversarial suite fails on every seeded regression and all docs match runtime |
| 7 | Shadow deployment and controlled cutover | All | Clinician sign-off, migration rehearsal, rollback proof, and production checklist complete |

## Work packages

### WP-01 — Source package and manifest

Planned files:

- `[NEW] docs/ground_truth/hinduja_csv_manifest.json`
- `[NEW] docs/ground_truth/corrections.reviewed.json`
- `[NEW] scripts/hinduja_csv/` typed parser package
- `[NEW] tests/fixtures/hinduja_csv/expected_source_records.json`

Tasks:

1. Move or copy the 21 reviewed CSVs into an approved immutable source location, subject to institutional source/licensing policy.
2. Record filename, byte size, SHA-256, adapter type, expected logical counts, guide version, and source owner.
3. Make unknown, missing, duplicate, or hash-mismatched files a hard validation error.
4. Record non-CSV source assets separately for metadata, pathogen/sensitivity tables, synergy, and antifungal records.
5. Preserve original bytes; never rewrite source files in place.

### WP-02 — Six schema-aware CSV adapters

Adapters and raw acceptance counts:

| Adapter | Files | Raw typed output |
|---|---|---|
| Risk stratification | 01 | 4 criterion records (`Definition` + 3 patient criteria), each with Type 1/2/3 values |
| ICMR | 02 | 25 source rows; 20 non-empty raw duration cells; all seven source columns preserved |
| Local therapy | 03–18 | 16 sheets, 48 risk slots, 40 non-empty therapy cells, 8 null cells, 12 non-empty notes |
| Perioperative | 19 | 11 procedures, 4 dosing rows, 4 procedure notes, 7 general notes |
| Stewardship pearls | 20 | 40 pearls in 9 sections |
| AMA pearls | 21 | 24 pearls in 5 sections |

Each record includes `source_filename`, `source_file_sha256`, logical row/section/column locator, exact source text, and parsed canonical keys. Continuation lines are merged only when the adapter’s deterministic grammar proves they belong to the preceding cell/bullet.

### WP-03 — Clinical adjudication ledger

Each correction record contains:

```text
correction_id
source_file_sha256
source_locator
field
source_value
proposed_value
reason
classification: formatting | source_export_error | clinical_change
review_status
reviewer_id
reviewed_at
```

Formatting-only changes may be batch reviewed. Acquisition, recommendation role, drug options, dose qualifiers, duration, warnings, and section moves require explicit clinical review. The dataset generator refuses to produce an active candidate while any required adjudication is unresolved.

### WP-04 — Versioned database release and exact view

Planned additive migration:

- `[NEW] clinical_dataset_releases`
- `[NEW] patient_risk_criteria`
- `dataset_release_id` foreign keys on source-backed section tables
- `source_locator jsonb` and `source_value_sha256` on source spans
- uniqueness on `(dataset_release_id, infection_type, location, acquisition)` for sheets
- uniqueness on `(dataset_release_id, sheet_key, risk_type)` for non-empty therapy rows
- `[NEW] approved_current_protocol_scenarios_with_source` exact view
- `[NEW] approved_current_patient_risk_criteria_with_source` exact view
- `[NEW] approved_dataset_release_status` non-treatment metadata view

The protocol view expands every approved sheet across the three canonical risk types and left-joins non-empty therapy rows. It therefore returns exactly 48 slots for a complete active release: 40 with `availability_status='available'` and source therapy text, and 8 with `availability_status='no_source_therapy'` and null therapy text. No fake therapy record is created for a blank source cell. The view includes source hash/locator and filters `review_status='approved'`, release `status='active'`, and `valid_through >= current_date`. The release-status view lets the client distinguish an expired release from a malformed/missing data deployment without exposing treatment rows.

### WP-05 — Exact mobile selector

Planned code:

- `[NEW] mobile/src/protocolScenario.ts`
- update `mobile/src/clinicalData.ts`
- simplify `mobile/src/AppRoot.tsx`
- refactor `mobile/src/antibiogramRisk.ts`

`loadProtocolScenario(key)` returns a discriminated result:

```text
{status: "found", row, source}
{status: "no_source_therapy"}
{status: "expired", release}
{status: "data_error", code, message}
```

Only `found` enables protocol details, save, export, or share. Non-risk ICMR conditions route to the ICMR guideline detail screen unless a separately reviewed exact scenario mapping exists.

## Responsibility gates

| Role | Required approval/accountability |
|---|---|
| Clinical owner | Guide revalidation, validity dates, all semantic corrections, acquisition conflicts, role/drug/dose changes, release activation |
| Data engineering | Source manifest, deterministic adapters, generated artifacts, lineage validation |
| Database owner | Additive migration, RLS/current views, uniqueness, staging rehearsal, rollback pointer |
| Mobile owner | Exact selector, typed states, stale-result invalidation, action gating |
| Backend owner | Legacy endpoint deprecation/removal and gateway/documentation alignment |
| QA/safety reviewer | Golden fixtures, mutation suite, 48-slot matrix, negative cross-scenario checks |
| Release manager | Clean-clone proof, environment backup, shadow comparison, approval evidence, cutover/rollback execution |

### WP-06 — Test and mutation suite

Planned tests:

- `[NEW] tests/test_hinduja_csv_bundle.py`
- `[NEW] tests/test_source_fidelity.py`
- `[NEW] tests/test_protocol_scenario_matrix.py`
- update `tests/test_ground_truth_importer_validation.py`
- update `tests/test_end_to_end_safety_verification.py`
- update `tests/test_antibiogram_risk_classifier.py`
- `[NEW] mobile/src/protocolScenario.test.ts`
- `[NEW] mobile/src/antibiogramRisk.test.ts`

The CI gate runs parser snapshots, source fidelity, all 48 scenario slots, 2,256 cross-scenario negative comparisons (48 × 47), risk truth tables, expiry, RLS/view checks, TypeScript tests/typecheck, Python tests, and generated-artifact cleanliness.

## Issue-by-issue remediation

### C-01 — Broken ingestion for all 21 CSVs

- Change: route the Hinduja bundle through WP-02 adapters; keep `clinical_ingest.py` for genuinely headered generic inputs and make it reject unsupported/ambiguous CSVs instead of returning zero success.
- Existing targets: `scripts/clinical_ingest.py`, `docs/SOURCE_INGESTION.md`, `tests/test_clinical_ingest.py`.
- Acceptance: each of the 21 files selects exactly one adapter and meets its source-count contract; malformed/unknown layouts exit non-zero.
- Adversarial test: prepend/remove blank rows, duplicate headers, truncate multiline quotes, rename a scenario file, and change a hash; each mutation must fail or produce an explicit review error—never zero-success.
- Dependency: WP-01 manifest before parser output can be approved.

### C-02 — Protocol Result disconnected from local therapy

- Change: replace `approved_clinical_recommendations_with_source` in the risk-typed Protocol Result path with `approved_current_protocol_scenarios_with_source` and exact key lookup.
- Existing targets: `mobile/src/AppRoot.tsx`, `mobile/src/clinicalData.ts`, `scripts/import_transcribed_ama_table_to_supabase.py`.
- Acceptance: all 40 non-empty CSV therapy slots return their exact source treatment; all 8 blank slots return `no_source_therapy`; `ama_role` slicing is removed from this flow.
- Adversarial test: populate conflicting rows in `clinical_recommendations`; Protocol Result must ignore them. Swap one scenario dimension and verify zero therapy.
- Rollback: feature flag can switch to fail-closed only; it must not restore fuzzy recommendations.

### C-03 — Acquisition and risk false matches

- Change: remove `fieldMatches` from clinical selection. Use enum normalization at ingestion and strict equality at query time.
- Existing targets: `mobile/src/AppRoot.tsx:2611-2624`, new `protocolScenario.ts`.
- Acceptance: Community never equals Hospital; Type 1 never equals Type 2/3; case/display punctuation is absent from stored keys.
- Adversarial test: test every unequal pair in the acquisition and risk domains, including strings sharing `acquired`, `type`, or `risk`.
- Dependency: A-02 canonical enums.

### C-04 — Progressive fallback returns incompatible rows

- Change: delete `applyProgressiveFilter` and infection-level fallback from treatment selection. Return a typed no-match state.
- Existing targets: `mobile/src/AppRoot.tsx:2761-2795, 3635-3657`.
- Acceptance: zero exact matches always yields `no_source_therapy`; no lower-specificity fallback exists.
- Adversarial test: remove the selected exact row while leaving near matches for the same infection; the UI must show fallback guidance, not a protocol.
- Rollback: fail closed.

### C-05 — Cross-system infection misclassification

- Change: assign infection codes in typed adapters/reviewer ledger; canonical records never infer categories at runtime. Retain fuzzy aliases only in search navigation.
- Existing targets: `mobile/src/AppRoot.tsx:1562-1701`.
- Acceptance: all 25 ICMR conditions and 16 antibiogram sheets have explicit reviewed codes or `unmapped`; treatment queries require a code.
- Adversarial test: Urosepsis, intra-abdominal sepsis, brain/liver/perinephric abscess, and enteric fever resolve only to their reviewed mapping; adding a shared word cannot change it.
- Dependency: WP-02 and WP-03.

### C-06 — Contradictory weighted API and empty matrix

- Change: remove the weighted evaluator from the supported runtime path, remove/disable `/protocols/evaluate` and dummy result retrieval, and delete stale API documentation. If an API is retained later, it must query the exact current view and use the same reviewed risk criteria.
- Existing targets: `shared/clinical/rules.py`, `rules/hinduja_protocols.json`, `services/protocol-engine/app/main.py`, `README.md`, `docs/API_FLOW.md`, gateway config, protocol tests.
- Acceptance: no deployed endpoint reports successful protocol generation with zero therapy; setting/acquisition do not alter patient risk class.
- Adversarial test: the three audit counterexamples must classify exactly per CSV 01 or return service-disabled—not legacy scores.
- Dependency: A-01 architecture record.

### C-07 — Synthetic provenance and manufactured pages

- Change: source files are the actual CSV/PDF/image bytes; source quote is exact source text; locator is row/section/column; page is null unless backed by an approved PDF crosswalk. Generated JSON is an artifact, not a source.
- Existing targets: `scripts/import_ground_truth_json_to_supabase.py`, source tables/views, mobile source metadata cards.
- Acceptance: every doctor-facing row verifies against source SHA and locator; recomputing the source-value hash succeeds; no section-start page is copied to all rows.
- Adversarial test: alter one source byte, source quote, locator, or page mapping; validation and activation must fail.
- Dependency: WP-01, WP-03, WP-04.

### H-01 — Wrong Diabetic Foot comment

- Change: create an adjudication record comparing CSV 02, current JSON, and any original guide image; clinician selects the approved value. Regenerate, never hand-edit, the canonical artifact.
- Targets: CSV 02 adapter, corrections ledger, reviewed JSON generator, ICMR tests.
- Acceptance: approved comment equals the signed adjudication and retains source trace.
- Adversarial test: reinsert the CAP comment; source-fidelity snapshot must fail.

### H-02 — Missing RTI Wards HA Type 3 option

- Change: adjudicate and restore `Piperacillin/Tazobactam` if confirmed by the institutional source.
- Targets: CSV 14 adapter, corrections ledger, scenario fixture.
- Acceptance: the Type 3 value matches the approved source exactly.
- Adversarial test: delete or reorder an option in a clinically meaningful way; field hash/snapshot fails.

### H-03 — All pearl sections collapsed

- Change: parse section headings and continuation lines in adapters 20/21; persist explicit section codes and display labels. Meningitis ownership requires a signed adjudication because it is physically in CSV 20 but currently stored under pearl points.
- Targets: CSV pearl adapters, `build_pearl_rows`, pearl tables, mobile grouping.
- Acceptance: 40+24 pearls, 14 source sections, zero `section_name='•'`, and every pearl has one source section.
- Adversarial test: move a pearl across sections, use the bullet as a heading, or orphan a continuation line; validation fails.

### H-04 — Blank Type 1 cells became approved text

- Change: typed parser emits null slot values; importer skips therapy creation for nulls; UI uses `no_source_therapy`.
- Targets: antibiogram adapter, `build_antibiogram_sheet_child_rows`, database constraints/view, mobile empty state.
- Acceptance: 48 source slots, 40 therapy records, 8 absent therapies, zero `(Not enough data)` therapy values.
- Adversarial test: convert any blank to placeholder text; validator rejects it.

### H-05 — CSV 06 acquisition contradiction

- Change: block the row in adjudication until filename, internal title, and original institutional source are reconciled. Store the resolution and reviewer.
- Targets: local therapy adapter and corrections ledger.
- Acceptance: no active BSI Wards HA sheet exists without a resolved acquisition correction record.
- Adversarial test: remove the correction record or change either source label; release activation fails.

### H-06 — CSV 17 note omitted / external notes mixed in

- Change: preserve the CSV 17 AMSP note. Link Tigecycline/Colistin footnotes to their actual non-CSV source asset or quarantine them from the release.
- Targets: IAI Wards CA adapter, footnote import, source manifest.
- Acceptance: CSV note appears once with CSV provenance; each additional footnote has distinct valid source provenance.
- Adversarial test: attribute external text to CSV 17 or omit its note; lineage validation fails.

### H-07 — Undocumented CSV 02 transformations

- Change: create separate adjudications for Early→Late onset, Lung Abscess→Susceptible Host, PVE empirical→alternate role, and Diabetic Foot comment. Preserve raw row values beside approved values.
- Targets: ICMR adapter, corrections ledger, generator.
- Acceptance: every semantic transformation has one approved correction ID embedded in generated row metadata.
- Adversarial test: modify a semantic field without adding/updating a correction; generation fails.

### H-08 — Perioperative qualifier and column loss

- Change: preserve `15 mg/kg initial dose`; add separate `bolus_duration` and `infusion_duration` columns while retaining a compatibility display field during migration.
- Targets: perioperative adapter, new migration, importer, `PerioperativeAntibioticDosing`, UI card.
- Acceptance: all four dosing rows round-trip each source column; Vancomycin qualifier remains exact.
- Adversarial test: merge durations ambiguously or remove `initial dose`; snapshot fails.

### H-09 — Unsafe default and partial risk classification

- Change: initialize all answers as null; load options from `approved_current_patient_risk_criteria_with_source`; require all three explicit answers before classification; use Type 3 > Type 2 > all-Type-1 precedence only after completeness.
- Targets: `mobile/src/antibiogramRisk.ts`, `shared/clinical/antibiogram_risk.py`, `AppRoot.tsx`, risk tests.
- Acceptance: no default class; any missing answer returns manual review; Python and TypeScript truth tables are identical.
- Adversarial test: one Type 2 + two missing, one Type 3 + missing, unknown strings, mixed release criteria, and whitespace variants all fail closed unless complete and exact.

### H-10 — Expired guide remains active

- Change: migrate `valid_till` text to `valid_through date`, link all rows to a release, filter current views by date/status, and block actions when release is expired.
- Targets: dataset release migration, import CLI, approved views, mobile loader/action gate, profile display.
- Acceptance: a release expiring yesterday yields zero doctor-facing protocols; activation requires a future/current validity date and clinician sign-off.
- Adversarial test: change system date across the validity boundary and attempt direct view/API/mobile access.

### M-01 — Count-only validator

- Change: replace count-only success with manifest, schema, field fidelity, provenance, correction, uniqueness, expiry, and scenario-coverage validation.
- Targets: `validate_ground_truth_payload`, new bundle validator, verification SQL.
- Acceptance: all audit mutations fail validation before import/approval.
- Adversarial test: preserve counts while swapping rows, sections, roles, options, source hashes, or scenario keys; each must fail.

### M-02 — Tests ignore CSV sources

- Change: add all 21 sources/approved fixtures to tests and make CI run the bundle validator, parser snapshots, scenario matrix, and mobile tests.
- Targets: `tests/`, mobile test config, CI workflow.
- Acceptance: every CSV hash and filename is asserted; coverage report lists 21/21.
- Adversarial test: remove one test parameter/file; meta-test fails the suite for incomplete coverage.

### M-03 — CSV folder untracked

- Change: place source bytes in approved version control or immutable governed storage; commit manifest and retrieval verification. Remove dependence on a developer-local untracked folder.
- Targets: repository/source policy, `.gitignore` if needed, deployment docs.
- Acceptance: a clean clone can reproduce hashes and generated artifacts without `/Users/...` paths.
- Adversarial test: run from a clean temporary clone with no local Downloads or untracked files.

### M-04 — Reviewed rows lack a corresponding CSV source

- Change: inventory and register the actual PDF/images/tables for metadata, pathogen/sensitivity, synergy, antifungal, and added footnotes. Rows without source assets remain pending/quarantined.
- Targets: source manifest, importer, release validator.
- Acceptance: every active row has a source asset and locator; “unverifiable” row count is zero for an active release.
- Adversarial test: delete one non-CSV source asset or use the reviewed JSON as its source; activation fails.

### M-05 — Documentation/runtime mismatch

- Change: write an ADR for direct Supabase reads, update README/API flow/deployment docs, remove unsupported endpoint sequence, and document local save/export/share behavior accurately.
- Targets: `README.md`, `docs/API_FLOW.md`, `docs/ARCHITECTURE.md`, `docs/SOURCE_INGESTION.md`, existing audit ledger.
- Acceptance: static tests verify documented endpoints exist and mobile callers match the declared architecture.
- Adversarial test: add a nonexistent endpoint or claim persistence where only state exists; documentation contract test fails.

### M-06 — Data errors are indistinguishable from empty data

- Change: data loaders return typed status/error objects and log structured diagnostic codes without exposing secrets. UI messages distinguish no approved row, expired release, permission failure, network failure, and schema failure.
- Targets: `mobile/src/clinicalData.ts`, AppRoot loading states, observability docs.
- Acceptance: each failure class has distinct telemetry and user-safe text.
- Adversarial test: mock PostgREST 401/403/404/500, timeout, malformed row, and legitimate empty result.

### M-07 — Empty results can continue to actions

- Change: render details/actions only for `status='found'`; disable navigation and clear stale selected results whenever scenario dimensions change.
- Targets: `AppRoot.tsx` ProtocolResult/Details/Actions, saved-case functions.
- Acceptance: no_source/expired/error cannot reach save/export/share; changing a dimension invalidates the prior result.
- Adversarial test: obtain a valid result, change acquisition to a blank slot, then attempt back navigation, deep link, save, export, and share.

## Per-CSV implementation map

| CSV | Adapter | Planned disposition | Release-blocking check |
|---|---|---|---|
| 01 | risk | Populate single canonical risk table | Exact 4×3 matrix; no weighted/context scoring |
| 02 | ICMR | Preserve 25 raw rows; derive reviewed ICMR/duration records through corrections | Four semantic adjudications complete; wrong Diabetic Foot comment absent |
| 03 | local therapy | BSI.ICU.community | 3 non-empty therapies + note exact |
| 04 | local therapy | BSI.ICU.hospital | Type 1 null; Type 2/3 + note exact |
| 05 | local therapy | BSI.wards.community | 3 therapies exact; external footnote separately sourced |
| 06 | local therapy | BSI.wards acquisition pending adjudication | Filename/title conflict resolved and signed |
| 07 | local therapy | UTI.ICU.community | 3 therapies + note exact |
| 08 | local therapy | UTI.ICU.hospital | Type 1 null; Type 2/3 + note exact |
| 09 | local therapy | UTI.wards.community | 3 therapies + note exact |
| 10 | local therapy | UTI.wards.hospital | Type 1 null; Type 2/3 + note exact |
| 11 | local therapy | RTI.ICU.community | 3 combination therapies + note exact |
| 12 | local therapy | RTI.ICU.hospital | Type 1 null; Type 2/3 + note exact |
| 13 | local therapy | RTI.wards.community | 3 therapies; empty note remains absent |
| 14 | local therapy | RTI.wards.hospital | Type 1 null; Type 3 option set adjudicated/restored |
| 15 | local therapy | IAI.ICU.community | 3 therapies + note exact; extra notes separately sourced |
| 16 | local therapy | IAI.ICU.hospital | Type 1 null; Type 2/3 + note exact |
| 17 | local therapy | IAI.wards.community | 3 therapies + AMSP note exact; external footnotes separately sourced |
| 18 | local therapy | IAI.wards.hospital | Type 1 null; Type 2/3 exact |
| 19 | perioperative | Preserve 11+4+11 rows and separate duration columns | Vancomycin qualifier and all note groups exact |
| 20 | stewardship pearls | 40 pearls / 9 sections | Zero bullet sections; Meningitis disposition signed |
| 21 | AMA pearls | 24 pearls / 5 sections | First heading retained as section, not header |

## Migration and cutover strategy

1. **Baseline:** export approved-view counts and row hashes from the target environment; no changes to review status.
2. **Additive migration:** create release/provenance tables, new columns, constraints, and new views without changing old views.
3. **Candidate import:** import the regenerated release as `pending_review`; verify exact source lineage and counts.
4. **Clinical review:** resolve correction ledger and approve candidate rows/release with named reviewer.
5. **Shadow read:** mobile/test harness queries old and new paths, but only new exact results are evaluated for release; all mismatches are reviewed.
6. **Feature cutover:** enable exact selector for an internal cohort, then all users after acceptance.
7. **Rollback proof:** toggle to fail-closed maintenance state and restore the prior active release pointer. Never roll back to fuzzy selection.
8. **Retirement:** after one stable release window, remove hard-coded transcription use, legacy weighted endpoint/config, and obsolete clinical-recommendation UI code.

## Definition of done

- All 24 audit findings have implemented remediation, automated evidence, and reviewer sign-off where clinical content changes.
- All 21 CSV files are hash-pinned and parsed by exactly one adapter.
- Source counts match WP-02, including 40 non-empty therapies and 8 absent therapy cells.
- The active scenario view has no duplicate exact keys and no expired rows.
- Every active row verifies to source bytes and a locator; generated JSON is never the source asset.
- All 48 positive/empty scenario slots and all 2,256 cross-scenario negative checks pass.
- Risk classification has no defaults, requires complete exact input, and is identical in Python and TypeScript.
- The mobile app cannot display, save, export, or share a protocol for no-source, expired, or data-error states.
- Mutation tests prove the suite detects each known audit defect even when record counts remain unchanged.
- A clean clone and staging migration rehearsal reproduce the release without local untracked files.

## Plan-level adversarial audit protocol

The plan itself must pass these checks before implementation begins:

1. **Finding coverage:** extract all C/H/M IDs from the source audit and assert each appears as an individual remediation heading exactly once.
2. **CSV coverage:** assert all 21 filenames/numbers are represented in the per-CSV map and exactly one adapter owns each.
3. **Codebase grounding:** verify every unmarked existing target path exists; planned paths are explicitly marked `[NEW]`.
4. **Dependency safety:** source manifest precedes parsing approval; parsing precedes adjudication; adjudication precedes active import; schema precedes selector; selector precedes UI cutover.
5. **No unsafe rollback:** search the plan for any rollback to fuzzy, weighted, expired, or unreviewed recommendations.
6. **Measurable acceptance:** every issue section contains Change, Acceptance, and Adversarial test statements.
7. **False-green resistance:** ensure mutations preserve counts while altering content, key, role, section, provenance, expiry, and error state.
8. **Clinical authority boundary:** every source contradiction or semantic treatment change requires named clinician review; no engineering-only resolution is permitted.

## Plan-audit execution record

Status: **PASS after adversarial revision**.

| Plan check | Result |
|---|---|
| Audit finding traceability | PASS — 24/24 IDs present exactly once |
| Per-issue test contract | PASS — 24/24 include Change, Acceptance, and Adversarial test |
| CSV implementation map | PASS — 21/21 files represented in order, one adapter each |
| Source-count assumptions | PASS — 25 ICMR rows/20 raw duration cells; 40 non-empty + 8 blank therapy slots; 12 therapy notes; 11+4+11 perioperative rows; 40+24 pearls |
| Existing code targets | PASS — 19 key existing paths verified on disk |
| New-view collision | PASS — authoritative current scenario view does not already exist |
| Dependency graph | PASS — phases 0→7 are acyclic and source/review/schema dependencies precede cutover |
| Unsafe rollback scan | PASS — rollback is fail-closed or prior active release only, never fuzzy/weighted |
| False-green mutation dimensions | PASS — content, key, role, section, provenance, expiry, and error-state mutations are covered |
| Clinical authority boundary | PASS — semantic/source conflicts require clinician review |

Adversarial challenge discovered and corrected one design ambiguity: an absent therapy row alone could not distinguish an intentionally blank Type 1 source cell from a broken/expired deployment. WP-04 now defines a 48-slot left-joined current view (40 available + 8 explicit `no_source_therapy`) plus a non-treatment release-status view. Blank cells still create no therapy records.

Baseline codebase checks at plan finalization:

```text
pytest -q                                                     61 passed
cd mobile && ./node_modules/.bin/tsc --noEmit                 passed
python3 scripts/import_ground_truth_json_to_supabase.py validate  PASS
git diff --check                                               passed
```

These baseline passes are recorded for comparison only. As established by the source audit, they do not validate current clinical flow correctness; the new gates in this plan are required.
