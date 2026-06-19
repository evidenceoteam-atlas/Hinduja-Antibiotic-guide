"""A12 — integration scaffold for the DB-only importer + activation guard.

SKIPPED unless ``HINDUJA_TEST_DATABASE_URL`` points at a Postgres that already has
the full Supabase migration set applied. The migrations require Supabase-specific
objects (the ``auth.users`` table; the ``anon`` / ``authenticated`` / ``service_role``
roles; the ``public.clinical_review_status`` enum; the ``pgcrypto`` extension), so a
plain Postgres will not satisfy them — that is why this is opt-in rather than wired
into the default suite. Use a ``supabase db reset`` local stack or an equivalent
seeded container.

Run:
    HINDUJA_TEST_DATABASE_URL=postgresql://... pytest tests/integration -q

It proves the two things the static tests cannot:
  1. ``import_pending_release`` is idempotent — re-import yields identical counts and
     never flips a row out of ``pending_review``;
  2. the activation guard refuses to activate the freshly-imported pending release
     (expired ``valid_through`` / unresolved corrections / unverified assets), i.e.
     the release flow is fail-closed end to end.

This scaffold is also the home for the deferred A1/A2/A10 checks once those land:
assert ``anon`` reads of ``clinical_recommendations`` and the section views return
zero rows when no release is active.
"""

from __future__ import annotations

import asyncio
import os

import pytest

from scripts.import_hinduja_csv_bundle_to_supabase import import_pending_release

TEST_DB_URL = os.environ.get("HINDUJA_TEST_DATABASE_URL")
asyncpg = pytest.importorskip("asyncpg")
pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="Set HINDUJA_TEST_DATABASE_URL to a migrated Supabase-compatible Postgres to run A12.",
)

RELEASE_KEY = "hinduja-pocket-guide-2025-csv-candidate-v1"


def test_import_pending_release_is_idempotent() -> None:
    first = asyncio.run(import_pending_release(TEST_DB_URL))
    second = asyncio.run(import_pending_release(TEST_DB_URL))

    assert first == second
    assert first["antibiogram_sheets"] == 16
    assert first["antibiogram_therapy_source_slots"] == 48
    assert first["antibiogram_empiric_therapy"] == 40
    assert first["patient_risk_criteria"] == 4

    pending = asyncio.run(_count_non_pending_rows())
    assert pending == 0, "import must never flip a row out of pending_review"


def test_freshly_imported_release_cannot_be_activated() -> None:
    asyncio.run(import_pending_release(TEST_DB_URL))
    error = asyncio.run(_attempt_activation())
    assert error is not None, "the activation guard must reject an unreviewed/expired release"


async def _count_non_pending_rows() -> int:
    conn = await asyncpg.connect(TEST_DB_URL)
    try:
        return int(
            await conn.fetchval(
                """
                select
                  (select count(*) from public.antibiogram_therapy_source_slots
                     where review_status <> 'pending_review')
                + (select count(*) from public.patient_risk_criteria
                     where review_status <> 'pending_review')
                + (select count(*) from public.antibiogram_empiric_therapy
                     where review_status <> 'pending_review')
                """
            )
        )
    finally:
        await conn.close()


async def _attempt_activation() -> str | None:
    conn = await asyncpg.connect(TEST_DB_URL)
    try:
        release_id = await conn.fetchval(
            "select id from public.clinical_dataset_releases where release_key = $1",
            RELEASE_KEY,
        )
        try:
            await conn.execute(
                "update public.clinical_dataset_releases set status = 'active' where id = $1",
                release_id,
            )
            return None  # unreachable: the guard/constraints should raise
        except asyncpg.PostgresError as exc:  # pragma: no cover - exercised only with a DB
            return str(exc)
    finally:
        await conn.close()
