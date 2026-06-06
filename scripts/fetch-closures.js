'use strict';
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SpaceFleetTracker/1.0)' },
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

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const outPath = path.join(__dirname, '..', 'data', 'closures.json');

  console.log('Fetching Cameron County closures…');
  let closureData = { closures: [], delays: [], status: 'unknown' };
  try {
    const html = await fetchUrl('https://www.cameroncountytx.gov/spacex/');
    closureData = parseCameronCounty(html);
    console.log(`  Status: ${closureData.status}, entries: ${closureData.closures.length}`);
  } catch(e) {
    console.warn('  Cameron County fetch failed:', e.message);
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
