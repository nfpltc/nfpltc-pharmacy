"""
Statement engine — parse a bulk monthly pharmacy statement PDF into per-customer
page ranges, and extract a single customer's pages on demand.

Handles: encryption (password), variable pages per customer (1, 2, 3+), by
grouping consecutive pages under the same account. A new customer starts on any
page whose Account Number differs from the current one; a page with no header,
or the same account, is a continuation of the current customer.
"""
import re
import io
from pypdf import PdfReader, PdfWriter

MONTHS = {"01": "January", "02": "February", "03": "March", "04": "April",
          "05": "May", "06": "June", "07": "July", "08": "August",
          "09": "September", "10": "October", "11": "November", "12": "December"}


def _open(data_or_path, password=None):
    reader = PdfReader(data_or_path)
    if reader.is_encrypted:
        reader.decrypt(password or "")
    return reader


# Financial/aging fields captured from each customer's summary page.
FIN_KEYS = ("over_30", "over_60", "over_90", "over_120",
            "previous_balance", "payments", "charges", "balance")


def _money(tok):
    try:
        return float(tok.replace("$", "").replace(",", "").replace("−", "-").strip())
    except Exception:
        return None


def _page_fields(text, page_index):
    acct = re.search(r"Account Number:\s*(\S+)", text)
    account_number = acct.group(1) if acct else None
    bill = re.search(r"Bill Date:\s*(\d{2}/\d{2}/\d{4})", text)
    bill_date = bill.group(1) if bill else None
    amt = re.search(r"Amount Due:\s*\$([\d,]+\.\d{2})", text)
    amount_due = float(amt.group(1).replace(",", "")) if amt else None

    first_name = last_name = facility = ""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    name_line = ""
    for i, l in enumerate(lines):
        if l.startswith("FAX:") and i + 1 < len(lines):
            name_line = lines[i + 1]
            break
    if name_line:
        fac = re.search(r"\(([^)]+)\)", name_line)
        if fac:
            facility = fac.group(1)
        clean = re.sub(r"\s*\([^)]+\)\s*", " ", name_line)
        clean = re.sub(r"\s+[A-Z]\.?\s*$", "", clean).strip()
        if "," in clean:
            last_name, first_name = [p.strip() for p in clean.split(",", 1)]
        else:
            last_name = clean
    # Aging / financial summary row (present on the customer's summary page):
    #   "Over 30 Over 60 Over 90 Over 120 Previous Payments Charges Balance"
    #   followed by 8 dollar values in that exact order.
    aging = {}
    for i, l in enumerate(lines):
        if l.startswith("Over 30") and "Over 120" in l and i + 1 < len(lines):
            nums = re.findall(r"-?\$?-?[\d,]+\.\d{2}", lines[i + 1])
            if len(nums) >= 8:
                v = [_money(x) for x in nums[:8]]
                aging = dict(zip(FIN_KEYS, v))
            break
    return {
        "account_number": account_number,
        "first_name": first_name,
        "last_name": last_name,
        "facility": facility,
        "bill_date": bill_date,
        "amount_due": amount_due,
        **aging,
    }


def month_key(bill_date):
    # '03/31/2026' -> ('2026-03', 'March 2026')
    if not bill_date:
        return None, None
    mm, dd, yyyy = bill_date.split("/")
    return f"{yyyy}-{mm}", f"{MONTHS.get(mm, '?')} {yyyy}"


def build_index(data_or_path, password=None):
    """Return (customers, meta). customers = list of per-customer records with
    0-based start_page/end_page (inclusive)."""
    reader = _open(data_or_path, password)
    n = len(reader.pages)
    customers = []
    current = None
    month_ym = month_label = None

    for i in range(n):
        text = reader.pages[i].extract_text() or ""
        f = _page_fields(text, i)
        if month_ym is None and f["bill_date"]:
            month_ym, month_label = month_key(f["bill_date"])

        is_new = f["account_number"] and (current is None or f["account_number"] != current["account_number"])
        if is_new:
            current = {
                "account_number": f["account_number"],
                "first_name": f["first_name"],
                "last_name": f["last_name"],
                "facility": f["facility"],
                "amount_due": f["amount_due"],
                "bill_date": f["bill_date"],
                "start_page": i,
                "end_page": i,
                "pages": 1,
                **{k: None for k in FIN_KEYS},
            }
            customers.append(current)
        elif current is not None:
            current["end_page"] = i
            current["pages"] = current["end_page"] - current["start_page"] + 1
        # Financials live on the summary page (which for multi-page customers may
        # be a later page), so capture them wherever the aging row appears.
        if current is not None and "balance" in f:
            for k in FIN_KEYS:
                current[k] = f[k]

    meta = {"total_pages": n, "customers": len(customers),
            "month_ym": month_ym, "month_label": month_label}
    return customers, meta


def extract_range(data_or_path, start_page, end_page, password=None):
    """Return PDF bytes containing pages start_page..end_page (0-based inclusive)."""
    reader = _open(data_or_path, password)
    writer = PdfWriter()
    for i in range(start_page, end_page + 1):
        writer.add_page(reader.pages[i])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()
