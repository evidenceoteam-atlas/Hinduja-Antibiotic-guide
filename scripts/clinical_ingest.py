"""Source-only clinical guide ingestion.

The extractor deliberately does not infer clinical facts. It preserves source
pages and text spans, then emits draft recommendation rows with nullable fields.
Clinicians must review and structure the rows before approval.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import mimetypes
import re
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable


REVIEW_STATUS = "pending_review"
NOT_SPECIFIED = "not specified in source"


@dataclass(frozen=True)
class SourceFile:
    filename: str
    original_path: str
    file_sha256: str
    mime_type: str | None


@dataclass(frozen=True)
class SourceSpan:
    source_file_sha256: str
    page_number: int | None
    section_heading: str | None
    span_start: int
    span_end: int
    quote: str
    extracted_at: str


@dataclass(frozen=True)
class DraftRecommendation:
    syndrome: str | None
    infection_site: str | None
    setting: str | None
    acquisition: str | None
    risk_type: str | None
    severity_category: str | None
    organism: str | None
    pathogen: str | None
    drug: str | None
    dose: str | None
    route: str | None
    frequency: str | None
    duration: str | None
    renal_adjustment: str | None
    hepatic_adjustment: str | None
    pregnancy_lactation_caution: str | None
    allergy_warning: str | None
    contraindication: str | None
    stewardship_note: str | None
    id_consult_trigger: str | None
    review_status: str
    source_span: SourceSpan


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_file(path: Path) -> SourceFile:
    return SourceFile(
        filename=path.name,
        original_path=str(path),
        file_sha256=sha256_file(path),
        mime_type=mimetypes.guess_type(path.name)[0],
    )


def extract_pages(path: Path) -> list[tuple[int | None, str]]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_pdf_pages(path)
    if suffix == ".docx":
        return [(None, extract_docx_text(path))]
    if suffix in {".md", ".markdown", ".txt"}:
        return [(None, path.read_text(encoding="utf-8"))]
    if suffix == ".csv":
        return [(None, extract_csv_text(path))]
    raise ValueError(f"Unsupported source file type: {path.suffix}")


def extract_pdf_pages(path: Path) -> list[tuple[int | None, str]]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover - exercised by CLI users
        raise RuntimeError("Install pypdf to ingest PDF guide files.") from exc

    reader = PdfReader(str(path))
    pages: list[tuple[int | None, str]] = []
    for page_index, page in enumerate(reader.pages, start=1):
        pages.append((page_index, page.extract_text() or ""))
    return pages


def extract_docx_text(path: Path) -> str:
    try:
        from docx import Document
    except ImportError as exc:  # pragma: no cover - exercised by CLI users
        raise RuntimeError("Install python-docx to ingest DOCX guide files.") from exc

    document = Document(str(path))
    return "\n".join(paragraph.text for paragraph in document.paragraphs)


def extract_csv_text(path: Path) -> str:
    rows: list[str] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(" | ".join(f"{key}: {value}" for key, value in row.items()))
    return "\n".join(rows)


def guess_section_heading(text_before: str) -> str | None:
    for line in reversed(text_before.splitlines()[-12:]):
        clean = " ".join(line.split())
        if not clean:
            continue
        if len(clean) <= 96 and (clean.isupper() or re.match(r"^\d+(\.\d+)*\s+", clean)):
            return clean
    return None


def candidate_blocks(page_text: str) -> Iterable[tuple[int, int, str, str | None]]:
    blocks = re.split(r"\n\s*\n", page_text)
    cursor = 0
    for block in blocks:
        start = page_text.find(block, cursor)
        if start < 0:
            start = cursor
        end = start + len(block)
        cursor = end
        quote = " ".join(block.split())
        if is_candidate_recommendation(quote):
            yield start, end, quote, guess_section_heading(page_text[:start])


def is_candidate_recommendation(text: str) -> bool:
    lowered = text.lower()
    clinical_markers = [
        "antibiotic",
        "therapy",
        "dose",
        "duration",
        "renal",
        "hepatic",
        "pregnancy",
        "lactation",
        "allergy",
        "contraindication",
        "stewardship",
        "id consult",
        "culture",
        "organism",
    ]
    return len(text) >= 20 and any(marker in lowered for marker in clinical_markers)


def null_fields() -> dict[str, str | None]:
    fields = [
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
    return dict.fromkeys(fields)


def ingest_source(path: Path) -> tuple[SourceFile, list[DraftRecommendation]]:
    source = source_file(path)
    extracted_at = datetime.now(UTC).isoformat()
    recommendations: list[DraftRecommendation] = []

    for page_number, text in extract_pages(path):
        for span_start, span_end, quote, section_heading in candidate_blocks(text):
            span = SourceSpan(
                source_file_sha256=source.file_sha256,
                page_number=page_number,
                section_heading=section_heading,
                span_start=span_start,
                span_end=span_end,
                quote=quote,
                extracted_at=extracted_at,
            )
            recommendations.append(
                DraftRecommendation(
                    **null_fields(),
                    review_status=REVIEW_STATUS,
                    source_span=span,
                )
            )

    return source, recommendations


def validate_recommendation(row: DraftRecommendation) -> None:
    if not row.source_span.quote:
        raise ValueError("recommendation is missing source quote")
    if row.review_status == "approved":
        raise ValueError("ingested rows must not be approved automatically")


def write_jsonl(source: SourceFile, rows: list[DraftRecommendation], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        handle.write(json.dumps({"type": "source_file", "data": asdict(source)}) + "\n")
        for row in rows:
            validate_recommendation(row)
            handle.write(json.dumps({"type": "draft_recommendation", "data": asdict(row)}) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract source-linked draft clinical rows.")
    parser.add_argument("source_file", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    source, rows = ingest_source(args.source_file)
    write_jsonl(source, rows, args.output)
    print(f"Wrote {len(rows)} draft source-linked row(s) to {args.output}")


if __name__ == "__main__":
    main()
