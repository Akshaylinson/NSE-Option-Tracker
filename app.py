# backend/app.py
from fastapi import FastAPI, Query, HTTPException, Body
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import io
import pandas as pd
import asyncio

from fetcher import get_parsed_option_chain, batch_get
from utils import validate_symbol_list

app = FastAPI(title="NSE Option Chain Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sample default list you can replace with your 30-40 symbols
DEFAULT_SYMBOLS = ["ABB", "RELIANCE", "TCS", "INFY", "HDFCBANK", "SBIN", "LT", "ITC", "ONGC"]

@app.get("/api/stocks")
async def get_stocks():
    """Return default symbol list (replace with your list or DB later)."""
    return {"symbols": DEFAULT_SYMBOLS}

@app.get("/api/option-chain/{symbol}")
async def option_chain(symbol: str, expiry: Optional[str] = Query(None, description="Expiry like 25-Nov-2025")):
    """Returns parsed calls/puts/summary/underlying/expiryDates for one symbol."""
    try:
        parsed = await get_parsed_option_chain(symbol.upper(), expiry=expiry)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return parsed

@app.post("/api/batch")
async def batch(symbols: List[str] = Body(..., description="List of symbols"), expiry: Optional[str] = None, concurrency: int = Query(6)):
    """Batch fetch many symbols concurrently. Returns mapping symbol->parsed result."""
    validate_symbol_list(symbols)
    # keep concurrency reasonable (default 6)
    results = await batch_get(symbols, expiry=expiry, concurrency=concurrency)
    return results

@app.get("/api/download/{symbol}")
async def download_csv(symbol: str, expiry: Optional[str] = None):
    """Download CSV combining calls & puts side-by-side for a symbol/expiry."""
    parsed = await get_parsed_option_chain(symbol.upper(), expiry=expiry)
    calls = parsed.get("calls", [])
    puts = parsed.get("puts", [])
    # Align by index (strike order should match)
    calls_df = pd.DataFrame(calls).add_prefix("call_")
    puts_df = pd.DataFrame(puts).add_prefix("put_")
    combined = pd.concat([calls_df, puts_df], axis=1)

    buf = io.StringIO()
    combined.to_csv(buf, index=False)
    buf.seek(0)
    fname = f"{symbol.upper()}_{expiry or 'all'}_optionchain.csv"
    headers = {"Content-Disposition": f"attachment; filename={fname}"}
    return StreamingResponse(iter([buf.read()]), media_type="text/csv", headers=headers)
