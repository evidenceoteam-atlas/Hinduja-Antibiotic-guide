from pathlib import Path

MIGRATION = Path("supabase/migrations/20260516_source_clinical_ingestion.sql")
GROUND_TRUTH_VERIFY_SQL = Path("supabase/sql/verify_ground_truth_import.sql")


def test_doctor_facing_view_only_returns_approved_rows() -> None:
    sql = MIGRATION.read_text().lower()

    assert "approved_clinical_recommendations_with_source" in sql
    assert "where r.review_status = 'approved'" in sql
    assert "using (review_status = 'approved')" in sql


def test_recommendations_require_source_span_reference() -> None:
    sql = MIGRATION.read_text().lower()

    assert "source_span_id uuid not null" in sql
    assert "references public.clinical_source_spans(id)" in sql


def test_approved_rows_require_reviewer_metadata() -> None:
    sql = MIGRATION.read_text().lower()

    assert "clinical_recommendations_not_approved_without_reviewer" in sql
    assert "reviewer_id is not null" in sql
    assert "reviewed_at is not null" in sql


def test_ground_truth_verification_sql_checks_approved_counts() -> None:
    sql = GROUND_TRUTH_VERIFY_SQL.read_text().lower()

    assert "approved_icmr_guideline_rows_with_source" in sql
    assert "approved_duration_guideline_rows_with_source" in sql
    assert "approved_antibiogram_sheets_with_source" in sql
    assert "approved_synergy_testing_rows_with_source" in sql
    assert "approved_perioperative_procedure_recommendations_with_source" in sql
    assert "approved_perioperative_antibiotic_dosing_with_source" in sql
    assert "25 as expected_count" in sql
    assert "22 as expected_count" in sql
    assert "16 as expected_count" in sql
    assert "11 as expected_count" in sql
    assert "4 as expected_count" in sql


def test_ground_truth_verification_sql_has_missing_and_extra_queries() -> None:
    sql = GROUND_TRUTH_VERIFY_SQL.read_text().lower()

    for token in [
        "missing_icmr_guideline_rows",
        "extra_icmr_guideline_rows",
        "missing_duration_rows",
        "extra_duration_rows",
        "missing_antibiogram_sheets",
        "extra_antibiogram_sheets",
        "missing_synergy_rows",
        "extra_synergy_rows",
        "missing_perioperative_procedure_rows",
        "extra_perioperative_procedure_rows",
        "missing_perioperative_dosing_rows",
        "extra_perioperative_dosing_rows",
    ]:
        assert token in sql
