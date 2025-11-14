# backend/utils.py
from fastapi import HTTPException

def validate_symbol_list(symbols):
    if not symbols or not isinstance(symbols, list) or len(symbols) == 0:
        raise HTTPException(status_code=400, detail="Provide at least one symbol in JSON body or query param.")
    if len(symbols) > 60:
        # safety cap
        raise HTTPException(status_code=400, detail="Max 60 symbols at once to avoid rate limiting.")
