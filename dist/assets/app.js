
(() => {
  const PAGES_API = '/api';
  const DIRECT_API = (window.__PP_API || 'https://permitpulse-proxy.matasergio741.workers.dev').replace(/\/$/, '');

  async function tryFetch(base, path) {
    const url = base.replace(/\/$/,'') + path;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP '+res.status+' @ '+url);
    return res.json();
  }

  async function api(path) {
    try { return await tryFetch(PAGES_API, path); }
    catch (e) { console.warn('Pages proxy failed, using direct worker', e); return await tryFetch(DIRECT_API, path); }
  }

  function normalize(city, data) {
    if (data && Array.isArray(data.items)) return data;
    if (Array.isArray(data)) {
      return {
        items: data.map(r => ({
          permit: r.permit || r.permit_ || r.permit_number || r.permitnum || r.job__ || '-',
          address: r.address || r.permit_location || r.originaladdress1 || r.house__ || r.originaladdress1 || '',
          status: r.status || r.permit_status || r.status_current || r.statuscurrent || '',
          filed_at: r.filed_at || r.issuance_date || r.issue_date || r.applieddate || r.issueddate || '',
          description: r.description || r.work_description || r.permit_type || ''
        })),
        stats: { total: data.length, last7: 0, prev7: 0, updated_at: new Date().toISOString() }
      };
    }
    return { items: [], stats: { total: 0, last7: 0, prev7: 0, updated_at: null } };
  }

  function fmt(d) { if (!d) return ''; const t=new Date(d); return isNaN(t)?d:t.toLocaleDateString(); }

  async function load(city, limit) {
    const rowsEl = document.getElementById('rows');
    const statsEl = document.getElementById('stats');
    const limitNum = Number(limit) || 50;
    rowsEl.innerHTML = '<tr><td class="p-4 text-slate-500" colspan="5">Loading…</td></tr>';
    try {
      const raw = await api(`/permits?city=${encodeURIComponent(city)}&limit=${encodeURIComponent(limitNum)}`);
      const data = normalize(city, raw);
      const items = (data.items || []).slice(0, limitNum);
      const rows = items.map(r => `
        <tr class="align-top">
          <td class="py-3 pl-4 pr-3 font-medium text-slate-900">${r.permit ?? '-'}</td>
          <td class="px-3">${r.address ?? ''}</td>
          <td class="px-3">${r.status ?? ''}</td>
          <td class="px-3 whitespace-nowrap">${fmt(r.filed_at)}</td>
          <td class="px-3 text-slate-600">${r.description ?? ''}</td>
        </tr>`).join('');
      rowsEl.innerHTML = rows || '<tr><td class="p-4 text-slate-500" colspan="5">No results yet. Try again shortly.</td></tr>';
      const s = data.stats || {};
      statsEl.textContent = `Total: ${s.total ?? '-'} • Last 7: ${s.last7 ?? '-'}`;
      const csv = document.getElementById('csv');
      if (csv) csv.href = (PAGES_API + `/permits?city=${encodeURIComponent(city)}&limit=${encodeURIComponent(limitNum)}&format=csv`);
    } catch (e) {
      console.error('PermitPulse error:', e);
      rowsEl.innerHTML = '<tr><td class="p-4 text-rose-600" colspan="5">Failed to load.</td></tr>';
    }
  }

  if (window.PP_CITY) {
    const limitSel = document.getElementById('limit');
    document.getElementById('refresh').addEventListener('click', () => load(window.PP_CITY, limitSel.value));
    limitSel.addEventListener('change', () => load(window.PP_CITY, limitSel.value));
    load(window.PP_CITY, limitSel.value);
  }
})();
