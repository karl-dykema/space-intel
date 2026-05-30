'use strict';

// ── Vessel Database ──────────────────────────────────────────
const VESSEL_DB = {
  // ── SpaceX ──────────────────────────────────────────────────
  '368219910': {
    name:'A Shortfall of Gravitas', abbr:'ASOG',
    operator:'SpaceX', role:'Autonomous Spaceport Drone Ship',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    imo:'9869052', flag:'USA', built:2020, verified:true,
    specs:{ length:'91m', beam:'52m', type:'Self-propelled barge (ASDS)', propulsion:'4 diesel thrusters' },
    history:[
      'Converted 2020 from Marmac 304; replaced OCISLY on East Coast',
      'Primary Atlantic/Gulf ASDS for LC-39A and SLC-40 launches',
      'Hosts autonomous landing system + catch arm hardware for Starship program',
      'Named after a ship in Iain M. Banks\' Culture novel series',
      'Can hold position within meters in open ocean using GPS + thruster control',
    ],
    notes:'Primary Atlantic/Gulf ASDS. Falcon 9 & Heavy recoveries. [✓ MMSI] Note: some AIS registries show hull as "Marmac 302" — may be a naming mixup with OCISLY; widely cited as Marmac 304.',
  },
  '368219920': {
    name:'Just Read the Instructions', abbr:'JRTI',
    operator:'SpaceX', role:'Drone Ship / Starship Support',
    color:'#00d4ff', homePort:'Boca Chica, TX',
    flag:'USA', built:2015, verified:true,
    specs:{ length:'91m', beam:'52m', type:'Self-propelled barge (ASDS)', propulsion:'4 diesel thrusters' },
    history:[
      'Originally operated in Pacific for Vandenberg launches; relocated to Gulf in 2020',
      'Transitioned to Starship program support at Starbase, Boca Chica, TX',
      'Named after a ship in Iain M. Banks\' Culture novel series',
      'Will serve as offshore Starship landing platform for Mechazilla backup and ocean tests',
      'Converted 2015 from Marmac 303 barge',
    ],
    notes:'Transitioning from Falcon to Starship program support as of 2026. [✓ MMSI]',
  },
  '368351350': {
    name:'Of Course I Still Love You', abbr:'OCISLY',
    operator:'SpaceX', role:'Autonomous Spaceport Drone Ship',
    color:'#00d4ff', homePort:'Port Hueneme, CA',
    flag:'USA', built:2015, verified:true,
    specs:{ length:'91m', beam:'52m', type:'Self-propelled barge (ASDS)', propulsion:'4 diesel thrusters' },
    history:[
      'Pacific ASDS for all Vandenberg SFB (SLC-4E) Falcon 9 launches',
      'First Falcon 9 booster landing at sea: April 8 2016 (CRS-8)',
      'Named after a ship in Iain M. Banks\' Culture novel series',
      'Converted from Marmac 302 barge in 2015',
      'Operates 300–700km off Baja California coast for Pacific recovery zone',
    ],
    notes:'Pacific ASDS for Vandenberg SFB launches. MMSI confirmed by user. [✓ MMSI] Note: some AIS registries show hull as "Marmac 304" — may be a naming mixup with ASOG; widely cited as Marmac 302.',
  },
  '366584000': {
    name:'Megan', abbr:'Megan',
    operator:'SpaceX', role:'Dragon Capsule Recovery',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    imo:'9591648', flag:'USA', built:2011, verified:true,
    specs:{ length:'74m', beam:'14m', type:'Offshore supply vessel', speed:'~12 kn' },
    history:[
      'Ex-GO Searcher, originally operated by Edison Chouest Offshore',
      'Renamed Megan in 2022 honoring NASA astronaut Megan McArthur',
      'Deployed 6–12 hours before Dragon splashdown off Florida coast',
      'Equipped with fast rescue boats and medical team for crew recovery',
      'Also retrieves the nose cone of Dragon after parachute descent',
    ],
    notes:'Ex-GO Searcher. Named for NASA astronaut Megan McArthur. [✓ MMSI]',
  },
  '367550000': {
    name:'Shannon', abbr:'Shannon',
    operator:'SpaceX', role:'Dragon Capsule Recovery',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    imo:'9566887', flag:'USA', built:2010, verified:true,
    specs:{ length:'74m', beam:'14m', type:'Offshore supply vessel', speed:'~12 kn' },
    history:[
      'Ex-GO Navigator, originally operated by Edison Chouest Offshore',
      'Renamed Shannon in 2022 honoring NASA astronaut Shannon Walker',
      'Works in tandem with Megan during crew Dragon recoveries',
      'Patrols exclusion zone and assists with capsule towing to shore',
    ],
    notes:'Ex-GO Navigator. Named for NASA astronaut Shannon Walker. [✓ MMSI]',
  },
  '368456000': {
    name:'Bob', abbr:'Bob',
    operator:'SpaceX', role:'Fairing Recovery / Support',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    imo:'9529695', flag:'USA', built:2010, verified:true,
    specs:{ length:'85m', beam:'14m', type:'Offshore support vessel', speed:'~12 kn' },
    history:[
      'Named for NASA astronaut Bob Behnken (Demo-2, 2020)',
      'Ex-Ella G; converted and outfitted by SpaceX at Edison Chouest shipyard in 2021',
      'Recovers Falcon 9 fairing halves after Atlantic launches using crane and deck storage',
      'Also tows ASOG drone ship to and from recovery positions',
      'Replaced GO Quest as primary East Coast support vessel in 2023',
    ],
    notes:'Active East Coast fairing recovery + ASDS support. [✓ MMSI]',
  },
  '368485000': {
    name:'Doug', abbr:'Doug',
    operator:'SpaceX', role:'Fairing Recovery / Support',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    imo:'9529889', flag:'USA', built:2010, verified:true,
    specs:{ length:'85m', beam:'14m', type:'Offshore support vessel', speed:'~12 kn' },
    history:[
      'Named for NASA astronaut Doug Hurley (Demo-2, 2020)',
      'Ex-Ingrid; converted alongside Bob at Edison Chouest shipyard in 2021',
      'Works in tandem with Bob — two vessels for simultaneous fairing half recovery',
      'Can store and transport four complete fairing halves on deck',
      'Replaced NRC Quest after SpaceX retired net-catch approach in favor of water recovery',
    ],
    notes:'Active East Coast fairing recovery + ASDS support. [✓ MMSI]',
  },
  '367564890': {
    name:'GO Quest', abbr:'GO Quest',
    operator:'SpaceX', role:'Fairing Recovery / OCISLY Support',
    color:'#00d4ff', homePort:'Port of Long Beach, CA',
    imo:'8987876', flag:'USA', verified:true,
    specs:{ type:'Offshore support vessel' },
    history:[
      'Operated by GO Maritime (Edison Chouest Offshore subsidiary) for SpaceX',
      'West Coast support vessel for OCISLY and Vandenberg SFB (SLC-4E) launches',
      'Recovers Falcon 9 fairing halves after Pacific launches',
      'Escorts and supports OCISLY drone ship at sea',
    ],
    notes:'West Coast fairing recovery + OCISLY support. IMO 8987876. [✓ MMSI confirmed]',
  },
  // ── Blue Origin ──────────────────────────────────────────────
  '368368960': {
    name:'Jacklyn', abbr:'Jacklyn',
    operator:'Blue Origin', role:'New Glenn Landing Platform (LPV-1)',
    color:'#4477ff', homePort:'Port Canaveral, FL',
    imo:'9998676', flag:'USA', built:2024, verified:true,
    specs:{ length:'116m', beam:'46m', grossTonnage:'13,818 GT', type:'Landing Platform Vessel', propulsion:'Dynamic positioning thrusters' },
    history:[
      'Designated LPV-1; Blue Origin\'s first autonomous booster landing platform',
      'Named after Jacklyn Gise Bezos, Jeff Bezos\' mother',
      'First successful New Glenn booster landing: January 16 2025 (NG-1)',
      'First booster catch (with catch arms): November 13 2025 (NG-3)',
      'Operates ~450km downrange in Atlantic from LC-36, Cape Canaveral SFS',
      'Towed to position by Harvey Stone; does not self-propel to sea',
    ],
    notes:'New Glenn first-stage landing platform. [✓ MMSI]',
  },
  '369045000': {
    name:'Harvey Stone', abbr:'Harvey Stone',
    operator:'Blue Origin', role:'Support Tug',
    color:'#4477ff', homePort:'Port Canaveral, FL',
    flag:'USA', verified:true,
    specs:{ type:'Harbor/ocean tug' },
    history:[
      'Primary tug for Jacklyn drone ship towing and positioning',
      'Escorts Jacklyn to and from recovery zone for each New Glenn launch',
      'Named after Blue Origin engineer Harvey Stone',
    ],
    notes:'Support tug for Jacklyn. [✓ MMSI confirmed]',
  },
  // ── Rocket Lab ───────────────────────────────────────────────
  '512440000': {
    name:'Seaworker', abbr:'Seaworker',
    operator:'Rocket Lab', role:'Electron Recovery Vessel',
    color:'#ff3355', homePort:'Māhia Peninsula, NZ',
    flag:'New Zealand', verified:true,
    specs:{ type:'Offshore support vessel' },
    history:[
      'Deployed for Electron first-stage recovery missions at sea',
      'Positions in recovery zone east of Māhia Peninsula, New Zealand',
      'Rocket Lab reuses Electron first stages to reduce launch costs',
      'Has supported multiple successful booster recoveries since 2022',
    ],
    notes:'Electron booster recovery vessel. [✓ MMSI confirmed]',
  },
  // ── ULA ──────────────────────────────────────────────────────
  '367532790': {
    name:'R/V Retrieval', abbr:'Retrieval',
    operator:'ULA', role:'Fairing Recovery',
    color:'#ff9900', homePort:'Cape Canaveral, FL',
    flag:'USA', verified:false,
    specs:{ type:'Research/recovery vessel' },
    history:[
      'Deployed to recover Atlas V and Vulcan Centaur payload fairings',
      'ULA began fairing recovery program to reduce hardware costs',
      'Operates in Atlantic downrange from Cape Canaveral SFS',
    ],
    notes:'ULA fairing recovery vessel. [? MMSI — verify at marinetraffic.com]',
  },
  // ── Test vessel ───────────────────────────────────────────────
  '353136000': {
    name:'Ever Given', abbr:'Ever Given',
    operator:'TEST', role:'AIS Test Vessel',
    color:'#556677', homePort:'Panama',
    imo:'9811000', flag:'Panama', built:2018, verified:true,
    specs:{ length:'400m', beam:'59m', type:'Ultra-large container ship (ULCS)', capacity:'20,124 TEU' },
    history:[
      'Operated by Evergreen Marine Corp; built by Imabari Shipbuilding',
      'Blocked Suez Canal for 6 days in March 2021 causing global shipping disruption',
      'One of the most-tracked vessels in the world; reliable AIS test target',
    ],
    notes:'AIS test vessel. [✓ MMSI confirmed]',
  },
};

const KNOWN_MMSIS = Object.keys(VESSEL_DB);

// ── Geo-fences ────────────────────────────────────────────────
const ZONES = [
  { id:'canaveral',    name:'Cape Canaveral / KSC',    minLat:28.3,  maxLat:28.7,  minLon:-81.0, maxLon:-80.3  },
  { id:'port_can',     name:'Port Canaveral',          minLat:28.38, maxLat:28.45, minLon:-80.65,maxLon:-80.55 },
  { id:'boca_chica',   name:'Starbase / Boca Chica',   minLat:25.9,  maxLat:26.2,  minLon:-97.4, maxLon:-97.0  },
  { id:'vandenberg',   name:'Vandenberg SFB',          minLat:34.5,  maxLat:34.9,  minLon:-120.9,maxLon:-120.4 },
  { id:'wallops',      name:'Wallops Island',          minLat:37.7,  maxLat:37.95, minLon:-75.6, maxLon:-75.3  },
  { id:'lc1_nz',       name:'LC-1 Māhia (Rocket Lab)', minLat:-39.4, maxLat:-39.0, minLon:177.7, maxLon:178.2  },
  { id:'atl_recovery', name:'Atlantic Recovery Zone',  minLat:26.0,  maxLat:31.0,  minLon:-80.5, maxLon:-72.0  },
  { id:'pac_recovery', name:'Pacific Recovery Zone',   minLat:28.0,  maxLat:35.0,  minLon:-123.0,maxLon:-114.0 },
  { id:'gulf_ops',     name:'Gulf Ops Zone',           minLat:25.0,  maxLat:29.0,  minLon:-97.5, maxLon:-88.0  },
];
function detectZones(lat, lon) {
  return ZONES.filter(z=>lat>=z.minLat&&lat<=z.maxLat&&lon>=z.minLon&&lon<=z.maxLon).map(z=>z.id);
}

// ── Operator colors ───────────────────────────────────────────
const OP_COLORS = { 'SpaceX':'#00d4ff', 'Blue Origin':'#4477ff', 'Rocket Lab':'#ff3355', 'ULA':'#ff9900' };
function opColor(op) { return OP_COLORS[op]||'#aaaaaa'; }

// ── Event config ──────────────────────────────────────────────
const EV_CFG = {
  VESSEL_SEEN: { icon:'🛰', color:'#00ff88' },
  UNDERWAY:    { icon:'⚓', color:'#00d4ff' },
  MOORED:      { icon:'🔵', color:'#ffcc00' },
  ZONE_ENTER:  { icon:'📍', color:'#44ffcc' },
  ZONE_EXIT:   { icon:'↩', color:'#567fa0'  },
  AIS_GAP:     { icon:'⚠', color:'#ff4444'  },
  DEST_CHANGE: { icon:'🗺', color:'#ff8800'  },
};

// ── localStorage keys ─────────────────────────────────────────
const LS = {
  KEY:      'space_intel_ais_key',
  HISTORY:  'space_intel_history',
  EVENTS:   'space_intel_events',
  SB_URL:   'space_intel_sb_url',
  SB_AKEY:  'space_intel_sb_akey',
};
const MAX_EVENTS = 500;
const MAX_POS    = 3000;

// ── Missions data ─────────────────────────────────────────────
const OPERATOR_MATCH = {
  'SpaceX':                   'SpaceX',
  'Rocket Lab':               'Rocket Lab',
  'Blue Origin':              'Blue Origin',
  'United Launch Alliance':   'ULA',
};

const VESSEL_HINTS = {
  'SpaceX': {
    drone: { 'SLC-40':'368219910', 'LC-39A':'368219910', 'LC-39B':'368219910',
             'SLC-4E':'368351350', 'Starbase':'368219920' },
    recovery: ['366584000','367550000'],
  },
  'Blue Origin': { drone: { default:'368368960' } },
  'Rocket Lab':  { recovery: ['512440000'] },
};

// Seconds after T-0 for each key event, per vehicle
const VEHICLE_TIMELINES = {
  'Falcon 9': [
    { t:0,          label:'T+0:00  Launch' },
    { t:153,        label:'T+2:33  MECO / Stage Sep' },
    { t:480,        label:'T+8:00  Drone ship landing', vessel:'368219910', highlight:true },
    { t:540,        label:'T+9:00  Fairing splashdown', vessel:'366873580' },
    { t:600,        label:'T+10:00  Payload orbit insertion' },
    { t:36*3600,    label:'~T+36h  Drone ship departs for port', vessel:'368219910' },
    { t:60*3600,    label:'~T+2.5d  Drone ship returns to port', vessel:'368219910', highlight:true },
  ],
  'Falcon Heavy': [
    { t:0,          label:'T+0:00  Launch' },
    { t:155,        label:'T+2:35  Side booster sep' },
    { t:450,        label:'T+7:30  Side boosters land (LZ-1/2)' },
    { t:480,        label:'T+8:00  Center core drone ship', vessel:'368219910', highlight:true },
    { t:60*3600,    label:'~T+2.5d  Drone ship returns to port', vessel:'368219910', highlight:true },
  ],
  'Starship': [
    { t:0,          label:'T+0:00  Launch from Starbase' },
    { t:210,        label:'T+3:30  Booster sep' },
    { t:430,        label:'T+7:10  Mechazilla catch (booster)', highlight:true },
    { t:4200,       label:'T+1:10:00  Starship reentry' },
    { t:4800,       label:'T+1:20:00  Starship splashdown / catch', vessel:'368219920', highlight:true },
  ],
  'New Glenn': [
    { t:0,          label:'T+0:00  Launch from LC-36' },
    { t:480,        label:'T+8:00  First stage landing on Jacklyn', vessel:'368368960', highlight:true },
    { t:2700,       label:'T+45:00  Payload deployment' },
    { t:20*3600,    label:'~T+20h  Jacklyn departs recovery zone', vessel:'368368960' },
    { t:40*3600,    label:'~T+40h  Jacklyn returns to Port Canaveral', vessel:'368368960', highlight:true },
  ],
  'Electron': [
    { t:0,          label:'T+0:00  Launch from LC-1 Māhia' },
    { t:150,        label:'T+2:30  Stage sep' },
    { t:600,        label:'T+10:00  Booster recovery zone', vessel:'512440000', highlight:true },
    { t:24*3600,    label:'~T+24h  Seaworker returns to port', vessel:'512440000', highlight:true },
  ],
  'Vulcan Centaur': [
    { t:0,          label:'T+0:00  Launch' },
    { t:240,        label:'T+4:00  Booster sep (expended)' },
    { t:600,        label:'T+10:00  Fairing recovery', vessel:'367532790', highlight:true },
    { t:48*3600,    label:'~T+48h  R/V Retrieval returns to port', vessel:'367532790', highlight:true },
  ],
};

function timelineForVehicle(vehicleName) {
  return Object.entries(VEHICLE_TIMELINES).find(([k])=>vehicleName&&vehicleName.includes(k))?.[1] || null;
}

function vesselHintsForLaunch(op, padName) {
  const h = VESSEL_HINTS[op]; if(!h) return [];
  const out = [];
  if(h.drone) {
    const match = Object.entries(h.drone).find(([k])=>padName&&padName.includes(k));
    if(match) out.push(match[1]);
    else if(h.drone.default) out.push(h.drone.default);
  }
  if(h.recovery) out.push(...h.recovery);
  return [...new Set(out)].filter(m=>VESSEL_DB[m]);
}
