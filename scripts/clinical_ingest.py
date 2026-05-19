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


CONDITION_PATTERNS = [
    ("CAP", "Respiratory Tract Infection"),
    ("HCAP/ Early onset VAP", "Respiratory Tract Infection"),
    ("Lung abscess", "Respiratory Tract Infection"),
    ("Susceptible host", None),
    ("Native Valve/ Late Prosthetic Valve Infective Endocarditis (>1yr)", "Blood Stream Infection (BSI)"),
    ("Prosthetic valve Infective Endocarditis (<1yr)", "Blood Stream Infection (BSI)"),
    ("Cellulitis/ pyomyositis", "Skin & Soft Tissue Infection (SSTI)"),
    ("Diabetic foot infection", "Skin & Soft Tissue Infection (SSTI)"),
    ("Necrotizing fasciitis", "Skin & Soft Tissue Infection (SSTI)"),
    ("Urosepsis/ Pyelonephritis", "Urinary Tract Infection (UTI)"),
    ("Severe PN/ emphysematous PN/ perinephric abscess", "Urinary Tract Infection (UTI)"),
    ("Intra-abdominal sepsis", "Intra-abdominal Infection"),
    ("Catheter related blood-stream infection", "Blood Stream Infection (BSI)"),
    ("Community acquired meningitis", "CNS Infection"),
    ("Post neurosurgical meningitis/ shunt infection", "CNS Infection"),
    ("Brain abscess", "CNS Infection"),
    ("Invasive candidiasis", "Blood Stream Infection (BSI)"),
    ("Febrile neutropenia", "Febrile Neutropenia"),
    ("Malignant otitis externa", None),
    ("Deep Neck Space Infection", None),
    ("Acute Osteomyelitis/ Septic arthritis", "Skin & Soft Tissue Infection (SSTI)"),
    ("Prosthetic Joint Infection/ Implant associated Infections", "Skin & Soft Tissue Infection (SSTI)"),
    ("Enteric fever", None),
    ("Dysentery", None),
    ("Liver abscess", "Intra-abdominal Infection"),
]

LOCAL_TITLE_RE = re.compile(
    r"(?P<site>BLOOD STREAM INFECTION \(BSI\)|URINARY TRACT INFECTION \(UTI\)|RESPIRATORY TRACT INFECTION|INTRA-ABDOMINAL INFECTION)"
    r"\s*(?:\(ICU\)|ICU|WARDS?)?\s*[-–]\s*(?P<acquisition>COMMUNITY ACQUIRED|HOSPITAL ACQUIRED)",
    re.IGNORECASE,
)

LOCAL_SITE_MAP = {
    "BLOOD STREAM INFECTION (BSI)": "Blood Stream Infection (BSI)",
    "URINARY TRACT INFECTION (UTI)": "Urinary Tract Infection (UTI)",
    "RESPIRATORY TRACT INFECTION": "Respiratory Tract Infection",
    "INTRA-ABDOMINAL INFECTION": "Intra-abdominal Infection",
}

DOSE_RE = re.compile(
    r"(?:^|[\n;:]|\bOR\b|\+)\s*"
    r"(?P<drug>[A-Z][A-Za-z][A-Za-z\-/() ]{1,70}?)\s+"
    r"(?P<dose>(?:\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\s*)?(?:mg/kg/day|mg/kg/d|mg/kg|mg|gm|g|mU|mil U/day|lac units|U/day))"
    r"(?P<trailing>(?:\s+(?:IV|PO|oral|loading dose|LD|followed by|then|q\d+(?:-\d+)?h|q\d+(?:-\d+)?hr|q\d+(?:-\d+)? hrs|q\d+(?:-\d+)? hourly|q\d+d|q\d+|BD|TDS|QDS|OD|daily|tds|hrly|every \d+[-–]\d+ hrs|every \d+ hrs|in \d+[-–]\d+ doses|single dose|x \d+ doses|for \d+\s*[-–]\s*\d+\s*(?:days?|weeks?|months?)|for \d+\s*(?:days?|weeks?|months?)|\d+\s*[-–]\s*\d+d|\d+d|\d+\s*[-–]\s*\d+\s*weeks?|\d+\s*weeks?|day|days|week|weeks|month|months|/day|/d|\+/-|\+|OR|and|with|target trough concentration|\(|\)|\d+|[-–])){0,22})",
    re.IGNORECASE,
)

FREQUENCY_RE = re.compile(
    r"\b(q\d+(?:-\d+)?h|q\d+(?:-\d+)?hr|q\d+(?:-\d+)? hrs|BD|TDS|QDS|OD|daily|tds|every \d+-\d+ hrs|every \d+ hrs|single dose|x \d+ doses|in \d+-\d+ doses)\b",
    re.IGNORECASE,
)
ROUTE_RE = re.compile(r"\b(IV|PO|oral)\b", re.IGNORECASE)
DURATION_RE = re.compile(
    r"\b(\d+\s*(?:-|–|to)\s*\d+\s*(?:days?|d|weeks?|months?)|\d+\s*(?:days?|d|weeks?|months?)|until\s+(?:afebrile|anc recovery|culture results|clinical response)[^.;,\n]*)\b",
    re.IGNORECASE,
)

FN_TREATMENT_PATTERNS: list[tuple[str, str, str | None, str | None, str | None, str | None]] = [
    (
        r"Piperacillin\s+tazobactam\s+4\.5g\s+IV\s+q6-8h",
        "Piperacillin tazobactam",
        "4.5g",
        "IV",
        "q6-8h",
        None,
    ),
    (r"Meropenem\s+2g\s+(?:IV\s+)?q8h", "Meropenem", "2g", None, "q8h", None),
    (r"Imipenem\s+1g\s+q6-8h", "Imipenem", "1g", None, "q6-8h", None),
    (r"Doripenem\s+500mg-1g\s+q8h", "Doripenem", "500mg-1g", None, "q8h", None),
    (r"Vancomycin\s+15mg/kg\s+IV\s+12h", "Vancomycin", "15mg/kg", "IV", "12h", None),
    (
        r"Teicoplanin\s+12mg/kg/d\s+q12h\s+x\s+3\s+doses\s+followed\s+by\s+12mg/kg/d",
        "Teicoplanin",
        "12mg/kg/d",
        None,
        "q12h x 3 doses followed by 12mg/kg/d",
        None,
    ),
    (
        r"Polymixin\s+B\s+IV\s+15\s+lac\s+units\s+SD\s+followed\s+by\s+5\s+lac\s+units\s+q8h",
        "Polymixin B",
        "15 lac units SD followed by 5 lac units",
        "IV",
        "q8h",
        "CRE Risk factors",
    ),
    (
        r"Colistin\s+9mU\s+SD\s+followed\s+by\s+4\.5mU\s+12hrly",
        "Colistin",
        "9mU SD followed by 4.5mU",
        None,
        "12hrly",
        "CRE Risk factors",
    ),
    (
        r"Ceftazidime\s+avibactam\s+\+\s+Aztreonam",
        "Ceftazidime avibactam + Aztreonam",
        None,
        None,
        None,
        "CRE Risk factors",
    ),
]

FN_DURATION_RE = re.compile(
    r"Discontinue\s+antibiotic\s+if\s+no\s+source\s+identified\s*&\s*patient\s+has\s+been\s+afebrile\s+for\s+at\s+least\s+two\s+days\s+and\s+ANC\s+is\s+≥?500\s+cells/microL\s+with\s+a\s+consistently\s+increasing\s+trend",
    re.IGNORECASE,
)



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


def normalized_text(text: str) -> str:
    return " ".join(text.split())


def flexible_pattern(label: str) -> re.Pattern[str]:
    escaped = re.escape(label)
    escaped = escaped.replace(r"\ ", r"\s+")
    escaped = escaped.replace(r"\/", r"\s*/\s*")
    escaped = escaped.replace(r"\-", r"\s*[-–]\s*")
    if len(label) <= 4:
        escaped = rf"\b{escaped}\b"
    return re.compile(escaped, re.IGNORECASE)


def source_span(
    source: SourceFile,
    page_number: int | None,
    page_text: str,
    span_start: int,
    span_end: int,
    extracted_at: str,
    section_heading: str | None,
) -> SourceSpan:
    return SourceSpan(
        source_file_sha256=source.file_sha256,
        page_number=page_number,
        section_heading=section_heading,
        span_start=span_start,
        span_end=span_end,
        quote=normalized_text(page_text[span_start:span_end]),
        extracted_at=extracted_at,
    )


def extract_local_context(page_text: str) -> tuple[str | None, str | None, str | None]:
    text = normalized_text(page_text)
    match = LOCAL_TITLE_RE.search(text)
    if not match:
        return None, None, None

    raw_site = match.group("site").upper()
    setting = "ICU" if " ICU" in text[: match.end()].upper() or "(ICU)" in text[: match.end()].upper() else None
    if setting is None and re.search(r"\bWARDS?\b", text[: match.end()], re.IGNORECASE):
        setting = "Ward"
    acquisition = match.group("acquisition").title().replace(" Acquired", "-acquired")
    return LOCAL_SITE_MAP.get(raw_site, match.group("site").title()), setting, acquisition


def split_treatment_tokens(text: str) -> list[str]:
    cleaned = re.sub(r"\bEmpiric therapy\b", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bType\s+[123]\b", "", cleaned, flags=re.IGNORECASE)
    parts = re.split(r"\s+(?:OR|or)\s+|\n| {2,}", cleaned)
    tokens: list[str] = []
    for part in parts:
        token = normalized_text(part.strip(" -:;,"))
        if not token:
            continue
        if re.search(r"\b(patient risk|meeting all|meeting any|most common|prevalance)\b", token, re.I):
            continue
        if re.search(r"[A-Za-z]", token) and not re.fullmatch(r"Type\s+[123]", token, re.I):
            tokens.append(token)
    return tokens


def parse_drug_details(treatment_text: str) -> tuple[str, str | None, str | None, str | None, str | None]:
    match = DOSE_RE.search(treatment_text)
    if not match:
        return treatment_text.strip(), None, None, None, None

    drug = normalized_text(match.group("drug").strip(" -:+/"))
    drug = re.sub(r"\s+\b(IV|PO|oral)\b$", "", drug, flags=re.IGNORECASE)
    dose = normalized_text(match.group("dose"))
    trailing = normalized_text(match.group("trailing") or "")
    route_match = ROUTE_RE.search(f"{match.group('drug')} {trailing}")
    frequency_match = FREQUENCY_RE.search(trailing)
    duration_match = DURATION_RE.search(trailing)
    route = route_match.group(1) if route_match else None
    frequency = frequency_match.group(1) if frequency_match else None
    duration = duration_match.group(1) if duration_match else None
    return drug, dose, route, frequency, duration


def recommendation_from_treatment(
    *,
    source: SourceFile,
    page_number: int | None,
    page_text: str,
    span_start: int,
    span_end: int,
    extracted_at: str,
    section_heading: str | None,
    syndrome: str | None,
    infection_site: str | None,
    setting: str | None = None,
    acquisition: str | None = None,
    risk_type: str | None = None,
    severity_category: str | None = None,
    stewardship_note: str | None = None,
    id_consult_trigger: str | None = None,
) -> DraftRecommendation | None:
    quote = normalized_text(page_text[span_start:span_end])
    if not quote:
        return None

    drug, dose, route, frequency, duration = parse_drug_details(quote)
    if not drug:
        return None

    return DraftRecommendation(
        syndrome=syndrome,
        infection_site=infection_site,
        setting=setting,
        acquisition=acquisition,
        risk_type=risk_type,
        severity_category=severity_category,
        organism=None,
        pathogen=None,
        drug=drug,
        dose=dose,
        route=route,
        frequency=frequency,
        duration=duration,
        renal_adjustment=None,
        hepatic_adjustment=None,
        pregnancy_lactation_caution=None,
        allergy_warning=None,
        contraindication=None,
        stewardship_note=stewardship_note,
        id_consult_trigger=id_consult_trigger,
        review_status=REVIEW_STATUS,
        source_span=source_span(
            source,
            page_number,
            page_text,
            span_start,
            span_end,
            extracted_at,
            section_heading,
        ),
    )


def recommendation_from_structured_fields(
    *,
    source: SourceFile,
    page_number: int | None,
    page_text: str,
    span_start: int,
    span_end: int,
    extracted_at: str,
    section_heading: str | None,
    syndrome: str | None,
    infection_site: str | None,
    drug: str,
    dose: str | None = None,
    route: str | None = None,
    frequency: str | None = None,
    duration: str | None = None,
    setting: str | None = None,
    acquisition: str | None = None,
    risk_type: str | None = None,
    severity_category: str | None = None,
    stewardship_note: str | None = None,
    id_consult_trigger: str | None = None,
) -> DraftRecommendation:
    return DraftRecommendation(
        syndrome=syndrome,
        infection_site=infection_site,
        setting=setting,
        acquisition=acquisition,
        risk_type=risk_type,
        severity_category=severity_category,
        organism=None,
        pathogen=None,
        drug=drug,
        dose=dose,
        route=route,
        frequency=frequency,
        duration=duration,
        renal_adjustment=None,
        hepatic_adjustment=None,
        pregnancy_lactation_caution=None,
        allergy_warning=None,
        contraindication=None,
        stewardship_note=stewardship_note,
        id_consult_trigger=id_consult_trigger,
        review_status=REVIEW_STATUS,
        source_span=source_span(
            source,
            page_number,
            page_text,
            span_start,
            span_end,
            extracted_at,
            section_heading,
        ),
    )


def extract_febrile_neutropenia_rows(
    source: SourceFile,
    page_number: int | None,
    page_text: str,
    extracted_at: str,
) -> list[DraftRecommendation]:
    if not re.search(r"Febrile\s+neutropenia", page_text, re.IGNORECASE):
        return []

    rows: list[DraftRecommendation] = []
    segment_start = page_text.find("Gram-negative")
    segment_end = page_text.find("Malignant", segment_start)
    if segment_start >= 0 and segment_end > segment_start:
        segment = page_text[segment_start:segment_end]
        for pattern, drug, dose, route, frequency, risk_type in FN_TREATMENT_PATTERNS:
            match = re.search(pattern, segment, re.IGNORECASE)
            if not match:
                continue
            span_start = segment_start + match.start()
            span_end = segment_start + match.end()
            id_consult_trigger = (
                normalized_text(page_text[span_start:span_end])
                if "Ceftazidime avibactam" in drug
                else None
            )
            rows.append(
                recommendation_from_structured_fields(
                    source=source,
                    page_number=page_number,
                    page_text=page_text,
                    span_start=span_start,
                    span_end=span_end,
                    extracted_at=extracted_at,
                    section_heading="Febrile Neutropenia",
                    syndrome="Febrile Neutropenia",
                    infection_site="Febrile Neutropenia",
                    drug=drug,
                    dose=dose,
                    route=route,
                    frequency=frequency,
                    risk_type=risk_type,
                    id_consult_trigger=id_consult_trigger,
                )
            )

    duration_match = FN_DURATION_RE.search(page_text)
    if duration_match:
        rows.append(
            recommendation_from_structured_fields(
                source=source,
                page_number=page_number,
                page_text=page_text,
                span_start=duration_match.start(),
                span_end=duration_match.end(),
                extracted_at=extracted_at,
                section_heading="DURATION OF TREATMENT",
                syndrome="Febrile Neutropenia",
                infection_site="Febrile Neutropenia",
                drug="Febrile Neutropenia duration guidance",
                duration=normalized_text(duration_match.group(0)),
            )
        )

    return rows


def extract_local_empiric_rows(
    source: SourceFile,
    page_number: int | None,
    page_text: str,
    extracted_at: str,
) -> list[DraftRecommendation]:
    context = extract_local_context(page_text)
    if not any(context):
        return []

    start = page_text.find("Empiric therapy")
    if start < 0:
        return []

    end_candidates = [
        index
        for marker in ["Patient Risk Stratification", "Note:", "*Colistin", "Fosfomycin susceptibility"]
        for index in [page_text.find(marker, start)]
        if index > start
    ]
    end = min(end_candidates) if end_candidates else min(len(page_text), start + 900)
    section = page_text[start:end]
    infection_site, setting, acquisition = context
    rows: list[DraftRecommendation] = []

    for token in split_treatment_tokens(section):
        token_start = page_text.find(token, start, end)
        if token_start < 0:
            token_start = start
        token_end = min(end, token_start + len(token))
        row = recommendation_from_treatment(
            source=source,
            page_number=page_number,
            page_text=page_text,
            span_start=token_start,
            span_end=token_end,
            extracted_at=extracted_at,
            section_heading="Empiric therapy",
            syndrome=infection_site,
            infection_site=infection_site,
            setting=setting,
            acquisition=acquisition,
            severity_category="Empiric therapy",
        )
        if row is not None:
            rows.append(row)
    return rows


def condition_segments(page_text: str) -> list[tuple[str, str | None, int, int]]:
    matches: list[tuple[int, int, str, str | None]] = []
    for label, infection_site in CONDITION_PATTERNS:
        match = flexible_pattern(label).search(page_text)
        if match:
            matches.append((match.start(), match.end(), label, infection_site))

    matches.sort(key=lambda item: item[0])
    segments: list[tuple[str, str | None, int, int]] = []
    for index, (start, _end, label, infection_site) in enumerate(matches):
        next_start = matches[index + 1][0] if index + 1 < len(matches) else len(page_text)
        segments.append((label, infection_site, start, next_start))
    return segments


def extract_site_guideline_rows(
    source: SourceFile,
    page_number: int | None,
    page_text: str,
    extracted_at: str,
) -> list[DraftRecommendation]:
    rows: list[DraftRecommendation] = []
    for syndrome, infection_site, start, end in condition_segments(page_text):
        segment = page_text[start:end]
        for match in DOSE_RE.finditer(segment):
            drug_start = start + match.start()
            previous_word = re.search(
                r"([A-Z][A-Za-z]+(?:cillin|cycline|penem|xacin|mycin|azole))\s*$",
                segment[: match.start()].replace("\n", " "),
            )
            if previous_word:
                drug_start = start + previous_word.start(1)
            trailing = match.group("trailing") or ""
            drug_end = start + match.end()
            if re.search(r"\b(Sensitivity|Prevalance|Pathogen)\b", segment[: match.start()], re.I):
                continue
            row = recommendation_from_treatment(
                source=source,
                page_number=page_number,
                page_text=page_text,
                span_start=drug_start,
                span_end=drug_end,
                extracted_at=extracted_at,
                section_heading=syndrome,
                syndrome=syndrome,
                infection_site=infection_site,
                stewardship_note=(
                    normalized_text(trailing)
                    if re.search(r"\b(ID consult|risk factors|advised|source control)\b", trailing, re.I)
                    else None
                ),
                id_consult_trigger=(
                    normalized_text(trailing)
                    if re.search(r"\bID consult\b", trailing, re.I)
                    else None
                ),
            )
            if row is not None:
                rows.append(row)
    return rows


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
        recommendations.extend(
            extract_site_guideline_rows(source, page_number, text, extracted_at)
        )
        recommendations.extend(
            extract_febrile_neutropenia_rows(source, page_number, text, extracted_at)
        )
        recommendations.extend(
            extract_local_empiric_rows(source, page_number, text, extracted_at)
        )

    return source, recommendations


def has_structured_clinical_content(row: DraftRecommendation) -> bool:
    return any(getattr(row, field) for field in null_fields())


def validate_recommendation(row: DraftRecommendation) -> None:
    if not row.source_span.quote:
        raise ValueError("recommendation is missing source quote")
    if row.review_status == "approved":
        raise ValueError("ingested rows must not be approved automatically")
    if not has_structured_clinical_content(row):
        raise ValueError("recommendation is missing structured clinical fields")
    if not row.drug:
        raise ValueError("recommendation is missing extracted drug or treatment text")


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
