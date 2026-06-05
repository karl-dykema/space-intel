'use strict';

// ── Vessel Database ──────────────────────────────────────────
const VESSEL_DB = {
  // ── SpaceX ──────────────────────────────────────────────────
  // You'll Thank Me Later — MMSI TBD (Marmac 31, under construction at Port of Brownsville, TX)
  // '???': {
  //   name:"You'll Thank Me Later", abbr:'YTML',
  //   operator:'SpaceX', role:'Autonomous Spaceport Drone Ship',
  //   color:'#00d4ff', homePort:'Port of Brownsville, TX',
  //   specs:{ type:'Self-propelled barge (ASDS)', hull:'Marmac 31' },
  //   history:[
  //     'Named after a ship in Iain M. Banks\' Culture novel series',
  //     'Spotted at Port of Brownsville, TX — under construction / fitting out as of 2026',
  //     'Likely designated for Starship program or additional Falcon 9 capacity',
  //   ],
  //   notes:'MMSI not yet confirmed — search MarineTraffic for "Marmac 31" at Port of Brownsville. Add MMSI when known.',
  // },
  '368219910': {
    name:'A Shortfall of Gravitas', abbr:'ASOG',
    operator:'SpaceX', role:'Autonomous Spaceport Drone Ship',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    imo:'9869052', flag:'USA', built:2020, verified:true,
    photo:'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/SpaceX_Falcon_9_Booster_B1060-10-01-22_%2851837166644%29.jpg/480px-SpaceX_Falcon_9_Booster_B1060-10-01-22_%2851837166644%29.jpg',
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
    photo:'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/CRS-8_%2826239020092%29.jpg/480px-CRS-8_%2826239020092%29.jpg',
    specs:{ length:'91m', beam:'52m', type:'Self-propelled barge (ASDS)', propulsion:'4 diesel thrusters' },
    history:[
      'Pacific ASDS for all Vandenberg SFB (SLC-4E) Falcon 9 launches',
      'First Falcon 9 booster landing at sea: April 8 2016 (CRS-8)',
      'Named after a ship in Iain M. Banks\' Culture novel series',
      'Converted from Marmac 304 barge in 2015 (AIS registry confirmed)',
      'Operates 300–700km off Baja California coast for Pacific recovery zone',
      'Booster catch: Starlink 17-41 — May 30 2026',
      'Booster landing: Starlink 17-47 — Jun 3 2026 (~15:42Z confirmed)',
      'Starlink 17-47 AIS coverage: OCISLY last ping ~12:50Z (~2h55m pre-launch); GO Beyond + Lindsay C last ping ~14:50Z (~50min pre-launch)',
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
    background:true,
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
      'Retired 2023 — replaced by Bob and Doug on East Coast, GO Beyond (MMSI 368237190) on West Coast',
    ],
    notes:'RETIRED 2023. IMO 8987876. [✓ MMSI confirmed]',
    background:true,
  },
  '369599000': {
    name:'Signet Warhorse I', abbr:'Warhorse I',
    operator:'SpaceX', role:'Support Tug (East Coast)',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    imo:'9254018', flag:'USA', verified:true,
    specs:{ type:'Ocean tug', operator:'Signet Maritime Corporation (contracted)' },
    history:[
      'Operated by Signet Maritime Corporation, contracted to SpaceX',
      'Provides towing and escort services for ASOG on Atlantic deployments',
    ],
    notes:'East Coast ASOG support tug. IMO 9254018. [✓ MMSI]',
    background:true,
  },
  '366885000': {
    name:'Signet Warhorse II', abbr:'Warhorse II',
    operator:'SpaceX', role:'Support Tug (East Coast)',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    imo:'9388132', flag:'USA', built:2008, verified:true,
    specs:{ length:'46m', beam:'14m', grossTonnage:'1,085 GT', deadweight:'1,025 DWT', type:'Anchor handling tug', operator:'Signet Maritime Corporation (contracted)' },
    history:[
      'Operated by Signet Maritime Corporation, contracted to SpaceX',
      'Anchor handling / escort tug for ASOG Atlantic deployments',
    ],
    notes:'East Coast ASOG anchor handling tug. IMO 9388132. [✓ MMSI]',
    background:true,
  },
  '368448940': {
    name:'Christine S', abbr:'Christine S',
    operator:'SpaceX', role:'Support Tug (East Coast)',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    flag:'USA', verified:false,
    specs:{ type:'Harbor tug' },
    history:[
      'Harbor tug active at Port Canaveral near SpaceX assets — operator unconfirmed',
    ],
    notes:'Port Canaveral tug, likely SpaceX support. [? operator unconfirmed]',
    background:true,
  },
  '366888850': {
    name:'Lindsay C', abbr:'Lindsay C',
    operator:'SpaceX', role:'Support Tug (West Coast)',
    color:'#00d4ff', homePort:'Port of Long Beach, CA',
    imo:'7507382', flag:'USA', verified:false,
    specs:{ type:'Harbor tug' },
    history:[
      'Harbor tug operating near OCISLY and West Coast SpaceX assets',
    ],
    notes:'West Coast SpaceX support tug — seen with OCISLY. IMO 7507382. [? operator unconfirmed]',
    background:true,
  },
  '367027570': {
    name:'Debra C', abbr:'Debra C',
    operator:'SpaceX', role:'Droneship Tug (West Coast)',
    color:'#00d4ff', homePort:'Port of Long Beach, CA',
    imo:'7129817', flag:'USA', built:1971, verified:true,
    specs:{ length:'43.9m', beam:'10.4m', power:'3,900 HP', type:'Ocean tug' },
    history:[
      'Built 1971; acquired by Curtin Maritime Corporation 2022',
      'Chartered by SpaceX for West Coast OCISLY towing operations since 2024',
      'Primary tug for moving OCISLY between Port Hueneme and deployment zones',
    ],
    notes:'West Coast OCISLY primary tow tug. Curtin Maritime / SpaceX chartered 2024. IMO 7129817. [✓ MMSI]',
    background:true,
  },
  '367309720': {
    name:'Gretchen C', abbr:'Gretchen C',
    operator:'SpaceX', role:'Support Tug (West Coast)',
    color:'#00d4ff', homePort:'Port of Long Beach, CA',
    imo:'8206882', flag:'USA', built:1983, verified:false,
    specs:{ length:'29m', beam:'9m', power:'3,000 HP', type:'Harbor/ocean tug' },
    history:[
      'Built 1983 as Navasota; renamed Nohea; acquired by Curtin Maritime 2019 as Gretchen C',
      'Repowered 2025 with twin Cummins QSK380-M2 Tier IV engines',
      'Curtin Maritime provides tugs and barges to SpaceX West Coast ops',
    ],
    notes:'West Coast SpaceX support tug (Curtin Maritime). Seen near OCISLY/flotilla. IMO 8206882. [? SpaceX role unconfirmed]',
    background:true,
  },
  '368237190': {
    name:'GO Beyond', abbr:'GO Beyond',
    operator:'SpaceX', role:'Droneship Support (West Coast)',
    color:'#00d4ff', homePort:'Port of Long Beach, CA',
    imo:'9622655', flag:'USA', verified:true,
    specs:{ type:'Multi-purpose offshore vessel' },
    history:[
      'Operated by GO Maritime (Edison Chouest Offshore subsidiary) for SpaceX',
      'Replaced GO Quest as primary West Coast OCISLY support vessel in 2023',
      'Supports OCISLY deployments from Vandenberg SFB (SLC-4E)',
      'Deploys with OCISLY for every West Coast booster landing — loses terrestrial AIS ~300km offshore',
    ],
    notes:'West Coast OCISLY support vessel. Replaced GO Quest 2023. IMO 9622655. [✓ MMSI]',
  },
  // ── Blue Origin ──────────────────────────────────────────────
  '368368960': {
    name:'LPV-1 (Jacklyn)', abbr:'Jacklyn',
    operator:'Blue Origin', role:'New Glenn Landing Platform',
    color:'#4477ff', homePort:'Port Canaveral, FL',
    imo:'9998676', flag:'USA', built:2024, verified:true,
    specs:{ length:'115m', beam:'45m', grossTonnage:'13,818 GT', type:'Landing Platform Vessel', propulsion:'Dynamic positioning thrusters' },
    history:[
      'AIS name: LPV-1 (Launch Platform Vessel 1); informally known as Jacklyn',
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
    background:true,
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
  // Return on Investment — MMSI TBD (being converted from Oceanus at Bollinger, LA)
  // '???': {
  //   name:'Return On Investment', abbr:'ROI',
  //   operator:'Rocket Lab', role:'Neutron Landing Platform',
  //   color:'#ff3355', homePort:'TBD',
  //   notes:'120m landing barge for Neutron first-stage recovery. Converted from offshore barge Oceanus at Bollinger Shipbuilding, Louisiana. MMSI not yet assigned. Add MMSI when vessel is commissioned.',
  // },
  '367586250': {
    name:'Finn Falgout', abbr:'Finn Falgout',
    operator:'SpaceX', role:'Support Tug (East Coast)',
    color:'#00d4ff', homePort:'Port Canaveral, FL',
    imo:'7390765', flag:'USA', verified:true,
    specs:{ type:'Ocean tug' },
    history:[
      'Primary tugboat used by SpaceX to tow ASOG to and from Atlantic landing zones',
    ],
    notes:'Primary SpaceX East Coast drone ship tug. IMO 7390765. [✓ confirmed]',
    background:true,
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
  { id:'starfall_pac', name:'Starfall Reentry Zone (Pacific)',   minLat:22.0,  maxLat:37.0,  minLon:-138.0,maxLon:-120.0, roles:['recovery'] },
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

  // ── Starbase — additional facilities ────────────────────────
  { id:'starbase_build',  lat:26.017,  lon:-97.156,  name:'Starbase — Production & Tank Farm', type:'facility', desc:'SpaceX Starbase main production area. Starship and Super Heavy sections are fabricated, stacked, and tested here before rollout to the OLM.' },
  { id:'boca_chica_village',lat:25.973,lon:-97.207,  name:'Boca Chica Village (SpaceX)',     type:'facility', desc:'Former beach community leased by SpaceX. Worker housing and support facilities for Starbase operations.' },

  // ── SpaceX facilities ─────────────────────────────────────────
  { id:'spacex_hq',       lat:33.920,  lon:-118.328, name:'SpaceX HQ — Hawthorne, CA',       type:'facility', desc:'SpaceX headquarters and primary manufacturing. Falcon 9/Heavy integration, Dragon production, Merlin engine assembly.' },
  { id:'spacex_mcgregor',  lat:31.404,  lon:-97.453,  name:'SpaceX Rocket Engine Test — McGregor, TX', type:'facility', desc:'SpaceX Rocket Development and Test Facility. All Merlin and Raptor engines are acceptance-tested here before delivery.' },
  { id:'spacex_redmond',  lat:47.673,  lon:-122.109, name:'SpaceX Redmond — Starlink',       type:'facility', desc:'SpaceX Redmond Development Center. Starlink satellite design, manufacturing, and testing.' },
  { id:'spacex_seattle',  lat:47.624,  lon:-122.336, name:'SpaceX Seattle (Legacy)',          type:'facility', desc:'Original Starlink office. Consolidated into Redmond campus.' },

  // ── Cape Canaveral / KSC ─────────────────────────────────────
  { id:'lc39a',           lat:28.608,  lon:-80.604,  name:'LC-39A (SpaceX)',                 type:'launch',   desc:'Apollo-era pad leased by SpaceX. Falcon 9, Falcon Heavy, future Starship East.' },
  { id:'lc39b',           lat:28.627,  lon:-80.621,  name:'LC-39B (NASA — SLS/Artemis)',     type:'launch',   desc:'NASA Space Launch System pad. Used for Artemis crewed lunar missions. Originally Apollo, then Shuttle Pad B.' },
  { id:'lc40',            lat:28.562,  lon:-80.577,  name:'SLC-40 (SpaceX)',                 type:'launch',   desc:'Primary Falcon 9 workhorse pad at Cape Canaveral SFS.' },
  { id:'lz1',             lat:28.485,  lon:-80.545,  name:'LZ-1 — Falcon RTLS (SpaceX)',    type:'launch',   desc:'Landing Zone 1 at Cape Canaveral SFS. Booster return-to-launch-site landing pad for LC-39A / SLC-40 missions. Former SLC-13.' },
  { id:'lz2',             lat:28.486,  lon:-80.543,  name:'LZ-2 — Falcon Heavy RTLS',       type:'launch',   desc:'Landing Zone 2 adjacent to LZ-1. Used for Falcon Heavy side-booster simultaneous landings.' },
  { id:'vab',             lat:28.586,  lon:-80.650,  name:'VAB — Vehicle Assembly Building', type:'facility', desc:'NASA\'s iconic 160m tall assembly building. Artemis/SLS stack assembly. One of the largest buildings by volume on Earth.' },
  { id:'slc41',           lat:28.583,  lon:-80.583,  name:'SLC-41 (ULA)',                    type:'launch',   desc:'United Launch Alliance Vulcan Centaur pad. Atlas V retired here after 100 launches.' },
  { id:'slc37b',          lat:28.532,  lon:-80.567,  name:'SLC-37B (ULA)',                   type:'launch',   desc:'ULA Delta IV Heavy pad. Last Delta IV Heavy launch April 2024.' },
  { id:'lc36',            lat:28.467,  lon:-80.537,  name:'LC-36 (Blue Origin)',             type:'launch',   desc:'Blue Origin New Glenn orbital launch pad. Former Atlas Centaur site, rebuilt 2024.' },
  { id:'slc46',           lat:28.457,  lon:-80.528,  name:'SLC-46 (Firefly / DoD)',          type:'launch',   desc:'Multi-user pad. Firefly Alpha, potential DoD missions.' },
  { id:'ksc_visitor',     lat:28.522,  lon:-80.682,  name:'KSC Visitor Complex',             type:'facility', desc:'Public entrance to KSC — Apollo/Saturn V Center, shuttle Atlantis, paid launch viewing.' },
  { id:'space_view_park', lat:28.606,  lon:-80.805,  name:'Space View Park, Titusville',     type:'viewing',  desc:'Best free public viewing, 12 mi from pads. Riverside park with PA feed during launches.' },
  { id:'jetty_park',      lat:28.407,  lon:-80.592,  name:'Jetty Park',                      type:'viewing',  desc:'Port Canaveral beachfront. Eastern angle on the pads, cruise ships for scale.' },
  { id:'playalinda',      lat:28.655,  lon:-80.632,  name:'Playalinda Beach',                type:'viewing',  desc:'Canaveral National Seashore — closest public beach to LC-39. Often gated on launch days.' },
  { id:'banana_creek',    lat:28.605,  lon:-80.669,  name:'Banana Creek Viewing (KSC)',      type:'viewing',  desc:'Paid KSC bleacher seating 3.9 mi from pads. Best close-up view available to public.' },

  // ── ULA facilities ────────────────────────────────────────────
  { id:'ula_decatur',     lat:34.665,  lon:-87.019,  name:'ULA Manufacturing — Decatur, AL', type:'facility', desc:'United Launch Alliance rocket manufacturing plant. Atlas V, Delta IV, and Vulcan Centaur produced here. RocketShip loads from adjacent river port.' },
  { id:'ula_hq',          lat:39.572,  lon:-104.851, name:'ULA HQ — Centennial, CO',         type:'facility', desc:'United Launch Alliance headquarters.' },

  // ── Vandenberg SFB ───────────────────────────────────────────
  { id:'slc4e',           lat:34.633,  lon:-120.613, name:'SLC-4E (SpaceX)',                 type:'launch',   desc:'SpaceX Falcon 9 / Falcon Heavy west coast pad. Polar and sun-synchronous orbit missions.' },
  { id:'slc3e',           lat:34.644,  lon:-120.589, name:'SLC-3E (ULA)',                    type:'launch',   desc:'ULA Atlas V west coast pad. Used for NRO, GPS, and government payloads. Being decommissioned after Vulcan transition.' },
  { id:'slc6',            lat:34.576,  lon:-120.623, name:'SLC-6 (SpaceX future)',            type:'launch',   desc:'Former Shuttle West pad. Being rebuilt by SpaceX for Falcon 9 / future west coast operations.' },
  { id:'slc2w',           lat:34.754,  lon:-120.627, name:'SLC-2W (defunct)',                type:'launch',   desc:'Former Delta II pad. Retired 2018.' },
  { id:'jalama_beach',    lat:34.512,  lon:-120.503, name:'Jalama Beach',                    type:'viewing',  desc:'Santa Barbara County park. Nearest legal public viewing of Vandenberg launches, ~12 mi.' },
  { id:'lompoc_viewing',  lat:34.624,  lon:-120.447, name:'W. Ocean Ave, Lompoc',            type:'viewing',  desc:'Common roadside viewing corridor near base perimeter for SLC launches.' },

  // ── Stoke Space ───────────────────────────────────────────────
  { id:'stoke_auburn',    lat:47.290,  lon:-122.218, name:'Stoke Space — Auburn, WA',         type:'facility', desc:'Stoke Space Technologies HQ and test facility. Developing Nova, a fully reusable two-stage rocket. Hot-fire tests of upper stage thruster here.' },

  // ── Relativity Space ─────────────────────────────────────────
  { id:'relativity_lb',   lat:33.768,  lon:-118.188, name:'Relativity Space — Long Beach, CA',type:'facility', desc:'Relativity Space headquarters. Terran R development (fully reusable, F9-class). Stargate 3D-printing production.' },
  { id:'relativity_slc16',lat:28.502,  lon:-80.561,  name:'SLC-16 (Relativity / Terran R)',   type:'launch',   desc:'Cape Canaveral SFS pad leased by Relativity for Terran R orbital launches. Former Pershing II missile test site.' },

  // ── Firefly Aerospace ─────────────────────────────────────────
  { id:'firefly_hq',      lat:30.479,  lon:-97.829,  name:'Firefly Aerospace — Cedar Park, TX',type:'facility',desc:'Firefly Aerospace HQ and production. Alpha small launcher, Miranda engine, Elytra in-space vehicle development.' },
  { id:'firefly_slc20',   lat:28.526,  lon:-80.555,  name:'SLC-20 (Firefly Alpha)',            type:'launch',   desc:'Cape Canaveral SFS Firefly Alpha east coast pad. Former Pershing II site. First operational launch 2023.' },

  // ── ABL Space ─────────────────────────────────────────────────
  { id:'abl_hq',          lat:34.631,  lon:-120.609, name:'ABL Space — Vandenberg (SLC-576)',  type:'launch',   desc:'ABL Space Systems RS1 test launches at Vandenberg. Compact orbital launcher targeting rapid-cadence small sat deployment.' },

  // ── UK / North Atlantic spaceports ───────────────────────────
  { id:'saxavord',        lat:60.820,  lon:-0.833,   name:'SaxaVord Spaceport — Shetland',    type:'launch',   desc:'UK\'s first operational vertical launch site on Unst, Shetland Islands. High-inclination polar orbit access. Orbex Prime targeting first UK orbital launch.' },
  { id:'sutherland',      lat:58.516,  lon:-4.028,   name:'Spaceport Sutherland — Scotland',  type:'launch',   desc:'Scottish mainland launch site. Orbex and Highland & Islands Enterprise. Horizontal and vertical launch development.' },
  { id:'spaceport_cornwall',lat:50.440,lon:-5.004,   name:'Spaceport Cornwall — Newquay',     type:'launch',   desc:'Horizontal launch site. Virgin Orbit attempted first UK orbital launch Jan 2023 — failed at upper stage ignition. Future operators TBD.' },

  // ── Blue Origin facilities ────────────────────────────────────
  { id:'bo_kent',         lat:47.398,  lon:-122.233, name:'Blue Origin HQ — Kent, WA',       type:'facility', desc:'Blue Origin headquarters and manufacturing. New Glenn, New Shepard, BE-4 engine production.' },
  { id:'bo_van_horn',     lat:31.413,  lon:-104.757, name:'Blue Origin — Van Horn, TX',       type:'launch',   desc:'New Shepard suborbital launch site. West Texas desert. Crew capsule parachute landings nearby.' },
  { id:'bo_huntsville',   lat:34.729,  lon:-86.585,  name:'Blue Origin Engine — Huntsville, AL', type:'facility', desc:'BE-4 engine test facility adjacent to NASA Marshall. Engines for New Glenn and ULA Vulcan.' },

  // ── Rocket Lab facilities ─────────────────────────────────────
  { id:'rl_hq',           lat:33.775,  lon:-118.195, name:'Rocket Lab HQ — Long Beach, CA',  type:'facility', desc:'Rocket Lab global headquarters and spacecraft manufacturing. Neutron rocket development. Photon spacecraft production.' },
  { id:'rl_wallops',      lat:37.833,  lon:-75.488,  name:'Rocket Lab LC-2 — Wallops, VA',   type:'launch',   desc:'Rocket Lab\'s east coast Electron launch site at MARS (Mid-Atlantic Regional Spaceport). Active since 2023. Supports US government/NRO missions.' },
  { id:'wallops_pad',     lat:37.940,  lon:-75.466,  name:'Wallops Flight Facility (NASA/NG)',type:'launch',   desc:'NASA / Northrop Grumman Antares pad. Cygnus cargo missions to ISS. Also Minotaur small orbital launcher.' },
  { id:'wallops_visitor', lat:37.939,  lon:-75.456,  name:'NASA Wallops Visitor Center',     type:'facility', desc:'Free NASA visitor center with exhibits. Open on launch days for viewing.' },

  // ── Rocket Lab Māhia, NZ ─────────────────────────────────────
  { id:'rl_lc1',          lat:-39.262, lon:177.865,  name:'Rocket Lab LC-1 (Māhia)',        type:'launch',   desc:'Rocket Lab Electron primary launch complex. World\'s first private orbital launch site, operational since 2017.' },
  { id:'mahia_lookout',   lat:-39.200, lon:177.900,  name:'Māhia Peninsula Lookout',        type:'viewing',  desc:'Public scenic reserve with view over launch complex.' },

  // ── Other commercial spaceports ───────────────────────────────
  { id:'mojave',          lat:34.981,  lon:-118.151, name:'Mojave Air & Space Port',         type:'launch',   desc:'First FAA-licensed spaceport for horizontal launches. Stratolaunch Roc operations. Virgin Galactic, Scaled Composites, many test programs.' },
  { id:'spaceport_america',lat:32.990, lon:-106.968, name:'Spaceport America — NM',          type:'launch',   desc:'Virgin Galactic primary gateway. SpaceShipTwo horizontal runway launches. World\'s first purpose-built commercial spaceport.' },
  { id:'kwajalein',       lat:9.048,   lon:167.739,  name:'Reagan Test Site — Kwajalein',    type:'launch',   desc:'Marshall Islands atoll. Historic SpaceX Falcon 1 launch site (first orbital success 2008). Now US Army missile defense test range.' },

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
  { id:'andoya',          lat:69.294,  lon:16.020,   name:'Andøya Space Center',             type:'launch',   desc:'Norwegian launch site above Arctic Circle. Sounding rockets since 1962; targeting small orbital launches. Isar Aerospace SLC-1 under construction.' },
  { id:'esrange',         lat:67.886,  lon:21.063,   name:'Esrange Space Center',            type:'launch',   desc:'Swedish sounding rocket and balloon facility above Arctic Circle. Small orbital ambitions.' },
  { id:'psca_kodiak',     lat:57.436,  lon:-152.338, name:'Pacific Spaceport Complex — Alaska', type:'launch', desc:'Kodiak Island, AK. FAA-licensed orbital spaceport. Astra launches, government payloads. Polar and sun-sync orbit access.' },
  { id:'poker_flat',      lat:65.126,  lon:-147.473, name:'Poker Flat Research Range',        type:'launch',   desc:'University of Alaska Fairbanks / NASA sounding rocket range. Highest-latitude launch range in the US. Aurora/ionospheric research.' },
  { id:'woomera',         lat:-31.130, lon:136.816,  name:'Woomera Test Range',              type:'launch',   desc:'Australia\'s primary rocket range. Historic British test site; now multi-user range.' },
  { id:'alcantara',       lat:-2.373,  lon:-44.396,  name:'Alcântara Launch Center',         type:'launch',   desc:'Brazilian near-equatorial spaceport. VLM rocket. Favorable orbital insertion economics.' },
  { id:'starship_io_zone',lat:-19.0,  lon:107.0,    name:'Starship Indian Ocean Landing Zone',type:'viewing',  desc:'Consistent Starship Ship splashdown target (~19°S 107°E), NW of Western Australia. IFT-11 and IFT-12 landed here. Future recovery ship staging area.' },

  // ── NASA Deep Space Network ───────────────────────────────────
  // Three complexes spaced ~120° apart for continuous deep-space coverage.
  { id:'dsn_goldstone',  lat:35.4258, lon:-116.8892, name:'DSN — Goldstone (GDSCC)',           type:'dsn',
    desc:'Goldstone Deep Space Communications Complex, Mojave Desert, CA. Largest DSN complex. 70m antenna (DSS-14 "Mars") + five 34m dishes. Supports Mars, Jupiter, Saturn missions and interstellar probes.',
    link:'https://www.gdscc.nasa.gov/' },
  { id:'dsn_madrid',     lat:40.4314, lon:-4.2481,   name:'DSN — Madrid (MDSCC)',              type:'dsn',
    desc:'Madrid Deep Space Communications Complex, Robledo de Chavela, Spain. Three 34m and one 70m dish. European coverage window for probes visible from 40°N.',
    link:'https://www.mdscc.nasa.gov/' },
  { id:'dsn_canberra',   lat:-35.4011,lon:148.9820,  name:'DSN — Canberra (CDSCC)',            type:'dsn',
    desc:'Canberra Deep Space Communications Complex, Tidbinbilla, Australia. Critical southern-hemisphere coverage — sole DSN contact for missions at low ecliptic latitudes. 70m DSS-43 is the only dish that can uplink to Voyager 1.',
    link:'https://www.cdscc.nasa.gov/' },
];


// ── Aircraft Database ─────────────────────────────────────────
// Keyed by registration. Polled live from airplanes.live every 60s.
const AIRCRAFT_DB = {
  'ZK-HEV': {
    name:'Rocket Lab Capture Helicopter', abbr:'ZK-HEV',
    operator:'Rocket Lab', role:'Electron mid-air recovery',
    model:'Sikorsky S-92A', type:'helicopter', background:true,
    notes:'Operated by Advanced Flight Ltd on behalf of Rocket Lab. Used for mid-air catch of Electron first stage off Māhia Peninsula, NZ.',
  },
  'N628TS': {
    name:'SpaceX Gulfstream G650ER', abbr:'N628TS',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G650ER', type:'jet', background:true,
    notes:'Registered to Falcon Landing LLC. Primary SpaceX executive jet. N628 = June 28 (Elon birthday).',
  },
  'N272BG': {
    name:'SpaceX Gulfstream G550 (I)', abbr:'N272BG',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G550', type:'jet', background:true,
    notes:'Registered to Falcon Landing LLC.',
  },
  'N502SX': {
    name:'SpaceX Gulfstream G550 (II)', abbr:'N502SX',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G550', type:'jet', background:true,
    notes:'Registered to Falcon Landing LLC.',
  },
  'N8628': {
    name:'SpaceX Gulfstream G800', abbr:'N8628',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G800', type:'jet', background:true,
    notes:'Acquired 2025. Registered to Falcon Landing LLC. Most capable in fleet.',
  },
  'N154TS': {
    name:'SpaceX Boeing 737-800', abbr:'N154TS',
    operator:'SpaceX', role:'Personnel transport',
    model:'Boeing 737-800', type:'jet', background:true,
    notes:'Narrow-body airliner for shuttling engineers and personnel between SpaceX sites. Custom SpaceX livery.',
  },
  'N152QS': {
    name:'SpaceX Gulfstream G450', abbr:'N152QS',
    operator:'SpaceX', role:'Executive transport',
    model:'Gulfstream G450', type:'jet', background:true,
    notes:'Heavy business jet for fast point-to-point transit.',
  },
  // ── NASA ─────────────────────────────────────────────────────
  'N810NA': {
    name:'NASA CV-990 Coronado (STORED)', abbr:'CV-990',
    operator:'NASA', role:'Research platform (RETIRED)',
    model:'Convair CV-990-30A-5 Coronado', type:'research', background:true,
    notes:'C/n 30-10-29. Used as high-speed research and Shuttle chase aircraft in the 1970s–80s. Spotted in storage at Mojave Mar 2024.',
  },
  'N747NA': {
    name:'NASA SOFIA (RETIRED)', abbr:'SOFIA',
    operator:'NASA', role:'Stratospheric infrared observatory (RETIRED 2022)',
    model:'Boeing 747SP-21', type:'research', background:true,
    notes:'C/n 21441 / ln 306. Stratospheric Observatory for Infrared Astronomy — 2.5m infrared telescope in fuselage. Deployed to Christchurch for Southern Hemisphere campaigns. Retired Sep 2022 after 10 years of science operations. Spotted Davis-Monthan boneyard Dec 2022.',
  },
  'N520NA': {
    name:'NASA Gulfstream C-20A', abbr:'NASA C-20A',
    operator:'NASA', role:'Executive / crew transport',
    model:'Gulfstream C-20A (G-1159A)', type:'jet', background:true,
    notes:'Ex-USAF serial 86-0206. Military C-20A (Gulfstream III) transferred to NASA. Based at NASA Ames, Moffett Federal Airfield. Confirmed active Apr 2023 (Moffett). [✓ confirmed]',
  },
  'N808NA': {
    name:'NASA Gulfstream III', abbr:'NASA GIII',
    operator:'NASA', role:'Research & executive transport',
    model:'Gulfstream III (G-III)', type:'jet', background:true,
    notes:'C/n 424. Multi-mission support and crew transport. Spotted Boise Oct 2021, Tucson Nov 2024. [✓ confirmed]',
  },
  'N95NA': {
    name:'NASA Gulfstream V', abbr:'NASA GV',
    operator:'NASA', role:'Crew & executive transport',
    model:'Gulfstream V (G-V)', type:'jet', background:true,
    notes:'Long-range crew transport — used for astronaut travel and executive missions. Spotted at Glasgow Prestwick Apr 2025 (transatlantic). [✓ confirmed]',
  },
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
    name:'NASA ER-2S (809)', abbr:'ER-2 809',
    operator:'NASA', role:'High-altitude research',
    model:'Lockheed ER-2S', type:'research',
    notes:'Ex-USAF serial 80-1097. Two-seat S-variant with enlarged sensor bay. Based at Armstrong AFRC, Edwards AFB. Spotted Palmdale/Plant 42 Nov 2021. [✓ confirmed]',
  },
  'N817NA': {
    name:'NASA DC-8 Flying Lab', abbr:'DC-8 817',
    operator:'NASA', role:'Airborne science platform',
    model:'McDonnell Douglas DC-8-72H', type:'research', background:true,
    notes:'C/n 46082 / ln 458. Based at Armstrong AFRC / NASA Ames (Moffett). Hush-kit four-engine jet used as airborne science platform for atmospheric and Earth-observation campaigns. Spotted Seoul Feb 2024, Moffett May 2024. [✓ confirmed]',
  },
  'N559NA': {
    name:'NASA X-59 QueSST', abbr:'X-59',
    operator:'NASA', role:'Quiet supersonic research',
    model:'Lockheed Martin X-59', type:'research',
    notes:'Based at Armstrong AFRC, Edwards AFB, CA. Quesst mission — demonstrating supersonic flight without a disruptive sonic boom. 99.7ft long, 29.5ft wingspan, GE F414 engine, Mach 1.5 max. First flight Oct 28 2025. Preparing for first supersonic flight June 2026. Registration N559NA — verify if not tracking.',
  },
  'N917NA': {
    name:'NASA T-38A Talon', abbr:'T-38 917',
    operator:'NASA', role:'Astronaut jet proficiency training',
    model:'Northrop T-38A(N) Talon', type:'research', background:true,
    notes:'C/n 5953. Based at Ellington Field (JSC), Houston, TX. Spotted Boise Nov 2023, Lakeland Apr 2026. [✓ confirmed]',
  },
  'N908NA': {
    name:'NASA T-38A Talon', abbr:'T-38 908',
    operator:'NASA', role:'Research support / proficiency training',
    model:'Northrop T-38A Talon', type:'research', background:true,
    notes:'USAF serial 65-10328. Based at NASA Ames, Moffett Federal Airfield. Confirmed active Oct 2023 (Moffett). [✓ confirmed]',
  },
  'N918NA': {
    name:'NASA T-38N Talon', abbr:'T-38 918',
    operator:'NASA', role:'Astronaut jet proficiency training',
    model:'Northrop T-38N Talon', type:'research', background:true,
    notes:'C/n 5954. Based at El Paso Forward Operating Location (FOL). Confirmed active Feb 2024 (El Paso). [✓ confirmed]',
  },
  'N960NA': {
    name:'NASA T-38A Talon', abbr:'T-38 960',
    operator:'NASA', role:'Astronaut jet proficiency training',
    model:'Northrop T-38A Talon', type:'research', background:true,
    notes:'C/n T6242. Based at Ellington Field (JSC), Houston, TX. Confirmed active Mar 2024 (Seattle Boeing Field). [✓ confirmed]',
  },
  'N966NA': {
    name:'NASA T-38A Talon', abbr:'T-38 966',
    operator:'NASA', role:'Astronaut jet proficiency training',
    model:'Northrop T-38A Talon', type:'research', background:true,
    notes:'C/n 5776. Based at El Paso FOL. Confirmed active Feb 2024 (El Paso). [✓ confirmed]',
  },
  'N963NA': {
    name:'NASA T-38A Talon', abbr:'T-38 963',
    operator:'NASA', role:'Astronaut jet proficiency training',
    model:'Northrop T-38A Talon', type:'research', background:true,
    notes:'USAF serial 59-1603. NASA Johnson Space Center. Based at Ellington Field (JSC), Houston, TX.',
  },
  'N967NA': {
    name:'NASA T-38A Talon', abbr:'T-38 967',
    operator:'NASA', role:'Astronaut jet proficiency training',
    model:'Northrop T-38A Talon', type:'research', background:true,
    notes:'C/n 5772. Based at Ellington Field (JSC), Houston, TX. Confirmed active Sep 2025 (Topeka Forbes Field). [✓ confirmed]',
  },
  'N941NA': {
    name:'NASA Super Guppy', abbr:'Super Guppy',
    operator:'NASA', role:'Oversized cargo transport',
    model:'Aero Spacelines 377SGT Super Guppy Turbine', type:'research', background:true,
    notes:'Transports large spacecraft components — Orion capsules, rocket segments, satellite hardware — between NASA centers. 156ft wingspan, 48ft tail height. Confirmed active Apr 2026 (Lakeland/Sun \'n Fun). [✓ confirmed]',
  },
  'N426NA': {
    name:'NASA P-3B Orion', abbr:'P-3 426',
    operator:'NASA', role:'Airborne science / Earth observation',
    model:'Lockheed P-3B Orion', type:'research', background:true,
    notes:'C/n 5175. Four-engine turboprop science platform. Based at Wallops Flight Facility or Armstrong AFRC. Confirmed active Jun 2024 (Ontario, CA). [✓ confirmed]',
  },
  // ── NASA (military serials — BuNo/USAF, not trackable via ADS-B reg lookup) ──
  '161521': {
    name:'NASA F/A-18A Hornet', abbr:'F/A-18 161521',
    operator:'NASA', role:'Research support',
    model:'McDonnell Douglas F/A-18A Hornet', type:'research', background:true,
    notes:'BuNo 161521 (C/n 38/A029). Based at NASA Ames, Moffett Federal Airfield. Confirmed active Nov 2024. Military bureau number — may not appear on civilian ADS-B.',
  },
  'N7NA': {
    name:'NASA King Air 200', abbr:'King Air 7',
    operator:'NASA', role:'Research / personnel transport',
    model:'Beechcraft Super King Air 200', type:'research', background:true,
    notes:'C/n BB-997. 1982. NASA Armstrong AFRC, Edwards AFB. Twin-engine turboprop used for research support and personnel transport.',
  },
  'N601NA': {
    name:'NASA S-3B Viking', abbr:'S-3B 601',
    operator:'NASA', role:'Airborne research',
    model:'Lockheed S-3B Viking', type:'research', background:true,
    notes:'NASA Glenn Research Center. Ex-US Navy carrier-based ASW aircraft converted for research.',
  },
  'N602NA': {
    name:'NASA T-34C Mentor', abbr:'T-34C 602',
    operator:'NASA', role:'Research / proficiency',
    model:'Beechcraft T-34C Turbo Mentor', type:'research', background:true,
    notes:'NASA Glenn Research Center.',
  },
  'N603NA': {
    name:'NASA T-34C Mentor', abbr:'T-34C 603',
    operator:'NASA', role:'Research / proficiency',
    model:'Beechcraft T-34C Turbo Mentor', type:'research', background:true,
    notes:'NASA Glenn Research Center.',
  },
  'N606NA': {
    name:'NASA Pilatus PC-12', abbr:'PC-12 606',
    operator:'NASA', role:'Research / personnel transport',
    model:'Pilatus PC-12', type:'research', background:true,
    notes:'NASA Glenn Research Center. 2008. Single-engine turboprop.',
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
    name:'L-1011 Star Gazer + Pegasus XL', abbr:'Star Gazer',
    operator:'Northrop Grumman', role:'Air-launch carrier / Pegasus XL orbital rocket',
    model:'Lockheed L-1011-100 TriStar', type:'carrier', background:true,
    photo:'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/U.S._Space_Force_successfully_launches_first_tactically_responsive_launch_mission_210613-F-XXZZZ-0001.jpg/480px-U.S._Space_Force_successfully_launches_first_tactically_responsive_launch_mission_210613-F-XXZZZ-0001.jpg',
    history:[
      'Built 1974; modified 1994 by Orbital Sciences as Pegasus XL air-launch platform',
      'Only airworthy L-1011 TriStar remaining in service (2026)',
      '39 Pegasus launches conducted carrying ~100 satellites as of 2021',
      'Pegasus XL: 3-stage solid rocket, 443 kg to LEO, released at ~39,000 ft over ocean',
      'Based at Vandenberg SFB (SLC-8); also operates from Cape Canaveral and Kwajalein',
    ],
    notes:'N140SC. Operator: Northrop Grumman Launch & Targeting Systems. Photo: US Space Force / public domain.',
  },
  // ── Jared Isaacman / Draken International (JDI Holdings LLC) ─
  'N82EM': {
    name:'Isaacman Global Express', abbr:'N82EM',
    operator:'Jared Isaacman', role:'Executive transport',
    model:'Bombardier Global Express', type:'jet', background:true,
    notes:'JDI Holdings LLC. Ultra-long-range business jet (2007). Isaacman: NASA Administrator nominee, Polaris Dawn commander, Draken co-founder.',
  },
  'N80EM': {
    name:'Isaacman Citation X', abbr:'N80EM',
    operator:'Jared Isaacman', role:'Executive transport',
    model:'Cessna Citation X', type:'jet', background:true,
    notes:'Isaacman\'s Cessna Citation X super-midsize business jet.',
  },
  'N51EM': {
    name:'Draken CitationJet', abbr:'N51EM',
    operator:'Draken International', role:'Light transport',
    model:'Cessna CitationJet', type:'jet', background:true,
    notes:'JDI Holdings LLC. 2012.',
  },
  'N29UB': {
    name:'Draken MiG-29UB', abbr:'MiG-29UB',
    operator:'Draken International', role:'Adversary air training',
    model:'Mikoyan-Gurevich MiG-29UB', type:'research', background:true,
    notes:'JDI Holdings LLC. 1989. Isaacman performed at EAA Oshkosh 2023 in this aircraft.',
  },
  'N229XX': {
    name:'Draken MiG-29UB', abbr:'N229XX',
    operator:'Draken International', role:'Adversary air training',
    model:'Mikoyan-Gurevich MiG-29UB', type:'research', background:true,
    notes:'JDI Holdings LLC.',
  },
  'N129XX': {
    name:'Draken MiG-29UB', abbr:'N129XX',
    operator:'Draken International', role:'Adversary air training',
    model:'Mikoyan-Gurevich MiG-29UB', type:'research', background:true,
    notes:'JDI Holdings LLC. 1986.',
  },
  'N136EM': {
    name:'Draken L-39 Albatros', abbr:'N136EM',
    operator:'Draken International', role:'Adversary air training',
    model:'Aero Vodochody L-39', type:'research', background:true,
    notes:'JDI Holdings LLC. 1984.',
  },
  'N135EM': {
    name:'Draken L-39ZA', abbr:'N135EM',
    operator:'Draken International', role:'Adversary air training',
    model:'Aero Vodochody L-39ZA', type:'research', background:true,
    notes:'JDI Holdings LLC. Armed variant. 1982.',
  },
  'N138EM': {
    name:'Draken L-39C', abbr:'N138EM',
    operator:'Draken International', role:'Adversary air training',
    model:'Aero Vodochody L-39C', type:'research', background:true,
    notes:'JDI Holdings LLC. 1978.',
  },
  'N137EM': {
    name:'Draken L-39C', abbr:'N137EM',
    operator:'Draken International', role:'Adversary air training',
    model:'Aero Vodochody L-39C', type:'research', background:true,
    notes:'JDI Holdings LLC. 1980.',
  },
  'N572AJ': {
    name:'Draken Alpha Jet', abbr:'N572AJ',
    operator:'Draken International', role:'Adversary air training',
    model:'Dornier/Dassault Alpha Jet', type:'research', background:true,
    notes:'JDI Holdings LLC. 1979.',
  },
  'N512XA': {
    name:'Draken Alpha Jet', abbr:'N512XA',
    operator:'Draken International', role:'Adversary air training',
    model:'Dornier/Dassault Alpha Jet', type:'research', background:true,
    notes:'JDI Holdings LLC. 1981.',
  },
  'N115AJ': {
    name:'Draken Alpha Jet', abbr:'N115AJ',
    operator:'Draken International', role:'Adversary air training',
    model:'Dornier/Dassault Alpha Jet', type:'research', background:true,
    notes:'JDI Holdings LLC. 1981.',
  },
  'N591EM': {
    name:'Draken F-5E Tiger II', abbr:'N591EM',
    operator:'Draken International', role:'Adversary air training',
    model:'Northrop F-5E Tiger II', type:'research', background:true,
    notes:'JDI Holdings LLC. 1977.',
  },
  'N592EM': {
    name:'Draken F-5F Tiger II', abbr:'N592EM',
    operator:'Draken International', role:'Adversary air training',
    model:'Northrop F-5F Tiger II', type:'research', background:true,
    notes:'JDI Holdings LLC. 1978.',
  },
  'N593EM': {
    name:'Draken F-5F Tiger II', abbr:'N593EM',
    operator:'Draken International', role:'Adversary air training',
    model:'Northrop F-5F Tiger II', type:'research', background:true,
    notes:'JDI Holdings LLC. 1979.',
  },
  // ── Tactical Air Support (TacAir) ────────────────────────────
  'N643TA': {
    name:'TacAir F-5F Tiger II', abbr:'N643TA',
    operator:'Tactical Air Support', role:'Adversary air training',
    model:'Northrop F-5F Tiger II', type:'research', background:true,
    notes:'Based at Reno, NV. Tactical Air Support (TacAir) — contract adversary air training for US military.',
  },
  // ── Virgin Galactic ──────────────────────────────────────────
  'N348MS': {
    name:'VMS Eve', abbr:'VMS Eve',
    operator:'Virgin Galactic', role:'SpaceShipTwo mothership',
    model:'Scaled Composites White Knight Two', type:'carrier', background:true,
    notes:'Four-engine carrier aircraft for VSS Unity (SpaceShipTwo). Lifts Unity to ~50,000ft over Mojave Desert for rocket motor ignition. Currently grounded while Virgin Galactic develops Delta-class spacecraft. Based at Mojave Air & Space Port.',
  },
};

const OP_COLORS = { 'SpaceX':'#00d4ff', 'Blue Origin':'#4477ff', 'Rocket Lab':'#ff3355', 'ULA':'#ff9900', 'ESA':'#9933ff', 'The Spaceport Company':'#00cc88', 'US Space Force Range':'#aabb00', 'NASA Recovery':'#3399ff', 'NASA':'#ff6600', 'CNSA':'#ff4444', 'Stratolaunch':'#cc44ff', 'Northrop Grumman':'#dd8800', 'Virgin Galactic':'#2277ff', 'Draken International':'#ff6600', 'Jared Isaacman':'#ff8833' };
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
  MISSIONS:     'space_intel_missions_v2',
  MISSIONS_PAST:'space_intel_missions_past_v2',
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
  'Space Launch System': [
    { t:0,          label:'T+0:00  SLS launch from LC-39B' },
    { t:126,        label:'T+2:06  SRB separation' },
    { t:495,        label:'T+8:15  Core stage separation' },
    { t:520,        label:'T+8:40  Orion/ICPS separation — trans-lunar coast begins' },
    { t:2*3600,     label:'~T+2h   Trans-Lunar Injection burn', highlight:true },
    { t:4*86400,    label:'~T+4d   Lunar orbit insertion', highlight:true },
    { t:21*86400,   label:'~T+21d  Orion reentry — Pacific splashdown', highlight:true },
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
  { match:n=>n==='ISS (ZARYA)',                           abbr:'ISS',      operator:'NASA',             role:'Space Station',        col:'#00aaff', longterm:true  },
  { match:n=>n==='CSS (TIANHE)',                          abbr:'Tianhe',   operator:'CNSA',             role:'Space Station Core',   col:'#ff4444', longterm:true  },
  { match:n=>n==='CSS (WENTIAN)',                         abbr:'Wentian',  operator:'CNSA',             role:'Space Station Module', col:'#ff4444', longterm:true  },
  { match:n=>n==='CSS (MENGTIAN)',                        abbr:'Mengtian', operator:'CNSA',             role:'Space Station Module', col:'#ff4444', longterm:true  },
  { match:n=>/^SOYUZ-MS \d/.test(n),                     abbr:'Soyuz',    operator:'Roscosmos',        role:'Crewed spacecraft',    col:'#9966ff', longterm:true  },
  { match:n=>/^PROGRESS-MS \d/.test(n),                  abbr:'Progress', operator:'Roscosmos',        role:'Cargo spacecraft',     col:'#9966ff', longterm:true  },
  { match:n=>/^SHENZHOU-\d/.test(n),                     abbr:'Shenzhou', operator:'CNSA',             role:'Crewed spacecraft',    col:'#ff6644', longterm:true  },
  { match:n=>/^TIANZHOU-\d/.test(n),                     abbr:'Tianzhou', operator:'CNSA',             role:'Cargo spacecraft',     col:'#ff6644', longterm:true  },
  { match:n=>/^CREW DRAGON\b/.test(n)&&!/DEB/i.test(n), abbr:'Dragon',   operator:'SpaceX',           role:'Crewed capsule',    col:'#00d4ff', longterm:false },
  { match:n=>/^DRAGON CRS-\d/.test(n),                   abbr:'Dragon',   operator:'SpaceX',           role:'Cargo capsule',     col:'#00d4ff', longterm:false },
  { match:n=>/^CYGNUS NG-\d/.test(n),                    abbr:'Cygnus',   operator:'Northrop Grumman', role:'Cargo spacecraft',  col:'#dd8800', longterm:false },
  { match:n=>/^HTV-\d/.test(n),                          abbr:'HTV',      operator:'JAXA',             role:'Cargo spacecraft',  col:'#ffcc00', longterm:false },
  { match:n=>/^ORION\b/i.test(n)&&!/DEB/i.test(n),      abbr:'Orion',    operator:'NASA',             role:'Crewed capsule',     col:'#ff6600', longterm:false },
];

// ── Launch pad coordinates ────────────────────────────────────
const LAUNCH_PADS = {
  'lc39a':    { lat:28.608, lon:-80.604 },
  'lc39b':    { lat:28.627, lon:-80.621 },
  'slc40':    { lat:28.562, lon:-80.577 },
  'slc4e':    { lat:34.632, lon:-120.611 },
  'starbase': { lat:25.997, lon:-97.159 },
  'mahia':      { lat:-39.262,lon:177.864 },
  'lc36':       { lat:28.467, lon:-80.537 }, // New Glenn LC-36
  'kourou':     { lat:5.239,  lon:-52.768 },
  'rl_wallops': { lat:37.833, lon:-75.488 }, // Rocket Lab LC-2, Wallops
  'sriharikota':{ lat:13.734, lon:80.235  }, // ISRO SHAR
  'baikonur':   { lat:45.920, lon:63.342  }, // Baikonur Cosmodrome
  'vostochny':  { lat:51.884, lon:128.333 }, // Vostochny Cosmodrome
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

// ── Mission press kits & external links ──────────────────────
// Keyed by substring matching against launch name. First match wins.
const MISSION_LINKS = {
  'Artemis III':   { page:'https://www.nasa.gov/mission/artemis-iii/',   pressKit: null },
  'Artemis II':    { page:'https://www.nasa.gov/mission/artemis-ii/',    pressKit:'https://www.nasa.gov/wp-content/uploads/2024/04/artemis-ii-media-kit-may-2024.pdf' },
  'Artemis I':     { page:'https://www.nasa.gov/mission/artemis-i/',     pressKit:'https://www.nasa.gov/wp-content/uploads/2022/02/artemis1mediakitfinal.pdf' },
  'Crew-':         { page:'https://www.nasa.gov/commercial-crew-program/', pressKit: null },
  'CRS-':          { page:'https://www.nasa.gov/commercial-resupply/',   pressKit: null },
  'Europa Clipper':{ page:'https://europa.nasa.gov/',                    pressKit:'https://www.nasa.gov/press-kit/europa-clipper-launch-press-kit/' },
  'GOES-':         { page:'https://www.nasa.gov/mission/goes/',          pressKit: null },
  'SPHEREx':       { page:'https://www.nasa.gov/mission/spherex/',       pressKit: null },
};

// Program-level links (from Space Devs program array)
const PROGRAM_LINKS = {
  'Artemis':                'https://www.nasa.gov/artemis/',
  'Commercial Crew Program':'https://www.nasa.gov/commercial-crew-program/',
  'Commercial Resupply Services':'https://www.nasa.gov/commercial-resupply/',
  'Starlink':               'https://www.spacex.com/starlink/',
  'New Glenn':              'https://www.blueorigin.com/new-glenn',
  'Vulcan':                 'https://www.ulalaunch.com/rockets/vulcan-centaur',
  'Electron':               'https://www.rocketlabusa.com/launch/electron/',
  'Neutron':                'https://www.rocketlabusa.com/launch/neutron/',
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
