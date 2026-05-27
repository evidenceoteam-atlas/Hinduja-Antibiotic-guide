from collections.abc import Mapping
from dataclasses import dataclass

RISK_TYPE_1 = "Type 1"
RISK_TYPE_2 = "Type 2"
RISK_TYPE_3 = "Type 3"
MANUAL_REVIEW = "manual_review"

DEFINITION = "Definition"
HOSPITAL_CONTACT = "Hospital contact"
ANTIBIOTIC_EXPOSURE = "Antibiotic exposure"
CO_MORBIDITIES = "Co-morbidities"

GROUND_TRUTH_RISK_CRITERIA: dict[str, dict[str, str]] = {
    DEFINITION: {
        "1": "Meeting ALL criteria below",
        "2": "Meeting ANY ONE of criteria below",
        "3": "Meeting ANY ONE of criteria below",
    },
    HOSPITAL_CONTACT: {
        "1": "No contact with hospital in last 90 days",
        "2": "Contact with hospital in last 90 days WITHOUT invasive procedure/devices",
        "3": "Hospitalisation in last 90 days WITH invasive procedure/devices",
    },
    ANTIBIOTIC_EXPOSURE: {
        "1": "No antibiotics in last 90 days",
        "2": "Antibiotic therapy (oral/parenteral) in last 90 days",
        "3": "MORE THAN 2 antibiotics (oral/parenteral) in last 90 days",
    },
    CO_MORBIDITIES: {
        "1": "No co-morbid conditions",
        "2": "Patient with 2 or less co-morbidities",
        "3": "Greater than 2 co-morbidities (e.g. DM, HT, COPD) or Immunodeficiency",
    },
}

PATIENT_CRITERION_LABELS = (HOSPITAL_CONTACT, ANTIBIOTIC_EXPOSURE, CO_MORBIDITIES)


@dataclass(frozen=True)
class AntibiogramRiskClassification:
    risk_type: str | None
    status: str
    matched_criteria: dict[str, str]
    missing_criteria: list[str]


def classify_antibiogram_risk(
    selected_criteria: Mapping[str, str | None],
    risk_criteria: Mapping[str, Mapping[str, str]] = GROUND_TRUTH_RISK_CRITERIA,
) -> AntibiogramRiskClassification:
    """Classify local antibiogram risk using exact reviewed guide criteria.

    This classifier is intentionally separate from legacy weighted protocol scoring.
    It should be used before selecting local antibiogram empiric therapy.
    """

    normalized = {
        criterion_name: (selected_criteria.get(criterion_name) or "").strip()
        for criterion_name in PATIENT_CRITERION_LABELS
    }

    type_3_matches = exact_matches(normalized, risk_criteria, "3")
    if type_3_matches:
        return AntibiogramRiskClassification(
            risk_type=RISK_TYPE_3,
            status="classified",
            matched_criteria=type_3_matches,
            missing_criteria=[],
        )

    type_2_matches = exact_matches(normalized, risk_criteria, "2")
    if type_2_matches:
        return AntibiogramRiskClassification(
            risk_type=RISK_TYPE_2,
            status="classified",
            matched_criteria=type_2_matches,
            missing_criteria=[],
        )

    missing = [
        criterion_name
        for criterion_name, selected_value in normalized.items()
        if not selected_value
    ]
    type_1_matches = exact_matches(normalized, risk_criteria, "1")
    if not missing and len(type_1_matches) == len(PATIENT_CRITERION_LABELS):
        return AntibiogramRiskClassification(
            risk_type=RISK_TYPE_1,
            status="classified",
            matched_criteria=type_1_matches,
            missing_criteria=[],
        )

    return AntibiogramRiskClassification(
        risk_type=None,
        status=f"insufficient/{MANUAL_REVIEW}",
        matched_criteria=type_1_matches,
        missing_criteria=missing,
    )


def exact_matches(
    selected_criteria: Mapping[str, str],
    risk_criteria: Mapping[str, Mapping[str, str]],
    type_key: str,
) -> dict[str, str]:
    matches = {}
    for criterion_name in PATIENT_CRITERION_LABELS:
        expected_value = risk_criteria.get(criterion_name, {}).get(type_key)
        selected_value = selected_criteria.get(criterion_name)
        if expected_value and selected_value == expected_value:
            matches[criterion_name] = selected_value
    return matches
