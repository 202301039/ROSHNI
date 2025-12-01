# llm_report_generator.py
# This module integrates with logs.py and reports.py to:
# 1. Fetch all logs for an incident
# 2. Generate a full incident report using an LLM
# 3. Generate a PDF version of the report
#
# PLACE THIS FILE INSIDE: app/routers/ OR app/services/ (your choice)
# Ensure you have OPENAI_API_KEY configured in environment variables.

import openai
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from app.database import get_db
from app.models.questionnaires_and_logs import DisasterLog
from app.models.reports import IncidentReport

router = APIRouter(prefix="/ai-reports", tags=["AI Report Generator"])

# ------------------------------
# Utility to convert logs to dict
# ------------------------------
def convert_log_to_dict(log):
    return {
        "log_id": str(log.log_id),
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "event_type": log.event_type,
        "source_type": log.source_type,
        "data": log.data,
        "created_by_user_id": str(log.created_by_user_id) if log.created_by_user_id else None,
    }

# ------------------------------
# Generate Report via LLM
# ------------------------------
async def generate_llm_report(logs: list[dict]):
    prompt = (
        "You are an emergency incident reporting AI. Create a professional, factual, chronological "
        "incident report using ONLY the following logs. No assumptions, no hallucinations. "
        "Structure the report with sections: Summary, Timeline of Events, Civilian Inputs, Responder Actions, "
        "Environmental Factors, Conclusion.\n\nLogs: " + str(logs)
    )

    response = openai.ChatCompletion.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    return response["choices"][0]["message"]["content"]

# ------------------------------
# PDF Generation Utility
# ------------------------------
def create_report_pdf(report_text: str, incident_id: UUID):
    pdf_path = f"/mnt/data/incident_report_{incident_id}.pdf"
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(pdf_path, pagesize=A4)
    story = [Paragraph(report_text.replace("\n", "<br/>"), styles["Normal"])]
    doc.build(story)
    return pdf_path

# ------------------------------
# MAIN ENDPOINT: Generate AI Report + PDF
# ------------------------------
@router.post("/generate/{incident_id}")
async def create_ai_report(incident_id: UUID, db: AsyncSession = Depends(get_db)):
    # Fetch logs
    stmt = select(DisasterLog).where(DisasterLog.disaster_id == incident_id).order_by(DisasterLog.timestamp)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    if not logs:
        raise HTTPException(status_code=404, detail="No logs found for this incident")

    logs_dict = [convert_log_to_dict(l) for l in logs]

    # LLM -> Generate Report Text
    report_text = await generate_llm_report(logs_dict)

    # Save in DB
    report = IncidentReport(
        incident_id=incident_id,
        draft_text=report_text,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Generate PDF
    pdf_file = create_report_pdf(report_text, incident_id)

    return {
        "message": "AI Report generated successfully",
        "report_id": str(report.report_id),
        "pdf_path": pdf_file,
        "preview": report_text[:300] + "...",
    }
