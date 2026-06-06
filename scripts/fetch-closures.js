'use strict';
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

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
  const outPath = path.join(__dirname, '..', 'data', 'closures.json');

  // Smart skip: only re-fetch external sites when needed
  // - launch within 48h  → always re-fetch (every 2h action run)
  // - no launch near     → skip if data < 20h old
  const hoursUntilLaunch = await hoursToNextLaunch();
  console.log(`Next launch in: ${hoursUntilLaunch === 9999 ? 'unknown' : hoursUntilLaunch.toFixed(1) + 'h'}`);

  if (hoursUntilLaunch > 48 && fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      const ageH = prev.fetchedAt ? (Date.now() - new Date(prev.fetchedAt).getTime()) / 3600000 : 999;
      if (ageH < 20) {
        // Update fetchedAt so the staleness check in the frontend stays quiet
        prev.fetchedAt = new Date().toISOString();
        fs.writeFileSync(outPath, JSON.stringify(prev, null, 2));
        console.log(`No launch within 48h and data is ${ageH.toFixed(1)}h old — skipping external fetch`);
        return;
      }
    } catch(_) {}
  }

  console.log('Fetching Cameron County closures…');
  let closureData = { closures: [], delays: [], status: 'unknown' };
  try {
    // Try RSS feed first — avoids Cloudflare DDoS page protection on the main site
    const rss = await fetchUrl('https://www.cameroncountytx.gov/spacex/feed/');
    if (rss.includes('<rss') || rss.includes('<feed')) {
      closureData = parseCameronCountyRSS(rss);
      console.log(`  RSS: status=${closureData.status}, entries=${closureData.closures.length}`);
    } else {
      throw new Error('RSS not available');
    }
  } catch(_) {
    try {
      const html = await fetchUrl('https://www.cameroncountytx.gov/spacex/');
      if (html.includes('DDOS') || html.includes('Block ID')) throw new Error('Cloudflare block');
      closureData = parseCameronCounty(html);
      console.log(`  HTML: status=${closureData.status}, entries=${closureData.closures.length}`);
    } catch(e) {
      console.warn('  Cameron County fetch failed:', e.message);
    }
  }

  console.log('Fetching FAA TFRs…');
  const tfrs = await fetchTFRs();
  console.log(`  ${tfrs.length} TFRs parsed`);

  const result = {
    closures:  closureData.closures,
    delays:    closureData.delays,
    status:    closureData.status,
    tfrs,
    fetchedAt: new Date().toISOString(),
  };

  // Only write if substantive content changed (ignore fetchedAt)
  let changed = true;
  if (fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      const strip = o => { const c = {...o}; delete c.fetchedAt; return JSON.stringify(c); };
      changed = strip(prev) !== strip(result);
    } catch(_) {}
  }

  if (changed) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log('Written:', outPath);
  } else {
    // Always update fetchedAt so the age check in the frontend stays fresh
    const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    prev.fetchedAt = result.fetchedAt;
    fs.writeFileSync(outPath, JSON.stringify(prev, null, 2));
    console.log('No content change — updated fetchedAt only');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
