'use strict';
const https = require('https');
const { ensureSchema, upsertCache } = require('./db');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'SpaceFleetTracker/1.0 (github.com/karl-dykema/space-intel)',
        'Accept': 'application/json',
        'Accept-Encoding': 'identity',
      },
      timeout: 20000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject); return;
      }
      if (res.statusCode === 429) { reject(new Error('rate-limited-429')); return; }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Operators we track — must match OPERATOR_MATCH keys in ships_db.js
const TRACKED_OPERATORS = ['SpaceX', 'Rocket Lab', 'Blue Origin', 'United Launch Alliance'];

async function main() {
  console.log('=== fetch-calendar ===');
  await ensureSchema();

  console.log('Fetching calendar (list mode, all operators)…');
  const raw = await fetchUrl('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=100&ordering=net&mode=list');
  const results = JSON.parse(raw).results || [];
  console.log(`  ${results.length} launches received`);

  if (results.length < 3) throw new Error(`Suspiciously few results: ${results.length} — aborting`);

  const launches = results.map(l => ({
    id:      l.id,
    name:    l.name,
    net:     l.net,
    status:  l.status?.name,
    lsp:     l.launch_service_provider?.name,
    lspAbbr: l.launch_service_provider?.abbrev,
    vehicle: l.rocket?.configuration?.name,
    pad:     l.pad?.name,
    loc:     l.pad?.location?.name,
  }));

  await upsertCache('launches.upcoming', launches, {
    source:    'll.thespacedevs.com',
    fetchedAt: new Date().toISOString(),
  });

  // Also fetch full detailed data for operators we track — used by share page for rich mission cards
  const isTracked = l => TRACKED_OPERATORS.some(op => (l.launch_service_provider?.name || '').includes(op));

  console.log('Fetching detailed upcoming launches for tracked operators…');
  const detRaw  = await fetchUrl('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=75&ordering=net&mode=detailed');
  const detUp   = JSON.parse(detRaw).results || [];
  const upFiltered = detUp.filter(isTracked);
  console.log(`  ${upFiltered.length} upcoming (detailed)`);
  if (upFiltered.length > 0) {
    await upsertCache('launches.detailed', upFiltered, {
      source: 'll.thespacedevs.com', fetchedAt: new Date().toISOString(),
    });
  }

  console.log('Fetching detailed past launches for tracked operators…');
  const pastRaw  = await fetchUrl('https://ll.thespacedevs.com/2.3.0/launches/previous/?limit=20&ordering=-net&mode=detailed');
  const detPast  = JSON.parse(pastRaw).results || [];
  const pastFiltered = detPast.filter(isTracked);
  console.log(`  ${pastFiltered.length} past (detailed)`);
  if (pastFiltered.length > 0) {
    await upsertCache('launches.past', pastFiltered, {
      source: 'll.thespacedevs.com', fetchedAt: new Date().toISOString(),
    });
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
