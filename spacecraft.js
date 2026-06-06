'use strict';

const S_spacecraft={};
let tleData={};

// ── Orbit tracker ─────────────────────────────────────────────
// data/stations.tle is refreshed by GitHub Actions every 2h (same origin = no CORS).
// Ivan API is a CORS-open fallback if the file is missing or stale.
const IVAN_BASE = 'https://tle.ivanstanojevic.me/api/tle';

// Space Devs station IDs for ISS and CSS (Tiangong space station)
const SPACEDEVS_STATIONS = { 'ISS (ZARYA)': 4, 'CSS (TIANHE)': 18 };

// Static module info for space stations — permanent modules + visiting vehicle context.
// visitingNotes: array of {match (regex), location?, note} — first match wins per spacecraft.
const STATION_INFO = {
  'CSS (TIANHE)': {
    fullName: 'China Space Station (Tiangong)',
    agency: 'CNSA',
    modules: [
      { name: 'Wentian',  role: 'Laboratory Module', location: 'Starboard berthing port', col: '#ff6644' },
      { name: 'Mengtian', role: 'Laboratory Module', location: 'Port-side berthing port',  col: '#ff6644' },
    ],
    visitingNotes: [
      { match: /shenzhou/i, location: 'Forward port', note: 'Crewed · 3-astronaut crew including first astronaut from Hong Kong · one crew member on a 1-year stay' },
      { match: /tianzhou/i, location: 'Aft port',     note: 'Cargo · propellant, life support consumables, and scientific payloads' },
    ]
  },
  'ISS (ZARYA)': {
    fullName: 'International Space Station',
    agency: 'NASA · Roscosmos · ESA · JAXA · CSA',
    modules: [],
    visitingNotes: [
      { match: /crew dragon/i,    note: 'Expedition 74 crew transport · SpaceX Crew-12' },
      { match: /cargo dragon/i,   note: 'Cargo resupply · SpaceX CRS-34, arrived May 2026' },
      { match: /cygnus/i,         note: 'Northrop Grumman commercial cargo resupply' },
      { match: /progress ms-34/i, note: 'Roscosmos uncrewed cargo and resupply · docked April 2026' },
      { match: /progress ms-33/i, note: 'Roscosmos uncrewed cargo and resupply · docked March 2026' },
      { match: /progress/i,       note: 'Roscosmos uncrewed cargo and resupply' },
      { match: /soyuz/i,          note: 'Roscosmos crew transport · Soyuz MS-28' },
    ]
  }
};

async function fetchDockedManifest() {
  const CACHE_KEY = 'dockedManifestV1';
  const CACHE_TTL = 4 * 3600000; // 4 hours — well under Space Devs rate limit

  // Use cached manifest if still fresh
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      dockedManifest = cached.data;
      addLog(`Orbit: docking manifest (cache, ISS:${cached.data['ISS (ZARYA)']?.length||0} CSS:${cached.data['CSS (TIANHE)']?.length||0})`, 'sys');
      renderFleet();
      return;
    }
  } catch(e) {}

  const since = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
  const STATION_ID_MAP = { 4: 'ISS (ZARYA)', 18: 'CSS (TIANHE)' };
  // Classify craft type by name; station assigned by docking_location.spacestation.id (authoritative)
  const classify = name => {
    const n = name.toLowerCase();
    if (/crew dragon/.test(n))              return { abbr:'Dragon',   operator:'SpaceX',           col:'#00d4ff' };
    if (/cargo dragon|dragon crs/.test(n))  return { abbr:'Dragon',   operator:'SpaceX',           col:'#00d4ff' };
    if (/cygnus/.test(n))                   return { abbr:'Cygnus',   operator:'Northrop Grumman', col:'#dd8800' };
    if (/progress/.test(n))                 return { abbr:'Progress', operator:'Roscosmos',         col:'#9966ff' };
    if (/soyuz/.test(n))                    return { abbr:'Soyuz',    operator:'Roscosmos',         col:'#9966ff' };
    if (/tianzhou/.test(n))                 return { abbr:'Tianzhou', operator:'CNSA',              col:'#ff6644' };
    if (/shenzhou/.test(n))                 return { abbr:'Shenzhou', operator:'CNSA',              col:'#ff6644' };
    if (/orion/.test(n))                    return { abbr:'Orion',    operator:'NASA',              col:'#ff6600' };
    return null;
  };

  const manifest = { 'ISS (ZARYA)': [], 'CSS (TIANHE)': [] };
  const seen = new Set();
  // Use lldev (no rate limits); one query is enough — it returns events for all stations
  try {
    const url = `https://lldev.thespacedevs.com/2.2.0/docking_event/?docking__gte=${since}&departure__isnull=true&limit=50&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      for (const ev of (data.results || [])) {
        const scName = ev.flight_vehicle?.spacecraft?.name || '';
        const stId   = ev.docking_location?.spacestation?.id;
        const station = STATION_ID_MAP[stId];
        if (!scName || !station || seen.has(scName)) continue;
        seen.add(scName);
        const meta = classify(scName);
        if (!meta) continue;
        manifest[station].push({ name: scName, ...meta });
      }
    }
  } catch(e) {}

  if (Object.values(manifest).some(d => d.length > 0)) {
    dockedManifest = manifest;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: manifest })); } catch(e) {}
    addLog(`Orbit: docking manifest loaded (ISS:${manifest['ISS (ZARYA)'].length} CSS:${manifest['CSS (TIANHE)'].length})`, 'sys');
    renderFleet();
  }
}

function parseTLEText(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  let found = 0;
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i], l1 = lines[i+1], l2 = lines[i+2];
    if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) { i -= 2; continue; }
    const pat = SPACECRAFT_PATTERNS.find(p => p.match(name));
    if (!pat) continue;
    try { tleData[name] = { satrec: satellite.twoline2satrec(l1, l2), meta: pat, name }; found++; } catch(e) {}
  }
  return found;
}

async function fetchTLEsFromIvanAPI() {
  // Full fallback: fetch everything when local file is unavailable
  const queries = [
    `${IVAN_BASE}/25544`, `${IVAN_BASE}/48274`,
    `${IVAN_BASE}?search=SOYUZ-MS&page-size=5`,
    `${IVAN_BASE}?search=PROGRESS-MS&page-size=5`,
    `${IVAN_BASE}?search=SHENZHOU&page-size=5`,
    `${IVAN_BASE}?search=TIANZHOU&page-size=5`,
    `${IVAN_BASE}?search=CREW+DRAGON&page-size=1`,
    `${IVAN_BASE}?search=DRAGON+CRS&page-size=1`,
    `${IVAN_BASE}?search=CYGNUS+NG&page-size=1`,
  ];
  const results = await Promise.allSettled(queries.map(u => fetch(u).then(r => r.ok ? r.json() : null)));
  let found = 0;
  for (const res of results) {
    if (res.status !== 'fulfilled' || !res.value) continue;
    const items = Array.isArray(res.value.member) ? res.value.member : [res.value];
    for (const item of items) {
      if (!item?.name || !item?.line1 || !item?.line2) continue;
      if (/DEB|OBJECT|R\/B/i.test(item.name)) continue;
      const pat = SPACECRAFT_PATTERNS.find(p => p.match(item.name));
      if (!pat || tleData[item.name]) continue;
      try { tleData[item.name] = { satrec: satellite.twoline2satrec(item.line1, item.line2), meta: pat, name: item.name }; found++; } catch(e) {}
    }
  }
  return found;
}

function tleEpochAgeDays(line1) {
  const ep = line1.substring(18, 32).trim();
  const yy = parseInt(ep.substring(0, 2));
  const day = parseFloat(ep.substring(2));
  const yr = yy < 57 ? 2000 + yy : 1900 + yy;
  return (Date.now() - (Date.UTC(yr, 0, 1) + (day - 1) * 86400000)) / 86400000;
}

async function fetchActiveMissionTLEs() {
  // Supplement local file with all currently active docked/mission craft.
  // Epoch age check (14 days) filters out returned/ended missions — active docked
  // craft receive daily TLE updates; anything older means the mission ended.
  const queries = [
    `${IVAN_BASE}?search=SOYUZ-MS&page-size=3`,
    `${IVAN_BASE}?search=PROGRESS-MS&page-size=3`,
    `${IVAN_BASE}?search=SHENZHOU&page-size=2`,
    `${IVAN_BASE}?search=TIANZHOU&page-size=2`,
    `${IVAN_BASE}?search=WENTIAN&page-size=1`,
    `${IVAN_BASE}?search=MENGTIAN&page-size=1`,
    `${IVAN_BASE}?search=CREW+DRAGON&page-size=1`,
    `${IVAN_BASE}?search=DRAGON+CRS&page-size=1`,
    `${IVAN_BASE}?search=CYGNUS+NG&page-size=1`,
    `${IVAN_BASE}?search=ORION&page-size=1`,
  ];
  const results = await Promise.allSettled(queries.map(u => fetch(u).then(r => r.ok ? r.json() : null)));
  let found = 0;
  for (const res of results) {
    if (res.status !== 'fulfilled' || !res.value) continue;
    const items = Array.isArray(res.value.member) ? res.value.member : [res.value];
    for (const item of items) {
      if (!item?.name || !item?.line1 || !item?.line2) continue;
      if (/DEB|OBJECT|R\/B/i.test(item.name)) continue;
      if (tleEpochAgeDays(item.line1) > 14) continue; // skip ended missions
      const pat = SPACECRAFT_PATTERNS.find(p => p.match(item.name));
      if (!pat || tleData[item.name]) continue;
      try { tleData[item.name] = { satrec: satellite.twoline2satrec(item.line1, item.line2), meta: pat, name: item.name }; found++; } catch(e) {}
    }
  }
  return found;
}

async function fetchTLEs() {
  try {
    if (typeof satellite === 'undefined') { addLog('satellite.js not loaded', 'err'); return; }
    // Try same-origin TLE file first (no CORS, updated by GitHub Actions)
    try {
      const res = await fetch('data/stations.tle', { cache: 'no-cache' });
      if (res.ok) {
        const text = await res.text();
        const found = parseTLEText(text);
        if (found > 0) {
          addLog(`Orbit: loaded ${found} spacecraft TLEs`, 'sys');
          clearSatLayers(); updateOrbits();
          // Supplement with all active docked/mission craft
          fetchActiveMissionTLEs().then(n => { if (n > 0) { addLog(`Orbit: +${n} active mission TLEs`, 'sys'); clearSatLayers(); updateOrbits(); } });
          return;
        }
      }
    } catch(e) {}
    // Fallback: Ivan TLE API (CORS-open, JSON)
    addLog('TLE: trying backup API…', 'sys');
    const found = await fetchTLEsFromIvanAPI();
    if (found > 0) { addLog(`Orbit: loaded ${found} spacecraft (backup API)`, 'sys'); clearSatLayers(); updateOrbits(); }
    else addLog('TLE: all sources failed', 'err');
  } catch(e) { addLog(`TLE error: ${e.message}`, 'err'); }
}

function propagateSat(satrec, date) {
  try {
    const pv = satellite.propagate(satrec, date);
    if (!pv?.position) return null;
    const gmst = satellite.gstime(date);
    const gd = satellite.eciToGeodetic(pv.position, gmst);
    return {
      lat: satellite.radiansToDegrees(gd.latitude),
      lon: satellite.radiansToDegrees(gd.longitude),
      alt: gd.height,
    };
  } catch(e) { return null; }
}

function splitAtAntimeridian(pts) {
  if (!pts.length) return [];
  const segs = [];
  let cur = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i][1] - pts[i-1][1]) > 180) {
      if (cur.length > 1) segs.push(cur);
      cur = [pts[i]];
    } else {
      cur.push(pts[i]);
    }
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

function computeGroundTrack(satrec) {
  const now = Date.now();
  const pts = [];
  for (let i = 0; i <= 92; i += 2) {
    const pos = propagateSat(satrec, new Date(now + i * 60000));
    if (pos) pts.push([pos.lat, pos.lon]);
  }
  return pts;
}

function scDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371, d2r = Math.PI/180;
  const dLat = (lat2-lat1)*d2r, dLon = (lon2-lon1)*d2r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Group spacecraft — stations get priority as cluster primaries.
// Affinity-based: longterm docked craft always nest under their home station regardless
// of TLE drift. Mission craft (Dragon, Cygnus) nest if within 2000km, otherwise standalone.
function clusterSpacecraft() {
  const positioned = Object.entries(S_spacecraft).filter(([,sc]) => sc.lat != null);
  const STATIONS = ['ISS (ZARYA)', 'CSS (TIANHE)'];
  const STATION_SET = new Set(STATIONS);
  // Which abbr values belong to which station (longterm docked)
  // Hard affinity: these craft only ever dock to one station
  const ISS_ABBR = new Set(['Soyuz', 'Progress', 'Dragon', 'Cygnus', 'HTV', 'Orion']);
  const CSS_ABBR = new Set(['Wentian', 'Mengtian', 'Shenzhou', 'Tianzhou']);
  const used = new Set();
  const clusters = [];

  // First pass: build station clusters
  for (const stName of STATIONS) {
    const st = S_spacecraft[stName];
    if (!st?.lat) continue;
    used.add(stName);
    const members = [stName];
    const isISS = stName === 'ISS (ZARYA)';
    for (const [other, osc] of positioned) {
      if (used.has(other)) continue;
      if (STATION_SET.has(other)) continue;
      const abbr = osc.abbr || '';
      // Longterm docked craft: always nest under their home station
      const alwaysISS = ISS_ABBR.has(abbr);
      const alwaysCSS = CSS_ABBR.has(abbr);
      if (isISS && alwaysISS) { members.push(other); used.add(other); continue; }
      if (!isISS && alwaysCSS) { members.push(other); used.add(other); continue; }
      if (alwaysISS || alwaysCSS) continue; // claimed by other station, skip
    }
    clusters.push({ primary: stName, members, longterm: true });
  }

  // Second pass: remaining (departed/independent) spacecraft as standalone
  for (const [name] of positioned) {
    if (used.has(name)) continue;
    used.add(name);
    const psc = S_spacecraft[name];
    clusters.push({ primary: name, members: [name], longterm: !!psc.longterm });
  }
  return clusters;
}

function removeSatMarker(name) {
  const marker = spacecraftMarkers[name];
  const track  = orbitTracks[name];
  if (marker) { [orbitLayer, rocketLayer].forEach(l => { if (l) try { l.removeLayer(marker); } catch(e) {} }); delete spacecraftMarkers[name]; }
  if (track)  { [orbitLayer, rocketLayer].forEach(l => { if (l) try { l.removeLayer(track);  } catch(e) {} }); delete orbitTracks[name]; }
}

function updateSpacecraftMarker(primary, members, layer) {
  const sc = S_spacecraft[primary];
  const col = sc.col || '#ffffff';
  const isStation = /^ISS|^CSS/.test(primary);
  const sz = isStation ? 22 : 16;
  const docked = members.filter(n => n !== primary);
  const svg = isStation
    ? `<svg width="${sz}" height="${sz}" viewBox="0 0 20 20">
        <rect x="8" y="8" width="4" height="4" fill="${col}"/>
        <line x1="0" y1="10" x2="8" y2="10" stroke="${col}" stroke-width="2"/>
        <line x1="12" y1="10" x2="20" y2="10" stroke="${col}" stroke-width="2"/>
        <line x1="10" y1="0" x2="10" y2="8" stroke="${col}" stroke-width="1.5" opacity="0.5"/>
        <line x1="10" y1="12" x2="10" y2="20" stroke="${col}" stroke-width="1.5" opacity="0.5"/>
      </svg>`
    : `<svg width="${sz}" height="${sz}" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="3.5" fill="${col}"/>
        <line x1="2" y1="10" x2="7" y2="10" stroke="${col}" stroke-width="1.5"/>
        <line x1="13" y1="10" x2="18" y2="10" stroke="${col}" stroke-width="1.5"/>
      </svg>`;
  const icon = L.divIcon({ html:svg, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], className:'' });
  const altStr = sc.alt ? ` · ${Math.round(sc.alt)} km` : '';
  const dockedHtml = docked.map(n => {
    const d = S_spacecraft[n]; if (!d) return '';
    return `<br><span style="color:${d.col||'#aaa'};font-size:10px">↳ ${esc(d.abbr||n)} · ${esc(d.operator)}</span>`;
  }).join('');
  const dockedBadge = docked.length ? ` <span style="font-size:9px;color:${col}88">(+${docked.length} docked)</span>` : '';
  const tip = `<b style="color:${col}">${esc(sc.abbr||primary)}${dockedBadge}</b><br>
    <span style="color:var(--t5)">${esc(sc.operator)}</span><br>${esc(sc.role)}${altStr}${dockedHtml}`;
  if (!spacecraftMarkers[primary]) {
    spacecraftMarkers[primary] = L.marker([sc.lat, sc.lon], {icon, zIndexOffset:800})
      .addTo(layer).on('click', () => showSpacecraftDetail(primary));
  } else {
    spacecraftMarkers[primary].setLatLng([sc.lat, sc.lon]);
    spacecraftMarkers[primary].setIcon(icon);
  }
  spacecraftMarkers[primary].bindTooltip(tip, {className:'ltt', direction:'auto'});
  // Ground track: past 45 min (solid) + next 90 min (dashed)
  if (tleData[primary]) {
    const nowMs = Date.now();
    const past = [], future = [];
    for (let i = -44; i <= 0; i += 2) {
      const pos = propagateSat(tleData[primary].satrec, new Date(nowMs + i * 60000));
      if (pos) past.push([pos.lat, pos.lon]);
    }
    for (let i = 0; i <= 92; i += 2) {
      const pos = propagateSat(tleData[primary].satrec, new Date(nowMs + i * 60000));
      if (pos) future.push([pos.lat, pos.lon]);
    }
    if (orbitTracks[primary]) { try { layer.removeLayer(orbitTracks[primary]); } catch(e) {} }
    const lines = [
      ...splitAtAntimeridian(past).map(seg   => L.polyline(seg, { color:col, weight:2,   opacity:0.55 })),
      ...splitAtAntimeridian(future).map(seg => L.polyline(seg, { color:col, weight:1.5, opacity:0.25, dashArray:'5 8' })),
    ];
    if (lines.length) orbitTracks[primary] = L.layerGroup(lines).addTo(layer);
  }
}

function clearSatLayers() {
  if (orbitLayer)  orbitLayer.clearLayers();
  if (rocketLayer) rocketLayer.clearLayers();
  for (const k in spacecraftMarkers) delete spacecraftMarkers[k];
  for (const k in orbitTracks)       delete orbitTracks[k];
}

function updateOrbits() {
  if (!map || !orbitLayer || !rocketLayer) return;
  const now = new Date();
  // Propagate all positions first; skip craft with implausible altitudes (re-entered or bad TLE)
  for (const [name, tle] of Object.entries(tleData)) {
    const pos = propagateSat(tle.satrec, now);
    if (!pos || pos.alt < 150 || pos.alt > 2200) continue;
    S_spacecraft[name] = { ...tle.meta, name, lat:pos.lat, lon:pos.lon, alt:pos.alt, incDeg: tle.satrec.inclo * (180/Math.PI) };
  }
  // Cluster and render one marker per cluster
  const clusters = clusterSpacecraft();
  const renderedPrimaries = new Set();
  for (const cluster of clusters) {
    // Non-primary cluster members get no individual marker
    cluster.members.forEach(n => { if (n !== cluster.primary) removeSatMarker(n); });
    if (cluster.longterm && !showSpacecraft) {
      removeSatMarker(cluster.primary);
      continue;
    }
    const layer = cluster.longterm ? orbitLayer : rocketLayer;
    updateSpacecraftMarker(cluster.primary, cluster.members, layer);
    renderedPrimaries.add(cluster.primary);
  }
  // Remove markers for spacecraft no longer in tleData (e.g. re-entered)
  Object.keys(spacecraftMarkers).forEach(name => {
    if (!name.startsWith('__') && !renderedPrimaries.has(name)) removeSatMarker(name);
  });
  updateBoosterProjections();
}

function toggleVessels() {
  showVessels = !showVessels;
  if (showVessels) layers.addTo(map); else map.removeLayer(layers);
  const btn = document.getElementById('vessels-btn');
  if (btn) btn.style.opacity = showVessels ? '1' : '0.4';
  renderFleet();
}
function toggleAircraft() {
  showAircraft = !showAircraft;
  if (showAircraft) aircraftLayer.addTo(map); else map.removeLayer(aircraftLayer);
  const btn = document.getElementById('aircraft-btn');
  if (btn) btn.style.opacity = showAircraft ? '1' : '0.4';
  renderFleet();
}
function toggleSpacecraft() {
  showSpacecraft = !showSpacecraft;
  const btn = document.getElementById('spacecraft-btn');
  if (btn) btn.style.opacity = showSpacecraft ? '1' : '0.4';
  if (showSpacecraft && !Object.keys(tleData).length) {
    addLog('Spacecraft: no TLE data loaded — retrying Celestrak…', 'err');
    fetchTLEs();
  }
  updateOrbits();
  renderFleet();
}

// ── Day/night terminator ───────────────────────────────────────
function updateTerminator() {
  if (!map || !terminatorLayer) return;
  terminatorLayer.clearLayers();
  const now = new Date();
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const decl = -23.45 * Math.cos(2 * Math.PI / 365 * (doy + 10));
  const declRad = decl * Math.PI / 180;
  const utcH = now.getUTCHours() + now.getUTCMinutes()/60 + now.getUTCSeconds()/3600;
  const subSolarLon = (12 - utcH) * 15;
  const pts = [];
  for (let lon = -180; lon <= 180; lon += 1) {
    const lonRad = (lon - subSolarLon) * Math.PI / 180;
    const lat = Math.atan(-Math.cos(lonRad) / Math.tan(declRad)) * 180 / Math.PI;
    pts.push([lat, lon]);
  }
  const pole = decl > 0 ? -90 : 90;
  L.polygon([...pts, [pole, 180], [pole, -180]], {
    color:'transparent', fillColor:'#000820', fillOpacity:0.42, interactive:false
  }).addTo(terminatorLayer);
  L.polyline(pts, { color:'#ffdd88', weight:1, opacity:0.35, dashArray:'3 5', interactive:false }).addTo(terminatorLayer);
}

// ── Mission arc ────────────────────────────────────────────────
function greatCircleArc(lat1,lon1,lat2,lon2,steps=60) {
  const r=Math.PI/180;
  const φ1=lat1*r, λ1=lon1*r, φ2=lat2*r, λ2=lon2*r;
  const d=2*Math.asin(Math.sqrt(Math.sin((φ2-φ1)/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin((λ2-λ1)/2)**2));
  if(d<0.0001) return [[lat1,lon1],[lat2,lon2]];
  const pts=[];
  for(let i=0;i<=steps;i++){
    const f=i/steps;
    const A=Math.sin((1-f)*d)/Math.sin(d), B=Math.sin(f*d)/Math.sin(d);
    const x=A*Math.cos(φ1)*Math.cos(λ1)+B*Math.cos(φ2)*Math.cos(λ2);
    const y=A*Math.cos(φ1)*Math.sin(λ1)+B*Math.cos(φ2)*Math.sin(λ2);
    const z=A*Math.sin(φ1)+B*Math.sin(φ2);
    pts.push([Math.atan2(z,Math.sqrt(x*x+y*y))/r, Math.atan2(y,x)/r]);
  }
  return pts;
}

function addArcLines(layer, pts, style) {
  splitAtAntimeridian(pts).forEach(seg => {
    if (seg.length > 1) L.polyline(seg, {...style, interactive:false}).addTo(layer);
  });
}

// ── Orbital trajectory helpers ────────────────────────────────
// Derive inclination from orbit type + mission context
function orbitInclination(orbit, padLat, missionName) {
  const abbrev = (orbit?.abbrev || '').toUpperCase();
  const name   = (orbit?.name   || '').toUpperCase();
  const mName  = (missionName   || '').toUpperCase();
  if (abbrev === 'ISS' || name.includes('SPACE STATION')) return 51.6;
  if (abbrev === 'CSS' || name.includes('TIANGONG'))      return 41.5;
  if (abbrev === 'SSO' || name.includes('SUN-SYNC') || name.includes('SUN SYNC')) return 97.8;
  if (abbrev === 'POLAR' || name.includes('POLAR ORBIT')) return 90;
  if (abbrev === 'GTO' || abbrev === 'GEO' || name.includes('TRANSFER')) return Math.max(Math.abs(padLat) + 1, 27);
  if (mName.includes('STARLINK')) return (Math.abs(padLat) > 33) ? 97.8 : 53;
  if (mName.includes('GPS') || mName.includes('NAVSTAR')) return 55;
  if (abbrev === 'LEO' || abbrev === 'MEO') return Math.max(Math.abs(padLat) + 8, 40);
  return Math.max(Math.abs(padLat) + 5, 28);
}

// Launch azimuth (deg true north) from pad latitude and target inclination
function launchAzimuth(padLat, inc) {
  const sinβ = Math.cos(inc * Math.PI/180) / Math.cos(padLat * Math.PI/180);
  if (Math.abs(sinβ) > 1) return 90; // equatorial fallback
  let β = Math.asin(Math.min(1, Math.max(-1, sinβ))) * 180/Math.PI;
  if (inc > 90) β = 180 - β; // retrograde orbits go south
  return ((β % 360) + 360) % 360;
}

// Compute ground track waypoints along a constant initial azimuth (geodesic)
function groundTrackPts(lat0, lon0, azDeg, steps, stepKm) {
  const pts = [[lat0, lon0]];
  let φ = lat0 * Math.PI/180, λ = lon0 * Math.PI/180;
  const β = azDeg * Math.PI/180;
  for (let n = 0; n < steps; n++) {
    const d = stepKm / 6371;
    const φ2 = Math.asin(Math.sin(φ)*Math.cos(d) + Math.cos(φ)*Math.sin(d)*Math.cos(β));
    const Δλ = Math.atan2(Math.sin(β)*Math.sin(d)*Math.cos(φ), Math.cos(d) - Math.sin(φ)*Math.sin(φ2));
    φ = φ2; λ = λ + Δλ;
    pts.push([φ*180/Math.PI, (((λ*180/Math.PI) + 180) % 360) - 180]);
  }
  return pts;
}

function getMissionArcs(launch, isHot) {
  const lspName    = launch.launch_service_provider?.name || '';
  const padName    = (launch.pad?.name || '') + ' ' + (launch.pad?.location?.name || '');
  const missionName = launch.mission?.name || launch.name || '';
  const orbit      = launch.mission?.orbit;
  const op = isHot ? 0.75 : 0.45;
  const w  = isHot ? 2.0  : 1.5;
  const da = isHot ? '8 4' : '5 8';
  let padCoords = null, arcs = [];

  if (lspName.includes('SpaceX')) {
    if (/Starbase|Boca Chica/i.test(padName)) {
      padCoords = LAUNCH_PADS['starbase'];
      // Starship booster: east into Gulf, boostback to Mechazilla
      const boosterWpts = [
        [padCoords.lat, padCoords.lon],
        [26.8,-95.5],[26.5,-93.5],[26.0,-95.0],[25.9,-97.1]
      ];
      // Ship: east then orbital insertion, through Caribbean/Atlantic/Indian Ocean
      const shipWpts = [
        [padCoords.lat, padCoords.lon],
        [25.5,-90.0],[24.0,-80.0],[21.0,-70.0],
        [17.0,-58.0],[12.0,-42.0],[7.0,-22.0],
        [2.0,0.0],[-4.0,22.0],[-10.0,50.0],[-15.0,80.0]
      ];
      arcs = [
        { pts:boosterWpts, style:{color:'#ff8800',weight:w,opacity:op,dashArray:da} },
        { pts:shipWpts,    style:{color:'#44aaff',weight:w,opacity:op,dashArray:da} },
      ];
    } else if (/Vandenberg|SLC-4/i.test(padName)) {
      padCoords = LAUNCH_PADS['slc4e'];
      const inc   = orbitInclination(orbit, padCoords.lat, missionName);
      const az    = launchAzimuth(padCoords.lat, inc);
      const sepPt = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 300)[1];
      const dsPt  = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 650)[1];
      const dsV   = S.vessels['368351350'];
      const upperEndPt = groundTrackPts(sepPt[0], sepPt[1], az, 8, 200);
      arcs = [
        { pts:groundTrackPts(padCoords.lat,padCoords.lon,az,6,50), style:{color:'#ff8800',weight:w,opacity:op,dashArray:da} },
        { pts:upperEndPt,                                           style:{color:'#44aaff',weight:w,opacity:op,dashArray:da} },
      ];
      if (dsV?.lat) {
        const r = Math.PI/180;
        const dLat = (dsV.lat - padCoords.lat)*r, dLon = (dsV.lon - padCoords.lon)*r;
        const a = Math.sin(dLat/2)**2 + Math.cos(padCoords.lat*r)*Math.cos(dsV.lat*r)*Math.sin(dLon/2)**2;
        if (2*6371*Math.asin(Math.sqrt(a)) > 400) arcs.push({ pts:greatCircleArc(sepPt[0],sepPt[1],dsV.lat,dsV.lon), style:{color:'#ff4444',weight:w,opacity:op*.9,dashArray:da} });
      } else {
        arcs.push({ pts:greatCircleArc(sepPt[0],sepPt[1],dsPt[0],dsPt[1]), style:{color:'#ff4444',weight:w,opacity:op*.9,dashArray:da} });
      }
    } else {
      padCoords = /LC-39A/i.test(padName) ? LAUNCH_PADS['lc39a'] : LAUNCH_PADS['slc40'];
      const inc   = orbitInclination(orbit, padCoords.lat, missionName);
      const az    = launchAzimuth(padCoords.lat, inc);
      const sepPt = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 350)[1];
      const dsPt  = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 700)[1];
      const dsE   = S.vessels['368219910'];
      const upperEndPt = groundTrackPts(sepPt[0], sepPt[1], az, 10, 200);
      arcs = [
        { pts:groundTrackPts(padCoords.lat,padCoords.lon,az,7,50), style:{color:'#ff8800',weight:w,opacity:op,dashArray:da} },
        { pts:upperEndPt,                                           style:{color:'#44aaff',weight:w,opacity:op,dashArray:da} },
      ];
      // Only draw booster-to-ship arc when drone ship is deployed (>400km from pad)
      if (dsE?.lat) {
        const r = Math.PI/180;
        const dLat = (dsE.lat - padCoords.lat)*r, dLon = (dsE.lon - padCoords.lon)*r;
        const a = Math.sin(dLat/2)**2 + Math.cos(padCoords.lat*r)*Math.cos(dsE.lat*r)*Math.sin(dLon/2)**2;
        const shipDistKm = 2*6371*Math.asin(Math.sqrt(a));
        if (shipDistKm > 400) arcs.push({ pts:greatCircleArc(sepPt[0],sepPt[1],dsE.lat,dsE.lon), style:{color:'#ff4444',weight:w,opacity:op*.9,dashArray:da} });
      } else {
        arcs.push({ pts:greatCircleArc(sepPt[0],sepPt[1],dsPt[0],dsPt[1]), style:{color:'#ff4444',weight:w,opacity:op*.9,dashArray:da} });
      }
    }
  } else if (lspName.includes('Blue Origin')) {
    padCoords = LAUNCH_PADS['lc36'];
    const inc  = orbitInclination(orbit, padCoords.lat, missionName);
    const az   = launchAzimuth(padCoords.lat, inc);
    const dsNG = S.vessels['368368960'];
    const dsPt = groundTrackPts(padCoords.lat, padCoords.lon, az, 1, 700)[1];
    const jacklyn = dsNG?.lat ? {lat:dsNG.lat,lon:dsNG.lon} : {lat:dsPt[0],lon:dsPt[1]};
    arcs = [
      { pts:groundTrackPts(padCoords.lat,padCoords.lon,az,6,50),           style:{color:'#44ccff',weight:w,opacity:op,dashArray:da} },
      { pts:greatCircleArc(dsPt[0],dsPt[1],jacklyn.lat,jacklyn.lon),       style:{color:'#4488ff',weight:w,opacity:op*.9,dashArray:da} },
    ];
  } else if (lspName.includes('Rocket Lab')) {
    const rlPad = /LC-2|Wallops/i.test(padName) ? LAUNCH_PADS['rl_wallops'] : LAUNCH_PADS['mahia'];
    padCoords = rlPad || LAUNCH_PADS['mahia'];
    const inc = orbitInclination(orbit, padCoords.lat, missionName);
    const az  = launchAzimuth(padCoords.lat, inc);
    arcs = [
      { pts:groundTrackPts(padCoords.lat,padCoords.lon,az,10,150), style:{color:'#ff3355',weight:w,opacity:op,dashArray:da} },
    ];
  }
  return { padCoords, arcs };
}

function drawTrajectoryArcs(launch, isHot) {
  if (!map || !missionArcLayer) return;
  missionArcLayer.clearLayers();
  if (!launch) return;
  const { padCoords, arcs } = getMissionArcs(launch, isHot);
  if (!padCoords || !arcs.length) return;
  arcs.forEach(a => addArcLines(missionArcLayer, a.pts, a.style));
  L.circleMarker([padCoords.lat, padCoords.lon], {
    radius:5, color:'#ff8800', fillColor:'#ff8800', fillOpacity:0.9, weight:2, interactive:false
  }).addTo(missionArcLayer)
    .bindTooltip(`<b>${esc(launch.name)}</b><br>${esc(launch.pad?.name||'')}`, {className:'ltt', direction:'auto'});
}

function updateTrajectoryArcs() {
  if (!map || !missionArcLayer) return;
  if (selectedMissionForArc) {
    drawTrajectoryArcs(selectedMissionForArc, false);
    return;
  }
  const now = Date.now();
  const active = [...missionsCache, ...pastMissionsCache].find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if (!net) return false;
    const el = now - net;
    return el > -3*3600000 && el < 30*60000;
  });
  if (!active) { missionArcLayer.clearLayers(); return; }
  const isHot = now - new Date(active.net).getTime() > -5*60000;
  drawTrajectoryArcs(active, isHot);
}

function showMissionArc(id) {
  const launch = _missionById[id];
  if (!launch) return;
  selectedMissionForArc = launch;
  drawTrajectoryArcs(launch, false);
  document.getElementById('missions-panel').style.display = 'none';
  const { padCoords } = getMissionArcs(launch, false);
  if (padCoords) map.setView([padCoords.lat, padCoords.lon], 4);
}

function clearMissionArc() {
  selectedMissionForArc = null;
  if (missionArcLayer) missionArcLayer.clearLayers();
}

function toggleRightPanel() {
  const right = document.getElementById('right');
  const btn   = document.getElementById('rpanel-toggle');
  const col   = right.classList.toggle('collapsed');
  btn.title = col ? 'Show panel' : 'Hide panel';
  setTimeout(() => { if(map) map.invalidateSize(); }, 160);
}

// ── Booster projection ─────────────────────────────────────────
function updateBoosterProjections() {
  if (!rocketLayer) return;
  const now = Date.now();
  // Find any launch within T-5min to T+90min
  const active = [...missionsCache, ...pastMissionsCache].find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if (!net) return false;
    const el = now - net;
    return el > -5*60000 && el < 90*60000;
  });
  const key = '__booster__';
  const shipKey = '__ship__';
  if (!active) {
    [key, shipKey].forEach(k => {
      if (spacecraftMarkers[k]) { try { rocketLayer.removeLayer(spacecraftMarkers[k]); } catch(e) {} delete spacecraftMarkers[k]; }
    });
    return;
  }
  const net = new Date(active.net).getTime();
  const elapsed = (now - net) / 1000;
  const lspName = active.launch_service_provider?.name || '';
  const padName  = (active.pad?.name || '') + ' ' + (active.pad?.location?.name || '');

  let prof = null, padCoords = null, boosterTarget = null;
  if (lspName.includes('SpaceX')) {
    if (/Starbase|Boca Chica/i.test(padName)) {
      prof = BOOSTER_PROFILES['Starship'];
      padCoords = LAUNCH_PADS['starbase'];
      boosterTarget = prof.boosterTarget;
    } else if (/Vandenberg|SLC-4/i.test(padName)) {
      prof = BOOSTER_PROFILES['Falcon 9'];
      padCoords = LAUNCH_PADS['slc4e'];
      const ds = S.vessels['368351350']; boosterTarget = ds?.lat ? {lat:ds.lat,lon:ds.lon} : {lat:32.5,lon:-122.0};
    } else {
      prof = BOOSTER_PROFILES['Falcon 9'];
      padCoords = /LC-39A/i.test(padName) ? LAUNCH_PADS['lc39a'] : LAUNCH_PADS['slc40'];
      const ds = S.vessels['368219910']; boosterTarget = ds?.lat ? {lat:ds.lat,lon:ds.lon} : {lat:30.5,lon:-76.5};
    }
  } else if (lspName.includes('Blue Origin')) {
    prof = BOOSTER_PROFILES['New Glenn'];
    padCoords = LAUNCH_PADS['lc36'];
    const ds = S.vessels['368368960']; boosterTarget = ds?.lat ? {lat:ds.lat,lon:ds.lon} : {lat:30.0,lon:-77.5};
  } else if (lspName.includes('Rocket Lab')) {
    prof = BOOSTER_PROFILES['Electron'];
    padCoords = LAUNCH_PADS['mahia'];
    boosterTarget = {lat:-39.5, lon:179.5};
  }

  if (!prof || !padCoords || !boosterTarget) return;

  // Project booster position
  if (elapsed >= 0 && elapsed <= prof.boosterSecs) {
    const frac = elapsed / prof.boosterSecs;
    const lat = padCoords.lat + (boosterTarget.lat - padCoords.lat) * frac;
    const lon = padCoords.lon + (boosterTarget.lon - padCoords.lon) * frac;
    const tStr = `T+${Math.floor(elapsed/60)}:${String(Math.round(elapsed%60)).padStart(2,'0')}`;
    const col = '#ff8800';
    const svg = `<svg width="18" height="18" viewBox="0 0 20 20">
      <polygon points="10,2 13,10 10,8 7,10" fill="${col}"/>
      <circle cx="10" cy="14" r="2.5" fill="none" stroke="${col}" stroke-width="1.2"/>
    </svg>`;
    const icon = L.divIcon({html:svg, iconSize:[18,18], iconAnchor:[9,9], className:''});
    if (!spacecraftMarkers[key]) {
      spacecraftMarkers[key] = L.marker([lat,lon], {icon, zIndexOffset:1200}).addTo(rocketLayer);
    } else { spacecraftMarkers[key].setLatLng([lat,lon]); spacecraftMarkers[key].setIcon(icon); }
    spacecraftMarkers[key].bindTooltip(
      `<b style="color:${col}">BOOSTER · ${esc(active.name||'')}</b><br>
      <span style="color:var(--t4)">Estimated · ${tStr} · ~${Math.round(frac*100)}% to landing</span>`,
      {className:'ltt', direction:'auto'});
  } else if (elapsed > prof.boosterSecs) {
    if (spacecraftMarkers[key]) { try { rocketLayer.removeLayer(spacecraftMarkers[key]); } catch(e) {} delete spacecraftMarkers[key]; }
  }

  // Project Starship Ship position
  if (prof === BOOSTER_PROFILES['Starship'] && elapsed > 0 && elapsed <= prof.shipSecs) {
    const frac = elapsed / prof.shipSecs;
    const lat = padCoords.lat + (prof.shipTarget.lat - padCoords.lat) * frac;
    const lon = padCoords.lon + (prof.shipTarget.lon - padCoords.lon) * frac;
    const tStr = `T+${Math.floor(elapsed/60)}:${String(Math.round(elapsed%60)).padStart(2,'0')}`;
    const col = '#00d4ff';
    const svg = `<svg width="18" height="18" viewBox="0 0 20 20">
      <polygon points="10,2 14,18 10,14 6,18" fill="${col}"/>
    </svg>`;
    const icon = L.divIcon({html:svg, iconSize:[18,18], iconAnchor:[9,9], className:''});
    if (!spacecraftMarkers[shipKey]) {
      spacecraftMarkers[shipKey] = L.marker([lat,lon], {icon, zIndexOffset:1200}).addTo(rocketLayer);
    } else { spacecraftMarkers[shipKey].setLatLng([lat,lon]); spacecraftMarkers[shipKey].setIcon(icon); }
    spacecraftMarkers[shipKey].bindTooltip(
      `<b style="color:${col}">STARSHIP SHIP · ${esc(active.name||'')}</b><br>
      <span style="color:var(--t4)">Estimated · ${tStr}</span>`,
      {className:'ltt', direction:'auto'});
  }
}

// ── Spacecraft detail panel ────────────────────────────────────
function showSpacecraftDetail(name) {
  S.selectedSpacecraft = name;
  const sc = S_spacecraft[name];
  if (sc?.lat && sc?.lon && map) map.setView([sc.lat, sc.lon], 3);
  S.tab = 'spacecraft';
  ['events','vessel','history','log'].forEach(id => {
    document.getElementById('rtab-'+id).classList.toggle('act', false);
  });
  document.getElementById('rtab-vessel').classList.add('act');
  renderRight();
}

function buildSpacecraftDetail() {
  const name = S.selectedSpacecraft;
  if (!name || !S_spacecraft[name]) return '<div style="padding:16px;color:var(--t4);font-size:12px">No spacecraft selected.</div>';
  const sc = S_spacecraft[name];
  const col = sc.col || '#fff';
  const alt = sc.alt ? `${Math.round(sc.alt)} km` : '—';
  const pos = sc.lat != null ? `${sc.lat.toFixed(2)}°, ${sc.lon.toFixed(2)}°` : '—';
  const info = STATION_INFO[name];

  let modulesHtml = '';
  let dockedHtml = '';

  if (info) {
    // Permanent modules section
    if (info.modules.length) {
      modulesHtml = `
        <div style="margin-top:14px">
          <div style="font-size:9px;letter-spacing:.1em;color:var(--t4);margin-bottom:6px">PERMANENT MODULES</div>
          ${info.modules.map(m => `
            <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
              <div style="width:6px;height:6px;border-radius:50%;background:${m.col};margin-top:3px;flex-shrink:0"></div>
              <div>
                <div style="font-size:12px;color:${m.col};font-weight:600">${esc(m.name)}</div>
                <div style="font-size:10px;color:var(--t3)">${esc(m.role)}</div>
                <div style="font-size:10px;color:var(--t4)">${esc(m.location)}</div>
              </div>
            </div>`).join('')}
        </div>`;
    }

    // Docked visiting vehicles from manifest
    const docked = dockedManifest[name] || [];
    if (docked.length) {
      dockedHtml = `
        <div style="margin-top:14px">
          <div style="font-size:9px;letter-spacing:.1em;color:var(--t4);margin-bottom:6px">VISITING SPACECRAFT</div>
          ${docked.map(d => {
            const hint = (info.visitingNotes || []).find(r => r.match.test(d.name)) || {};
            return `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px">
              <div style="width:6px;height:6px;border-radius:50%;background:${d.col||'#888'};margin-top:3px;flex-shrink:0"></div>
              <div>
                <div style="font-size:12px;color:${d.col||'#ccc'};font-weight:600">${esc(d.name)}</div>
                <div style="font-size:10px;color:var(--t3)">${esc(d.operator)}${hint.location ? ' · ' + hint.location : ''}</div>
                ${hint.note ? `<div style="font-size:10px;color:var(--t4);margin-top:1px">${esc(hint.note)}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>`;
    }
  }

  return `<div style="padding:14px 16px">
    <div style="font-size:18px;font-weight:700;color:${col};letter-spacing:.04em;margin-bottom:2px">${esc(info?.fullName || name)}</div>
    <div style="font-size:11px;color:var(--t4);margin-bottom:12px">${esc(info?.agency || sc.operator)} · ${esc(sc.role)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${stat('STATUS','IN ORBIT','#00ff88')}
      ${stat('ALTITUDE',alt,'var(--t2)')}
      ${stat('POSITION',pos,'var(--t2)')}
      ${stat('INCLINATION', sc.incDeg != null ? sc.incDeg.toFixed(1)+'°' : 'LEO', 'var(--t3)')}
    </div>
    ${modulesHtml}
    ${dockedHtml}
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <a href="https://heavens-above.com/orbit.aspx" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none">HEAVENS-ABOVE ↗</a>
      <a href="https://www.n2yo.com" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none">N2YO ↗</a>
    </div>
  </div>`;
}

function buildSpacecraftRow(cluster) {
  const sc = S_spacecraft[cluster.primary];
  if (!sc || sc.lat == null) return '';
  const col = sc.col || '#fff';
  // Use Space Devs authoritative docking manifest when available, fall back to TLE cluster members
  const manifestDocked = dockedManifest[cluster.primary];
  const docked = manifestDocked
    ? manifestDocked
    : cluster.members.filter(n => n !== cluster.primary).map(n => S_spacecraft[n]).filter(Boolean);
  const dockedHtml = docked.map(d => {
    if (!d) return '';
    return `<div style="display:flex;align-items:center;gap:5px;padding-left:10px;margin-top:1px">
      <div style="width:5px;height:5px;border-radius:50%;background:${d.col||'#888'};flex-shrink:0"></div>
      <span style="font-size:10px;color:${d.col||'#888'}">${esc(d.abbr||d.name||'')}</span>
      <span style="font-size:10px;color:var(--t4)">${esc(d.operator)} · docked</span>
    </div>`;
  }).join('');
  const badge = docked.length ? ` <span style="font-size:9px;font-weight:400;color:${col}77">+${docked.length}</span>` : '';
  return `<div class="vrow" data-sc="${esc(cluster.primary)}" style="border-left-color:${col};background:rgba(0,200,255,.03)">
    <div class="vn" style="color:${col};text-shadow:0 0 8px ${col}44">${esc(sc.abbr||cluster.primary)}${badge}</div>
    <div class="vop" style="color:${col}77">${esc(sc.operator)} · ${esc(sc.role)}</div>
    ${dockedHtml}
    <div class="vbottom">
      <div class="vdot" style="background:#00ff88;box-shadow:0 0 5px #00ff8888"></div>
      <span style="color:#00ff88;font-size:10px;font-weight:700">IN ORBIT</span>
      ${sc.alt ? `<span style="color:var(--t4);font-size:10px;margin-left:4px">${Math.round(sc.alt)} km${sc.incDeg != null ? ` · ${sc.incDeg.toFixed(1)}°` : ''}</span>` : ''}
    </div>
  </div>`;
}
