// frontend/app.js
const API_BASE = "http://localhost:8000/api"; // change to backend host if needed

async function fetchJSON(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}

async function loadStocks() {
  const data = await fetchJSON(`${API_BASE}/stocks`);
  const sel = document.getElementById("stocksSelect");
  sel.innerHTML = "";
  data.symbols.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
  // auto-select first few
  for (let i = 0; i < Math.min(6, sel.options.length); i++) sel.options[i].selected = true;
  // load expiries for the first selected symbol
  await loadExpiries();
}

async function searchStocks(query) {
  if (!query.trim()) {
    document.getElementById("searchResults").classList.add("hidden");
    return;
  }
  try {
    const data = await fetchJSON(`${API_BASE}/search/${encodeURIComponent(query)}`);
    const results = document.getElementById("searchResults");
    results.innerHTML = "";
    data.matches.forEach(stock => {
      const div = document.createElement("div");
      div.className = "p-2 hover:bg-gray-100 cursor-pointer text-sm";
      div.textContent = stock;
      div.onclick = () => addStock(stock);
      results.appendChild(div);
    });
    results.classList.remove("hidden");
  } catch (err) {
    console.error(err);
  }
}

async function addStock(stock) {
  try {
    const res = await fetch(`${API_BASE}/add-stock`, {
      method: "POST",
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({stock})
    });
    const data = await res.json();
    if (data.success) {
      await loadStocks();
      document.getElementById("searchInput").value = "";
      document.getElementById("searchResults").classList.add("hidden");
    }
  } catch (err) {
    console.error(err);
  }
}

async function removeSelectedStocks() {
  const sel = document.getElementById("stocksSelect");
  const selected = Array.from(sel.selectedOptions).map(o => o.value);
  for (const stock of selected) {
    try {
      await fetch(`${API_BASE}/remove-stock`, {
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({stock})
      });
    } catch (err) {
      console.error(err);
    }
  }
  await loadStocks();
}

async function loadExpiries() {
  const sel = document.getElementById("stocksSelect");
  const first = sel.value;
  if (!first) return;
  try {
    const data = await fetchJSON(`${API_BASE}/option-chain/${first}`);
    const expSel = document.getElementById("expirySelect");
    expSel.innerHTML = '<option value="">-- All expiries --</option>';
    (data.expiryDates || []).forEach(e => {
      const o = document.createElement("option");
      o.value = e;
      o.textContent = e;
      expSel.appendChild(o);
    });
    document.getElementById("meta").textContent = `Underlying (${first}): ${data.underlying || "N/A"}`;
  } catch (err) {
    console.error(err);
    document.getElementById("meta").textContent = `Error loading expiries: ${err.message}`;
  }
}

function getSelectedStocks() {
  const sel = document.getElementById("stocksSelect");
  return Array.from(sel.selectedOptions).map(o => o.value);
}

function makeBigTable(allParsed) {
  // allParsed: { SYMBOL: parsedResult }
  // We'll build one large table that for each SYMBOL includes: strike + call columns + put columns
  // The strict table requirement: each row: strike | call_oi | call_ltp | call_vol | strike center | put_oi | put_ltp | put_vol
  const container = document.getElementById("tableContainer");
  // Build header with symbols groups
  let html = '<table class="min-w-full text-sm border-collapse">';
  // header row 1: symbol titles across columns
  html += '<thead><tr class="bg-gray-100">';
  html += '<th class="p-2 text-left sticky left-0">Symbol</th>';
  html += '<th class="p-2">Strike</th>';
  html += '<th class="p-2 text-right">Call OI</th><th class="p-2 text-right">Call LTP</th><th class="p-2 text-right">Call Vol</th>';
  html += '<th class="p-2 text-center">|</th>';
  html += '<th class="p-2 text-right">Put OI</th><th class="p-2 text-right">Put LTP</th><th class="p-2 text-right">Put Vol</th>';
  html += '</tr></thead><tbody>';
  // rows: for each symbol, list rows for all strikes
  for (const sym of Object.keys(allParsed)) {
    const parsed = allParsed[sym];
    const calls = parsed.calls || [];
    const puts = parsed.puts || [];
    const len = Math.max(calls.length, puts.length);
    // Determine highest OI values to highlight
    const highestCallOi = parsed.summary && parsed.summary.highest_call_oi ? parsed.summary.highest_call_oi.oi : 0;
    const highestPutOi = parsed.summary && parsed.summary.highest_put_oi ? parsed.summary.highest_put_oi.oi : 0;
    // Add a header row per symbol
    html += `<tr class="bg-blue-50"><td class="p-2 font-semibold" colspan="9">${sym} — underlying: ${parsed.underlying || '-' } — total Call OI: ${parsed.summary?.total_calls_oi || 0} | total Put OI: ${parsed.summary?.total_puts_oi || 0}</td></tr>`;
    for (let i = 0; i < len; i++) {
      const c = calls[i] || {};
      const p = puts[i] || {};
      const cOi = c.oi || 0;
      const pOi = p.oi || 0;
      const cClass = (cOi === highestCallOi && cOi>0) ? 'bg-yellow-100 font-semibold' : '';
      const pClass = (pOi === highestPutOi && pOi>0) ? 'bg-yellow-100 font-semibold' : '';
      html += `<tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
          <td class="p-2">${sym}</td>
          <td class="p-2">${c.strike ?? p.strike ?? '-'}</td>
          <td class="p-2 text-right ${cClass}">${cOi}</td>
          <td class="p-2 text-right ${cClass}">${c.ltp ?? '-'}</td>
          <td class="p-2 text-right ${cClass}">${c.volume ?? 0}</td>
          <td class="p-2 text-center">|</td>
          <td class="p-2 text-right ${pClass}">${pOi}</td>
          <td class="p-2 text-right ${pClass}">${p.ltp ?? '-'}</td>
          <td class="p-2 text-right ${pClass}">${p.volume ?? 0}</td>
      </tr>`;
    }
    // add a totals footer row for symbol
    html += `<tr class="bg-gray-100 font-semibold"><td class="p-2">${sym} Totals</td><td></td>
            <td class="p-2 text-right">${parsed.summary?.total_calls_oi || 0}</td><td></td><td></td>
            <td></td>
            <td class="p-2 text-right">${parsed.summary?.total_puts_oi || 0}</td><td></td><td></td>
            </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function fetchAndRender() {
  const status = document.getElementById("status");
  status.textContent = "Fetching...";
  const symbols = getSelectedStocks();
  if (symbols.length === 0) {
    status.textContent = "Select at least one stock.";
    return;
  }
  const expiry = document.getElementById("expirySelect").value || null;
  // use batch endpoint (POST)
  try {
    const payload = { symbols: symbols };
    const url = `${API_BASE}/batch` + (expiry ? `?expiry=${encodeURIComponent(expiry)}` : '');
    const res = await fetch(url, {
      method: "POST",
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(symbols)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `HTTP ${res.status}`);
    }
    // The backend returns mapping symbol-> {ok:True, data:...}
    const all = await res.json();
    // Build a cleaned object of symbol->parsedData
    const parsedAll = {};
    for (const s of Object.keys(all)) {
      if (all[s].ok) parsedAll[s] = all[s].data;
      else parsedAll[s] = { calls: [], puts: [], summary: { total_calls_oi: 0, total_puts_oi:0 }, underlying: null };
    }
    makeBigTable(parsedAll);
    status.textContent = `Fetched ${Object.keys(parsedAll).length} symbols`;
  } catch (err) {
    console.error(err);
    status.textContent = `Error: ${err.message}`;
  }
}

let autoTimer = null;
function startAutoRefresh() {
  const auto = document.getElementById("autoRefresh").checked;
  const interval = Math.max(10, parseInt(document.getElementById("interval").value || 60, 10)) * 1000;
  if (auto) {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(fetchAndRender, interval);
  } else {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }
}

document.getElementById("fetchBtn").addEventListener("click", fetchAndRender);
document.getElementById("stocksSelect").addEventListener("change", loadExpiries);
document.getElementById("autoRefresh").addEventListener("change", startAutoRefresh);
document.getElementById("interval").addEventListener("change", startAutoRefresh);
document.getElementById("searchInput").addEventListener("input", (e) => searchStocks(e.target.value));
document.getElementById("removeStock").addEventListener("click", removeSelectedStocks);
document.getElementById("addNewStock").addEventListener("click", addNewStock);
document.getElementById("newStockInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") addNewStock();
});

async function addNewStock() {
  const input = document.getElementById("newStockInput");
  const stock = input.value.trim().toUpperCase();
  if (!stock) return;
  
  try {
    const res = await fetch(`${API_BASE}/add-stock`, {
      method: "POST",
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({stock})
    });
    const data = await res.json();
    if (data.success) {
      await loadStocks();
      input.value = "";
      document.getElementById("status").textContent = `Added ${stock}`;
    } else {
      document.getElementById("status").textContent = `Error: ${data.error}`;
    }
  } catch (err) {
    console.error(err);
    document.getElementById("status").textContent = `Error adding stock`;
  }
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("#searchInput") && !e.target.closest("#searchResults")) {
    document.getElementById("searchResults").classList.add("hidden");
  }
});
document.getElementById("downloadAll").addEventListener("click", () => {
  // For convenience, download combined CSV per first selected symbol (can be expanded)
  const symbols = getSelectedStocks();
  if (symbols.length === 0) return alert("Select a symbol to download.");
  // Direct to backend download for first symbol
  const expiry = document.getElementById("expirySelect").value || '';
  window.location = `${API_BASE}/download/${symbols[0]}${expiry ? `?expiry=${encodeURIComponent(expiry)}` : ''}`;
});

(async function init(){
  await loadStocks();
  await fetchAndRender();
})();
