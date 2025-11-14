# NSE Option Tracker

A real-time NSE option chain tracker with stock management and auto-refresh capabilities.

## Features

- **Stock Management**: Add, search, and remove stocks from your watchlist
- **Option Chain Data**: View calls and puts with OI, LTP, and volume
- **Auto Refresh**: Configurable auto-refresh intervals
- **Persistent Storage**: Your stock selections are saved between sessions
- **Comprehensive Stock List**: 180+ NSE F&O stocks included
- **Batch Processing**: Fetch multiple stocks simultaneously
- **CSV Download**: Export option data

## Project Structure

```
nse-option-tracker/
├── backend/
│   ├── app.py              # Flask API server
│   ├── requirements.txt    # Python dependencies
│   ├── saved_stocks.json   # User's saved stocks (auto-generated)
│   └── all_stocks.json     # Master stock list (auto-generated)
└── frontend/
    ├── index.html          # Main UI
    └── app.js              # Frontend JavaScript
```

## Setup & Installation

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install flask flask-cors requests
```

3. Run the Flask server:
```bash
python app.py
```

Server will start on `http://localhost:8000`

### Frontend Setup

1. Open `frontend/index.html` in your web browser
2. The frontend will automatically connect to the backend API

## Usage

### Adding Stocks
- **Search**: Type stock name in search box and click results to add
- **Manual Add**: Type stock symbol in "Add new stock" field and press Enter
- **Bulk Selection**: Use Ctrl/Cmd + click to select multiple stocks

### Viewing Option Data
1. Select stocks from your list
2. Choose expiry date (optional)
3. Click "Fetch" to load option chain data
4. Enable auto-refresh for real-time updates

### Stock Management
- **Remove**: Select stocks and click "Remove Selected"
- **Persistent**: All changes are automatically saved

## API Endpoints

- `GET /api/stocks` - Get user's saved stocks
- `GET /api/search/<query>` - Search available stocks
- `POST /api/add-stock` - Add stock to list
- `POST /api/remove-stock` - Remove stock from list
- `GET /api/option-chain/<symbol>` - Get option chain for symbol
- `POST /api/batch` - Batch fetch multiple stocks
- `GET /api/download/<symbol>` - Download CSV data

## Stock Coverage

Includes all major NSE F&O stocks:
- **Indices**: NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY
- **Banking**: HDFCBANK, ICICIBANK, SBIN, AXISBANK, KOTAKBANK
- **IT**: TCS, INFY, WIPRO, HCLTECH, TECHM
- **Auto**: MARUTI, TATAMOTORS, BAJAJ-AUTO, M&M
- **Pharma**: SUNPHARMA, DRREDDY, CIPLA, LUPIN
- **FMCG**: HINDUNILVR, ITC, NESTLEIND, BRITANNIA
- And 150+ more stocks

## Configuration

### Auto Refresh
- Minimum interval: 10 seconds
- Default interval: 60 seconds
- Configurable via UI

### Data Storage
- `saved_stocks.json`: User's selected stocks
- `all_stocks.json`: Master searchable stock list
- Both files are auto-generated and persistent

## Troubleshooting

### Backend Issues
- Ensure Flask is installed: `pip install flask flask-cors requests`
- Check if port 8000 is available
- Verify Python version compatibility

### Frontend Issues
- Ensure backend is running on localhost:8000
- Check browser console for API connection errors
- Verify CORS is enabled in backend

### Virtual Environment
If using venv, activate it first:
```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

## Development

### Adding New Features
1. Backend changes go in `backend/app.py`
2. Frontend changes go in `frontend/app.js` and `frontend/index.html`
3. API endpoints follow REST conventions

### Data Format
Option data structure:
```json
{
  "underlying": "NIFTY - 21500.00",
  "calls": [{"strike": 21000, "oi": 1500, "ltp": 520.5, "volume": 100}],
  "puts": [{"strike": 21000, "oi": 1200, "ltp": 180.5, "volume": 80}],
  "summary": {
    "total_calls_oi": 5800,
    "total_puts_oi": 6400,
    "highest_call_oi": {"oi": 2500},
    "highest_put_oi": {"oi": 3000}
  }
}
```

## License

Open source project for educational and personal use.
