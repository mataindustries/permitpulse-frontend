// functions/api/top-permits.js

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const search = url.searchParams;

  // 1) Parse & sanitize query params
  const rawDays = Number(search.get("days") || "30");
  const rawMin = Number(search.get("min") || "250000");
  const rawLimit = Number(search.get("limit") || "25");
  const trade = (search.get("trade") || "roof").toLowerCase();
  const debug = search.get("debug") === "1";

  const days = !Number.isFinite(rawDays) || rawDays <= 0 || rawDays > 365 ? 30 : rawDays;
  const minValue = !Number.isFinite(rawMin) || rawMin < 0 ? 0 : rawMin;
  const limit = !Number.isFinite(rawLimit) || rawLimit <= 0 || rawLimit > 200 ? 25 : rawLimit;

  // 2) Build time window
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString().slice(0, 10) + "T00:00:00";

  // 3) Build $where clause for SODA (LADBS open data)
  // Dataset: Building Permits via LA Open Data / Socrata (nbyu-2ha9) – commonly used in public examples. :contentReference[oaicite:2]{index=2}
  const where = [];

  // NOTE: field names below are based on common LADBS schemas.
  // If you see empty results, go to the dataset page and confirm the exact field names,
  // then tweak these strings.
  where.push(`issue_date >= '${startIso}'`);
  where.push(`valuation >= ${minValue}`);   // sometimes "valuation" / "permit_valuation" / "est_valuation"

  // 4) Trade-based keyword filters (description text search)
  const tradeFilters = {
    roof: `(work_description ILIKE '%roof%' OR work_description ILIKE '%re-roof%' OR work_description ILIKE '%reroof%')`,
    solar: `(work_description ILIKE '%solar%' OR work_description ILIKE '%pv%' OR work_description ILIKE '%photovoltaic%')`,
    addition: `(work_description ILIKE '%addition%' OR work_description ILIKE '%addn%')`,
    hvac: `(work_description ILIKE '%hvac%' OR work_description ILIKE '%furnace%' OR work_description ILIKE '%a/c%' OR work_description ILIKE '%air cond%')`,
    electrical: `(work_description ILIKE '%electrical%' OR work_description ILIKE '%panel%' OR work_description ILIKE '%service upgrade%')`
  };

  if (tradeFilters[trade]) {
    where.push(tradeFilters[trade]);
  }

  const ladbsUrl = new URL("https://data.lacity.org/resource/nbyu-2ha9.json");
  ladbsUrl.searchParams.set("$where", where.join(" AND "));
  ladbsUrl.searchParams.set("$order", "valuation DESC");
  ladbsUrl.searchParams.set("$limit", String(limit));

  // 5) Fetch from LADBS open data
  let raw;
  let status = 200;
  let error = null;

  try {
    const resp = await fetch(ladbsUrl.toString(), {
      headers: { Accept: "application/json" }
    });

    if (!resp.ok) {
      status = 502;
      error = `ladbs_fetch_failed_${resp.status}`;
      raw = [];
    } else {
      raw = await resp.json();
    }
  } catch (e) {
    status = 502;
    error = "ladbs_fetch_exception";
    raw = [];
  }

  // 6) Normalize rows for your frontend
  const permits = (raw || []).map((row) => {
    // These fields are *typical* for the LADBS permit datasets; tweak if needed.
    const permitNumber =
      row.pcis_permit ||
      row.permit_num ||
      row.permit_number ||
      row.permit ||
      null;

    const issueDate = row.issue_date ? row.issue_date.slice(0, 10) : null;

    const value =
      Number(row.valuation || row.permit_valuation || row.est_valuation) || null;

    const addressParts = [
      row.house_no || row.house_number || row.addr_num,
      row.street_prefix || row.street_pre_dir,
      row.street_name || row.street,
      row.street_suffix || row.street_suf_dir,
      row.city || "Los Angeles",
      row.zip_code
    ].filter(Boolean);

    const address = addressParts.join(" ");

    const description =
      row.work_description || row.description || row.scope_of_work || null;

    return {
      permitNumber,
      issueDate,
      address,
      value,
      description,
      trade
    };
  });

  const responseBody = {
    meta: {
      days,
      minValue,
      limit,
      trade,
      source: "LADBS building permits via data.lacity.org",
      error,
      count: permits.length
    },
    permits,
    debug:
      debug && {
        ladbsUrl: ladbsUrl.toString()
      }
  };

  return new Response(JSON.stringify(responseBody, null, debug ? 2 : 0), {
    status: error ? status : 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*"
    }
  });
}
