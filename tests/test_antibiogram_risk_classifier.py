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


def criteria_for(type_key: str) -> dict[str, str]:
    return {
        HOSPITAL_CONTACT: GROUND_TRUTH_RISK_CRITERIA[HOSPITAL_CONTACT][type_key],
        ANTIBIOTIC_EXPOSURE: GROUND_TRUTH_RISK_CRITERIA[ANTIBIOTIC_EXPOSURE][type_key],
        CO_MORBIDITIES: GROUND_TRUTH_RISK_CRITERIA[CO_MORBIDITIES][type_key],
    }


def test_classifies_type_3_if_any_type_3_criterion_matches() -> None:
    selected = criteria_for("1")
    selected[ANTIBIOTIC_EXPOSURE] = GROUND_TRUTH_RISK_CRITERIA[ANTIBIOTIC_EXPOSURE]["3"]

    result = classify_antibiogram_risk(selected)

    assert result.risk_type == RISK_TYPE_3
    assert result.status == "classified"
    assert result.matched_criteria == {
        ANTIBIOTIC_EXPOSURE: "MORE THAN 2 antibiotics (oral/ parenteral) in last 90 days"
    }


def test_classifies_type_2_if_no_type_3_and_any_type_2_criterion_matches() -> None:
    selected = criteria_for("1")
    selected[HOSPITAL_CONTACT] = GROUND_TRUTH_RISK_CRITERIA[HOSPITAL_CONTACT]["2"]

    result = classify_antibiogram_risk(selected)

    assert result.risk_type == RISK_TYPE_2
    assert result.status == "classified"
    assert result.matched_criteria == {
        HOSPITAL_CONTACT: "Contact with hospital in last 90 days WITHOUT invasive procedure/devices"
    }


def test_classifies_type_1_only_when_all_type_1_criteria_match() -> None:
    result = classify_antibiogram_risk(criteria_for("1"))

    assert result.risk_type == RISK_TYPE_1
    assert result.status == "classified"
    assert result.matched_criteria == criteria_for("1")


def test_returns_insufficient_manual_review_when_criteria_are_incomplete() -> None:
    selected = {
        HOSPITAL_CONTACT: GROUND_TRUTH_RISK_CRITERIA[HOSPITAL_CONTACT]["1"],
        ANTIBIOTIC_EXPOSURE: None,
        CO_MORBIDITIES: GROUND_TRUTH_RISK_CRITERIA[CO_MORBIDITIES]["1"],
    }

    result = classify_antibiogram_risk(selected)

    assert result.risk_type is None
    assert result.status == "insufficient/manual_review"
    assert result.missing_criteria == [ANTIBIOTIC_EXPOSURE]


def test_partial_type_2_and_type_3_inputs_fail_closed_before_precedence() -> None:
    for type_key in ("2", "3"):
        selected = {
            HOSPITAL_CONTACT: GROUND_TRUTH_RISK_CRITERIA[HOSPITAL_CONTACT][type_key],
            ANTIBIOTIC_EXPOSURE: None,
            CO_MORBIDITIES: None,
        }

        result = classify_antibiogram_risk(selected)

        assert result.risk_type is None
        assert result.status == "insufficient/manual_review"
        assert result.missing_criteria == [ANTIBIOTIC_EXPOSURE, CO_MORBIDITIES]


def test_unknown_or_whitespace_variant_criterion_fails_closed() -> None:
    selected = criteria_for("1")
    selected[HOSPITAL_CONTACT] = f" {selected[HOSPITAL_CONTACT]} "
    selected[ANTIBIOTIC_EXPOSURE] = "unknown source value"

    result = classify_antibiogram_risk(selected)

    assert result.risk_type is None
    assert result.status == "insufficient/manual_review"
    assert result.invalid_criteria == [ANTIBIOTIC_EXPOSURE]


def test_ground_truth_constants_match_parsed_csv_source() -> None:
    # A7: the hardcoded GROUND_TRUTH defaults must be byte-identical to the parsed
    # CSV 01 cells, so the constant is a faithful mirror of source (not a paraphrase)
    # and the classifier's exact-equality contract is validated against real bytes.
    from pathlib import Path

    from scripts.hinduja_csv.adapters import parse_risk

    parsed = parse_risk(Path("Hindujacsv/01_Patient_Risk_Stratification.csv"))
    by_name = {record["criterion_name"]: record["values"] for record in parsed.records}

    assert set(by_name) == set(GROUND_TRUTH_RISK_CRITERIA)
    for criterion_name, type_values in GROUND_TRUTH_RISK_CRITERIA.items():
        for type_key, value in type_values.items():
            assert value == by_name[criterion_name][type_key], (criterion_name, type_key, value)
