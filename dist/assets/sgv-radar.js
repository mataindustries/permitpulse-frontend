(() => {
  const API_BASE = document.body.dataset.apiBase;
  if (!API_BASE) {
    console.error("Missing data-api-base on <body>");
    return;
  }

  let state = { category: "all", days: 14, items: [] };

  const updatedEl = document.getElementById("updated");
  const rowsEl = document.getElementById("rows");
  const csvBtn = document.getElementById("csvBtn");

  function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: "2-digit", month: "2-digit", day: "2-digit" });
  }

  function titleCase(s) {
    return (s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function setError(msg) {
    if (updatedEl) updatedEl.textContent = msg;
    if (rowsEl) rowsEl.innerHTML = `<tr><td colspan="7" class="muted">${msg}</td></tr>`;
  }

  async function load() {
    try {
      if (updatedEl) updatedEl.textContent = "Loading…";
      if (rowsEl) rowsEl.innerHTML = `<tr><td colspan="7" class="muted">Loading radar…</td></tr>`;

      const qs = new URLSearchParams();
      qs.set("days", String(state.days));
      qs.set("category", state.category);

      const res = await fetch(`${API_BASE}/v1/sgv/electrification?${qs.toString()}`, { method: "GET" });
      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      state.items = data.items || [];

      if (updatedEl) {
        updatedEl.textContent = `Updated: ${data.updatedAt || "—"} • Signals: ${data.count || 0}`;
      }

      render();
    } catch (e) {
      console.error(e);
      setError(`Radar error: ${e.message || e}`);
    }
  }

  function render() {
    if (!rowsEl) return;

    if (!state.items.length) {
      rowsEl.innerHTML = `<tr><td colspan="7" class="muted">No matches yet.</td></tr>`;
      return;
    }

    rowsEl.innerHTML = state.items.map(x => `
      <tr>
        <td>${x.score ?? 0}</td>
        <td>${fmtDate(x.ts)}</td>
        <td>${titleCase(x.city)}</td>
        <td>${x.address || "—"}</td>
        <td>${titleCase(x.category)}</td>
        <td>${x.description || "—"}</td>
        <td>${x.sourceUrl ? `<a href="${x.sourceUrl}" target="_blank" rel="noopener">Open</a>` : "—"}</td>
      </tr>
    `).join("");
  }

  function setCat(cat) {
    state.category = cat;
    document.querySelectorAll("[data-cat]").forEach(b => b.classList.toggle("on", b.dataset.cat === cat));
    load();
  }

  function setDays(days) {
    state.days = days;
    document.querySelectorAll("[data-days]").forEach(b => b.classList.toggle("on", Number(b.dataset.days) === days));
    load();
  }

  function downloadCSV() {
    const headers = ["score","date","city","address","category","description","status","permitId","sourceUrl"];
    const lines = [headers.join(",")];

    for (const x of state.items) {
      const row = [
        x.score ?? 0,
        new Date(x.ts).toISOString(),
        x.city || "",
        x.address || "",
        x.category || "",
        (x.description || "").replace(/"/g,'""'),
        x.status || "",
        x.permitId || "",
        x.sourceUrl || ""
      ].map(v => `"${String(v)}"`).join(",");
      lines.push(row);
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sgv-electrification-${state.category}-${state.days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.querySelectorAll("[data-cat]").forEach(b => b.addEventListener("click", () => setCat(b.dataset.cat)));
  document.querySelectorAll("[data-days]").forEach(b => b.addEventListener("click", () => setDays(Number(b.dataset.days))));
  if (csvBtn) csvBtn.addEventListener("click", downloadCSV);

  load();
})();
