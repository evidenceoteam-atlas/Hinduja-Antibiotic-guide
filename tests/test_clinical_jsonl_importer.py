import json
from pathlib import Path

import pytest

from scripts.import_clinical_jsonl_to_supabase import load_jsonl


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("\n".join(json.dumps(row) for row in rows) + "\n")


def test_importer_loads_source_file_and_pending_recommendations(tmp_path: Path) -> None:
    jsonl_path = tmp_path / "draft.jsonl"
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
        ],
    )

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
