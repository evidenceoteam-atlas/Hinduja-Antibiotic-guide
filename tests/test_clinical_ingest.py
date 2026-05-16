from pathlib import Path

import pytest

from scripts.clinical_ingest import (
    DraftRecommendation,
    SourceSpan,
    candidate_blocks,
    validate_recommendation,
)


def test_candidate_blocks_preserve_source_span_and_section():
    text = """1 UTI

Use antibiotic therapy as per table. Dose: source stated only.

General paragraph without markers.
"""

    blocks = list(candidate_blocks(text))

    assert len(blocks) == 1
    start, end, quote, section = blocks[0]
    assert text[start:end].startswith("Use antibiotic therapy")
    assert "Dose: source stated only" in quote
    assert section == "1 UTI"


def test_imported_recommendation_without_source_quote_is_rejected():
    span = SourceSpan(
        source_file_sha256="abc",
        page_number=1,
        section_heading="UTI",
        span_start=0,
        span_end=0,
        quote="",
        extracted_at="2026-05-16T00:00:00+00:00",
    )
    row = DraftRecommendation(
        syndrome=None,
        infection_site=None,
        setting=None,
        acquisition=None,
        risk_type=None,
        severity_category=None,
        organism=None,
        pathogen=None,
        drug=None,
        dose=None,
        route=None,
        frequency=None,
        duration=None,
        renal_adjustment=None,
        hepatic_adjustment=None,
        pregnancy_lactation_caution=None,
        allergy_warning=None,
        contraindication=None,
        stewardship_note=None,
        id_consult_trigger=None,
        review_status="pending_review",
        source_span=span,
    )

    with pytest.raises(ValueError, match="missing source quote"):
        validate_recommendation(row)


def test_imported_recommendation_cannot_start_approved():
    span = SourceSpan(
        source_file_sha256="abc",
        page_number=1,
        section_heading="UTI",
        span_start=0,
        span_end=10,
        quote="Antibiotic therapy statement from source.",
        extracted_at="2026-05-16T00:00:00+00:00",
    )
    row = DraftRecommendation(
        syndrome=None,
        infection_site=None,
        setting=None,
        acquisition=None,
        risk_type=None,
        severity_category=None,
        organism=None,
        pathogen=None,
        drug=None,
        dose=None,
        route=None,
        frequency=None,
        duration=None,
        renal_adjustment=None,
        hepatic_adjustment=None,
        pregnancy_lactation_caution=None,
        allergy_warning=None,
        contraindication=None,
        stewardship_note=None,
        id_consult_trigger=None,
        review_status="approved",
        source_span=span,
    )

    with pytest.raises(ValueError, match="must not be approved"):
        validate_recommendation(row)


def test_no_fixture_contains_static_antibiotic_fallbacks():
    checked_files = [
        Path("mobile/src/AppRoot.tsx"),
        Path("rules/hinduja_protocols.json"),
        Path("services/antibiogram-service/app/main.py"),
        Path("services/protocol-engine/app/main.py"),
    ]
    text = "\n".join(path.read_text() for path in checked_files)

    assert "No approved recommendation available" in text
    assert "currentProtocol.therapies.map" not in text
    assert "Cefoperazone-Sulbactam" not in text
    assert "Meropenem" not in text
    assert "Colistin" not in text
