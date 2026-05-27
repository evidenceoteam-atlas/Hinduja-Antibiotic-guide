from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

SAFE_EMPTY_MESSAGE = (
    "No approved source-backed ground-truth data available. Refer institutional "
    "guideline / ID specialist."
)


class GroundTruthRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def icmr_guidelines(self) -> list[dict[str, Any]]:
        return await self._fetch_all(
            """
            select *
            from public.approved_icmr_guideline_rows_with_source
            order by clinical_condition
            """
        )

    async def icmr_guideline(self, clinical_condition: str) -> dict[str, Any] | None:
        rows = await self._fetch_all(
            """
            select *
            from public.approved_icmr_guideline_rows_with_source
            where lower(clinical_condition) = lower(:clinical_condition)
            order by clinical_condition
            """,
            {"clinical_condition": clinical_condition},
        )
        return rows[0] if rows else None

    async def durations(self) -> list[dict[str, Any]]:
        return await self._fetch_all(
            """
            select *
            from public.approved_duration_guideline_rows_with_source
            order by infection
            """
        )

    async def antibiograms(self, infection_type: str | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {}
        where_clause = ""
        if infection_type:
            where_clause = "where lower(infection_type) = lower(:infection_type)"
            params["infection_type"] = infection_type

        sheets = await self._fetch_all(
            f"""
            select *
            from public.approved_antibiogram_sheets_with_source
            {where_clause}
            order by infection_type, location, acquisition
            """,
            params,
        )
        if not sheets:
            return []

        sheet_keys = {
            self._sheet_key(sheet["infection_type"], sheet["location"], sheet["acquisition"])
            for sheet in sheets
        }
        pathogens = self._group_by_sheet_key(
            await self._fetch_all(
                """
                select *
                from public.approved_antibiogram_pathogen_rows_with_source
                order by sheet_key, risk_type, sno, pathogen_name
                """
            ),
            sheet_keys,
        )
        risk_criteria = self._group_by_sheet_key(
            await self._fetch_all(
                """
                select *
                from public.approved_antibiogram_risk_criteria_with_source
                order by sheet_key, criterion_name
                """
            ),
            sheet_keys,
        )
        empiric_therapy = self._group_by_sheet_key(
            await self._fetch_all(
                """
                select *
                from public.approved_antibiogram_empiric_therapy_with_source
                order by sheet_key, risk_type
                """
            ),
            sheet_keys,
        )
        footnotes = self._group_by_sheet_key(
            await self._fetch_all(
                """
                select *
                from public.approved_antibiogram_footnotes_with_source
                order by sheet_key, risk_type, note
                """
            ),
            sheet_keys,
        )

        enriched = []
        for sheet in sheets:
            sheet_key = self._sheet_key(
                sheet["infection_type"], sheet["location"], sheet["acquisition"]
            )
            enriched.append(
                sheet
                | {
                    "sheet_key": sheet_key,
                    "pathogen_rows": pathogens[sheet_key],
                    "risk_criteria": risk_criteria[sheet_key],
                    "empiric_therapy": empiric_therapy[sheet_key],
                    "footnotes": footnotes[sheet_key],
                }
            )
        return enriched

    async def organisms(self) -> list[dict[str, Any]]:
        return await self._fetch_all(
            """
            select distinct pathogen_name
            from public.approved_antibiogram_pathogen_rows_with_source
            where pathogen_name is not null and length(btrim(pathogen_name)) > 0
            order by pathogen_name
            """
        )

    async def antibiotic_catalog(self) -> list[dict[str, Any]]:
        return await self._fetch_all(
            """
            select distinct key as antibiotic
            from public.approved_antibiogram_pathogen_rows_with_source,
                 lateral jsonb_object_keys(sensitivities) as key
            order by antibiotic
            """
        )

    async def sensitivity(
        self,
        organism: str,
        department: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"organism": organism}
        where_extra = ""
        if department:
            where_extra = (
                " and (lower(location) = lower(:department)"
                " or lower(sheet_key) like lower(:department_like))"
            )
            params["department"] = department
            params["department_like"] = f"%{department}%"

        return await self._fetch_all(
            f"""
            select sheet_key, risk_type, pathogen_name, isolate_count,
                   prevalence_pct, sensitivities, source_quote, source_page,
                   source_section
            from public.approved_antibiogram_pathogen_rows_with_source
            where lower(pathogen_name) = lower(:organism){where_extra}
            order by sheet_key, risk_type
            """,
            params,
        )

    async def resistance_trends(self) -> list[dict[str, Any]]:
        return await self._fetch_all(
            """
            select pathogen_name, sheet_key, risk_type,
                   key as antibiotic,
                   value as susceptibility_value
            from public.approved_antibiogram_pathogen_rows_with_source,
                 lateral jsonb_each_text(sensitivities) as kv(key, value)
            order by pathogen_name, antibiotic, sheet_key, risk_type
            """
        )

    async def stewardship_pearls(self) -> list[dict[str, Any]]:
        return await self._fetch_all(
            """
            select *
            from public.approved_stewardship_pearl_rows_with_source
            order by section_name, sort_order, pearl_text
            """
        )

    async def perioperative(self) -> dict[str, list[dict[str, Any]]]:
        procedures = await self._fetch_all(
            """
            select *
            from public.approved_perioperative_procedure_recommendations_with_source
            order by procedure
            """
        )
        dosing = await self._fetch_all(
            """
            select *
            from public.approved_perioperative_antibiotic_dosing_with_source
            order by drug
            """
        )
        notes = await self._fetch_all(
            """
            select *
            from public.approved_perioperative_notes_with_source
            order by note_type, sort_order, note_text
            """
        )
        if not procedures and not dosing and not notes:
            return {}
        return {
            "procedure_recommendations": procedures,
            "antibiotic_dosing": dosing,
            "notes": notes,
        }

    async def _fetch_all(
        self, query: str, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        result = await self.session.execute(text(query), params or {})
        return [dict(row) for row in result.mappings().all()]

    @staticmethod
    def _sheet_key(infection_type: str, location: str, acquisition: str) -> str:
        return f"{infection_type}.{location}.{acquisition}"

    @staticmethod
    def _group_by_sheet_key(
        rows: Sequence[dict[str, Any]], sheet_keys: set[str]
    ) -> dict[str, list[dict[str, Any]]]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            sheet_key = row.get("sheet_key")
            if sheet_key in sheet_keys:
                grouped[sheet_key].append(row)
        return grouped
