'use strict';
const https = require('https');
const http  = require('http');
const { ensureSchema, upsertCache, readCache } = require('./db');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000,
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

// ── Cameron County parser ─────────────────────────────────────
function parseCameronCounty(html) {
  const closures = [];
  const delays   = [];
  const tableRx  = /<table[\s\S]*?<\/table>/gi;
  const tables   = [];
  let tm;
  while ((tm = tableRx.exec(html)) !== null) tables.push(tm[0]);

  for (const tbl of tables) {
    const rows = [];
    const rowRx = /<tr[\s\S]*?<\/tr>/gi;
    let rm;
    while ((rm = rowRx.exec(tbl)) !== null) {
      const cells = [];
      const cellRx = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cm;
      while ((cm = cellRx.exec(rm[0])) !== null)
        cells.push(cm[1].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim());
      if (cells.length >= 2) rows.push(cells);
    }
    if (rows.length < 2) continue;
    const hdr    = rows[0].map(c => c.toLowerCase());
    const isDelay = hdr.some(h => h.includes('delay'));
    const target  = isDelay ? delays : closures;
    for (let i = 1; i < rows.length; i++) {
      const [type, date, time, status] = rows[i];
      if (!date) continue;
      target.push({ type: type||'', date: date||'', time: time||'', status: status||'' });
    }
  }

  let status = 'open';
  for (const c of closures) {
    const s = (c.status||'').toLowerCase();
    if (s.includes('closed') || s.includes('closure')) { status = 'closed'; break; }
    if (s.includes('scheduled') || s.includes('possible')) status = 'scheduled';
  }
  return { closures, delays, status };
}

// ── Cameron County RSS parser ─────────────────────────────────
function parseCameronCountyRSS(xml) {
  const closures = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRx.exec(xml)) !== null) {
    const block = m[1];
    const getTag = tag => {
      const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`);
      const x = r.exec(block);
      return x ? (x[1]||x[2]||'').trim() : '';
    };
    const title  = getTag('title');
    const date   = getTag('pubDate');
    if (!title) continue;
    // Parse date/time from title, e.g. "Order Closing … July 31, 2025, from 7 a.m. to 7 p.m."
    const dateMatch = title.match(/([A-Z][a-z]+ \d{1,2},\s*\d{4})/);
    const timeMatch = title.match(/from\s+([\d:apm. ]+)\s+to\s+([\d:apm. ]+)/i);
    const isClosed  = /close|closure|closed/i.test(title);
    closures.push({
      type:   'Primary Day',
      date:   dateMatch ? dateMatch[1] : date,
      time:   timeMatch ? `${timeMatch[1]} to ${timeMatch[2]}` : '',
      status: isClosed ? 'Closure Scheduled' : title.slice(0, 60),
    });
  }
  const status = closures.some(c => /closed/i.test(c.status)) ? 'closed'
               : closures.length ? 'scheduled' : 'open';
  return { closures, delays: [], status };
}

// ── FAA TFR parser ────────────────────────────────────────────
function extractTFRIds(html) {
  const ids = new Set();
  const rx = /detail_(\d+_\d+)/g;
  let m;
  while ((m = rx.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

function parseTFRXml(xml, id) {
  const getFirst = tag => { const m = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`,'i').exec(xml); return m ? m[1].trim() : ''; };
  const facility = getFirst('facilityDesignator') || getFirst('Facility') || '';
  const purpose  = getFirst('purposeDescription') || getFirst('specialUse') || '';
  const notamNum = getFirst('notamNumber') || id.replace('_','/');
  const isSpaceX = /spacex|starship|falcon|dragon|rocket lab/i.test(xml);

  const circles = [];
  const circRx  = /<Circle[\s\S]*?<\/Circle>/gi;
  let cm;
  while ((cm = circRx.exec(xml)) !== null) {
    const lat = parseFloat((/<Latitude>([^<]+)/.exec(cm[0])||[])[1] || 0);
    const lon = parseFloat((/<Longitude>([^<]+)/.exec(cm[0])||[])[1] || 0);
    const nmi = parseFloat((/<Radius[^>]*>([^<]+)/.exec(cm[0])||[])[1] || 0);
    if (lat && lon) circles.push({ lat, lon, radiusNm: nmi });
  }
  return { id, notamNum, facility, purpose, isSpaceX, circles };
}

async function fetchTFRs() {
  try {
    const listHtml = await fetchUrl('https://tfr.faa.gov/tfr2/list.html');
    const ids = extractTFRIds(listHtml);
    console.log(`  TFR list: ${ids.length} IDs found`);
    if (!ids.length) return [];

    const tfrs = [];
    for (const id of ids.slice(0, 40)) {
      try {
        const xml = await fetchUrl(`https://tfr.faa.gov/save_pages/detail_${id}.xml`);
        tfrs.push(parseTFRXml(xml, id));
        await new Promise(r => setTimeout(r, 300)); // gentle rate limiting
      } catch(_) {}
    }
    return tfrs;
  } catch(e) {
    console.warn('  TFR fetch failed:', e.message);
    return [];
  }
}

// ── NGA MSI maritime nav-warnings (HYDROPAC/HYDROLANT) ────────
// Free, no API key. WAF passes with the browser-like headers in fetchUrl().
function dmsToDec(deg, min, sec, hemi) {
  let v = Math.abs(parseFloat(deg)) + (parseFloat(min) || 0) / 60 + (parseFloat(sec) || 0) / 3600;
  if (hemi === 'S' || hemi === 'W') v = -v;
  return v;
}

// Parse "DD-MM.mm[N/S] DDD-MM.mm[E/W]" (optionally with seconds) coordinate pairs → [lon,lat] points
function parseCoordsFromText(text) {
  const rx = /(\d{1,3})-(\d{1,2}(?:\.\d+)?)(?:-(\d{1,2}(?:\.\d+)?))?\s*([NS])[ ,]+(\d{1,3})-(\d{1,2}(?:\.\d+)?)(?:-(\d{1,2}(?:\.\d+)?))?\s*([EW])/g;
  const pts = [];
  let m;
  while ((m = rx.exec(text)) !== null) {
    const lat = dmsToDec(m[1], m[2], m[3], m[4]);
    const lon = dmsToDec(m[5], m[6], m[7], m[8]);
    pts.push([lon, lat]);
  }
  return pts;
}

const LAUNCH_RX = /rocket|launch|space vehicle|spacex|starship|missile|space debris|reentr|splashdown|hazardous operations/i;

async function fetchNavWarnings() {
  const out = [];
  for (const navArea of ['P', 'A']) { // P=HYDROPAC (Pacific/Indian), A=HYDROLANT (Atlantic)
    try {
      const json = await fetchUrl(`https://msi.nga.mil/api/publications/broadcast-warn?status=active&output=json&navArea=${navArea}`);
      const data = JSON.parse(json);
      for (const w of (data['broadcast-warn'] || [])) {
        const text = w.text || '';
        if (!LAUNCH_RX.test(text)) continue;
        const pts = parseCoordsFromText(text);
        if (pts.length < 3) continue;
        const first = pts[0], last = pts[pts.length - 1];
        const ring = (first[0] === last[0] && first[1] === last[1]) ? pts : [...pts, first];
        out.push({
          id:        `${w.navArea}-${w.msgNumber}/${String(w.msgYear).slice(-2)}`,
          navArea:   w.navArea,
          subregion: w.subregion || '',
          issueDate: w.issueDate || null,
          cancelDate: w.cancelDate || null,
          subject:   (text.split('\n').map(s => s.trim()).filter(Boolean)[0] || '').slice(0, 90),
          areas:     [ring],
        });
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) { console.warn(`  NavWarn ${navArea} failed:`, e.message); }
  }
  return out;
}

// ── Launch proximity check ────────────────────────────────────
async function hoursToNextLaunch() {
  try {
    const json = await fetchUrl('https://api.spacexdata.com/v5/launches/upcoming');
    const launches = JSON.parse(json);
    const now = Date.now();
    let nearest = Infinity;
    for (const l of launches) {
      if (!l.date_utc) continue;
      const diff = (new Date(l.date_utc).getTime() - now) / 3600000;
      if (diff > 0) nearest = Math.min(nearest, diff);
    }
    return nearest === Infinity ? 9999 : nearest;
  } catch(e) {
    console.warn('  Launch check failed:', e.message);
    return 9999; // assume no launch imminent on error
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('=== fetch-closures ===');
  await ensureSchema();

  // NGA maritime nav-warnings run unconditionally — they publish ~2 weeks
  // ahead of a launch, so they must not be gated by the 48h closures skip below.
  console.log('Fetching NGA maritime nav-warnings…');
  const navwarnings = await fetchNavWarnings();
  console.log(`  ${navwarnings.length} launch-related nav-warnings with geometry`);
  await upsertCache('hazards.navwarnings', { warnings: navwarnings }, {
    source:    'msi.nga.mil',
    fetchedAt: new Date().toISOString(),
  });

  // Smart skip: only re-fetch Cameron County when needed
  // - launch within 48h  → always re-fetch
  // - no launch near     → skip if DB data < 20h old
  const hoursUntilLaunch = await hoursToNextLaunch();
  console.log(`Next launch in: ${hoursUntilLaunch === 9999 ? 'unknown' : hoursUntilLaunch.toFixed(1) + 'h'}`);

  if (hoursUntilLaunch > 48) {
    const cur = await readCache('closures.bocachica');
    if (cur?.fetched_at) {
      const ageH = (Date.now() - new Date(cur.fetched_at).getTime()) / 3600000;
      if (ageH < 20) {
        const r = await fetch(
          (process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/rest/v1/app_cache?key=eq.closures.bocachica',
          { method: 'PATCH',
            headers: { 'apikey': process.env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ fetched_at: new Date().toISOString() }) }
        );
        if (!r.ok) throw new Error(`PATCH HTTP ${r.status}`);
        console.log(`No launch within 48h, data ${ageH.toFixed(1)}h old — skipped fetch, refreshed fetched_at`);
        return;
      }
    }
  }

  console.log('Fetching Cameron County closures…');
  let closureData = { closures: [], delays: [], status: 'unknown' };
  try {
    const rss = await fetchUrl('https://www.cameroncountytx.gov/spacex/feed/');
    if (rss.includes('<rss') || rss.includes('<feed')) {
      closureData = parseCameronCountyRSS(rss);
      console.log(`  RSS: status=${closureData.status}, entries=${closureData.closures.length}`);
    } else throw new Error('RSS not available');
  } catch(_) {
    try {
      const html = await fetchUrl('https://www.cameroncountytx.gov/spacex/');
      if (html.includes('DDOS') || html.includes('Block ID')) throw new Error('Cloudflare block');
      closureData = parseCameronCounty(html);
      console.log(`  HTML: status=${closureData.status}, entries=${closureData.closures.length}`);
    } catch(e) { console.warn('  Cameron County fetch failed:', e.message); }
  }

  console.log('Fetching FAA TFRs…');
  const tfrs = await fetchTFRs();
  console.log(`  ${tfrs.length} TFRs parsed`);

  const payload = {
    closures: closureData.closures,
    delays:   closureData.delays,
    status:   closureData.status,
    tfrs,
  };

  await upsertCache('closures.bocachica', payload, {
    source:    'cameroncountytx.gov',
    fetchedAt: new Date().toISOString(),
  });
}

main().catch(e => { console.error(e.message); process.exit(1); });
