// Minimal PermitPulse front-end for MVP (7-city, CSV + SEO landing)
(function () {
  const el = {
    table: document.querySelector("#table"),
    status: document.querySelector("#status"),
    rows: document.querySelector("#rows"),
    refresh: document.querySelector("#refresh"),
    csv: document.querySelector("#csv"),
    title: document.querySelector("#cityTitle"),
  };

  // Cities for MVP
  const SOURCES = {
    austin: "Austin, TX",
    chicago: "Chicago, IL",
    nyc: "New York City, NY",
    seattle: "Seattle, WA",
    boston: "Boston, MA",
    cincinnati: "Cincinnati, OH",
    sf: "San Francisco, CA"
  };

  // --- utils
  function slugFromPath() {
    const parts = (location.pathname || "").split("/").filter(Boolean);
    const idx = parts.indexOf("city");
    return (idx >= 0 && parts[idx + 1]) ? parts[idx + 1].toLowerCase() : "";
  }

  function setStatus(msg) {
    if (el.status) el.status.textContent = msg || "";
  }

  function html(s) {
    return (s ?? "").toString()
      .replace(/[<>]/g, c =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
      );
  }

  // --- landing page
  function renderLanding() {
    if (!el.table) return;
    const cities = Object.entries(SOURCES)
      .map(([slug, name]) =>
        `<li style="margin:8px 0;"><a href="/city/${slug}">${name} building permits</a></li>`
      )
      .join("");

    el.title.textContent = "Live building permits";
    el.table.innerHTML = `
      <div style="padding:8px 0 16px;color:#444">
        Export CSV. Email alerts. Choose a city:
      </div>
      <ul style="list-style:none;padding:0;margin:0">${cities}</ul>
    `;

    // Basic SEO schema
    const ld = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "PermitPulse – Live Building Permits",
      "about": "Recent building permits. Export CSV. Email alerts.",
      "hasPart": Object.entries(SOURCES).map(([slug, name]) => ({
        "@type": "WebPage",
        "name": `${name} building permits`,
        "url": `${location.origin}/city/${slug}`
      }))
    };
    document.getElementById("pp-ld")?.remove();
    const s = document.createElement("script");
    s.id = "pp-ld";
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);

    // Meta description
    let md = document.querySelector('meta[name="description"]');
    if (!md) {
      md = document.createElement("meta");
      md.name = "description";
      document.head.appendChild(md);
    }
    md.content =
      "Live building permits for sales prospecting. Export CSV and set email alerts for top US cities.";
  }

  // --- table render
  function render(items) {
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

  // --- fetch permits
  async function fetchPermits() {
    const city = slugFromPath();
    if (!city) {
      renderLanding();
      return;
    }
    const limit = Number(el.rows?.value || 25);

    if (el.title && SOURCES[city]) el.title.textContent = SOURCES[city];
    setStatus("Loading...");

    try {
      const url = new URL(`/api/permits?city=${encodeURIComponent(city)}&limit=${limit}`, location.href);
      const res = await fetch(url.toString(), { headers: { accept: "application/json" }, mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(Array.isArray(data.items) ? data.items : []);
      setStatus(`${data.items?.length || 0} shown`);
      if (el.csv) {
        el.csv.dataset.href = `/api/csv?city=${encodeURIComponent(city)}&limit=${limit}`;
      }
    } catch (e) {
      console.error(e);
      render([]);
      setStatus("Error loading data");
    }
  }

  // --- download CSV
  function downloadCSV() {
    const href = el.csv?.dataset?.href;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = `${slugFromPath() || "permits"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // --- events
  if (el.refresh) el.refresh.addEventListener("click", () => fetchPermits());
  if (el.rows) el.rows.addEventListener("change", () => fetchPermits());
  if (el.csv) el.csv.addEventListener("click", () => downloadCSV());

  // --- init
  fetchPermits();
})();
