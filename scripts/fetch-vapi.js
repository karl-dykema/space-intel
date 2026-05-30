'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const KEY = process.env.VAPI_KEY || process.argv[2];
if (!KEY) { console.error('VAPI_KEY env var or CLI arg required'); process.exit(1); }

const VESSELS = [
  '368219910','368219920','368351350',
  '366584000','367550000','367578000','367120400',
  '368368960',
  '512440000','512385000',
  '369045000',
  '228438700','228057000','227278000',
  '369857000',
  '369998000','338941000','369468000',
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
