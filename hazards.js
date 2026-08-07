'use strict';

// ── Maritime hazard zones (NGA MSI nav-warnings) ──────────────
// Renders launch danger-area polygons parsed from HYDROPAC/HYDROLANT
// broadcast warnings. Data is written to Supabase app_cache
// (key: hazards.navwarnings) by scripts/fetch-closures.js.
// Phase 1: shows currently-active launch nav-warnings on the live map.

let _hazardLayer = null;
let _hazardData  = null;
let showHazards  = true;

const HAZARD_COLOR = '#ff5a1f'; // maritime danger-area orange-red

// ── Load from Supabase app_cache ─────────────────────────────
async function loadHazards() {
  if (typeof SB === 'undefined' || !SB.init()) return;
  try {
    const rows = await SB.select('app_cache', { key: 'eq.hazards.navwarnings' });
    if (!rows?.length) { addLog('Hazards: no nav-warning data in DB', 'sys'); return; }
    _hazardData = rows[0].data || { warnings: [] };
    const n = (_hazardData.warnings || []).length;
    addLog(`Hazards: ${n} maritime nav-warning${n === 1 ? '' : 's'} loaded`, 'sys');
    drawHazards();
  } catch (e) { addLog(`Hazards: load error — ${e.message}`, 'err'); }
}

// NGA broadcast warnings date-stamp with a military DTG ("231417Z MAR 2022"),
// which Date() cannot parse — new Date(dtg).toISOString() throws "Invalid time
// value" and killed the whole draw. Parse the DTG, and fall back to showing the
// raw string rather than throwing.
function navDate(dtg) {
  if (!dtg) return '';
  const direct = new Date(dtg);
  if (!isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);

  const m = /^(\d{2})(\d{2})(\d{2})Z\s+([A-Za-z]{3})\s+(\d{4})$/.exec(String(dtg).trim());
  if (m) {
    const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
      .indexOf(m[4].toUpperCase());
    if (mon >= 0) {
      const d = new Date(Date.UTC(+m[5], mon, +m[1], +m[2], +m[3]));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return String(dtg);
}

// ── Draw / clear polygons ─────────────────────────────────────
function drawHazards() {
  if (typeof map === 'undefined' || !map) return;
  if (!_hazardLayer) _hazardLayer = L.layerGroup().addTo(map);
  _hazardLayer.clearLayers();
  if (!showHazards || !_hazardData) return;

  for (const w of (_hazardData.warnings || [])) {
    for (const ring of (w.areas || [])) {
      if (!Array.isArray(ring) || ring.length < 3) continue;
      // stored as [lon,lat]; Leaflet wants [lat,lon]
      const latlngs = ring.map(([lon, lat]) => [lat, lon]);
      const poly = L.polygon(latlngs, {
        color:       HAZARD_COLOR,
        weight:      1.5,
        opacity:     0.75,
        fillColor:   HAZARD_COLOR,
        fillOpacity: 0.10,
        dashArray:   '5 4',
      }).addTo(_hazardLayer);
      const issued = navDate(w.issueDate);
      poly.bindTooltip(
        `<b style="color:${HAZARD_COLOR}">HAZARD ZONE · ${esc(w.id || 'NAVWARN')}</b>` +
        (w.subject ? `<br><span style="color:var(--t3)">${esc(w.subject)}</span>` : '') +
        (issued ? `<br><span style="color:var(--t5);font-size:10px">HYDRO${w.navArea === 'A' ? 'LANT' : 'PAC'} · issued ${issued}</span>` : ''),
        { className: 'ltt', sticky: true }
      );
    }
  }
}

// ── Toggle (cbar button) ──────────────────────────────────────
function toggleHazards() {
  showHazards = !showHazards;
  drawHazards();
  const btn = document.getElementById('hazards-btn');
  if (btn) btn.style.opacity = showHazards ? '1' : '0.4';
}
