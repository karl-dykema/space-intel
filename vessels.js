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
      'Converted 2020 from Marmac 302; replaced OCISLY on East Coast',
      'Primary Atlantic/Gulf ASDS for LC-39A and SLC-40 launches',
      'Hosts autonomous landing system + catch arm hardware for Starship program',
      'Named after a ship in Iain M. Banks\' Culture novel series',
      'Can hold position within meters in open ocean using GPS + thruster control',
    ],
    notes:'Primary Atlantic/Gulf ASDS. Falcon 9 & Heavy recoveries. Hull: Marmac 302 (confirmed). [✓ MMSI]',
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
      'Converted from Marmac 304 barge in 2015 (AIS registry confirmed)',
      'Operates 300–700km off Baja California coast for Pacific recovery zone',
      'Booster catch: Starlink 17-41 — May 30 2026',
    ],
    notes:'Pacific ASDS for Vandenberg SFB launches. Hull: Marmac 304 (confirmed). MMSI confirmed. [✓ MMSI]',
  },
  '366584000': {
    name:'Megan', abbr:'Megan',
    operator:'SpaceX', role:'Dragon Capsule Recovery (RETIRED 2025)',
    color:'#556677', homePort:'Port Canaveral, FL',
    imo:'9591648', flag:'USA', built:2011, verified:true,
    specs:{ length:'74m', beam:'14m', type:'Offshore supply vessel', speed:'~12 kn' },
    history:[
      'Ex-GO Searcher, originally operated by Edison Chouest Offshore',
      'Renamed Megan in 2022 honoring NASA astronaut Megan McArthur',
      'Deployed 6–12 hours before Dragon splashdown off Florida coast',
      'Equipped with fast rescue boats and medical team for crew recovery',
      'Retired 2025 — sister ship Shannon now sole Dragon recovery vessel',
    ],
    notes:'RETIRED 2025. Ex-GO Searcher. Named for NASA astronaut Megan McArthur. [✓ MMSI]',
  },
  '367550000': {
    name:'Shannon', abbr:'Shannon',
    operator:'SpaceX', role:'Dragon Capsule Recovery',
    color:'#00d4ff', homePort:'Port of Long Beach, CA',
    imo:'9566887', flag:'USA', built:2010, verified:true,
    specs:{ length:'52m', beam:'11m', type:'Offshore supply vessel', speed:'~12 kn' },
    history:[
      'Ex-GO Navigator, originally operated by Edison Chouest Offshore',
      'Renamed Shannon in 2022 honoring NASA astronaut Shannon Walker',
      'Joined SpaceX fleet 2018; first Dragon recovery during Crew Demo-2, August 2020',
      'Relocated from Port Canaveral to Port of Long Beach, CA in December 2024',
      'Sole Dragon capsule recovery vessel after Megan\'s retirement in 2025',
      'Named for NASA astronaut Shannon Walker (Crew-1, first female Dragon crew member)',
    ],
    notes:'Ex-GO Navigator. Now sole Dragon recovery vessel (Megan retired 2025). Based Long Beach as of Dec 2024. [✓ MMSI]',
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
    operator:'SpaceX', role:'Droneship Support (RETIRED 2023)',
    color:'#556677', homePort:'Port of Long Beach, CA',
    imo:'8987876', flag:'USA', verified:true,
    specs:{ type:'Offshore support vessel' },
    history:[
      'Operated by GO Maritime (Edison Chouest Offshore subsidiary) for SpaceX',
      'Droneship support vessel used by SpaceX for over 10 years in Atlantic and Pacific',
      'Supported OCISLY on West Coast and ASOG/JRTI on East Coast at various times',
      'Retired 2023 — replaced by Bob and Doug on East Coast, GO Beyond on West Coast',
    ],
    notes:'RETIRED 2023. IMO 8987876. [✓ MMSI confirmed]',
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
  '512385000': {
    name:'Sea Surveyor', abbr:'Sea Surveyor',
    operator:'Rocket Lab', role:'Recovery / Support Vessel',
    color:'#ff3355', homePort:'Māhia Peninsula, NZ',
    imo:'8824543', flag:'New Zealand', verified:true,
    specs:{ type:'Offshore support vessel' },
    history:[
      'New Zealand-flagged support vessel for Rocket Lab Electron recovery operations',
      'Operates in recovery zone east of Māhia Peninsula, New Zealand',
    ],
    notes:'Rocket Lab NZ support vessel. IMO 8824543. [✓ MMSI confirmed]',
  },
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
  '338731000': {
    name:'RocketShip', abbr:'RocketShip',
    operator:'ULA', role:'Rocket Component Transport',
    color:'#ff9900', homePort:'Port Canaveral, FL',
    imo:'9198501', flag:'USA', built:1999, verified:true,
    specs:{ length:'95m', beam:'25m', type:'Cargo vessel (shallow draft)', capacity:'Full Delta IV stack + payload' },
    history:[
      'Originally named Delta Mariner; purpose-built for ULA in 1999 in Mississippi',
      'Renamed RocketShip during 2019 overhaul',
      'Transports rockets from ULA\'s Decatur, Alabama factory via Tennessee and Mississippi Rivers to the Gulf',
      'Primary route: Decatur AL → Gulf of Mexico → Port Canaveral, FL',
      'Also served Vandenberg SFB via Panama Canal until 2022',
      'Custom shallow-draft design allows river transit and open-ocean passage',
      'Hold can accommodate entire Delta IV comprising 3 boosters, second stage, fairing, and payload',
    ],
    notes:'ULA rocket component transport. IMO 9198501. [✓ MMSI confirmed]',
  },
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
  // ── ESA / Arianespace ────────────────────────────────────────
  '228438700': {
    name:'Canopée', abbr:'Canopée',
    operator:'ESA', role:'Ariane 6 Component Transport',
    color:'#9933ff', homePort:'Le Havre, France',
    imo:'9924120', flag:'France', verified:true,
    specs:{ type:'Roll-on/roll-off cargo ship', propulsion:'Conventional + 4 retractable wind sails (Solid Sail)' },
    history:[
      'Purpose-built for ArianeGroup to transport Ariane 6 rocket components to French Guiana',
      'Features four retractable wind sails (Solid Sail technology) to reduce fuel consumption',
      'Route: Europe → Pariacabo port, Kourou, French Guiana (Guiana Space Centre)',
      'First delivery to Kourou was in 2022 ahead of Ariane 6\'s first flight',
    ],
    notes:'Ariane 6 transport. Notable for wind sail propulsion assist. IMO 9924120. [✓ MMSI confirmed]',
  },
  '228057000': {
    name:'MN Colibri', abbr:'MN Colibri',
    operator:'ESA', role:'Arianespace Component Transport',
    color:'#9933ff', homePort:'France',
    imo:'9207390', flag:'France', verified:true,
    specs:{ type:'Ro-ro cargo vessel' },
    history:[
      'Chartered by Arianespace for satellite and rocket component transportation',
      'Transported the James Webb Space Telescope to the Guiana Space Centre in 2021',
      'Regular service between Europe and Kourou, French Guiana',
    ],
    notes:'Arianespace charter transport. Transported JWST in 2021. IMO 9207390. [✓ MMSI confirmed]',
  },
  '227278000': {
    name:'MN Toucan', abbr:'MN Toucan',
    operator:'ESA', role:'Arianespace Component Transport',
    color:'#9933ff', homePort:'France',
    imo:'9112466', flag:'France', verified:true,
    specs:{ type:'Ro-ro cargo vessel' },
    history:[
      'Chartered by Arianespace to transport large rocket components to French Guiana',
      'Regular service between Europe and Kourou, French Guiana for Ariane launches',
    ],
    notes:'Arianespace charter transport. IMO 9112466. [✓ MMSI confirmed]',
  },
  // ── The Spaceport Company ─────────────────────────────────────
  '369857000': {
    name:'Once in a Lifetime', abbr:'Once in a Lifetime',
    operator:'The Spaceport Company', role:'Sea-Based Mobile Launch Platform',
    color:'#00cc88', homePort:'Gulf Coast',
    imo:'8118011', flag:'USA', verified:false,
    specs:{ type:'Torpedo Recovery Vessel (converted)' },
    history:[
      'Possible vessel associated with USNS Hugo (TSV-2), acquired by The Spaceport Company at auction Feb 2024',
      'Former US Navy training/torpedo recovery vessel',
      'The Spaceport Company is developing sea-based mobile launch platforms',
      'DoD contract to demonstrate platform infrastructure technology',
    ],
    notes:'UNVERIFIED — may be USNS Hugo / TSV-2. The Spaceport Company sea launch platform. Confirm MMSI at marinetraffic.com',
  },
  // ── NASA / Navy capsule recovery ─────────────────────────────
  '368926266': {
    name:'USS John P. Murtha', abbr:'Murtha',
    operator:'NASA Recovery', role:'Orion / Artemis Capsule Recovery Ship',
    color:'#3399ff', homePort:'Naval Base San Diego, CA',
    imo:'1', flag:'USA', built:2011, verified:true,
    specs:{ length:'208m', beam:'32m', type:'San Antonio-class LPD (amphibious transport dock)', capacity:'Well deck for capsule recovery' },
    history:[
      'Primary recovery vessel for NASA Artemis program Orion capsules',
      'Recovered Artemis I Orion capsule (uncrewed) — December 2022',
      'Recovered Artemis II Orion "Integrity" + 4 crew — April 10 2026',
      'Well deck accommodates the 23,000 lb capsule; ship carries Navy divers and NASA recovery teams',
      'Only tasked to NASA for specific Artemis recovery missions; otherwise on normal Navy deployments',
    ],
    notes:'Only relevant during Artemis missions. IMO listed as 1 (military placeholder). [✓ MMSI]',
  },
  // ── US Military / Range Support ──────────────────────────────
  '369998000': {
    name:'USNS Howard O. Lorenzen', abbr:'Lorenzen',
    operator:'US Space Force Range', role:'Missile Range Instrumentation Ship',
    color:'#aabb00', homePort:'Norfolk, VA',
    imo:'9416680', flag:'USA', built:2012, verified:true,
    specs:{ length:'163m', beam:'27m', type:'T-AGM-25 range ship', radar:'Cobra King AESA' },
    history:[
      'Operated by Military Sealift Command; missions sponsored by US Air Force / Space Force',
      'Cobra King radar can track ballistic missiles and rocket stages over horizon',
      'Frequently positioned downrange from Cape Canaveral and Vandenberg for major launches',
      'Successor to USNS Observation Island (T-AGM-23)',
      'Commissioned 2014; built by VT Halter Marine, Pascagoula MS',
    ],
    notes:'US Space Force range support. Positions near Canaveral/Vandenberg for launches. [✓ MMSI]',
  },
  '338941000': {
    name:'USNS Invincible', abbr:'Invincible',
    operator:'US Space Force Range', role:'Missile Range Instrumentation Ship',
    color:'#aabb00', homePort:'Jacksonville, FL',
    imo:'8833879', flag:'USA', built:1986, verified:true,
    specs:{ length:'68m', beam:'13m', type:'T-AGM-24 (ex-AGOS-10)', },
    history:[
      'Originally built as ocean surveillance ship (AGOS-10); converted to range ship in 2000',
      'Supports Eastern and Western range missile / rocket tracking',
      'Operated by Military Sealift Command with civilian crew',
    ],
    notes:'Stalwart-class range ship. Reclassified AGOS→AGM 2000. [✓ MMSI]',
  },
  '369468000': {
    name:'SBX-1', abbr:'SBX-1',
    operator:'US Space Force Range', role:'Sea-Based X-Band Radar Platform',
    color:'#aabb00', homePort:'Pearl Harbor, HI',
    imo:'8765412', flag:'USA', built:2005, verified:true,
    specs:{ length:'119m', beam:'73m', type:'CS-50 semi-submersible', radar:'X-band AESA phased array' },
    history:[
      'World\'s largest sea-based X-band radar; detects objects the size of a baseball at 2,500 miles',
      'Deployed 2006 as part of the Ballistic Missile Defense System in the Pacific',
      'Operated by Boeing under MDA contract; based at Pearl Harbor when not on mission',
      'Moves slowly (8 kn max) to mission positions in the Pacific',
      'Radar housed under the distinctive large white radome visible from miles away',
    ],
    notes:'Massive semi-sub radar platform. Rarely moves but AIS-visible. Primarily BMDS / Pacific range. [✓ MMSI]',
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
const OP_COLORS = { 'SpaceX':'#00d4ff', 'Blue Origin':'#4477ff', 'Rocket Lab':'#ff3355', 'ULA':'#ff9900', 'ESA':'#9933ff', 'The Spaceport Company':'#00cc88', 'US Space Force Range':'#aabb00', 'NASA Recovery':'#3399ff' };
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
  KEY:          'space_intel_ais_key',
  HISTORY:      'space_intel_history',
  EVENTS:       'space_intel_events',
  SB_URL:       'space_intel_sb_url',
  SB_AKEY:      'space_intel_sb_akey',
  MISSIONS:     'space_intel_missions',
  MISSIONS_PAST:'space_intel_missions_past',
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
    drone: {
      'SLC-40':'368219910', 'Space Launch Complex 40':'368219910',
      'LC-39A':'368219910', 'Launch Complex 39A':'368219910',
      'LC-39B':'368219910', 'Launch Complex 39B':'368219910',
      'SLC-4E':'368351350', 'Space Launch Complex 4E':'368351350', 'Vandenberg':'368351350',
      'Starbase':'368219920', 'Orbital Launch Mount':'368219920', 'Boca Chica':'368219920',
    },
    recovery: ['366584000','367550000'],
  },
  'Blue Origin': { drone: { default:'368368960' } },
  'Rocket Lab':  { recovery: ['512440000','512385000'] },
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

function vesselHintsForLaunch(op, padName, locName='') {
  const h = VESSEL_HINTS[op]; if(!h) return [];
  const search = `${padName} ${locName}`;
  const out = [];
  if(h.drone) {
    const match = Object.entries(h.drone).find(([k])=>k!=='default'&&search.includes(k));
    if(match) out.push(match[1]);
    else if(h.drone.default) out.push(h.drone.default);
  }
  if(h.recovery) out.push(...h.recovery);
  return [...new Set(out)].filter(m=>VESSEL_DB[m]);
}
