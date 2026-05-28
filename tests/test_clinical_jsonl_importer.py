import json
from pathlib import Path

import httpx
import pytest

from scripts.import_clinical_jsonl_to_supabase import (
    SupabaseRestConfig,
    import_jsonl_via_rest,
    load_jsonl,
    rest_config_from_env,
)


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("\n".join(json.dumps(row) for row in rows) + "\n")


def draft_jsonl_rows() -> list[dict]:
    return [
        {
            "type": "source_file",
            "data": {
                "filename": "guide.pdf",
                "original_path": "/tmp/guide.pdf",
                "file_sha256": "abc",
                "mime_type": "application/pdf",
            },
        },
        {
            "type": "draft_recommendation",
            "data": {
                "syndrome": "UTI",
                "infection_site": "Urinary Tract Infection (UTI)",
                "setting": None,
                "acquisition": None,
                "risk_type": None,
                "severity_category": None,
                "organism": None,
                "pathogen": None,
                "drug": "Ceftriaxone",
                "dose": "1g",
                "route": "IV",
                "frequency": "q12h",
                "duration": None,
                "renal_adjustment": None,
                "hepatic_adjustment": None,
                "pregnancy_lactation_caution": None,
                "allergy_warning": None,
                "contraindication": None,
                "stewardship_note": None,
                "id_consult_trigger": None,
                "review_status": "pending_review",
                "source_span": {
                    "source_file_sha256": "abc",
                    "page_number": 1,
                    "section_heading": "UTI",
                    "span_start": 0,
                    "span_end": 10,
                    "quote": "Source quote.",
                    "extracted_at": "2026-05-16T00:00:00+00:00",
                },
            },
        },
    ]


def test_importer_loads_source_file_and_pending_recommendations(tmp_path: Path) -> None:
    jsonl_path = tmp_path / "draft.jsonl"
    write_jsonl(jsonl_path, draft_jsonl_rows())

    source_file, recommendations = load_jsonl(jsonl_path)

    assert source_file["file_sha256"] == "abc"
    assert len(recommendations) == 1
    assert recommendations[0]["review_status"] == "pending_review"


def test_importer_rejects_approved_recommendations(tmp_path: Path) -> None:
    jsonl_path = tmp_path / "approved.jsonl"
    write_jsonl(
        jsonl_path,
        [
            {
                "type": "source_file",
                "data": {
                    "filename": "guide.pdf",
                    "original_path": "/tmp/guide.pdf",
                    "file_sha256": "abc",
                    "mime_type": "application/pdf",
                },
            },
            {
                "type": "draft_recommendation",
                "data": {
                    "review_status": "approved",
                    "source_span": {
                        "source_file_sha256": "abc",
                        "page_number": 1,
                        "section_heading": "UTI",
                        "span_start": 0,
                        "span_end": 10,
                        "quote": "Source quote.",
                        "extracted_at": "2026-05-16T00:00:00+00:00",
                    },
                },
            },
        ],
    )

    with pytest.raises(ValueError, match="pending_review"):
        load_jsonl(jsonl_path)


def test_importer_rejects_empty_structured_recommendations(tmp_path: Path) -> None:
    jsonl_path = tmp_path / "empty.jsonl"
    rows = draft_jsonl_rows()
    rows[1]["data"].update(
        {
            "syndrome": None,
            "infection_site": None,
            "drug": None,
            "dose": None,
            "route": None,
            "frequency": None,
        }
    )
    write_jsonl(jsonl_path, rows)

    with pytest.raises(ValueError, match="structured clinical fields"):
        load_jsonl(jsonl_path)


@pytest.mark.asyncio
async def test_rest_import_path_inserts_pending_rows_and_checks_approved_view(
    tmp_path: Path,
) -> None:
    jsonl_path = tmp_path / "draft.jsonl"
    write_jsonl(jsonl_path, draft_jsonl_rows())
    calls: list[tuple[str, str, dict]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode() or "{}") if request.content else {}
        path = request.url.path.removeprefix("/rest/v1/")
        calls.append((request.method, path, payload))

        if request.method == "GET":
            return httpx.Response(200, json=[])

        if path == "clinical_source_files":
            assert payload["file_sha256"] == "abc"
            return httpx.Response(201, json=[{"id": "source-file-id"}])

        if path == "clinical_source_spans":
            assert payload["source_file_id"] == "source-file-id"
            assert payload["quote"] == "Source quote."
            return httpx.Response(201, json=[{"id": "source-span-id"}])

        if path == "clinical_recommendations":
            assert payload["source_span_id"] == "source-span-id"
            assert payload["review_status"] == "pending_review"
            return httpx.Response(201, json=[{"id": "recommendation-id"}])

        return httpx.Response(404, json={"message": "unexpected path"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        base_url="https://example.supabase.co/rest/v1",
        headers=SupabaseRestConfig("https://example.supabase.co", "service-role").headers,
        transport=transport,
    ) as client:
        counts = await import_jsonl_via_rest(
            SupabaseRestConfig("https://example.supabase.co", "service-role"),
            jsonl_path,
            client=client,
        )

    assert counts.source_files_inserted == 1
    assert counts.source_spans_inserted == 1
    assert counts.recommendations_inserted == 1
    assert counts.approved_view_rows == 0
    assert ("GET", "approved_clinical_recommendations_with_source", {}) in calls


@pytest.mark.asyncio
async def test_rest_import_path_skips_existing_rows(tmp_path: Path) -> None:
    jsonl_path = tmp_path / "draft.jsonl"
    write_jsonl(jsonl_path, draft_jsonl_rows())
    post_calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path.removeprefix("/rest/v1/")

        if request.method == "POST":
            post_calls.append(path)

        if path == "clinical_source_files":
            return httpx.Response(200, json=[{"id": "source-file-id"}])
        if path == "clinical_source_spans":
            return httpx.Response(200, json=[{"id": "source-span-id"}])
        if path == "clinical_recommendations":
            return httpx.Response(200, json=[{"id": "recommendation-id"}])
        if path == "approved_clinical_recommendations_with_source":
            return httpx.Response(200, json=[])

        return httpx.Response(404, json={"message": "unexpected path"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        base_url="https://example.supabase.co/rest/v1",
        headers=SupabaseRestConfig("https://example.supabase.co", "service-role").headers,
        transport=transport,
    ) as client:
        counts = await import_jsonl_via_rest(
            SupabaseRestConfig("https://example.supabase.co", "service-role"),
            jsonl_path,
            client=client,
        )

    assert counts.source_files_skipped == 1
    assert counts.source_spans_skipped == 1
    assert counts.recommendations_skipped == 1
    assert post_calls == []


def test_rest_config_requires_service_role_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)

    with pytest.raises(RuntimeError, match="Do not use anon key"):
        rest_config_from_env()


def test_rest_config_rejects_service_role_equal_to_anon(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "same-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "same-key")

    with pytest.raises(RuntimeError, match="Do not use anon key"):
        rest_config_from_env()
