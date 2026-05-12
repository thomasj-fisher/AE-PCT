// FILE: app.js
// PURPOSE: Main client for the AE-PCT tracker — boots Leaflet, draws the trail
//   + resupply / road waypoints + airports + weekend pills + expected/actual
//   position markers, and wires up the table view, mobile drawer, and water layer.
// SOURCE: Reads window.PCT_TRAIL_SEGMENTS, PCT_WAYPOINTS, PCT_AIRPORTS,
//   PCT_PROGRESS, PCT_WATER_WAYPOINTS, PCT_WATER_LOADER from data/*.js.
// CAVEATS:
//   - Position interpolation is proportional between book-mile and GPX cumulative
//     mile (the two diverge by ~10%); drift up to a couple miles mid-trail.
//   - "Plan day 1" is hard-coded to 2026-05-13 (Athena's start date).
//   - Service worker discipline lives in sw.js — bump its CACHE constant if you
//     change any file in the app shell.

(function () {
'use strict';

const BOOK_TRAIL_MILES = 2655.2;

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
// Safe checkbox lookup — defaults to true if element is missing so a stale-cached
// shell doesn't make layers disappear.
const chk = (sel, fallback = true) => {
  const el = document.querySelector(sel);
  return el ? !!el.checked : fallback;
};
const fmtDate = (d) => d.toISOString().slice(0,10);
const parseDate = (s) => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d; };
const dayDiff = (a, b) => Math.round((a - b) / 86400000);
const todayMidnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.7613;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- trail index ----------
// Flat array of [lat,lon,cumMiles] for the entire PCT.
let trailPts = [];      // [[lat,lon], ...]
let cumMiles = [];      // cumMiles[i] = miles from start to trailPts[i]
let gpxTotalMiles = 0;
let trailScale = 1;     // gpxTotalMiles / BOOK_TRAIL_MILES → multiply book miles by this to get gpx-position

function buildTrailIndex() {
  trailPts = [];
  cumMiles = [];
  let total = 0;
  let prev = null;

  for (const seg of window.PCT_TRAIL_SEGMENTS) {
    for (const pt of seg.pts) {
      const [lat, lon] = pt;
      if (prev) total += haversineMiles(prev[0], prev[1], lat, lon);
      trailPts.push([lat, lon]);
      cumMiles.push(total);
      prev = [lat, lon];
    }
  }
  gpxTotalMiles = total;
  trailScale = gpxTotalMiles / BOOK_TRAIL_MILES;
}

// Map a "book mile" to lat/lon along the trail using proportional scaling.
function posAtBookMile(bookMile) {
  if (bookMile <= 0) return trailPts[0];
  if (bookMile >= BOOK_TRAIL_MILES) return trailPts[trailPts.length - 1];
  const targetGpxMile = bookMile * trailScale;
  // binary search
  let lo = 0, hi = cumMiles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumMiles[mid] < targetGpxMile) lo = mid + 1; else hi = mid;
  }
  // interpolate between lo-1 and lo
  const i = lo;
  if (i === 0) return trailPts[0];
  const t = (targetGpxMile - cumMiles[i-1]) / (cumMiles[i] - cumMiles[i-1] || 1);
  const [la0, ln0] = trailPts[i-1];
  const [la1, ln1] = trailPts[i];
  return [la0 + t * (la1 - la0), ln0 + t * (ln1 - ln0)];
}

// ---------- plan calc ----------
function expectedMileForDate(date) {
  // Linear interpolation of plan-day → mile from PCT_WAYPOINTS (which include Day 1=Cleef).
  const planStart = parseDate('2026-05-13');
  const dayNum = dayDiff(date, planStart) + 1;  // Day 1 = 13 May
  const wps = window.PCT_WAYPOINTS;
  if (dayNum <= wps[0].day) return { day: dayNum, mile: 0, waypoint: null };
  if (dayNum >= wps[wps.length-1].day) return { day: dayNum, mile: BOOK_TRAIL_MILES, waypoint: wps[wps.length-1] };
  for (let i = 1; i < wps.length; i++) {
    if (dayNum <= wps[i].day) {
      const a = wps[i-1], b = wps[i];
      const t = (dayNum - a.day) / (b.day - a.day);
      const mile = a.mile + t * (b.mile - a.mile);
      return { day: dayNum, mile, waypoint: b };
    }
  }
  return { day: dayNum, mile: BOOK_TRAIL_MILES, waypoint: wps[wps.length-1] };
}

function expectedDateForMile(mile) {
  const wps = window.PCT_WAYPOINTS;
  if (mile <= 0) return parseDate(wps[0].date);
  if (mile >= BOOK_TRAIL_MILES) return parseDate(wps[wps.length-1].date);
  for (let i = 1; i < wps.length; i++) {
    if (mile <= wps[i].mile) {
      const a = wps[i-1], b = wps[i];
      const t = (mile - a.mile) / (b.mile - a.mile);
      const dayA = parseDate(a.date), dayB = parseDate(b.date);
      const ms = dayA.getTime() + t * (dayB.getTime() - dayA.getTime());
      return new Date(ms);
    }
  }
  return null;
}

// ---------- progress store ----------
function loadProgress() {
  const arr = (window.PCT_PROGRESS || []).slice();
  arr.sort((a, b) => a.date.localeCompare(b.date));
  return arr;
}

// ---------- map setup ----------
let map, layers = {};

function setupMap() {
  map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([40.5, -120.5], 5);

  const baseStreets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
  });
  const baseTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; OSM, SRTM | Tiles &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17, subdomains: 'abc',
  });
  baseTopo.addTo(map);
  L.control.layers({ 'Topographic': baseTopo, 'Streets': baseStreets }, null, { position: 'topleft' }).addTo(map);

  layers.trail = L.layerGroup().addTo(map);
  layers.covered = L.layerGroup().addTo(map);
  layers.weekends = L.layerGroup().addTo(map);
  layers.waypoints = L.layerGroup().addTo(map);
  layers.water = L.layerGroup();
  layers.airports = L.layerGroup().addTo(map);
  layers.expected = L.layerGroup().addTo(map);
  layers.actual = L.layerGroup().addTo(map);
}

// ---------- daily schedule ----------
const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TOTAL_DAYS = 130;

function buildDailySchedule() {
  const start = parseDate('2026-05-13');
  const wps = window.PCT_WAYPOINTS;
  const EPS = 0.2; // miles tolerance for "at a waypoint"
  const rows = [];
  let prevMile = 0;
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const date = new Date(start.getTime() + (day - 1) * 86400000);
    const exp = expectedMileForDate(date);
    const dow = date.getDay();
    const startMile = prevMile;
    const endMile = exp.mile;

    const startsAt = wps.find(w => Math.abs(w.mile - startMile) < EPS) || null;
    const endsAt   = wps.find(w => Math.abs(w.mile - endMile)   < EPS) || null;

    // Closest road *ahead* of where she stops today (the practical "meet her" target).
    // If she ends at a waypoint, that IS the road.
    let closestRoad = endsAt;
    if (!closestRoad) {
      closestRoad = wps.find(w => w.mile > endMile + EPS) || wps[wps.length - 1];
    }
    const milesToRoad = closestRoad ? Math.max(0, closestRoad.mile - endMile) : 0;

    rows.push({
      day, date, dow,
      startMile, endMile,
      isWeekend: dow === 0 || dow === 6,
      startsAt, endsAt,
      isResupply: !!endsAt,
      closestRoad, milesToRoad,
    });
    prevMile = endMile;
  }
  return rows;
}

// ---------- rendering ----------
const COLOR = {
  trail: '#ff5a1f',
  trailCasing: 'rgba(0,0,0,0.75)',
  covered: '#16ff60',
  coveredCasing: 'rgba(0,0,0,0.75)',
  resupply: '#f59e0b',
  start: '#22c55e',
  finish: '#ef4444',
  airport: '#38bdf8',
  expected: '#a78bfa',
  actual: '#ef4444',
};

function drawTrail() {
  layers.trail.clearLayers();
  // Draw each GPX stage with a dark casing under a bright inner line for contrast on topo tiles.
  for (const seg of window.PCT_TRAIL_SEGMENTS) {
    L.polyline(seg.pts, {
      color: COLOR.trailCasing, weight: 7, opacity: 0.85,
      lineCap: 'round', lineJoin: 'round', interactive: false,
    }).addTo(layers.trail);
    const inner = L.polyline(seg.pts, {
      color: COLOR.trail, weight: 3.5, opacity: 1,
      lineCap: 'round', lineJoin: 'round',
    });
    inner.bindTooltip(seg.name, { sticky: true, direction: 'top' });
    inner.addTo(layers.trail);
  }
}

function drawCovered() {
  layers.covered.clearLayers();
  const last = lastReported();
  const mile = last ? last.mile : 0;
  if (mile <= 0) return;
  const targetGpx = mile * trailScale;
  const covered = [];
  for (let i = 0; i < trailPts.length; i++) {
    if (cumMiles[i] <= targetGpx) covered.push(trailPts[i]);
    else break;
  }
  if (covered.length < 2) return;
  L.polyline(covered, {
    color: COLOR.coveredCasing, weight: 9, opacity: 0.85,
    lineCap: 'round', lineJoin: 'round', interactive: false,
  }).addTo(layers.covered);
  L.polyline(covered, {
    color: COLOR.covered, weight: 5, opacity: 1,
    lineCap: 'round', lineJoin: 'round',
  }).addTo(layers.covered);
}

function waypointIcon(wp, isPassed, isCurrent) {
  const color = wp.kind === 'finish' ? COLOR.finish : (wp.kind === 'camp' ? COLOR.start : COLOR.resupply);
  const size = isCurrent ? 16 : 12;
  const border = isCurrent ? '3px solid #fff' : '2px solid #fff';
  const opacity = isPassed ? 0.45 : 1;
  return L.divIcon({
    className: 'wp-icon',
    iconSize: [size, size], iconAnchor: [size/2, size/2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border};opacity:${opacity};box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  });
}

function waypointPopup(wp) {
  const exp = parseDate(wp.date);
  const planDate = exp.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});

  let html = `<h3>${escapeHtml(wp.name)}</h3>
    <dl class="kv">
      <dt>Mile</dt><dd>${wp.mile.toFixed(1)}</dd>
      <dt>Plan day</dt><dd>${wp.day} (${planDate})</dd>
      <dt>Road</dt><dd>${escapeHtml(wp.road)}</dd>
      <dt>Off-trail</dt><dd>${escapeHtml(wp.offTrail)}</dd>
      <dt>Airport</dt><dd>${wp.airport}</dd>
      <dt>Drive</dt><dd>${escapeHtml(wp.drive)}</dd>
    </dl>`;

  const r = wp.resupply || {};
  const hasResupply = r.postOffice || r.lodging || r.groceries || r.hikerBox || r.shuttle || r.notes;
  if (hasResupply) {
    html += `<h4 class="popup-h">Resupply</h4><dl class="kv">`;
    if (r.postOffice) html += `<dt>Post office</dt><dd>${escapeHtml(r.postOffice)}</dd>`;
    if (r.lodging)    html += `<dt>Lodging</dt><dd>${escapeHtml(r.lodging)}</dd>`;
    if (r.groceries)  html += `<dt>Groceries</dt><dd>${escapeHtml(r.groceries)}</dd>`;
    if (r.hikerBox)   html += `<dt>Hiker box</dt><dd>${escapeHtml(r.hikerBox)}</dd>`;
    if (r.shuttle)    html += `<dt>Shuttle</dt><dd>${escapeHtml(r.shuttle)}</dd>`;
    if (r.notes)      html += `<dt>Note</dt><dd>${escapeHtml(r.notes)}</dd>`;
    html += `</dl>`;
  }
  if (Array.isArray(wp.sources) && wp.sources.length) {
    html += `<p class="popup-src">Source: ${wp.sources.map(s =>
      `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.label)}</a>`
    ).join(', ')}</p>`;
  }
  return html;
}

function drawWaypoints() {
  layers.waypoints.clearLayers();
  const last = lastReported();
  const passedThroughMile = last ? last.mile : -1;
  const today = todayMidnight();
  const exp = expectedMileForDate(today);
  for (const wp of window.PCT_WAYPOINTS) {
    const [lat, lon] = posAtBookMile(wp.mile);
    const isPassed = wp.mile <= passedThroughMile;
    // "current" = the next waypoint after her last reported position (or the one she's heading to today)
    const isCurrent = !isPassed && wp.mile > passedThroughMile && wp.mile - passedThroughMile < 40;
    const m = L.marker([lat, lon], { icon: waypointIcon(wp, isPassed, isCurrent) });
    m.bindPopup(waypointPopup(wp));
    m.bindTooltip(wp.name, { direction: 'right', offset: [8, 0] });
    m.addTo(layers.waypoints);
    m._wp = wp;
  }
}

// ---------- water sources ----------
let waterState = { loaded: false, loading: false, lastError: null, fresh: false, ts: 0, count: 0 };

async function ensureWaterLoaded() {
  if (waterState.loaded || waterState.loading) return waterState;
  waterState.loading = true;
  try {
    const result = await window.PCT_WATER_LOADER.load();
    waterState.loaded = true;
    waterState.fresh = !!result.fresh;
    waterState.ts = result.ts || 0;
    waterState.lastError = result.error || null;
    drawWater(result.data);
    waterState.count = result.data.length;
  } catch (e) {
    waterState.lastError = String(e);
  } finally {
    waterState.loading = false;
  }
  return waterState;
}

function drawWater(reports) {
  layers.water.clearLayers();
  const coords = window.PCT_WATER_WAYPOINTS || {};
  // Group reports by waypoint, keep the most recent report per waypoint.
  const byWp = new Map();
  for (const r of reports) {
    const prev = byWp.get(r.waypoint);
    if (!prev || (r.date && r.date > prev.date)) byWp.set(r.waypoint, r);
  }
  let plotted = 0;
  for (const [wpName, r] of byWp.entries()) {
    let lat, lon;
    const c = coords[wpName];
    if (c) { lat = c.lat; lon = c.lon; }
    else {
      // Fallback: place at mile position along the trail
      const pos = posAtBookMile(r.mile);
      if (!pos) continue;
      [lat, lon] = pos;
    }
    const dot = L.circleMarker([lat, lon], {
      radius: 4, color: '#0891b2', weight: 1, fillColor: '#22d3ee', fillOpacity: 0.85,
    });
    dot.bindPopup(`<h3>Water · ${escapeHtml(wpName)}</h3>
      <dl class="kv">
        <dt>Mile</dt><dd>${r.mile.toFixed(1)}</dd>
        ${r.location ? `<dt>Location</dt><dd>${escapeHtml(r.location)}</dd>` : ''}
        ${r.report   ? `<dt>Report</dt><dd>${escapeHtml(r.report)}</dd>` : ''}
        ${r.date     ? `<dt>Reported</dt><dd>${escapeHtml(r.date)}${r.reporter ? ' · ' + escapeHtml(r.reporter) : ''}</dd>` : ''}
      </dl>
      <p class="popup-src">Source: <a href="https://pctwater.com/" target="_blank" rel="noopener">PCT Water Report</a> · coords <a href="https://pctmap.net/gps/" target="_blank" rel="noopener">Halfmile</a></p>`);
    dot.addTo(layers.water);
    plotted++;
  }
  waterState.count = plotted;
}

function drawAirports() {
  layers.airports.clearLayers();
  for (const [code, ap] of Object.entries(window.PCT_AIRPORTS)) {
    const icon = L.divIcon({
      className: 'ap-icon',
      iconSize: [22, 22], iconAnchor: [11, 11],
      html: `<div style="width:22px;height:22px;border-radius:4px;background:${COLOR.airport};color:#0a0d12;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5)">${code}</div>`,
    });
    const m = L.marker([ap.lat, ap.lon], { icon });
    m.bindPopup(`<h3>${code} — ${ap.name}</h3><dl class="kv"><dt>From ORD/MDW</dt><dd>${ap.fromORD}</dd></dl>`);
    m.addTo(layers.airports);
  }
}

function drawWeekends() {
  layers.weekends.clearLayers();
  const schedule = buildDailySchedule();
  const last = lastReported();
  const passedMile = last ? last.mile : -1;
  for (const r of schedule) {
    if (!r.isWeekend) continue;
    const mile = r.endMile;
    if (mile == null || mile <= 0 || mile >= BOOK_TRAIL_MILES) continue;
    const [lat, lon] = posAtBookMile(mile);
    const isPassed = mile <= passedMile;
    const dowLabel = DOW_SHORT[r.dow];
    const dateLabel = r.date.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    const road = r.closestRoad;
    const icon = L.divIcon({
      className: 'we-icon',
      iconSize: [44, 18], iconAnchor: [22, 9],
      html: `<div style="display:flex;align-items:center;gap:4px;padding:1px 5px;border-radius:9px;
                         background:${isPassed ? 'rgba(167,139,250,0.35)' : 'rgba(167,139,250,0.95)'};
                         color:${isPassed ? '#cfc7e8' : '#1b0f3a'};
                         font-size:10px;font-weight:700;
                         border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.5);">
                <span>${dowLabel}</span><span style="font-weight:500">${dateLabel}</span>
              </div>`,
    });
    const m = L.marker([lat, lon], { icon, zIndexOffset: 100 });
    m.bindPopup(`<h3>${dowLabel} ${r.date.toLocaleDateString('en-GB',{day:'numeric',month:'long'})}</h3>
      <dl class="kv">
        <dt>Plan day</dt><dd>${r.day} of 130</dd>
        <dt>Expected mile</dt><dd>${mile.toFixed(1)}</dd>
        <dt>Next road</dt><dd>${road ? escapeHtml(road.name) + ' (mi ' + road.mile + ')' : '—'}</dd>
        <dt>Airport</dt><dd>${road ? road.airport + ' · ' + escapeHtml(road.drive) : '—'}</dd>
      </dl>`);
    m.addTo(layers.weekends);
  }
}

// 20px filled dot with a white outer ring + soft outer glow — used for both
// the expected and actual position markers. Color is the only difference.
function ringedDotIcon(color, className) {
  return L.divIcon({
    className,
    iconSize: [20, 20], iconAnchor: [10, 10],
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 2px ${color}66, 0 1px 4px rgba(0,0,0,0.5)"></div>`,
  });
}

function drawExpected() {
  layers.expected.clearLayers();
  const today = todayMidnight();
  const exp = expectedMileForDate(today);
  if (exp.mile <= 0 || exp.mile >= BOOK_TRAIL_MILES) return;
  const [lat, lon] = posAtBookMile(exp.mile);
  const m = L.marker([lat, lon], { icon: ringedDotIcon(COLOR.expected, 'exp-icon') });
  m.bindPopup(`<h3>Expected position today</h3>
    <dl class="kv">
      <dt>Date</dt><dd>${today.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</dd>
      <dt>Plan day</dt><dd>${exp.day} of 130</dd>
      <dt>Mile</dt><dd>${exp.mile.toFixed(1)}</dd>
    </dl>`);
  m.addTo(layers.expected);
}

function drawActual() {
  layers.actual.clearLayers();
  const last = lastReported();
  if (!last) return;
  const [lat, lon] = posAtBookMile(last.mile);
  const lastDate = parseDate(last.date);
  const expectedOnThatDate = expectedMileForDate(lastDate).mile;
  const milesAhead = last.mile - expectedOnThatDate;
  const m = L.marker([lat, lon], { icon: ringedDotIcon(COLOR.actual, 'act-icon') });
  m.bindPopup(`<h3>Last reported — Athena</h3>
    <dl class="kv">
      <dt>Date</dt><dd>${lastDate.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</dd>
      <dt>Mile</dt><dd>${last.mile.toFixed(1)}</dd>
      ${last.loc ? `<dt>Note</dt><dd>${last.loc}</dd>` : ''}
      <dt>vs plan</dt><dd>${milesAhead >= 0 ? '+' : ''}${milesAhead.toFixed(1)} mi ${milesAhead >= 0 ? 'ahead' : 'behind'}</dd>
    </dl>`);
  m.addTo(layers.actual);
}

// ---------- sidebar ----------
function lastReported() {
  const arr = loadProgress();
  if (!arr.length) return null;
  return arr[arr.length - 1];
}

function renderTodayCard() {
  const body = $('#today-body');
  if (!body) return;  // stale cache shell may be missing sidebar bits
  const today = todayMidnight();
  const exp = expectedMileForDate(today);
  const last = lastReported();

  let html = '';
  if (exp.day < 1) {
    const start = parseDate('2026-05-13');
    const daysToGo = dayDiff(start, today);
    html += `<div class="big">Trail starts in ${daysToGo} day${daysToGo===1?'':'s'}</div>
             <div class="muted">${start.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})} — Southern Terminus</div>`;
  } else if (exp.mile >= BOOK_TRAIL_MILES) {
    html += `<div class="big">Trail complete by plan</div>`;
  } else {
    html += `<div class="big">Day ${exp.day} of 130 · mile ${exp.mile.toFixed(1)}</div>`;
    if (exp.waypoint) html += `<div class="muted">Heading toward ${exp.waypoint.name} (mile ${exp.waypoint.mile})</div>`;
  }

  if (last) {
    const lastDate = parseDate(last.date);
    const expOnDate = expectedMileForDate(lastDate).mile;
    const milesAhead = last.mile - expOnDate;
    const expDateOfMile = expectedDateForMile(last.mile);
    const daysAhead = expDateOfMile ? dayDiff(expDateOfMile, lastDate) : 0;
    const cls = Math.abs(daysAhead) < 1 ? 'delta-onplan' : (daysAhead > 0 ? 'delta-ahead' : 'delta-behind');
    const sign = daysAhead > 0 ? '+' : '';
    html += `<div class="row">
      <div>Last report: <strong>${last.date}</strong></div>
      <div>Mile <strong>${last.mile.toFixed(1)}</strong></div>
      <div class="${cls}"><strong>${sign}${daysAhead.toFixed(1)} d</strong> vs plan</div>
    </div>`;
  } else {
    html += `<div class="row"><div>No updates logged yet</div></div>`;
  }
  body.innerHTML = html;
}

function renderProgressList() {
  const body = $('#progress-body');
  if (!body) return;
  const arr = loadProgress();
  if (!arr.length) {
    body.innerHTML = '<div class="muted">No updates yet.</div>';
    return;
  }
  // Show latest entries, newest first
  const recent = arr.slice().reverse().slice(0, 5);
  body.innerHTML = recent.map(p => `
    <div class="prog-row">
      <strong>mi ${p.mile.toFixed(1)}</strong>
      <span class="when">${p.date}</span>${p.loc ? ' · ' + escapeHtml(p.loc) : ''}
    </div>`).join('');
}

function renderWaypointList() {
  const ol = $('#wp-list');
  if (!ol) return;
  const search = ($('#wp-search')?.value || '').toLowerCase();
  const last = lastReported();
  const passedMile = last ? last.mile : -1;
  const today = todayMidnight();
  const exp = expectedMileForDate(today);
  ol.innerHTML = window.PCT_WAYPOINTS
    .filter(w => !search || w.name.toLowerCase().includes(search) || w.airport.toLowerCase().includes(search))
    .map(wp => {
      const isPassed = wp.mile <= passedMile;
      const isCurrent = !isPassed && wp.mile > passedMile && (exp.waypoint && wp.day === exp.waypoint.day);
      const dateLabel = parseDate(wp.date).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
      return `<li class="${isPassed?'passed':''} ${isCurrent?'current':''}" data-mile="${wp.mile}">
        <span class="day">D${wp.day}</span>
        <span class="name">${wp.name}</span>
        <span class="meta">${dateLabel} · ${wp.airport}</span>
      </li>`;
    }).join('');
  ol.querySelectorAll('li[data-mile]').forEach(li => {
    li.addEventListener('click', () => {
      const mile = parseFloat(li.dataset.mile);
      const [lat, lon] = posAtBookMile(mile);
      map.setView([lat, lon], 11, { animate: true });
    });
  });
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ---------- schedule table ----------
function renderScheduleTable() {
  const tbody = document.querySelector('#schedule-table tbody');
  if (!tbody) return;
  const weekendsOnly = chk('#t-weekends-only', false);
  const resupplyOnly = chk('#t-resupply-only', false);
  const last = lastReported();
  const passedMile = last ? last.mile : -1;
  const lastDate = last ? parseDate(last.date) : null;
  const today = todayMidnight();

  const schedule = buildDailySchedule();
  const filtered = schedule.filter(r => {
    if (weekendsOnly && !r.isWeekend) return false;
    if (resupplyOnly && !r.isResupply) return false;
    return true;
  });

  // Build a quick map of date -> progress entry (most recent first per date)
  const progressByDate = {};
  for (const p of loadProgress()) progressByDate[p.date] = p;

  const fmtPos = (mile, wp, role) => {
    // role: 'start' | 'end' — drives the icon/label
    if (wp) {
      const icon = role === 'end' ? '◉' : '↗';
      const label = role === 'end' ? 'ends at' : 'starts at';
      return `<span class="pos-icon ${role}" title="${label}">${icon}</span>
              <strong>${escapeHtml(wp.name)}</strong>
              <span class="muted"> · mi ${mile.toFixed(1)}</span>`;
    }
    return `<span class="muted">on trail</span> · mi ${mile.toFixed(1)}`;
  };

  const rowsHtml = filtered.map(r => {
    const dateStr = fmtDate(r.date);
    const dow = DOW_SHORT[r.dow];
    const isToday = r.date.getTime() === today.getTime();
    const isPassed = r.endMile <= passedMile;
    const actual = progressByDate[dateStr];
    let actualCell = '';
    let deltaCell = '';
    let deltaCls = 'onplan';
    if (actual) {
      actualCell = `<strong>${actual.mile.toFixed(1)}</strong>${actual.loc ? ' · ' + escapeHtml(actual.loc) : ''}`;
      const expDate = expectedDateForMile(actual.mile);
      const daysAhead = expDate ? dayDiff(expDate, r.date) : 0;
      const sign = daysAhead > 0 ? '+' : '';
      deltaCell = `${sign}${daysAhead.toFixed(1)}`;
      deltaCls = Math.abs(daysAhead) < 1 ? 'onplan' : (daysAhead > 0 ? 'ahead' : 'behind');
    }

    const cr = r.closestRoad;
    const roadCell = cr
      ? (r.milesToRoad < 0.2
          ? `${escapeHtml(cr.road)} <span class="muted">· at trail</span>`
          : `${escapeHtml(cr.road)} <span class="muted">· ${r.milesToRoad.toFixed(1)} mi ahead</span>`)
      : '—';
    const offTrailCell = cr ? escapeHtml(cr.offTrail) : '—';
    const airportCell = cr ? cr.airport : '—';
    const driveCell = cr ? escapeHtml(cr.drive) : '—';

    const classes = [
      r.isWeekend ? 'weekend' : '',
      r.isResupply ? 'resupply-row' : '',
      isPassed ? 'passed' : '',
      isToday ? 'today' : '',
    ].filter(Boolean).join(' ');
    return `<tr class="${classes}" data-mile="${r.endMile.toFixed(1)}">
      <td class="day-cell">${r.day}</td>
      <td>${r.date.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</td>
      <td class="dow ${r.isWeekend ? 'we' : ''}">${dow}</td>
      <td class="starts">${fmtPos(r.startMile, r.startsAt, 'start')}</td>
      <td class="ends loc-cell">${fmtPos(r.endMile, r.endsAt, 'end')}</td>
      <td>${roadCell}</td>
      <td>${offTrailCell}</td>
      <td>${airportCell}</td>
      <td>${driveCell}</td>
      <td>${actualCell}</td>
      <td class="delta ${deltaCls}">${deltaCell}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rowsHtml || `<tr><td colspan="11" class="muted" style="padding:20px;text-align:center">No rows match current filters</td></tr>`;

  // summary
  const weekends = schedule.filter(r => r.isWeekend).length;
  const summary = $('#table-summary');
  if (summary) summary.textContent = `${filtered.length} of ${schedule.length} days · ${weekends} weekend days highlighted`;

  // click a row to jump map to that location
  tbody.querySelectorAll('tr[data-mile]').forEach(tr => {
    tr.addEventListener('click', () => {
      const mile = parseFloat(tr.dataset.mile);
      const [lat, lon] = posAtBookMile(mile);
      switchTab('map');
      setTimeout(() => map.setView([lat, lon], 11, { animate: true }), 60);
    });
  });
}

// ---------- tabs ----------
let activeTab = 'map';
function switchTab(name) {
  if (name === activeTab) return;
  activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(b => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    const on = p.id === (name === 'map' ? 'map' : 'table-view');
    p.classList.toggle('active', on);
    if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
  });
  if (name === 'map' && map) {
    // Leaflet needs to recompute size after being unhidden
    setTimeout(() => map.invalidateSize(), 60);
  } else if (name === 'table') {
    renderScheduleTable();
  }
}

// ---------- main render ----------
function render() {
  // visibility based on filter checkboxes; default ON if checkbox not in DOM
  toggleLayer(layers.trail,     chk('#f-trail'));
  toggleLayer(layers.covered,   chk('#f-progress-line'));
  toggleLayer(layers.waypoints, chk('#f-waypoints'));
  toggleLayer(layers.weekends,  chk('#f-weekends'));
  toggleLayer(layers.airports,  chk('#f-airports'));
  toggleLayer(layers.expected,  chk('#f-expected'));
  toggleLayer(layers.actual,    chk('#f-actual'));

  // Water layer: lazy-load on first show; default OFF
  const wantWater = chk('#f-water', false);
  toggleLayer(layers.water, wantWater);
  if (wantWater && !waterState.loaded && !waterState.loading) {
    ensureWaterLoaded();
  }

  drawCovered();
  drawWeekends();
  drawWaypoints();
  drawExpected();
  drawActual();
  renderTodayCard();
  renderProgressList();
  renderWaypointList();
  if (activeTab === 'table') renderScheduleTable();
}

function toggleLayer(layer, on) {
  if (on && !map.hasLayer(layer)) map.addLayer(layer);
  if (!on && map.hasLayer(layer)) map.removeLayer(layer);
}

// ---------- wire-up ----------
function wireUi() {
  document.querySelectorAll('#filter-card input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', render);
  });
  $('#wp-search')?.addEventListener('input', renderWaypointList);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  $('#t-weekends-only')?.addEventListener('change', renderScheduleTable);
  $('#t-resupply-only')?.addEventListener('change', renderScheduleTable);
  wireMobileDrawer();
}

function wireMobileDrawer() {
  const sidebar = $('#sidebar');
  const backdrop = $('#sidebar-backdrop');
  const toggle = $('#menu-toggle');
  if (!sidebar || !backdrop || !toggle) return;  // older cached shell — skip
  const open = () => {
    sidebar.classList.add('open');
    backdrop.removeAttribute('hidden');
    requestAnimationFrame(() => backdrop.classList.add('show'));
    toggle.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    toggle.setAttribute('aria-expanded', 'false');
    setTimeout(() => backdrop.setAttribute('hidden', ''), 240);
  };
  toggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? close() : open();
  });
  backdrop.addEventListener('click', close);
  $('#wp-list')?.addEventListener('click', (e) => {
    if (e.target.closest('li[data-mile]') && sidebar.classList.contains('open')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) close();
  });
}

// ---------- init ----------
function init() {
  buildTrailIndex();
  console.log(`Trail indexed: ${trailPts.length} points, GPX total ${gpxTotalMiles.toFixed(1)} mi, scale ${trailScale.toFixed(4)} (book = ${BOOK_TRAIL_MILES} mi)`);
  setupMap();
  drawTrail();
  drawAirports();
  wireUi();
  render();
  // fit map to trail bounds, then recompute size after layout settles
  const bounds = L.latLngBounds(trailPts);
  map.fitBounds(bounds, { padding: [20, 20] });
  // Leaflet occasionally sees a 0-height container during first paint on iOS;
  // force a recompute once the browser has a real layout
  setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, { padding: [20, 20] }); }, 200);
}

// Visible error overlay — when something throws, the user sees what and can
// screenshot it. Beats a blank map on a phone.
function showError(msg) {
  let div = document.getElementById('err-overlay');
  if (!div) {
    div = document.createElement('div');
    div.id = 'err-overlay';
    div.style.cssText = 'position:fixed;bottom:8px;left:8px;right:8px;padding:8px 10px;background:#ef4444;color:#fff;font:11px/1.35 -apple-system,Segoe UI,sans-serif;border-radius:6px;z-index:9999;max-height:40vh;overflow:auto;box-shadow:0 4px 14px rgba(0,0,0,.4)';
    div.addEventListener('click', () => div.remove());
    document.body.appendChild(div);
  }
  div.textContent = msg + ' — tap to dismiss';
}
window.addEventListener('error', (e) => {
  showError('JS error: ' + (e.message || 'unknown') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
});
window.addEventListener('unhandledrejection', (e) => {
  showError('Promise rejected: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
