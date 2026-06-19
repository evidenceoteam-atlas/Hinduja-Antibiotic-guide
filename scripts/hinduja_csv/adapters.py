"""Schema-aware CSV adapters.

The adapters never rewrite source bytes and never silently resolve a source
contradiction. Every emitted record carries a byte hash and logical locator.
"""

from __future__ import annotations

import csv
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class CsvAdapterError(ValueError):
    """Raised when a file does not meet its declared source contract."""


@dataclass(frozen=True)
class ParsedFile:
    filename: str
    adapter: str
    file_sha256: str
    records: list[dict[str, Any]]
    counts: dict[str, int]
    review_flags: list[dict[str, Any]]


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _rows(path: Path) -> tuple[bytes, list[list[str]]]:
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CsvAdapterError(f"{path.name}: expected UTF-8 CSV") from exc
    try:
        rows = list(csv.reader(text.splitlines()))
    except csv.Error as exc:
        raise CsvAdapterError(f"{path.name}: malformed CSV: {exc}") from exc
    return raw, rows


def _source(
    *,
    filename: str,
    file_sha256: str,
    row_start: int,
    row_end: int | None = None,
    column: str | int | None = None,
    source_values: list[str] | None = None,
) -> dict[str, Any]:
    values = source_values or []
    exact_text = "\n".join(values)
    return {
        "source_filename": filename,
        "source_file_sha256": file_sha256,
        "source_locator": {
            "row_start": row_start,
            "row_end": row_end or row_start,
            "column": column,
        },
        "source_values": values,
        "source_value_sha256": _sha256(exact_text.encode("utf-8")),
    }


def parse_risk(path: Path) -> ParsedFile:
    raw, rows = _rows(path)
    if len(rows) != 26 or any(len(row) != 1 for row in rows):
        raise CsvAdapterError(f"{path.name}: expected 26 one-column rows")
    expected_types = {5: "1", 13: "2", 21: "3"}
    criteria_rows = {
        "Definition": {"1": 6, "2": 14, "3": 22},
        "Hospital contact": {"1": 8, "2": 16, "3": 24},
        "Antibiotic exposure": {"1": 9, "2": 17, "3": 25},
        "Co-morbidities": {"1": 10, "2": 18, "3": 26},
    }
    for row_number, type_key in expected_types.items():
        if rows[row_number - 1][0].strip() != f"Type {type_key}":
            raise CsvAdapterError(f"{path.name}: Type {type_key} heading missing at row {row_number}")
    digest = _sha256(raw)
    records: list[dict[str, Any]] = []
    for criterion_name, type_rows in criteria_rows.items():
        values = {key: rows[row_number - 1][0].strip() for key, row_number in type_rows.items()}
        if any(not value for value in values.values()):
            raise CsvAdapterError(f"{path.name}: blank value for {criterion_name}")
        records.append(
            {
                "record_type": "patient_risk_criterion",
                "criterion_name": criterion_name,
                "values": values,
                **_source(
                    filename=path.name,
                    file_sha256=digest,
                    row_start=min(type_rows.values()),
                    row_end=max(type_rows.values()),
                    column=1,
                    source_values=[rows[number - 1][0] for number in type_rows.values()],
                ),
            }
        )
    return ParsedFile(path.name, "risk", digest, records, {"criteria": 4}, [])


def parse_icmr(path: Path) -> ParsedFile:
    raw, rows = _rows(path)
    expected_header = [
        "Clinical Condition",
        "Common Pathogens",
        "Empirical AMA",
        "Alternate AMA",
        "Comments",
        "Duration",
        "Remarks",
    ]
    if len(rows) != 27 or rows[1] != expected_header:
        raise CsvAdapterError(f"{path.name}: expected blank row, seven-column header, and 25 rows")
    digest = _sha256(raw)
    records: list[dict[str, Any]] = []
    duration_count = 0
    for row_number, row in enumerate(rows[2:], start=3):
        if len(row) != 7 or not row[0].strip():
            raise CsvAdapterError(f"{path.name}: invalid ICMR row {row_number}")
        values = dict(zip(expected_header, row, strict=True))
        records.append(
            {
                "record_type": "icmr_guideline",
                "clinical_condition": values["Clinical Condition"],
                "infection_code": "unmapped",
                "infection_code_review_status": "pending_review",
                "common_pathogens": values["Common Pathogens"] or None,
                "empirical_ama": values["Empirical AMA"] or None,
                "alternate_ama": values["Alternate AMA"] or None,
                "comments": values["Comments"] or None,
                "duration": values["Duration"] or None,
                "remarks": values["Remarks"] or None,
                "raw_columns": values,
                **_source(
                    filename=path.name,
                    file_sha256=digest,
                    row_start=row_number,
                    column="A:G",
                    source_values=row,
                ),
            }
        )
        duration_count += bool(values["Duration"].strip())
    return ParsedFile(
        path.name,
        "icmr",
        digest,
        records,
        {"guidelines": 25, "nonempty_duration_cells": duration_count},
        [],
    )


THERAPY_FILENAME_RE = re.compile(
    r"^(?P<number>\d{2})_(?P<infection>BSI|UTI|RS|ABDO)_(?P<location>ICU|Wards|WARDS)_(?P<acquisition>CA|HA)\.csv$"
)
INFECTION_CODES = {"BSI": "BSI", "UTI": "UTI", "RS": "RTI", "ABDO": "IAI"}
ACQUISITION_CODES = {"CA": "community_acquired", "HA": "hospital_acquired"}


def parse_local_therapy(path: Path) -> ParsedFile:
    match = THERAPY_FILENAME_RE.match(path.name)
    if not match:
        raise CsvAdapterError(f"{path.name}: filename does not declare an exact scenario")
    raw, rows = _rows(path)
    if len(rows) not in {8, 10} or any(len(row) != 2 for row in rows):
        raise CsvAdapterError(f"{path.name}: expected an 8/10-row two-column therapy sheet")
    digest = _sha256(raw)
    infection_type = INFECTION_CODES[match.group("infection")]
    location = "ICU" if match.group("location") == "ICU" else "wards"
    acquisition = ACQUISITION_CODES[match.group("acquisition")]
    internal_acquisition_text = rows[3][0].strip()
    internal_acquisition = {
        "COMMUNITY ACQUIRED": "community_acquired",
        "HOSPITAL ACQUIRED": "hospital_acquired",
    }.get(internal_acquisition_text.upper())
    if internal_acquisition is None:
        raise CsvAdapterError(f"{path.name}: unrecognized acquisition heading at row 4")

    sheet_key = f"{infection_type}.{location}.{acquisition}"
    records: list[dict[str, Any]] = [
        {
            "record_type": "antibiogram_sheet",
            "sheet_key": sheet_key,
            "infection_type": infection_type,
            "location": location,
            "acquisition": acquisition,
            "internal_acquisition": internal_acquisition,
            "sheet_title": rows[1][0].strip(),
            **_source(
                filename=path.name,
                file_sha256=digest,
                row_start=2,
                row_end=4,
                column=1,
                source_values=[rows[index][0] for index in range(1, 4)],
            ),
        }
    ]
    nonempty = 0
    blank = 0
    for offset, risk_type in enumerate(("1", "2", "3"), start=6):
        label, therapy = rows[offset - 1]
        if label.strip() != f"Type {risk_type}":
            raise CsvAdapterError(f"{path.name}: expected Type {risk_type} at row {offset}")
        therapy_value = therapy.strip() or None
        nonempty += therapy_value is not None
        blank += therapy_value is None
        records.append(
            {
                "record_type": "antibiogram_therapy_slot",
                "sheet_key": sheet_key,
                "infection_type": infection_type,
                "location": location,
                "acquisition": acquisition,
                "risk_type": risk_type,
                "therapy": therapy_value,
                "availability_status": "available" if therapy_value else "no_source_therapy",
                **_source(
                    filename=path.name,
                    file_sha256=digest,
                    row_start=offset,
                    column=2,
                    source_values=[therapy],
                ),
            }
        )
    note_count = 0
    if len(rows) == 10:
        label, note = rows[9]
        if label.strip().rstrip(":").lower() != "note":
            raise CsvAdapterError(f"{path.name}: unexpected row 10 label")
        if note.strip():
            note_count = 1
            records.append(
                {
                    "record_type": "antibiogram_note",
                    "sheet_key": sheet_key,
                    "note": note.strip(),
                    **_source(
                        filename=path.name,
                        file_sha256=digest,
                        row_start=10,
                        column=2,
                        source_values=[note],
                    ),
                }
            )
    review_flags = []
    if internal_acquisition != acquisition:
        review_flags.append(
            {
                "code": "SOURCE_ACQUISITION_CONFLICT",
                "field": "acquisition",
                "source_locator": {"row_start": 4, "row_end": 4, "column": 1},
                "filename_value": acquisition,
                "internal_value": internal_acquisition,
                "required_for_activation": True,
            }
        )
    return ParsedFile(
        path.name,
        "local_therapy",
        digest,
        records,
        {
            "sheets": 1,
            "therapy_slots": 3,
            "nonempty_therapies": nonempty,
            "blank_therapies": blank,
            "notes": note_count,
        },
        review_flags,
    )


def parse_perioperative(path: Path) -> ParsedFile:
    raw, rows = _rows(path)
    if len(rows) != 52 or any(len(row) != 5 for row in rows):
        raise CsvAdapterError(f"{path.name}: expected 52 rows and five columns")
    header = ["Drug", "Standard Dose", "Weight Based Dose", "Duration for Bolus ", "Duration for infusion"]
    if rows[26] != header:
        raise CsvAdapterError(f"{path.name}: dosing header mismatch at row 27")
    digest = _sha256(raw)
    records: list[dict[str, Any]] = []
    for row_number in range(13, 24):
        row = rows[row_number - 1]
        if not row[0].strip() or not row[1].strip():
            raise CsvAdapterError(f"{path.name}: invalid procedure row {row_number}")
        records.append(
            {
                "record_type": "perioperative_procedure",
                "procedure": row[0].strip(),
                "preferred_drug": row[1].strip(),
                **_source(
                    filename=path.name,
                    file_sha256=digest,
                    row_start=row_number,
                    column="A:B",
                    source_values=row[:2],
                ),
            }
        )
    for row_number in range(28, 32):
        row = rows[row_number - 1]
        records.append(
            {
                "record_type": "perioperative_dosing",
                "drug": row[0].strip(),
                "standard_dose": row[1].strip() or None,
                "weight_based_dose": row[2].strip() or None,
                "bolus_duration": row[3].strip() or None,
                "infusion_duration": row[4].strip() or None,
                **_source(
                    filename=path.name,
                    file_sha256=digest,
                    row_start=row_number,
                    column="A:E",
                    source_values=row,
                ),
            }
        )
    note_rows = [("procedure_note", number) for number in range(39, 43)] + [
        ("general_note", number) for number in range(46, 53)
    ]
    for note_type, row_number in note_rows:
        value = rows[row_number - 1][0].strip()
        if not value:
            raise CsvAdapterError(f"{path.name}: blank note at row {row_number}")
        records.append(
            {
                "record_type": "perioperative_note",
                "note_type": note_type,
                "note_text": value,
                "sort_order": row_number,
                **_source(
                    filename=path.name,
                    file_sha256=digest,
                    row_start=row_number,
                    column=1,
                    source_values=[rows[row_number - 1][0]],
                ),
            }
        )
    return ParsedFile(
        path.name, "perioperative", digest, records, {"procedures": 11, "dosing": 4, "notes": 11}, []
    )


def _parse_pearls(path: Path, *, adapter: str, initial_section: str | None) -> ParsedFile:
    raw, rows = _rows(path)
    if any(len(row) != 1 for row in rows):
        raise CsvAdapterError(f"{path.name}: expected one-column sectioned document")
    digest = _sha256(raw)
    records: list[dict[str, Any]] = []
    section = initial_section
    current: dict[str, Any] | None = None
    sections: list[str] = []

    def flush() -> None:
        nonlocal current
        if current is None:
            return
        source_values = current.pop("_source_values")
        row_start = current.pop("_row_start")
        row_end = current.pop("_row_end")
        current["pearl_text"] = " ".join(value.strip() for value in source_values).removeprefix("•").strip()
        current.update(
            _source(
                filename=path.name,
                file_sha256=digest,
                row_start=row_start,
                row_end=row_end,
                column=1,
                source_values=source_values,
            )
        )
        records.append(current)
        current = None

    if section:
        sections.append(section)
    for row_number, row in enumerate(rows, start=1):
        value = row[0]
        stripped = value.strip()
        if not stripped:
            flush()
            continue
        if stripped.startswith("•"):
            flush()
            if section is None:
                raise CsvAdapterError(f"{path.name}: bullet at row {row_number} has no section")
            current = {
                "record_type": "stewardship_pearl" if adapter == "stewardship_pearls" else "ama_pearl",
                "section_name": section,
                "sort_order": len(records) + 1,
                "_source_values": [value],
                "_row_start": row_number,
                "_row_end": row_number,
            }
            continue
        if stripped.upper() == stripped and any(character.isalpha() for character in stripped):
            flush()
            section = stripped
            if section not in sections:
                sections.append(section)
            continue
        if current is None:
            raise CsvAdapterError(f"{path.name}: orphan continuation at row {row_number}")
        current["_source_values"].append(value)
        current["_row_end"] = row_number
    flush()
    return ParsedFile(
        path.name, adapter, digest, records, {"pearls": len(records), "sections": len(sections)}, []
    )


def parse_stewardship_pearls(path: Path) -> ParsedFile:
    return _parse_pearls(path, adapter="stewardship_pearls", initial_section="GENERAL")


def parse_ama_pearls(path: Path) -> ParsedFile:
    return _parse_pearls(path, adapter="ama_pearls", initial_section=None)


ADAPTERS = {
    "risk": parse_risk,
    "icmr": parse_icmr,
    "local_therapy": parse_local_therapy,
    "perioperative": parse_perioperative,
    "stewardship_pearls": parse_stewardship_pearls,
    "ama_pearls": parse_ama_pearls,
}
