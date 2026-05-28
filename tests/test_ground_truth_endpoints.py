from importlib import import_module
from typing import Any

import pytest

fastapi_testclient = pytest.importorskip("fastapi.testclient")
TestClient = fastapi_testclient.TestClient


class FakeGroundTruthRepository:
    def __init__(self, data: dict[str, Any] | None = None):
        self.data = data or {}

    async def icmr_guidelines(self):
        return self.data.get("icmr_guidelines", [])

    async def icmr_guideline(self, clinical_condition: str):
        return self.data.get("icmr_guideline")

    async def durations(self):
        return self.data.get("durations", [])

    async def antibiograms(self, infection_type: str | None = None):
        return self.data.get("antibiograms", [])

    async def stewardship_pearls(self):
        return self.data.get("stewardship_pearls", [])

    async def pearl_points(self):
        return self.data.get("pearl_points", [])

    async def synergy_testing(self):
        return self.data.get("synergy_testing", [])

    async def antifungal_susceptibility(self):
        return self.data.get("antifungal_susceptibility", [])

    async def synergy_antifungal_notes(self):
        return self.data.get("synergy_antifungal_notes", [])

    async def guide_metadata(self):
        return self.data.get("guide_metadata")

    async def perioperative(self):
        return self.data.get("perioperative", {})


@pytest.fixture()
def guideline_module():
    module = import_module("services.guideline-service.app.main")
    module.app.dependency_overrides.clear()
    yield module
    module.app.dependency_overrides.clear()


@pytest.fixture()
def antibiogram_module():
    module = import_module("services.antibiogram-service.app.main")
    module.app.dependency_overrides.clear()
    yield module
    module.app.dependency_overrides.clear()


def test_icmr_guidelines_endpoint_reads_mocked_approved_data(guideline_module):
    async def override_repository():
        return FakeGroundTruthRepository(
            {"icmr_guidelines": [{"clinical_condition": "CAP", "source_quote": "{\"CAP\": true}"}]}
        )

    guideline_module.app.dependency_overrides[
        guideline_module.get_ground_truth_repository
    ] = override_repository

    response = TestClient(guideline_module.app).get("/api/v1/icmr-guidelines")

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Approved ICMR guidelines loaded"
    assert body["data"] == [{"clinical_condition": "CAP", "source_quote": "{\"CAP\": true}"}]


def test_icmr_guideline_detail_fails_closed_when_absent(guideline_module):
    async def override_repository():
        return FakeGroundTruthRepository()

    guideline_module.app.dependency_overrides[
        guideline_module.get_ground_truth_repository
    ] = override_repository

    response = TestClient(guideline_module.app).get("/api/v1/icmr-guidelines/CAP")

    assert response.status_code == 200
    body = response.json()
    assert body["data"] is None
    assert "No approved source-backed ground-truth data available" in body["message"]


def test_guideline_service_exposes_all_ground_truth_section_endpoints(guideline_module):
    async def override_repository():
        return FakeGroundTruthRepository(
            {
                "durations": [{"infection": "CAP", "source_quote": "{}"}],
                "antibiograms": [{"infection_type": "UTI", "source_quote": "{}"}],
                "stewardship_pearls": [{"pearl_text": "Send blood cultures", "source_quote": "{}"}],
                "perioperative": {
                    "procedure_recommendations": [{"procedure": "Clean surgeries"}],
                    "antibiotic_dosing": [],
                    "notes": [],
                },
            }
        )

    guideline_module.app.dependency_overrides[
        guideline_module.get_ground_truth_repository
    ] = override_repository
    client = TestClient(guideline_module.app)

    assert client.get("/api/v1/durations").json()["data"][0]["infection"] == "CAP"
    assert client.get("/api/v1/antibiograms").json()["data"][0]["infection_type"] == "UTI"
    assert (
        client.get("/api/v1/antibiograms/UTI").json()["meta"]["infection_type"] == "UTI"
    )
    assert (
        client.get("/api/v1/stewardship-pearls").json()["data"][0]["pearl_text"]
        == "Send blood cultures"
    )
    assert (
        client.get("/api/v1/perioperative").json()["data"]["procedure_recommendations"][0][
            "procedure"
        ]
        == "Clean surgeries"
    )


def test_antibiogram_service_exposes_database_backed_antibiograms(antibiogram_module):
    async def override_repository():
        return FakeGroundTruthRepository(
            {"antibiograms": [{"infection_type": "BSI", "sheet_key": "BSI.ICU.community_acquired"}]}
        )

    antibiogram_module.app.dependency_overrides[
        antibiogram_module.get_ground_truth_repository
    ] = override_repository

    response = TestClient(antibiogram_module.app).get("/api/v1/antibiograms/BSI")

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == [{"infection_type": "BSI", "sheet_key": "BSI.ICU.community_acquired"}]
    assert body["meta"] == {"infection_type": "BSI"}


def test_guideline_service_exposes_new_section_endpoints(guideline_module):
    async def override_repository():
        return FakeGroundTruthRepository(
            {
                "pearl_points": [{"pearl_text": "Lipophilic antibiotics", "source_quote": "{}"}],
                "synergy_testing": [{"organism": "E. coli", "source_quote": "{}"}],
                "antifungal_susceptibility": [
                    {"organism_group": "aspergillus", "species": "A. flavus", "drug": "Voriconazole"}
                ],
                "synergy_antifungal_notes": [
                    {"note_text": "EUCAST-AFST", "sort_order": 0, "source_quote": "{}"}
                ],
                "guide_metadata": {
                    "source_document": "Hinduja Antibiotic Protocol Pocket Guide",
                    "surveillance_period": "January 2021 – December 2023",
                    "valid_till": "December 2025",
                },
            }
        )

    guideline_module.app.dependency_overrides[
        guideline_module.get_ground_truth_repository
    ] = override_repository
    client = TestClient(guideline_module.app)

    assert (
        client.get("/api/v1/pearl-points").json()["data"][0]["pearl_text"]
        == "Lipophilic antibiotics"
    )
    assert client.get("/api/v1/synergy-testing").json()["data"][0]["organism"] == "E. coli"
    assert (
        client.get("/api/v1/antifungal-susceptibility").json()["data"][0]["species"]
        == "A. flavus"
    )
    assert (
        client.get("/api/v1/synergy-antifungal-notes").json()["data"][0]["note_text"]
        == "EUCAST-AFST"
    )
    assert (
        client.get("/api/v1/guide-metadata").json()["data"]["valid_till"]
        == "December 2025"
    )


def test_ground_truth_repository_queries_only_approved_views():
    source = import_module("shared.clinical.ground_truth")
    module_text = source.__loader__.get_source(source.__name__)

    assert "rules/hinduja_protocols.json" not in module_text
    assert "approved_icmr_guideline_rows_with_source" in module_text
    assert "approved_duration_guideline_rows_with_source" in module_text
    assert "approved_antibiogram_sheets_with_source" in module_text
    assert "approved_stewardship_pearl_rows_with_source" in module_text
    assert "approved_antimicrobial_pearl_point_rows_with_source" in module_text
    assert "approved_synergy_testing_rows_with_source" in module_text
    assert "approved_antifungal_susceptibility_rows_with_source" in module_text
    assert "approved_synergy_antifungal_notes_with_source" in module_text
    assert "approved_clinical_guide_documents_with_source" in module_text
    assert "approved_perioperative_procedure_recommendations_with_source" in module_text
    assert "from public.icmr_guideline_rows" not in module_text
    assert "from public.duration_guideline_rows" not in module_text
    assert "from public.antibiogram_sheets" not in module_text
    assert "from public.stewardship_pearl_rows" not in module_text
