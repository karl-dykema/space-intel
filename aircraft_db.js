'use strict';



// ── Aircraft Database ─────────────────────────────────────────
// Keyed by registration. Polled live from airplanes.live every 60s.
const AIRCRAFT_DB = {
  // ── NASA KSC H135 helicopters ────────────────────────────────
  'N425NA': {
    name:'NASA H135 (N425NA)', abbr:'NASA Helo 1',
    operator:'NASA', role:'Security / rescue / VIP transport — KSC',
    model:'Airbus H135 (EC-135T3)', type:'helicopter',
    notes:'One of three H135s based at Kennedy Space Center Launch & Landing Facility. Delivered Sep 2020. Replaced Bell UH-1 Hueys. Missions: launch-area security, EMS, crew/executive transport. MSN 2073.',
  },
  'N435NA': {
    name:'NASA H135 (N435NA)', abbr:'NASA Helo 2',
    operator:'NASA', role:'Security / rescue / VIP transport — KSC',
    model:'Airbus H135 (EC-135T3)', type:'helicopter',
    notes:'One of three H135s based at KSC. Delivered Sep 2020. MSN 2081. Operated under NASA KSC Flight Operations.',
  },
  'N442NA': {
    name:'NASA H135 (N442NA)', abbr:'NASA Helo 3',
    operator:'NASA', role:'Security / rescue / VIP transport — KSC',
    model:'Airbus H135 (EC-135T3)', type:'helicopter',
    notes:'Third KSC H135 — arrived Mar 11 2021, completing the three-ship fleet. Used May 29 2026 by NASA Administrator Jared Isaacman for aerial survey of Blue Origin LC-36 after New Glenn static-fire explosion (May 28 2026, largest explosion in Cape Canaveral history).',
  },
  // ── Rocket Lab ───────────────────────────────────────────────
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
      'Based at Vandenberg SFB (SLC-8); also operates from Cape Canaveral and Kwajalein Atoll',
      'UPCOMING: Swift Rescue Mission (NET Jun 30 2026) — launch from Kwajalein Atoll. Katalyst LINK spacecraft reboosts NASA Swift Observatory. Last Pegasus XL in inventory.',
    ],
    notes:'N140SC. Northrop Grumman Launch & Targeting Systems. Photo: US Space Force / public domain. Watch for N140SC ADS-B when it departs Vandenberg for Kwajalein pre-launch.',
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
