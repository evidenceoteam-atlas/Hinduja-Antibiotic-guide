import re
from pathlib import Path

from scripts.import_ground_truth_json_to_supabase import (
    EXPECTED_COUNTS,
    build_import_rows,
    load_ground_truth_json,
    validate_ground_truth_file,
)
from shared.clinical.antibiogram_risk import (
    ANTIBIOTIC_EXPOSURE,
    CO_MORBIDITIES,
    GROUND_TRUTH_RISK_CRITERIA,
    HOSPITAL_CONTACT,
    RISK_TYPE_1,
    RISK_TYPE_2,
    RISK_TYPE_3,
    classify_antibiogram_risk,
)

GROUND_TRUTH_PATH = Path("docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json")
GROUND_TRUTH_MIGRATION = Path("supabase/migrations/20260526_ground_truth_sections.sql")
GROUND_TRUTH_REPOSITORY = Path("shared/clinical/ground_truth.py")
MOBILE_DATA_LAYER = Path("mobile/src/clinicalData.ts")
MOBILE_APP_ROOT = Path("mobile/src/AppRoot.tsx")

APPROVED_GROUND_TRUTH_VIEWS = {
    "approved_icmr_guideline_rows_with_source",
    "approved_duration_guideline_rows_with_source",
    "approved_antibiogram_sheets_with_source",
    "approved_antibiogram_pathogen_rows_with_source",
    "approved_antibiogram_risk_criteria_with_source",
    "approved_antibiogram_empiric_therapy_with_source",
    "approved_antibiogram_footnotes_with_source",
    "approved_synergy_testing_rows_with_source",
    "approved_antifungal_susceptibility_rows_with_source",
    "approved_stewardship_pearl_rows_with_source",
    "approved_antimicrobial_pearl_point_rows_with_source",
    "approved_perioperative_procedure_recommendations_with_source",
    "approved_perioperative_antibiotic_dosing_with_source",
    "approved_perioperative_notes_with_source",
}

RAW_GROUND_TRUTH_TABLES = {
    "icmr_guideline_rows",
    "duration_guideline_rows",
    "antibiogram_sheets",
    "antibiogram_pathogen_rows",
    "antibiogram_risk_criteria",
    "antibiogram_empiric_therapy",
    "antibiogram_footnotes",
    "synergy_testing_rows",
    "antifungal_susceptibility_rows",
    "stewardship_pearl_rows",
    "antimicrobial_pearl_point_rows",
    "perioperative_procedure_recommendations",
    "perioperative_antibiotic_dosing",
    "perioperative_notes",
}


def test_ground_truth_expected_counts_are_validated_end_to_end() -> None:
    summary = validate_ground_truth_file(GROUND_TRUTH_PATH)

    assert summary.counts["icmr_guidelines"] == 25
    assert summary.counts["duration_of_treatment"] == 22
    assert summary.counts["antibiogram_sheets"] == 16
    assert summary.counts["synergy_testing_rows"] == 2
    assert summary.counts["perioperative_procedure_rows"] == 11
    assert summary.counts["perioperative_antibiotic_dosing_rows"] == 4
    assert summary.counts == EXPECTED_COUNTS


def test_approved_import_payload_preserves_expected_ground_truth_counts() -> None:
    payload = load_ground_truth_json(GROUND_TRUTH_PATH)
    rows = build_import_rows(
        "import-all",
        payload,
        approve=True,
        reviewer_id="phase-8-9-test-reviewer",
    )
    rows_by_table: dict[str, int] = {}
    for row in rows:
        rows_by_table[row.table] = rows_by_table.get(row.table, 0) + 1

    assert rows_by_table["icmr_guideline_rows"] == 25
    assert rows_by_table["duration_guideline_rows"] == 22
    assert rows_by_table["antibiogram_sheets"] == 16
    assert rows_by_table["synergy_testing_rows"] == 2
    assert rows_by_table["perioperative_procedure_recommendations"] == 11
    assert rows_by_table["perioperative_antibiotic_dosing"] == 4
    assert all(row.payload["review_status"] == "approved" for row in rows)
    assert all(row.payload["reviewer_id"] == "phase-8-9-test-reviewer" for row in rows)
    assert all(row.payload["reviewed_at"] for row in rows)
    assert all(row.payload["source_quote"] for row in rows)


def test_doctor_facing_backend_and_mobile_queries_use_approved_views_only() -> None:
    repository_source = GROUND_TRUTH_REPOSITORY.read_text()
    mobile_data_source = MOBILE_DATA_LAYER.read_text()

    for approved_view in APPROVED_GROUND_TRUTH_VIEWS:
        assert approved_view in repository_source or approved_view in mobile_data_source

    for raw_table in RAW_GROUND_TRUTH_TABLES:
        assert f"from public.{raw_table}" not in repository_source
        assert f'.from("{raw_table}")' not in mobile_data_source
        assert f".from('{raw_table}')" not in mobile_data_source


def test_approved_views_and_rls_exclude_pending_review_rows() -> None:
    sql = GROUND_TRUTH_MIGRATION.read_text().lower()

    for approved_view in APPROVED_GROUND_TRUTH_VIEWS:
        view_pattern = re.compile(
            rf"create or replace view public\.{re.escape(approved_view)}\b"
            r".*?where r\.review_status = 'approved';",
            re.DOTALL,
        )
        assert view_pattern.search(sql), approved_view

    for raw_table in RAW_GROUND_TRUTH_TABLES:
        assert f"alter table public.{raw_table} enable row level security;" in sql
        assert "'create policy \"approved %s read\"" in sql
        assert "using (review_status = ''approved'')" in sql


def test_antibiogram_risk_classification_matches_ground_truth_precedence() -> None:
    selected = {
        HOSPITAL_CONTACT: GROUND_TRUTH_RISK_CRITERIA[HOSPITAL_CONTACT]["1"],
        ANTIBIOTIC_EXPOSURE: GROUND_TRUTH_RISK_CRITERIA[ANTIBIOTIC_EXPOSURE]["3"],
        CO_MORBIDITIES: GROUND_TRUTH_RISK_CRITERIA[CO_MORBIDITIES]["2"],
    }
    assert classify_antibiogram_risk(selected).risk_type == RISK_TYPE_3

    selected = {
        HOSPITAL_CONTACT: GROUND_TRUTH_RISK_CRITERIA[HOSPITAL_CONTACT]["2"],
        ANTIBIOTIC_EXPOSURE: GROUND_TRUTH_RISK_CRITERIA[ANTIBIOTIC_EXPOSURE]["1"],
        CO_MORBIDITIES: GROUND_TRUTH_RISK_CRITERIA[CO_MORBIDITIES]["1"],
    }
    assert classify_antibiogram_risk(selected).risk_type == RISK_TYPE_2

    selected = {
        HOSPITAL_CONTACT: GROUND_TRUTH_RISK_CRITERIA[HOSPITAL_CONTACT]["1"],
        ANTIBIOTIC_EXPOSURE: GROUND_TRUTH_RISK_CRITERIA[ANTIBIOTIC_EXPOSURE]["1"],
        CO_MORBIDITIES: GROUND_TRUTH_RISK_CRITERIA[CO_MORBIDITIES]["1"],
    }
    assert classify_antibiogram_risk(selected).risk_type == RISK_TYPE_1

    selected = {
        HOSPITAL_CONTACT: GROUND_TRUTH_RISK_CRITERIA[HOSPITAL_CONTACT]["1"],
        ANTIBIOTIC_EXPOSURE: None,
        CO_MORBIDITIES: GROUND_TRUTH_RISK_CRITERIA[CO_MORBIDITIES]["1"],
    }
    assert classify_antibiogram_risk(selected).status == "insufficient/manual_review"


def test_mobile_ground_truth_sections_are_present_and_routable() -> None:
    source = MOBILE_APP_ROOT.read_text()

    for visible_section in [
        "Site Based ICMR Antibiotic Guidelines",
        "Approved Duration of Treatment",
        "Local Antibiogram and Empirical Antibiotic Choice",
        "Antimicrobial Stewardship Pearls",
        "Antimicrobial Pearl Points",
        "Synergy Testing",
        "Antifungal Susceptibility",
        "Perioperative Antimicrobial Guidelines",
    ]:
        assert visible_section in source

    for route_target in [
        'target: "guidelineSection"',
        'target: "duration"',
        'target: "antibiogram"',
        'case "guidelineSection"',
        'case "duration"',
        'case "antibiogram"',
    ]:
        assert route_target in source
