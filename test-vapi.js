'use strict';
const https = require('https');

const KEY = process.argv[2];
if (!KEY) { console.error('Usage: node test-vapi.js YOUR_KEY'); process.exit(1); }

const VESSELS = [
  ['368219910', 'ASOG'],
  ['368219920', 'JRTI'],
  ['368351350', 'OCISLY'],
  ['366584000', 'GO Searcher'],
  ['367550000', 'GO Navigator'],
  ['367578000', 'Bob'],
  ['367120400', 'Doug'],
  ['368368960', 'Jacklyn'],
  ['512440000', 'Seaworker'],
  ['512385000', 'Sea Surveyor'],
  ['369045000', 'Harvey Stone'],
  ['228438700', 'Canopée'],
  ['227278000', 'MN Toucan'],
  ['369998000', 'Lorenzen'],
  ['338941000', 'Invincible'],
  ['369468000', 'SBX-1'],
];

function get(mmsi) {
  return new Promise((resolve, reject) => {
    const url = `https://api.vesselapi.com/v1/vessel/${mmsi}/position?filter.idType=mmsi`;
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
      timeout: 10000,
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          resolve({ status: res.statusCode, vp: j.vesselPosition || null });
        } catch { resolve({ status: res.statusCode, vp: null }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const now = Date.now();
  console.log('\nMMSI         Name                  Status   Lat        Lon        Age');
  console.log('─'.repeat(75));
  for (const [mmsi, name] of VESSELS) {
    try {
      const { status, vp } = await get(mmsi);
      if (vp) {
        const ageH = ((now - new Date(vp.timestamp).getTime()) / 3600000).toFixed(1);
        console.log(`${mmsi}  ${name.padEnd(22)}  ${vp.latitude.toFixed(4).padStart(8)},  ${vp.longitude.toFixed(4).padStart(9)}  ${ageH}h ago`);
      } else {
        console.log(`${mmsi}  ${name.padEnd(22)}  [no data — HTTP ${status}]`);
      }
    } catch(e) {
      console.log(`${mmsi}  ${name.padEnd(22)}  [error: ${e.message}]`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

main();
