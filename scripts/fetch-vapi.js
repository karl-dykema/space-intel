'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const KEY = process.env.VAPI_KEY || process.argv[2];
if (!KEY) { console.error('VAPI_KEY env var or CLI arg required'); process.exit(1); }

// Only MMSIs confirmed present in VesselAPI — skipping 404s saves API calls.
// Free plan: 150 calls/month. 14 vessels × ~10 runs/month (every 3 days) = ~140 calls.
const VESSELS = [
  '368219910', // ASOG
  '368219920', // JRTI
  '368351350', // OCISLY
  '367550000', // GO Navigator
  '368368960', // Jacklyn
  '512440000', // Seaworker
  '369045000', // Harvey Stone
  '338731000', // RocketShip (ULA)
  '228438700', // Canopée
  '228057000', // MN Colibri
  '227278000', // MN Toucan
  // Starship Ship 40 recovery flotilla (Indian Ocean, July 2026) — remove when the op ends
  '372112000', // Go Australis
  '257587000', // Normand Ranger
  '257084000', // Skimmer Tide
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
        try {
          const j = JSON.parse(body);
          resolve(j?.vesselPosition || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const vessels = {};
  for (const mmsi of VESSELS) {
    try {
      const vp = await get(mmsi);
      if (vp?.latitude) {
        vessels[mmsi] = {
          lat: vp.latitude,
          lon: vp.longitude,
          sog: vp.sog ?? null,
          cog: vp.cog ?? null,
          heading: vp.heading ?? null,
          ts:  vp.timestamp,
          name: vp.vessel_name || null,
        };
        console.log(`✓ ${mmsi}  ${vp.latitude.toFixed(4)}, ${vp.longitude.toFixed(4)}  ${vp.timestamp}`);
      } else {
        console.log(`— ${mmsi}  no data`);
      }
    } catch(e) {
      console.warn(`✗ ${mmsi}  ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  const out = { fetched: new Date().toISOString(), vessels };
  const outPath = path.join(__dirname, '..', 'data', 'vapi-positions.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${Object.keys(vessels).length}/${VESSELS.length} vessels → data/vapi-positions.json`);
}

main();
