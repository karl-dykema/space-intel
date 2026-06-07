'use strict';

const STARBASE_LAT = 25.9969;
const STARBASE_LON = -97.1497;

let _closureLayer = null;
let _tfrLayers    = {};

// ── Load from Supabase app_cache ─────────────────────────────
async function loadClosuresData() {
  if (!SB.init()) { addLog('Closures: Supabase not configured', 'sys'); return; }
  try {
    const rows = await SB.select('app_cache', { key: 'eq.closures.bocachica' });
    if (!rows?.length) { addLog('Closures: no data in DB — run Fetch Closures & TFRs Action', 'sys'); return; }
    const row  = rows[0];
    const data = { ...row.data, fetchedAt: row.fetched_at };
    const ageH = row.fetched_at ? ((Date.now() - new Date(row.fetched_at).getTime()) / 3600000).toFixed(1) : '?';
    const tfrCount = (data.tfrs  || []).length;
    const spxTFRs  = (data.tfrs  || []).filter(t => t.isSpaceX).length;
    addLog(`Closures: Boca Chica=${data.status||'unknown'} · TFRs=${tfrCount} (${spxTFRs} SpaceX) · data ${ageH}h old`, 'sys');
    if (tfrCount > 0) addLog(`TFRs: ${(data.tfrs||[]).map(t=>`${t.notamNum||t.id}${t.isSpaceX?' [SpX]':''}`).join(', ')}`, 'ais');
    applyClosureOverlay(data);
    updateClosureBadge(data);
    applyTFROverlays(data.tfrs || []);
    if (!SHARE_MODE) _checkClosuresAge(row.fetched_at);
  } catch(e) { addLog(`Closures: load error — ${e.message}`, 'err'); }
}

// ── Staleness check (admin only) ─────────────────────────────
function _checkClosuresAge(fetchedAt) {
  const ageH = fetchedAt ? (Date.now() - new Date(fetchedAt).getTime()) / 3600000 : 999;
  const el = document.getElementById('closures-age');
  if (!el) return;
  if (ageH > 12) {
    el.textContent = `Closures data: ${Math.round(ageH)}h old — GitHub Action may be stale`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

// ── Closure map overlay ───────────────────────────────────────
function applyClosureOverlay(data) {
  if (!map) return;
  if (_closureLayer) { map.removeLayer(_closureLayer); _closureLayer = null; }
  const st = data.status;
  if (st === 'open' || st === 'unknown') return;

  const color   = st === 'closed'    ? '#ff2222' : '#ff8800';
  const opacity = st === 'closed'    ? 0.22      : 0.14;
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
  const lines = data.closures.slice(0, 3)
    .filter(c => c.date)
    .map(c => `${c.type ? c.type + ' ' : ''}${c.date}${c.time ? ' · ' + c.time : ''}`)
    .join('<br>') || 'Cameron County Hwy 4 / Boca Chica';
  _closureLayer.bindTooltip(
    `<b style="color:${color}">${label}</b><br>${lines}`,
    { className: 'ltt', sticky: true }
  );
}

function updateClosureBadge(data) {
  let badge = document.getElementById('closure-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'closure-badge';
    badge.style.cssText =
      'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:1200;' +
      'background:rgba(0,0,0,.78);color:#fff;padding:3px 10px;border-radius:12px;' +
      'font-size:11px;font-weight:700;letter-spacing:.04em;pointer-events:none;display:none;';
    document.getElementById('map').appendChild(badge);
  }
  if (data.status === 'open' || data.status === 'unknown') { badge.style.display = 'none'; return; }
  const color = data.status === 'closed' ? '#ff2222' : '#ff8800';
  badge.textContent = data.status === 'closed' ? 'BOCA CHICA CLOSED' : 'CLOSURE SCHEDULED';
  badge.style.color  = color;
  badge.style.border = `1px solid ${color}`;
  badge.style.display = '';
}

// ── FAA TFR overlays ──────────────────────────────────────────
function applyTFROverlays(tfrs) {
  if (!map) return;
  Object.values(_tfrLayers).forEach(l => { try { map.removeLayer(l); } catch(_) {} });
  _tfrLayers = {};

  for (const tfr of tfrs) {
    if (!tfr.circles?.length) continue;
    const isSpX = tfr.isSpaceX ||
      /spacex|starship|falcon|dragon|rocket/i.test(tfr.purpose || '') ||
      /kbro|kbix|ksnl|k5t9/i.test(tfr.facility || '');
    const color = isSpX ? '#00ccff' : '#ffaa00';

    for (let i = 0; i < tfr.circles.length; i++) {
      const c = tfr.circles[i];
      if (!c.lat || !c.lon) continue;
      const layer = L.circle([c.lat, c.lon], {
        radius:      (c.radiusNm || 3) * 1852,
        color,
        weight:      1.5,
        opacity:     0.65,
        fillColor:   color,
        fillOpacity: 0.08,
        dashArray:   '5 4',
      }).addTo(map);
      layer.bindTooltip(
        `<b style="color:${color}">${isSpX ? 'SpaceX TFR' : 'TFR'} ${esc(tfr.notamNum || tfr.id)}</b>` +
        (tfr.purpose ? `<br><span style="color:var(--t3)">${esc(tfr.purpose.slice(0,80))}</span>` : ''),
        { className: 'ltt', sticky: true }
      );
      _tfrLayers[`${tfr.id}_${i}`] = layer;
    }
  }
}

// ── Init ──────────────────────────────────────────────────────
function initClosures() {
  loadClosuresData();
}
