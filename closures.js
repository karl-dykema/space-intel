'use strict';

// Starbase / Boca Chica area coords
const STARBASE_LAT = 25.9969;
const STARBASE_LON = -97.1497;

let _closureLayer   = null;
let _tfrLayers      = {};
let _closurePollTimer = null;
let _tfrPollTimer     = null;

// ── Smart poll intervals ──────────────────────────────────────
// Normal: 24h. Within 48h of launch: 3h.
function _closurePollMs() {
  const missions = (typeof missionsCache !== 'undefined' ? missionsCache : []);
  const now = Date.now();
  let nearest = Infinity;
  for (const m of missions) {
    const t0 = m.T0 ? new Date(m.T0).getTime() : 0;
    if (t0 > now) nearest = Math.min(nearest, t0 - now);
  }
  if (nearest < 48 * 3600000) return 3 * 3600000;  // < 48h → 3h
  return 24 * 3600000;                               // else  → 24h
}

// ── Closures ──────────────────────────────────────────────────
async function pollClosures() {
  if (SHARE_MODE) return; // proxy not available on share page
  try {
    const r = await fetch('http://localhost:8766/closures');
    if (!r.ok) return;
    const data = await r.json();
    applyClosureOverlay(data);
    updateClosureBadge(data);
  } catch(_) {}
  _scheduleClosure();
}

function _scheduleClosure() {
  clearTimeout(_closurePollTimer);
  _closurePollTimer = setTimeout(pollClosures, _closurePollMs());
}

function applyClosureOverlay(data) {
  if (!map) return;
  if (_closureLayer) { map.removeLayer(_closureLayer); _closureLayer = null; }

  const st = data.status;
  if (st === 'open') return; // no overlay needed

  const color   = st === 'closed'    ? '#ff2222' :
                  st === 'scheduled' ? '#ff8800' : '#ffcc00';
  const opacity = st === 'closed' ? 0.22 : 0.14;

  // Circle covering the Hwy 4 / Boca Chica closure corridor (~9 km radius)
  _closureLayer = L.circle([STARBASE_LAT, STARBASE_LON], {
    radius:      9000,
    color,
    weight:      2,
    opacity:     0.7,
    fillColor:   color,
    fillOpacity: opacity,
    dashArray:   st === 'closed' ? null : '6 4',
  }).addTo(map);

  const label = st === 'closed' ? 'ROAD CLOSED' : 'CLOSURE SCHEDULED';
  const tip   = _buildClosureTip(data);
  _closureLayer.bindTooltip(
    `<b style="color:${color}">${label}</b><br>${tip}`,
    { className: 'ltt', sticky: true }
  );
}

function _buildClosureTip(data) {
  const lines = [];
  for (const c of data.closures.slice(0, 3)) {
    if (c.date) lines.push(`${c.type || ''} ${c.date} · ${c.time || ''}`);
  }
  return lines.join('<br>') || 'Cameron County Hwy 4 / Boca Chica';
}

function updateClosureBadge(data) {
  let badge = document.getElementById('closure-badge');
  if (!badge) {
    // Inject a small badge into the map controls area
    const ctrl = document.querySelector('.map-controls') || document.getElementById('map');
    if (!ctrl) return;
    badge = document.createElement('div');
    badge.id = 'closure-badge';
    badge.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:1200;' +
      'background:rgba(0,0,0,.78);color:#fff;padding:3px 10px;border-radius:12px;' +
      'font-size:11px;font-weight:700;letter-spacing:.04em;pointer-events:none;display:none;';
    document.getElementById('map').appendChild(badge);
  }
  if (data.status === 'open') { badge.style.display = 'none'; return; }
  const color = data.status === 'closed' ? '#ff2222' : '#ff8800';
  const label = data.status === 'closed' ? '🚧 BOCA CHICA CLOSED' : '⚠ CLOSURE SCHEDULED';
  badge.textContent = label;
  badge.style.color  = color;
  badge.style.border = `1px solid ${color}`;
  badge.style.display = '';
}

// ── FAA TFRs ──────────────────────────────────────────────────
async function pollTFR() {
  if (SHARE_MODE) return;
  try {
    const r = await fetch('http://localhost:8766/tfr');
    if (!r.ok) return;
    const data = await r.json();
    applyTFROverlays(data.tfrs || []);
  } catch(_) {}
  _scheduleTFR();
}

function _scheduleTFR() {
  clearTimeout(_tfrPollTimer);
  _tfrPollTimer = setTimeout(pollTFR, _closurePollMs()); // same interval logic
}

function applyTFROverlays(tfrs) {
  if (!map) return;
  // Remove old TFR layers
  Object.values(_tfrLayers).forEach(l => { try { map.removeLayer(l); } catch(_) {} });
  _tfrLayers = {};

  for (const tfr of tfrs) {
    if (!tfr.circles?.length) continue;
    const isSpX = tfr.isSpaceX ||
      (tfr.purpose && /spacex|starship|falcon|dragon|rocket/i.test(tfr.purpose)) ||
      (tfr.facility && /kbro|kbix|ksnl|k5t9/i.test(tfr.facility)); // Brownsville, KSC area airports

    const color = isSpX ? '#00ccff' : '#ffaa00';

    for (let i = 0; i < tfr.circles.length; i++) {
      const c = tfr.circles[i];
      if (!c.lat || !c.lon) continue;
      const key = `${tfr.id}_${i}`;
      const radiusM = (c.radiusNm || 3) * 1852;
      const layer = L.circle([c.lat, c.lon], {
        radius:      radiusM,
        color,
        weight:      1.5,
        opacity:     0.65,
        fillColor:   color,
        fillOpacity: 0.08,
        dashArray:   '5 4',
      }).addTo(map);

      const label = isSpX ? `SpaceX TFR` : `TFR`;
      layer.bindTooltip(
        `<b style="color:${color}">${label} ${esc(tfr.notamNum || tfr.id)}</b>` +
        (tfr.purpose ? `<br><span style="color:var(--t3)">${esc(tfr.purpose.slice(0,80))}</span>` : ''),
        { className: 'ltt', sticky: true }
      );
      _tfrLayers[key] = layer;
    }
  }
}

// ── Init ──────────────────────────────────────────────────────
function initClosures() {
  if (SHARE_MODE) return;
  // Stagger so they don't both fire on page load
  setTimeout(pollClosures, 8000);
  setTimeout(pollTFR,      12000);
}
