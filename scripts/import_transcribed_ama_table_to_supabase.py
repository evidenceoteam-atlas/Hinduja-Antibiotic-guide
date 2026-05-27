"""Import the transcribed ICMR AMA table as approved source-backed rows.

The embedded data is copied from the user-provided transcription. This script
does not parse, complete, normalize, or infer clinical content.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import asyncpg


SOURCE_IMAGE_FILENAME = "1779705175121-92f99181-4a45-4e84-91de-5929d43f05f9_3.jpg"
DEFAULT_SOURCE_IMAGE_PATH = Path(
    "/Users/sravya/Downloads/Antibiotic%20protocol%20pocket%20guide%20%281%29"
) / SOURCE_IMAGE_FILENAME
MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "supabase/migrations/20260525_source_table_ama_fields.sql"
)


TRANSCRIBED_ROWS: list[dict[str, Any]] = [
    {
        "source_page": 4,
        "source_image_filename": SOURCE_IMAGE_FILENAME,
        "clinical_condition": "CAP",
        "common_pathogens": "Streptococcus pneumoniae, Haemophilus influenza, Mycoplasma, Chlamydia, respiratory viruses",
        "empirical_ama": "Amoxicillin-clavulanate 1.2g IV q8h OR Ceftriaxone 1g IV q12h + Azithromycin 500mg OD OR Doxycycline 100mg BD",
        "alternate_ama": "For patients with structural lung disease/recent antibiotic use/immunosuppression Piperacillin tazobactam IV 4.5g q8h + Azithromycin OR Doxycycline",
        "comments": "Avoid FQNs Oseltamivir only if clinical suspicion of H1N1",
        "source_quote": "Clinical Condition: CAP | Common Pathogens: Streptococcus pneumoniae, Haemophilus influenza, Mycoplasma, Chlamydia, respiratory viruses | Empirical AMA: Amoxicillin-clavulanate 1.2g IV q8h OR Ceftriaxone 1g IV q12h + Azithromycin 500mg OD OR Doxycycline 100mg BD | Alternate AMA: For patients with structural lung disease/recent antibiotic use/immunosuppression Piperacillin tazobactam IV 4.5g q8h + Azithromycin OR Doxycycline | Comments: Avoid FQNs Oseltamivir only if clinical suspicion of H1N1",
    },
    {
        "source_page": 4,
        "source_image_filename": SOURCE_IMAGE_FILENAME,
        "clinical_condition": "HCAP/Early onset VAP",
        "common_pathogens": "Staph aureus, Pseudomonas aeruginosa, Gram-negative enterobacteriaceae",
        "empirical_ama": "Piperacillin tazobactam IV 4.5g q6-8h OR Cefoperazone sulbactam (2:1) 3g IV q12h",
        "alternate_ama": "Meropenem 1g IV q8h OR Imipenem 500mg IV q6h OR Doripenem 500mg-1g IV q8h",
        "comments": "Consider polymyxin B/colistin/ceftazidime avibactam + aztreonam (ID consult advised) if risk factors for CRE, Vancomycin/linezolid if MRSA risk factors",
        "source_quote": "Clinical Condition: HCAP/Early onset VAP | Common Pathogens: Staph aureus, Pseudomonas aeruginosa, Gram-negative enterobacteriaceae | Empirical AMA: Piperacillin tazobactam IV 4.5g q6-8h OR Cefoperazone sulbactam (2:1) 3g IV q12h | Alternate AMA: Meropenem 1g IV q8h OR Imipenem 500mg IV q6h OR Doripenem 500mg-1g IV q8h | Comments: Consider polymyxin B/colistin/ceftazidime avibactam + aztreonam (ID consult advised) if risk factors for CRE, Vancomycin/linezolid if MRSA risk factors",
    },
    {
        "source_page": 4,
        "source_image_filename": SOURCE_IMAGE_FILENAME,
        "clinical_condition": "[BLANK]",
        "common_pathogens": "MDR enterobacteriaceae Pseudomonas spp, Acinetobacter spp, Staph aureus (MRSA), invasive mold infections",
        "empirical_ama": "Meropenem 1g q8h OR Imipenem 500mg q6h OR Doripenem 500mg q8h + Vancomycin 25-30 mg/kg loading dose followed by 15 mg/kg every 8-12 hrs (target trough concentration 15-20 mcg/ml) OR Linezolid 600 mg BD",
        "alternate_ama": "Polymyxin B IV 15 lac units loading dose followed by 5 lac units q8h + Carbapenem + Vancomycin 25-30 mg/kg loading dose followed by 15 mg/kg every 8-12 hrs (target trough concentration 15-20 mcg/ml) OR Linezolid 600 mg BD",
        "comments": "For CRE: ceftazidime avibactam + aztreonam (ID consult advised) Voriconazole/Liposomal Amphotericin B for invasive mold infection (ID consult advised)",
        "source_quote": "Clinical Condition: [BLANK] | Common Pathogens: MDR enterobacteriaceae Pseudomonas spp, Acinetobacter spp, Staph aureus (MRSA), invasive mold infections | Empirical AMA: Meropenem 1g q8h OR Imipenem 500mg q6h OR Doripenem 500mg q8h + Vancomycin 25-30 mg/kg loading dose followed by 15 mg/kg every 8-12 hrs (target trough concentration 15-20 mcg/ml) OR Linezolid 600 mg BD | Alternate AMA: Polymyxin B IV 15 lac units loading dose followed by 5 lac units q8h + Carbapenem + Vancomycin 25-30 mg/kg loading dose followed by 15 mg/kg every 8-12 hrs (target trough concentration 15-20 mcg/ml) OR Linezolid 600 mg BD | Comments: For CRE: ceftazidime avibactam + aztreonam (ID consult advised) Voriconazole/Liposomal Amphotericin B for invasive mold infection (ID consult advised)",
    },
    {
        "source_page": 4,
        "source_image_filename": SOURCE_IMAGE_FILENAME,
        "clinical_condition": "Lung abscess",
        "common_pathogens": "Polymicrobial (Anaerobes, staph aureus, GNB)",
        "empirical_ama": "Ampicillin sulbactam 3g IV q6h +/- Clindamycin 600mg IV q8h Combination regimens- Nocardia- Amikacin/ Linezolid/ TMP SMX",
        "alternate_ama": "Piperacillin tazobactam IV 4.5g q6-8h OR Meropenem 1g q8h OR Imipenem 500mg q6h OR Doripenem 500mg q8h",
        "comments": "Anaerobic cover not routinely required with BLBLI/carbapenem use Prolonged treatment on OPD basis with amoxicillin clavulanate",
        "source_quote": "Clinical Condition: Lung abscess | Common Pathogens: Polymicrobial (Anaerobes, staph aureus, GNB) | Empirical AMA: Ampicillin sulbactam 3g IV q6h +/- Clindamycin 600mg IV q8h Combination regimens- Nocardia- Amikacin/ Linezolid/ TMP SMX | Alternate AMA: Piperacillin tazobactam IV 4.5g q6-8h OR Meropenem 1g q8h OR Imipenem 500mg q6h OR Doripenem 500mg q8h | Comments: Anaerobic cover not routinely required with BLBLI/carbapenem use Prolonged treatment on OPD basis with amoxicillin clavulanate",
    },
    {
        "source_page": 5,
        "source_image_filename": SOURCE_IMAGE_FILENAME,
        "clinical_condition": "[BLANK]",
        "common_pathogens": "Susceptible host Nocardia spp, Actinomyces spp, Burkholderia pseudomallei",
        "empirical_ama": "Actinomyces- Penicillin G 18-24mil U/day (2-6weeks) f/b amoxicillin 500-750mg TDS/QDS Melioidosis- Ceftazidime/ meropenem +/- TMP SMX",
        "alternate_ama": "Nocardia-ceftriaxone/imipenem/moxifloxacin/minocycline Actinomyces-doxycycline, clindamycin TMP SMX/doxycycline/amoxicillin clavulanate",
        "comments": "ID Consult advised for patients at risk of opportunistic pathogens Empirical treatment discouraged",
        "source_quote": "Clinical Condition: [BLANK] | Common Pathogens: Susceptible host Nocardia spp, Actinomyces spp, Burkholderia pseudomallei | Empirical AMA: Actinomyces- Penicillin G 18-24mil U/day (2-6weeks) f/b amoxicillin 500-750mg TDS/QDS Melioidosis- Ceftazidime/ meropenem +/- TMP SMX | Alternate AMA: Nocardia-ceftriaxone/imipenem/moxifloxacin/minocycline Actinomyces-doxycycline, clindamycin TMP SMX/doxycycline/amoxicillin clavulanate | Comments: ID Consult advised for patients at risk of opportunistic pathogens Empirical treatment discouraged",
    },
    {
        "source_page": 5,
        "source_image_filename": SOURCE_IMAGE_FILENAME,
        "clinical_condition": "Native Valve/Late Prosthetic Valve Infective Endocarditis (>1yr)",
        "common_pathogens": "VGS, S aureus, β-hemolytic Streptococci, HACEK, enterococcus",
        "empirical_ama": "Ampicillin 2g IV q4h (12g/d) + Cloxacillin/(Flucloxacillin 2g IV q4h (12g/d)/ Cefazolin 2g IV q8h + Gentamicin 3mg/kg/d single dose",
        "alternate_ama": "Vancomycin 30-60mg/kg/day in 2-3 doses (target trough concentration 15-20mcg/ml) + Gentamicin 3mg/kg/d single dose",
        "comments": "Daptomycin 10mg/kg/d may be considered if unable to use vancomycin (ID consult advised)",
        "source_quote": "Clinical Condition: Native Valve/Late Prosthetic Valve Infective Endocarditis (>1yr) | Common Pathogens: VGS, S aureus, β-hemolytic Streptococci, HACEK, enterococcus | Empirical AMA: Ampicillin 2g IV q4h (12g/d) + Cloxacillin/(Flucloxacillin 2g IV q4h (12g/d)/ Cefazolin 2g IV q8h + Gentamicin 3mg/kg/d single dose | Alternate AMA: Vancomycin 30-60mg/kg/day in 2-3 doses (target trough concentration 15-20mcg/ml) + Gentamicin 3mg/kg/d single dose | Comments: Daptomycin 10mg/kg/d may be considered if unable to use vancomycin (ID consult advised)",
    },
    {
        "source_page": 5,
        "source_image_filename": SOURCE_IMAGE_FILENAME,
        "clinical_condition": "Prosthetic valve Infective Endocarditis (<1yr)",
        "common_pathogens": "Staph aureus, CONS, enterococci, aerobic Gram-negative bacilli",
        "empirical_ama": "Ceftriaxone 2g IV q12h + Vancomycin 30-60mg/kg/day in 2-3 doses (target trough concentration 15-20mcg/ml) + Rifampicin 900-1200mg/d OR Meropenem 2g IV q8h + Vancomycin 30-60mg/kg/day in 2-3 doses (target trough concentration 15-20mcg/ml) + Rifampicin 900-1200mg/d",
        "alternate_ama": "Vancomycin 30-60mg/kg/day in 2-3 doses (target trough concentration 15-20mcg/ml) + Gentamicin 3mg/kg/d single dose + Rifampicin 900-1200mg/d",
        "comments": "Rifampin should be used in PVE after 3-5 days of effective antibiotic therapy, once the bacteremia is cleared.",
        "source_quote": "Clinical Condition: Prosthetic valve Infective Endocarditis (<1yr) | Common Pathogens: Staph aureus, CONS, enterococci, aerobic Gram-negative bacilli | Empirical AMA: Ceftriaxone 2g IV q12h + Vancomycin 30-60mg/kg/day in 2-3 doses (target trough concentration 15-20mcg/ml) + Rifampicin 900-1200mg/d OR Meropenem 2g IV q8h + Vancomycin 30-60mg/kg/day in 2-3 doses (target trough concentration 15-20mcg/ml) + Rifampicin 900-1200mg/d | Alternate AMA: Vancomycin 30-60mg/kg/day in 2-3 doses (target trough concentration 15-20mcg/ml) + Gentamicin 3mg/kg/d single dose + Rifampicin 900-1200mg/d | Comments: Rifampin should be used in PVE after 3-5 days of effective antibiotic therapy, once the bacteremia is cleared.",
    },
    {
        "source_page": 5,
        "source_image_filename": SOURCE_IMAGE_FILENAME,
        "clinical_condition": "Cellulitis/pyomyositis",
        "common_pathogens": "S. pyogenes, S.aureus",
        "empirical_ama": "Amoxicillin-clavulanate 1.2g IV q12h",
        "alternate_ama": "Cloxacillin 2g IV q8h/ Flucloxacillin 1-2g IV q6-8h OR Cefazolin 2g IV q8h",
        "comments": "If risk factors for MRSA: Clindamycin/doxycycline/minocycline/linezolid",
        "source_quote": "Clinical Condition: Cellulitis/pyomyositis | Common Pathogens: S. pyogenes, S.aureus | Empirical AMA: Amoxicillin-clavulanate 1.2g IV q12h | Alternate AMA: Cloxacillin 2g IV q8h/ Flucloxacillin 1-2g IV q6-8h OR Cefazolin 2g IV q8h | Comments: If risk factors for MRSA: Clindamycin/doxycycline/minocycline/linezolid",
    },
]


@dataclass
class ImportCounts:
    source_files_inserted: int = 0
    source_files_skipped: int = 0
    source_spans_inserted: int = 0
    source_spans_skipped: int = 0
    recommendations_inserted: int = 0
    recommendations_skipped: int = 0
    approved_rows_for_source: int = 0


def database_url_from_env() -> str:
    database_url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("Set SUPABASE_DB_URL to the Supabase Postgres connection string.")
    return database_url


def reviewer_id_from_env() -> str:
    reviewer_id = os.environ.get("CLINICAL_REVIEWER_ID")
    if not reviewer_id:
        raise RuntimeError(
            "Set CLINICAL_REVIEWER_ID to an existing Supabase auth.users id. "
            "Approved recommendations require reviewer_id and reviewed_at."
        )
    return reviewer_id


def image_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_file_sha(path: Path | None) -> str:
    if path and path.exists():
        return image_sha256(path)
    return hashlib.sha256(SOURCE_IMAGE_FILENAME.encode("utf-8")).hexdigest()


def ama_text(row: dict[str, Any], role: str) -> str:
    key = "empirical_ama" if role == "empirical" else "alternate_ama"
    return row[key]


def source_quote_for_role(row: dict[str, Any], role: str) -> str:
    label = "Empirical AMA" if role == "empirical" else "Alternate AMA"
    return (
        f"Clinical Condition: {row['clinical_condition']} | "
        f"Common Pathogens: {row['common_pathogens']} | "
        f"{label}: {ama_text(row, role)} | "
        f"Comments: {row['comments']} | "
        f"Full Source Row: {row['source_quote']}"
    )


async def apply_migration(conn: asyncpg.Connection) -> None:
    await conn.execute(MIGRATION_PATH.read_text(encoding="utf-8"))


async def get_or_insert_source_file(
    conn: asyncpg.Connection,
    image_path: Path | None,
    counts: ImportCounts,
) -> Any:
    file_sha256 = source_file_sha(image_path)
    existing_id = await conn.fetchval(
        "select id from public.clinical_source_files where file_sha256 = $1",
        file_sha256,
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
        SOURCE_IMAGE_FILENAME,
        str(image_path) if image_path else None,
        file_sha256,
        "image/jpeg",
    )
    counts.source_files_inserted += 1
    return inserted_id


async def get_or_insert_source_span(
    conn: asyncpg.Connection,
    source_file_id: Any,
    row: dict[str, Any],
    row_index: int,
    role: str,
    counts: ImportCounts,
) -> Any:
    source_quote = source_quote_for_role(row, role)
    span_start = row_index * 1000 + (1 if role == "empirical" else 2)
    span_end = span_start + len(source_quote)
    existing_id = await conn.fetchval(
        """
        select id
        from public.clinical_source_spans
        where source_file_id = $1
          and page_number = $2
          and span_start = $3
          and span_end = $4
        """,
        source_file_id,
        row["source_page"],
        span_start,
        span_end,
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
        row["source_page"],
        row["clinical_condition"],
        span_start,
        span_end,
        source_quote,
        datetime.now(UTC),
    )
    counts.source_spans_inserted += 1
    return inserted_id


async def insert_approved_recommendation_if_absent(
    conn: asyncpg.Connection,
    source_span_id: Any,
    row: dict[str, Any],
    role: str,
    reviewer_id: str,
    counts: ImportCounts,
) -> None:
    existing_id = await conn.fetchval(
        """
        select id
        from public.clinical_recommendations
        where source_span_id = $1
          and ama_role = $2
        """,
        source_span_id,
        role,
    )
    if existing_id:
        counts.recommendations_skipped += 1
        return

    treatment_text = ama_text(row, role)
    await conn.execute(
        """
        insert into public.clinical_recommendations (
          source_span_id,
          syndrome,
          drug,
          clinical_condition,
          common_pathogens,
          empirical_ama,
          alternate_ama,
          comments,
          ama_role,
          source_image,
          source_page,
          review_status,
          reviewer_id,
          reviewed_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'approved', $12, $13)
        """,
        source_span_id,
        row["clinical_condition"],
        treatment_text,
        row["clinical_condition"],
        row["common_pathogens"],
        row["empirical_ama"],
        row["alternate_ama"],
        row["comments"],
        role,
        row["source_image_filename"],
        row["source_page"],
        reviewer_id,
        datetime.now(UTC),
    )
    counts.recommendations_inserted += 1


async def verify_rows(conn: asyncpg.Connection) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        select
          clinical_condition,
          ama_role,
          common_pathogens,
          empirical_ama,
          alternate_ama,
          comments,
          source_image,
          source_page,
          source_quote
        from public.approved_clinical_recommendations_with_source
        where source_image = $1
        order by source_page, clinical_condition, ama_role
        """,
        SOURCE_IMAGE_FILENAME,
    )


async def import_rows(
    database_url: str,
    reviewer_id: str,
    image_path: Path | None,
    *,
    apply_schema_migration: bool,
) -> tuple[ImportCounts, list[asyncpg.Record]]:
    counts = ImportCounts()
    conn = await asyncpg.connect(database_url)
    try:
        async with conn.transaction():
            if apply_schema_migration:
                await apply_migration(conn)
            source_file_id = await get_or_insert_source_file(conn, image_path, counts)
            for row_index, row in enumerate(TRANSCRIBED_ROWS, start=1):
                for role in ("empirical", "alternate"):
                    span_id = await get_or_insert_source_span(
                        conn,
                        source_file_id,
                        row,
                        row_index,
                        role,
                        counts,
                    )
                    await insert_approved_recommendation_if_absent(
                        conn,
                        span_id,
                        row,
                        role,
                        reviewer_id,
                        counts,
                    )
            verified_rows = await verify_rows(conn)
            counts.approved_rows_for_source = len(verified_rows)
    finally:
        await conn.close()
    return counts, verified_rows


def print_counts(counts: ImportCounts) -> None:
    print(f"clinical_source_files inserted: {counts.source_files_inserted}")
    print(f"clinical_source_files skipped: {counts.source_files_skipped}")
    print(f"clinical_source_spans inserted: {counts.source_spans_inserted}")
    print(f"clinical_source_spans skipped: {counts.source_spans_skipped}")
    print(f"clinical_recommendations inserted: {counts.recommendations_inserted}")
    print(f"clinical_recommendations skipped: {counts.recommendations_skipped}")
    print(f"approved rows for source image: {counts.approved_rows_for_source}")


async def async_main() -> None:
    parser = argparse.ArgumentParser(
        description="Import the transcribed ICMR AMA table into Supabase."
    )
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--reviewer-id", default=None)
    parser.add_argument("--source-image", type=Path, default=DEFAULT_SOURCE_IMAGE_PATH)
    parser.add_argument(
        "--apply-migration",
        action="store_true",
        help="Apply the AMA table field migration before importing.",
    )
    args = parser.parse_args()

    database_url = args.database_url or database_url_from_env()
    reviewer_id = args.reviewer_id or reviewer_id_from_env()
    image_path = args.source_image if args.source_image.exists() else None
    counts, rows = await import_rows(
        database_url,
        reviewer_id,
        image_path,
        apply_schema_migration=args.apply_migration,
    )
    print_counts(counts)
    print("verified SELECT rows:")
    for row in rows:
        print(dict(row))


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
