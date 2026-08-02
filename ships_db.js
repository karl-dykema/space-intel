'use strict';

// ── Vessel Database ──────────────────────────────────────────
const VESSEL_DB = {
  // ── SpaceX ──────────────────────────────────────────────────
  // You'll Thank Me Later (YTML) — non-self-propelled barge, likely no AIS transponder; towed by Signet Lightning
  // Hull: Marmac 31 (260ft × 72ft). Role: Starship/Booster transport, Starbase TX → Port Canaveral FL (~1000nm Gulf crossing).
  // Fitted with curved canopy/tent for hardware protection. First arrived Port Canaveral May 2026.
  // Track Signet Lightning (MMSI 368549000) to follow YTML transits.
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
  '368549000': {
    name:'Signet Lightning', abbr:'Lightning',
    operator:'SpaceX', role:'Starship Transport Tug',
    color:'#00d4ff', homePort:'Port of Brownsville, TX',
    imo:'8969305', flag:'USA', built:1998, verified:true,
    specs:{ length:'38m', beam:'12m', grossTonnage:'632 GT', type:'Offshore tug/supply ship', operator:'Signet Maritime Corporation (contracted)' },
    history:[
      'Operated by Signet Maritime Corporation, contracted to SpaceX',
      'Primary tug for You\'ll Thank Me Later (YTML) Starship transport barge (Marmac 31)',
      'Tows YTML on ~1000nm Gulf crossing between Starbase TX and Port Canaveral FL',
      'YTML carries Starship/Super Heavy hardware horizontally under curved canopy',
    ],
    notes:'Track this vessel to follow YTML Starship transport runs. YTML itself is non-self-propelled and likely has no AIS. IMO 8969305. [✓ MMSI]',
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
  '372112000': {
    name:'Go Australis', abbr:'Go Australis',
    operator:'SpaceX', role:'Starship Recovery Vessel (Indian Ocean)',
    color:'#00d4ff', homePort:'Dampier, WA, Australia',
    imo:'9725756', flag:'Panama', built:2020, verified:true,
    specs:{ length:'84m', beam:'18m', type:'Offshore Tug/Supply Ship (PSV)', callsign:'3FUE8' },
    history:[
      'Chartered offshore supply vessel serving as SpaceX Starship landing-zone support in the Indian Ocean off Western Australia',
      'Managed by GO Offshore Pty Ltd; sailed from Dampier, NW Australia to the splashdown zone (~750-810nm offshore)',
      'On-station for Flight 13 (Ship 40) splashdown July 24 2026 — the first intact Starship to survive and float on the water',
      'Held station atypically after Flight 13 to assess safety of the floating Ship, rather than immediately returning to the LZ',
      'Underway July 2026 to recover the floating Ship 40 — the first attempted at-sea recovery of an intact Starship',
      'Working the recovery with AHTS Normand Ranger (tow) and PSV Skimmer Tide (support)',
      'Escorting the tow to Western Australia after Normand Ranger took Ship 40 under tow ~Aug 2 2026',
    ],
    notes:'ACTIVE RECOVERY MISSION — escorting the Ship 40 tow after station-keeping alongside the floating Ship for over a week. Chartered Panama-flagged PSV, Starship Indian Ocean LZ support. IMO 9725756, callsign 3FUE8. [✓ MMSI confirmed]',
  },
  '257587000': {
    name:'Normand Ranger', abbr:'Normand Ranger',
    operator:'SpaceX', role:'Starship Recovery Tow Vessel (Indian Ocean)',
    color:'#00d4ff', homePort:'Skudeneshavn, Norway',
    imo:'9413432', flag:'Norway', built:2010, verified:true,
    specs:{ length:'91m', beam:'22m', type:'Anchor Handling Tug Supply (AHTS)', bollardPull:'280 t' },
    history:[
      'Ulstein-built AHTS operated by Solstad Offshore; 280-tonne bollard pull, Multi Deck Handler and anchor recovery frame',
      'Purpose-built for open-ocean towing — the only vessel in the flotilla actually rigged for it',
      'Chartered for SpaceX Starship recovery operations in the Indian Ocean off Western Australia',
      'Assigned as the tow vessel for the floating Ship 40 (Flight 13) recovery attempt, July 2026',
      'Arrived on station ~July 31 2026, roughly 750nm NW of Australia',
      'Rigged a tow to Ship 40 and took it under tow ~Aug 2 2026, bound for Western Australia — the first Starship ever taken under tow',
    ],
    notes:'★ UNDER TOW — currently towing Starship Ship 40 toward Dampier, the first at-sea recovery of a Starship. The bollard pull was never the problem; rigging a bridle to a hull with no designed tow points was. Solstad AHTS, IMO 9413432.',
  },
  '257084000': {
    name:'Skimmer Tide', abbr:'Skimmer Tide',
    operator:'SpaceX', role:'Starship Recovery Support Vessel (Indian Ocean)',
    color:'#00d4ff', homePort:'Dampier, WA, Australia',
    imo:'9609988', flag:'Norway', built:2012, verified:true,
    specs:{ length:'82m', beam:'18m', type:'Offshore Tug/Supply Ship (PSV)', deadweight:'4,000 t', callsign:'LANX7' },
    history:[
      'Large PSV built 2012, ex-Normand Skimmer; operated by Tidewater',
      'Chartered for SpaceX Starship recovery operations off Western Australia',
      'Part of the Ship 40 (Flight 13) at-sea recovery flotilla, July 2026',
      'Believed to have carried the rigging crew that attached the tow bridle to Ship 40',
      'Supporting the tow to Western Australia from ~Aug 2 2026',
    ],
    notes:'ACTIVE RECOVERY MISSION — support vessel for the Ship 40 at-sea recovery, alongside Go Australis and Normand Ranger. Ex-Normand Skimmer. IMO 9609988, callsign LANX7.',
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

  // ── Elon Ventures (non-space) ────────────────────────────────
  { id:'spacex_irvine',    lat:33.685,  lon:-117.778, name:'SpaceX — Irvine, CA',             type:'elon_venture', desc:'SpaceX Starlink customer equipment and satellite operations support office in Irvine, CA.' },
  { id:'x_hq',            lat:37.776,  lon:-122.417, name:'X (formerly Twitter) HQ — SF',    type:'elon_venture', desc:'X Corp headquarters at 1355 Market St, San Francisco. Acquired by Elon Musk in 2022 and rebranded from Twitter to X in 2023.' },
  { id:'xai_colossus',    lat:35.149,  lon:-90.048,  name:'xAI Colossus — Memphis, TN',      type:'elon_venture', desc:'xAI supercomputer cluster "Colossus" — 100,000+ NVIDIA H100/H200 GPUs. One of the world\'s largest AI compute facilities. Used to train Grok LLMs.' },
  { id:'neuralink_austin', lat:30.413,  lon:-97.667,  name:'Neuralink — Austin, TX',          type:'elon_venture', desc:'Neuralink HQ and surgical R&D. Brain-computer interface implant development. First human implant: January 2024. FDA breakthrough device designation.' },
  { id:'boring_pflugerville',lat:30.434,lon:-97.620,  name:'The Boring Company — Pflugerville, TX', type:'elon_venture', desc:'Boring Company HQ and R&D. Underground tunnel boring machines and the Las Vegas Loop transit system. Prufrock tunnel boring machine developed here.' },
  { id:'boring_lvcc',     lat:36.117,  lon:-115.157, name:'Las Vegas Loop (TBC)',             type:'elon_venture', desc:'Vegas Loop: 29 miles of tunnels beneath Las Vegas. Teslas carry passengers at up to 60 mph. Serves LVCC, Resorts World, Allegiant Stadium, and more.' },

  // ── Tesla ─────────────────────────────────────────────────────
  { id:'tesla_hq',        lat:30.200,  lon:-97.635,  name:'Tesla HQ — Austin, TX',           type:'tesla', desc:'Tesla global headquarters (relocated from Palo Alto 2021). Executive leadership, design, and engineering. 1 Tesla Road, Del Valle, TX.' },
  { id:'tesla_fremont',   lat:37.494,  lon:-121.946, name:'Tesla Factory — Fremont, CA',     type:'tesla', desc:'Primary North American production. Model S, 3, X, Y. Former NUMMI plant (Toyota/GM). ~10,000 employees. Opened 2010 as Tesla\'s first factory.' },
  { id:'tesla_giga_nv',   lat:39.538,  lon:-119.443, name:'Gigafactory Nevada — Sparks, NV', type:'tesla', desc:'Joint venture with Panasonic. Battery cell and energy storage manufacturing. Model 3 drivetrain assembly. One of the largest buildings by footprint in the world.' },
  { id:'tesla_giga_tx',   lat:30.221,  lon:-97.617,  name:'Gigafactory Texas — Del Valle, TX',type:'tesla', desc:'Cybertruck and Model Y Texas production. Opened April 2022. Co-located near new HQ campus. ~10,000 employees.' },
  { id:'tesla_giga_berlin',lat:52.388, lon:13.790,   name:'Gigafactory Berlin — Grünheide, DE',type:'tesla', desc:'Model Y European production hub. Opened March 2022. Located in Brandenburg Industrial Park east of Berlin. First European Tesla factory.' },
  { id:'tesla_giga_shanghai',lat:31.227,lon:121.582,  name:'Gigafactory Shanghai',            type:'tesla', desc:'Model 3 and Model Y for Asia and export. Opened 2020. Highest-volume Tesla factory. ~750,000 vehicles/year capacity.' },
  { id:'tesla_energy_lathrop',lat:37.824,lon:-121.278,name:'Tesla Energy — Lathrop, CA',     type:'tesla', desc:'Megapack battery energy storage manufacturing (the "Megafactory"). 40 GWh/year capacity target. Grid-scale energy storage for utilities worldwide.' },
  { id:'tesla_mexico',    lat:25.666,  lon:-99.944,  name:'Tesla Gigafactory México — N.L.', type:'tesla', desc:'Planned Gigafactory near Santa Catarina, Nuevo León. Announced 2023 by Gov. Samuel García. Paused pending trade/tariff review. Would produce next-gen vehicles including Cybercab.' },

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
  { id:'swri_nlrc',      lat:29.491,  lon:-98.638,  name:'SwRI / NLRC — San Antonio, TX',   type:'facility', desc:'Southwest Research Institute & planned National Lunar Research Center (NLRC). 180-acre full-scale lunar surface test site adjacent to SwRI campus. Developed with Astroport Space Technologies and WEX Foundation to support NASA Artemis lunar base construction and rover testing.' },

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
  MISSIONS:     'space_intel_missions_v3',
  MISSIONS_PAST:'space_intel_missions_past_v3',
};
const MAX_EVENTS = 500;
const MAX_POS    = 10000;

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
  { match:n=>/^HST$|^HUBBLE SPACE/i.test(n),            abbr:'Hubble',   operator:'NASA · ESA',       role:'Space Telescope',     col:'#ccaaff', longterm:true  },
  { match:n=>/^PHOTON\b/i.test(n)&&!/DEB/i.test(n),    abbr:'Photon',   operator:'Rocket Lab',       role:'Kick Stage',          col:'#ff3355', longterm:false },
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
