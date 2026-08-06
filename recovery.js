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

// Operation phase. This is editorial — sourced from reporting, not telemetry — and
// must be updated by hand as the operation progresses. It changes which vessel acts
// as the position proxy: while adrift, Go Australis was station-keeping alongside;
// under tow, Ship 40 rides on Normand Ranger's wire a few hundred metres astern, so
// the tug is the better proxy.
const RECOVERY_OP = {
  phase: 'under_tow',                       // 'adrift' | 'under_tow' | 'complete'
  phaseSince: '2026-08-02T00:00:00Z',       // tow connected — approximate
  tow:     '257587000',                     // Normand Ranger — AHTS on the tow wire
  escort:  '372112000',                     // Go Australis — LZ support, escorting
  support: ['257084000'],                   // Skimmer Tide — rigging/crew support
  // Destination is not confirmed — reporting names both Pilbara ports as candidates.
  // The readout shows whichever is nearer and flags that it is unconfirmed.
  destinations: [
    { name:'Dampier, WA',      lat:-20.663, lon:116.712 },
    { name:'Port Hedland, WA', lat:-20.310, lon:118.575 },
  ],
};

// ── Estimated-position model ──────────────────────────────────
// Ship 40 has no AIS and the flotilla is beyond terrestrial range, so there is no
// position to plot. Rather than plot nothing or invent a point, model where it can
// plausibly BE and draw that region.
//
// The anchor is a reported range-to-port, not a coordinate — which is fortunate,
// because the uncertainty then decomposes cleanly:
//   along-track : tow speed is uncertain (reported 1-3 kn), so distance covered
//                 since the anchor is a range → two arcs at different radii
//   cross-track : the exact route bearing is unknown → a sector of bearings
// The result is an annulus segment: bounded by two range arcs from the port and two
// bearing limits. It widens by itself as the speed uncertainty compounds over time,
// so a stale estimate visibly becomes useless rather than quietly becoming wrong.
const ESTIMATE = {
  // Sal Mercogliano (What's Going on With Shipping), reading MarineTraffic.
  anchor: { at: '2026-08-03T12:00:00Z', nmToPort: 852 },
  port:   { name:'Dampier, WA', lat:-20.663, lon:116.712 },
  speedKn: { min: 1.0, max: 3.0 },   // observed ~1-1.5; Sal's projection used 3
  bearingDeg: { from: 288, to: 318 },// sector from the port out toward the ship
  maxAgeDays: 14,                    // past this, the anchor is too old to mean anything
};

// Project a point: from → bearing (deg) → distance (nm).
function _project(from, bearingDeg, nm) {
  const r = Math.PI/180, R = 3440.065;
  const d = nm / R, b = bearingDeg * r;
  const lat1 = from.lat * r, lon1 = from.lon * r;
  const lat2 = Math.asin(Math.sin(lat1)*Math.cos(d) + Math.cos(lat1)*Math.sin(d)*Math.cos(b));
  const lon2 = lon1 + Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat1),
                                 Math.cos(d) - Math.sin(lat1)*Math.sin(lat2));
  return { lat: lat2/r, lon: ((lon2/r + 540) % 360) - 180 };
}

// Current plausible range-to-port window, or null if the estimate has expired.
function _estimateWindow() {
  const anchorMs = Date.parse(ESTIMATE.anchor.at);
  const elapsedH = (Date.now() - anchorMs) / 3600000;
  if (elapsedH < 0 || elapsedH / 24 > ESTIMATE.maxAgeDays) return null;

  const { min, max } = ESTIMATE.speedKn;
  const near = Math.max(0, ESTIMATE.anchor.nmToPort - max * elapsedH); // fastest case
  const far  = Math.max(0, ESTIMATE.anchor.nmToPort - min * elapsedH); // slowest case
  if (far <= 0) return null; // even the slowest case says it has arrived

  return {
    near, far, elapsedH,
    etaEarlyH: near / max,
    etaLateH:  far / min,
  };
}

// Nearest candidate port to a given position, with distance.
function _nearestPort(from) {
  return RECOVERY_OP.destinations
    .map(d => ({ ...d, nm: _nm(from, d) }))
    .sort((a, b) => a.nm - b.nm)[0];
}

// Whichever vessel is currently closest to Ship 40 physically, for position proxying.
function _proxyMmsi() {
  return RECOVERY_OP.phase === 'under_tow' ? RECOVERY_OP.tow : RECOVERY_OP.escort;
}

// Everyone else in the flotilla, for range lines.
function _otherMmsis() {
  const p = _proxyMmsi();
  return [RECOVERY_OP.tow, RECOVERY_OP.escort, ...RECOVERY_OP.support].filter(m => m !== p);
}

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

  const proxyMmsi = _proxyMmsi();
  const proxy = _pos(proxyMmsi);
  // A real position always beats a model. Only estimate when we have nothing.
  if (!proxy) { drawEstimate(); return; }
  // No proxy position means nothing trustworthy to infer from. Say so on the button
  // rather than letting the toggle look broken — the flotilla is ~750nm offshore, far
  // beyond terrestrial AIS range, so this is the expected state until it nears Dampier.
  _setBtnState(!!proxy);
  if (!proxy) return;

  const underTow = RECOVERY_OP.phase === 'under_tow';
  const proxyName = (typeof VESSEL_DB !== 'undefined' && VESSEL_DB[proxyMmsi]?.abbr) || 'escort';
  const ship = { lat: proxy.lat, lon: proxy.lon };
  const stale = proxy.ts ? (Date.now() - proxy.ts > 7200000) : true;

  // Ship 40 — hollow diamond, deliberately unlike a vessel marker.
  const svg =
    `<svg width="22" height="22" viewBox="0 0 22 22">` +
    `<polygon points="11,1 21,11 11,21 1,11" fill="none" ` +
    `stroke="${RECOVERY_COLOR}" stroke-width="1.6" opacity="${stale ? 0.5 : 0.95}"/>` +
    `<circle cx="11" cy="11" r="2.4" fill="${RECOVERY_COLOR}" opacity="${stale ? 0.5 : 0.95}"/></svg>`;

  const rows = _otherMmsis().map(mmsi => {
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

  const port = _nearestPort(ship);
  const toPort = port.nm;
  // Under tow the meaningful ETA is Ship 40's own arrival at port, at tow speed.
  // Tow speed is ~1-1.5kn, so accept any headway above a drift threshold.
  const portEta = (underTow && proxy.sog > 0.3) ? toPort / proxy.sog : null;
  const portEtaStr = portEta != null
    ? ` · ETA ${portEta < 24 ? portEta.toFixed(1) + 'h' : (portEta/24).toFixed(1) + 'd'}`
    : '';

  const status = underTow
    ? `<b style="color:${RECOVERY_COLOR}">UNDER TOW</b> by ${esc(proxyName)}` +
      (proxy.sog > 0.5 ? ` at ${proxy.sog.toFixed(1)} kn` : '')
    : `Adrift`;

  L.marker([ship.lat, ship.lon], {
    icon: L.divIcon({ html: svg, iconSize:[22,22], iconAnchor:[11,11], className:'' }),
    zIndexOffset: 600,
  }).addTo(_recoveryLayer).bindTooltip(
    `<b style="color:${RECOVERY_COLOR}">SHIP 40 · STARSHIP FLIGHT 13</b>` +
    `<br><span style="color:var(--t3);font-size:11px">${status} · afloat ${_afloatStr()} since splashdown</span>` +
    `<br><span style="color:var(--t5);font-size:10px">Position INFERRED from ${esc(proxyName)}` +
    (underTow ? ' on the tow wire' : ' station-keeping') +
    (stale ? ' · position stale' : '') + `</span>` +
    (rows.length ? `<div style="margin-top:5px;font-size:11px;color:var(--t3)">${rows.map(fmt).join('<br>')}</div>` : '') +
    `<div style="margin-top:4px;font-size:10px;color:var(--t5)">${toPort.toFixed(0)}nm to ${esc(port.name)}` +
    `${portEtaStr}<br>destination port not yet confirmed</div>`,
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

// ── Estimated-position region ─────────────────────────────────
// Drawn only when there is no real position. Deliberately a region, never a point:
// there is nothing here precise enough to justify a marker.
function drawEstimate() {
  const w = _estimateWindow();
  _setBtnState(false, !!w);
  if (!w) return;

  const { from, to } = ESTIMATE.bearingDeg;
  const step = 2;
  const outer = [], inner = [];
  for (let b = from; b <= to; b += step) {
    outer.push(_project(ESTIMATE.port, b, w.far));
    inner.push(_project(ESTIMATE.port, b, w.near));
  }
  const ring = [...outer, ...inner.reverse()].map(p => [p.lat, p.lon]);

  const hrs = h => h < 48 ? `${h.toFixed(0)}h` : `${(h/24).toFixed(1)}d`;
  const band = w.far - w.near;

  L.polygon(ring, {
    color: RECOVERY_COLOR, weight: 1.2, opacity: 0.6,
    fillColor: RECOVERY_COLOR, fillOpacity: 0.07, dashArray: '6 5',
  }).addTo(_recoveryLayer).bindTooltip(
    `<b style="color:${RECOVERY_COLOR}">SHIP 40 · ESTIMATED AREA</b>` +
    `<br><span style="color:var(--t3);font-size:11px">Somewhere in here — ` +
    `${w.near.toFixed(0)}–${w.far.toFixed(0)}nm from ${esc(ESTIMATE.port.name)}</span>` +
    `<br><span style="color:var(--t3);font-size:11px">Arrival in ${hrs(w.etaEarlyH)} – ${hrs(w.etaLateH)}</span>` +
    `<div style="margin-top:5px;font-size:10px;color:var(--t5)">` +
    `NOT A POSITION. Modelled from a reported ${ESTIMATE.anchor.nmToPort}nm range ` +
    `${hrs(w.elapsedH)} ago at ${ESTIMATE.speedKn.min}–${ESTIMATE.speedKn.max}kn.<br>` +
    `Uncertainty spans ${band.toFixed(0)}nm and grows until a real position arrives.</div>`,
    { className:'ltt ltt-wrap', direction:'auto', maxWidth:340, sticky:true }
  );
}

// ── Button state ──────────────────────────────────────────────
// Distinguishes "layer off" from "layer on but no position available", so an
// enabled toggle that draws nothing doesn't read as a broken button.
function _setBtnState(hasData, hasEstimate) {
  const btn = document.getElementById('recovery-btn');
  if (!btn) return;
  if (!showRecovery) {
    btn.style.opacity = '0.4';
    btn.textContent = 'SHIP 40 RECOVERY';
    btn.title = 'Toggle Starship Ship 40 at-sea recovery operation';
    return;
  }
  const towing = RECOVERY_OP.phase === 'under_tow';
  btn.style.opacity = hasData ? '1' : hasEstimate ? '0.8' : '0.55';
  btn.textContent = hasData
    ? (towing ? 'SHIP 40 · UNDER TOW' : 'SHIP 40 RECOVERY')
    : hasEstimate ? 'SHIP 40 · ESTIMATED'
    : (towing ? 'SHIP 40 · TOW · NO AIS' : 'SHIP 40 · NO AIS');
  btn.title = hasData
    ? 'Starship Ship 40 at-sea recovery operation'
    : hasEstimate
      ? 'No AIS in range — showing a modelled area where Ship 40 plausibly is, '
      + 'not a position. Widens as uncertainty grows.'
      : (towing
        ? 'Ship 40 is under tow by Normand Ranger per reporting, but the flotilla is '
        + '~750nm offshore, beyond terrestrial AIS range — no live position until it nears Dampier'
        : 'Recovery flotilla is ~750nm offshore, beyond terrestrial AIS range — '
        + 'no position available until it approaches Dampier');
}

// ── Toggle (cbar button) ──────────────────────────────────────
function toggleRecovery() {
  showRecovery = !showRecovery;
  drawRecovery();
  if (!showRecovery) _setBtnState(false);
}
