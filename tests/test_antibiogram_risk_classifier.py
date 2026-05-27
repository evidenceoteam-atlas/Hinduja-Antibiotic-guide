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
        ANTIBIOTIC_EXPOSURE: "MORE THAN 2 antibiotics (oral/parenteral) in last 90 days"
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
