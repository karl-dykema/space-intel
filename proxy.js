/**
 * AIS Dark Transit Intelligence — Local Proxy
 * ════════════════════════════════════════════
 * • Bridges aisstream.io → browser
 * • Subscribes to ALL 6 regions simultaneously
 * • HTTP API on :8766 for Google News RSS vessel search (free, no API key)
 * • Aggressive keepalive + diagnostics for 1006 disconnects
 *
 * SETUP:   npm install ws
 * RUN:     node proxy.js YOUR_AISSTREAM_KEY
 * SERVE:   npx serve .   (second terminal)
 * OPEN:    http://localhost:3000
 */

'use strict';
const WebSocket = require('ws');
const http      = require('http');
const https     = require('https');

const AIS_KEY = process.argv[2];
if (!AIS_KEY) {
  console.error('\nUsage: node proxy.js YOUR_AISSTREAM_KEY');
  console.error('  Get key: https://aisstream.io/authenticate\n');
  process.exit(1);
}

const WS_PORT   = 8765;
const HTTP_PORT = 8766;
const AIS_URL   = 'wss://stream.aisstream.io/v0/stream';

const ALL_BBOX = [
  [[22.0, 54.0],[28.5, 61.0]],   // Hormuz
  [[ 0.5, 99.0],[ 7.0,105.5]],   // Malacca
  [[54.5,  9.0],[60.5, 22.0]],   // Baltic
  [[26.0, 31.5],[32.0, 37.0]],   // Suez
  [[40.0, 27.5],[44.5, 35.0]],   // Bosphorus
  [[41.5,-85.0],[47.5,-82.0]],   // Great Lakes
];

let   aisWs       = null;
let   reconnectMs = 3000;
const browsers    = new Set();
let   totalMsgs   = 0;
let   lastMsgTime = 0;

let _closuresCache = null;
let _closuresCachedAt = 0;
let _tfrCache = null;
let _tfrCachedAt = 0;

// ── 1006 Diagnostics ─────────────────────────────────────────
function diagnose1006(msgCount, durSecs) {
  console.log('\n[diag] ══ 1006 DISCONNECT ANALYSIS ══════════');
  console.log(`[diag]  Duration:          ${durSecs.toFixed(1)}s`);
  console.log(`[diag]  Messages received: ${msgCount}`);
  const idleS = lastMsgTime ? ((Date.now() - lastMsgTime) / 1000).toFixed(0) : 'n/a';
  console.log(`[diag]  Idle since msg:    ${idleS}s`);
  if      (msgCount === 0)     console.log('[diag]  ⛔ Likely cause: API key invalid/revoked. Regenerate at aisstream.io');
  else if (durSecs < 5)        console.log('[diag]  ⚠  Fast drop: possible rate-limit or bad subscription');
  else if (Number(idleS) > 50) console.log('[diag]  ⚠  Idle timeout: low AIS traffic. Ping keepalive is active.');
  else                         console.log('[diag]  ℹ  Server-side TCP reset (normal on free tier). Auto-reconnecting.');
  console.log('[diag] ════════════════════════════════════════\n');
}

// ── AIS Connection ────────────────────────────────────────────
function connectAIS() {
  console.log('[ais] Connecting…');
  const ws        = new WebSocket(AIS_URL);
  let   msgCount  = 0;
  const startTime = Date.now();

  ws.on('open', () => {
    reconnectMs = 3000;
    ws.send(JSON.stringify({
      APIKey:             AIS_KEY,
      BoundingBoxes:      ALL_BBOX,
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    }));
    aisWs = ws;
    console.log(`[ais] ✅ Subscribed to ${ALL_BBOX.length} regions`);
    broadcast({ _proxy: 'connected' });

    // Ping every 20s to prevent idle 1006 disconnects
    const pingTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) { clearInterval(pingTimer); return; }
      ws.ping();
    }, 20000);

    // Idle warning
    const idleTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) { clearInterval(idleTimer); return; }
      if (lastMsgTime && Date.now() - lastMsgTime > 60000) {
        const s = Math.round((Date.now() - lastMsgTime) / 1000);
        console.log(`[ais] ⚠ No messages for ${s}s`);
        broadcast({ _proxy: 'warning', message: `No AIS data for ${s}s` });
      }
    }, 30000);

    // Rate log
    let prev = 0;
    const rateTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) { clearInterval(rateTimer); return; }
      const d = msgCount - prev; prev = msgCount;
      console.log(`[ais] ${d}/10s · total:${msgCount} · browsers:${browsers.size}`);
    }, 10000);
  });

  ws.on('message', data => {
    msgCount++; totalMsgs++; lastMsgTime = Date.now();
    if (msgCount === 1) console.log('[ais] 📡 First message — stream live');
    broadcastStr(data.toString('utf8'));
  });

  ws.on('close', (code, rbuf) => {
    aisWs = null;
    const reason  = rbuf?.toString() || '';
    const durSecs = (Date.now() - startTime) / 1000;
    console.log(`[ais] Closed code:${code} msgs:${msgCount} dur:${durSecs.toFixed(1)}s${reason ? ' '+reason : ''}`);
    broadcast({ _proxy: 'closed', code, reason, msgCount, duration: Math.round(durSecs) });
    if (code === 1006) diagnose1006(msgCount, durSecs);
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

function broadcastStr(str) {
  browsers.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(str); });
}
function broadcast(obj) { broadcastStr(JSON.stringify(obj)); }

// ── WebSocket server ──────────────────────────────────────────
const wsServer = new WebSocket.Server({ port: WS_PORT });
wsServer.on('connection', browser => {
  browsers.add(browser);
  console.log(`[ws] Browser connected (${browsers.size})`);
  const status = aisWs?.readyState === WebSocket.OPEN ? 'connected' : 'connecting';
  browser.send(JSON.stringify({ _proxy: status }));
  browser.on('message', () => {});
  browser.on('close', () => {
    browsers.delete(browser);
    console.log(`[ws] Browser gone (${browsers.size})`);
  });
});

// ── HTTP API: Google News RSS fetch ───────────────────────────
// Fetches news server-side to avoid browser CORS restrictions on RSS feeds
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIS-Intelligence/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 10000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
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
  // Simple RSS item parser — no external deps
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

// ── Cameron County closure scraper ───────────────────────────
function parseCameronCountyClosures(html) {
  const closures = [];
  const delays   = [];
  // Extract all <table> blocks
  const tableRx = /<table[\s\S]*?<\/table>/gi;
  const tables = [];
  let tm;
  while ((tm = tableRx.exec(html)) !== null) tables.push(tm[0]);

  for (let ti = 0; ti < tables.length; ti++) {
    const tbl  = tables[ti];
    const rows = [];
    const rowRx = /<tr[\s\S]*?<\/tr>/gi;
    let rm;
    while ((rm = rowRx.exec(tbl)) !== null) {
      const cells = [];
      const cellRx = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cm;
      while ((cm = cellRx.exec(rm[0])) !== null)
        cells.push(cm[1].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#8203;/g,'').replace(/\s+/g,' ').trim());
      if (cells.length >= 2) rows.push(cells);
    }
    if (rows.length < 2) continue;
    const hdr = rows[0].map(c => c.toLowerCase());
    const isDelay = hdr.some(h => h.includes('delay'));
    const target  = isDelay ? delays : closures;
    for (let i = 1; i < rows.length; i++) {
      const [type, date, time, status] = rows[i];
      if (!date) continue;
      target.push({ type: type||'', date: date||'', time: time||'', status: status||'' });
    }
  }

  // Determine current status
  const now = new Date();
  let activeStatus = 'open';
  for (const c of closures) {
    const s = (c.status||'').toLowerCase();
    if (s.includes('closed') || s.includes('closure')) { activeStatus = 'closed'; break; }
    if (s.includes('scheduled') || s.includes('possible')) { activeStatus = 'scheduled'; }
  }

  return { closures, delays, status: activeStatus, fetchedAt: new Date().toISOString() };
}

// ── FAA TFR scraper ───────────────────────────────────────────
function extractTFRIds(html) {
  const ids = new Set();
  const rx = /detail_(\d+_\d+)/g;
  let m;
  while ((m = rx.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

function parseTFRXml(xml, id) {
  const get = tag => { const m = new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`).exec(xml); return m ? m[1].trim() : ''; };
  const facility = get('Facility') || get('facilityDesignator') || '';
  const state    = get('State') || '';
  const type     = get('type') || get('tfrType') || '';
  const notamNum = get('notamNumber') || id.replace('_','/');
  const purpose  = get('purposeDescription') || get('specialUse') || '';
  const rawTxt   = (xml.match(/\bSPACEX\b|\bSTARSHIP\b|\bFALCON\b|\bDRAGON\b/i) || []).length > 0;

  // Extract circle geometry (most SpaceX TFRs are circles)
  const circles = [];
  const circRx  = /<Circle[\s\S]*?<\/Circle>/g;
  let   cm;
  while ((cm = circRx.exec(xml)) !== null) {
    const lat  = parseFloat(get.call(null, 'Latitude') || (/<Latitude>([^<]+)/.exec(cm[0])||[])[1] || 0);
    const lon  = parseFloat((/<Longitude>([^<]+)/.exec(cm[0])||[])[1] || 0);
    const nmi  = parseFloat((/<Radius[^>]*>([^<]+)/.exec(cm[0])||[])[1] || 0);
    if (lat && lon) circles.push({ lat, lon, radiusNm: nmi });
  }

  return { id, notamNum, facility, state, type, purpose, isSpaceX: rawTxt, circles };
}

async function fetchActiveTFRs() {
  try {
    const listHtml = await fetchUrl('https://tfr.faa.gov/tfr2/list.html');
    const ids = extractTFRIds(listHtml);
    if (!ids.length) return { tfrs: [], fetchedAt: new Date().toISOString(), note: 'no TFR IDs found in list' };

    const results = [];
    for (const id of ids.slice(0, 30)) {
      try {
        const xml = await fetchUrl(`https://tfr.faa.gov/save_pages/detail_${id}.xml`);
        const tfr = parseTFRXml(xml, id);
        results.push(tfr);
      } catch(_) {}
    }
    return { tfrs: results, fetchedAt: new Date().toISOString() };
  } catch(e) {
    return { tfrs: [], fetchedAt: new Date().toISOString(), error: e.message };
  }
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
    send(200, { aisConnected: aisWs?.readyState === WebSocket.OPEN, browsers: browsers.size, totalMsgs });
    return;
  }

  // /closures — Cameron County Boca Chica road/beach closure schedule (cached 10 min)
  if (req.url === '/closures') {
    const now = Date.now();
    if (_closuresCache && now - _closuresCachedAt < 10 * 60000) { send(200, _closuresCache); return; }
    try {
      const html = await fetchUrl('https://www.cameroncountytx.gov/spacex/');
      _closuresCache = parseCameronCountyClosures(html);
      _closuresCachedAt = now;
      console.log(`[closures] Fetched: status=${_closuresCache.status}, entries=${_closuresCache.closures.length}`);
      send(200, _closuresCache);
    } catch(e) {
      console.warn('[closures] Fetch failed:', e.message);
      send(500, { error: e.message });
    }
    return;
  }

  // /tfr — FAA active TFRs (cached 15 min)
  if (req.url === '/tfr') {
    const now = Date.now();
    if (_tfrCache && now - _tfrCachedAt < 15 * 60000) { send(200, _tfrCache); return; }
    try {
      _tfrCache = await fetchActiveTFRs();
      _tfrCachedAt = now;
      console.log(`[tfr] Fetched: ${_tfrCache.tfrs?.length ?? 0} TFRs`);
      send(200, _tfrCache);
    } catch(e) {
      console.warn('[tfr] Fetch failed:', e.message);
      send(500, { error: e.message });
    }
    return;
  }

  // /news — fetch Google News RSS for each vessel name
  if (req.url === '/news' && req.method === 'POST') {
    const vessels = json.vessels || []; // [{name, mmsi}]
    if (!vessels.length) { send(400, { error: 'vessels array required' }); return; }

    console.log(`[news] Fetching RSS for ${vessels.length} vessels`);
    const allArticles = [];

    for (const v of vessels.slice(0, 15)) { // cap at 15 to avoid hammering
      const q   = encodeURIComponent(`"${v.name}" ship`);
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
      try {
        const xml   = await fetchUrl(url);
        const items = parseRSS(xml, v.name).slice(0, 3); // top 3 per vessel
        items.forEach(item => allArticles.push({ ...item, mmsi: v.mmsi }));
      } catch(e) {
        console.warn(`[news] RSS fetch failed for ${v.name}:`, e.message);
      }
    }

    // Sort by date descending
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    send(200, { articles: allArticles.slice(0, 30) }); // cap total at 30
    return;
  }

  send(404, { error: 'not found' });
});

// ── Boot ──────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  AIS DARK TRANSIT INTELLIGENCE PROXY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  AIS key:  ${AIS_KEY.slice(0,6)}…${AIS_KEY.slice(-4)}`);
console.log(`  WS:       ws://localhost:${WS_PORT}`);
console.log(`  HTTP API: http://localhost:${HTTP_PORT}  (news RSS)`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

httpServer.listen(HTTP_PORT, () => console.log(`[http] Ready on :${HTTP_PORT}`));
connectAIS();

process.on('SIGINT', () => {
  console.log('\n[proxy] Shutting down…');
  if (aisWs) aisWs.close(1000);
  wsServer.close(); httpServer.close();
  process.exit(0);
});
