
(function () {
  const $ = (sel) => document.querySelector(sel);
  const el = {
    table: $("#table"),
    refresh: $("#refresh"),
    csv: $("#csv"),
    rows: $("#rows"),
    status: $("#status"),
  };

  const slugFromPath = () => {
    if (window.__PP_CITY__) return window.__PP_CITY__;
    const parts = (location.pathname || "").split("/").filter(Boolean);
    const idx = parts.indexOf("city");
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "austin";
  };

  const city = slugFromPath();

  function setStatus(msg) {
    if (el.status) el.status.textContent = msg || "";
  }

  function htmlEscape(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    })[c]);
  }

  function renderTable(items) {
    if (!el.table) return;
    if (!items || !items.length) {
      el.table.innerHTML = '<div style="padding:12px;border:1px dashed #ddd;border-radius:8px;background:#fafafa;">No permits found. Try Refresh.</div>';
      return;
    }
    const rows = items.map(p => `
      <tr>
        <td>${htmlEscape(p.permit)}</td>
        <td>${htmlEscape(p.address)}</td>
        <td>${htmlEscape(p.description)}</td>
        <td>${htmlEscape(p.status)}</td>
        <td>${htmlEscape((p.filed_at||"").slice(0,10))}</td>
      </tr>
    `).join("");
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
      </div>
    `;
  }

  async function fetchPermits(opts) {
    const limit = Number((el.rows && el.rows.value) || 25) || 25;
    const params = new URLSearchParams({ city, limit: String(limit) });
    if (opts && opts.refresh) params.set("refresh", "1");
    if (opts && opts.raw) params.set("raw", "1");

    setStatus("Loading…");
    try {
      const data = await window.api(`/permits?${params.toString()}`);
      if (!data || !data.ok) throw new Error("Bad response");
      renderTable(data.items || []);
      setStatus(`${(data.stats && data.stats.total) || 0} shown · Source: ${data.source}`);
    } catch (err) {
      console.error("permits fetch failed", err);
      setStatus("Failed to load. Pull to refresh in ~30s.");
      renderTable([]);
    }
  }

  async function downloadCSV() {
    const limit = Number((el.rows && el.rows.value) || 25) || 25;
    const params = new URLSearchParams({ city, limit: String(limit) });
    // Hit CSV endpoint which returns Blob
    try {
      const blob = await window.api(`/permits.csv?${params.toString()}`);
      // window.api returns JSON by default; we need a direct fetch for blob:
    } catch (e) {}

    // Fallback: directly fetch to blob from /api
    const url = `/api/permits.csv?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${city}-permits.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error("csv download failed", err);
      alert("CSV failed. Try again soon.");
    }
  }

  // Wire up events
  if (el.refresh) el.refresh.addEventListener("click", () => fetchPermits({ refresh: true }));
  if (el.rows) el.rows.addEventListener("change", () => fetchPermits({}));
  if (el.csv) el.csv.addEventListener("click", () => downloadCSV());

  // Initial load
  fetchPermits({});
})();
