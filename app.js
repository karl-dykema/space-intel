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


// ── WebSocket ─────────────────────────────────────────────────
function toggleConnect() {
  if(S.ws){disconnect();return;}
  const key=localStorage.getItem(LS.KEY);
  if(!key){showSettings();return;}
  connect(key);
}

let _aisReconnectDelay = 10000; // backoff: 10s → 20s → 40s → ... → 120s max
let _aisReconnectTimer = null;
let _aisManualDisconnect = false;

function scheduleAISReconnect() {
  if (_aisReconnectTimer || _aisManualDisconnect) return;
  const key = localStorage.getItem(LS.KEY);
  if (!key) return;
  const secs = Math.round(_aisReconnectDelay / 1000);
  setDot('off', `Reconnecting in ${secs}s…`);
  addLog(`AIS: reconnecting in ${secs}s`, 'sys');
  _aisReconnectTimer = setTimeout(() => { _aisReconnectTimer = null; connect(key); }, _aisReconnectDelay);
  _aisReconnectDelay = Math.min(_aisReconnectDelay * 2, 120000);
}

function connect(key) {
  setDot('connecting','Connecting to aisstream.io…');
  addLog('Connecting to aisstream.io…', 'sys');
  const btn=document.getElementById('cbtn');
  btn.textContent='…'; btn.disabled=true;
  const timeout=setTimeout(()=>{
    setDot('off','Timeout — check key & network');
    addLog('Connection timeout','err');
    btn.textContent='CONNECT'; btn.disabled=false;
    scheduleAISReconnect();
  },8000);
  const ws=new WebSocket('wss://stream.aisstream.io/v0/stream');
  ws.onopen=()=>{
    clearTimeout(timeout);
    _aisReconnectDelay = 10000; // reset backoff on success
    _aisManualDisconnect = false;
    ws.send(JSON.stringify({
      APIKey:key, BoundingBoxes:[[[-90,-180],[90,180]]],
      FiltersShipMMSI:KNOWN_MMSIS, FilterMessageTypes:['PositionReport','ShipStaticData'],
    }));
    S.ws=ws; btn.textContent='DISCONNECT'; btn.disabled=false; btn.classList.add('on');
    setDot('on','● LIVE');
    addLog(`AIS connected — subscribed to ${KNOWN_MMSIS.length} MMSIs globally`, 'ais');
  };
  ws.onmessage=async ev=>{
    try{
      const text=ev.data instanceof Blob?await ev.data.text():ev.data;
      const msg=JSON.parse(text);
      const rawMMSI=msg.MetaData?.MMSI_String||msg.MetaData?.MMSI||'';
      if(rawMMSI&&!VESSEL_DB[String(rawMMSI)]) addLog(`AIS rcv unknown MMSI ${rawMMSI}`, 'ais');
      handleAIS(msg);
    }catch(e){addLog(`AIS parse error: ${e.message}`,'err');}
  };
  ws.onclose=ev=>{
    clearTimeout(timeout);
    S.ws=null; btn.textContent='CONNECT'; btn.disabled=false; btn.classList.remove('on');
    const badKey = ev.code===4001||ev.code===4003;
    setDot('off', badKey ? 'Invalid API key — check ⚙ SETTINGS' : `Disconnected (${ev.code})`);
    addLog(`AIS ${badKey?'invalid key':'disconnected'} (code ${ev.code})`, badKey?'err':'sys');
    if (!badKey) scheduleAISReconnect();
  };
  ws.onerror=()=>{clearTimeout(timeout);setDot('off','Connection error');addLog('AIS WebSocket error','err');};
}

function disconnect() {
  _aisManualDisconnect = true;
  if (_aisReconnectTimer) { clearTimeout(_aisReconnectTimer); _aisReconnectTimer = null; }
  if(S.ws){S.ws.close();S.ws=null;}
  Object.values(markers).forEach(m=>{try{layers?.removeLayer(m);}catch(e){}});
  Object.values(tracks).forEach(t=>{try{layers?.removeLayer(t);}catch(e){}});
  for(const k in markers)delete markers[k];
  for(const k in tracks)delete tracks[k];
  Object.keys(S.vessels).forEach(mmsi=>{
    if(!S.vessels[mmsi]._historical) delete S.vessels[mmsi];
  });
  document.getElementById('cbtn').textContent='CONNECT';
  document.getElementById('cbtn').classList.remove('on');
  setDot('off','Disconnected');
  renderFleet(); renderRight();
}

function setDot(state,msg){
  document.getElementById('pdot').className='pulse-dot '+state;
  document.getElementById('cstatus').textContent=msg;
}

// ── Settings modal ────────────────────────────────────────────
function showSettings() {
  const modal=document.getElementById('settingsmodal');
  modal.style.display='flex';
  modal.onclick=e=>{if(e.target===modal)closeSettings();};
  const k=localStorage.getItem(LS.KEY)||'';
  document.getElementById('key-input').value=k?'•'.repeat(20):'';
  document.getElementById('sb-url-input').value=localStorage.getItem(LS.SB_URL)||'';
  const sk=localStorage.getItem(LS.SB_AKEY)||'';
  document.getElementById('sb-key-input').value=sk?'•'.repeat(20):'';
  document.getElementById('settings-msg').textContent='';
  loadSuggestions();
}
function closeSettings(){document.getElementById('settingsmodal').style.display='none';}

function saveSettings() {
  const keyVal  =document.getElementById('key-input').value.trim();
  const sbUrl   =document.getElementById('sb-url-input').value.trim();
  const sbKeyVal=document.getElementById('sb-key-input').value.trim();
  if(keyVal   &&!keyVal.startsWith('•'))    localStorage.setItem(LS.KEY,    keyVal);
  if(sbUrl)                                  localStorage.setItem(LS.SB_URL, sbUrl);
  if(sbKeyVal &&!sbKeyVal.startsWith('•'))  localStorage.setItem(LS.SB_AKEY,sbKeyVal);
  document.getElementById('settings-msg').textContent='Saved ✓';
  setTimeout(closeSettings,600);

  const newKey=localStorage.getItem(LS.KEY);
  if(newKey){if(S.ws)disconnect();connect(newKey);}
  SB.init();
  loadSBData();
}

document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.getElementById('settingsmodal').style.display!=='none') saveSettings();
  if(e.key==='Escape'){ closeSettings(); closeSuggestModal(); closeSources(); }
});

// ── Header stats ──────────────────────────────────────────────
const _cycleIdx={};
function cycleVessels(mmsis, key) {
  if(!mmsis.length) return;
  _cycleIdx[key] = ((_cycleIdx[key]||0) % mmsis.length);
  selectVessel(mmsis[_cycleIdx[key]]);
  _cycleIdx[key]++;
}
function cycleAircraft(regs, key) {
  if(!regs.length) return;
  _cycleIdx[key] = ((_cycleIdx[key]||0) % regs.length);
  showAircraftDetail(regs[_cycleIdx[key]]);
  _cycleIdx[key]++;
}
function cycleSpacecraft() {
  const primaries = clusterSpacecraft().filter(c=>S_spacecraft[c.primary]?.lat!=null).map(c=>c.primary);
  if(!primaries.length) return;
  _cycleIdx['sc'] = ((_cycleIdx['sc']||0) % primaries.length);
  showSpacecraftDetail(primaries[_cycleIdx['sc']]);
  _cycleIdx['sc']++;
}

function updateHeaderStats(){
  const now=Date.now();
  const safeArr=a=>JSON.stringify(a).replace(/"/g,"'");
  let rows;
  if(SHARE_MODE) {
    const STALE=14*24*3600000;
    const tracked=Object.values(S.vessels).filter(v=>v.lat&&v.ts&&(now-v.ts<STALE));
    const underway=tracked.filter(v=>v.sog!=null&&v.sog>0.5&&!isNearPort(v.lat,v.lon));
    const stationary=tracked.filter(v=>!underway.includes(v));
    const airborneRegs=Object.keys(AIRCRAFT_DB).filter(r=>{const ac=S.aircraft[r];return ac&&!ac._stale&&ac.alt!=='ground';});
    const orbitingSC2=clusterSpacecraft().filter(c=>S_spacecraft[c.primary]?.lat!=null).length;
    const underwayMMSIs=underway.map(v=>v.mmsi);
    const stationaryMMSIs=stationary.map(v=>v.mmsi);
    rows=[
      [underway.length,  'UNDERWAY',  '#00ff88',`cycleVessels(${safeArr(underwayMMSIs)},'underway')`,'MARINE ASSETS'],
      [stationary.length,'STATIONARY','#338855',`cycleVessels(${safeArr(stationaryMMSIs)},'stationary')`,'MARINE ASSETS'],
      [airborneRegs.length,'AIRBORNE ASSETS','#ffcc00',`cycleAircraft(${safeArr(airborneRegs)},'airborne')`],
      [orbitingSC2,'SPACE ASSETS','#00d4ff','cycleSpacecraft()'],
    ];
  } else {
    const live=Object.values(S.vessels).filter(v=>v.lat&&!v._vapi&&v.ts&&(now-v.ts<600000));
    const moving=live.filter(v=>v.sog>0.5).length;
    const liveMMSIs    =live.map(v=>v.mmsi);
    const underwayMMSIs=live.filter(v=>v.sog>0.5).map(v=>v.mmsi);
    const airborneRegs =Object.keys(AIRCRAFT_DB).filter(r=>{ const ac=S.aircraft[r]; return ac&&!ac._stale&&ac.alt!=='ground'; });
    const orbitingSC   =clusterSpacecraft().filter(c=>S_spacecraft[c.primary]?.lat!=null).length;
    const stationaryMMSIs=live.filter(v=>v.sog<=0.5).map(v=>v.mmsi);
    rows=[
      [moving,             'UNDERWAY',  '#00ff88',`cycleVessels(${safeArr(underwayMMSIs)},'underway')`,'MARINE ASSETS'],
      [live.length-moving, 'STATIONARY','#338855',`cycleVessels(${safeArr(stationaryMMSIs)},'stationary')`,'MARINE ASSETS'],
      [airborneRegs.length,'AIRBORNE ASSETS','#ffcc00',`cycleAircraft(${safeArr(airborneRegs)},'airborne')`],
      [orbitingSC,         'SPACE ASSETS',  '#00d4ff','cycleSpacecraft()'],
    ];
    if(S.ws) {
      const parts=[`${KNOWN_MMSIS.length} vessels`];
      if(Object.keys(S.aircraft||{}).length) parts.push(`${Object.keys(S.aircraft).length} aircraft`);
      if(orbitingSC) parts.push(`${orbitingSC} spacecraft`);
      document.getElementById('cstatus').textContent='● LIVE — '+parts.join(' · ');
    }
  }
  document.getElementById('hstats').innerHTML=rows
    .map(([v,l,c,fn,grp])=>`<div onclick="${fn||''}" style="cursor:${v>0&&fn?'pointer':'default'};text-align:center" title="${l}">
      <div class="sv" style="color:${c}">${v}</div>
      <div class="sl" style="text-decoration:${v>0&&fn?'underline':'none'};text-underline-offset:2px">${l}</div>
      ${grp?`<div style="font-size:8px;color:var(--t5);letter-spacing:.06em;margin-top:1px">${grp}</div>`:''}
    </div>`).join('');
}

// ── Operator legend ───────────────────────────────────────────
function renderOpLegend(){}

// ── Fleet roster ──────────────────────────────────────────────
function renderFleet(){
  const now2=Date.now();
  const lc=Object.values(S.vessels).filter(v=>v.lat&&!v._historical&&v.ts&&(now2-v.ts<600000)).length;
  const total=KNOWN_MMSIS.length;
  document.getElementById('lhdr').textContent=S.ws?`FLEET · ${lc} LIVE · ${total-lc} OFFLINE`:'FLEET ROSTER';
  const STALE_14D = 14*24*3600000;
  const now=Date.now();

  const vesselRank=v=>{
    // In share mode treat fresh Supabase positions as live (ignore _historical flag)
    const isLive=!!v.lat&&!!v.ts&&(now-v.ts<600000)&&!v._vapi;
    const hasPos=!!v.lat&&!!v.ts;
    const carrying=!!isCarryingBooster(v.mmsi);
    if(carrying&&isLive) return 0;
    if(isLive) return 1;
    if(carrying) return 2;
    if(hasPos) return 3;
    return 4; // never seen
  };
  const acRank=reg=>{
    const ac=S.aircraft[reg];
    if(!ac) return 5;
    if(!ac._stale&&ac.alt!=='ground') return 0;
    if(!ac._stale&&(ac.gs||0)>3) return 1;
    if(!ac._stale) return 2;
    if(ac._staleTs&&now-ac._staleTs<3600000) return 3;
    return 4;
  };

  // All vessels — filter never-seen (no position ever) and share-mode stale
  const allVessels=KNOWN_MMSIS
    .map(mmsi=>S.vessels[mmsi]||{mmsi,...VESSEL_DB[mmsi],_offline:true})
    .filter(v=>{
      if(SHARE_MODE && v.ts && (now-v.ts >= STALE_14D)) return false;
      if(VESSEL_DB[v.mmsi]?.background && !v.lat) return false; // background: only show when spotted
      return true; // always show non-background vessels even if never seen
    })
    .sort((a,b)=>{ const ra=vesselRank(a),rb=vesselRank(b); return ra!==rb?ra-rb:(b.ts||0)-(a.ts||0); });

  // Aircraft — background only if spotted this session
  const allAC=Object.keys(AIRCRAFT_DB)
    .filter(reg=>!AIRCRAFT_DB[reg].background||!!S.aircraft[reg])
    .sort((a,b)=>{ const ra=acRank(a),rb=acRank(b); if(ra!==rb) return ra-rb;
      return (S.aircraft[b]?._staleTs||S.aircraft[b]?.ts||0)-(S.aircraft[a]?._staleTs||S.aircraft[a]?.ts||0); });

  // Spacecraft clusters — roster always shows all; map layer visibility controlled by toggle
  const scClusters=clusterSpacecraft();
  scClusters.sort((a,b)=>(a.longterm?1:0)-(b.longterm?1:0)||a.primary.localeCompare(b.primary));

  const scHTML=showSpacecraft?scClusters.map(buildSpacecraftRow).filter(Boolean).join(''):'';

  // Active = live vessels + airborne aircraft + orbiting spacecraft — all snap to top
  // Only genuinely underway vessels go to ACTIVE.
  // 1.5 kn threshold filters dock GPS drift (rarely exceeds 1 kn).
  // isNearPort guards against slow harbour maneuvering.
  const isVesselActive = v => {
    const age = v.ts ? now - v.ts : Infinity;
    const isLive = !!v.lat && !!v.ts && age < 600000 && !v._vapi;
    const moving = isLive && (v.sog || 0) > 0.5;
    const carrying = !!isCarryingBooster(v.mmsi);
    return moving || (carrying && isLive);
  };
  const isACairborne = r => acRank(r) === 0;
  const isOrbit      = c => S_spacecraft[c.primary]?.lat != null;

  const activeRows = [
    ...(showVessels    ? allVessels.filter(isVesselActive).map(buildVesselRow)               : []),
    ...(showAircraft   ? allAC.filter(isACairborne).map(buildAircraftRow)                    : []),
    ...(showSpacecraft ? scClusters.filter(isOrbit).map(buildSpacecraftRow).filter(Boolean)  : []),
  ].join('');

  const inactVesselHTML = showVessels    ? allVessels.filter(v=>!isVesselActive(v)).map(buildVesselRow).join('')   : '';
  const inactACHTML     = showAircraft   ? allAC.filter(r=>!isACairborne(r)).map(buildAircraftRow).join('')        : '';
  const inactSCHTML     = showSpacecraft ? scClusters.filter(c=>!isOrbit(c)).map(buildSpacecraftRow).filter(Boolean).join('') : '';

  const hdr = (label, mt=true) => `<div class="lhdr" style="font-size:10px;color:var(--t4)${mt?';margin-top:10px':''}">${label}</div>`;
  const parts = [];
  if (activeRows)     parts.push(`<div class="lhdr" style="font-size:10px;color:#00ff88;letter-spacing:.08em">● ACTIVE</div>${activeRows}`);
  if (inactVesselHTML) parts.push(hdr('VESSELS', parts.length>0) + inactVesselHTML);
  if (inactACHTML)     parts.push(hdr('AIRCRAFT', parts.length>0) + inactACHTML);
  if (inactSCHTML)     parts.push(hdr('SPACECRAFT', parts.length>0) + inactSCHTML);

  const facClusters = detectFacilityClusters();
  if (facClusters.length) {
    const facHTML = facClusters.map(f => {
      const names = [...f.vessels].slice(0, 3).join(', ') + (f.vessels.size > 3 ? ` +${f.vessels.size - 3}` : '');
      const knownPt = LANDMARKS.find(p => {
        const dLat = f.lat - p.lat, dLon = f.lon - p.lon;
        return Math.sqrt(dLat*dLat + dLon*dLon) * 111 < 10;
      });
      const label = knownPt ? knownPt.name : `${f.lat.toFixed(3)}°, ${f.lon.toFixed(3)}°`;
      return `<div class="vrow" onclick="map&&map.setView([${f.lat.toFixed(5)},${f.lon.toFixed(5)}],10)" style="cursor:pointer">
        <div class="vn" style="color:var(--t2);font-size:12px">${esc(label)}</div>
        <div class="vop" style="color:var(--t4)">${esc(names)}</div>
        <div class="vbottom">
          <div class="vdot" style="background:#ffcc00;box-shadow:0 0 4px #ffcc0066"></div>
          <span style="color:var(--t3);font-size:10px">${f.count} stop${f.count>1?'s':''} · ${f.vessels.size} vessel${f.vessels.size>1?'s':''}</span>
        </div>
      </div>`;
    }).join('');
    parts.push(hdr('DETECTED LOCATIONS', true) + facHTML);
  }

  document.getElementById('fleet').innerHTML = parts.join('');
  document.querySelectorAll('.vrow[data-mmsi]').forEach(el=>{el.onclick=()=>selectVessel(el.dataset.mmsi);});
  document.querySelectorAll('.vrow[data-reg]').forEach(el=>{el.onclick=()=>showAircraftDetail(el.dataset.reg);});
  document.querySelectorAll('.vrow[data-sc]').forEach(el=>{el.onclick=()=>showSpacecraftDetail(el.dataset.sc);});
}

function buildVesselRow(v){
  const sel=S.selected===v.mmsi, col=opColor(v.operator);
  const now2=Date.now(), age2=v.ts?now2-v.ts:Infinity;
  const isLive=!!v.lat&&!!v.ts&&age2<600000;
  const isRecent=!!v.lat&&!!v.ts&&age2<7200000; // <2h, not fully stale
  const isHist=v._historical&&!SHARE_MODE;
  const stale=!!v.lat&&!isRecent&&!isHist;
  const isOffline=v._offline||(!v.lat&&!isHist);
  const carrying=isCarryingBooster(v.mmsi);
  const stationary=isLive&&(v.sog==null||v.sog<=0.1);
  const moving=isLive&&!stationary;
  const recentMoving=!moving&&isRecent&&(v.sog!=null&&v.sog>0.5)&&!isNearPort(v.lat,v.lon);
  const recentStationary=!moving&&!stationary&&isRecent&&!recentMoving;
  const deployed=!isLive&&!isRecent&&deployedFleet.has(v.mmsi);
  const dotCol=moving?'#00ff88':stationary?'#338855':carrying?'#ff8c00':recentMoving?'#44cc77':recentStationary?'#226644':deployed?'#ff8c00':'#2a3a4a';
  const maneuvering=moving&&isNearPort(v.lat,v.lon);
  const status=maneuvering?'MANEUVERING':moving?'UNDERWAY':stationary?'DOCKED / STATIONARY':carrying&&!isLive?(carrying._transit?'BOOSTER EXPECTED':'NO AIS LOCK'):recentMoving?`UNDERWAY · LAST PING ${ageStr(v.ts)}`:recentStationary?`STATIONARY · ${ageStr(v.ts)}`:deployed?'DEPLOYED · OUT OF AIS RANGE':v.ts?`NO SIGNAL · ${ageStr(v.ts)}`:'NO SIGNAL';
  const nameCol=moving?col:stationary?col+'99':recentMoving?col:recentStationary?col+'88':v.ts?'var(--t3)':'var(--t4)';
  const roleCol=moving?col+'99':stationary?col+'55':recentMoving?col+'88':'var(--t4)';
  const bg=moving?(sel?'var(--bg4)':'rgba(0,200,255,.03)'):stationary?(sel?'var(--bg4)':''):recentMoving?(sel?'var(--bg4)':'rgba(0,200,100,.015)'):sel?'var(--bg4)':'';
  const borderCol=moving?col:stationary?col+'55':recentMoving?col+'88':'transparent';
  return `<div class="vrow${sel?' sel':''}" data-mmsi="${esc(v.mmsi)}"
    style="border-left-color:${borderCol}${bg?';background:'+bg:''}${moving?';box-shadow:inset 2px 0 8px '+col+'22':''}">
    <div class="vn" style="color:${nameCol};${moving?'text-shadow:0 0 12px '+col+'66':''}">${esc(v.abbr||v.name)}</div>
    <div class="vop" style="color:${roleCol}">${esc(v.operator)} · ${esc(v.role)}</div>
    ${carrying?`<div style="font-size:10px;font-weight:700;color:#ff8c00;letter-spacing:.04em;margin-top:2px">🚀 ${carrying._transit?'BOOSTER ABOARD · RETURNING TO PORT':'BOOSTER RECOVERY · '+esc(carrying.name||'')}</div>`:''}
    <div class="vbottom">
      <div class="vdot" style="background:${dotCol}${moving?';box-shadow:0 0 5px '+dotCol+'88':''}"></div>
      <span style="color:${dotCol};font-size:10px;font-weight:${isLive?'700':'400'}">${status}</span>
      ${v.sog!=null&&moving?`<span style="color:var(--t2);font-size:11px;margin-left:4px">${v.sog.toFixed(1)} kn</span>`:''}
      ${v.dest&&(isLive||isRecent)?`<span style="color:${isLive?'var(--t)':'var(--t5)'};font-size:10px;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px">→ ${esc(v.dest)}</span>`:''}
    </div>
  </div>`;
}

function buildAircraftRow(reg) {
  const db = AIRCRAFT_DB[reg];
  const ac = S.aircraft[reg];
  const col = opColor(db.operator);
  const hasLive = !!ac && !ac._stale;
  const airborne = hasLive && ac.alt !== 'ground';
  const taxiing  = hasLive && ac.alt === 'ground' && (ac.gs || 0) > 3;
  const recentLanded = ac?._stale && ac?.lat && ac?._staleTs && ac?.alt === 'ground' && (Date.now() - ac._staleTs < 3600000);
  const staleAirborne = ac?._stale && ac?.alt !== 'ground' && ac?.lat;
  const dotCol = airborne ? '#00ff88' : taxiing ? '#88dd44' : recentLanded ? '#ffcc00' : staleAirborne ? '#ffcc0044' : '#2a4a5a';
  const status = airborne ? 'AIRBORNE' : taxiing ? 'TAXIING' : recentLanded ? `LANDED ${ageStr(ac._staleTs)}` : staleAirborne ? `NO SIGNAL · ${ageStr(ac._staleTs)}` : 'ON GROUND';
  const alt = airborne && ac.alt != null ? ` · ${Math.round(ac.alt).toLocaleString()}ft` : '';
  const spd = (airborne || taxiing) && ac.gs != null ? ` · ${Math.round(ac.gs)}kn` : '';
  const active = airborne || taxiing;
  return `<div class="vrow" data-reg="${esc(reg)}" style="border-left-color:${active?col:recentLanded?col+'55':'transparent'}${active?';background:rgba(0,200,255,.03)':''}">
    <div class="vn" style="color:${active?col:recentLanded?'var(--t2)':'var(--t3)'}">${esc(db.abbr)}</div>
    <div class="vop" style="color:${active?col+'99':col+'33'}">${esc(db.operator)} · ${esc(db.model)}</div>
    <div class="vbottom">
      <div class="vdot" style="background:${dotCol}${active?';box-shadow:0 0 5px '+dotCol+'88':''}"></div>
      <span style="color:${dotCol};font-size:10px;font-weight:${active?'700':'400'}">${status}</span>
      ${active?`<span style="color:var(--t4);font-size:10px;margin-left:4px">${alt}${spd}</span>`:''}
    </div>
  </div>`;
}

// ── Right panel tabs ──────────────────────────────────────────
function setTab(t){
  S.tab=t;
  ['events','vessel','history','log','ops'].forEach(id=>{
    const b=document.getElementById('rtab-'+id); if(b) b.classList.toggle('act',id===t);
  });
  if(t==='log'){
    logUnread=0;
    const badge=document.getElementById('log-badge');
    if(badge) badge.style.display='none';
  }
  if(t==='ops') startOpsTicker();
  else { if(opsTicker){ clearInterval(opsTicker); opsTicker=null; } }
  renderRight();
}
function renderRight(){
  const el=document.getElementById('rpanel');
  if(S.tab==='events')     el.innerHTML=buildEventFeed();
  if(S.tab==='vessel')     { el.innerHTML=buildVesselDetail(); startCountdowns(); }
  if(S.tab==='aircraft')   el.innerHTML=buildAircraftDetail();
  if(S.tab==='spacecraft') el.innerHTML=buildSpacecraftDetail();
  if(S.tab==='history')    el.innerHTML=buildHistoryTab();
  if(S.tab==='log')        el.innerHTML=buildLogTab();
  if(S.tab==='ops')        el.innerHTML=buildOpsPanel(getActiveOpsLaunch());
}

function showAircraftDetail(reg) {
  S.selectedAircraft = reg;
  const ac = S.aircraft[reg];
  if(ac?.lat && ac?.lon && map) map.setView([ac.lat, ac.lon], 7);
  S.tab = 'aircraft';
  ['events','vessel','history','log'].forEach(id => {
    document.getElementById('rtab-'+id).classList.toggle('act', false);
  });
  document.getElementById('rtab-vessel').classList.add('act');
  renderRight();
}

function buildAircraftDetail() {
  const reg = S.selectedAircraft;
  if(!reg) return '<div style="padding:16px;color:var(--t4);font-size:12px">No aircraft selected.</div>';
  const db = AIRCRAFT_DB[reg];
  const ac = S.aircraft[reg];
  const col = opColor(db.operator);
  const hasLive = !!ac && !ac._stale;
  const airborne = hasLive && ac?.alt !== 'ground';
  const taxiing  = hasLive && ac?.alt === 'ground' && (ac?.gs || 0) > 3;
  const recentLanded = ac?._stale && ac?.lat && ac?._staleTs && ac?.alt === 'ground' && (Date.now() - ac._staleTs < 3600000);
  const alt = ac?.alt != null && ac.alt !== 'ground' ? Math.round(ac.alt).toLocaleString()+'ft' : '—';
  const spd = ac?.gs != null ? Math.round(ac.gs)+' kn' : '—';
  const hdg = ac?.track != null ? Math.round(ac.track)+'°' : '—';
  const pos = ac?.lat ? `${ac.lat.toFixed(4)}, ${ac.lon.toFixed(4)}` : 'No position';
  const lastFixTs = ac?._staleTs || ac?.ts;
  const staleAirborneD = ac?._stale && ac?.alt !== 'ground' && ac?.lat;
  const statusLabel = airborne ? 'AIRBORNE' : taxiing ? 'TAXIING' : recentLanded ? `LANDED ${ageStr(ac._staleTs)}` : staleAirborneD ? 'NO SIGNAL' : 'ON GROUND';
  const statusCol   = airborne ? '#00ff88' : taxiing ? '#88dd44' : recentLanded ? '#ffcc00' : staleAirborneD ? '#ffcc00' : 'var(--t4)';
  return `<div style="padding:14px 16px">
    ${db.photo?`<img src="${esc(db.photo)}" style="width:100%;max-height:160px;object-fit:cover;border-radius:3px;margin-bottom:10px;background:#0a1a2a" loading="lazy" onerror="this.style.display='none'">`:''}
    <div style="font-size:18px;font-weight:700;color:${col};letter-spacing:.04em;margin-bottom:2px">${esc(db.name)}</div>
    <div style="font-size:12px;color:var(--t4);margin-bottom:12px">${esc(db.operator)} · ${esc(db.model)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">
      ${stat('STATUS', statusLabel, statusCol)}
      ${stat('LAST FIX', lastFixTs ? ageStr(lastFixTs) : '—', 'var(--t2)')}
      ${stat('POSITION', pos, 'var(--t2)')}
      ${stat('ALTITUDE', alt, 'var(--t2)')}
      ${stat('SPEED', spd, 'var(--t2)')}
      ${stat('HEADING', hdg, 'var(--t2)')}
      ${stat('REG', reg, col)}
    </div>
    ${db.history?.length?`<div style="margin-bottom:10px">${db.history.map(h=>`<div style="font-size:11px;color:var(--t4);line-height:1.7;padding-left:8px;border-left:2px solid var(--bdr2)">· ${esc(h)}</div>`).join('')}</div>`:''}
    <div style="font-size:11px;color:var(--t5);line-height:1.6">${esc(db.notes||'')}</div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <a href="https://globe.adsbexchange.com/?icao=${esc(ac?.hex||'')}" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none${!ac?.hex?';opacity:.4;pointer-events:none':''}">ADSBEXCHANGE ↗</a>
      ${db.operator!=='SpaceX'?`
      <a href="https://www.flightaware.com/live/flight/${encodeURIComponent(reg.replace(/-/g,''))}" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none">FLIGHTAWARE ↗</a>
      <a href="https://www.flightradar24.com/data/aircraft/${encodeURIComponent(reg.toLowerCase())}" target="_blank"
        style="font-size:11px;color:var(--acc);border:1px solid var(--acc)33;padding:3px 10px;text-decoration:none">FLIGHTRADAR24 ↗</a>`:''}
    </div>
  </div>`;
}
function stat(label,val,col){return`<div style="background:var(--bg3);padding:8px 10px;border-radius:2px"><div style="font-size:9px;color:var(--t4);letter-spacing:.08em;margin-bottom:2px">${label}</div><div style="font-size:12px;font-weight:600;color:${col}">${val}</div></div>`;}


// ── Event feed ────────────────────────────────────────────────
function buildBoosterCards() {
  const carrying = KNOWN_MMSIS
    .map(mmsi => ({ mmsi, mission: isCarryingBooster(mmsi) }))
    .filter(x => x.mission);
  if(!carrying.length) return '';
  return carrying.map(({mmsi, mission}) => {
    const db = VESSEL_DB[mmsi];
    const col = opColor(db?.operator);
    const net = mission.net ? new Date(mission.net).getTime() : null;
    return `<div class="erow" style="border-left-color:#ff8c00;background:rgba(255,140,0,.06);cursor:pointer" onclick="selectVessel('${mmsi}')">
      <div style="font-size:10px;font-weight:700;color:#ff8c00;letter-spacing:.08em;margin-bottom:4px">🚀 BOOSTER ABOARD</div>
      <div class="ename" style="color:${col}">${esc(db?.abbr||db?.name||mmsi)}</div>
      <div class="edetail">${esc(mission.name||'')} · launched ${net?ageStr(net):'—'}</div>
      <div style="font-size:11px;color:var(--t4);margin-top:3px">En route back to port</div>
    </div>`;
  }).join('');
}

function buildEventFeed(){
  const boosterCards = buildBoosterCards();
  if(!events.length) return boosterCards + (SHARE_MODE
    ? `<div class="empty">No events yet — position history loads on page open.</div>`
    : `<div class="empty">Connect AIS stream — events appear here in real time.<br><br>
    Detects: zone entries · underway/moored · AIS gaps · destination changes</div>`);
  return boosterCards + events.slice(0,200).map(buildEventRow).join('');
}
function buildEventRow(ev){
  const cfg=EV_CFG[ev.type]||{icon:'·',color:'#888'};
  return`<div class="erow" style="border-left-color:${esc(cfg.color)};cursor:pointer" onclick="selectVessel('${esc(ev.mmsi)}')">
    <div class="etime">${tsStr(ev.ts)}</div>
    <div style="display:flex;align-items:center;margin-bottom:2px">
      <span style="font-size:12px;margin-right:5px">${cfg.icon}</span>
      <span class="etype" style="color:${esc(cfg.color)}">${esc(ev.type)}</span>
      <span class="eop" style="color:${esc(ev.opColor)};border:1px solid ${esc(ev.opColor)}33">${esc(ev.operator)}</span>
    </div>
    <div class="ename" style="color:${esc(ev.opColor)};text-decoration:underline;text-underline-offset:2px">${esc(ev.name)}</div>
    <div class="edetail">${esc(ev.detail)}</div>
    ${ev.lat?`<div style="font-size:10px;color:var(--t4);margin-top:2px">${ev.lat.toFixed(3)}, ${ev.lon.toFixed(3)}</div>`:''}
  </div>`;
}
function prependEventRow(ev){
  const panel=document.getElementById('rpanel');
  if(S.tab!=='events'||!panel) return;
  const existing=panel.querySelectorAll('.erow');
  if(!existing.length){panel.innerHTML=buildEventRow(ev);return;}
  const tmp=document.createElement('div');
  tmp.innerHTML=buildEventRow(ev);
  panel.insertBefore(tmp.firstChild,panel.firstChild);
  while(panel.querySelectorAll('.erow').length>200) panel.removeChild(panel.lastChild);
}
function clearEvents(){events=[];saveLS();renderRight();}

// ── Vessel detail ─────────────────────────────────────────────
function buildVesselDetail(){
  const mmsi=S.selected;
  const db=VESSEL_DB[mmsi];
  if(!mmsi||!db) return`<div class="empty">← Select a vessel from the fleet list.</div>`;
  const live=S.vessels[mmsi];
  const v=live||{mmsi,...db,_offline:true};
  const col=opColor(db.operator), h=history[mmsi];

  const linkedMissions = l => {
    const op=Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'';
    return vesselHintsForLaunch(op, l.pad?.name||'', l.pad?.location?.name||'').includes(mmsi);
  };
  const upcomingMissions = missionsCache.filter(linkedMissions).slice(0,3);
  const recentMissions   = pastMissionsCache.filter(linkedMissions).slice(0,5);
  const carrying         = isCarryingBooster(mmsi);

  return`
    ${db.photo?`<img src="${esc(db.photo)}" style="width:100%;max-height:180px;object-fit:cover;background:#0a1a2a" loading="lazy" onerror="this.style.display='none'">`:''}
    <div class="dhdr" style="border-left:4px solid ${col}">
      <div class="dname" style="color:${col}">${esc(db.name)}</div>
      <div style="font-size:12px;color:var(--t5);margin-top:2px">${esc(db.operator)} · ${esc(db.role)}</div>
      ${db.homePort?`<div style="font-size:12px;color:var(--t4);margin-top:2px">📍 ${esc(db.homePort)}</div>`:''}
    </div>
    <div class="tbody">
      ${!SHARE_MODE&&!db.verified?`<div class="warn-box">⚠ MMSI ${esc(mmsi)} unverified — confirm at marinetraffic.com</div>`:''}
      ${!SHARE_MODE&&v._historical?`<div class="hist-box">📡 Showing last known position (${ageStr(v.ts)}). Connect AIS for live data.</div>`:''}
      ${!SHARE_MODE&&(!v.lat||v._offline)?`<div style="background:rgba(0,0,0,.15);border:1px solid var(--bdr);padding:8px 11px;font-size:12px;color:var(--t4);margin-bottom:6px">NO SIGNAL${v.ts?` · last seen ${ageStr(v.ts)}`:' · never tracked'}. Will appear on map when underway.</div>`:''}

      ${carrying?(()=>{
        const home = DRONE_HOME_PORTS[mmsi];
        const vp = S.vessels[mmsi];
        let distKm = null;
        if(home && vp?.lat) {
          const dLat=vp.lat-home.lat, dLon=(vp.lon-home.lon)*Math.cos(home.lat*Math.PI/180);
          distKm = Math.sqrt(dLat*dLat+dLon*dLon)*111;
        }
        const arriving = distKm != null && distKm < 200;
        const cams = PORT_WEBCAMS[mmsi] || [];
        const camHTML = cams.length ? `
          <div style="margin-top:8px;padding-top:7px;border-top:1px solid #ff8c0033">
            <div style="font-size:10px;color:#ff8c00;font-weight:700;letter-spacing:.06em;margin-bottom:5px">${arriving?'⚠ ARRIVING SOON · ':''}PORT WEBCAMS</div>
            ${cams.map(c=>`<a href="${esc(c.url)}" target="_blank" style="display:block;font-size:12px;color:#44aaff;text-decoration:none;margin-bottom:2px">↗ ${esc(c.label)}</a>${c.lookFor?`<div style="font-size:11px;color:var(--t4);margin-bottom:4px;font-style:italic">${esc(c.lookFor)}</div>`:''}`).join('')}
          </div>` : '';
        return `<div style="background:rgba(255,140,0,.1);border:1px solid #ff8c0066;padding:10px 13px;margin-bottom:6px">
          <div style="font-size:11px;font-weight:700;color:#ff8c00;letter-spacing:.06em;margin-bottom:3px">🚀 ${carrying._transit?'BOOSTER ABOARD · RETURNING TO PORT':'ACTIVE BOOSTER RECOVERY'}</div>
          <div style="font-size:13px;font-weight:600;color:var(--t2)">${esc(carrying.name||'')}</div>
          <div style="font-size:11px;color:var(--t4);margin-top:2px">${carrying._transit?`Landed ${ageStr(new Date(carrying.net).getTime())} ago · transit back to port`:`Launched ${ageStr(new Date(carrying.net).getTime())} · booster recovery in progress`}${distKm!=null?' · '+Math.round(distKm)+'km from port':''}</div>
          ${camHTML}
        </div>`;
      })():''}

      ${upcomingMissions.length?`
        <div class="sec">UPCOMING MISSIONS</div>
        ${upcomingMissions.map(l=>{
          const net=l.net?new Date(l.net).getTime():null;
          const col2=opColor(Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'');
          return`<div style="padding:8px 0;border-bottom:1px solid var(--bdr2)">
            <div style="font-size:13px;font-weight:600;color:${col2}">${esc(l.name||'')}</div>
            <div style="font-size:12px;color:var(--t5)">${esc(l.rocket?.configuration?.name||'')} · ${esc(l.pad?.location?.name||'')}</div>
            ${net?`<div style="font-family:var(--fm);font-size:13px;color:${col2};margin-top:3px" data-net="${net}">calculating…</div>`:''}
          </div>`;
        }).join('')}
      `:''}

      ${recentMissions.length?`
        <div class="sec">RECENT MISSIONS</div>
        ${recentMissions.map(l=>{
          const net=l.net?new Date(l.net).getTime():null;
          const col2=opColor(Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'');
          const status=l.status?.name||'';
          const statusCol=/Success/i.test(status)?'#00ff88':/Failure/i.test(status)?'#ff4444':'#ff8800';
          return`<div style="padding:8px 0;border-bottom:1px solid var(--bdr2)">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="font-size:13px;font-weight:600;color:${col2};flex:1">${esc(l.name||'')}</div>
              ${status?`<span style="font-size:10px;font-weight:700;color:${statusCol}">${esc(status.toUpperCase())}</span>`:''}
            </div>
            <div style="font-size:12px;color:var(--t5);margin-top:2px">${esc(l.rocket?.configuration?.name||'')} · ${net?fmtTime(net):'TBD'}</div>
          </div>`;
        }).join('')}
      `:''}

      <div class="sec">LIVE STATUS</div>
      ${frows([
        ['POSITION', v.lat?`${v.lat.toFixed(4)}°  ${v.lon.toFixed(4)}°`:'—'],
        ['SPEED',    v.sog!=null&&!v._historical&&!v._offline&&!v._vapi&&v.ts&&(Date.now()-v.ts<600000)?v.sog.toFixed(1)+' kn':'—'],
        ['COURSE',   v.cog!=null&&!v._historical&&!v._offline&&!v._vapi&&v.ts&&(Date.now()-v.ts<600000)?Math.round(v.cog)+'°':'—'],
        ['DESTINATION',v.dest||'—'],
        ['ETA',      v.eta||'—'],
        ['LAST FIX', v.ts?ageStr(v.ts):'never'],
      ])}

      <div class="sec">VESSEL IDENTITY</div>
      ${frows([
        ['MMSI',     mmsi],
        ['IMO',      db.imo||v.imo||'—'],
        ['CALLSIGN', v.cs||'—'],
        ['FLAG',     db.flag||'—'],
        ['BUILT',    db.built||'—'],
        ['AIS NAME', v.aisName||'—'],
      ])}

      ${db.specs?`<div class="sec">SPECIFICATIONS</div>
        ${frows(Object.entries(db.specs).map(([k,val])=>[k.toUpperCase(),val]))}`:''}

      ${h?`<div class="sec">TRACKED HISTORY</div>
        ${frows([
          ['FIRST SEEN', tsStr(h.firstSeen)],
          ['LAST SEEN',  tsStr(h.lastSeen)],
          ['POSITIONS',  h.positions.length+' recorded'+(SB.ready?' + Supabase':'')],
        ])}`:''}

      ${db.history?.length?`<div class="sec">BACKGROUND</div>
        <div class="abox">${db.history.map(l=>`• ${esc(l)}`).join('<br>')}</div>`:''}

      <div class="sec">LOOKUPS</div>
      ${[
        ['MarineTraffic', `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}/`],
        ['VesselFinder',  `https://www.vesselfinder.com/vessels/details/${mmsi}`],
        ['space-offshore.com','https://space-offshore.com'],
        ['Google News',   `https://news.google.com/search?q=${encodeURIComponent((db.abbr||db.name)+' vessel')}`],
      ].map(([l,u])=>`<a class="fr" href="${u}" target="_blank" rel="noopener" style="cursor:pointer;text-decoration:none">
        <span class="fk">${l}</span><span class="fv" style="color:#4488bb">↗</span></a>`).join('')}
    </div>`;
}

// ── History tab ───────────────────────────────────────────────
function buildHistoryTab(){
  const mmsi=S.selected;
  const evs=mmsi?events.filter(e=>e.mmsi===mmsi):events;
  const v=mmsi?S.vessels[mmsi]:null;
  const h=mmsi?history[mmsi]:null;
  return`<div class="tbody">
    ${v?`<div style="font-family:var(--fh);font-size:12px;color:${opColor(v.operator)};margin-bottom:8px">${esc(v.abbr||v.name)}</div>`:''}
    ${h?`<div style="font-size:11px;color:var(--t5);margin-bottom:10px">
      ${h.positions.length} positions · first seen ${tsStr(h.firstSeen)}${SB.ready?' · synced to Supabase':''}
    </div>`:''}
    <div class="sec">${mmsi?'VESSEL EVENT LOG':'ALL EVENTS — select vessel to filter'}</div>
    ${evs.length?evs.slice(0,500).map(e=>`
      <div class="fr">
        <span class="fk" style="color:${esc((EV_CFG[e.type]||{}).color||'#888')}">${esc(e.type)}</span>
        <span class="fv" style="font-size:10px;color:var(--t5)">${tsStr(e.ts)}</span>
      </div>
      <div style="font-size:11px;color:var(--t4);padding:2px 0 6px;border-bottom:1px solid var(--bdr2)">${esc(e.detail)}</div>`
    ).join(''):'<div style="color:var(--t4);font-size:12px;padding:12px 0">No events recorded yet.</div>'}
  </div>`;
}

function frows(arr){return arr.map(([k,v])=>`<div class="fr"><span class="fk">${k}</span><span class="fv">${esc(String(v))}</span></div>`).join('');}

// ── Timezone ──────────────────────────────────────────────────
const TZ_OPTIONS = [
  { label:'Local',                     value:'local' },
  { label:'UTC',                       value:'UTC' },
  { label:'Eastern (ET)',              value:'America/New_York' },
  { label:'Central (CT)',              value:'America/Chicago' },
  { label:'Mountain (MT)',             value:'America/Denver' },
  { label:'Pacific (PT)',              value:'America/Los_Angeles' },
  { label:'Hawaii (HT)',               value:'America/Honolulu' },
  { label:'London (GMT/BST)',          value:'Europe/London' },
  { label:'Paris / Berlin (CET/CEST)', value:'Europe/Paris' },
  { label:'Auckland (NZST)',           value:'Pacific/Auckland' },
];

let currentTZ = localStorage.getItem('space_intel_tz') || 'local';

function initTZSelect() {
  const sel = document.getElementById('tz-select');
  if(!sel) return;
  const localLabel = `Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
  TZ_OPTIONS[0].label = localLabel;
  sel.innerHTML = TZ_OPTIONS.map(o=>
    `<option value="${o.value}"${o.value===currentTZ?' selected':''}>${o.label}</option>`
  ).join('');
}

function setTZ(tz) {
  currentTZ = tz;
  localStorage.setItem('space_intel_tz', tz);
  if(document.getElementById('missions-panel').style.display!=='none') showMissions();
}

function fmtTime(ts) {
  if(!ts) return '—';
  const d = new Date(ts);
  const opts = { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short' };
  if(currentTZ==='local') return d.toLocaleString([], opts);
  return d.toLocaleString([], { ...opts, timeZone:currentTZ });
}

// Parse ISO 8601 duration e.g. "-PT38M" → -2280000 ms
function parseISODuration(s) {
  if (!s) return 0;
  const neg = s.startsWith('-');
  const m = s.replace(/^-/, '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!m) return 0;
  const ms = ((+m[1]||0)*86400 + (+m[2]||0)*3600 + (+m[3]||0)*60 + (+m[4]||0)) * 1000;
  return neg ? -ms : ms;
}
function formatDur(ms) {
  const abs = Math.abs(ms);
  const h = Math.floor(abs/3600000), mn = Math.floor((abs%3600000)/60000), s = Math.floor((abs%60000)/1000);
  return h ? `${h}:${String(mn).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${mn}:${String(s).padStart(2,'0')}`;
}

function formatTPlus(ms) {
  const sign = ms < 0 ? 'T−' : 'T+';
  const abs = Math.abs(ms);
  const h = Math.floor(abs/3600000), m = Math.floor((abs%3600000)/60000), s = Math.floor((abs%60000)/1000);
  return `${sign}${h ? String(h)+':' : ''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Version check — show refresh banner when new deploy detected ──
let _loadedVersion = null;
(function initVersionString() {
  const el = document.querySelector('#hdr .ht span');
  if (el) _loadedVersion = el.textContent.trim();
})();
async function checkForNewVersion() {
  if (!_loadedVersion) return;
  try {
    const r = await fetch(location.pathname || '/', { cache:'no-store' });
    const text = await r.text();
    const m = text.match(/v\d+\.\d+\.\d+/);
    if (m && m[0] !== _loadedVersion) {
      const b = document.getElementById('stale-banner');
      if (b) b.style.display = '';
    }
  } catch(e) {}
}
setInterval(checkForNewVersion, 5 * 60000);

// ── Util ──────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function tsStr(ts){
  if(!ts)return'—';
  const d=new Date(ts);
  return d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
function ageStr(ts){
  if(!ts)return'never';
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60)return s+'s ago';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m ago';
  return Math.floor(s/86400)+'d ago';
}

// ── Boot ─────────────────────────────────────────────────────
// ── VesselAPI static positions (GitHub Actions, updated every 2h) ─────────
async function loadVapiPositions() {
  try {
    const res = await fetch('data/vapi-positions.json?_='+Math.floor(Date.now()/7200000));
    if(!res.ok) return;
    const { fetched, vessels } = await res.json();
    const fetchedTs = fetched ? new Date(fetched).getTime() : 0;
    let added = 0;
    for(const [mmsi, vp] of Object.entries(vessels)) {
      if(!VESSEL_DB[mmsi]) continue;
      const existing = S.vessels[mmsi];
      const vpTs = vp.ts ? new Date(vp.ts).getTime() : 0;
      // most recent timestamp wins across all sources
      if(!existing?.lat || vpTs > (existing.ts||0)) {
        S.vessels[mmsi] = {
          mmsi, ...VESSEL_DB[mmsi],
          lat: vp.lat, lon: vp.lon,
          sog: vp.sog||0, cog: vp.cog||0,
          ts: vpTs,
          track: [],
          _vapi: true,
          _vapiAge: fetchedTs,
        };
        updateMarker(S.vessels[mmsi]);
        added++;
      }
    }
    if(added) { renderFleet(); addLog(`VesselAPI: +${added} positions from static snapshot (${new Date(fetchedTs).toLocaleTimeString()})`, 'sys'); }
  } catch(e) { /* vapi-positions.json not present */ }
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
