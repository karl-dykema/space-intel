'use strict';
// Record a hand-read position for a vessel no free feed reaches.
//
//   node scripts/add-fix.js --mmsi=257587000 --lat=-10.501 --lon=105.213 \
//     --sog=2.5 --cog=79 --ts=2026-08-17T13:12:24Z --source=ShipInfo --note="off Christmas Is"
//
// Only --mmsi, --lat and --lon are required; ts defaults to now. The app merges these
// by timestamp alongside AIS and VesselAPI, so a real AIS report automatically wins
// over a paste — entries never need deleting, only superseding.
const fs   = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));

const req = ['mmsi', 'lat', 'lon'].filter(k => args[k] === undefined);
if (req.length) { console.error(`missing required: ${req.map(k => '--' + k).join(', ')}`); process.exit(1); }

const num = (v, name) => {
  const n = Number(v);
  if (!Number.isFinite(n)) { console.error(`--${name} must be a number, got "${v}"`); process.exit(1); }
  return n;
};
const lat = num(args.lat, 'lat'), lon = num(args.lon, 'lon');
// A transposed or mistyped coordinate is the likeliest error here and puts a vessel
// silently in the wrong ocean, so reject out-of-range rather than plotting nonsense.
if (lat < -90 || lat > 90)   { console.error(`--lat out of range: ${lat}`); process.exit(1); }
if (lon < -180 || lon > 180) { console.error(`--lon out of range: ${lon}`); process.exit(1); }

const ts = args.ts ? new Date(args.ts) : new Date();
if (isNaN(ts)) { console.error(`--ts is not a parseable date: "${args.ts}"`); process.exit(1); }
if (ts > new Date(Date.now() + 3600000)) { console.error(`--ts is in the future: ${ts.toISOString()}`); process.exit(1); }

const file = path.join(__dirname, '..', 'data', 'manual-positions.json');
let doc = { vessels: {} };
try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first entry */ }
doc.vessels = doc.vessels || {};

const prev = doc.vessels[String(args.mmsi)];
if (prev && new Date(prev.ts) > ts) {
  console.warn(`! existing fix for ${args.mmsi} is NEWER (${prev.ts}) — overwriting with an older one.`);
}

doc.vessels[String(args.mmsi)] = {
  lat, lon,
  sog: args.sog !== undefined ? num(args.sog, 'sog') : null,
  cog: args.cog !== undefined ? num(args.cog, 'cog') : null,
  ts: ts.toISOString(),
  source: args.source || 'manual',
  ...(args.note ? { note: String(args.note) } : {}),
};

fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log(`✓ ${args.mmsi}  ${lat}, ${lon}  ${ts.toISOString()}  (${args.source || 'manual'})`);
