'use strict';
const https = require('https');

function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'SpaceFleetTracker/1.0 (github.com/karl-dykema/space-intel)',
        'Accept': 'application/json',
        ...opts.headers,
      },
      timeout: 20000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, opts).then(resolve).catch(reject);
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

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'POST', timeout: 15000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, res => {
      let out = '';
      res.on('data', d => out += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(out);
        else reject(new Error(`HTTP ${res.statusCode}: ${out.slice(0,200)}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function main() {
  const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');

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
  console.log(`  ${launches.length} launches fetched`);

  const fetchedAt = new Date().toISOString();
  await postJson(
    `${SB_URL}/rest/v1/launch_cache`,
    {
      'apikey':        SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    { key: 'upcoming', launches, fetched_at: fetchedAt }
  );
  console.log(`Upserted ${launches.length} launches to Supabase launch_cache (key=upcoming)`);
}

main().catch(e => { console.error(e); process.exit(1); });
