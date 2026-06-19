import json
from pathlib import Path


def test_weighted_protocol_runtime_is_retired() -> None:
    service = Path("services/protocol-engine/app/main.py").read_text()
    retired_rules = json.loads(Path("rules/hinduja_protocols.json").read_text())

    assert "JsonRuleEvaluator" not in service
    assert "Protocol evaluated successfully" not in service
    assert "HTTP_410_GONE" in service
    assert retired_rules == {
        "status": "retired",
        "retired_on": "2026-06-19",
        "reason": "Weighted risk scoring contradicted the source criteria and had no recommendation matrix.",
        "replacement": "approved_current_protocol_scenarios_with_source",
    }


def test_legacy_result_endpoint_cannot_report_dummy_availability() -> None:
    service = Path("services/protocol-engine/app/main.py").read_text()

    assert '"status": "available"' not in service
    assert "Legacy protocol result" in service
