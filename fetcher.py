# backend/fetcher.py
import asyncio
import httpx
from typing import Dict, Any, List, Optional
import time

NSE_BASE = "https://www.nseindia.com"
ENDPOINT = "https://www.nseindia.com/api/option-chain-equities?symbol={symbol}"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
}

# Simple in-memory cache: { (symbol, expiry): (timestamp, parsed_data) }
CACHE: Dict[str, Any] = {}
CACHE_TTL = 60  # seconds

async def _kickstart_client(client: httpx.AsyncClient):
    """Hit root page to set cookies (nse sometimes expects this)."""
    try:
        await client.get(NSE_BASE, headers=DEFAULT_HEADERS, timeout=10)
    except Exception:
        # ignore - best-effort
        pass

async def fetch_raw(symbol: str, client: httpx.AsyncClient) -> dict:
    """Fetch raw JSON from NSE endpoint for a symbol."""
    url = ENDPOINT.format(symbol=symbol)
    # NSE sometimes blocks quickly if many concurrent requests; give small backoff
    for attempt in range(3):
        try:
            r = await client.get(url, headers=DEFAULT_HEADERS, timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            await asyncio.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {symbol} after retries")

def _parse_records(records: dict, expiry: Optional[str] = None):
    data = records.get("data", [])
    filtered = []
    if expiry:
        for item in data:
            ce = item.get("CE")
            pe = item.get("PE")
            # include row if either CE or PE has the expiry requested
            if (ce and ce.get("expiryDate") == expiry) or (pe and pe.get("expiryDate") == expiry):
                filtered.append(item)
    else:
        filtered = data

    calls = []
    puts = []
    for item in filtered:
        strike = item.get("strikePrice")
        ce = item.get("CE", {})
        pe = item.get("PE", {})

        # Coerce numeric fields to int/float safe
        def safe(x, default=0):
            try:
                return x if x is not None else default
            except:
                return default

        calls.append({
            "strike": strike,
            "ltp": safe(ce.get("lastPrice"), None),
            "oi": int(safe(ce.get("openInterest"), 0)),
            "chg_in_oi": int(safe(ce.get("changeinOpenInterest"), 0)),
            "volume": int(safe(ce.get("totalTradedVolume"), 0)),
            "iv": safe(ce.get("impliedVolatility"), None),
            "bid": safe(ce.get("bidprice"), None) or safe(ce.get("bidPrice"), None),
            "ask": safe(ce.get("askPrice"), None),
        })
        puts.append({
            "strike": strike,
            "ltp": safe(pe.get("lastPrice"), None),
            "oi": int(safe(pe.get("openInterest"), 0)),
            "chg_in_oi": int(safe(pe.get("changeinOpenInterest"), 0)),
            "volume": int(safe(pe.get("totalTradedVolume"), 0)),
            "iv": safe(pe.get("impliedVolatility"), None),
            "bid": safe(pe.get("bidprice"), None) or safe(pe.get("bidPrice"), None),
            "ask": safe(pe.get("askPrice"), None),
        })

    # compute totals and highest OI
    def compute(items):
        total_oi = sum(i.get("oi", 0) for i in items)
        highest = None
        if items:
            highest = max(items, key=lambda x: x.get("oi", 0))
        return total_oi, highest

    tot_calls, highest_calls = compute(calls)
    tot_puts, highest_puts = compute(puts)

    return {
        "calls": calls,
        "puts": puts,
        "summary": {
            "total_calls_oi": tot_calls,
            "total_puts_oi": tot_puts,
            "highest_call_oi": highest_calls or {},
            "highest_put_oi": highest_puts or {}
        }
    }

async def get_parsed_option_chain(symbol: str, expiry: Optional[str] = None, client: Optional[httpx.AsyncClient] = None):
    """Return parsed option chain; uses cache for TTL."""
    key = f"{symbol.upper()}|{expiry or 'ALL'}"
    now = time.time()
    entry = CACHE.get(key)
    if entry and now - entry["ts"] < CACHE_TTL:
        return entry["data"]

    # create a client if not passed
    close_client = False
    if client is None:
        client = httpx.AsyncClient()
        close_client = True

    # ensure cookies
    await _kickstart_client(client)
    raw = await fetch_raw(symbol.upper(), client)
    parsed = _parse_records(raw.get("records", {}), expiry=expiry)
    parsed["underlying"] = raw.get("records", {}).get("underlyingValue")
    parsed["expiryDates"] = raw.get("records", {}).get("expiryDates", [])
    CACHE[key] = {"ts": now, "data": parsed}
    if close_client:
        await client.aclose()
    return parsed

async def batch_get(symbols: List[str], expiry: Optional[str] = None, concurrency: int = 6):
    """Fetch many symbols concurrently with a client and limited concurrency."""
    results = {}
    semaphore = asyncio.Semaphore(concurrency)
    async with httpx.AsyncClient() as client:
        async def worker(sym):
            async with semaphore:
                try:
                    parsed = await get_parsed_option_chain(sym, expiry=expiry, client=client)
                    results[sym.upper()] = {"ok": True, "data": parsed}
                except Exception as e:
                    results[sym.upper()] = {"ok": False, "error": str(e)}
                # small pause to be polite
                await asyncio.sleep(0.1)
        await asyncio.gather(*(worker(s) for s in symbols))
    return results
