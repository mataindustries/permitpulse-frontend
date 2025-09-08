// Minimal PP front-end for 7-city MVP
(function () {
  const el = {
    table: document.querySelector("#table"),
    status: document.querySelector("#status"),
    rows: document.querySelector("#rows"),
    refresh: document.querySelector("#refresh"),
    csv: document.querySelector("#csv"),
    title: document.querySelector("#cityTitle"),
  };

  const SOURCES = {
    austin: "Austin, TX",
    chicago: "Chicago, IL",
    nyc: "New York City, NY",
    seattle: "Seattle, WA",
    boston: "Boston, MA",
    cincinnati: "Cincinnati, OH",
  };

  function slugFromPath() {
    // supports /city/<slug> or fallback to austin
    const parts = (location.pathname || "").split("/").filter(Boolean);
    const idx = parts.indexOf("city");
    return (idx >= 0 && parts[idx + 1]) ? parts[idx + 1].toLowerCase() : "";
  }

  function setStatus(msg){ if (el.status) el.status.textContent = msg || ""; }

  function html(s){ return (s??"").replace(/[<&>"]/g,c=>({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c])); }

  function render(items){
    if (!el.table) return;
    if (!items || !items.length) {
      el.table.innerHTML = `<div class="empty_error">No permits found. Try Refresh.</div>`;
      return;
    }
    const rows = items.map(p => `
      <tr>
        <td>${html(p.permit)}</td>
        <td>${html(p.address)}</td>
        <td>${html(p.description)}</td>
        <td>${html(p.status)}</td>
        <td>${html(String(p.filed_at).slice(0,10))}</td>
      </tr>`).join("");
    el.table.innerHTML = `
      <div style="overflow:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">Permit</th>
              <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">Address</th>
              <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">Description</th>
              <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">Status</th>
              <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">Filed</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  async function fetchPermits(opts={}){
    const city = slugFromPath();
    const limit = Number(el.rows?.value || 25);
    if (el.title && SOURCES[city]) el.title.textContent = SOURCES[city];

    setStatus("Loading...");
    try {
      const u = new URL(`/api/permits?city=${encodeURIComponent(city)}&limit=${limit}`, location.href);
      const res = await fetch(u.toString(), { headers: { accept: "application/json" }, mode: "cors" });
      if (!res.ok) {
        const txt = await res.text().catch(()=> "");
        throw new Error(`HTTP ${res.status}: ${txt.slice(0,160)}`);
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      render(items);
      setStatus(`${items.length} shown`);
      if (el.csv) {
        const c = new URL(`/api/csv?city=${encodeURIComponent(city)}&limit=${limit}`, location.href);
        el.csv.dataset.href = c.toString();
      }
    } catch (e) {
      console.error(e);
      render([]);
      setStatus(String(e.message || e).slice(0,200));
    }
  }

  function downloadCSV(){
    const href = el.csv?.dataset?.href;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = `${slugFromPath()}-permits.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (el.refresh) el.refresh.addEventListener("click", () => fetchPermits());
  if (el.rows) el.rows.addEventListener("change", () => fetchPermits());
  if (el.csv) el.csv.addEventListener("click", () => downloadCSV());

  fetchPermits();
})();
