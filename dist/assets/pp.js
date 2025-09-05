// === Config ===
const GA_ID = "G-0S8S6156CV";
const STRIPE_LINK = "https://buy.stripe.com/4gM7sM6Ld86L0l94NA1wY07";
const API_BASE = "/api";

const CITIES = [
  { slug: "austin",        label: "Austin, TX",        enabled: true,
    seoTitle: "Austin, TX Building Permits",
    seoDescription: "Live Austin building permits. Updated daily. CSV export." },
  { slug: "chicago",       label: "Chicago, IL",       enabled: true,
    seoTitle: "Chicago, IL Building Permits",
    seoDescription: "Live Chicago building permits. Updated daily. CSV export." },
  { slug: "cincinnati",    label: "Cincinnati, OH",    enabled: true,
    seoTitle: "Cincinnati, OH Building Permits",
    seoDescription: "Live permits for Cincinnati. Updated daily. CSV export." },
  { slug: "seattle",       label: "Seattle, WA",       enabled: true,
    seoTitle: "Seattle, WA Building Permits",
    seoDescription: "Live permits for Seattle. Updated daily. CSV export." },
  { slug: "los-angeles",   label: "Los Angeles, CA",   enabled: false,
    seoTitle: "Los Angeles, CA Building Permits (LADBS)",
    seoDescription: "Live permits for City of Los Angeles (LADBS). Updated daily." },
  { slug: "new-york-city", label: "New York City, NY", enabled: false,
    seoTitle: "New York City, NY Building Permits",
    seoDescription: "Live NYC permits. Updated daily." },
  { slug: "boston",        label: "Boston, MA",        enabled: false,
    seoTitle: "Boston, MA Building Permits",
    seoDescription: "Live Boston permits. Updated daily." },
];

// === Small helpers ===
const $ = (sel, root=document) => root.querySelector(sel);
const el = (t, a={}, kids=[]) => {
  const n = document.createElement(t);
  for (const [k,v] of Object.entries(a)) n.setAttribute(k,v);
  for (const k of kids) n.append(k);
  return n;
};

function applySEO(ctx) {
  const head = document.head;
  const title = head.querySelector("title") || head.appendChild(document.createElement("title"));
  const md = head.querySelector('meta[name="description"]') || head.appendChild(Object.assign(document.createElement("meta"),{name:"description"}));
  const ogt = head.querySelector('meta[property="og:title"]') || head.appendChild(Object.assign(document.createElement("meta"),{setAttribute(p,v){this.setAttribute(p,v)} }) );
  (ogt.setAttribute|| (ogt.setAttribute = ogt.setAttribute)).call(ogt,"property","og:title");
  const ogd = head.querySelector('meta[property="og:description"]') || head.appendChild(Object.assign(document.createElement("meta"),{setAttribute(p,v){this.setAttribute(p,v)} }) );
  (ogd.setAttribute|| (ogd.setAttribute = ogd.setAttribute)).call(ogd,"property","og:description");
  const ogi = head.querySelector('meta[property="og:image"]') || head.appendChild(Object.assign(document.createElement("meta"),{setAttribute(p,v){this.setAttribute(p,v)} }) );
  (ogi.setAttribute|| (ogi.setAttribute = ogi.setAttribute)).call(ogi,"property","og:image");
  let canonical = head.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement("link"); canonical.rel="canonical"; head.appendChild(canonical); }

  if (ctx.kind === "home") {
    const t = "PermitPulse — Live Building Permits";
    title.textContent = t;
    md.content = "Live building permits with CSV export.";
    ogt.content = t;
    ogd.content = md.content;
    ogi.content = "/permitpulse-hero.png";
    canonical.href = "/";
  } else {
    const c = ctx.city;
    const t = `${c.seoTitle} — PermitPulse`;
    title.textContent = t;
    md.content = c.seoDescription;
    ogt.content = t;
    ogd.content = c.seoDescription;
    ogi.content = "/permitpulse-hero.png";
    canonical.href = `/city/${c.slug}/`;
  }
}

function csvEscape(s){ const needs=/[",\n]/.test(s); const v=s.replace(/"/g,'""'); return needs?`"${v}"`:v; }
function exportCsv(items, citySlug){
  const rows=[["Permit","Address","Status","Filed","Description"]];
  for (const it of items) rows.push([it.permit||"",it.address||"",it.status||"",it.filed_at||"",it.description||""]);
  const body=rows.map(r=>r.map(csvEscape).join(",")).join("\n");
  const blob=new Blob([body],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  const ts=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  a.download=`permits-${citySlug}-${ts}.csv`;
  a.href=URL.createObjectURL(blob); document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
}

function renderTable(items, host){
  if (!items.length){ host.replaceChildren(); return; }
  const thead = el("thead",{},[ el("tr",{},["Permit","Address","Status","Filed","Description"].map(h=>el("th",{},[h]))) ]);
  const tbody = el("tbody");
  for (const it of items){
    const filed = new Date(it.filed_at); const filedStr = isNaN(+filed)? it.filed_at : filed.toLocaleString();
    tbody.append( el("tr",{},[
      el("td",{},[it.permit||"—"]), el("td",{},[it.address||"—"]),
      el("td",{},[it.status||"—"]), el("td",{},[filedStr]),
      el("td",{},[it.description||"—"])
    ]));
  }
  host.replaceChildren( el("table",{},[thead, tbody]) );
}

// === Screens ===
function renderHome(root){
  applySEO({kind:"home"});
  const hero = el("div",{class:"hero"},[
    el("div",{},[ el("h1",{},["Live building permits with CSV export"]),
      el("p",{},["Pick a city to view the latest permits."]) ]),
    el("img",{src:"/permitpulse-hero.png",alt:"PermitPulse"})
  ]);
  const grid = el("div",{class:"grid"});
  for (const c of CITIES){
    const a = el("a",{href:`/city/${c.slug}/`,class:"city-link"},[
      el("strong",{},[c.label]),
      el("small",{},[c.enabled ? "Live feed" : "Placeholder (coming soon)"])
    ]);
    grid.append(a);
  }
  root.replaceChildren(
    hero,
    el("div",{class:"container"},[
      el("div",{class:"grid"},[grid])
    ])
  );
  const cta = $("#cta-link"); if (cta) cta.href = STRIPE_LINK;
}

function renderCity(root, slug){
  const city = CITIES.find(c=>c.slug===slug);
  if (!city){ root.replaceChildren(el("div",{class:"error"},["Unknown city."])); return; }
  applySEO({kind:"city", city});

  const rowsSel = el("select"); [10,25,50].forEach(n=>rowsSel.append(el("option",{value:String(n)},[String(n)]))); rowsSel.value="25";
  const refreshBtn = el("button",{class:"primary"},["Refresh"]);
  const csvBtn = el("button",{},["CSV"]);
  const controls = el("div",{class:"controls"},[ el("label",{},["Rows: ", rowsSel]), refreshBtn, csvBtn ]);
  const statusDiv = el("div",{class:"empty"},["Loading…"]);
  const tableWrap = el("div",{class:"table-wrap"});

  root.replaceChildren(
    el("h1",{},[city.label]),
    controls, tableWrap, statusDiv,
    el("footer",{},["Source feeds and availability can change; check back often."])
  );

  let current = [];

  async function load(){
    statusDiv.className="empty"; statusDiv.textContent="Loading…"; tableWrap.replaceChildren();
    try{
      const limit = Number(rowsSel.value)||25;
      const res = await fetch(`${API_BASE}/permits?city=${encodeURIComponent(slug)}&limit=${limit}`, {headers:{Accept:"application/json"}});
      if (!res.ok) throw new Error("status " + res.status);
      const data = await res.json();
      current = Array.isArray(data.items) ? data.items : [];
      renderTable(current, tableWrap);
      if (current.length===0){ statusDiv.className="empty"; statusDiv.textContent="No results yet. Try again shortly."; }
      else { statusDiv.textContent=""; }
    }catch(e){
      statusDiv.className="error"; statusDiv.textContent="Failed to load. Pull to refresh in ~30s.";
      current = []; tableWrap.replaceChildren();
    }
  }

  rowsSel.addEventListener("change", load);
  refreshBtn.addEventListener("click", load);
  csvBtn.addEventListener("click", ()=>exportCsv(current, slug));

  load();
  const cta = $("#cta-link"); if (cta) cta.href = STRIPE_LINK;
}

// === Router ===
function route(){
  const app = $("#app");
  const m = location.pathname.match(/^\/city\/(.+?)\/?$/);
  if (m){ renderCity(app, decodeURIComponent(m[1])); }
  else { renderHome(app); }
  const cta = $("#cta-link");
  if (cta){
    cta.addEventListener("click", ()=>{ if (window.gtag){ gtag('event','click',{event_category:'cta',event_label:'Start Pro $29/mo'}); } }, {once:true});
  }
}
window.addEventListener("DOMContentLoaded", route);
window.addEventListener("popstate", route);
