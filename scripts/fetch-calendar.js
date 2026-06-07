'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'SpaceFleetTracker/1.0 (github.com/karl-dykema/space-intel; contact via repo)',
        'Accept': 'application/json',
      },
      timeout: 20000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
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

async function main() {
  const outPath = path.join(__dirname, '..', 'data', 'calendar.json');

  // Skip if data is fresh (< 1h 45m) — Action runs every 2h so this avoids double-hit on redeploy
  if (fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      const ageMs = prev.fetchedAt ? Date.now() - new Date(prev.fetchedAt).getTime() : Infinity;
      if (ageMs < 105 * 60 * 1000) {
        prev.fetchedAt = new Date().toISOString();
        fs.writeFileSync(outPath, JSON.stringify(prev));
        console.log(`Data is ${(ageMs/60000).toFixed(0)}m old — skipping fetch, updated fetchedAt`);
        return;
      }
    } catch(_) {}
  }

  console.log('Fetching upcoming launches from The Space Devs API…');
  const json = await fetchUrl(
    'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=100&ordering=net&mode=list'
  );
  const data = JSON.parse(json);
  const launches = (data.results || []).map(l => ({
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

  const result = { launches, fetchedAt: new Date().toISOString(), count: launches.length };

  // Only write if content changed
  let changed = true;
  if (fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      const strip = o => JSON.stringify(o.launches);
      changed = strip(prev) !== strip(result);
    } catch(_) {}
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if (changed) {
    fs.writeFileSync(outPath, JSON.stringify(result));
    console.log(`Written ${launches.length} launches → ${outPath}`);
  } else {
    const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    prev.fetchedAt = result.fetchedAt;
    fs.writeFileSync(outPath, JSON.stringify(prev));
    console.log(`No content change — updated fetchedAt only`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
