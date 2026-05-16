from pathlib import Path


MIGRATION = Path("supabase/migrations/20260516_source_clinical_ingestion.sql")


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
