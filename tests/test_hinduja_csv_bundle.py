from __future__ import annotations

import hashlib
import json
import shutil
from datetime import date
from pathlib import Path

import pytest

from scripts.clinical_ingest import extract_csv_text
from scripts.hinduja_csv import (
    BundleValidationError,
    build_candidate_dataset,
    parse_bundle,
    validate_bundle,
    validate_release_ready,
)

EXPECTED_PATH = Path("tests/fixtures/hinduja_csv/expected_source_records.json")


def records_of_type(record_type: str) -> list[dict]:
    return [
        record
        for parsed_file in parse_bundle()
        for record in parsed_file.records
        if record["record_type"] == record_type
    ]


def test_all_21_manifest_files_parse_to_the_golden_source_contract() -> None:
    expected = json.loads(EXPECTED_PATH.read_text())
    summary = validate_bundle()

    assert summary.files == expected["files"]
    assert summary.records == expected["records"]
    assert summary.record_sha256 == expected["record_sha256"]
    for name, value in expected["counts"].items():
        assert summary.counts[name] == value


def test_manifest_owns_every_csv_exactly_once() -> None:
    parsed = parse_bundle()
    filenames = [item.filename for item in parsed]

    assert len(filenames) == len(set(filenames)) == 21
    assert sorted(filenames) == sorted(path.name for path in Path("Hindujacsv").glob("*.csv"))
    assert {item.adapter for item in parsed} == {
        "risk",
        "icmr",
        "local_therapy",
        "perioperative",
        "stewardship_pearls",
        "ama_pearls",
    }


def test_all_48_scenario_slots_are_exact_and_blank_source_cells_stay_null() -> None:
    slots = records_of_type("antibiogram_therapy_slot")
    keys = [(row["infection_type"], row["location"], row["acquisition"], row["risk_type"]) for row in slots]

    assert len(keys) == len(set(keys)) == 48
    assert sum(row["therapy"] is None for row in slots) == 8
    assert sum(row["availability_status"] == "available" for row in slots) == 40
    assert not any("not enough data" in (row["therapy"] or "").lower() for row in slots)
    assert sum(left == right for left in keys for right in keys if left != right) == 0
    assert sum(left != right for left in keys for right in keys) == 48 * 47


def test_known_source_fidelity_defects_are_absent_from_candidate() -> None:
    expected = json.loads(EXPECTED_PATH.read_text())["critical_source_values"]
    candidate = build_candidate_dataset()

    diabetic = next(
        row
        for row in candidate["records"]["icmr_guideline"]
        if row["clinical_condition"] == "Diabetic Foot Infection"
    )
    assert diabetic["comments"] == expected["diabetic_foot_comment"]

    rti_type_3 = next(
        row
        for row in candidate["records"]["antibiogram_therapy_slot"]
        if row["sheet_key"] == "RTI.wards.hospital_acquired" and row["risk_type"] == "3"
    )
    assert rti_type_3["therapy"] == expected["rti_wards_ha_type_3"]

    iai_note = next(
        row
        for row in candidate["records"]["antibiogram_note"]
        if row["sheet_key"] == "IAI.wards.community_acquired"
    )
    assert iai_note["note"] == expected["iai_wards_ca_note"]

    vancomycin = next(
        row for row in candidate["records"]["perioperative_dosing"] if row["drug"] == "Vancomycin"
    )
    assert vancomycin["weight_based_dose"] == expected["vancomycin_weight_based_dose"]
    assert vancomycin["bolus_duration"] is None
    assert vancomycin["infusion_duration"] == "60 mins"


def test_icmr_conditions_are_never_runtime_inferred_into_treatment_categories() -> None:
    rows = records_of_type("icmr_guideline")

    assert len(rows) == 25
    assert {row["infection_code"] for row in rows} == {"unmapped"}
    assert {row["infection_code_review_status"] for row in rows} == {"pending_review"}


def test_icmr_remarks_are_carried_on_every_candidate_row() -> None:
    # A6: the adapter preserves Remarks for every ICMR row, so persistence can be
    # decoupled from Duration without inventing data.
    rows = records_of_type("icmr_guideline")

    assert len(rows) == 25
    assert all("remarks" in row for row in rows)
    cap = next(row for row in rows if row["clinical_condition"].startswith("CAP"))
    assert cap["remarks"] is not None
    assert "afebrile" in cap["remarks"]


def test_pearl_sections_and_continuations_are_preserved() -> None:
    stewardship = records_of_type("stewardship_pearl")
    ama = records_of_type("ama_pearl")

    assert len(stewardship) == 40
    assert len(ama) == 24
    assert {row["section_name"] for row in stewardship} == {
        "GENERAL",
        "BLOOD STREAM",
        "URINARY TRACT",
        "RESPIRATORY",
        "INTRA-ABDOMINAL",
        "CARDIOVASCULAR",
        "BONE & JOINT INFECTIONS",
        "SURGICAL PROPHYLAXIS",
        "MENINGITIS",
    }
    assert {row["section_name"] for row in ama} == {
        "ANTIFUNGALS",
        "ANTIVIRALS",
        "ANTIMALARIALS",
        "ANTITUBERCULAR",
        "ANTIPARASITES",
    }
    assert all(row["section_name"] != "•" for row in stewardship + ama)
    assert any(
        row["source_locator"]["row_end"] > row["source_locator"]["row_start"] for row in stewardship + ama
    )


def test_count_preserving_source_mutation_fails_hash_validation(tmp_path: Path) -> None:
    source_root = tmp_path / "Hindujacsv"
    shutil.copytree("Hindujacsv", source_root)
    target = source_root / "03_BSI_ICU_CA.csv"
    original = target.read_text()
    target.write_text(original.replace("Cefoperazone", "Xefoperazone", 1))

    with pytest.raises(BundleValidationError, match="SHA-256 mismatch"):
        validate_bundle(source_root=source_root)


@pytest.mark.parametrize(
    ("filename", "old", "new"),
    [
        ("03_BSI_ICU_CA.csv", "Cefoperazone", "Xefoperazone"),
        ("03_BSI_ICU_CA.csv", "COMMUNITY ACQUIRED", "HOSPITAL ACQUIRED"),
        (
            "02_ICMR_guidelines.csv",
            "Surgical source control where possible.",
            "Surgical source control where feasible.",
        ),
        ("20_Pearls.csv", "BLOOD STREAM", "BLOODSTREAM"),
    ],
)
def test_count_preserving_mutations_fail_even_if_per_file_manifest_hash_is_rewritten(
    tmp_path: Path,
    filename: str,
    old: str,
    new: str,
) -> None:
    source_root = tmp_path / "Hindujacsv"
    shutil.copytree("Hindujacsv", source_root)
    manifest = json.loads(Path("docs/ground_truth/hinduja_csv_manifest.json").read_text())
    target = source_root / filename
    mutated = target.read_text().replace(old, new, 1)
    assert mutated != target.read_text()
    target.write_text(mutated)
    entry = next(item for item in manifest["files"] if item["filename"] == filename)
    entry["byte_size"] = len(target.read_bytes())
    entry["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))

    with pytest.raises(BundleValidationError, match="Canonical record SHA-256 mismatch"):
        validate_bundle(source_root=source_root, manifest_path=manifest_path)


def test_every_source_value_hash_and_locator_recompute() -> None:
    for parsed_file in parse_bundle():
        for record in parsed_file.records:
            exact = "\n".join(record["source_values"]).encode()
            assert hashlib.sha256(exact).hexdigest() == record["source_value_sha256"]
            assert record["source_file_sha256"] == parsed_file.file_sha256
            assert record["source_locator"]["row_start"] >= 1
            assert record["source_locator"]["row_end"] >= record["source_locator"]["row_start"]


def test_release_activation_fails_closed_for_expiry_and_unsigned_adjudications() -> None:
    with pytest.raises(BundleValidationError) as exc_info:
        validate_release_ready(as_of=date(2026, 6, 19))

    message = str(exc_info.value)
    assert "expired on 2025-12-31" in message
    assert "CSV06-ACQUISITION-001" in message
    assert "non-CSV source assets are not verified" in message


def test_future_date_cannot_bypass_missing_source_assets_or_reviewer_evidence(tmp_path: Path) -> None:
    ledger = json.loads(Path("docs/ground_truth/corrections.reviewed.json").read_text())
    ledger["dataset_release"].update(
        {
            "status": "approved",
            "valid_through": "2099-12-31",
            "reviewer_id": "reviewer",
            "reviewed_at": "2026-06-19T00:00:00Z",
        }
    )
    for correction in ledger["corrections"]:
        correction.update(
            {"review_status": "approved", "reviewer_id": "reviewer", "reviewed_at": "2026-06-19T00:00:00Z"}
        )
    corrections_path = tmp_path / "corrections.json"
    corrections_path.write_text(json.dumps(ledger))

    with pytest.raises(BundleValidationError, match="non-CSV source assets are not verified"):
        validate_release_ready(corrections_path=corrections_path, as_of=date(2026, 6, 19))


@pytest.mark.parametrize(
    "filename",
    [path.name for path in sorted(Path("Hindujacsv").glob("*.csv"))],
)
def test_generic_csv_ingestion_rejects_the_sectioned_hinduja_sources(filename: str) -> None:
    with pytest.raises(ValueError, match="schema-aware adapter"):
        extract_csv_text(Path("Hindujacsv") / filename)
