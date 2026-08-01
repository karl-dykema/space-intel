'use strict';

// ── Starship at-sea recovery operation ────────────────────────
// Ship 40 survived the Flight 13 splashdown intact (2026-07-24) and is adrift
// in the Indian Ocean off NW Australia. SpaceX chartered a three-vessel
// flotilla to attempt the first-ever at-sea recovery of a Starship.
//
// Ship 40 carries no AIS, so it cannot be tracked directly. Go Australis has
// been station-keeping alongside it since the splashdown, so its position is
// used as a proxy — always rendered and labelled as INFERRED, never as a fix.
//
// This layer is deliberately self-contained and time-boxed: when the tow ends,
// delete this file, its <script> tag, and the RECOVERY button in index.html.

let _recoveryLayer = null;
let showRecovery   = true;

const RECOVERY_COLOR = '#ffd21f'; // recovery-operation amber, distinct from hazard orange

// Approximate — liftoff was 2026-07-24 22:51Z, splashdown ~T+66min.
const SPLASHDOWN_UTC = '2026-07-24T23:57:00Z';

const RECOVERY_OP = {
  proxy: '372112000',                       // Go Australis — station-keeping alongside Ship 40
  inbound: ['257587000', '257084000'],      // Normand Ranger (tow), Skimmer Tide (rigging support)
  destination: { name:'Dampier, WA', lat:-20.663, lon:116.712 },
};

// ── Geo helpers (nautical miles) ──────────────────────────────
function _nm(a, b) {
  const R = 3440.065, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const s = Math.sin(dLat/2)**2 +
            Math.cos(a.lat*r) * Math.cos(b.lat*r) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function _bearing(a, b) {
  const r = Math.PI / 180;
  const dLon = (b.lon - a.lon) * r;
  const y = Math.sin(dLon) * Math.cos(b.lat*r);
  const x = Math.cos(a.lat*r) * Math.sin(b.lat*r) -
            Math.sin(a.lat*r) * Math.cos(b.lat*r) * Math.cos(dLon);
  return (Math.atan2(y, x) / r + 360) % 360;
}

// Live AIS position if we have one, else the VesselAPI snapshot the app already loaded.
function _pos(mmsi) {
  const v = (typeof S !== 'undefined' && S.vessels) ? S.vessels[mmsi] : null;
  if (v && v.lat != null && v.lon != null) return v;
  return null;
}

function _hoursAfloat() {
  return (Date.now() - Date.parse(SPLASHDOWN_UTC)) / 3600000;
}

function _afloatStr() {
  const h = _hoursAfloat();
  const d = Math.floor(h / 24);
  return d >= 1 ? `${d}d ${Math.floor(h % 24)}h` : `${Math.floor(h)}h`;
}

// ── Draw ──────────────────────────────────────────────────────
function drawRecovery() {
  if (typeof map === 'undefined' || !map) return;
  if (!_recoveryLayer) _recoveryLayer = L.layerGroup().addTo(map);
  _recoveryLayer.clearLayers();
  if (!showRecovery) return;

  const proxy = _pos(RECOVERY_OP.proxy);
  if (!proxy) return; // no escort position — nothing trustworthy to infer from

  const ship = { lat: proxy.lat, lon: proxy.lon };
  const stale = proxy.ts ? (Date.now() - proxy.ts > 7200000) : true;

  // Ship 40 — hollow diamond, deliberately unlike a vessel marker.
  const svg =
    `<svg width="22" height="22" viewBox="0 0 22 22">` +
    `<polygon points="11,1 21,11 11,21 1,11" fill="none" ` +
    `stroke="${RECOVERY_COLOR}" stroke-width="1.6" opacity="${stale ? 0.5 : 0.95}"/>` +
    `<circle cx="11" cy="11" r="2.4" fill="${RECOVERY_COLOR}" opacity="${stale ? 0.5 : 0.95}"/></svg>`;

  const rows = RECOVERY_OP.inbound.map(mmsi => {
    const p = _pos(mmsi);
    const info = (typeof VESSEL_DB !== 'undefined' && VESSEL_DB[mmsi]) || {};
    const nm = p ? _nm(p, ship) : null;
    // Only call it an ETA when the vessel is actually making way toward the ship.
    const eta = (p && nm != null && p.sog > 0.5) ? nm / p.sog : null;
    return { mmsi, name: info.abbr || info.name || mmsi, p, nm, eta };
  });

  const fmt = r => {
    if (!r.p)          return `<span style="color:var(--t5)">${esc(r.name)} — no position</span>`;
    if (r.nm < 1)      return `<span style="color:${RECOVERY_COLOR}">${esc(r.name)} — alongside</span>`;
    const brg = Math.round(_bearing(r.p, ship));
    const eta = r.eta != null
      ? ` · ETA ${r.eta < 24 ? r.eta.toFixed(1) + 'h' : (r.eta/24).toFixed(1) + 'd'}`
      : '';
    return `${esc(r.name)} — ${r.nm.toFixed(0)}nm brg ${String(brg).padStart(3,'0')}°${eta}`;
  };

  const toPort = _nm(ship, RECOVERY_OP.destination);

  L.marker([ship.lat, ship.lon], {
    icon: L.divIcon({ html: svg, iconSize:[22,22], iconAnchor:[11,11], className:'' }),
    zIndexOffset: 600,
  }).addTo(_recoveryLayer).bindTooltip(
    `<b style="color:${RECOVERY_COLOR}">SHIP 40 · STARSHIP FLIGHT 13</b>` +
    `<br><span style="color:var(--t3);font-size:11px">Adrift &amp; afloat ${_afloatStr()} since splashdown</span>` +
    `<br><span style="color:var(--t5);font-size:10px">Position INFERRED from Go Australis station-keeping` +
    (stale ? ' · escort position stale' : '') + `</span>` +
    `<div style="margin-top:5px;font-size:11px;color:var(--t3)">${rows.map(fmt).join('<br>')}</div>` +
    `<div style="margin-top:4px;font-size:10px;color:var(--t5)">${toPort.toFixed(0)}nm to ${esc(RECOVERY_OP.destination.name)}</div>`,
    { className:'ltt ltt-wrap', direction:'auto', maxWidth:340, sticky:true }
  );

  // Range lines from each inbound vessel to the ship.
  for (const r of rows) {
    if (!r.p || r.nm == null || r.nm < 1) continue;
    L.polyline([[r.p.lat, r.p.lon], [ship.lat, ship.lon]], {
      color: RECOVERY_COLOR, weight: 1, opacity: 0.35, dashArray: '4 6',
    }).addTo(_recoveryLayer).bindTooltip(
      `<span style="color:${RECOVERY_COLOR}">${esc(r.name)} → Ship 40</span>` +
      `<br><span style="font-size:11px;color:var(--t3)">${r.nm.toFixed(0)}nm</span>`,
      { className:'ltt', sticky:true }
    );
  }
}

// ── Toggle (cbar button) ──────────────────────────────────────
function toggleRecovery() {
  showRecovery = !showRecovery;
  drawRecovery();
  const btn = document.getElementById('recovery-btn');
  if (btn) btn.style.opacity = showRecovery ? '1' : '0.4';
}
