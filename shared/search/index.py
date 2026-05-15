class SearchIndex:
    async def index_guideline(self, guideline_id: str, document: dict) -> None:
        """OpenSearch adapter seam; local deployments can replace this with a real client."""
        return None

    async def search(self, query: str) -> list[dict]:
        return []
