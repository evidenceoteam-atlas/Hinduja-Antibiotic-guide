from pathlib import Path

from scripts.import_hinduja_csv_bundle_to_supabase import build_import_plan

MIGRATION = Path("supabase/migrations/20260619_versioned_csv_release_flow.sql")
PROTOCOL_SELECTOR = Path("mobile/src/protocolScenario.ts")
PROTOCOL_SELECTOR_CORE = Path("mobile/src/protocolScenarioCore.ts")
APP_ROOT = Path("mobile/src/AppRoot.tsx")
RISK_TS = Path("mobile/src/antibiogramRisk.ts")
LEGACY_IMPORTER = Path("scripts/import_ground_truth_json_to_supabase.py")
TRANSCRIBED_IMPORTER = Path("scripts/import_transcribed_ama_table_to_supabase.py")


def test_pending_csv_import_plan_contains_exact_source_backed_release_counts() -> None:
    counts = build_import_plan().counts

    assert counts["clinical_source_files"] == 21
    assert counts["clinical_release_source_assets"] == 26
    assert counts["patient_risk_criteria"] == 4
    assert counts["antibiogram_sheets"] == 16
    assert counts["antibiogram_therapy_source_slots"] == 48
    assert counts["antibiogram_empiric_therapy"] == 40
    assert counts["antibiogram_footnotes"] == 12
    assert counts["stewardship_pearl_rows"] == 40
    assert counts["antimicrobial_pearl_point_rows"] == 24
    assert counts["perioperative_antibiotic_dosing"] == 4


def test_current_protocol_view_is_exact_release_gated_and_blank_preserving() -> None:
    sql = MIGRATION.read_text().lower()

    assert "approved_current_protocol_scenarios_with_source" in sql
    assert "cross join (values ('1'::text), ('2'::text), ('3'::text))" in sql
    assert "left join public.antibiogram_empiric_therapy" in sql
    assert "'no_source_therapy'" in sql
    assert "r.status = 'active'" in sql
    assert "r.valid_through >= current_date" in sql
    assert "approved_current_patient_risk_criteria_with_source" in sql
    assert "approved_dataset_release_status" in sql
    assert "approved_sheets <> 16" in sql
    assert "approved_slots <> 48" in sql
    assert "approved_therapies <> 40" in sql
    assert "approved_risk_criteria <> 4" in sql
    assert "verified_csv_assets <> 21" in sql
    assert "unresolved_source_assets <> 0" in sql
    assert 'drop policy if exists "approved %s read"' in sql
    assert "release.valid_through >= current_date" in sql
    assert "antibiogram_therapy_not_placeholder" in sql
    assert "source_locator jsonb" in sql
    assert "source_value_sha256 text" in sql
    assert "clinical_dataset_one_active_idx" in sql
    assert "drop table" not in sql


def test_emergency_rollback_is_fail_closed_only() -> None:
    source = Path("supabase/sql/disable_active_dataset_release.sql").read_text().lower()

    assert "enter_clinical_dataset_maintenance" in source
    assert "approved_clinical_recommendations_with_source" not in source


def test_mobile_protocol_selector_uses_all_four_exact_dimensions() -> None:
    selector = PROTOCOL_SELECTOR.read_text()
    source = selector + PROTOCOL_SELECTOR_CORE.read_text()

    assert '.from("approved_current_protocol_scenarios_with_source")' in selector
    for field in ("infection_type", "location", "acquisition", "risk_type"):
        assert f'.eq("{field}"' in selector
    assert "ilike(" not in selector
    assert "contains(" not in selector
    assert "no_source_therapy" in source
    assert "expired" in source
    assert "permission_denied" in source
    assert "network_failure" in source
    assert "schema_failure" in source
    assert "malformed_row" in source
    assert "error.status === 401" in source
    assert "error.status === 403" in source
    assert "error.status === 408" in source


def test_main_protocol_flow_has_no_progressive_or_infection_fallback() -> None:
    source = APP_ROOT.read_text()

    assert "applyProgressiveFilter" not in source
    assert "progressivelyMatchScenarioRows" not in source
    assert '.from("approved_clinical_recommendations_with_source")' in source
    assert "loadProtocolScenario(protocolScenarioKey)" in source
    assert "canUseProtocolActions" in source
    assert "protocolScenarioResult?.status === \"found\"" in source


def test_mobile_risk_has_no_default_and_checks_completeness() -> None:
    source = RISK_TS.read_text()

    defaults = source.split("defaultAntibiogramRiskAnswers", 1)[1].split("};", 1)[0]
    assert defaults.count("null") == 3
    assert source.index("missingCriteria.length > 0") < source.index("const type3Matches")
    assert "invalidCriteria" in source


def test_icmr_remarks_are_persisted_independently_of_duration() -> None:
    # A6: Remarks must be written onto the ICMR row itself, not only via
    # duration_guideline_rows (which is skipped when Duration is empty). After the
    # fix `"remarks": row["remarks"]` appears twice: once in the unconditional
    # icmr_guideline_rows insert and once in the duration_guideline_rows insert.
    importer = Path("scripts/import_hinduja_csv_bundle_to_supabase.py").read_text()
    assert importer.count('"remarks": row["remarks"]') == 2
    # Slice the icmr_guideline_rows insert by its unique comments field and conflict tuple.
    icmr_insert = importer.split('"comments": row["comments"]', 1)[1].split(
        '"clinical_condition", "source_span_id"', 1
    )[0]
    assert '"remarks": row["remarks"]' in icmr_insert

    migration = Path("supabase/migrations/20260619_zzz_icmr_remarks_column.sql").read_text().lower()
    assert "public.icmr_guideline_rows" in migration
    assert "add column if not exists remarks" in migration


def test_mobile_risk_constants_match_csv_source() -> None:
    # A7: the TS fallback constants must stay byte-identical to CSV 01 (and the
    # Python GROUND_TRUTH defaults), since classification is exact string equality.
    ts = RISK_TS.read_text()

    assert '"Antibiotic therapy (oral / parenteral) in last 90 days"' in ts
    assert '"MORE THAN 2 antibiotics (oral/ parenteral) in last 90 days"' in ts
    assert '"Hospitalisation in last 90 days with invasive procedure/devices"' in ts
    assert '"Contact with hospital in last 90 days WITHOUT invasive procedure/devices"' in ts


def test_legacy_json_import_cannot_write_or_become_the_source_path() -> None:
    source = LEGACY_IMPORTER.read_text()

    assert "Legacy reviewed-JSON database imports are retired" in source
    assert "import_hinduja_csv_bundle_to_supabase.py import-pending" in source
    assert "Hard-coded AMA transcription imports are retired" in TRANSCRIBED_IMPORTER.read_text()


def test_documentation_matches_direct_supabase_runtime_and_local_actions() -> None:
    readme = Path("README.md").read_text()
    api_flow = Path("docs/API_FLOW.md").read_text()
    architecture = Path("docs/ARCHITECTURE.md").read_text()
    mobile = APP_ROOT.read_text()

    assert "reads approved, public clinical views from Supabase" in readme
    assert "no sign-in flow" in readme
    assert "approved_current_protocol_scenarios_with_source" in readme
    assert "does not call the FastAPI protocol, case, report, or sharing services" in api_flow
    assert "Saved cases currently live in React state" in api_flow
    assert "PDF export uses Expo Print" in api_flow
    assert "HTTP 410" in api_flow
    assert "Treatment selection never uses substring" in architecture
    assert "/api/v1/" not in mobile


def test_implementation_report_traces_every_audit_finding_once() -> None:
    report = Path("docs/CSV_FLOW_IMPLEMENTATION_REPORT_2026-06-19.md").read_text()
    finding_ids = [
        *(f"C-{index:02d}" for index in range(1, 8)),
        *(f"H-{index:02d}" for index in range(1, 11)),
        *(f"M-{index:02d}" for index in range(1, 8)),
    ]

    assert len(finding_ids) == 24
    for finding_id in finding_ids:
        assert report.count(f"| {finding_id} |") == 1
