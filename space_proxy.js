/**
 * Space Industry Vessel Intelligence — Local Proxy
 * ══════════════════════════════════════════════════
 * Tracks a curated roster of space-industry vessels globally:
 * SpaceX, Blue Origin, Rocket Lab, ULA, and others.
 *
 * Persists position history + event log across sessions.
 * Detects zone entries/exits, underway/moored transitions, AIS gaps.
 *
 * SETUP:   npm install ws         (same as dark vessel tool)
 * RUN:     node space_proxy.js YOUR_AISSTREAM_KEY
 * SERVE:   npx serve .            (second terminal)
 * OPEN:    http://localhost:3000/space_intel.html
 *
 * MMSIs marked [UNVERIFIED] — cross-check at marinetraffic.com before relying on them.
 */

'use strict';
const WebSocket = require('ws');
const http      = require('http');
const https     = require('https');
const fs        = require('fs');
const path      = require('path');

const AIS_KEY = process.argv[2];
if (!AIS_KEY) {
  console.error('\nUsage: node space_proxy.js YOUR_AISSTREAM_KEY\n');
  process.exit(1);
}

const WS_PORT      = 8767;   // separate port from dark vessel proxy
const HTTP_PORT    = 8768;
const AIS_URL      = 'wss://stream.aisstream.io/v0/stream';
const HISTORY_FILE = path.join(__dirname, 'space_history.json');
const EVENTS_FILE  = path.join(__dirname, 'space_events.json');

// ── Known Space Industry Vessels ──────────────────────────────
// Verify unconfirmed MMSIs at: https://www.marinetraffic.com
// or https://space-offshore.com
const VESSEL_DB = {
  // ── SpaceX ──────────────────────────────────────────────────
  '368219910': {
    name: 'A Shortfall of Gravitas', abbr: 'ASOG',
    operator: 'SpaceX', role: 'Drone Ship (ASDS)',
    color: '#00d4ff', homePort: 'Port Canaveral',
    notes: 'Primary Atlantic/Gulf ASDS. Falcon 9 & Heavy recoveries.',
    verified: true,
  },
  '368219920': {
    name: 'Just Read the Instructions', abbr: 'JRTI',
    operator: 'SpaceX', role: 'Drone Ship → Starship',
    color: '#00d4ff', homePort: 'Boca Chica',
    notes: 'Transitioning to Starship support ops (2026). Was Atlantic ASDS.',
    verified: true,
  },
  '338234631': {
    name: 'Of Course I Still Love You', abbr: 'OCISLY',
    operator: 'SpaceX', role: 'Drone Ship (ASDS)',
    color: '#00d4ff', homePort: 'Vandenberg SFB',
    notes: 'Pacific ASDS for Vandenberg launches. [MMSI UNVERIFIED]',
    verified: false,
  },
  '366584000': {
    name: 'Megan', abbr: 'Megan',
    operator: 'SpaceX', role: 'Dragon Capsule Recovery',
    color: '#00d4ff', homePort: 'Port Canaveral',
    notes: 'Ex-GO Searcher, renamed 2022 for Megan McArthur. IMO 9591648.',
    verified: true,
  },
  '367550000': {
    name: 'Shannon', abbr: 'Shannon',
    operator: 'SpaceX', role: 'Dragon Capsule Recovery',
    color: '#00d4ff', homePort: 'Port Canaveral',
    notes: 'Ex-GO Navigator. IMO 9566887.',
    verified: true,
  },

  // ── Blue Origin ─────────────────────────────────────────────
  '368368960': {
    name: 'Jacklyn', abbr: 'Jacklyn',
    operator: 'Blue Origin', role: 'Drone Ship (LPV-1)',
    color: '#4477ff', homePort: 'Port Canaveral',
    notes: 'New Glenn first-stage recovery barge. IMO 9998676. First successful catch Nov 13 2025.',
    verified: true,
  },

  // ── Rocket Lab ──────────────────────────────────────────────
  // Seaworker is chartered (no fixed MMSI) — add if you charter-track it
  // Return On Investment (Neutron ASDS) in build at Bollinger; add MMSI when assigned

  // ── ULA ─────────────────────────────────────────────────────
  // R/V Retrieval MMSI unknown — add when confirmed

  // ── Add your own below ──────────────────────────────────────
  // '<MMSI>': { name: '', abbr: '', operator: '', role: '', color: '#ffffff', homePort: '', notes: '', verified: false },
};

const KNOWN_MMSIS = Object.keys(VESSEL_DB);

// ── Named Geo-fences ──────────────────────────────────────────
const ZONES = [
  // Launch sites
  { id: 'canaveral',    name: 'Cape Canaveral / KSC',    minLat: 28.3,  maxLat: 28.7,  minLon: -81.0, maxLon: -80.3 },
  { id: 'port_can',     name: 'Port Canaveral',          minLat: 28.38, maxLat: 28.45, minLon: -80.65,maxLon: -80.55},
  { id: 'boca_chica',   name: 'Starbase / Boca Chica',   minLat: 25.9,  maxLat: 26.2,  minLon: -97.4, maxLon: -97.0 },
  { id: 'vandenberg',   name: 'Vandenberg SFB',          minLat: 34.5,  maxLat: 34.9,  minLon: -120.9,maxLon: -120.4},
  { id: 'wallops',      name: 'Wallops Island',          minLat: 37.7,  maxLat: 37.95, minLon: -75.6, maxLon: -75.3 },
  { id: 'lc1_nz',       name: 'LC-1 Māhia (Rocket Lab)', minLat: -39.4, maxLat: -39.0, minLon: 177.7, maxLon: 178.2 },
  // Recovery zones
  { id: 'atl_recovery', name: 'Atlantic Recovery Zone',  minLat: 26.0,  maxLat: 31.0,  minLon: -80.5, maxLon: -72.0 },
  { id: 'pac_recovery', name: 'Pacific Recovery Zone',   minLat: 28.0,  maxLat: 35.0,  minLon: -123.0,maxLon: -114.0},
  { id: 'gulf_ops',     name: 'Gulf of Mexico Ops',      minLat: 25.0,  maxLat: 29.0,  minLon: -97.5, maxLon: -88.0 },
  // Notable ports
  { id: 'port_la',      name: 'Port of Los Angeles',     minLat: 33.65, maxLat: 33.80, minLon: -118.3,maxLon: -118.1},
];

function detectZones(lat, lon) {
  return ZONES
    .filter(z => lat >= z.minLat && lat <= z.maxLat && lon >= z.minLon && lon <= z.maxLon)
    .map(z => z.id);
}

// ── Persistence ───────────────────────────────────────────────
let history = {};   // mmsi → { positions:[{lat,lon,ts,sog,cog},...], firstSeen, lastSeen }
let events  = [];   // newest-first, capped at 2000

function loadPersisted() {
  try {
    if (fs.existsSync(HISTORY_FILE)) history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (fs.existsSync(EVENTS_FILE))  events  = JSON.parse(fs.readFileSync(EVENTS_FILE,  'utf8'));
    console.log(`[hist] Loaded: ${Object.keys(history).length} vessels, ${events.length} events`);
  } catch(e) {
    console.warn('[hist] Load failed (starting fresh):', e.message);
  }
}

function savePersisted() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
    fs.writeFileSync(EVENTS_FILE,  JSON.stringify(events.slice(0, 2000)));
  } catch(e) {
    console.error('[hist] Save failed:', e.message);
  }
}

setInterval(savePersisted, 30000);

// ── Event System ──────────────────────────────────────────────
const EVENT_COLORS = {
  VESSEL_SEEN:  '#00ff88',
  UNDERWAY:     '#00d4ff',
  MOORED:       '#ffcc00',
  ZONE_ENTER:   '#44ffcc',
  ZONE_EXIT:    '#567fa0',
  AIS_GAP:      '#ff4444',
  DEST_CHANGE:  '#ff8800',
};

function addEvent(mmsi, type, detail, lat, lon) {
  const info = VESSEL_DB[mmsi] || {};
  const ev = {
    ts:       Date.now(),
    mmsi,
    name:     info.name || mmsi,
    abbr:     info.abbr || mmsi,
    operator: info.operator || 'Unknown',
    color:    info.color || '#888',
    type,
    typeColor: EVENT_COLORS[type] || '#888',
    detail,
    lat:  lat  || null,
    lon:  lon  || null,
  };
  events.unshift(ev);
  if (events.length > 5000) events.pop();
  console.log(`[evt] [${ev.operator}] ${ev.abbr}: ${type} — ${detail}`);
  broadcast({ _event: ev });
  return ev;
}

// ── Live State ────────────────────────────────────────────────
const live     = {};         // mmsi → vessel state
const prevZones = {};        // mmsi → Set of zone ids
let aisWs       = null;
let reconnectMs = 3000;
const browsers  = new Set();
let totalMsgs   = 0;
let lastMsgTime = 0;

// ── AIS Message Handler ───────────────────────────────────────
function handleAIS(msg) {
  const m    = msg.MetaData || {};
  const pr   = msg.Message?.PositionReport;
  const sd   = msg.Message?.ShipStaticData;
  const mmsi = String(m.MMSI_String || m.MMSI || pr?.UserID || '');
  if (!mmsi || mmsi === '0') return;
  if (!VESSEL_DB[mmsi]) return;   // ignore non-roster vessels

  const now  = Date.now();
  const info = VESSEL_DB[mmsi];
  const prev = live[mmsi];
  const v    = prev ? { ...prev } : { mmsi, ...info, sog: 0, cog: 0, ts: 0, track: [] };

  if (pr) {
    const lat = pr.Latitude, lon = pr.Longitude;
    if (lat && lon && lat !== 0 && lon !== 0) {
      const wasStopped = !prev || prev.sog <= 0.5;
      v.lat = lat; v.lon = lon;
      v.sog = pr.Sog ?? 0;
      v.cog = pr.Cog ?? 0;
      v.navStatus = pr.NavigationalStatus;
      v.ts  = now;

      // Persist position (every 5 min or significant move)
      if (!history[mmsi]) {
        history[mmsi] = { positions: [], firstSeen: now, lastSeen: now };
        addEvent(mmsi, 'VESSEL_SEEN', `${info.abbr} first seen — ${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon);
      }
      history[mmsi].lastSeen = now;
      const lastPos = history[mmsi].positions.slice(-1)[0];
      if (!lastPos || now - lastPos.ts > 300000 ||
          Math.abs(lat - lastPos.lat) > 0.05 || Math.abs(lon - lastPos.lon) > 0.05) {
        history[mmsi].positions.push({ lat, lon, ts: now, sog: v.sog, cog: v.cog });
        if (history[mmsi].positions.length > 8000) history[mmsi].positions.shift();
      }

      // Motion events
      if (prev) {
        if (wasStopped  && v.sog > 0.5)  addEvent(mmsi, 'UNDERWAY', `${info.abbr} underway at ${v.sog.toFixed(1)} kn`, lat, lon);
        if (!wasStopped && v.sog <= 0.5) addEvent(mmsi, 'MOORED',   `${info.abbr} stopped / moored`, lat, lon);
      }

      // Zone events
      const nowZones  = new Set(detectZones(lat, lon));
      const lastZones = prevZones[mmsi] || new Set();
      nowZones.forEach(zid => {
        if (!lastZones.has(zid)) {
          const z = ZONES.find(z => z.id === zid);
          addEvent(mmsi, 'ZONE_ENTER', `${info.abbr} entered ${z.name}`, lat, lon);
        }
      });
      lastZones.forEach(zid => {
        if (!nowZones.has(zid)) {
          const z = ZONES.find(z => z.id === zid);
          addEvent(mmsi, 'ZONE_EXIT', `${info.abbr} left ${z.name}`, lat, lon);
        }
      });
      prevZones[mmsi] = nowZones;

      // Session track (for map polyline)
      const lastTrack = v.track.slice(-1)[0];
      if (!lastTrack || Math.abs(lat-lastTrack[0]) > 0.0002 || Math.abs(lon-lastTrack[1]) > 0.0002) {
        v.track.push([lat, lon]);
        if (v.track.length > 1000) v.track.shift();
      }
    }
  }

  if (sd) {
    const n = (sd.Name || m.ShipName || '').trim().replace(/@+$/,'');
    if (n) v.aisName = n;
    if (sd.Destination) {
      const dest = (sd.Destination || '').trim().replace(/@+$/,'');
      if (dest && dest !== v.dest) {
        if (v.dest) addEvent(mmsi, 'DEST_CHANGE', `${info.abbr} destination: ${dest}`, v.lat, v.lon);
        v.dest = dest;
      }
    }
    if (sd.EtaMonth)   v.eta     = `${sd.EtaMonth}/${String(sd.EtaDay).padStart(2,'0')} ${String(sd.EtaHour).padStart(2,'0')}:${String(sd.EtaMinute).padStart(2,'0')}Z`;
    if (sd.ImoNumber)  v.imo     = sd.ImoNumber;
    if (sd.CallSign)   v.cs      = (sd.CallSign||'').trim().replace(/@+$/,'');
    if (sd.Draught || sd.MaximumStaticDraught) v.draught = sd.MaximumStaticDraught || sd.Draught;
  }

  live[mmsi] = v;
  broadcast({ _vessel: v });
}

// ── AIS Gap detection — runs every 15 min ─────────────────────
setInterval(() => {
  const now = Date.now();
  Object.entries(live).forEach(([mmsi, v]) => {
    if (v.ts && now - v.ts > 7200000) {   // 2 h
      const hrs = Math.round((now - v.ts) / 3600000);
      addEvent(mmsi, 'AIS_GAP',
        `${v.abbr||mmsi} dark for ${hrs}h — last pos ${v.lat?.toFixed(3)}, ${v.lon?.toFixed(3)}`,
        v.lat, v.lon);
      delete live[mmsi];
    }
  });
}, 900000);

// ── WebSocket Broadcast ───────────────────────────────────────
function broadcastStr(str) {
  browsers.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(str); });
}
function broadcast(obj) { broadcastStr(JSON.stringify(obj)); }

// ── AIS Connection ────────────────────────────────────────────
function connectAIS() {
  console.log('[ais] Connecting to aisstream.io…');
  const ws        = new WebSocket(AIS_URL);
  let   msgCount  = 0;
  const startTime = Date.now();

  ws.on('open', () => {
    reconnectMs = 3000;
    // Global bounding box + MMSI filter
    ws.send(JSON.stringify({
      APIKey:             AIS_KEY,
      BoundingBoxes:      [[[-90.0, -180.0], [90.0, 180.0]]],
      MMSI:               KNOWN_MMSIS,
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    }));
    aisWs = ws;
    console.log(`[ais] ✅ Subscribed globally for ${KNOWN_MMSIS.length} vessels`);
    broadcast({ _proxy: 'connected', vesselCount: KNOWN_MMSIS.length });

    const pingTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) { clearInterval(pingTimer); return; }
      ws.ping();
    }, 20000);
  });

  ws.on('message', data => {
    msgCount++; totalMsgs++; lastMsgTime = Date.now();
    if (msgCount === 1) console.log('[ais] 📡 First message received');
    try { handleAIS(JSON.parse(data.toString('utf8'))); } catch(e) {}
  });

  ws.on('close', (code, rbuf) => {
    aisWs = null;
    const reason  = rbuf?.toString() || '';
    const durSecs = (Date.now() - startTime) / 1000;
    console.log(`[ais] Closed code:${code} msgs:${msgCount} dur:${durSecs.toFixed(1)}s`);
    broadcast({ _proxy: 'closed', code, msgCount, duration: Math.round(durSecs) });
    if (code !== 1000) {
      console.log(`[ais] Reconnecting in ${reconnectMs / 1000}s…`);
      setTimeout(connectAIS, reconnectMs);
      reconnectMs = Math.min(reconnectMs * 1.5, 30000);
    }
  });

  ws.on('error', err => {
    console.error('[ais] Error:', err.message);
    broadcast({ _proxy: 'error', message: err.message });
  });
}

// ── Browser WebSocket server ──────────────────────────────────
const wsServer = new WebSocket.Server({ port: WS_PORT });
wsServer.on('connection', browser => {
  browsers.add(browser);
  console.log(`[ws] Browser connected (${browsers.size})`);
  const status = aisWs?.readyState === WebSocket.OPEN ? 'connected' : 'connecting';
  browser.send(JSON.stringify({ _proxy: status, vesselCount: KNOWN_MMSIS.length }));
  // Send current live state to new browser
  Object.values(live).forEach(v => browser.send(JSON.stringify({ _vessel: v })));
  // Send recent events (last 100)
  browser.send(JSON.stringify({ _eventBatch: events.slice(0, 100) }));
  browser.on('close', () => {
    browsers.delete(browser);
    console.log(`[ws] Browser gone (${browsers.size})`);
  });
});

// ── HTTP API ──────────────────────────────────────────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SpaceVesselIntel/1.0)', 'Accept': '*/*' },
      timeout: 10000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject); return;
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseRSS(xml, vesselName) {
  const items = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRx.exec(xml)) !== null) {
    const block = m[1];
    const get = tag => {
      const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`);
      const x = r.exec(block);
      return x ? (x[1]||x[2]||'').trim() : '';
    };
    const title = get('title');
    const link  = get('link') || (/<link[^>]*>([^<]+)<\/link>/.exec(block)||[])[1]?.trim() || '';
    const desc  = get('description').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    const date  = get('pubDate');
    if (title) items.push({ title, link, desc, date, vessel: vesselName });
  }
  return items;
}

const httpServer = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  let body = '';
  await new Promise(r => { req.on('data', d => body += d); req.on('end', r); });
  const json = body ? (() => { try { return JSON.parse(body); } catch(e) { return {}; } })() : {};

  if (req.url === '/status') {
    send(200, { aisConnected: aisWs?.readyState === WebSocket.OPEN, browsers: browsers.size, totalMsgs, liveVessels: Object.keys(live).length });
    return;
  }

  if (req.url === '/vessels') {
    const roster = Object.entries(VESSEL_DB).map(([mmsi, info]) => ({
      mmsi, ...info,
      live: !!live[mmsi],
      ...(live[mmsi] ? { lat: live[mmsi].lat, lon: live[mmsi].lon, sog: live[mmsi].sog, ts: live[mmsi].ts } : {}),
      lastSeen: history[mmsi]?.lastSeen || null,
      firstSeen: history[mmsi]?.firstSeen || null,
    }));
    send(200, { vessels: roster });
    return;
  }

  if (req.url.startsWith('/history/')) {
    const mmsi = req.url.replace('/history/', '');
    if (!VESSEL_DB[mmsi]) { send(404, { error: 'Unknown vessel' }); return; }
    send(200, { mmsi, info: VESSEL_DB[mmsi], history: history[mmsi] || null });
    return;
  }

  if (req.url === '/events') {
    const limit = Math.min(parseInt(json.limit || 200, 10), 2000);
    const operator = json.operator || null;
    const type     = json.type     || null;
    let   filtered = events;
    if (operator) filtered = filtered.filter(e => e.operator === operator);
    if (type)     filtered = filtered.filter(e => e.type === type);
    send(200, { events: filtered.slice(0, limit) });
    return;
  }

  // /vapi?mmsi=123456789&sat=true — proxies VesselAPI to avoid browser CORS block
  if (req.url.startsWith('/vapi') && req.method === 'GET') {
    const u = new URL(req.url, 'http://localhost');
    const mmsi = u.searchParams.get('mmsi');
    const sat  = u.searchParams.get('sat') === 'true';
    const key  = u.searchParams.get('key') || req.headers['x-vapi-key'];
    if (!mmsi || !key) { send(400, { error: 'mmsi and key required' }); return; }
    const apiUrl = `https://api.vesselapi.com/v1/vessel/${mmsi}/position?filter.idType=mmsi${sat?'&filter.sat=true':''}`;
    try {
      const raw = await new Promise((resolve, reject) => {
        const req2 = https.get(apiUrl, {
          headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
          timeout: 10000,
        }, res2 => {
          let b = '';
          res2.on('data', d => b += d);
          res2.on('end', () => resolve({ status: res2.statusCode, body: b }));
        });
        req2.on('error', reject);
        req2.on('timeout', () => { req2.destroy(); reject(new Error('timeout')); });
      });
      res.writeHead(raw.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(raw.body);
    } catch(e) {
      send(502, { error: e.message });
    }
    return;
  }

  if (req.url === '/news' && req.method === 'POST') {
    const vessels = json.vessels || [];
    if (!vessels.length) { send(400, { error: 'vessels array required' }); return; }
    console.log(`[news] Searching RSS for ${vessels.length} vessels`);
    const allArticles = [];
    for (const v of vessels.slice(0, 10)) {
      const q   = encodeURIComponent(`"${v.name}" rocket ship`);
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
      try {
        const xml   = await fetchUrl(url);
        const items = parseRSS(xml, v.name).slice(0, 3);
        items.forEach(item => allArticles.push({ ...item, mmsi: v.mmsi }));
      } catch(e) {
        console.warn(`[news] RSS failed for ${v.name}:`, e.message);
      }
    }
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    send(200, { articles: allArticles.slice(0, 30) });
    return;
  }

  send(404, { error: 'not found' });
});

// ── Boot ──────────────────────────────────────────────────────
loadPersisted();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  SPACE INDUSTRY VESSEL INTELLIGENCE PROXY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Tracking:  ${KNOWN_MMSIS.length} vessels`);
KNOWN_MMSIS.forEach(m => {
  const v = VESSEL_DB[m];
  console.log(`    ${v.verified ? '✓' : '?'} ${m}  ${v.abbr.padEnd(28)} ${v.operator}`);
});
console.log(`  AIS key:   ${AIS_KEY.slice(0,6)}…${AIS_KEY.slice(-4)}`);
console.log(`  WS:        ws://localhost:${WS_PORT}`);
console.log(`  HTTP API:  http://localhost:${HTTP_PORT}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

httpServer.listen(HTTP_PORT, () => console.log(`[http] Ready on :${HTTP_PORT}`));
wsServer.on('listening', () => console.log(`[ws]   Ready on :${WS_PORT}`));
connectAIS();

process.on('SIGINT', () => {
  console.log('\n[proxy] Saving and shutting down…');
  savePersisted();
  if (aisWs) aisWs.close(1000);
  wsServer.close(); httpServer.close();
  process.exit(0);
});
