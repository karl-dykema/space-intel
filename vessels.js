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
  // ── China (CNSA / CASC) — Yuanwang Tracking Fleet ───────────
  // Global tracking ships supporting Long March launches, crewed missions, lunar/Mars probes.
  // VesselAPI returns 404 (not in their DB); will appear via aisstream when at sea.
  '413326000': {
    name:'Yuan Wang 3', abbr:'Yuan Wang 3',
    operator:'CNSA', role:'Space Tracking Ship',
    color:'#ff4444', homePort:'Jiangyin, China',
    flag:'China', verified:true,
    specs:{ type:'Tracking/research ship', length:'182m' },
    history:[
      'Second-generation Yuanwang tracking ship, commissioned 1995',
      'Supports Long March launches, crewed Shenzhou missions, lunar probes',
      'Travels to South Pacific, Indian Ocean, and Atlantic for tracking coverage',
    ],
    notes:'CNSA space tracking ship. IMO 9439527. [✓ MMSI confirmed via MarineTraffic]',
  },
  '413289000': {
    name:'Yuan Wang 5', abbr:'Yuan Wang 5',
    operator:'CNSA', role:'Space Tracking Ship',
    color:'#ff4444', homePort:'Jiangyin, China',
    flag:'China', verified:true,
    specs:{ type:'Tracking/research ship' },
    history:[
      'Third-generation Yuanwang tracking ship, launched 2007',
      'Supports all major Chinese space missions requiring over-horizon tracking',
      'Notable port call at Hambantota, Sri Lanka in 2022 — geopolitical controversy',
    ],
    notes:'CNSA space tracking ship. IMO 9413054. [✓ MMSI confirmed via MarineTraffic]',
  },
  '413379290': {
    name:'Yuan Wang 7', abbr:'Yuan Wang 7',
    operator:'CNSA', role:'Space Tracking Ship',
    color:'#ff4444', homePort:'Jiangyin, China',
    flag:'China', verified:true,
    specs:{ type:'Tracking/research ship' },
    history:[
      'Third-generation Yuanwang tracking ship, built 2016',
      'Supports crewed Shenzhou missions and lunar/Mars probes',
      'Deploys to key ocean positions before each major Chinese launch',
    ],
    notes:'CNSA space tracking ship. [✓ MMSI confirmed via MarineTraffic]',
  },
  '412380260': {
    name:'Yuan Wang 21', abbr:'Yuan Wang 21',
    operator:'CNSA', role:'Rocket Component Transport',
    color:'#ff4444', homePort:'Wenchang, China',
    flag:'China', verified:true,
    specs:{ type:'Launch vehicle carrier' },
    history:[
      'New-generation vessel for transporting Long March rockets to Wenchang launch site',
      'Purpose-built for the coastal Wenchang Space Launch Center supply chain',
    ],
    notes:'CNSA rocket transport ship. [✓ MMSI confirmed via MarineTraffic]',
  },
};

const KNOWN_MMSIS = Object.keys(VESSEL_DB);

// ── Geo-fences ────────────────────────────────────────────────
// roles: if set, ZONE_ENTER/EXIT only fires for vessels whose role contains one of these strings.
// silent: zone is used for map display only, never generates events.
const ZONES = [
  { id:'canaveral',    name:'Cape Canaveral / KSC',    minLat:28.3,  maxLat:28.7,  minLon:-81.0, maxLon:-80.3,  roles:['drone','asds','recovery','support tug'] },
  { id:'port_can',     name:'Port Canaveral',          minLat:28.38, maxLat:28.45, minLon:-80.65,maxLon:-80.55, silent:true },
  { id:'boca_chica',   name:'Starbase / Boca Chica',   minLat:25.9,  maxLat:26.2,  minLon:-97.4, maxLon:-97.0,  roles:['drone','asds','starship'] },
  { id:'vandenberg',   name:'Vandenberg SFB',          minLat:34.5,  maxLat:34.9,  minLon:-120.9,maxLon:-120.4, roles:['drone','asds','recovery'] },
  { id:'wallops',      name:'Wallops Island',          minLat:37.7,  maxLat:37.95, minLon:-75.6, maxLon:-75.3  },
  { id:'lc1_nz',       name:'LC-1 Māhia (Rocket Lab)', minLat:-39.4, maxLat:-39.0, minLon:177.7, maxLon:178.2,  roles:['recovery'] },
  { id:'atl_recovery', name:'Atlantic Recovery Zone',  minLat:26.0,  maxLat:31.0,  minLon:-80.5, maxLon:-72.0,  roles:['drone','asds','recovery','fast recovery'] },
  { id:'pac_recovery', name:'Pacific Recovery Zone',   minLat:30.0,  maxLat:35.0,  minLon:-122.0,maxLon:-116.0, roles:['drone','asds','recovery'] },
  { id:'gulf_ops',     name:'Gulf Ops Zone',           minLat:25.0,  maxLat:29.0,  minLon:-97.5, maxLon:-88.0,  roles:['drone','asds','starship'] },
  { id:'io_landing',   name:'Starship Indian Ocean Landing Zone', minLat:-25.0, maxLat:-13.0, minLon:100.0, maxLon:115.0, roles:['drone','asds','recovery','starship'] },
];
function detectZones(lat, lon) {
  return ZONES.filter(z=>lat>=z.minLat&&lat<=z.maxLat&&lon>=z.minLon&&lon<=z.maxLon).map(z=>z.id);
}

// ── Landmarks ─────────────────────────────────────────────────
// type: 'launch' | 'viewing' | 'facility' | 'port'
const LANDMARKS = [
  // ── Starbase / Boca Chica ────────────────────────────────────
  { id:'starbase_olm',    lat:25.997,  lon:-97.159,  name:'SpaceX Starbase — OLM',          type:'launch',   desc:'Orbital Launch Mount — Mechazilla catch tower. Starship / Super Heavy.' },
  { id:'boca_chica_beach',lat:25.893,  lon:-97.218,  name:'Boca Chica Beach',                type:'viewing',  desc:'Closest public ground viewing for Starbase launches. Often closed during ops.' },
  { id:'isla_blanca',     lat:26.075,  lon:-97.163,  name:'Isla Blanca Park (SPI)',          type:'viewing',  desc:'Popular South Padre Island viewing area, ~9 mi from OLM.' },
  { id:'andy_bowie',      lat:26.141,  lon:-97.172,  name:'Andy Bowie Park (SPI)',           type:'viewing',  desc:'North SPI county park — good angle on the launch corridor.' },
  { id:'port_brownsville',lat:25.945,  lon:-97.405,  name:'Port of Brownsville',             type:'port',     desc:'Deep-water port where SpaceX receives Starship hardware by ship.' },

  // ── Cape Canaveral / KSC ─────────────────────────────────────
  { id:'lc39a',           lat:28.608,  lon:-80.604,  name:'LC-39A (SpaceX)',                 type:'launch',   desc:'Apollo-era pad leased by SpaceX. Falcon 9, Falcon Heavy, future Starship East.' },
  { id:'lc40',            lat:28.562,  lon:-80.577,  name:'SLC-40 (SpaceX)',                 type:'launch',   desc:'Primary Falcon 9 workhorse pad at Cape Canaveral SFS.' },
  { id:'slc41',           lat:28.583,  lon:-80.583,  name:'SLC-41 (ULA)',                    type:'launch',   desc:'United Launch Alliance Vulcan Centaur and Atlas V pad.' },
  { id:'slc37b',          lat:28.532,  lon:-80.567,  name:'SLC-37B (ULA)',                   type:'launch',   desc:'ULA Delta IV Heavy pad. Last Delta IV Heavy launch 2024.' },
  { id:'ksc_visitor',     lat:28.522,  lon:-80.682,  name:'KSC Visitor Complex',             type:'facility', desc:'Public entrance to KSC — Apollo/Saturn V Center, shuttle Atlantis, paid launch viewing.' },
  { id:'space_view_park', lat:28.606,  lon:-80.805,  name:'Space View Park, Titusville',     type:'viewing',  desc:'Best free public viewing, 12 mi from pads. Riverside park with PA feed during launches.' },
  { id:'jetty_park',      lat:28.407,  lon:-80.592,  name:'Jetty Park',                      type:'viewing',  desc:'Port Canaveral beachfront. Eastern angle on the pads, cruise ships for scale.' },
  { id:'playalinda',      lat:28.655,  lon:-80.632,  name:'Playalinda Beach',                type:'viewing',  desc:'Canaveral National Seashore — closest public beach to LC-39. Often gated on launch days.' },
  { id:'banana_creek',    lat:28.605,  lon:-80.669,  name:'Banana Creek Viewing (KSC)',      type:'viewing',  desc:'Paid KSC bleacher seating 3.9 mi from pads. Best close-up view available to public.' },

  // ── Vandenberg SFB ───────────────────────────────────────────
  { id:'slc4e',           lat:34.633,  lon:-120.613, name:'SLC-4E (SpaceX)',                 type:'launch',   desc:'SpaceX Falcon 9 / Falcon Heavy. Polar and sun-synchronous orbit missions.' },
  { id:'slc6',            lat:34.576,  lon:-120.623, name:'SLC-6 (ULA/SpaceX)',              type:'launch',   desc:'Former Shuttle West pad. ULA and now SpaceX transition for future missions.' },
  { id:'jalama_beach',    lat:34.512,  lon:-120.503, name:'Jalama Beach',                    type:'viewing',  desc:'Santa Barbara County park. Nearest legal public viewing of Vandenberg launches, ~12 mi.' },
  { id:'lompoc_viewing',  lat:34.624,  lon:-120.447, name:'W. Ocean Ave, Lompoc',            type:'viewing',  desc:'Common roadside viewing corridor near base perimeter for SLC launches.' },

  // ── Wallops Island, VA ───────────────────────────────────────
  { id:'wallops_pad',     lat:37.940,  lon:-75.466,  name:'Wallops Flight Facility',         type:'launch',   desc:'NASA / Mid-Atlantic Regional Spaceport. Antares, Minotaur, small commercial launch site.' },
  { id:'wallops_visitor', lat:37.939,  lon:-75.456,  name:'NASA Wallops Visitor Center',     type:'facility', desc:'Free NASA visitor center with exhibits. Open on launch days for viewing.' },

  // ── Rocket Lab Māhia, NZ ─────────────────────────────────────
  { id:'rl_lc1',          lat:-39.262, lon:177.865,  name:'Rocket Lab LC-1 (Māhia)',        type:'launch',   desc:'Rocket Lab Electron smallsat launch complex. World\'s first private orbital launch site.' },
  { id:'mahia_lookout',   lat:-39.200, lon:177.900,  name:'Māhia Peninsula Lookout',        type:'viewing',  desc:'Public scenic reserve with view over launch complex.' },

  // ── NASA Centers ─────────────────────────────────────────────
  { id:'jsc',             lat:29.559,  lon:-95.094,  name:'NASA JSC — Houston',              type:'facility', desc:'Johnson Space Center. Mission Control, astronaut training, human spaceflight hub.' },
  { id:'ksc_center',      lat:28.573,  lon:-80.648,  name:'NASA Kennedy Space Center',       type:'facility', desc:'Primary NASA launch center. Manages LC-39 complex, VAB, and Shuttle Landing Facility.' },
  { id:'msfc',            lat:34.730,  lon:-86.585,  name:'NASA Marshall — Huntsville',      type:'facility', desc:'Marshall Space Flight Center. SLS propulsion, Artemis hardware, rocket engine testing.' },
  { id:'stennis',         lat:30.363,  lon:-89.600,  name:'NASA Stennis Space Center',       type:'facility', desc:'Rocket engine test facility. RS-25 (SLS) testing. Largest propulsion test site in the US.' },
  { id:'jpl',             lat:34.201,  lon:-118.172, name:'NASA JPL — Pasadena',             type:'facility', desc:'Jet Propulsion Laboratory. Manages Mars rovers, deep space probes, solar system missions.' },
  { id:'gsfc',            lat:38.992,  lon:-76.848,  name:'NASA Goddard — Greenbelt',        type:'facility', desc:'Goddard Space Flight Center. Earth observation, Hubble/JWST, science mission ops.' },
  { id:'armstrong',       lat:34.959,  lon:-117.883, name:'NASA Armstrong — Edwards',        type:'facility', desc:'Armstrong Flight Research Center at Edwards AFB. X-planes, hypersonics, Shuttle landings.' },
  { id:'ames',            lat:37.408,  lon:-122.064, name:'NASA Ames — Mountain View',       type:'facility', desc:'Ames Research Center. Aeronautics, planetary science, supercomputing.' },

  // ── International Launch Sites ───────────────────────────────
  { id:'baikonur',        lat:45.920,  lon:63.342,   name:'Baikonur Cosmodrome',             type:'launch',   desc:'Historic Soviet/Russian launch complex. First human spaceflight (Gagarin, 1961). Soyuz/Proton.' },
  { id:'plesetsk',        lat:62.929,  lon:40.577,   name:'Plesetsk Cosmodrome',             type:'launch',   desc:'Russian military spaceport. Soyuz-2, Angara launches. Most active launch site by count.' },
  { id:'vostochny',       lat:51.884,  lon:128.333,  name:'Vostochny Cosmodrome',            type:'launch',   desc:'Russia\'s new civilian spaceport. Soyuz-2 and future Angara/Yenisei missions.' },
  { id:'kourou',          lat:5.239,   lon:-52.769,  name:'Guiana Space Centre — Kourou',    type:'launch',   desc:'ESA/Arianespace primary site. Ariane 6, Vega-C. Near-equatorial location enables efficient GTO.' },
  { id:'jiuquan',         lat:40.958,  lon:100.291,  name:'Jiuquan Satellite Launch Center', type:'launch',   desc:'China\'s oldest spaceport. Crewed Shenzhou missions. Long March 2F human-rated rocket.' },
  { id:'xichang',         lat:28.246,  lon:102.026,  name:'Xichang Satellite Launch Center', type:'launch',   desc:'China\'s main GEO launch site. Long March 3B for communications and navigation satellites.' },
  { id:'wenchang',        lat:19.615,  lon:110.951,  name:'Wenchang Space Launch Center',    type:'launch',   desc:'China\'s newest coastal spaceport. Long March 5/7, Tianhe station modules, Chang\'e lunar missions.' },
  { id:'tanegashima',     lat:30.401,  lon:130.968,  name:'Tanegashima Space Center',        type:'launch',   desc:'JAXA primary launch site. H-IIA/H3 rockets for Japanese government and commercial payloads.' },
  { id:'sriharikota',     lat:13.733,  lon:80.234,   name:'Satish Dhawan — Sriharikota',     type:'launch',   desc:'ISRO launch site. PSLV, GSLV, LVM3. Chandrayaan, Mangalyaan, OneWeb missions.' },
  { id:'naro',            lat:34.432,  lon:127.535,  name:'Naro Space Center (KARI)',        type:'launch',   desc:'South Korea\'s first spaceport. Nuri (KSLV-II) orbital launch vehicle.' },
  { id:'esrange',         lat:67.886,  lon:21.063,   name:'Esrange Space Center',            type:'launch',   desc:'Swedish sounding rocket and balloon facility above Arctic Circle. Small orbital ambitions.' },
  { id:'woomera',         lat:-31.130, lon:136.816,  name:'Woomera Test Range',              type:'launch',   desc:'Australia\'s primary rocket range. Historic British test site; now multi-user range.' },
  { id:'alcantara',       lat:-2.373,  lon:-44.396,  name:'Alcântara Launch Center',         type:'launch',   desc:'Brazilian near-equatorial spaceport. VLM rocket. Favorable orbital insertion economics.' },
  { id:'starship_io_zone',lat:-19.0,  lon:107.0,    name:'Starship Indian Ocean Landing Zone',type:'viewing',  desc:'Consistent Starship Ship splashdown target (~19°S 107°E), NW of Western Australia. IFT-11 and IFT-12 landed here. Future recovery ship staging area.' },
];


// ── Aircraft Database ─────────────────────────────────────────
// Keyed by registration. Polled live from airplanes.live every 60s.
const AIRCRAFT_DB = {
  'ZK-HEV': {
    name:'Rocket Lab Capture Helicopter', abbr:'ZK-HEV',
    operator:'Rocket Lab', role:'Electron mid-air recovery',
    model:'Sikorsky S-92A', type:'helicopter',
    notes:'Operated by Advanced Flight Ltd on behalf of Rocket Lab. Used for mid-air catch of Electron first stage off Māhia Peninsula, NZ.',
  },
  'N628TS': {
    name:'SpaceX Gulfstream G650ER', abbr:'N628TS',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G650ER', type:'jet',
    notes:'Registered to Falcon Landing LLC. Primary SpaceX executive jet. N628 = June 28 (Elon birthday).',
  },
  'N272BG': {
    name:'SpaceX Gulfstream G550 (I)', abbr:'N272BG',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G550', type:'jet',
    notes:'Registered to Falcon Landing LLC.',
  },
  'N502SX': {
    name:'SpaceX Gulfstream G550 (II)', abbr:'N502SX',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G550', type:'jet',
    notes:'Registered to Falcon Landing LLC.',
  },
  'N8628': {
    name:'SpaceX Gulfstream G800', abbr:'N8628',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G800', type:'jet',
    notes:'Acquired 2025. Registered to Falcon Landing LLC. Most capable in fleet.',
  },
  'N154TS': {
    name:'SpaceX Boeing 737-800', abbr:'N154TS',
    operator:'SpaceX', role:'Personnel transport',
    model:'Boeing 737-800', type:'jet',
    notes:'Narrow-body airliner for shuttling engineers and personnel between SpaceX sites. Custom SpaceX livery.',
  },
  'N152QS': {
    name:'SpaceX Gulfstream G450', abbr:'N152QS',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G450', type:'jet',
    notes:'Heavy business jet for fast point-to-point transit.',
  },
  // ── NASA ─────────────────────────────────────────────────────
  'N926NA': {
    name:'NASA WB-57F (926)', abbr:'WB-57 926',
    operator:'NASA', role:'High-altitude launch observation',
    model:'Martin WB-57F', type:'research',
    notes:'Based at Ellington Field (JSC), Houston, TX. Flies at 60,000ft+ to observe launches, re-entries, and atmospheric phenomena. Used for Shuttle, SLS, Starship coverage. WAVE camera in nose.',
  },
  'N927NA': {
    name:'NASA WB-57F (927)', abbr:'WB-57 927',
    operator:'NASA', role:'High-altitude launch observation',
    model:'Martin WB-57F', type:'research',
    notes:'Based at Ellington Field (JSC). Sister ship to N926NA. Occasionally deployed to Vandenberg or overseas for mission support.',
  },
  'N928NA': {
    name:'NASA WB-57F (928)', abbr:'WB-57 928',
    operator:'NASA', role:'High-altitude research',
    model:'Martin WB-57F', type:'research',
    notes:'Third NASA WB-57F. Based at Ellington Field (JSC). Shares launch observation role with 926/927.',
  },
  'N806NA': {
    name:'NASA ER-2 (806)', abbr:'ER-2 806',
    operator:'NASA', role:'High-altitude research',
    model:'Lockheed ER-2', type:'research',
    notes:'Based at Armstrong AFRC, Edwards AFB, CA. Civilian U-2 variant. Flies at 70,000ft for atmospheric research and Earth observation. Occasionally repositions near launch corridors.',
  },
  'N809NA': {
    name:'NASA ER-2 (809)', abbr:'ER-2 809',
    operator:'NASA', role:'High-altitude research',
    model:'Lockheed ER-2', type:'research',
    notes:'Sister ship to N806NA. Based at Armstrong AFRC, Edwards AFB.',
  },
  'N817NA': {
    name:'NASA DC-8 Flying Lab', abbr:'DC-8 817',
    operator:'NASA', role:'Airborne science platform',
    model:'Douglas DC-8-72', type:'research', background:true,
    notes:'Based at Armstrong AFRC. Four-engine jet used as airborne science platform; carries instruments for atmospheric and Earth-observation campaigns. Occasionally supports launch range coverage.',
  },
  // ── Stratolaunch ─────────────────────────────────────────────
  'N351SL': {
    name:'Stratolaunch Roc', abbr:'Roc',
    operator:'Stratolaunch', role:'Hypersonic test vehicle carrier',
    model:'Stratolaunch Model 351', type:'carrier', background:true,
    notes:'World\'s largest aircraft by wingspan (117m). Twin-fuselage, 6-engine carrier for Talon-A reusable hypersonic test vehicle. Operates from Mojave Air & Space Port. Air-launches Talon-A from ~35,000ft over Pacific test range.',
  },
  // ── Northrop Grumman ─────────────────────────────────────────
  'N140SC': {
    name:'Northrop L-1011 Star Gazer', abbr:'Star Gazer',
    operator:'Northrop Grumman', role:'Pegasus XL air-launch carrier',
    model:'Lockheed L-1011 TriStar', type:'carrier', background:true,
    notes:'Modified L-1011 widebody. Carries Pegasus XL rocket attached beneath fuselage; drops at ~40,000ft altitude over ocean for orbital launches. Based at Vandenberg SFB. Operator: Northrop Grumman Launch & Targeting Systems.',
  },
  // ── Virgin Galactic ──────────────────────────────────────────
  'N348MS': {
    name:'VMS Eve', abbr:'VMS Eve',
    operator:'Virgin Galactic', role:'SpaceShipTwo mothership',
    model:'Scaled Composites White Knight Two', type:'carrier', background:true,
    notes:'Four-engine carrier aircraft for VSS Unity (SpaceShipTwo). Lifts Unity to ~50,000ft over Mojave Desert for rocket motor ignition. Currently grounded while Virgin Galactic develops Delta-class spacecraft. Based at Mojave Air & Space Port.',
  },
};

const OP_COLORS = { 'SpaceX':'#00d4ff', 'Blue Origin':'#4477ff', 'Rocket Lab':'#ff3355', 'ULA':'#ff9900', 'ESA':'#9933ff', 'The Spaceport Company':'#00cc88', 'US Space Force Range':'#aabb00', 'NASA Recovery':'#3399ff', 'NASA':'#ff6600', 'CNSA':'#ff4444', 'Stratolaunch':'#cc44ff', 'Northrop Grumman':'#dd8800', 'Virgin Galactic':'#2277ff' };
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

// ── Spacecraft TLE matching ───────────────────────────────────
// longterm:true → only shown when SPACECRAFT toggle is ON
// longterm:false → always visible (active missions)
// Patterns are precise to avoid debris objects ("ISS DEB", "ISS OBJECT XY", etc.)
const SPACECRAFT_PATTERNS = [
  { match:n=>n==='ISS (ZARYA)',                           abbr:'ISS',      operator:'NASA',             role:'Space Station',     col:'#00aaff', longterm:true  },
  { match:n=>n==='CSS (TIANHE)',                          abbr:'Tiangong', operator:'CNSA',             role:'Space Station',     col:'#ff4444', longterm:true  },
  { match:n=>/^SOYUZ-MS \d/.test(n),                     abbr:'Soyuz',    operator:'Roscosmos',        role:'Crewed spacecraft', col:'#9966ff', longterm:true  },
  { match:n=>/^PROGRESS-MS \d/.test(n),                  abbr:'Progress', operator:'Roscosmos',        role:'Cargo spacecraft',  col:'#9966ff', longterm:true  },
  { match:n=>/^SHENZHOU-\d/.test(n),                     abbr:'Shenzhou', operator:'CNSA',             role:'Crewed spacecraft', col:'#ff6644', longterm:true  },
  { match:n=>/^TIANZHOU-\d/.test(n),                     abbr:'Tianzhou', operator:'CNSA',             role:'Cargo spacecraft',  col:'#ff6644', longterm:true  },
  { match:n=>/^CREW DRAGON\b/.test(n)&&!/DEB/i.test(n), abbr:'Dragon',   operator:'SpaceX',           role:'Crewed capsule',    col:'#00d4ff', longterm:false },
  { match:n=>/^DRAGON CRS-\d/.test(n),                   abbr:'Dragon',   operator:'SpaceX',           role:'Cargo capsule',     col:'#00d4ff', longterm:false },
  { match:n=>/^CYGNUS NG-\d/.test(n),                    abbr:'Cygnus',   operator:'Northrop Grumman', role:'Cargo spacecraft',  col:'#dd8800', longterm:false },
  { match:n=>/^HTV-\d/.test(n),                          abbr:'HTV',      operator:'JAXA',             role:'Cargo spacecraft',  col:'#ffcc00', longterm:false },
];

// ── Launch pad coordinates ────────────────────────────────────
const LAUNCH_PADS = {
  'lc39a':    { lat:28.608, lon:-80.604 },
  'slc40':    { lat:28.562, lon:-80.577 },
  'slc4e':    { lat:34.632, lon:-120.611 },
  'starbase': { lat:25.997, lon:-97.159 },
  'mahia':    { lat:-39.262,lon:177.864 },
  'lc36':     { lat:28.467, lon:-80.537 }, // New Glenn LC-36
  'kourou':   { lat:5.239,  lon:-52.768 },
};

// ── Booster projection profiles ───────────────────────────────
const BOOSTER_PROFILES = {
  'Falcon 9': {
    boosterSecs: 480,                           // T+8min to drone ship
    // drone ship MMSI looked up from live AIS at runtime
  },
  'Falcon Heavy': {
    boosterSecs: 480,
  },
  'Starship': {
    boosterSecs: 430,                           // T+7:10 to Mechazilla
    boosterTarget: { lat:25.997, lon:-97.159 }, // Mechazilla
    shipSecs: 4800,                             // T+80min to Indian Ocean
    shipTarget: { lat:-19.0, lon:107.0 },
  },
  'New Glenn': {
    boosterSecs: 480,
    boosterMMSI: '368368960',                   // Jacklyn
  },
  'Electron': {
    boosterSecs: 150,                           // ~T+2:30 sep, falls in ocean
    boosterMMSI: '512440000',                   // Seaworker approximate zone
  },
};

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
