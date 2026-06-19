from pathlib import Path

RETIRE_MIGRATION = Path(
    "supabase/migrations/20260619_zzzz_retire_legacy_clinical_recommendations.sql"
)


def test_legacy_clinical_recommendations_public_read_is_retired_fail_closed() -> None:
    # A1/A2: the only release-ungated clinical read path is retired. RLS stays on,
    # all read-enabling policies are dropped (anon/authenticated -> 0 rows), and the
    # provenance gate no longer has an ungated clinical_recommendations branch.
    sql = RETIRE_MIGRATION.read_text()
    lower = sql.lower()

    assert "enable row level security" in lower
    assert "from pg_policies" in lower
    assert "tablename = 'clinical_recommendations'" in lower
    assert "cmd in ('select', 'all')" in lower
    # never re-grant an ungated read on the table itself.
    assert "grant select on public.clinical_recommendations to anon" not in lower

    func_body = sql.split("create or replace function public.is_public_clinical_source_span", 1)[1]
    assert "from public.clinical_recommendations" not in func_body
    assert "release.status = 'active'" in func_body
    assert "release.valid_through >= current_date" in func_body
