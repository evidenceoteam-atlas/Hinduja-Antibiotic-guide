from importlib import import_module

import pytest

fastapi_testclient = pytest.importorskip("fastapi.testclient")
TestClient = fastapi_testclient.TestClient

SERVICES = [
    ("services.auth-service.app.main", "auth-service"),
    ("services.protocol-engine.app.main", "protocol-engine"),
    ("services.antibiogram-service.app.main", "antibiogram-service"),
    ("services.guideline-service.app.main", "guideline-service"),
    ("services.case-service.app.main", "case-service"),
    ("services.report-service.app.main", "report-service"),
    ("services.alert-service.app.main", "alert-service"),
    ("services.share-service.app.main", "share-service"),
    ("services.user-service.app.main", "user-service"),
]


def test_every_service_exposes_health_routes():
    for module_name, service_name in SERVICES:
        app = import_module(module_name).app
        client = TestClient(app)

        for path in ["/", "/health", "/api/v1/health"]:
            response = client.get(path)

            assert response.status_code == 200
            assert response.json() == {"status": "ok", "service": service_name}
