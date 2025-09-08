const SOURCES = {
  austin: {
    name: "Austin, TX",
    type: "socrata",
    url: "https://data.austintexas.gov/resource/3syk-w9eu.json?$order=file_date DESC",
    map: {
      permit: "permit_number",
      address: "address",
      status: "status_current",
      filed_at: "file_date",
      description: "description"
    }
  },
  chicago: {
    name: "Chicago, IL",
    type: "socrata",
    url: "https://data.cityofchicago.org/resource/ydr8-5enu.json?$order=issue_date DESC",
    map: {
      permit: "permit_",
      address: "street_number",
      status: "status",
      filed_at: "issue_date",
      description: "work_description"
    }
  },
  nyc: {
    name: "New York City, NY",
    type: "socrata",
    url: "https://data.cityofnewyork.us/resource/ipu4-2q9a.json?$order=issuance_date DESC",
    map: {
      permit: "job__",
      address: "house__",
      status: "permit_status",
      filed_at: "issuance_date",
      description: "permit_type"
    }
  },
  la: {
    name: "Los Angeles, CA",
    type: "arcgis",
    url: "https://services.arcgis.com/RmCqQtiZLDCtblq/arcgis/rest/services/EPIC_LA_Case_History_view/FeatureServer/0/query",
    map: {
      permit: "CASENUMBER",
      address: "ADDRESS",
      status: "STATUS",
      filed_at: "FILEDATE",
      description: "WORKDESC"
    }
  },
  seattle: {
    name: "Seattle, WA",
    type: "socrata",
    url: "https://cos-data.seattle.gov/resource/76t5-zqzr.json?$order=application_date DESC",
    map: {
      permit: "permitnum",
      address: "originaladdress1",
      status: "statuscurrent",
      filed_at: "applicationdate",
      description: "description"
    }
  },
  boston: {
    name: "Boston, MA",
    type: "socrata",
    url: "https://data.boston.gov/resource/ga54-wzas.json?$order=issue_date DESC",
    map: {
      permit: "permitnumber",
      address: "address",
      status: "status",
      filed_at: "issue_date",
      description: "worktype"
    }
  },
  cincinnati: {
    name: "Cincinnati, OH",
    type: "socrata",
    url: "https://data.cincinnati-oh.gov/resource/kbxi-4mxt.json?$order=issue_date DESC",
    map: {
      permit: "permit_no",
      address: "address",
      status: "status",
      filed_at: "issue_date",
      description: "description"
    }
  }
};

function slugFromPath() {
  // handles /city/austin or /city/austin/
  const parts = location.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("city");
  const slug = i >= 0 && parts[i + 1] ? parts[i + 1].toLowerCase() : "";
  // fallback: if you ever load a city page at root, match by title
  if (!slug) return "";
  return slug;
}

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

 async function fetchPermits(opts = {}) {
  const city = slugFromPath();
  const src = SOURCES[city];

  if (!city || !src) {
    setStatus(city ? `No source for "${city}"` : "Pick a city");
    renderTable([]);
    return;
  }

  const limit = Number(el.rows?.value || 25);
  const params = new URLSearchParams({ city, limit: String(limit) });
  if (opts.refresh) params.set("refresh", "1");
  if (opts.raw) params.set("raw", "1");

  setStatus("Loading…");

 try {
  const url = `/api/permits?${params.toString()}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    // mode: "cors" // (default is fine, but explicit is ok)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} at ${url} :: ${txt.slice(0,180)}`);
  }

  const data = await res.json().catch((e) => {
    throw new Error(`JSON parse error at ${url}: ${e.message}`);
  });

  const items = Array.isArray(data?.items)
    ? data.items
    : (Array.isArray(data) ? data : []);

  renderTable(items);

  const total  = data?.stats?.total ?? items.length ?? 0;
  const source = data?.source || src.type || "proxy";
  setStatus(`${total} shown · Source: ${source}`);
} catch (err) {
  console.error("permits fetch failed", err);
  // show the real error on screen so we can diagnose on mobile
  setStatus(String(err.message || err).slice(0, 200));
  renderTable([]);
 }
  
 

  // Wire up events
  if (el.refres// --- downloadCSV ---
async function downloadCSV() {
  const city = slugFromPath();
  if (!city) {
    alert("Pick a city first.");
    return;
  }

  const limit = Number(el.rows?.value || 25);
  const params = new URLSearchParams({ city, limit: String(limit) });

  try {
    // Always hit the Worker CSV endpoint
    const res = await fetch(`/api/csv?${params.toString()}`, {
      headers: { accept: "text/csv" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();

    // Default filename is city-based; honor Content-Disposition if present
    let filename = `${city}-permits.csv`;
    const cd = res.headers.get("content-disposition");
    if (cd) {
      const m = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
      if (m) filename = decodeURIComponent(m[1].replace(/^UTF-8''/, ''));
    }

    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  } catch (err) {
    console.error("csv download failed", err);
    alert("CSV failed. Try again soon.");
  }
}h) el.refresh.addEventListener("click", () => fetchPermits({ refresh: true }));
  if (el.rows) el.rows.addEventListener("change", () => fetchPermits({}));
  if (el.csv) el.csv.addEventListener("click", () => downloadCSV());

  // Initial load
  fetchPermits({});
})();
