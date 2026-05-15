from typing import Protocol

from shared.clinical.rules import ProtocolEvaluationRequest


class RecommendationRanker(Protocol):
    async def rank(self, request: ProtocolEvaluationRequest, candidates: list[dict]) -> list[dict]:
        """Future ML hook for resistance prediction or therapy ranking."""


class NoopRecommendationRanker:
    async def rank(self, request: ProtocolEvaluationRequest, candidates: list[dict]) -> list[dict]:
        return candidates
