'use strict';

let history = {};
let events  = [];

const logLines = [];
let   logUnread = 0;

function addLog(msg, type='sys') {
  const entry = { ts: Date.now(), msg, type };
  logLines.unshift(entry);
  if (logLines.length > MAX_LOG) logLines.pop();
  if (S.tab === 'log') {
    prependLogLine(entry);
  } else {
    logUnread++;
    const badge = document.getElementById('log-badge');
    if (badge) { badge.textContent = logUnread > 99 ? '99+' : logUnread; badge.style.display=''; }
  }
}

function prependLogLine(entry) {
  const panel = document.getElementById('rpanel');
  if (S.tab !== 'log' || !panel) return;
  const existing = panel.querySelector('.log-line');
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = `<span class="log-ts">${new Date(entry.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>` +
    `<span class="log-msg" style="color:${LOG_COLORS[entry.type]||'#888'}">${esc(entry.msg)}</span>`;
  if (existing) panel.insertBefore(div, panel.firstChild);
  else panel.innerHTML = '';
  panel.insertBefore(div, panel.firstChild);
  while (panel.querySelectorAll('.log-line').length > MAX_LOG) panel.removeChild(panel.lastChild);
}

function buildLogTab() {
  if (!logLines.length) return `<div class="empty">Activity log — AIS messages, DB reads/writes, and system events appear here.</div>`;
  return logLines.map(e =>
    `<div class="log-line"><span class="log-ts">${new Date(e.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>` +
    `<span class="log-msg" style="color:${LOG_COLORS[e.type]||'#888'}">${esc(e.msg)}</span></div>`
  ).join('');
}

function loadLS() {
  try { history = JSON.parse(localStorage.getItem(LS.HISTORY)||'{}'); } catch(e){history={};}
  try { events  = JSON.parse(localStorage.getItem(LS.EVENTS )||'[]'); } catch(e){events=[];}
  try {
    const cached = JSON.parse(localStorage.getItem(LS.MISSIONS)||'null');
    if(cached?.data && Date.now() - cached.ts < 3600000) missionsCache = cached.data;
  } catch(e) {}
  try {
    const cached = JSON.parse(localStorage.getItem(LS.MISSIONS_PAST)||'null');
    if(cached?.data && Date.now() - cached.ts < 3600000) pastMissionsCache = cached.data;
  } catch(e) {}
}

function saveMissions() {
  try { localStorage.setItem(LS.MISSIONS,      JSON.stringify({data:missionsCache,     ts:Date.now()})); } catch(e) {}
}
function savePastMissions() {
  try { localStorage.setItem(LS.MISSIONS_PAST, JSON.stringify({data:pastMissionsCache, ts:Date.now()})); } catch(e) {}
}
function saveLS() {
  try {
    localStorage.setItem(LS.HISTORY, JSON.stringify(history));
    localStorage.setItem(LS.EVENTS,  JSON.stringify(events.slice(0,MAX_EVENTS)));
  } catch(e) {
    Object.keys(history).forEach(m=>{
      if(history[m].positions.length>200) history[m].positions=history[m].positions.slice(-200);
    });
    try{localStorage.setItem(LS.HISTORY,JSON.stringify(history));}catch(e2){}
  }
}
setInterval(saveLS, 30000);

const S = { ws:null, vessels:{}, aircraft:{}, selected:null, tab:'events' };
let missionsCache = [];
let pastMissionsCache = [];
let deployedFleet = new Set(); // MMSIs currently deployed at sea (out of AIS range)
const prevZones={};
let map=null, layers=null, zoneLayer=null, exclusionLayer=null, landmarkLayer=null, aircraftLayer=null;
let orbitLayer=null, rocketLayer=null, terminatorLayer=null, missionArcLayer=null;
let showLandmarks=true, showSpacecraft=true, showVessels=true, showAircraft=true;
const markers={}, tracks={}, aircraftMarkers={}, aircraftTracks={}, cogArrows={};
const spacecraftMarkers={}, orbitTracks={};
let selectedMissionForArc=null;
const _missionById={};
let dockedManifest={};  // station name → [{name, abbr, operator, col}] from Space Devs API

// ── Port proximity ────────────────────────────────────────────
// Known port zones — any vessel last seen within ~8km is considered in port
const KNOWN_PORT_ZONES = [
  {lat:28.41,  lon:-80.61},  // Port Canaveral, FL
  {lat:33.75,  lon:-118.22}, // Port of Long Beach / LA, CA
  {lat:25.95,  lon:-97.40},  // Port of Brownsville, TX
  {lat:29.75,  lon:-95.27},  // Port of Houston, TX
  {lat:29.95,  lon:-90.07},  // Port of New Orleans, LA
  {lat:37.79,  lon:-122.39}, // Port of San Francisco, CA
  {lat:47.60,  lon:-122.34}, // Port of Seattle, WA
  {lat:30.40,  lon:-87.05},  // Port of Pensacola, FL
  {lat:25.77,  lon:-80.19},  // Port of Miami, FL
  {lat:-39.26, lon:177.86},  // Port of Gisborne / Māhia, NZ
];

function isNearPort(lat, lon, radiusKm=8) {
  if(lat==null||lon==null) return false;
  return KNOWN_PORT_ZONES.some(p=>{
    const dLat=lat-p.lat, dLon=(lon-p.lon)*Math.cos(p.lat*Math.PI/180);
    return Math.sqrt(dLat*dLat+dLon*dLon)*111 < radiusKm;
  });
}

// ── Mission linkage ───────────────────────────────────────────
// Home port coords for drone ships — used to detect "returned to port"
const DRONE_HOME_PORTS = {
  '368219910': {lat:28.41, lon:-80.61},  // ASOG — Port Canaveral
  '368351350': {lat:33.75, lon:-118.22}, // OCISLY — Port of Long Beach
  '368368960': {lat:28.41, lon:-80.61},  // Jacklyn — Port Canaveral
};

// Port webcams — shown in booster transit card when ship is approaching
const PORT_WEBCAMS = {
  '368219910': [ // ASOG — Port Canaveral
    {label:'Port Canaveral Webcam', url:'https://www.portcanaveralwebcam.com/'},
    {label:'Cruise Port & SpaceX Cam', url:'https://www.cruisingearth.com/port-webcams/united-states/port-canaveral-florida7/'},
  ],
  '368351350': [ // OCISLY — Port of Long Beach
    {label:'Long Beach Port Tracker', url:'https://www.cruisingearth.com/port-tracker/united-states/long-beach-california/', lookFor:'Look for MARMAC 304 (OCISLY\'s registered name)'},
  ],
  '368368960': [ // Jacklyn — Port Canaveral
    {label:'Port Canaveral Webcam', url:'https://www.portcanaveralwebcam.com/'},
    {label:'Cruise Port & SpaceX Cam', url:'https://www.cruisingearth.com/port-webcams/united-states/port-canaveral-florida7/'},
  ],
};

function isCarryingBooster(mmsi) {
  const role = (VESSEL_DB[mmsi]?.role||'').toLowerCase();
  if(!role.includes('drone') && !role.includes('landing platform')) return null;
  const now = Date.now();

  const mission = [...missionsCache, ...pastMissionsCache].find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if(!net) return false;
    const age = now - net;
    if(age < 600000 || age > 4*86400000) return false; // 10 min to 4 days
    const op = Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'';
    return vesselHintsForLaunch(op, l.pad?.name||'', l.pad?.location?.name||'').includes(mmsi);
  });
  if(!mission) return null;

  const v = S.vessels[mmsi];
  const home = DRONE_HOME_PORTS[mmsi];
  const age = now - new Date(mission.net).getTime();

  if(home && !v?.lat) return null; // no position yet, wait for data before showing flag
  if(v?.lat && home) {
    const dLat = v.lat - home.lat, dLon = (v.lon - home.lon) * Math.cos(home.lat * Math.PI/180);
    const distKm = Math.sqrt(dLat*dLat + dLon*dLon) * 111;
    // Within 3km → definitely at dock
    if(distKm < 3) return null;
    // Within 10km and slow/moored → docked or just departed
    if(distKm < 10 && (v.sog <= 0.5 || v.navStatus === 5 || v.navStatus === 1)) return null;
  }

  // In-session track: any position within 3km of home port since mission launch → booster was unloaded
  if(home && history[mmsi]?.positions) {
    const mNet = new Date(mission.net).getTime();
    const hadPortVisit = history[mmsi].positions.some(p => {
      if(p.ts <= mNet) return false;
      const dLat = p.lat - home.lat, dLon = (p.lon - home.lon) * Math.cos(home.lat * Math.PI/180);
      return Math.sqrt(dLat*dLat + dLon*dLon) * 111 < 3;
    });
    if(hadPortVisit) return null;
  }

  // After 36h+ if vessel is now stationary, it has returned and docked
  if(age > 36*3600000 && v?.sog != null && v.sog <= 0.1) return null;
  // After 36h with no AIS since launch, assume it returned to port off-coverage
  const mNet = new Date(mission.net).getTime();
  const freshSinceLaunch = v?.ts && v.ts > mNet && (now - v.ts < 24*3600000);
  if(age > 36*3600000 && !freshSinceLaunch) return null;

  return {...mission, _transit: age > 2*3600000};
}

function findActiveMission(mmsi) {
  if(!missionsCache.length) return null;
  const now = Date.now();
  return missionsCache.find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if(!net || Math.abs(now - net) > 12 * 3600000) return false;
    const op = Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'';
    return vesselHintsForLaunch(op, l.pad?.name||'', l.pad?.location?.name||'').includes(mmsi);
  }) || null;
}

// ── Events ────────────────────────────────────────────────────
function addEvent(mmsi, type, detail, lat, lon) {
  const info=VESSEL_DB[mmsi]||{};
  const cfg=EV_CFG[type]||{icon:'·',color:'#888'};
  const mission = findActiveMission(mmsi);
  if(mission) {
    const net=new Date(mission.net).getTime(), diff=Date.now()-net;
    const abs=Math.abs(diff), sign=diff>=0?'+':'-';
    const h=Math.floor(abs/3600000), m=Math.floor((abs%3600000)/60000);
    detail=`${detail} · ${mission.name} T${sign}${h}h${String(m).padStart(2,'0')}m`;
  }
  const ev={
    ts:Date.now(), mmsi,
    name:info.name||mmsi, abbr:info.abbr||mmsi,
    operator:info.operator||'Unknown', opColor:opColor(info.operator),
    type, icon:cfg.icon, typeColor:cfg.color,
    detail, lat:lat||null, lon:lon||null,
  };
  events.unshift(ev);
  if(events.length>MAX_EVENTS*2) events.pop();
  sbWriteEvent(ev);
  addLog(`EVT [${type}] ${info.abbr||mmsi} — ${detail}`, 'event');
  if(S.tab==='events') prependEventRow(ev);
  return ev;
}

// ── Facility cluster detection ────────────────────────────────
function detectFacilityClusters(radiusKm = 2) {
  const mooredEvs = events.filter(e => e.type === 'MOORED' && e.lat != null && e.lon != null);
  const clusters = [];
  for (const ev of mooredEvs) {
    let best = null, bestDist = radiusKm;
    for (const c of clusters) {
      const dLat = ev.lat - c.lat, dLon = ev.lon - c.lon;
      const d = Math.sqrt(dLat*dLat + dLon*dLon) * 111;
      if (d < bestDist) { best = c; bestDist = d; }
    }
    if (best) {
      const n = best.count;
      best.lat = (best.lat * n + ev.lat) / (n + 1);
      best.lon = (best.lon * n + ev.lon) / (n + 1);
      best.count++;
      best.vessels.add(ev.abbr || ev.name || String(ev.mmsi));
    } else {
      clusters.push({ lat: ev.lat, lon: ev.lon, count: 1, vessels: new Set([ev.abbr || ev.name || String(ev.mmsi)]) });
    }
  }
  return clusters.filter(c => c.count >= 2).sort((a, b) => b.count - a.count);
}

// ── AIS handler ───────────────────────────────────────────────
function handleAIS(msg) {
  const m=msg.MetaData||{};
  const pr=msg.Message?.PositionReport;
  const sd=msg.Message?.ShipStaticData;
  const mmsi=String(m.MMSI_String||m.MMSI||pr?.UserID||'');
  if(!mmsi||mmsi==='0'||!VESSEL_DB[mmsi]) return;

  const now=Date.now();
  const info=VESSEL_DB[mmsi];
  const prev=S.vessels[mmsi];
  const v=prev?{...prev}:{mmsi,...info,sog:0,cog:0,ts:0,track:[],_historical:false};

  if(pr) {
    const lat=pr.Latitude,lon=pr.Longitude;
    if(lat&&lon&&lat!==0&&lon!==0) {
      const wasStopped=!prev||prev.sog<=0.5;
      v.sog=pr.Sog??0; v.cog=pr.Cog??0;
      [v.lat, v.lon] = smoothPos(prev?.lat, prev?.lon, lat, lon, v.sog);
      v.navStatus=pr.NavigationalStatus; v.ts=now; v._historical=false;
      addLog(`AIS pos  ${info.abbr||mmsi}  ${lat.toFixed(4)}, ${lon.toFixed(4)}  ${v.sog.toFixed(1)} kn  COG ${Math.round(v.cog)}°`, 'ais');

      if(!history[mmsi]) {
        history[mmsi]={positions:[],firstSeen:now,lastSeen:now};
        addEvent(mmsi,'VESSEL_SEEN',`${info.abbr} spotted — ${lat.toFixed(3)}, ${lon.toFixed(3)}`,lat,lon);
      }
      history[mmsi].lastSeen=now;
      const lp=history[mmsi].positions.slice(-1)[0];
      if(!lp||now-lp.ts>60000||Math.abs(lat-lp.lat)>0.01||Math.abs(lon-lp.lon)>0.01) {
        history[mmsi].positions.push({lat,lon,ts:now,sog:v.sog,cog:v.cog});
        if(history[mmsi].positions.length>MAX_POS) history[mmsi].positions.shift();
        maybeSBPos(mmsi,lat,lon,v.sog,v.cog,now);
      }

      if(prev&&!prev._historical) {
        if(wasStopped &&v.sog>0.5)  addEvent(mmsi,'UNDERWAY',`${info.abbr} underway — ${v.sog.toFixed(1)} kn`,lat,lon);
        if(!wasStopped&&v.sog<=0.5) addEvent(mmsi,'MOORED',  `${info.abbr} stopped / moored`,lat,lon);
      }

      const nowZ=new Set(detectZones(lat,lon));
      const prvZ=prevZones[mmsi];  // undefined on first ping — don't fire events
      const role=(info.role||'').toLowerCase();
      const zoneMatters=z=>!z.silent&&(!z.roles||z.roles.some(r=>role.includes(r)));
      if(prvZ) {
        nowZ.forEach(zid=>{if(!prvZ.has(zid)){const z=ZONES.find(z=>z.id===zid);if(zoneMatters(z))addEvent(mmsi,'ZONE_ENTER',`${info.abbr} entered ${z.name}`,lat,lon);}});
        prvZ.forEach(zid=>{if(!nowZ.has(zid)){const z=ZONES.find(z=>z.id===zid);if(zoneMatters(z))addEvent(mmsi,'ZONE_EXIT', `${info.abbr} left ${z.name}`,lat,lon);}});
      }
      prevZones[mmsi]=nowZ;

      const lt=v.track.slice(-1)[0];
      if(!lt||Math.abs(lat-lt[0])>0.0002||Math.abs(lon-lt[1])>0.0002) {
        v.track.push([lat,lon]);
        if(v.track.length>1000) v.track.shift();
      }
      showPingRing(v.lat, v.lon, opColor(info.operator));
    }
  }

  if(sd) {
    const n=(sd.Name||m.ShipName||'').trim().replace(/@+$/,'');
    if(n){ v.aisName=n; addLog(`AIS static ${info.abbr||mmsi}  name="${n}"${sd.Destination?' dest='+sd.Destination.trim().replace(/@+$/,''):''}`, 'ais'); }
    if(sd.Destination) {
      const dest=(sd.Destination||'').trim().replace(/@+$/,'');
      if(dest&&dest!==v.dest) {
        if(v.dest) addEvent(mmsi,'DEST_CHANGE',`${info.abbr} destination → ${dest}`,v.lat,v.lon);
        v.dest=dest;
      }
    }
    if(sd.EtaMonth)  v.eta=`${sd.EtaMonth}/${String(sd.EtaDay).padStart(2,'0')} ${String(sd.EtaHour).padStart(2,'0')}:${String(sd.EtaMinute).padStart(2,'0')}Z`;
    if(sd.ImoNumber) v.imo=sd.ImoNumber;
    if(sd.CallSign)  v.cs=(sd.CallSign||'').trim().replace(/@+$/,'');
    if(sd.Draught||sd.MaximumStaticDraught) v.draught=sd.MaximumStaticDraught||sd.Draught;
  }

  S.vessels[mmsi]=v;
  updateMarker(v);
  updateHeaderStats();
  renderFleet();
  if(S.selected===mmsi&&S.tab==='vessel') renderRight();
}

// AIS gap check
setInterval(()=>{
  const now=Date.now();
  Object.entries(S.vessels).forEach(([mmsi,v])=>{
    if(!v._historical&&v.ts&&now-v.ts>7200000) {
      const hrs=Math.round((now-v.ts)/3600000);
      addEvent(mmsi,'AIS_GAP',`${v.abbr||mmsi} dark for ${hrs}h — last: ${v.lat?.toFixed(3)}, ${v.lon?.toFixed(3)}`,v.lat,v.lon);
      delete S.vessels[mmsi];
    }
  });
},900000);

// ── Map ───────────────────────────────────────────────────────
function initMap() {
  map=L.map('map',{zoomControl:true,attributionControl:true,minZoom:2,maxZoom:19,maxBounds:[[-90,-180],[90,180]],maxBoundsViscosity:1.0,worldCopyJump:false});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    attribution:'© CARTO © OSM',subdomains:'abcd',maxZoom:19,noWrap:true,bounds:[[-90,-180],[90,180]],
  }).addTo(map);
  terminatorLayer=L.layerGroup().addTo(map);
  exclusionLayer=L.layerGroup().addTo(map);
  landmarkLayer=L.layerGroup().addTo(map);
  missionArcLayer=L.layerGroup().addTo(map);
  orbitLayer=L.layerGroup().addTo(map);
  rocketLayer=L.layerGroup().addTo(map);
  aircraftLayer=L.layerGroup().addTo(map);
  layers=L.layerGroup().addTo(map);
  zoneLayer=L.layerGroup().addTo(map);
  map.setView([20,0],2);
  drawExclusionZones();
  drawZones();
  drawLandmarks();
  document.getElementById('mapleg-ops').innerHTML=
    Object.entries(OP_COLORS).map(([op,c])=>
      `<div style="display:flex;gap:6px;align-items:center;font-size:10px;color:${c};margin-bottom:3px">
        <div style="width:12px;height:3px;background:${c};border-radius:1px"></div>${op}</div>`
    ).join('') +
    `<div style="display:flex;gap:6px;align-items:center;font-size:10px;color:#ff8c00;margin-top:5px;padding-top:5px;border-top:1px solid var(--bdr2)">
      <div style="width:12px;height:3px;background:#ff8c00;border-radius:1px;opacity:0.7"></div>Safety Zone</div>
    <div style="margin-top:8px;padding-top:5px;border-top:1px solid var(--bdr2);font-size:9px;color:var(--t4);letter-spacing:.06em;margin-bottom:3px">LANDMARKS</div>` +
    [
      ['#ff4400','Launch pad',   `<svg width="10" height="10" viewBox="0 0 11 11"><polygon points="5.5,1 10,10 5.5,7.5 1,10" fill="#ff4400"/></svg>`],
      ['#ffcc00','Viewing area', `<svg width="9" height="9" viewBox="0 0 9 9"><rect x="0.5" y="0.5" width="8" height="8" rx="1" fill="#ffcc00"/></svg>`],
      ['#00aaff','Facility',     `<svg width="9" height="9" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#00aaff"/></svg>`],
      ['#00cc88','Port',         `<svg width="9" height="9" viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5" fill="#00cc88"/></svg>`],
    ].map(([c,l,icon])=>
      `<div style="display:flex;gap:6px;align-items:center;font-size:10px;color:${c};margin-bottom:2px">${icon}${l}</div>`
    ).join('');
}

function drawExclusionZones() {
  const style = { color:'#ff8c00', fillColor:'#ff8c00', fillOpacity:0.04, weight:1.2, dashArray:'6 3' };
  const tipUSCG = (name, cfr) => `<b style="color:#ff8c00">${name}</b><br><span style="font-size:11px;color:var(--t5)">USCG Safety Zone · ${cfr}</span>`;
  const tipIntl = (name, auth) => `<b style="color:#ff8c00">${name}</b><br><span style="font-size:11px;color:var(--t5)">Maritime Exclusion Zone · ${auth}</span>`;

  // Cape Canaveral — 33 CFR 165.775 (12 nm offshore boundary)
  L.polygon([
    [28.815, -80.478], [28.722, -80.683], [28.422, -80.579],
    [28.183, -80.483], [28.167, -80.354], [28.815, -80.354],
  ], style).addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Cape Canaveral Maritime Safety Zone','33 CFR 165.775'),{className:'ltt',direction:'auto'});

  // Vandenberg — 33 CFR 334.1130 (3 nm offshore danger zones)
  L.polygon([
    [34.902, -120.671], [34.902, -120.733], [34.880, -120.733],
    [34.833, -120.675], [34.747, -120.704], [34.697, -120.670],
    [34.587, -120.713], [34.550, -120.685], [34.511, -120.625],
    [34.405, -120.500], [34.393, -120.452], [34.406, -120.411],
    [34.456, -120.411],
  ], style).addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Vandenberg Maritime Danger Zone','33 CFR 334.1130'),{className:'ltt',direction:'auto'});

  // Starbase / Boca Chica — USCG enforces ad-hoc safety zones per launch
  L.circle([26.0, -97.15], {radius:28000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Starbase / Boca Chica Safety Zone','Ad-hoc USCG marine safety notices'),{className:'ltt',direction:'auto'});

  // Wallops Island (NASA/Northrop Grumman) — FAA/USCG launch safety zones
  L.circle([37.94, -75.47], {radius:30000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Wallops Island Maritime Safety Zone','USCG/FAA launch safety zones'),{className:'ltt',direction:'auto'});

  // Māhia Peninsula, NZ — Rocket Lab maritime exclusion
  L.circle([-39.26, 177.87], {radius:20000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Māhia Launch Exclusion Zone','Maritime NZ exclusion notices'),{className:'ltt',direction:'auto'});

  // Kourou / Centre Spatial Guyanais — ESA/Arianespace Atlantic exclusion
  L.circle([5.24, -52.77], {radius:60000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Kourou (CSG) Maritime Exclusion Zone','French DGAC / CNES notices'),{className:'ltt',direction:'auto'});

  // Alcântara, Brazil — AEB/Itamar
  L.circle([-2.37, -44.40], {radius:30000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Alcântara Launch Center Maritime Zone','DECEA/AEB airspace & maritime notices'),{className:'ltt',direction:'auto'});

  // Wenchang Space Launch Center — CNSA South China Sea exclusion
  L.circle([19.61, 110.95], {radius:45000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Wenchang Maritime Exclusion Zone','CNSA / China MSA notices'),{className:'ltt',direction:'auto'});

  // Tanegashima Space Center — JAXA Pacific exclusion
  L.circle([30.38, 130.97], {radius:35000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Tanegashima Maritime Exclusion Zone','JAXA / Japan JCG notices'),{className:'ltt',direction:'auto'});

  // Satish Dhawan Space Centre (SHAR) — ISRO Bay of Bengal exclusion
  L.circle([13.73, 80.23], {radius:35000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('SHAR (Sriharikota) Maritime Exclusion Zone','ISRO / India Coast Guard notices'),{className:'ltt',direction:'auto'});

  // Naro Space Center, South Korea — KARI exclusion
  L.circle([34.43, 127.54], {radius:20000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Naro Space Center Maritime Zone','KARI / Korea Coast Guard notices'),{className:'ltt',direction:'auto'});

  // Starship Indian Ocean Landing Zone — consistent splashdown target IFT-11 / IFT-12
  L.circle([-19.0, 107.0], {radius:150000, color:'#00d4ff', fillColor:'#00d4ff', fillOpacity:0.03, weight:1.0, dashArray:'4 6'})
    .addTo(exclusionLayer)
    .bindTooltip('<b style="color:#00d4ff">Starship Indian Ocean Landing Zone</b><br><span style="font-size:11px;color:var(--t5)">~19°S 107°E · IFT-11 &amp; IFT-12 splashdown target<br>Future recovery ship staging area</span>',{className:'ltt',direction:'auto'});

  // Starfall Pacific reentry zone — FAA EA May 2026, ~700nm off US West Coast
  L.circle([29.0, -131.0], {radius:350000, color:'#00d4ff', fillColor:'#00d4ff', fillOpacity:0.03, weight:1.0, dashArray:'4 6'})
    .addTo(exclusionLayer)
    .bindTooltip('<b style="color:#00d4ff">Starfall Reentry Zone</b><br><span style="font-size:11px;color:var(--t5)">~700nm off US West Coast · outside 200nm EEZ<br>SpaceX uncrewed reentry capsule (3.1m, 2,100kg)<br>In-orbit manufacturing &amp; rapid cargo delivery · FAA EA May 2026</span>',{className:'ltt',direction:'auto'});
}

function drawZones() {
  [{id:'canaveral',lat:28.5,lon:-80.65,r:40},{id:'boca_chica',lat:26.0,lon:-97.15,r:25},
   {id:'vandenberg',lat:34.65,lon:-120.6,r:25},{id:'lc1_nz',lat:-39.25,lon:177.9,r:18},
   {id:'atl_recovery',lat:28.5,lon:-76.0,r:110},{id:'pac_recovery',lat:29.8,lon:-120.6,r:160},
   {id:'gulf_ops',lat:27.0,lon:-92.0,r:90}].forEach(z=>{
    const def=ZONES.find(zz=>zz.id===z.id);
    L.circle([z.lat,z.lon],{radius:z.r*1000,color:'#0c3352',fillColor:'#041525',fillOpacity:0.2,weight:1,dashArray:'4 4'})
      .addTo(zoneLayer).bindTooltip(def?.name||z.id,{className:'ltt',direction:'auto'});
  });
}

function drawLandmarks() {
  if(!landmarkLayer || typeof LANDMARKS === 'undefined') return;
  landmarkLayer.clearLayers();
  if(!showLandmarks) return;
  const TYPE_STYLE = {
    launch:   { col:'#ff4400' },
    viewing:  { col:'#ffcc00' },
    facility: { col:'#00aaff' },
    port:     { col:'#00cc88' },
    dsn:      { col:'#cc66ff' },
  };
  const landmarkSvg = (type, col) => {
    if (type === 'launch')
      return `<svg width="11" height="11" viewBox="0 0 11 11"><polygon points="5.5,1 10,10 5.5,7.5 1,10" fill="${col}" stroke="none" opacity="0.9"/></svg>`;
    if (type === 'facility')
      return `<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="${col}" stroke="none" opacity="0.85"/></svg>`;
    if (type === 'viewing')
      return `<svg width="9" height="9" viewBox="0 0 9 9"><rect x="0.5" y="0.5" width="8" height="8" rx="1" fill="${col}" stroke="none" opacity="0.85"/></svg>`;
    if (type === 'port')
      return `<svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5" fill="${col}" stroke="none" opacity="0.85"/></svg>`;
    if (type === 'dsn')
      return `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5.5" fill="${col}" opacity="0.85"/><circle cx="6" cy="6" r="2.5" fill="#0c1929" opacity="1"/></svg>`;
    return `<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="${col}" opacity="0.7"/></svg>`;
  };
  LANDMARKS.forEach(lm => {
    const st = TYPE_STYLE[lm.type] || { col:'#888' };
    const svg = landmarkSvg(lm.type, st.col);
    const sz = lm.type === 'launch' ? 11 : lm.type === 'dsn' ? 12 : 10;
    const icon = L.divIcon({ html: svg, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], className:'' });
    const linkHtml = lm.link
      ? `<br><a href="${lm.link}" target="_blank" style="font-size:10px;color:var(--acc);text-decoration:none">↗ ${esc(lm.link.replace(/^https?:\/\/(www\.)?/,'').split('/')[0])}</a>`
      : '';
    L.marker([lm.lat, lm.lon], { icon, zIndexOffset:-500 })
      .addTo(landmarkLayer)
      .bindTooltip(
        `<b style="color:${st.col}">${esc(lm.name)}</b><br>
        <span style="font-size:10px;color:var(--t4);text-transform:uppercase;letter-spacing:.05em">${lm.type}</span><br>
        <span style="font-size:11px;color:var(--t3)">${esc(lm.desc)}</span>${linkHtml}`,
        { className:'ltt ltt-wrap', direction:'auto', maxWidth:200 }
      );
  });
}

function toggleLandmarks() {
  showLandmarks = !showLandmarks;
  drawLandmarks();
  const btn = document.getElementById('landmark-btn');
  if(btn) btn.style.opacity = showLandmarks ? '1' : '0.4';
}

function toggleLegend() {
  const ops  = document.getElementById('mapleg-ops');
  const chev = document.getElementById('legend-chevron');
  if (!ops) return;
  const collapsed = ops.style.display === 'none';
  ops.style.display  = collapsed ? '' : 'none';
  if (chev) chev.textContent = collapsed ? '▾' : '▸';
  try { localStorage.setItem('legend_collapsed', collapsed ? '0' : '1'); } catch(e) {}
}

function showPingRing(lat, lon, col) {
  if (!map || !layers) return;
  const icon = L.divIcon({
    html: `<div class="ping-ring" style="width:22px;height:22px;border-color:${col}"></div>`,
    iconSize:[22,22], iconAnchor:[11,11], className:''
  });
  const m = L.marker([lat, lon], {icon, zIndexOffset:-300, interactive:false}).addTo(layers);
  setTimeout(() => { try { layers.removeLayer(m); } catch(e) {} }, 5000);
}

function updateMarker(v) {
  if(!map||!layers||!v.lat||!v.lon) return;
  const mmsi=v.mmsi, col=opColor(v.operator), sel=S.selected===mmsi;
  const hist=!!v._historical&&(Date.now()-v.ts>600000); // dim only if historical AND older than 10min
  const vapi=v._vapi&&!SHARE_MODE;
  const stale=!hist&&!vapi&&!!v.ts&&(Date.now()-v.ts>7200000); // >2h old and not already flagged
  const hollow=hist||vapi||stale;
  const docked=!hist&&!vapi&&!stale&&!!v.ts&&(Date.now()-v.ts<600000)&&(v.sog==null||v.sog<=0.1);
  const sz=sel?22:14, cog=v.cog||0;
  const opacity=hist?(sel?0.7:0.45):vapi?(sel?0.8:0.6):stale?(sel?0.65:0.4):docked?(sel?0.65:0.45):(sel?1:0.85);
  const svg=`<svg width="${sz}" height="${sz}" viewBox="0 0 20 20">
    <polygon points="10,1 14.5,17 10,13.5 5.5,17" fill="${hollow?'none':col}" stroke="${col}"
      stroke-width="1.5" transform="rotate(${cog},10,10)" opacity="${opacity}"/>
    ${sel?`<circle cx="10" cy="10" r="9" fill="none" stroke="${col}" stroke-width="1.2" opacity="0.35"/>`:''}</svg>`;
  const icon=L.divIcon({html:svg,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2],className:''});
  if(!markers[mmsi]) {
    markers[mmsi]=L.marker([v.lat,v.lon],{icon,zIndexOffset:sel?1000:0})
      .addTo(layers).on('click',()=>selectVessel(mmsi));
  } else {
    markers[mmsi].setLatLng([v.lat,v.lon]);
    markers[mmsi].setIcon(icon);
    markers[mmsi].setZIndexOffset(sel?1000:0);
  }
  const age=hist?` · last seen ${ageStr(v.ts)}`:vapi?` · VesselAPI ${ageStr(v.ts)}`:stale?` · last seen ${ageStr(v.ts)}`:'';
  markers[mmsi].bindTooltip(
    `<b style="color:${col}">${esc(v.abbr||v.name)}</b><br>
    <span style="color:var(--t5)">${esc(v.operator)}</span><br>${esc(v.role)}<br>
    ${v.sog!=null&&!hollow?v.sog.toFixed(1)+' kn':''}${age}${v.dest&&!hollow?' → '+esc(v.dest):''}`,
    {className:'ltt',direction:'auto'}
  );
  if(v.track&&v.track.length>1) {
    const trackStyle={color:col,weight:hollow?1:2,opacity:hist?0.25:vapi?0.3:stale?0.2:0.5,dashArray:hollow?'3 5':null};
    if(tracks[mmsi]) { tracks[mmsi].setLatLngs(v.track); tracks[mmsi].setStyle(trackStyle); }
    else tracks[mmsi]=L.polyline(v.track,trackStyle).addTo(layers).on('click',()=>selectVessel(mmsi));
  }
  // COG heading arrow — project forward 10 min at current SOG
  if(!hollow && v.sog>0.5 && v.cog!=null && v.lat && v.lon) {
    const distKm = v.sog * 1.852 * 10/60;
    const cogRad = v.cog * Math.PI/180;
    const dLat = distKm * Math.cos(cogRad) / 111;
    const dLon = distKm * Math.sin(cogRad) / (111 * Math.cos(v.lat * Math.PI/180));
    const endPt = [v.lat+dLat, v.lon+dLon];
    const arStyle = {color:col, weight:1.5, opacity:0.55, dashArray:'5 4'};
    if(cogArrows[mmsi]) { cogArrows[mmsi].setLatLngs([[v.lat,v.lon],endPt]); cogArrows[mmsi].setStyle(arStyle); }
    else cogArrows[mmsi] = L.polyline([[v.lat,v.lon],endPt], arStyle).addTo(layers);
  } else if(cogArrows[mmsi]) {
    try { layers.removeLayer(cogArrows[mmsi]); } catch(e) {}
    delete cogArrows[mmsi];
  }
}

function selectVessel(mmsi) {
  S.selected=mmsi;
  const v=S.vessels[mmsi];
  if(v?.lat&&v?.lon&&map) map.setView([v.lat,v.lon],10);
  Object.values(S.vessels).forEach(vv=>{if(vv.lat)updateMarker(vv);});
  renderFleet();
  setTab('vessel');
}

// ── Aircraft tracking ─────────────────────────────────────────
const AIRCRAFT_API = 'https://api.airplanes.live/v2/reg/';
const AIRCRAFT_POLL_MS = 60000;

async function pollAircraft() {
  if(!map) return;
  const regs = Object.keys(AIRCRAFT_DB);
  for(const reg of regs) {
    try {
      const res = await fetch(AIRCRAFT_API + encodeURIComponent(reg));
      if(!res.ok) continue;
      const data = await res.json();
      const ac = data.ac?.[0];
      if(!ac?.lat || !ac?.lon) {
        if(S.aircraft[reg] && !S.aircraft[reg]._stale) {
          S.aircraft[reg]._stale = true;
          S.aircraft[reg]._staleTs = Date.now(); // record when we lost the signal
          updateAircraftMarker(reg); // re-render as faded
        }
        continue;
      }
      const prevAc = S.aircraft[reg];
      // Start fresh track if last known position is >4h old (different flight)
      const _track = (prevAc?.ts && Date.now() - prevAc.ts > 4*3600000) ? [] : (prevAc?._track || []);
      const lastPt = _track[_track.length - 1];
      const moved = !lastPt || Math.abs(lastPt[0] - ac.lat) > 0.001 || Math.abs(lastPt[1] - ac.lon) > 0.001;
      if (moved) {
        _track.push([ac.lat, ac.lon]);
        if (_track.length > 500) _track.shift();
      }
      const acTs = data.now || Date.now();
      S.aircraft[reg] = {
        reg,
        lat: ac.lat, lon: ac.lon,
        alt: ac.alt_baro,
        gs: ac.gs,
        track: ac.track ?? 0,
        hex: ac.hex,
        ts: acTs,
        _stale: false,
        _track,
      };
      if (moved) maybeSBAcPos(reg, ac.lat, ac.lon, ac.alt_baro, ac.gs, ac.track ?? 0, acTs);
      updateAircraftMarker(reg);
    } catch(_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  renderFleet();
}

function updateAircraftMarker(reg) {
  if(!map || !aircraftLayer) return;
  const ac = S.aircraft[reg];
  const db = AIRCRAFT_DB[reg];
  if(!ac?.lat || !ac?.lon || !db) return;
  const col = opColor(db.operator);
  const sz = 16;
  const t = ac.track || 0;
  const isHelo = db.type === 'helicopter';
  const opacity = ac._stale ? 0.35 : 1;
  const fill = ac._stale ? 'none' : col;
  const shape = isHelo
    ? `<circle cx="10" cy="10" r="5" fill="none" stroke="${col}" stroke-width="1.8" opacity="${opacity}"/>
       <line x1="10" y1="4" x2="10" y2="16" stroke="${col}" stroke-width="1.5" opacity="${opacity}"/>
       <line x1="4" y1="10" x2="16" y2="10" stroke="${col}" stroke-width="1.5" opacity="${opacity}"/>`
    : `<polygon points="10,2 13,16 10,12 7,16" fill="${fill}" stroke="${col}" stroke-width="0.5" opacity="${opacity}"/>`;
  const svg = `<svg width="${sz}" height="${sz}" viewBox="0 0 20 20" style="transform:rotate(${t}deg);transform-origin:50% 50%;display:block">
    ${shape}
  </svg>`;
  const icon = L.divIcon({html:svg, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], className:''});
  const staleNote = ac._stale && ac._staleTs ? `<br><span style="color:#ffcc00;font-size:10px">last seen ${ageStr(ac._staleTs)}</span>` : '';
  const alt = !ac._stale && ac.alt != null ? `<br><span style="color:var(--t3);font-size:10px">${Math.round(ac.alt).toLocaleString()} ft</span>` : '';
  const spd = !ac._stale && ac.gs != null ? ` · <b style="color:#00ff88">${Math.round(ac.gs)} kn</b>` : '';
  const tooltip = `<b style="color:${col}">${esc(db.abbr)}</b>${spd}<br>
    <span style="color:var(--t5)">${esc(db.operator)}</span><br>${esc(db.role)}${alt}${staleNote}`;
  if(!aircraftMarkers[reg]) {
    aircraftMarkers[reg] = L.marker([ac.lat, ac.lon], {icon, zIndexOffset:500})
      .addTo(aircraftLayer)
      .on('click', () => showAircraftDetail(reg));
  } else {
    aircraftMarkers[reg].setLatLng([ac.lat, ac.lon]);
    aircraftMarkers[reg].setIcon(icon);
  }
  aircraftMarkers[reg].bindTooltip(tooltip, {className:'ltt', direction:'auto'});

  // Draw flight path track
  if (ac._track && ac._track.length > 1) {
    const trackStyle = { color: col, weight: 1.5, opacity: ac._stale ? 0.2 : 0.45, dashArray: ac._stale ? '3 6' : null };
    if (aircraftTracks[reg]) {
      aircraftTracks[reg].setLatLngs(ac._track);
      aircraftTracks[reg].setStyle(trackStyle);
    } else {
      aircraftTracks[reg] = L.polyline(ac._track, trackStyle).addTo(aircraftLayer).on('click', () => showAircraftDetail(reg));
    }
  }
}


window.onload=()=>{
  loadLS();

  if(SHARE_MODE) {
    document.body.classList.add('share-mode');
    const sub=document.getElementById('hsubtitle');
    if(sub) sub.textContent='GLOBAL FLEET · AIS + ADS-B · SPACEX · BLUE ORIGIN · ROCKET LAB · ULA';
  }

  SB.init();
  initTZSelect();
  initMap();
  renderOpLegend();
  if (localStorage.getItem('legend_collapsed') === '1') {
    const ops  = document.getElementById('mapleg-ops');
    const chev = document.getElementById('legend-chevron');
    if (ops)  ops.style.display  = 'none';
    if (chev) chev.textContent = '▸';
  }
  renderFleet();
  renderRight();
  updateHeaderStats();
  updateTerminator();
  setInterval(updateTerminator, 60000);
  setInterval(()=>{
    renderFleet(); updateHeaderStats(); updateTrajectoryArcs();
    // Show/hide OPS tab and auto-switch on launch entry (admin only)
    if (!SHARE_MODE) {
      const active = getActiveOpsLaunch();
      const opsBtn = document.getElementById('rtab-ops');
      if (opsBtn) opsBtn.style.display = active ? '' : 'none';
      if (active && active.id !== _opsAutoId) {
        _opsAutoId = active.id;
        if (S.tab === 'events') setTab('ops');
      }
    }
  }, 5000);

  // Single Supabase load → then realtime subscription + vapiPositions
  loadSBData().then(() => { loadVapiPositions(); initSBRealtime(); });
  setInterval(loadSBData, 15000); // poll every 15s — bulk query is cheap, matches vessel write throttle
  fetchMissionsBackground().then(()=>{ renderLaunchBanner(); updateBoosterProjections(); updateTrajectoryArcs(); });
  pollAircraft();
  setInterval(pollAircraft, AIRCRAFT_POLL_MS);
  fetchTLEs();
  fetchDockedManifest();
  setInterval(()=>{ fetchTLEs(); fetchDockedManifest(); }, 3600000);
  setInterval(()=>{ updateOrbits(); renderFleet(); }, 15000);

  if(!SHARE_MODE && !localStorage.getItem(LS.KEY)) showSettings();
  if(!SHARE_MODE && SB.ready) checkSuggestionsBadge();
  if(!SHARE_MODE && localStorage.getItem(LS.KEY)) setTimeout(()=>connect(localStorage.getItem(LS.KEY)), 4000);
};
// test
