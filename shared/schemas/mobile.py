from pydantic import BaseModel


class DashboardCard(BaseModel):
    code: str
    title: str
    subtitle: str | None = None
    icon: str
    color: str


class DashboardMetadata(BaseModel):
    doctor_name: str
    search_placeholder: str
    infection_sites: list[DashboardCard]
    bottom_tabs: list[str]


class ProtocolDetail(BaseModel):
    tab: str
    title: str
    rows: list[dict]
    notes: list[str]
