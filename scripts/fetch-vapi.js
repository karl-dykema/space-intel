'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const KEY = process.env.VAPI_KEY || process.argv[2];
if (!KEY) { console.error('VAPI_KEY env var or CLI arg required'); process.exit(1); }

// Free plan: 150 calls/month. The workflow runs every 3 days (~10 runs/month), so
// polling every vessel every run costs ~10 calls each. Vessels are tiered by how
// often they actually move: hot vessels every run, idle ones at half cadence, and
// ones VesselAPI has no coverage for get an occasional cheap probe.
//
// Budget: 9×10 (A) + 4×5 (B) + 1×2.5 (C) ≈ 113 of 150 calls/month.
//
// Skipped tiers keep their last known fix — main() merges onto the existing file
// rather than replacing it, and the app already renders VesselAPI fixes as hollow
// markers labelled with their age.
const cycle = Math.floor(Date.now() / (3 * 86400000)); // run counter, one per cron fire

// Tier A — actively moving or mission-critical. Every run.
const TIER_A = [
  '368219910', // ASOG          — droneship, sails per Falcon launch
  '368351350', // OCISLY        — droneship, sails per Falcon launch
  '338731000', // RocketShip    — ULA component transport, near-continuous
  '228438700', // Canopée       — Ariane 6 transport, near-continuous
  '228057000', // MN Colibri    — Arianespace transport, near-continuous
  '227278000', // MN Toucan     — Arianespace transport, near-continuous
  // Starship Ship 40 recovery flotilla (Indian Ocean, July 2026) — demote when the op ends
  '372112000', // Go Australis
  '257587000', // Normand Ranger
  '257084000', // Skimmer Tide
];

// Tier B — idle between infrequent missions. Every 2nd run (~6 days).
// Promote to Tier A when its mission window opens (Dragon splashdown, New Glenn flight).
const TIER_B = [
  '367550000', // Shannon       — Dragon recovery, idle between splashdowns
  '368368960', // Jacklyn       — New Glenn platform, idle between flights
  '512440000', // Seaworker     — Electron recovery, rarely tasked
  '369045000', // Harvey Stone  — support tug, moves with ASOG
];

// Tier C — no VesselAPI coverage as of July 2026. Every 4th run (~12 days) purely to
// detect if coverage returns; costs ~2-3 calls/month instead of 10 for nothing.
const TIER_C = [
  '368219920', // JRTI          — returns no data; probe for restored coverage
];

const VESSELS = [
  ...TIER_A,
  ...(cycle % 2 === 0 ? TIER_B : []),
  ...(cycle % 4 === 0 ? TIER_C : []),
];

function get(mmsi) {
  return new Promise((resolve, reject) => {
    const url = `https://api.vesselapi.com/v1/vessel/${mmsi}/position?filter.idType=mmsi`;
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
      timeout: 12000,
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        // Keep the status: a 404 (hull unknown to VesselAPI), a 200 with no recent
        // fix, an auth failure and a 429 quota exhaustion are all very different
        // problems that otherwise present identically as "no data".
        let pos = null;
        try { pos = JSON.parse(body)?.vesselPosition || null; } catch {}
        resolve({ status: res.statusCode, pos });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const vessels = {};
  const misses = [];
  for (const mmsi of VESSELS) {
    try {
      const { status, pos: vp } = await get(mmsi);
      if (vp?.latitude) {
        vessels[mmsi] = {
          lat: vp.latitude,
          lon: vp.longitude,
          sog: vp.sog ?? null,
          cog: vp.cog ?? null,
          heading: vp.heading ?? null,
          ts:  vp.timestamp,
          name: vp.vessel_name || null,
          // When WE last got this position, as distinct from when the vessel
          // reported it. Under tiered polling a carried-forward vessel may not
          // have been checked at the file's `fetched` time, so the file stamp
          // cannot stand in for this.
          checked: new Date().toISOString(),
        };
        console.log(`✓ ${mmsi}  ${vp.latitude.toFixed(4)}, ${vp.longitude.toFixed(4)}  ${vp.timestamp}`);
      } else {
        const why = status === 404 ? 'not in VesselAPI'
                  : status === 429 ? 'QUOTA EXCEEDED'
                  : status === 401 || status === 403 ? 'AUTH FAILED'
                  : status === 200 ? 'known hull, no recent fix'
                  : `HTTP ${status}`;
        misses.push({ mmsi, status, why });
        console.log(`— ${mmsi}  no data (${why})`);
      }
    } catch(e) {
      console.warn(`✗ ${mmsi}  ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  const outPath = path.join(__dirname, '..', 'data', 'vapi-positions.json');

  // Merge onto the previous run so vessels in a skipped tier keep their last known
  // fix instead of vanishing from the map. Each entry carries its own `ts`, so the
  // app ages them correctly even when the file's `fetched` stamp is newer.
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(outPath, 'utf8'))?.vessels || {};
  } catch { /* first run, or unreadable — start clean */ }

  const merged = { ...prev, ...vessels };
  const out = { fetched: new Date().toISOString(), vessels: merged };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  const carried = Object.keys(merged).length - Object.keys(vessels).length;
  console.log(`\nPolled ${Object.keys(vessels).length}/${VESSELS.length} vessels (cycle ${cycle}, ${carried} carried forward) → data/vapi-positions.json`);

  if (misses.length) {
    console.log('\nNo-data breakdown:');
    for (const m of misses) console.log(`  ${m.mmsi}  ${m.why}`);
    if (misses.some(m => m.status === 429))
      console.warn('\n!! Monthly VesselAPI quota exhausted — reduce tiers in VESSELS.');
    if (misses.some(m => m.status === 401 || m.status === 403))
      console.warn('\n!! VAPI_KEY rejected — positions are stale until this is fixed.');
  }
}

main();
