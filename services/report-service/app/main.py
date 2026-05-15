from io import BytesIO
from uuid import uuid4

import qrcode
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from shared.events.bus import EventBus
from shared.schemas.common import ApiResponse
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("report-service")
app = FastAPI(title="PDF & Report Service", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "report-service")
events = EventBus()


class PdfRequest(BaseModel):
    case_id: str
    doctor_name: str
    risk_type: str
    infection_summary: str
    recommendation: dict


@app.post("/api/v1/reports/pdf")
async def create_pdf(payload: PdfRequest):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setTitle("Hinduja Antibiotic Guide Protocol Report")
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(50, height - 60, "Hinduja Antibiotic Guide")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, height - 78, "Protocol Report")
    pdf.line(50, height - 92, width - 50, height - 92)

    y = height - 125
    for label, value in [
        ("Case ID", payload.case_id),
        ("Doctor", payload.doctor_name),
        ("Classification", payload.risk_type),
        ("Infection", payload.infection_summary),
    ]:
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(50, y, f"{label}:")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(150, y, str(value))
        y -= 22

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(50, y - 10, "Recommended Empiric Therapy")
    y -= 35
    for therapy in payload.recommendation.get("recommended_therapy", []):
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(60, y, f"{therapy.get('rank')}. {therapy.get('antibiotic')}")
        y -= 16
        pdf.setFont("Helvetica", 9)
        pdf.drawString(
            80, y, f"{therapy.get('dose')} | {therapy.get('frequency')} | {therapy.get('duration')}"
        )
        y -= 22

    link = f"https://guide.hindujahospital.com/cases/{payload.case_id}"
    qr_image = qrcode.make(link)
    qr_buffer = BytesIO()
    qr_image.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    pdf.drawString(50, 110, "Scan QR in app to reopen protocol")
    pdf.drawInlineImage(qr_image, 50, 25, 70, 70)
    pdf.showPage()
    pdf.save()
    buffer.seek(0)

    await events.publish("pdf.exported", {"case_id": payload.case_id, "report_id": str(uuid4())})
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="protocol-{payload.case_id}.pdf"'},
    )


@app.post("/api/v1/reports/pdf/metadata", response_model=ApiResponse[dict])
async def pdf_metadata(payload: PdfRequest):
    return ApiResponse(
        message="PDF metadata prepared", data={"case_id": payload.case_id, "ready": True}
    )
