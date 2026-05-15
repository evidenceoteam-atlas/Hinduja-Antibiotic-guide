import json
from pathlib import Path

from shared.clinical.rules import JsonRuleEvaluator, ProtocolEvaluationRequest, RiskAnswer


def test_reference_screen_risk_assessment_produces_type_2_recommendation():
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
    assert result.recommended_therapy[0].antibiotic == "Cefoperazone-Sulbactam"
    assert result.pathogen_coverage == ["E. coli", "Klebsiella spp.", "Proteus spp.", "Others"]


def test_type_3_triggers_stewardship_alert():
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
    assert result.id_consult_required is True
    assert result.stewardship_alerts
