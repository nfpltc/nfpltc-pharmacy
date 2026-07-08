"""
North Falmouth Pharmacy — Statement Service (FastAPI sidecar).

Handles the heavy PDF work that can't run in Vercel serverless: parsing a
2,000+ page encrypted monthly statement PDF into a per-customer page-range
index, and extracting one customer's pages on demand.

Deploy free on Hugging Face Spaces (Docker) or Render, set STATEMENT_SERVICE_URL
in the Next.js app to point here. Protect with STATEMENT_SERVICE_TOKEN.

Endpoints:
  GET  /health
  POST /index    (multipart: file, password)  -> { meta, customers[] }
  POST /extract  (json: pdf_url | file, start_page, end_page, password) -> application/pdf
"""
import os
import io
import httpx
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.responses import JSONResponse, Response

import statement_engine as se

app = FastAPI(title="NFP Statement Service")
TOKEN = os.environ.get("STATEMENT_SERVICE_TOKEN", "")


def _auth(authorization: str | None):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"ok": True, "service": "nfp-statement-service"}


@app.post("/index")
async def index(
    file: UploadFile = File(...),
    password: str = Form(""),
    authorization: str | None = Header(default=None),
):
    _auth(authorization)
    data = await file.read()
    try:
        customers, meta = se.build_index(io.BytesIO(data), password=password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"index_failed: {e}")
    return JSONResponse({"meta": meta, "customers": customers})


@app.post("/extract")
async def extract(
    payload: dict,
    authorization: str | None = Header(default=None),
):
    _auth(authorization)
    start = int(payload.get("start_page"))
    end = int(payload.get("end_page"))
    password = payload.get("password", "")
    pdf_url = payload.get("pdf_url")
    if not pdf_url:
        raise HTTPException(status_code=400, detail="pdf_url required")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get(pdf_url)
            r.raise_for_status()
            data = r.content
        out = se.extract_range(io.BytesIO(data), start, end, password=password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"extract_failed: {e}")
    return Response(content=out, media_type="application/pdf")
