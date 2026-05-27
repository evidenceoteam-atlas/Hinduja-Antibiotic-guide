import json
from pathlib import Path

import pytest

from scripts.import_ground_truth_json_to_supabase import (
    EXPECTED_COUNTS,
    REQUIRED_TOP_LEVEL_SECTIONS,
    build_import_rows,
    build_parser,
    load_ground_truth_json,
    main,
    validate_ground_truth_file,
    where_clause,
)


def valid_payload() -> dict:
    return {
        "metadata": {"source_document": "Guide"},
        "icmr_guidelines": [{} for _ in range(EXPECTED_COUNTS["icmr_guidelines"])],
        "duration_of_treatment": [
            {} for _ in range(EXPECTED_COUNTS["duration_of_treatment"])
        ],
        "antibiograms": {
            infection_group: {
                "ICU": {
                    "community_acquired": {},
                    "hospital_acquired": {},
                },
                "wards": {
                    "community_acquired": {},
                    "hospital_acquired": {},
                },
            }
            for infection_group in ["BSI", "UTI", "RTI", "IAI"]
        },
        "synergy_and_antifungal": {
            "synergy_testing": [
                {} for _ in range(EXPECTED_COUNTS["synergy_testing_rows"])
            ],
            "antifungal_susceptibility": {},
        },
        "stewardship_pearls": {},
        "pearl_points": {},
        "perioperative": {
            "procedure_recommendations": [
                {} for _ in range(EXPECTED_COUNTS["perioperative_procedure_rows"])
            ],
            "antibiotic_dosing": [
                {}
                for _ in range(
                    EXPECTED_COUNTS["perioperative_antibiotic_dosing_rows"]
                )
            ],
        },
    }


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_validate_actual_ground_truth_file() -> None:
    summary = validate_ground_truth_file()

    assert summary.counts == EXPECTED_COUNTS
    assert summary.required_sections == REQUIRED_TOP_LEVEL_SECTIONS


def test_validate_accepts_expected_structure_and_counts(tmp_path: Path) -> None:
    json_path = tmp_path / "ground_truth.json"
    write_json(json_path, valid_payload())

    summary = validate_ground_truth_file(json_path)

    assert summary.counts["icmr_guidelines"] == 25
    assert summary.counts["antibiogram_sheets"] == 16


def test_validate_rejects_missing_required_section(tmp_path: Path) -> None:
    payload = valid_payload()
    payload.pop("perioperative")
    json_path = tmp_path / "missing.json"
    write_json(json_path, payload)

    with pytest.raises(ValueError, match="Missing required sections: perioperative"):
        validate_ground_truth_file(json_path)


def test_validate_rejects_count_mismatch(tmp_path: Path) -> None:
    payload = valid_payload()
    payload["icmr_guidelines"].pop()
    json_path = tmp_path / "count_mismatch.json"
    write_json(json_path, payload)

    with pytest.raises(ValueError, match="icmr_guidelines: expected 25, found 24"):
        validate_ground_truth_file(json_path)


def test_validate_rejects_wrong_section_type(tmp_path: Path) -> None:
    payload = valid_payload()
    payload["duration_of_treatment"] = {}
    json_path = tmp_path / "wrong_type.json"
    write_json(json_path, payload)

    with pytest.raises(ValueError, match="duration_of_treatment must be a list"):
        validate_ground_truth_file(json_path)


def test_validate_command_returns_zero_on_success(tmp_path: Path, capsys) -> None:
    json_path = tmp_path / "ground_truth.json"
    write_json(json_path, valid_payload())

    exit_code = main(["validate", "--path", str(json_path)])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Ground truth validation summary" in captured.out
    assert "required_sections: PASS" in captured.out
    assert "expected_counts: PASS" in captured.out
    assert "validation: PASS" in captured.out


def test_validate_command_returns_nonzero_on_failure(tmp_path: Path, capsys) -> None:
    payload = valid_payload()
    payload["synergy_and_antifungal"]["synergy_testing"].append({})
    json_path = tmp_path / "bad_count.json"
    write_json(json_path, payload)

    exit_code = main(["validate", "--path", str(json_path)])

    captured = capsys.readouterr()
    assert exit_code == 1
    assert "validation: FAIL" in captured.out
    assert "synergy_testing_rows: expected 2, found 3" in captured.out


def test_cli_exposes_validate_and_import_commands() -> None:
    parser = build_parser()

    assert parser.parse_args(["validate"]).command == "validate"
    assert parser.parse_args(["import-icmr", "--dry-run"]).command == "import-icmr"
    assert parser.parse_args(["import-duration", "--dry-run"]).command == "import-duration"
    assert parser.parse_args(["import-antibiograms", "--dry-run"]).command == "import-antibiograms"
    assert (
        parser.parse_args(["import-synergy-antifungal", "--dry-run"]).command
        == "import-synergy-antifungal"
    )
    assert parser.parse_args(["import-stewardship", "--dry-run"]).command == "import-stewardship"
    assert parser.parse_args(["import-perioperative", "--dry-run"]).command == "import-perioperative"
    assert parser.parse_args(["import-all", "--dry-run"]).command == "import-all"


def test_icmr_payload_generation_defaults_to_pending_review() -> None:
    payload = load_ground_truth_json(
        Path("docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json")
    )

    rows = build_import_rows("import-icmr", payload)

    assert len(rows) == 25
    assert {row.table for row in rows} == {"icmr_guideline_rows"}
    assert rows[0].payload["review_status"] == "pending_review"
    assert rows[0].payload["reviewer_id"] is None
    assert rows[0].payload["reviewed_at"] is None
    assert rows[0].payload["clinical_condition"] == payload["icmr_guidelines"][0][
        "clinical_condition"
    ]
    assert rows[0].payload["source_quote"]
    assert rows[0].source_span.source_quote == rows[0].payload["source_quote"]


def test_import_all_payload_generation_covers_phase_2_tables() -> None:
    payload = load_ground_truth_json(
        Path("docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json")
    )

    rows = build_import_rows("import-all", payload)
    tables = {row.table for row in rows}

    assert "clinical_guide_documents" in tables
    assert "icmr_guideline_rows" in tables
    assert "duration_guideline_rows" in tables
    assert "antibiogram_sheets" in tables
    assert "antibiogram_pathogen_rows" in tables
    assert "antibiogram_risk_criteria" in tables
    assert "antibiogram_empiric_therapy" in tables
    assert "antibiogram_footnotes" in tables
    assert "synergy_testing_rows" in tables
    assert "antifungal_susceptibility_rows" in tables
    assert "stewardship_pearl_rows" in tables
    assert "antimicrobial_pearl_point_rows" in tables
    assert "perioperative_procedure_recommendations" in tables
    assert "perioperative_antibiotic_dosing" in tables
    assert "perioperative_notes" in tables
    assert all(row.payload["source_quote"] for row in rows)
    assert all(row.payload["review_status"] == "pending_review" for row in rows)


def test_payload_generation_preserves_clinical_text_values() -> None:
    payload = load_ground_truth_json(
        Path("docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json")
    )

    rows = build_import_rows("import-duration", payload)

    assert rows[0].payload["infection"] == payload["duration_of_treatment"][0]["infection"]
    assert rows[0].payload["duration"] == payload["duration_of_treatment"][0]["duration"]
    assert rows[0].payload["remarks"] == payload["duration_of_treatment"][0]["remarks"]


def test_dry_run_import_does_not_require_supabase_db_url(
    monkeypatch: pytest.MonkeyPatch,
    capsys,
) -> None:
    monkeypatch.delenv("SUPABASE_DB_URL", raising=False)

    exit_code = main(["import-duration", "--dry-run"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "dry_run: True" in captured.out
    assert "duration_guideline_rows: inserted=22, skipped=0" in captured.out


def test_real_import_requires_supabase_db_url(monkeypatch: pytest.MonkeyPatch, capsys) -> None:
    monkeypatch.delenv("SUPABASE_DB_URL", raising=False)

    exit_code = main(["import-duration"])

    captured = capsys.readouterr()
    assert exit_code == 1
    assert "Set SUPABASE_DB_URL" in captured.out


def test_approve_requires_reviewer_id(monkeypatch: pytest.MonkeyPatch, capsys) -> None:
    monkeypatch.delenv("CLINICAL_REVIEWER_ID", raising=False)

    exit_code = main(["import-duration", "--dry-run", "--approve"])

    captured = capsys.readouterr()
    assert exit_code == 1
    assert "CLINICAL_REVIEWER_ID is required" in captured.out


def test_approved_payload_generation_sets_reviewer_and_reviewed_at() -> None:
    payload = load_ground_truth_json(
        Path("docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json")
    )

    rows = build_import_rows(
        "import-duration",
        payload,
        approve=True,
        reviewer_id="reviewer-id",
    )

    assert rows
    assert all(row.payload["review_status"] == "approved" for row in rows)
    assert all(row.payload["reviewer_id"] == "reviewer-id" for row in rows)
    assert all(row.payload["reviewed_at"] is not None for row in rows)


def test_idempotency_identity_includes_source_quote() -> None:
    payload = load_ground_truth_json(
        Path("docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json")
    )
    row = build_import_rows("import-duration", payload)[0]

    where_sql, values = where_clause({**row.identity, "source_quote": row.payload["source_quote"]})

    assert "source_quote is not distinct from" in where_sql
    assert row.payload["source_quote"] in values
