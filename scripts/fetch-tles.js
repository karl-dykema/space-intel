'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// NORAD IDs for spacecraft matching our SPACECRAFT_PATTERNS
const BY_ID = [25544, 48274]; // ISS (ZARYA), CSS (TIANHE)
// Docked/station craft that can have multiple active simultaneously
const SEARCHES_MULTI = ['SOYUZ-MS', 'PROGRESS-MS', 'SHENZHOU', 'TIANZHOU'];
// CSS modules (permanent): page-size=1
const SEARCHES_CSS   = ['WENTIAN', 'MENGTIAN'];
// Mission-specific craft: page-size=1 to avoid stale old missions flooding the map
const SEARCHES_ONE   = ['CREW DRAGON', 'DRAGON CRS', 'CYGNUS NG'];

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000 }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function tryCelestrak() {
  const urls = [
    'https://celestrak.org/NORAD/elements/gp.php?GROUP=STATIONS&FORMAT=TLE',
    'https://celestrak.org/NORAD/elements/stations.txt',
  ];
  for (const url of urls) {
    try {
      const { status, body } = await get(url);
      if (status === 200 && body.trim().startsWith('ISS')) {
        console.log(`✓ Celestrak: ${body.split('\n').filter(Boolean).length / 3 | 0} objects from ${url.split('/').pop().split('?')[0]}`);
        return body;
      }
      console.log(`— Celestrak HTTP ${status}: ${url.split('/').pop().split('?')[0]}`);
    } catch(e) { console.log(`— Celestrak error: ${e.message}`); }
  }
  return null;
}

async function tryIvanAPI() {
  const BASE = 'https://tle.ivanstanojevic.me/api/tle';
  const entries = [];

  const fetchAll = [
    ...BY_ID.map(id => get(`${BASE}/${id}`)),
    ...SEARCHES_MULTI.map(q => get(`${BASE}?search=${encodeURIComponent(q)}&page-size=3`)),
    ...SEARCHES_CSS.map(q  => get(`${BASE}?search=${encodeURIComponent(q)}&page-size=1`)),
    ...SEARCHES_ONE.map(q  => get(`${BASE}?search=${encodeURIComponent(q)}&page-size=1`)),
  ];

  const results = await Promise.allSettled(fetchAll);
  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    const { status, body } = res.value;
    if (status !== 200) continue;
    try {
      const d = JSON.parse(body);
      const items = Array.isArray(d.member) ? d.member : [d];
      for (const item of items) {
        if (!item?.name || !item?.line1 || !item?.line2) continue;
        if (/DEB|OBJECT|R\/B/i.test(item.name)) continue;
        entries.push(`${item.name}\n${item.line1}\n${item.line2}`);
      }
    } catch(e) {}
  }

  if (!entries.length) return null;
  console.log(`✓ Ivan API: ${entries.length} spacecraft`);
  return entries.join('\n') + '\n';
}

async function main() {
  let tle = await tryCelestrak();
  if (!tle) tle = await tryIvanAPI();

  const out = path.join(__dirname, '..', 'data', 'stations.tle');
  if (!tle) {
    if (fs.existsSync(out)) {
      console.warn('All TLE sources failed — keeping existing file, will retry next run');
      process.exit(0); // don't spam email; existing data still valid for a few hours
    }
    console.error('All TLE sources failed and no existing file');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, tle);
  console.log(`Wrote → data/stations.tle`);
}

main();
