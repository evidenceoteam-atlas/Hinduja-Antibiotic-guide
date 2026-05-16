"""Import source-linked draft clinical recommendations into Supabase Postgres.

This importer is intentionally conservative:
- every recommendation must have a source span
- rows remain pending_review
- existing source files, spans, and recommendations are skipped
- approved doctor-facing view is checked after import
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import asyncpg


CLINICAL_FIELDS = [
    "syndrome",
    "infection_site",
    "setting",
    "acquisition",
    "risk_type",
    "severity_category",
    "organism",
    "pathogen",
    "drug",
    "dose",
    "route",
    "frequency",
    "duration",
    "renal_adjustment",
    "hepatic_adjustment",
    "pregnancy_lactation_caution",
    "allergy_warning",
    "contraindication",
    "stewardship_note",
    "id_consult_trigger",
]


@dataclass
class ImportCounts:
    source_files_inserted: int = 0
    source_files_skipped: int = 0
    source_spans_inserted: int = 0
    source_spans_skipped: int = 0
    recommendations_inserted: int = 0
    recommendations_skipped: int = 0
    approved_view_rows: int = 0


def load_jsonl(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    source_file: dict[str, Any] | None = None
    recommendations: list[dict[str, Any]] = []

    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue

            payload = json.loads(line)
            row_type = payload.get("type")
            data = payload.get("data")

            if row_type == "source_file":
                if source_file is not None:
                    raise ValueError("JSONL contains more than one source_file row")
                source_file = data
            elif row_type == "draft_recommendation":
                validate_recommendation(data, line_number)
                recommendations.append(data)
            else:
                raise ValueError(f"Unsupported JSONL row type on line {line_number}: {row_type}")

    if source_file is None:
        raise ValueError("JSONL is missing a source_file row")
    if not recommendations:
        raise ValueError("JSONL does not contain draft recommendations")

    return source_file, recommendations


def validate_recommendation(data: dict[str, Any], line_number: int) -> None:
    if data.get("review_status") != "pending_review":
        raise ValueError(f"line {line_number}: imported recommendations must stay pending_review")
    if not data.get("source_span"):
        raise ValueError(f"line {line_number}: recommendation is missing source_span")
    if not data["source_span"].get("quote"):
        raise ValueError(f"line {line_number}: source_span.quote is required")


async def get_or_insert_source_file(
    conn: asyncpg.Connection,
    source_file: dict[str, Any],
    counts: ImportCounts,
) -> Any:
    existing_id = await conn.fetchval(
        """
        select id
        from public.clinical_source_files
        where file_sha256 = $1
        """,
        source_file["file_sha256"],
    )
    if existing_id:
        counts.source_files_skipped += 1
        return existing_id

    inserted_id = await conn.fetchval(
        """
        insert into public.clinical_source_files (
          filename,
          original_path,
          file_sha256,
          mime_type
        )
        values ($1, $2, $3, $4)
        returning id
        """,
        source_file["filename"],
        source_file.get("original_path"),
        source_file["file_sha256"],
        source_file.get("mime_type"),
    )
    counts.source_files_inserted += 1
    return inserted_id


async def get_or_insert_source_span(
    conn: asyncpg.Connection,
    source_file_id: Any,
    span: dict[str, Any],
    counts: ImportCounts,
) -> Any:
    existing_id = await conn.fetchval(
        """
        select id
        from public.clinical_source_spans
        where source_file_id = $1
          and page_number is not distinct from $2
          and span_start is not distinct from $3
          and span_end is not distinct from $4
        """,
        source_file_id,
        span.get("page_number"),
        span["span_start"],
        span["span_end"],
    )
    if existing_id:
        counts.source_spans_skipped += 1
        return existing_id

    inserted_id = await conn.fetchval(
        """
        insert into public.clinical_source_spans (
          source_file_id,
          page_number,
          section_heading,
          span_start,
          span_end,
          quote,
          extracted_at
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id
        """,
        source_file_id,
        span.get("page_number"),
        span.get("section_heading"),
        span["span_start"],
        span["span_end"],
        span["quote"],
        parse_timestamp(span.get("extracted_at")),
    )
    counts.source_spans_inserted += 1
    return inserted_id


async def insert_recommendation_if_absent(
    conn: asyncpg.Connection,
    source_span_id: Any,
    recommendation: dict[str, Any],
    counts: ImportCounts,
) -> None:
    existing_id = await conn.fetchval(
        """
        select id
        from public.clinical_recommendations
        where source_span_id = $1
        """,
        source_span_id,
    )
    if existing_id:
        counts.recommendations_skipped += 1
        return

    values = [recommendation.get(field) for field in CLINICAL_FIELDS]
    await conn.execute(
        f"""
        insert into public.clinical_recommendations (
          source_span_id,
          {", ".join(CLINICAL_FIELDS)},
          review_status
        )
        values (
          $1,
          {", ".join(f"${index}" for index in range(2, len(CLINICAL_FIELDS) + 2))},
          'pending_review'
        )
        """,
        source_span_id,
        *values,
    )
    counts.recommendations_inserted += 1


async def import_jsonl(database_url: str, jsonl_path: Path) -> ImportCounts:
    source_file, recommendations = load_jsonl(jsonl_path)
    counts = ImportCounts()
    conn = await asyncpg.connect(database_url)

    try:
        async with conn.transaction():
            source_file_id = await get_or_insert_source_file(conn, source_file, counts)

            for recommendation in recommendations:
                span = recommendation["source_span"]
                if span["source_file_sha256"] != source_file["file_sha256"]:
                    raise ValueError("recommendation source span does not match source file SHA-256")

                source_span_id = await get_or_insert_source_span(conn, source_file_id, span, counts)
                await insert_recommendation_if_absent(conn, source_span_id, recommendation, counts)

            counts.approved_view_rows = await conn.fetchval(
                "select count(*) from public.approved_clinical_recommendations_with_source"
            )
    finally:
        await conn.close()

    return counts


def parse_timestamp(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


def database_url_from_env() -> str:
    database_url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "Set SUPABASE_DB_URL or DATABASE_URL to the Supabase Postgres connection string."
        )
    return database_url


async def async_main() -> None:
    parser = argparse.ArgumentParser(
        description="Import source-linked draft clinical JSONL into Supabase Postgres."
    )
    parser.add_argument("jsonl_file", type=Path)
    parser.add_argument("--database-url", default=None)
    args = parser.parse_args()

    counts = await import_jsonl(args.database_url or database_url_from_env(), args.jsonl_file)

    print(f"clinical_source_files inserted: {counts.source_files_inserted}")
    print(f"clinical_source_files skipped: {counts.source_files_skipped}")
    print(f"clinical_source_spans inserted: {counts.source_spans_inserted}")
    print(f"clinical_source_spans skipped: {counts.source_spans_skipped}")
    print(f"clinical_recommendations inserted: {counts.recommendations_inserted}")
    print(f"clinical_recommendations skipped: {counts.recommendations_skipped}")
    print(
        "approved_clinical_recommendations_with_source rows: "
        f"{counts.approved_view_rows}"
    )


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
