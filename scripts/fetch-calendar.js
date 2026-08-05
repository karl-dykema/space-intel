'use strict';
const https = require('https');
const { ensureSchema, upsertCache } = require('./db');

function fetchUrl(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'SpaceFleetTracker/1.0 (github.com/karl-dykema/space-intel)',
        'Accept': 'application/json',
        'Accept-Encoding': 'identity',
      },
      timeout: timeoutMs,
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

// ll.thespacedevs.com is a free public API and its `mode=detailed` queries are heavy
// enough to intermittently exceed a 20s timeout. Retry transient failures with backoff
// before giving up.
const TRANSIENT = /timeout|rate-limited-429|HTTP 5\d\d|ECONNRESET|socket hang up|EAI_AGAIN/i;

async function fetchWithRetry(url, { tries = 3, timeoutMs = 20000, label = 'fetch' } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fetchUrl(url, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (!TRANSIENT.test(e.message) || attempt === tries) break;
      const wait = 5000 * attempt; // 5s, then 10s
      console.log(`  ${label}: attempt ${attempt}/${tries} failed (${e.message}) — retrying in ${wait / 1000}s`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// Operators we track — must match OPERATOR_MATCH keys in ships_db.js
const TRACKED_OPERATORS = ['SpaceX', 'Rocket Lab', 'Blue Origin', 'United Launch Alliance'];

async function main() {
  console.log('=== fetch-calendar ===');
  await ensureSchema();

  console.log('Fetching calendar (list mode, all operators)…');
  // Primary payload — a failure here is a genuine failure and should exit non-zero.
  const raw = await fetchWithRetry(
    'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=100&ordering=net&mode=list',
    { label: 'calendar list' });
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

  // The detailed fetches enrich the share page's mission cards. They are optional:
  // the primary calendar is already saved above, and a skipped run just leaves the
  // previous detail cache in place until the next run 2h later. Never fail the whole
  // job for these — a transient API blip shouldn't page a red X for healthy data.
  const detailed = [
    { key:'launches.detailed', label:'upcoming (detailed)',
      url:'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=75&ordering=net&mode=detailed' },
    { key:'launches.past',     label:'past (detailed)',
      url:'https://ll.thespacedevs.com/2.3.0/launches/previous/?limit=20&ordering=-net&mode=detailed' },
  ];

  let degraded = 0;
  for (const d of detailed) {
    console.log(`Fetching ${d.label} for tracked operators…`);
    try {
      // Longer ceiling than the list query: these payloads are much larger.
      const raw2 = await fetchWithRetry(d.url, { timeoutMs: 45000, label: d.label });
      const filtered = (JSON.parse(raw2).results || []).filter(isTracked);
      console.log(`  ${filtered.length} ${d.label}`);
      if (filtered.length > 0) {
        await upsertCache(d.key, filtered, {
          source: 'll.thespacedevs.com', fetchedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      degraded++;
      console.warn(`  !! ${d.label} unavailable (${e.message}) — keeping previous cache`);
    }
  }

  if (degraded) {
    console.log(`\nCompleted with ${degraded} optional fetch(es) skipped. Primary calendar saved.`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
