// FILE: data/water-loader.js
// PURPOSE: Runtime fetch of the seven PCT Water Report Google Sheets, parse,
//   join each row to a Halfmile waypoint coordinate, cache in localStorage 24h.
//   Exposes window.PCT_WATER_LOADER.load() → { data, fresh, stale?, error?, ts }.
// SOURCE:
//   - Reports: PCT Water Report (pctwater.com) — free crowdsourced; no warranty.
//   - Coordinates joined in app.js from PCT_WATER_WAYPOINTS (Halfmile, see
//     data/water-waypoints.js).
// CAVEATS:
//   - First page load with the water layer ON needs network access.
//   - Subsequent loads within 24h use the localStorage cache.
//   - Waypoints not in the coord lookup fall back to proportional mile-position.

window.PCT_WATER_LOADER = (function () {
  'use strict';

  const SHEET_IDS = [
    '1gEyz3bw__aPvNXpqqHcs7KRwmwYrTH2L0DEMW3RbHes',  // CA Section A — Campo → Warner Springs
    '150zc_EiTZiiQTLXDogsICTRWtj1UF2Rp4hycYntHHfI',  // CA Section B — Warner Springs → I-10
    '1LcPeF9tEZ83YHm4-0K8QsH8bUc785h8nqQuTDQbzPJI',  // CA Section C — I-10 → Agua Dulce
    '1Tk7yDPd9JWAm7sbbad9idZxcDJlv7ilMz6qZa6pal8w',  // CA Section D — Agua Dulce → Walker Pass
    '1XxD94O2HwyTCvehX5ZiYJkLNK53Xw-S1Z7ATHyYDfr8',  // CA Section E — Walker Pass → Sonora Pass
    '1LJAdNkL2EXwIiRnOfZe1jYptEgWzJlc5N_tyGQfS258',  // CA Section F → OR/WA
    '1lqdNvriapux8sB90ufG4oYyxMJTisg3vB3ra2WUIrIw',  // OR + WA continuation
  ];
  const sheetUrl = (id) =>
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;

  const CACHE_KEY = 'pct.water.v1';
  const CACHE_TTL_MS = 24 * 3600 * 1000;

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.ts || !Array.isArray(obj.data)) return null;
      if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
      return obj;
    } catch { return null; }
  }
  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch {}
  }

  // Minimal CSV parser — handles quoted fields, embedded commas/newlines, "" escape.
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuote) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuote = false;
        } else field += c;
      } else {
        if (c === '"') inQuote = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function processSheet(text, sectionIdx) {
    const rows = parseCsv(text);
    // Find header — first row that has both "Mile" and "Waypoint"
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const r = rows[i].map((s) => (s || '').trim());
      if (r.includes('Mile') && r.includes('Waypoint')) { headerIdx = i; break; }
    }
    if (headerIdx < 0) return [];
    const headers = rows[headerIdx].map((s) => (s || '').trim());
    const idx = {
      mile:     headers.indexOf('Mile'),
      waypoint: headers.indexOf('Waypoint'),
      location: headers.indexOf('Location'),
      report:   headers.indexOf('Report'),
      date:     headers.indexOf('Date'),
      reporter: headers.findIndex((h) => /reported.?by/i.test(h)),
    };
    const out = [];
    for (let j = headerIdx + 1; j < rows.length; j++) {
      const r = rows[j];
      const mile = parseFloat((r[idx.mile] || '').trim());
      if (!isFinite(mile)) continue;
      const wp = (r[idx.waypoint] || '').trim();
      if (!wp) continue;
      out.push({
        section:  sectionIdx + 1,
        mile,
        waypoint: wp,
        location: (idx.location >= 0 ? (r[idx.location] || '').trim() : ''),
        report:   (idx.report   >= 0 ? (r[idx.report]   || '').trim() : ''),
        date:     (idx.date     >= 0 ? (r[idx.date]     || '').trim() : ''),
        reporter: (idx.reporter >= 0 ? (r[idx.reporter] || '').trim() : ''),
      });
    }
    return out;
  }

  async function fetchAll() {
    const responses = await Promise.all(
      SHEET_IDS.map((id) => fetch(sheetUrl(id), { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      )
    );
    const all = [];
    for (let i = 0; i < responses.length; i++) {
      try { all.push(...processSheet(responses[i], i)); }
      catch (e) { console.warn('Water sheet', i + 1, 'failed to parse:', e); }
    }
    return all;
  }

  async function load() {
    const cached = readCache();
    if (cached) return { data: cached.data, fresh: false, ts: cached.ts };
    try {
      const data = await fetchAll();
      writeCache(data);
      return { data, fresh: true, ts: Date.now() };
    } catch (err) {
      console.warn('Water fetch failed:', err);
      // try stale cache as last resort
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && Array.isArray(obj.data)) return { data: obj.data, fresh: false, stale: true, ts: obj.ts };
        }
      } catch {}
      return { data: [], fresh: false, error: String(err) };
    }
  }

  return { load };
})();
