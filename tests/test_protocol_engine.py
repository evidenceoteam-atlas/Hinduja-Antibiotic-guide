import json
from pathlib import Path

from shared.clinical.rules import JsonRuleEvaluator, ProtocolEvaluationRequest, RiskAnswer


def test_reference_screen_risk_assessment_fails_closed_without_source_backing():
    rules = json.loads(Path("rules/hinduja_protocols.json").read_text())
    request = ProtocolEvaluationRequest(
        infection_code="UTI",
        setting="ICU",
        acquisition="Community-acquired",
        risk_factors=[
            RiskAnswer(key="hospital_contact_90d", value=False),
            RiskAnswer(key="recent_antibiotics_90d", value=True),
            RiskAnswer(key="invasive_device_or_procedure_90d", value=False),
            RiskAnswer(key="more_than_two_antibiotics_90d", value=False),
            RiskAnswer(key="comorbidities_or_immunodeficiency", value=False),
        ],
    )

    result = JsonRuleEvaluator(rules).evaluate(request)

    assert result.risk_type == "Type 2"
    assert result.risk_label == "Medium Risk"
    assert result.recommended_therapy == []
    assert result.pathogen_coverage == []
    assert (
        result.fail_closed_reason
        == "No approved recommendation available. Refer institutional guideline / ID specialist."
    )


def test_type_3_does_not_generate_stewardship_alert_without_approved_source():
    rules = json.loads(Path("rules/hinduja_protocols.json").read_text())
    request = ProtocolEvaluationRequest(
        infection_code="UTI",
        setting="ICU",
        acquisition="Hospital-acquired",
        risk_factors=[
            RiskAnswer(key="hospital_contact_90d", value=True),
            RiskAnswer(key="recent_antibiotics_90d", value=True),
            RiskAnswer(key="invasive_device_or_procedure_90d", value=True),
            RiskAnswer(key="comorbidities_or_immunodeficiency", value=True),
        ],
    )

    result = JsonRuleEvaluator(rules).evaluate(request)

    assert result.risk_type == "Type 3"
    assert result.id_consult_required is False
    assert result.stewardship_alerts == []
    assert result.fail_closed_reason
