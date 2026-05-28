from pathlib import Path

import pytest

from scripts.clinical_ingest import (
    DraftRecommendation,
    SourceFile,
    SourceSpan,
    candidate_blocks,
    extract_febrile_neutropenia_rows,
    extract_local_empiric_rows,
    extract_site_guideline_rows,
    parse_drug_details,
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


def test_empty_structured_recommendation_is_rejected():
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
        review_status="pending_review",
        source_span=span,
    )

    with pytest.raises(ValueError, match="structured clinical fields"):
        validate_recommendation(row)


def test_site_guideline_extracts_explicit_drug_dose_route_frequency():
    source = SourceFile("guide.pdf", "/tmp/guide.pdf", "abc", "application/pdf")
    text = """Clinical Condition Common Pathogens Empirical AMA Alternate AMA Comments
CAP Streptococcus pneumoniae
Amoxicillin-clavulanate 1.2g IV q8h OR
Ceftriaxone 1g IV q12h + Azithromycin 500mg OD
"""

    rows = extract_site_guideline_rows(source, 3, text, "2026-05-16T00:00:00+00:00")

    assert any(row.syndrome == "CAP" and row.drug == "Amoxicillin-clavulanate" for row in rows)
    assert any(row.dose == "1.2g" and row.route == "IV" and row.frequency == "q8h" for row in rows)
    assert any(row.drug == "Ceftriaxone" and row.dose == "1g" for row in rows)


def test_drug_detail_parser_captures_explicit_duration_phrases():
    assert parse_drug_details("Azithromycin 500mg PO OD for 5 days") == (
        "Azithromycin",
        "500mg",
        "PO",
        "OD",
        "5 days",
    )
    assert parse_drug_details("Ceftriaxone 1g IV q12h for 7 days") == (
        "Ceftriaxone",
        "1g",
        "IV",
        "q12h",
        "7 days",
    )
    assert parse_drug_details("Meropenem 1g IV q8h for 10–14 days") == (
        "Meropenem",
        "1g",
        "IV",
        "q8h",
        "10–14 days",
    )
    assert parse_drug_details("Vancomycin 1g IV q12h for 2 weeks") == (
        "Vancomycin",
        "1g",
        "IV",
        "q12h",
        "2 weeks",
    )


def test_local_empiric_extracts_explicit_context_and_treatment_text():
    source = SourceFile("guide.pdf", "/tmp/guide.pdf", "abc", "application/pdf")
    text = """URINARY TRACT INFECTION (UTI) ICU- COMMUNITY ACQUIRED
Empiric therapy
Type 1 Type 2 Type 3
Cefoperazone-Sulbactam
OR
Piperacillin-Tazobactam
Patient Risk Stratification and Empiric choice
"""

    rows = extract_local_empiric_rows(source, 12, text, "2026-05-16T00:00:00+00:00")

    assert rows
    assert rows[0].infection_site == "Urinary Tract Infection (UTI)"
    assert rows[0].setting == "ICU"
    assert rows[0].acquisition == "Community-acquired"
    assert {row.drug for row in rows} >= {"Cefoperazone-Sulbactam", "Piperacillin-Tazobactam"}


def test_febrile_neutropenia_extracts_source_backed_regimen_and_duration():
    source = SourceFile("guide.pdf", "/tmp/guide.pdf", "abc", "application/pdf")
    text = """Gram-negative pathogens
Enterobacteriaceae
Pseudomonas aeruginosa
Polymixin B to be started empirically if stool CRE screen positive
Piperacillin tazobactam 4.5g IV q6-8h OR
Meropenem 2g q8h OR
Imipenem 1g q6-8h OR
Doripenem 500mg-1g q8h +/-
Vancomycin 15mg/kg IV 12h OR Teicoplanin 12mg/kg/d q12h x 3 doses followed by 12mg/kg/d +/-
CRE Risk factors:
Polymixin B IV 15 lac units SD followed by 5 lac units q8h/ Colistin 9mU SD followed by 4.5mU 12hrly
Ceftazidime avibactam + Aztreonam (ID consult advised)
Febrile neutropenia
Malignant otitis externa
DURATION OF TREATMENT
Febrile Neutropenia If source identified, treat as per site of infection
Discontinue antibiotic if no source identified & patient has been afebrile for at least two days and ANC is ≥500 cells/microL with a consistently increasing trend
Deep Neck space infection 2-3 weeks
"""

    rows = extract_febrile_neutropenia_rows(
        source,
        7,
        text,
        "2026-05-16T00:00:00+00:00",
    )

    assert {row.infection_site for row in rows} == {"Febrile Neutropenia"}
    assert {row.syndrome for row in rows} == {"Febrile Neutropenia"}
    assert any(
        row.drug == "Piperacillin tazobactam"
        and row.dose == "4.5g"
        and row.route == "IV"
        and row.frequency == "q6-8h"
        for row in rows
    )
    assert any(row.drug == "Meropenem" and row.dose == "2g" for row in rows)
    assert any(
        row.drug == "Ceftazidime avibactam + Aztreonam"
        and row.id_consult_trigger
        for row in rows
    )
    assert any(
        row.duration
        == "Discontinue antibiotic if no source identified & patient has been afebrile for at least two days and ANC is ≥500 cells/microL with a consistently increasing trend"
        for row in rows
    )


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
