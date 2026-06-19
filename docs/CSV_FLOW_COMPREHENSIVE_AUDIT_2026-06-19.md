# Hinduja Antibiotic Guide — Comprehensive CSV and Flow Audit

Audit date: 2026-06-19  
Scope: all 21 files in `Hindujacsv/`, the reviewed ground-truth JSON, importers, Supabase schema/views, mobile selection flow, protocol engine, tests, and project flow documentation.

## Executive verdict

The project is **not flow-correct and should not be treated as clinically deployable in its current state**.

The main problem is architectural, not cosmetic: there are three disconnected recommendation paths.

```text
Hindujacsv/*.csv
  -> scripts/clinical_ingest.py
  -> 0 recommendation rows for every one of the 21 CSVs

reviewed ground-truth JSON
  -> 501 specialized import rows
  -> ICMR / Duration / Antibiogram / Pearls / Perioperative reference screens
  -> 0 rows in clinical_recommendations (the table used by Protocol Result)

partial hard-coded ICMR transcription (8 rows x empirical/alternate)
  -> clinical_recommendations
  -> mobile Protocol Result fuzzy matching

rules/hinduja_protocols.json (empty recommendation_matrix)
  -> POST /protocols/evaluate
  -> always returns no therapy
```

This split explains why reference tabs can contain data while the scenario-driven protocol flow is empty, incomplete, or mismatched.

### Finding count

| Severity | Count | Meaning |
|---|---:|---|
| Critical | 7 | Can select/display the wrong scenario content, bypass source fidelity, or make the documented treatment flow non-functional |
| High | 10 | Material content loss, invented content, unsafe defaults, provenance failure, or major coverage gap |
| Medium | 7 | Validation, documentation, source-control, and presentation defects that conceal or amplify the major failures |

## Audit method

The audit used five independent passes:

1. Parsed every CSV with the Python CSV parser, preserving quoted multiline cells.
2. Reconstructed each file's logical sections instead of assuming the first row was a header.
3. Compared all source structures to `docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json` and the import plans generated from it.
4. Traced the doctor-facing mobile path from infection selection through risk classification, scenario matching, protocol display, save, export, and share.
5. Ran adversarial counterexamples against the matching and risk logic, then reran the existing tests and validators to check whether they detected the failures.

This is a source-fidelity and software-flow audit. It does not independently certify the clinical correctness of the institutional recommendations against external medical guidelines.

## Critical findings

### C-01 — All 21 CSV files are unusable through the documented CSV ingestion path

`docs/SOURCE_INGESTION.md` explicitly lists CSV as supported. The implementation uses `csv.DictReader`, assuming the first row contains headers (`scripts/clinical_ingest.py:236-242`). That assumption is false for this folder:

- Files 01–20 start with an empty/title row.
- Files 03–18 have no header row at all.
- File 19 contains three different table shapes in one file.
- Files 20–21 are one-column, sectioned documents with wrapped continuation rows.
- File 21 uses `ANTIFUNGALS` as its first row, so a generic dictionary reader treats the section heading as the column name.

Executed result:

```text
21 CSV files tested
21 files emitted 0 draft recommendation rows
```

For example, CSV extraction of `03_BSI_ICU_CA.csv` becomes unlabeled strings such as `: Cefoperazone-Sulbactam ...`; extraction of `02_ICMR_guidelines.csv` retains only the final duplicate blank-key column (`Remarks`) because the blank first row is interpreted as seven duplicate empty headers.

Impact: the documented CSV-to-review-to-approved workflow is non-functional for every supplied source file.

### C-02 — The Protocol Result screen does not consume the 16 local antibiogram CSV therapies

The reviewed JSON importer creates 501 specialized rows, including 48 `antibiogram_empiric_therapy` rows, but creates **zero** `clinical_recommendations` rows. The mobile Protocol Result screen reads only `approved_clinical_recommendations_with_source` (`mobile/src/AppRoot.tsx:3439-3450`). The specialized antibiogram rows are used only in the separate Antibiogram tab (`mobile/src/AppRoot.tsx:3853-3906`).

Therefore, selecting BSI/UTI/RTI/IAI + setting + acquisition + risk in the main flow does not select the corresponding treatment from CSVs 03–18.

The only bundled path that can pre-populate approved rows for the main result table is a separate hard-coded transcription script. It contains eight source rows (two with literal `[BLANK]` syndromes) and inserts whole empirical/alternate cells as `drug` (`scripts/import_transcribed_ama_table_to_supabase.py:30-70, 265-321`). It is not a complete representation of CSV 02 or CSVs 03–18. The generic JSONL importer can also write this table, but the supplied CSV extraction step gives it zero recommendation rows.

Those hard-coded rows have no setting, acquisition, or risk values, but the UI still shows risk assessment for the four major risk-typed infection groups. The resulting risk selection therefore has no effect on these rows. The app then takes the first three matched rows as “Recommended” and the next three as “Alternative” without using `ama_role` (`mobile/src/AppRoot.tsx:3716-3723`); with one empirical and one alternate row for a condition, both can appear under “Recommended Treatment Protocol”.

Impact: the principal scenario flow and the local antibiogram source of truth are disconnected.

### C-03 — Community- and hospital-acquired rows match each other

`fieldMatches` accepts any shared token (`mobile/src/AppRoot.tsx:2611-2624`). The phrases below therefore match:

```text
Hospital-acquired vs Community-acquired => true (shared token: acquired)
Type 1 - Low Risk vs Type 3 - High Risk => true (shared tokens: type, risk)
```

This function is used for acquisition filtering, risk filtering, option validation, and recommendation scoring.

Impact: even if exact scenario rows are present, a hospital-acquired selection can admit community-acquired rows, and any risk type can match any other risk type.

### C-04 — Failed scenario filters silently fall back to incompatible rows

`applyProgressiveFilter` returns the unfiltered input whenever a filter produces zero rows (`mobile/src/AppRoot.tsx:2761-2768`). The setting, acquisition, and risk stages all use it (`mobile/src/AppRoot.tsx:2770-2795`). Later, the result code also falls back from clean matched rows to all infection rows (`mobile/src/AppRoot.tsx:3635-3657`).

This is the opposite of the documented fail-closed rule. A missing exact match becomes a broad infection-level recommendation instead of “no approved recommendation”.

Impact: source rows for the wrong scenario can be promoted to “Recommended Treatment Protocol”.

### C-05 — Infection-category matching produces cross-system misclassification

The category matcher accepts substring or any shared token and returns the first category in a fixed order (`mobile/src/AppRoot.tsx:1562-1701`). Adversarial evaluation of the actual function logic produced:

| Source condition | Computed category | Expected source family |
|---|---|---|
| Urosepsis / Pyelonephritis | BSI | UTI |
| Intra-abdominal sepsis | BSI | IAI |
| Brain abscess | RTI | CNS |
| Severe PN / Perinephric abscess | RTI | UTI |
| Liver abscess | RTI | IAI |
| Enteric fever | FN | Not febrile neutropenia |

Examples: `Sepsis` causes Urosepsis and intra-abdominal sepsis to match BSI first; the token `abscess` makes brain/liver/perinephric abscesses match the earlier `Lung abscess` RTI synonym; `fever` makes enteric fever match neutropenic fever.

Rows with a populated, correct `infection_site` may avoid this path, but the hard-coded main-table importer populates `syndrome` and leaves `infection_site` null.

Impact: recommendations can appear under the wrong infection system.

### C-06 — The API flow uses a contradictory risk model and cannot return therapy

CSV 01 defines exact Type 1/2/3 criteria. The backend `/protocols/evaluate` instead uses weighted booleans plus setting/acquisition points (`shared/clinical/rules.py:72-96`; `rules/hinduja_protocols.json:2-37`). Counterexamples:

| Input | CSV rule | Backend result |
|---|---|---|
| Hospital contact in last 90 days only | Type 2 | Type 1 (score 2) |
| More than two antibiotics only | Type 3 | Type 1 (score 2) |
| All patient factors negative, ICU + hospital-acquired | Type 1 by patient criteria | Type 2 (score 4) |

The configured `recommendation_matrix` is `{}`, so every evaluation returns zero therapy and a fail-closed reason. Despite that, the endpoint message is “Protocol evaluated successfully”, creates a random case ID, and publishes an event (`services/protocol-engine/app/main.py:64-80`). `GET /protocols/result/{case_id}` does not retrieve a result; it always returns `{status: "available"}` (`services/protocol-engine/app/main.py:83-87`).

Impact: the documented API sequence is both clinically inconsistent with CSV 01 and functionally unable to produce a protocol.

### C-07 — “Source-backed” rows use transformed JSON as the source, with manufactured page references

The ground-truth importer serializes each transformed JSON object and stores that serialization as the `source_quote`; it hashes that generated string to create pseudo span offsets (`scripts/import_ground_truth_json_to_supabase.py:222-240`). It registers the reviewed JSON—not any CSV—as the source file.

It also assigns every row in a section the section’s start page: all ICMR rows page 4, all duration rows page 11, all antibiogram rows page 13, all stewardship rows page 48, and so on (`scripts/import_ground_truth_json_to_supabase.py:47-57`). The mobile UI displays these values as “Source Page” and displays the generated JSON as “Source Quote”.

Impact: transformed or incorrect values can be approved while appearing traceable to a verbatim source/page. The CSV hashes are not part of the import provenance.

## High findings

### H-01 — The canonical JSON contains a wrong Diabetic Foot comment

CSV 02 states `Surgical source control where possible.` for Diabetic Foot Infection. The reviewed JSON instead repeats the CAP comment `Avoid FQNs. Oseltamivir only if clinical suspicion of H1N1` (`reviewed.json:104-108`). The same wrong value is present in `docs/reviewed_icmr_table_transcriptions.json`.

This is not formatting normalization; it is cross-row content contamination.

### H-02 — RTI Wards Hospital-Acquired Type 3 loses an antibiotic option

CSV 14 Type 3:

```text
Cefoperazone-Sulbactam OR Piperacillin/Tazobactam OR Imipenem OR Meropenem
```

Reviewed JSON Type 3 (`reviewed.json:2785-2789`):

```text
Cefoperazone-Sulbactam OR Imipenem OR Meropenem
```

`Piperacillin/Tazobactam` is omitted.

### H-03 — All 64 pearls lose their true section names

CSV 20 has 40 bullet items across General, Blood Stream, Urinary Tract, Respiratory, Intra-Abdominal, Cardiovascular, Bone & Joint, Surgical Prophylaxis, and Meningitis. CSV 21 has 24 items across Antifungals, Antivirals, Antimalarials, Antitubercular, and Antiparasites.

In the reviewed JSON, all 36 stewardship items are under key `•`, all 28 pearl-point items are under key `•`, and every real heading has an empty list (`reviewed.json:3492-3576`). The importer persists the JSON key as `section_name`; the UI groups and labels by it.

Result: **64/64 displayed pearls are assigned to section `•`**. In addition, the four Meningitis rows from CSV 20 are moved from `stewardship_pearls` into `pearl_points` without a source crosswalk.

### H-04 — Eight blank Type 1 source cells are converted into treatment text

The eight hospital-acquired CSV sheets have blank Type 1 therapy cells. The reviewed JSON converts each blank into `(Not enough data)` and imports it as an approved empiric-therapy string. Occurrences are at JSON lines 706, 1129, 1444, 1877, 2327, 2786, 3061, and 3364.

This is invented display content. A blank/null value should remain absent and trigger an explicit UI empty state; it should not become an approved therapy row.

### H-05 — CSV 06 has contradictory acquisition metadata

The filename is `06_BSI_Wards_HA.csv`, but its internal title says `COMMUNITY ACQUIRED`. The reviewed JSON silently chooses Hospital-Acquired from the filename. There is no recorded reviewer decision or validation error.

Impact: a source contradiction is resolved implicitly instead of being blocked for review.

### H-06 — CSV 17’s non-empty AMSP note is omitted

`17_ABDO_WARDS_CA.csv` contains the AMSP disclaimer about insufficient ceftazidime-avibactam + aztreonam susceptibility data. The matching reviewed JSON sheet has `section_notes: []` (`reviewed.json:3229-3234`).

At the same time, the JSON adds Tigecycline and Colistin footnotes that are not present in this CSV. Those additions may come from another source, but they are not auditable against the supplied CSV.

### H-07 — CSV 02 undergoes undocumented semantic transformations

Beyond punctuation and spelling normalization, the reviewed JSON changes clinical structure:

- The second source row also says `HCAP / Early onset VAP`; JSON renames it `HCAP / Late onset VAP`.
- The second source `Lung Abscess` row becomes `Susceptible host (...)`.
- The Prosthetic Valve IE meropenem regimen moves from the source Empirical AMA cell into the JSON Alternate AMA cell (`reviewed.json:90-94`).
- The Diabetic Foot comment is replaced with the CAP comment (H-01).

The first two may be defensible corrections to obvious source-export defects, but no correction ledger, reviewer note, or row-level source diff exists. The third changes recommendation role.

### H-08 — Perioperative Vancomycin loses “initial dose”

CSV 19 specifies `15 mg/kg initial dose`. The reviewed JSON stores `15 mg/kg` (`reviewed.json:3650-3654`). The qualifier is omitted from the displayed dosing table.

The importer also merges separate Bolus and Infusion columns into one free-text field, reducing machine-checkable structure.

### H-09 — Risk assessment is pre-populated as Type 2 and partial Type 2 input is accepted

The mobile default answers are one Type 2 criterion plus two Type 1 criteria (`mobile/src/antibiogramRisk.ts:46-50`), and `riskType` is initially Type 2 (`mobile/src/AppRoot.tsx:2339-2342`). A user can press “View Result” without making an active selection.

The classifier also checks for any Type 2 match before checking missing answers (`mobile/src/antibiogramRisk.ts:62-84`). A partial form with one Type 2 answer and two unanswered criteria is classified Type 2, even though an unanswered criterion could be Type 3.

### H-10 — The guide is expired but the application does not gate or warn on expiry

The canonical metadata says `valid_till: December 2025`; this audit is dated 2026-06-19. The app displays that date only in an informational profile card. Loading, matching, approval, protocol display, saving, exporting, and sharing do not check expiry.

Impact: expired institutional guidance can continue to be presented as an approved current recommendation.

## Medium findings

### M-01 — The validator checks counts, not fidelity

The validator checks only eight section/count invariants (`scripts/import_ground_truth_json_to_supabase.py:25-45, 148-203`). It does not validate:

- any CSV hash or source row;
- the 48 empiric-therapy values;
- pearl section distribution or pearl counts;
- blank-vs-placeholder preservation;
- 140 pathogen rows, 64 risk-criterion rows, 18 footnotes, or 72 antifungal rows;
- correct source pages;
- semantic role preservation;
- the table consumed by Protocol Result.

Consequently, it reports PASS despite the critical/high defects above.

### M-02 — Existing tests do not reference `Hindujacsv/`

The complete test suite passes (`61 passed`), but no test reads or hashes any file in `Hindujacsv/`. The end-to-end safety test asserts counts, view names, and visible section labels, not source-to-output equality or scenario isolation.

### M-03 — The supplied CSV folder is untracked

`git status --short` reports `?? Hindujacsv/`. CI, deployment, and other clones therefore cannot reproduce this audit or detect source drift. The manifest hashes only the reviewed JSON; none of the 21 CSV hashes is recorded.

### M-04 — Large parts of the reviewed dataset have no corresponding CSV in the folder

The CSV set contains no source table for:

- 2 synergy-testing rows;
- 72 antifungal-susceptibility rows;
- 3 synergy/antifungal notes;
- document metadata;
- most of the 140 antibiogram pathogen/sensitivity rows and 18 footnotes.

These records may be valid from the original guide, but they cannot be verified “against each CSV” and should not share a provenance model that implies they came from this folder.

### M-05 — Documentation describes a mobile/API flow that is not implemented

`README.md` and `docs/API_FLOW.md` say the mobile flow calls `/protocols/evaluate`, `/protocols/result`, cases, report, and share APIs. There are no `/api/v1` callers in `mobile/`.

The actual mobile app:

- reads approved views directly through Supabase;
- classifies risk locally;
- keeps saved cases only in React state (`mobile/src/AppRoot.tsx:4036-4046`);
- exports locally with Expo Print;
- shares through device/web mechanisms.

Saved cases remain in React state until the app is closed. The documented endpoint `/protocols/{infection_code}/details` is not present in the protocol service.

### M-06 — Empty/error states hide operational data failures

The mobile data layer catches query errors and returns empty arrays. The UI then reports “No approved ... available,” making permission, schema, network, and truly-empty conditions indistinguishable. This makes a broken import/view deployment look like a legitimate no-data state.

### M-07 — Users can continue into details/actions after an empty protocol result

The Protocol Result screen always renders “View Details” even when the result is fail-closed (`mobile/src/AppRoot.tsx:7092-7119`), and Protocol Details always renders “Continue to Actions” (`mobile/src/AppRoot.tsx:7145-7199`). Saving is blocked later, but the flow still presents details/export/share actions around an empty protocol state.

## Per-CSV audit ledger

Every file below was parsed and mapped. “Common” means: generic ingestion emits zero recommendations; the file is not directly read by the mobile app; and it has no committed CSV hash/crosswalk.

| File | Logical source content | Source-to-project result | File-specific errors |
|---|---|---|---|
| `01_Patient_Risk_Stratification.csv` | 3 definitions + 9 criteria | Duplicated in JSON, Python, and TypeScript; not imported from CSV | Backend weighted model contradicts it; mobile defaults to Type 2; no single source of truth |
| `02_ICMR_guidelines.csv` | 25 ICMR rows; 20 rows with duration cells | JSON imports 25 ICMR + restructures to 22 duration rows | Blank first row breaks generic ingestion; duplicated Early-onset label; undocumented condition/role changes; Diabetic Foot comment contamination |
| `03_BSI_ICU_CA.csv` | 3 risk therapies + 1 note | Therapy text materially matches specialized JSON | Common; not used by Protocol Result; added pathogen/sensitivity rows are unverifiable from CSV |
| `04_BSI_ICU_HA.csv` | blank Type 1; Type 2/3 + note | Specialized JSON | Blank Type 1 becomes approved `(Not enough data)` |
| `05_BSI_Wards_CA.csv` | 3 therapies | Specialized JSON | Common; punctuation normalization only in therapy, but added footnote is not in CSV |
| `06_BSI_Wards_HA.csv` | blank Type 1; Type 2/3 + note | JSON classifies as Hospital-Acquired | Internal title says Community-Acquired; blank Type 1 becomes placeholder; added footnote not in CSV |
| `07_UTI_ICU_CA.csv` | 3 therapies + 1 combined note | Specialized JSON | Common; Type 2 order normalized; added Colistin footnote not in CSV |
| `08_UTI_ICU_HA.csv` | blank Type 1; Type 2/3 + note | Specialized JSON | Blank Type 1 becomes placeholder; added Colistin footnotes not in CSV |
| `09_UTI_Wards_CA.csv` | 3 therapies + note | Specialized JSON | Common; source note split into two JSON notes |
| `10_UTI_Wards_HA.csv` | blank Type 1; Type 2/3 + note | Specialized JSON | Blank Type 1 becomes placeholder; added Colistin footnote not in CSV |
| `11_RS_ICU_CA.csv` | 3 combination therapies + note | Specialized JSON | Common; `PLUS` normalized to `+`; added Colistin footnotes not in CSV |
| `12_RS_ICU_HA.csv` | blank Type 1; Type 2/3 + note | Specialized JSON | Blank Type 1 becomes placeholder; added footnote not in CSV |
| `13_RS_WARDS_CA.csv` | 3 therapies; empty note row | Specialized JSON | Common; `PLUS` normalized to `+` |
| `14_RS_WARDS_HA.csv` | blank Type 1; Type 2/3 | Specialized JSON | Blank Type 1 becomes placeholder; Type 3 loses Piperacillin/Tazobactam; added footnote not in CSV |
| `15_ABDO_ICU_CA.csv` | 3 therapies + note | Specialized JSON | Common; extra Tigecycline notes/footnotes not in CSV |
| `16_ABDO_ICU_HA.csv` | blank Type 1; Type 2/3 + note | Specialized JSON | Blank Type 1 becomes placeholder; extra Tigecycline content not in CSV |
| `17_ABDO_WARDS_CA.csv` | 3 therapies + non-empty AMSP note | Specialized JSON | Source note omitted; unrelated Tigecycline/Colistin footnotes added from an untracked source |
| `18_ABDO_WARDS_HA.csv` | blank Type 1; Type 2/3 | Specialized JSON | Blank Type 1 becomes placeholder; extra Tigecycline content not in CSV |
| `19_Perioperative_Prohylaxis.csv` | 11 procedures, 4 dosing rows, 11 notes | Specialized perioperative tables | Generic ingestion fails; filename misspells Prophylaxis; Vancomycin loses “initial dose”; bolus/infusion columns merged; UI exposes internal note-type keys |
| `20_Pearls.csv` | 40 bullets across 9 sections | 36 stewardship + 4 pearl-point rows | Generic ingestion fails; all real section mappings lost; Meningitis moved to another top-level section |
| `21_AMA_Pearls.csv` | 24 bullets across 5 sections | 24 of the 28 pearl-point rows | First heading becomes a fake CSV header in generic ingestion; all five section mappings lost |

## Adversarial verification results

The following checks were deliberately independent of the project’s happy-path count tests.

| Check | Result | Interpretation |
|---|---:|---|
| Existing Python suite | 61 passed | Does not establish CSV or flow correctness |
| TypeScript typecheck | Passed | Types compile; semantic matching remains wrong |
| Ground-truth validator | PASS | Count-only validator misses content/section/provenance defects |
| Ground-truth dry run | 501 plans | 0 plans target `clinical_recommendations` used by Protocol Result |
| CSV ingestion | 0 recommendation rows from 21/21 files | Documented CSV workflow is broken |
| Pearl section invariant | 64/64 under `•` | Every pearl has the wrong section name |
| Blank-preservation invariant | 8 violations | Blank Type 1 cells became approved text |
| Acquisition isolation | Failed | Hospital-acquired matches Community-acquired |
| Risk isolation | Failed | Type 1 matches Type 3 |
| Infection-category isolation | Failed | Multiple UTI/IAI/CNS conditions route to BSI/RTI/FN |
| CSV 14 therapy equality | Failed | Piperacillin/Tazobactam omitted |
| CSV 17 note preservation | Failed | Non-empty note omitted |
| CSV 02 row-field equality | Failed | Wrong comment and undocumented role/condition changes |
| API risk counterexamples | Failed | CSV Type 2/3 cases classified Type 1; context changes patient risk |
| API recommendation availability | Failed | Empty matrix returns no therapy for every case |

The adversarial pass also rechecked the report against every CSV’s logical rows after the findings were drafted. No file was omitted.

## Required remediation order

### P0 — Before any clinical use

1. Treat the current recommendation flow as non-production and block approval/display of the expired December 2025 guide until institutional revalidation.
2. Define one canonical scenario key: `infection_type + location + acquisition + risk_type`; use exact equality only.
3. Make Protocol Result read the approved local empiric-therapy table for CSVs 03–18, or populate one canonical recommendation table from those rows. Do not maintain two recommendation stores.
4. Remove shared-token matching and all “if zero matches, keep old rows” behavior from clinical selection.
5. Retire the weighted risk evaluator or align it exactly with CSV 01. Start mobile answers unselected and fail closed on unresolved criteria.
6. Correct and re-review the known content defects: CSV 02 Diabetic Foot comment, PVE role shift, CSV 14 Type 3 omission, CSV 17 note omission, eight blank Type 1 placeholders, CSV 19 Vancomycin qualifier, and all pearl sections.
7. Store the actual CSV/PDF bytes and hashes as source files; source quotes must be verbatim spans, and page references must be row-accurate or null.

### P1 — Make correctness reproducible

8. Commit the reviewed source package or an approved immutable source bundle; record all 21 SHA-256 hashes in the manifest.
9. Implement schema-aware adapters for the six CSV shapes: risk document, ICMR table, 16 two-column therapy sheets, perioperative multi-table file, stewardship pearls, and AMA pearls.
10. Add row-level golden tests for all 21 files, all 48 therapy cells, all 64 pearl-to-section assignments, all 11+4+11 perioperative rows, and all known source notes.
11. Add invariants that forbid approved placeholders for blank source therapy, forbid section name `•`, and require every doctor-facing row to map to a source hash and verbatim source value.
12. Make the mobile/API architecture and documentation agree. Either route mobile through the services or document and test the direct-Supabase architecture.

## Limitations

- No live Supabase production database was queried; this audit covers repository code, local source files, generated import plans, and deterministic flow behavior.
- The original full guide/PDF was not used as an external clinical authority in this audit. Data present in JSON but absent from the 21 CSVs is marked unverifiable rather than declared clinically wrong.
- `Hindujacsv/` is currently untracked, so the findings identify the exact local files by filename and SHA-256 in the audit working session, but those files are not reproducible from Git until committed or placed in an immutable source bundle.

## Final conclusion

The current green tests demonstrate schema presence and count consistency, not clinical flow correctness. The supplied CSVs do not enter the documented ingestion pipeline, the main protocol result does not consume the reviewed antibiogram therapies, fuzzy matching defeats acquisition/risk isolation, and the canonical JSON contains confirmed source-fidelity errors. The project needs a single exact-key recommendation path and source-level regression tests before further clinical rollout.
