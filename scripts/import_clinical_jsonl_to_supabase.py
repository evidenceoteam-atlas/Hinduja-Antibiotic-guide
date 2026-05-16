"""Import source-linked draft clinical recommendations into Supabase.

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
import httpx


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


@dataclass(frozen=True)
class SupabaseRestConfig:
    url: str
    anon_key: str

    @property
    def rest_url(self) -> str:
        return f"{self.url.rstrip('/')}/rest/v1"

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json",
        }


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


def source_file_payload(source_file: dict[str, Any]) -> dict[str, Any]:
    return {
        "filename": source_file["filename"],
        "original_path": source_file.get("original_path"),
        "file_sha256": source_file["file_sha256"],
        "mime_type": source_file.get("mime_type"),
    }


def source_span_payload(source_file_id: Any, span: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_file_id": str(source_file_id),
        "page_number": span.get("page_number"),
        "section_heading": span.get("section_heading"),
        "span_start": span["span_start"],
        "span_end": span["span_end"],
        "quote": span["quote"],
        "extracted_at": span.get("extracted_at"),
    }


def recommendation_payload(source_span_id: Any, recommendation: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_span_id": str(source_span_id),
        **{field: recommendation.get(field) for field in CLINICAL_FIELDS},
        "review_status": "pending_review",
    }


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
        source_file_payload(source_file)["filename"],
        source_file_payload(source_file)["original_path"],
        source_file_payload(source_file)["file_sha256"],
        source_file_payload(source_file)["mime_type"],
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


async def rest_request(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: Any = None,
    headers: dict[str, str] | None = None,
) -> Any:
    response = await client.request(
        method,
        path,
        params=params,
        json=json_body,
        headers=headers,
    )
    if response.status_code >= 400:
        raise RuntimeError(
            f"Supabase REST {method} {path} failed with {response.status_code}: "
            f"{response.text}"
        )
    if response.status_code == 204 or not response.content:
        return None
    return response.json()


async def rest_select_one(
    client: httpx.AsyncClient,
    table: str,
    params: dict[str, Any],
) -> dict[str, Any] | None:
    rows = await rest_request(
        client,
        "GET",
        table,
        params={**params, "limit": "1"},
    )
    return rows[0] if rows else None


async def rest_insert_one(
    client: httpx.AsyncClient,
    table: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    rows = await rest_request(
        client,
        "POST",
        table,
        json_body=payload,
        headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise RuntimeError(f"Supabase REST insert into {table} returned no row")
    return rows[0]


async def rest_get_or_insert_source_file(
    client: httpx.AsyncClient,
    source_file: dict[str, Any],
    counts: ImportCounts,
) -> str:
    existing = await rest_select_one(
        client,
        "clinical_source_files",
        {
            "select": "id",
            "file_sha256": f"eq.{source_file['file_sha256']}",
        },
    )
    if existing:
        counts.source_files_skipped += 1
        return existing["id"]

    inserted = await rest_insert_one(
        client,
        "clinical_source_files",
        source_file_payload(source_file),
    )
    counts.source_files_inserted += 1
    return inserted["id"]


async def rest_get_or_insert_source_span(
    client: httpx.AsyncClient,
    source_file_id: str,
    span: dict[str, Any],
    counts: ImportCounts,
) -> str:
    page_filter = "is.null" if span.get("page_number") is None else f"eq.{span['page_number']}"
    existing = await rest_select_one(
        client,
        "clinical_source_spans",
        {
            "select": "id",
            "source_file_id": f"eq.{source_file_id}",
            "page_number": page_filter,
            "span_start": f"eq.{span['span_start']}",
            "span_end": f"eq.{span['span_end']}",
        },
    )
    if existing:
        counts.source_spans_skipped += 1
        return existing["id"]

    inserted = await rest_insert_one(
        client,
        "clinical_source_spans",
        source_span_payload(source_file_id, span),
    )
    counts.source_spans_inserted += 1
    return inserted["id"]


async def rest_insert_recommendation_if_absent(
    client: httpx.AsyncClient,
    source_span_id: str,
    recommendation: dict[str, Any],
    counts: ImportCounts,
) -> None:
    existing = await rest_select_one(
        client,
        "clinical_recommendations",
        {
            "select": "id",
            "source_span_id": f"eq.{source_span_id}",
        },
    )
    if existing:
        counts.recommendations_skipped += 1
        return

    await rest_insert_one(
        client,
        "clinical_recommendations",
        recommendation_payload(source_span_id, recommendation),
    )
    counts.recommendations_inserted += 1


async def import_jsonl_via_rest(
    config: SupabaseRestConfig,
    jsonl_path: Path,
    *,
    client: httpx.AsyncClient | None = None,
) -> ImportCounts:
    source_file, recommendations = load_jsonl(jsonl_path)
    counts = ImportCounts()
    owns_client = client is None
    rest_client = client or httpx.AsyncClient(
        base_url=config.rest_url,
        headers=config.headers,
        timeout=30,
    )

    try:
        source_file_id = await rest_get_or_insert_source_file(rest_client, source_file, counts)

        for recommendation in recommendations:
            span = recommendation["source_span"]
            if span["source_file_sha256"] != source_file["file_sha256"]:
                raise ValueError("recommendation source span does not match source file SHA-256")

            source_span_id = await rest_get_or_insert_source_span(
                rest_client,
                source_file_id,
                span,
                counts,
            )
            await rest_insert_recommendation_if_absent(
                rest_client,
                source_span_id,
                recommendation,
                counts,
            )

        view_rows = await rest_request(
            rest_client,
            "GET",
            "approved_clinical_recommendations_with_source",
            params={"select": "id"},
            headers={"Prefer": "count=exact"},
        )
        counts.approved_view_rows = len(view_rows or [])
    finally:
        if owns_client:
            await rest_client.aclose()

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


def database_url_from_env_optional() -> str | None:
    return os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")


def rest_config_from_env() -> SupabaseRestConfig:
    supabase_url = (
        os.environ.get("EXPO_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    )
    anon_key = (
        os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
    )
    if not supabase_url or not anon_key:
        raise RuntimeError(
            "Set SUPABASE_DB_URL/DATABASE_URL, or set EXPO_PUBLIC_SUPABASE_URL and "
            "EXPO_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY)."
        )
    return SupabaseRestConfig(url=supabase_url, anon_key=anon_key)


def print_counts(counts: ImportCounts) -> None:
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
    print(
        "approved view remains empty: "
        f"{'yes' if counts.approved_view_rows == 0 else 'no'}"
    )


async def async_main() -> None:
    parser = argparse.ArgumentParser(
        description="Import source-linked draft clinical JSONL into Supabase."
    )
    parser.add_argument("jsonl_file", type=Path)
    parser.add_argument("--database-url", default=None)
    args = parser.parse_args()

    database_url = args.database_url or database_url_from_env_optional()
    if database_url:
        counts = await import_jsonl(database_url, args.jsonl_file)
    else:
        counts = await import_jsonl_via_rest(rest_config_from_env(), args.jsonl_file)

    print_counts(counts)


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
