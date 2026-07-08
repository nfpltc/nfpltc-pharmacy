# NFP Statement Service

Python sidecar that does the heavy PDF work for the pharmacy statement feature —
parsing a **2,000+ page encrypted** monthly statement PDF into a per-customer
page-range index, and extracting one customer's pages on demand. This runs
outside Vercel because a 2,000-page encrypted PDF exceeds serverless memory/time
limits.

## Why a separate service
- `pdf-lib`/`pdfjs` in a Vercel function would OOM or time out on 2,000 pages.
- Python + `pypdf` streams large PDFs cheaply and decrypts password-protected files.
- Mirrors the existing `OCR_SERVICE_URL` sidecar pattern.

## Endpoints
- `GET /health`
- `POST /index` — multipart `file` (bulk PDF) + `password` → `{ meta, customers[] }`
  where each customer is `{ account_number, first_name, last_name, facility,
  amount_due, bill_date, start_page, end_page, pages }` (0-based page indexes).
- `POST /extract` — JSON `{ pdf_url, start_page, end_page, password }` → the
  extracted customer PDF (`application/pdf`). `pdf_url` is a Supabase signed URL
  to the stored bulk PDF, so we don't re-upload the whole file per download.

All endpoints require `Authorization: Bearer $STATEMENT_SERVICE_TOKEN` if that
env var is set.

## Grouping rule (handles 1, 2, 3+ pages per customer)
A new customer starts on any page whose `Account Number` differs from the
current one. A page with **no header** or the **same account** is a continuation.
So each customer spans `start_page … the page before the next new account`.

## Run locally
```bash
pip install -r requirements.txt
uvicorn app:app --reload --port 7860
```

## Deploy (Hugging Face Spaces — free, Docker)
1. Create a new **Docker** Space.
2. Upload `app.py`, `statement_engine.py`, `requirements.txt`, `Dockerfile`.
3. Add a Space secret `STATEMENT_SERVICE_TOKEN` (any random string).
4. The Space URL becomes `STATEMENT_SERVICE_URL` in the Next.js app; set
   `STATEMENT_SERVICE_TOKEN` there to the same value.

(Render/Fly work too — same Dockerfile.)
