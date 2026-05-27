from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field


class RiskAnswer(BaseModel):
    key: str
    value: bool


class ProtocolEvaluationRequest(BaseModel):
    infection_code: str = Field(examples=["UTI"])
    setting: str = Field(pattern="^(ICU|Ward)$")
    acquisition: str = Field(pattern="^(Community-acquired|Hospital-acquired)$")
    risk_factors: list[RiskAnswer]
    patient_context: dict[str, Any] = Field(default_factory=dict)


class TherapyOption(BaseModel):
    rank: int
    antibiotic: str
    dose: str
    frequency: str
    duration: str
    coverage: list[str]
    escalation_note: str | None = None


class ProtocolEvaluationResult(BaseModel):
    case_id: str | None = None
    infection_code: str
    setting: str
    acquisition: str
    risk_score: int
    risk_type: str
    risk_label: str
    reasoning: list[str]
    recommended_therapy: list[TherapyOption]
    duration: str
    pathogen_coverage: list[str]
    id_consult_required: bool
    stewardship_alerts: list[str]
    fail_closed_reason: str | None = None


@dataclass(frozen=True)
class Threshold:
    min_score: int
    risk_type: str
    label: str


class JsonRuleEvaluator:
    """Legacy weighted protocol evaluator.

    Do not use this score/threshold classifier to select local antibiogram empiric
    therapy. Local antibiogram flows must use the exact ground-truth Type 1/2/3
    criteria in shared.clinical.antibiogram_risk.
    """

    def __init__(self, rules: dict[str, Any]) -> None:
        self.rules = rules
        self.weights: dict[str, int] = rules.get("risk_weights", {})
        self.thresholds = [
            Threshold(**item)
            for item in sorted(
                rules.get("thresholds", []), key=lambda item: item["min_score"], reverse=True
            )
        ]

    def evaluate(self, request: ProtocolEvaluationRequest) -> ProtocolEvaluationResult:
        score = 0
        reasoning: list[str] = []
        answers = {answer.key: answer.value for answer in request.risk_factors}

        for key, is_present in answers.items():
            if is_present:
                weight = self.weights.get(key, 0)
                score += weight
                reasoning.append(f"{key} present: +{weight}")
            else:
                reasoning.append(f"{key} absent: +0")

        score += self._contextual_weight("setting", request.setting, reasoning)
        score += self._contextual_weight("acquisition", request.acquisition, reasoning)

        threshold = self._classify(score)
        matrix = self.rules.get("recommendation_matrix", {})
        therapy_payload = (
            matrix.get(request.infection_code, {})
            .get(request.setting, {})
            .get(request.acquisition, {})
            .get(threshold.risk_type)
        )
        if therapy_payload is None or not self._is_approved_source_backed(therapy_payload):
            reasoning.append("no approved source-backed recommendation available")
            return ProtocolEvaluationResult(
                infection_code=request.infection_code,
                setting=request.setting,
                acquisition=request.acquisition,
                risk_score=score,
                risk_type=threshold.risk_type,
                risk_label=threshold.label,
                reasoning=reasoning,
                recommended_therapy=[],
                duration="not specified in source",
                pathogen_coverage=[],
                id_consult_required=False,
                stewardship_alerts=[],
                fail_closed_reason=(
                    "No approved recommendation available. Refer institutional guideline / "
                    "ID specialist."
                ),
            )

        alerts = self._alerts(threshold.risk_type, therapy_payload)
        return ProtocolEvaluationResult(
            infection_code=request.infection_code,
            setting=request.setting,
            acquisition=request.acquisition,
            risk_score=score,
            risk_type=threshold.risk_type,
            risk_label=threshold.label,
            reasoning=reasoning,
            recommended_therapy=[TherapyOption(**item) for item in therapy_payload["therapy"]],
            duration=therapy_payload["duration"],
            pathogen_coverage=therapy_payload["pathogen_coverage"],
            id_consult_required=threshold.risk_type == "Type 3"
            or bool(therapy_payload.get("id_consult_required")),
            stewardship_alerts=alerts,
        )

    def _contextual_weight(self, dimension: str, value: str, reasoning: list[str]) -> int:
        weight = self.rules.get("context_weights", {}).get(dimension, {}).get(value, 0)
        if weight:
            reasoning.append(f"{dimension}={value}: +{weight}")
        return weight

    def _classify(self, score: int) -> Threshold:
        for threshold in self.thresholds:
            if score >= threshold.min_score:
                return threshold
        return Threshold(min_score=0, risk_type="Type 1", label="Low Risk")

    def _alerts(self, risk_type: str, therapy_payload: dict[str, Any]) -> list[str]:
        alerts: list[str] = []
        for alert in therapy_payload.get("stewardship_alerts", []):
            alerts.append(str(alert))
        return alerts

    def _is_approved_source_backed(self, therapy_payload: dict[str, Any]) -> bool:
        if therapy_payload.get("review_status") != "approved":
            return False
        if not therapy_payload.get("source_reference"):
            return False
        for therapy in therapy_payload.get("therapy", []):
            if not therapy.get("source_reference"):
                return False
        return True
