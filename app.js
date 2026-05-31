'use strict';

const SHARE_MODE = new URLSearchParams(location.search).has('share');

let history = {};
let events  = [];

// ── Activity log ──────────────────────────────────────────────
const logLines = [];
const MAX_LOG  = 500;
let   logUnread = 0;

const LOG_COLORS = {
  ais:   '#00d4ff',
  db:    '#4477ff',
  news:  '#ff8800',
  sys:   '#567fa0',
  event: '#00ff88',
  err:   '#ff4444',
};

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

// ── Supabase REST client ──────────────────────────────────────
const SB = {
  url:   null,
  akey:  null,
  ready: false,

  init() {
    this.url  = (localStorage.getItem(LS.SB_URL) ||'').replace(/\/+$/,'');
    this.akey = localStorage.getItem(LS.SB_AKEY)||'';
    this.ready = !!(this.url && this.akey);
    updateSBStatus();
    return this.ready;
  },

  _h(extra) {
    return { 'apikey':this.akey, 'Authorization':`Bearer ${this.akey}`,
             'Content-Type':'application/json', ...extra };
  },

  async insert(table, row) {
    if(!this.ready) return;
    try {
      await fetch(`${this.url}/rest/v1/${table}`, {
        method:'POST', headers:this._h({'Prefer':'return=minimal'}), body:JSON.stringify(row),
      });
      const info = table==='positions'?` ${VESSEL_DB[row.mmsi]?.abbr||row.mmsi} → ${row.lat?.toFixed(3)},${row.lon?.toFixed(3)}`
                 : table==='events'   ?` [${row.type}] ${row.vessel_name||row.mmsi}`
                 : ` ${row.vessel_name||''} "${(row.title||'').slice(0,40)}"`;
      addLog(`DB ← ${table}${info}`, 'db');
    } catch(e) { console.warn(`[sb] insert ${table}:`,e.message); addLog(`DB ERR insert ${table}: ${e.message}`, 'err'); }
  },

  async select(table, params) {
    if(!this.ready) return null;
    try {
      const qs = Object.entries(params||{})
        .map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      const r = await fetch(`${this.url}/rest/v1/${table}${qs?'?'+qs:''}`, { headers:this._h({}) });
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      addLog(`DB → ${table} — ${data?.length??0} rows`, 'db');
      return data;
    } catch(e) { console.warn(`[sb] select ${table}:`,e.message); addLog(`DB ERR select ${table}: ${e.message}`, 'err'); return null; }
  },
};

// Throttle: one position write per vessel per 5 min
const sbLastPos = {};
function maybeSBPos(mmsi, lat, lon, sog, cog, ts) {
  if(!SB.ready) return;
  if(sbLastPos[mmsi] && ts-sbLastPos[mmsi] < 300000) return;
  sbLastPos[mmsi] = ts;
  SB.insert('positions', { mmsi, lat, lon, sog, cog, ts:new Date(ts).toISOString() });
}

function sbWriteEvent(ev) {
  if(!SB.ready) return;
  SB.insert('events', {
    mmsi:ev.mmsi, vessel_name:ev.name, operator:ev.operator,
    type:ev.type, detail:ev.detail, lat:ev.lat, lon:ev.lon,
    ts:new Date(ev.ts).toISOString(),
  });
}

async function loadSBData() {
  if(!SB.init()) { addLog('Supabase not configured — enter URL + key in ⚙ SETTINGS', 'sys'); return; }
  addLog('Supabase: loading history…', 'db');

  const since7  = new Date(Date.now()-7*86400000).toISOString();
  const sbEvs = await SB.select('events', { ts:`gte.${since7}`, order:'ts.desc', limit:'500' });
  if(sbEvs?.length) {
    sbEvs.forEach(e => {
      const ts = new Date(e.ts).getTime();
      if(events.some(ev=>Math.abs(ev.ts-ts)<2000&&ev.mmsi===e.mmsi&&ev.type===e.type)) return;
      const cfg=EV_CFG[e.type]||{icon:'·',color:'#888'};
      const info=VESSEL_DB[e.mmsi]||{};
      events.push({ ts, mmsi:e.mmsi,
        name:e.vessel_name||info.name||e.mmsi, abbr:info.abbr||e.vessel_name||e.mmsi,
        operator:e.operator||info.operator||'', opColor:opColor(e.operator||info.operator),
        type:e.type, icon:cfg.icon, typeColor:cfg.color,
        detail:e.detail||'', lat:e.lat, lon:e.lon,
      });
    });
    events.sort((a,b)=>b.ts-a.ts);
    addLog(`Supabase: loaded ${sbEvs.length} events (last 7 days)`, 'db');
    if(S.tab==='events'||S.tab==='history') renderRight();
  }

  const since30 = new Date(Date.now()-30*86400000).toISOString();
  for(const mmsi of KNOWN_MMSIS) {
    const rows = await SB.select('positions', {
      mmsi:`eq.${mmsi}`, ts:`gte.${since30}`,
      order:'ts.asc', limit:'1000', select:'lat,lon,ts,sog,cog',
    });
    if(!rows?.length) continue;
    const pos = rows.map(r=>({lat:r.lat,lon:r.lon,ts:new Date(r.ts).getTime(),sog:r.sog,cog:r.cog}));

    if(!history[mmsi]) {
      history[mmsi]={positions:[],firstSeen:pos[0].ts,lastSeen:pos[pos.length-1].ts};
    }
    const existing = new Set(history[mmsi].positions.map(p=>Math.floor(p.ts/60000)));
    pos.forEach(p=>{ if(!existing.has(Math.floor(p.ts/60000))) history[mmsi].positions.push(p); });
    history[mmsi].positions.sort((a,b)=>a.ts-b.ts);
    history[mmsi].firstSeen = history[mmsi].positions[0].ts;
    history[mmsi].lastSeen  = history[mmsi].positions[history[mmsi].positions.length-1].ts;

    // override VesselAPI fallback if Supabase has real position history
    if(!S.vessels[mmsi] || S.vessels[mmsi]._vapi) {
      const last = history[mmsi].positions[history[mmsi].positions.length-1];
      if(Date.now()-last.ts < 48*3600000) {
        S.vessels[mmsi] = {
          mmsi, ...VESSEL_DB[mmsi],
          lat:last.lat, lon:last.lon, sog:last.sog||0, cog:last.cog||0, ts:last.ts,
          track:history[mmsi].positions.map(p=>[p.lat,p.lon]),
          _historical:true,
        };
        updateMarker(S.vessels[mmsi]);
      }
    }
  }

  addLog('Supabase: history load complete', 'db');
  renderFleet();
  updateHeaderStats();
  updateSBStatus();
}

function updateSBStatus() {
  const dot=document.getElementById('sbdot');
  const lbl=document.getElementById('sbstatus');
  if(!dot||!lbl) return;
  if(SB.ready) {
    dot.style.background='#4477ff';
    dot.style.boxShadow='0 0 5px #4477ff';
    lbl.textContent='DB ✓';
    lbl.style.color='#4477ff';
  } else {
    dot.style.background='#2a3a4a';
    dot.style.boxShadow='none';
    lbl.textContent='DB —';
    lbl.style.color='var(--t4)';
  }
}

// ── App state ─────────────────────────────────────────────────
const S = { ws:null, vessels:{}, aircraft:{}, selected:null, tab:'events' };
let missionsCache = [];
let pastMissionsCache = [];
const prevZones={};
let map=null, layers=null, zoneLayer=null, exclusionLayer=null, landmarkLayer=null, aircraftLayer=null;
let showLandmarks=false;
const markers={}, tracks={}, aircraftMarkers={};

// ── Mission linkage ───────────────────────────────────────────
function isCarryingBooster(mmsi) {
  const role = (VESSEL_DB[mmsi]?.role||'').toLowerCase();
  if(!role.includes('drone') && !role.includes('landing platform')) return null;
  const now = Date.now();
  return [...missionsCache, ...pastMissionsCache].find(l => {
    const net = l.net ? new Date(l.net).getTime() : null;
    if(!net) return false;
    const age = now - net;
    if(age < 600000 || age > 86400000) return false; // 10 min–24 h after NET
    const op = Object.entries(OPERATOR_MATCH).find(([k])=>(l.launch_service_provider?.name||'').includes(k))?.[1]||'';
    return vesselHintsForLaunch(op, l.pad?.name||'', l.pad?.location?.name||'').includes(mmsi);
  }) || null;
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
      v.lat=lat; v.lon=lon; v.sog=pr.Sog??0; v.cog=pr.Cog??0;
      v.navStatus=pr.NavigationalStatus; v.ts=now; v._historical=false;
      addLog(`AIS pos  ${info.abbr||mmsi}  ${lat.toFixed(4)}, ${lon.toFixed(4)}  ${v.sog.toFixed(1)} kn  COG ${Math.round(v.cog)}°`, 'ais');

      if(!history[mmsi]) {
        history[mmsi]={positions:[],firstSeen:now,lastSeen:now};
        addEvent(mmsi,'VESSEL_SEEN',`${info.abbr} spotted — ${lat.toFixed(3)}, ${lon.toFixed(3)}`,lat,lon);
      }
      history[mmsi].lastSeen=now;
      const lp=history[mmsi].positions.slice(-1)[0];
      if(!lp||now-lp.ts>300000||Math.abs(lat-lp.lat)>0.05||Math.abs(lon-lp.lon)>0.05) {
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
  map=L.map('map',{zoomControl:true,attributionControl:true,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1.0});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    attribution:'© CARTO © OSM',subdomains:'abcd',maxZoom:19,
  }).addTo(map);
  exclusionLayer=L.layerGroup().addTo(map);
  landmarkLayer=L.layerGroup().addTo(map);
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
      <div style="width:12px;height:3px;background:#ff8c00;border-radius:1px;opacity:0.7"></div>USCG Safety Zone</div>
    <div style="margin-top:8px;padding-top:5px;border-top:1px solid var(--bdr2);font-size:9px;color:var(--t4);letter-spacing:.06em;margin-bottom:3px">LANDMARKS</div>` +
    [['#ff4400','🚀 Launch pad'],['#ffcc00','👁 Viewing area'],['#00aaff','🏛 NASA / facility'],['#00cc88','⚓ Port']].map(([c,l])=>
      `<div style="display:flex;gap:6px;align-items:center;font-size:10px;color:${c};margin-bottom:2px">
        <svg width="10" height="10" viewBox="0 0 14 14"><polygon points="7,1 13,13 7,10 1,13" fill="${c}"/></svg>${l}</div>`
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
    .bindTooltip(tipUSCG('Cape Canaveral Maritime Safety Zone','33 CFR 165.775'),{className:'ltt',direction:'top'});

  // Vandenberg — 33 CFR 334.1130 (3 nm offshore danger zones)
  L.polygon([
    [34.902, -120.671], [34.902, -120.733], [34.880, -120.733],
    [34.833, -120.675], [34.747, -120.704], [34.697, -120.670],
    [34.587, -120.713], [34.550, -120.685], [34.511, -120.625],
    [34.405, -120.500], [34.393, -120.452], [34.406, -120.411],
    [34.456, -120.411],
  ], style).addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Vandenberg Maritime Danger Zone','33 CFR 334.1130'),{className:'ltt',direction:'top'});

  // Starbase / Boca Chica — USCG enforces ad-hoc safety zones per launch
  L.circle([26.0, -97.15], {radius:28000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Starbase / Boca Chica Safety Zone','Ad-hoc USCG marine safety notices'),{className:'ltt',direction:'top'});

  // Wallops Island (NASA/Northrop Grumman) — FAA/USCG launch safety zones
  L.circle([37.94, -75.47], {radius:30000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipUSCG('Wallops Island Maritime Safety Zone','USCG/FAA launch safety zones'),{className:'ltt',direction:'top'});

  // Māhia Peninsula, NZ — Rocket Lab maritime exclusion
  L.circle([-39.26, 177.87], {radius:20000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Māhia Launch Exclusion Zone','Maritime NZ exclusion notices'),{className:'ltt',direction:'top'});

  // Kourou / Centre Spatial Guyanais — ESA/Arianespace Atlantic exclusion
  L.circle([5.24, -52.77], {radius:60000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Kourou (CSG) Maritime Exclusion Zone','French DGAC / CNES notices'),{className:'ltt',direction:'top'});

  // Alcântara, Brazil — AEB/Itamar
  L.circle([-2.37, -44.40], {radius:30000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Alcântara Launch Center Maritime Zone','DECEA/AEB airspace & maritime notices'),{className:'ltt',direction:'top'});

  // Wenchang Space Launch Center — CNSA South China Sea exclusion
  L.circle([19.61, 110.95], {radius:45000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Wenchang Maritime Exclusion Zone','CNSA / China MSA notices'),{className:'ltt',direction:'top'});

  // Tanegashima Space Center — JAXA Pacific exclusion
  L.circle([30.38, 130.97], {radius:35000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Tanegashima Maritime Exclusion Zone','JAXA / Japan JCG notices'),{className:'ltt',direction:'top'});

  // Satish Dhawan Space Centre (SHAR) — ISRO Bay of Bengal exclusion
  L.circle([13.73, 80.23], {radius:35000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('SHAR (Sriharikota) Maritime Exclusion Zone','ISRO / India Coast Guard notices'),{className:'ltt',direction:'top'});

  // Naro Space Center, South Korea — KARI exclusion
  L.circle([34.43, 127.54], {radius:20000, ...style})
    .addTo(exclusionLayer)
    .bindTooltip(tipIntl('Naro Space Center Maritime Zone','KARI / Korea Coast Guard notices'),{className:'ltt',direction:'top'});

  // Starship Indian Ocean Landing Zone — consistent splashdown target IFT-11 / IFT-12
  L.circle([-19.0, 107.0], {radius:150000, color:'#00d4ff', fillColor:'#00d4ff', fillOpacity:0.03, weight:1.0, dashArray:'4 6'})
    .addTo(exclusionLayer)
    .bindTooltip('<b style="color:#00d4ff">Starship Indian Ocean Landing Zone</b><br><span style="font-size:11px;color:var(--t5)">~19°S 107°E · IFT-11 &amp; IFT-12 splashdown target<br>Future recovery ship staging area</span>',{className:'ltt',direction:'top'});
}

function drawZones() {
  [{id:'canaveral',lat:28.5,lon:-80.65,r:40},{id:'boca_chica',lat:26.0,lon:-97.15,r:25},
   {id:'vandenberg',lat:34.65,lon:-120.6,r:25},{id:'lc1_nz',lat:-39.25,lon:177.9,r:18},
   {id:'atl_recovery',lat:28.5,lon:-76.0,r:110},{id:'pac_recovery',lat:31.5,lon:-118.5,r:160},
   {id:'gulf_ops',lat:27.0,lon:-92.0,r:90}].forEach(z=>{
    const def=ZONES.find(zz=>zz.id===z.id);
    L.circle([z.lat,z.lon],{radius:z.r*1000,color:'#0c3352',fillColor:'#041525',fillOpacity:0.2,weight:1,dashArray:'4 4'})
      .addTo(zoneLayer).bindTooltip(def?.name||z.id,{className:'ltt',direction:'top'});
  });
}

function drawLandmarks() {
  if(!landmarkLayer || typeof LANDMARKS === 'undefined') return;
  landmarkLayer.clearLayers();
  if(!showLandmarks) return;
  const TYPE_STYLE = {
    launch:   { col:'#ff4400', sym:'🚀' },
    viewing:  { col:'#ffcc00', sym:'👁' },
    facility: { col:'#00aaff', sym:'🏛' },
    port:     { col:'#00cc88', sym:'⚓' },
  };
  LANDMARKS.forEach(lm => {
    const st = TYPE_STYLE[lm.type] || { col:'#888', sym:'·' };
    const svg = `<svg width="14" height="14" viewBox="0 0 14 14">
      <polygon points="7,1 13,13 7,10 1,13" fill="${st.col}" stroke="${st.col}" stroke-width="0.5" opacity="0.85"/>
    </svg>`;
    const icon = L.divIcon({ html: svg, iconSize:[14,14], iconAnchor:[7,7], className:'' });
    L.marker([lm.lat, lm.lon], { icon, zIndexOffset:-500 })
      .addTo(landmarkLayer)
      .bindTooltip(
        `<b style="color:${st.col}">${esc(lm.name)}</b><br>
        <span style="font-size:10px;color:var(--t4);text-transform:uppercase;letter-spacing:.05em">${lm.type}</span><br>
        <span style="font-size:11px;color:var(--t3)">${esc(lm.desc)}</span>`,
        { className:'ltt', direction:'top', maxWidth:280 }
      );
  });
}

function toggleLandmarks() {
  showLandmarks = !showLandmarks;
  drawLandmarks();
  const btn = document.getElementById('landmark-btn');
  if(btn) btn.style.opacity = showLandmarks ? '1' : '0.4';
}

function updateMarker(v) {
  if(!map||!layers||!v.lat||!v.lon) return;
  const mmsi=v.mmsi, col=opColor(v.operator), sel=S.selected===mmsi;
  const hist=v._historical&&!SHARE_MODE; // share mode treats historical as solid
  const vapi=v._vapi&&!SHARE_MODE;
  const stale=!hist&&!vapi&&!!v.ts&&(Date.now()-v.ts>7200000); // >2h old and not already flagged
  const hollow=hist||vapi||stale;
  const sz=sel?22:14, cog=v.cog||0;
  const opacity=hist?(sel?0.7:0.45):vapi?(sel?0.8:0.6):stale?(sel?0.65:0.4):(sel?1:0.85);
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
    {className:'ltt',direction:'top'}
  );
  if(v.track&&v.track.length>1) {
    const trackStyle={color:col,weight:hollow?1:2,opacity:hist?0.25:vapi?0.3:stale?0.2:0.5,dashArray:hollow?'3 5':null};
    if(tracks[mmsi]) { tracks[mmsi].setLatLngs(v.track); tracks[mmsi].setStyle(trackStyle); }
    else tracks[mmsi]=L.polyline(v.track,trackStyle).addTo(layers).on('click',()=>selectVessel(mmsi));
  }
}

function selectVessel(mmsi) {
  S.selected=mmsi;
  const v=S.vessels[mmsi];
  if(v?.lat&&v?.lon&&map) map.setView([v.lat,v.lon],7);
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
        // Aircraft on ground or not broadcasting — keep last known position, mark stale
        if(S.aircraft[reg]) S.aircraft[reg]._stale = true;
        continue;
      }
      S.aircraft[reg] = {
        reg,
        lat: ac.lat, lon: ac.lon,
        alt: ac.alt_baro,
        gs: ac.gs,
        track: ac.track ?? 0,
        hex: ac.hex,
        ts: data.now ? data.now * 1000 : Date.now(),
        _stale: false,
      };
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
  // Airplane: forward-pointing arrow shape; helicopter: circle with cross
  const shape = isHelo
    ? `<circle cx="10" cy="10" r="5" fill="none" stroke="${col}" stroke-width="1.8"/>
       <line x1="10" y1="4" x2="10" y2="16" stroke="${col}" stroke-width="1.5"/>
       <line x1="4" y1="10" x2="16" y2="10" stroke="${col}" stroke-width="1.5"/>`
    : `<polygon points="10,2 13,16 10,12 7,16" fill="${col}" stroke="${col}" stroke-width="0.5"/>`;
  const svg = `<svg width="${sz}" height="${sz}" viewBox="0 0 20 20" transform="rotate(${t})" style="transform-origin:center;transform:rotate(${t}deg)">
    ${shape}
  </svg>`;
  const icon = L.divIcon({html:svg, iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], className:''});
  const alt = ac.alt != null ? ` · ${Math.round(ac.alt).toLocaleString()}ft` : '';
  const spd = ac.gs != null ? ` · ${Math.round(ac.gs)}kn` : '';
  const tooltip = `<b style="color:${col}">${esc(db.abbr)}</b><br>
    <span style="color:var(--t5)">${esc(db.operator)}</span><br>${esc(db.role)}<br>${esc(db.model)}${alt}${spd}`;
  if(!aircraftMarkers[reg]) {
    aircraftMarkers[reg] = L.marker([ac.lat, ac.lon], {icon, zIndexOffset:500})
      .addTo(aircraftLayer).bindTooltip(tooltip, {className:'ltt', direction:'top'});
  } else {
    aircraftMarkers[reg].setLatLng([ac.lat, ac.lon]);
    aircraftMarkers[reg].setIcon(icon);
    aircraftMarkers[reg].bindTooltip(tooltip, {className:'ltt', direction:'top'});
  }
}

// ── WebSocket ─────────────────────────────────────────────────
function toggleConnect() {
  if(S.ws){disconnect();return;}
  const key=localStorage.getItem(LS.KEY);
  if(!key){showSettings();return;}
  connect(key);
}

function connect(key) {
  setDot('connecting','Connecting to aisstream.io…');
  addLog('Connecting to aisstream.io…', 'sys');
  const btn=document.getElementById('cbtn');
  btn.textContent='…'; btn.disabled=true;
  const timeout=setTimeout(()=>{setDot('off','Timeout — check key & network');addLog('Connection timeout','err');},8000);
  const ws=new WebSocket('wss://stream.aisstream.io/v0/stream');
  ws.onopen=()=>{
    clearTimeout(timeout);
    ws.send(JSON.stringify({
      APIKey:key, BoundingBoxes:[[[-90,-180],[90,180]]],
      FiltersShipMMSI:KNOWN_MMSIS, FilterMessageTypes:['PositionReport','ShipStaticData'],
    }));
    S.ws=ws; btn.textContent='DISCONNECT'; btn.disabled=false; btn.classList.add('on');
    setDot('on','● LIVE — '+KNOWN_MMSIS.length+' vessels globally');
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
    const msg=ev.code===4001||ev.code===4003?'Invalid API key':'Disconnected';
    setDot('off',ev.code===4001||ev.code===4003?'Invalid API key — check ⚙ SETTINGS':`Disconnected (${ev.code})`);
    addLog(`AIS ${msg} (code ${ev.code})`, ev.code===4001||ev.code===4003?'err':'sys');
  };
  ws.onerror=()=>{clearTimeout(timeout);setDot('off','Connection error');addLog('AIS WebSocket error','err');};
}

function disconnect() {
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
  if(e.key==='Escape'){ closeSettings(); closeSuggestModal(); }
});

// ── Header stats ──────────────────────────────────────────────
const _cycleIdx={};
function cycleVessels(mmsis, key) {
  if(!mmsis.length) return;
  _cycleIdx[key] = ((_cycleIdx[key]||0) % mmsis.length);
  selectVessel(mmsis[_cycleIdx[key]]);
  _cycleIdx[key]++;
}

function updateHeaderStats(){
  const now=Date.now();
  const safeArr=a=>JSON.stringify(a).replace(/"/g,"'");
  let rows;
  if(SHARE_MODE) {
    // share mode: count all vessels with any position data
    const withPos=Object.values(S.vessels).filter(v=>v.lat&&v.ts);
    const recent=withPos.filter(v=>now-v.ts<86400000); // seen in last 24h
    const ops=[...new Set(withPos.map(v=>v.operator))].length;
    const posMMSIs=withPos.map(v=>v.mmsi);
    rows=[
      [withPos.length,'TRACKED','#00d4ff',`cycleVessels(${safeArr(posMMSIs)},'live')`],
      [recent.length, 'RECENT', '#00ff88',`cycleVessels(${safeArr(posMMSIs)},'live')`],
      [ops,           'OPS',    '#ff9900',`setTab('events')`],
    ];
  } else {
    const live=Object.values(S.vessels).filter(v=>v.lat&&!v._historical&&!v._vapi&&v.ts&&(now-v.ts<600000));
    const moving=live.filter(v=>v.sog>0.5).length;
    const ops=[...new Set(live.map(v=>v.operator))].length;
    const liveMMSIs    =live.map(v=>v.mmsi);
    const underwayMMSIs=live.filter(v=>v.sog>0.5).map(v=>v.mmsi);
    rows=[
      [live.length,'LIVE',    '#00ff88',`cycleVessels(${safeArr(liveMMSIs)},'live')`],
      [moving,     'UNDERWAY','#00d4ff',`cycleVessels(${safeArr(underwayMMSIs)},'underway')`],
      [ops,        'OPS',     '#ff9900',`setTab('events')`],
    ];
  }
  document.getElementById('hstats').innerHTML=rows
    .map(([v,l,c,fn])=>`<div onclick="${fn}" style="cursor:${v>0?'pointer':'default'};text-align:center" title="${l}">
      <div class="sv" style="color:${c}">${v}</div>
      <div class="sl" style="text-decoration:${v>0?'underline':'none'};text-underline-offset:2px">${l}</div>
    </div>`).join('');
}

// ── Operator legend ───────────────────────────────────────────
function renderOpLegend(){
  document.getElementById('opleg').innerHTML=
    Object.entries(OP_COLORS).map(([op,c])=>
      `<div class="opleg-item"><div class="opleg-dot" style="background:${c}"></div>
      <span style="color:${c}">${op}</span></div>`
    ).join('');
}

// ── Fleet roster ──────────────────────────────────────────────
function renderFleet(){
  const lc=Object.values(S.vessels).filter(v=>v.lat&&!v._historical).length;
  document.getElementById('lhdr').textContent=S.ws?`FLEET · ${lc} LIVE`:'FLEET ROSTER';
  const rows=KNOWN_MMSIS
    .map(mmsi=>S.vessels[mmsi]||{mmsi,...VESSEL_DB[mmsi],_offline:true})
    .sort((a,b)=>{
      const now=Date.now();
      const rank=v=>{
        const isLive=!!v.lat&&!!v.ts&&!v._historical&&!v._vapi&&(now-v.ts<600000);
        const hasPos=!!v.lat&&!!v.ts;
        const carrying=!!isCarryingBooster(v.mmsi);
        if(carrying&&isLive) return 0;
        if(isLive) return 1;
        if(carrying) return 2;
        if(hasPos) return 3;          // historical, vapi, or stale — sort by ts within
        return 4;
      };
      const ra=rank(a),rb=rank(b);
      if(ra!==rb) return ra-rb;
      return (b.ts||0)-(a.ts||0);   // most recent first within same rank
    });
  document.getElementById('fleet').innerHTML=rows.map(buildVesselRow).join('');
  document.querySelectorAll('.vrow[data-mmsi]').forEach(el=>{el.onclick=()=>selectVessel(el.dataset.mmsi);});
}

function buildVesselRow(v){
  const sel=S.selected===v.mmsi, col=opColor(v.operator);
  const isLive=!!v.lat&&!!v.ts&&!v._historical&&(Date.now()-v.ts<600000);
  const isHist=v._historical;
  const shareHist=SHARE_MODE&&isHist&&!!v.lat;
  const stale=!!v.lat&&!isLive&&!isHist;
  const isOffline=v._offline||(!v.lat&&!isHist);
  const carrying=isCarryingBooster(v.mmsi);
  const dotCol=isLive?'#00ff88':carrying?'#ff8c00':shareHist?'#4477ff':isHist?'#4477ff55':stale?'#ffcc00':isOffline?'#1a3a4a':'#2a4a5a';
  const status=isLive?'LIVE':carrying&&!isLive?'NO AIS LOCK':shareHist?ageStr(v.ts):isHist?'HIST':stale?'STALE':isOffline?'IN PORT':'OFFLINE';
  const nameCol=isLive||shareHist?col:isHist?col+'66':'var(--t3)';
  const roleCol=isLive||shareHist?col+'99':col+'33';
  const bg=isLive||shareHist?(sel?'var(--bg4)':'rgba(0,200,255,.03)'):sel?'var(--bg4)':'';
  const borderCol=isLive?col:shareHist?col+'66':isHist?col+'33':'transparent';
  return `<div class="vrow${sel?' sel':''}" data-mmsi="${esc(v.mmsi)}"
    style="border-left-color:${borderCol}${bg?';background:'+bg:''}${isLive?';box-shadow:inset 2px 0 8px '+col+'22':''}">
    <div class="vn" style="color:${nameCol};${isLive?'text-shadow:0 0 12px '+col+'66':''}">${esc(v.abbr||v.name)}</div>
    <div class="vop" style="color:${roleCol}">${esc(v.operator)} · ${esc(v.role)}</div>
    ${carrying?`<div style="font-size:10px;font-weight:700;color:#ff8c00;letter-spacing:.04em;margin-top:2px">🚀 BOOSTER ABOARD · ${esc(carrying.name||'')}</div>`:''}
    <div class="vbottom">
      <div class="vdot" style="background:${dotCol}${isLive||shareHist?';box-shadow:0 0 5px '+dotCol+'88':''}"></div>
      <span style="color:${dotCol};font-size:10px;font-weight:${isLive?'700':'400'}">${status}</span>
      ${v.sog!=null&&isLive?`<span style="color:var(--t2);font-size:11px;margin-left:4px">${v.sog.toFixed(1)} kn</span>`:''}
      ${isHist&&!shareHist?`<span style="color:var(--t4);font-size:10px;margin-left:auto">${ageStr(v.ts)}</span>`:''}
      ${v.dest&&!v._historical?`<span style="color:${isLive?'var(--t)':'var(--t5)'};font-size:10px;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px">→ ${esc(v.dest)}</span>`:''}
    </div>
  </div>`;
}

// ── Right panel tabs ──────────────────────────────────────────
function setTab(t){
  S.tab=t;
  ['events','vessel','history','log'].forEach(id=>{
    document.getElementById('rtab-'+id).classList.toggle('act',id===t);
  });
  if(t==='log'){
    logUnread=0;
    const badge=document.getElementById('log-badge');
    if(badge) badge.style.display='none';
  }
  renderRight();
}
function renderRight(){
  const el=document.getElementById('rpanel');
  if(S.tab==='events')  el.innerHTML=buildEventFeed();
  if(S.tab==='vessel')  { el.innerHTML=buildVesselDetail(); startCountdowns(); }
  if(S.tab==='history') el.innerHTML=buildHistoryTab();
  if(S.tab==='log')     el.innerHTML=buildLogTab();
}

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
    <div class="dhdr" style="border-left:4px solid ${col}">
      <div class="dname" style="color:${col}">${esc(db.name)}</div>
      <div style="font-size:12px;color:var(--t5);margin-top:2px">${esc(db.operator)} · ${esc(db.role)}</div>
      ${db.homePort?`<div style="font-size:12px;color:var(--t4);margin-top:2px">📍 ${esc(db.homePort)}</div>`:''}
    </div>
    <div class="tbody">
      ${!SHARE_MODE&&!db.verified?`<div class="warn-box">⚠ MMSI ${esc(mmsi)} unverified — confirm at marinetraffic.com</div>`:''}
      ${!SHARE_MODE&&v._historical?`<div class="hist-box">📡 Showing last known position (${ageStr(v.ts)}). Connect AIS for live data.</div>`:''}
      ${!SHARE_MODE&&v._offline?`<div style="background:rgba(0,0,0,.15);border:1px solid var(--bdr);padding:8px 11px;font-size:12px;color:var(--t4);margin-bottom:6px">IN PORT — no AIS signal. Will appear on map when underway.</div>`:''}

      ${carrying?`<div style="background:rgba(255,140,0,.1);border:1px solid #ff8c0066;padding:10px 13px;margin-bottom:6px">
        <div style="font-size:11px;font-weight:700;color:#ff8c00;letter-spacing:.06em;margin-bottom:3px">🚀 BOOSTER ABOARD</div>
        <div style="font-size:13px;font-weight:600;color:var(--t2)">${esc(carrying.name||'')}</div>
        <div style="font-size:11px;color:var(--t4);margin-top:2px">Launched ${ageStr(new Date(carrying.net).getTime())} · returning to port</div>
      </div>`:''}

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
        ['MarineTraffic', `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`],
        ['VesselFinder',  `https://www.vesselfinder.com/?mmsi=${mmsi}`],
        ['space-offshore.com','https://space-offshore.com'],
        ['Google News',   `https://news.google.com/search?q=${encodeURIComponent((db.abbr||db.name)+' SpaceX')}`],
      ].map(([l,u])=>`<div class="fr" style="cursor:pointer" onclick="window.open('${u}','_blank')">
        <span class="fk">${l}</span><span class="fv" style="color:#4488bb">↗</span></div>`).join('')}
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

// ── Missions (The Space Devs API) ─────────────────────────────
let countdownTimer = null;
function startCountdowns() {
  if(countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(()=>{
    document.querySelectorAll('[data-net]').forEach(el=>{
      const net = parseInt(el.dataset.net);
      if(!net) return;
      const diff = net - Date.now();
      const abs  = Math.abs(diff);
      const d=Math.floor(abs/86400000), h=Math.floor((abs%86400000)/3600000),
            m=Math.floor((abs%3600000)/60000),  s=Math.floor((abs%60000)/1000);
      const parts = `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
      el.textContent = diff > 0 ? `T-${parts}` : `T+${parts}`;
    });
  }, 1000);
}

async function fetchMissionsBackground() {
  try {
    const cachedUp   = JSON.parse(localStorage.getItem(LS.MISSIONS)     ||'null');
    const cachedPast = JSON.parse(localStorage.getItem(LS.MISSIONS_PAST)||'null');
    const upFresh   = cachedUp?.ts   && Date.now() - cachedUp.ts   < 600000;
    const pastFresh = cachedPast?.ts && Date.now() - cachedPast.ts < 600000;

    if(upFresh && pastFresh) {
      if(!missionsCache.length     && cachedUp.data)   missionsCache     = cachedUp.data;
      if(!pastMissionsCache.length && cachedPast.data) pastMissionsCache = cachedPast.data;
      addLog(`Missions: cache fresh — skipping fetch`, 'sys');
      if(S.tab==='vessel') renderRight();
      return;
    }

    const base = 'https://ll.thespacedevs.com/2.3.0/launches/';
    const opFilter = l => Object.keys(OPERATOR_MATCH).some(k=>(l.launch_service_provider?.name||'').includes(k));

    const fetches = [];
    if(!upFresh)   fetches.push(fetch(`${base}upcoming/?limit=30&ordering=net`));
    if(!pastFresh) fetches.push(fetch(`${base}previous/?limit=20&ordering=-net`));
    const results = await Promise.all(fetches);

    let i = 0;
    if(!upFresh) {
      const r = results[i++];
      if(r.ok) {
        const d = await r.json();
        missionsCache = (d.results||[]).filter(l => {
          const netTs = l.net ? new Date(l.net).getTime() : null;
          if(netTs && Date.now() - netTs > 3600000) return false;
          return opFilter(l);
        });
        saveMissions();
      }
    }
    if(!pastFresh) {
      const r = results[i++];
      if(r.ok) {
        const d = await r.json();
        pastMissionsCache = (d.results||[]).filter(opFilter);
        savePastMissions();
      }
    }

    addLog(`Missions: ${missionsCache.length} upcoming · ${pastMissionsCache.length} recent`, 'sys');
    if(S.tab==='vessel') renderRight();
  } catch(e) {
    addLog(`Missions background fetch failed: ${e.message}`, 'err');
  }
}

async function showMissions() {
  const panel = document.getElementById('missions-panel');
  panel.style.display = 'block';

  // Serve from cache if < 10 minutes old — avoids burning rate limit on every open
  const cachedMeta = (() => { try { return JSON.parse(localStorage.getItem(LS.MISSIONS)||'null'); } catch(e){return null;} })();
  if(cachedMeta?.ts && Date.now() - cachedMeta.ts < 600000 && missionsCache.length) {
    const ageMin = Math.round((Date.now() - cachedMeta.ts) / 60000);
    document.getElementById('missions-src').textContent =
      `${missionsCache.length} upcoming · cached ${ageMin}m ago · The Space Devs API`;
    document.getElementById('missions-content').innerHTML =
      `<div style="padding:10px 18px 6px;font-size:11px;font-weight:700;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--bdr2)">UPCOMING</div>` +
      missionsCache.map(buildMissionCard).join('');
    startCountdowns();
    addLog(`Missions: served from cache (${ageMin}m old)`, 'sys');
    return;
  }

  document.getElementById('missions-content').innerHTML =
    '<div style="padding:24px;color:var(--t4)">Loading…</div>';
  addLog('Missions: fetching from The Space Devs API…', 'sys');
  try {
    const base = 'https://ll.thespacedevs.com/2.3.0/launches/';
    const [upResp, pastResp] = await Promise.all([
      fetch(`${base}upcoming/?limit=30&ordering=net`),
      fetch(`${base}previous/?limit=20&ordering=-net`),
    ]);
    if(!upResp.ok) throw new Error(`HTTP ${upResp.status}`);
    const upData   = await upResp.json();
    const pastData = pastResp.ok ? await pastResp.json() : { results:[] };

    const filterFn = l => {
      const lsp = l.launch_service_provider?.name||'';
      const netTs = l.net ? new Date(l.net).getTime() : null;
      if(netTs && Date.now() - netTs > 3600000) return false;
      return Object.keys(OPERATOR_MATCH).some(k=>lsp.includes(k));
    };
    const upcoming = (upData.results||[]).filter(filterFn);
    const past     = (pastData.results||[]).filter(filterFn);

    missionsCache     = upcoming;
    pastMissionsCache = past;
    saveMissions();
    savePastMissions();

    addLog(`Missions: ${upcoming.length} upcoming, ${past.length} recent past`, 'sys');
    document.getElementById('missions-src').textContent =
      `${upcoming.length} upcoming · ${past.length} recent · The Space Devs API · ${new Date().toLocaleTimeString()}`;

    let html = '';
    if(upcoming.length) {
      html += `<div style="padding:10px 18px 6px;font-size:11px;font-weight:700;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--bdr2)">UPCOMING</div>`;
      html += upcoming.map(buildMissionCard).join('');
    }
    if(past.length) {
      html += `<div style="padding:10px 18px 6px;font-size:11px;font-weight:700;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--bdr2);margin-top:8px">RECENT — ACTUAL TIMES</div>`;
      html += past.map(l=>buildMissionCard(l, true)).join('');
    }
    document.getElementById('missions-content').innerHTML = html ||
      '<div style="padding:20px;color:var(--t4)">No missions found.</div>';
    startCountdowns();
  } catch(e) {
    addLog(`Missions fetch error: ${e.message}`, 'err');
    if(missionsCache.length) {
      const is429 = e.message.includes('429');
      document.getElementById('missions-src').textContent =
        `${is429?'Rate limited':'Error'} — showing cached data · The Space Devs API`;
      document.getElementById('missions-content').innerHTML =
        `<div style="background:rgba(255,140,0,.07);border-bottom:1px solid #553300;padding:9px 18px;font-size:12px;color:#cc7700">
          ⚠ ${is429?'API rate limited (429) — try again in a few minutes':'Could not reach API'} · displaying cached missions
        </div>` +
        `<div style="padding:10px 18px 6px;font-size:11px;font-weight:700;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid var(--bdr2)">UPCOMING</div>` +
        missionsCache.map(buildMissionCard).join('');
      startCountdowns();
    } else {
      document.getElementById('missions-src').textContent = 'Could not load — check connection';
      document.getElementById('missions-content').innerHTML =
        `<div style="padding:20px;color:var(--t4)">Could not reach The Space Devs API: ${esc(e.message)}</div>`;
    }
  }
}

function buildMissionCard(l, isPast=false) {
  const lsp      = l.launch_service_provider?.name||'';
  const op       = Object.entries(OPERATOR_MATCH).find(([k])=>lsp.includes(k))?.[1]||lsp;
  const col      = opColor(op);
  const net      = l.net ? new Date(l.net).getTime() : null;
  const netStr   = net ? fmtTime(net) : 'TBD';
  const pad      = l.pad?.name||'';
  const loc      = l.pad?.location?.name||'';
  const status   = l.status?.name||'';
  const statusCol= /Go|Success/i.test(status)?'#00ff88':/Hold|Delay/i.test(status)?'#ff4444':'#ff8800';
  const vehicle  = l.rocket?.configuration?.name||'';
  const missionType = l.mission?.type||'';
  const desc     = l.mission?.description||'';
  const vessels  = vesselHintsForLaunch(op, pad, loc);
  const timeline = timelineForVehicle(vehicle);
  const uncertain= !l.net || /TBD|NET|No Earlier/i.test(l.net_precision?.name||'');

  // Override hardcoded ASDS in timeline with pad-aware vessel; flag if corrected
  const isLandingPlatform = m => { const r=(VESSEL_DB[m]?.role||'').toLowerCase(); return r.includes('drone')||r.includes('landing platform'); };
  const droneMMSI = vessels.find(isLandingPlatform);
  const apiDroneMMSI = (timeline||[]).find(e=>e.highlight&&e.vessel&&isLandingPlatform(e.vessel))?.vessel;
  const hasMismatch = apiDroneMMSI && droneMMSI && apiDroneMMSI !== droneMMSI;
  const patchedTimeline = timeline ? timeline.map(e =>
    (e.vessel && isLandingPlatform(e.vessel) && droneMMSI && e.vessel !== droneMMSI)
      ? {...e, vessel:droneMMSI} : e
  ) : null;

  const catchEvents = (patchedTimeline||[]).filter(e=>e.highlight&&e.vessel&&VESSEL_DB[e.vessel]);
  const catchVessel = catchEvents[0]?.vessel;
  const catchV = catchVessel ? VESSEL_DB[catchVessel] : null;

  const timelineHTML = patchedTimeline ? `
    <div style="margin:12px 0 4px">
      <div style="font-size:11px;font-weight:600;color:var(--t4);letter-spacing:.06em;margin-bottom:8px">${isPast?'ACTUAL TIMELINE (projected vessel times)':'PROJECTED TIMELINE'}</div>
      ${patchedTimeline.map(e=>{
        const tv = e.vessel&&VESSEL_DB[e.vessel];
        const absTime = (net&&e.t>60) ? fmtTime(net+e.t*1000) : null;
        return `<div style="display:flex;align-items:baseline;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr2)${e.highlight?';background:'+col+'08':''};border-radius:2px">
          <span style="font-family:var(--fm);font-size:12px;color:${e.highlight?col:'var(--t4)'};flex:1">${esc(e.label)}</span>
          ${absTime?`<span style="font-size:10px;color:var(--t5);flex-shrink:0">${esc(absTime)}</span>`:''}
          ${tv?`<span class="vessel-link" onclick="openVesselFromMission('${e.vessel}')" style="font-size:11px;color:${opColor(tv.operator)};flex-shrink:0;margin-left:${absTime?'0':'auto'};cursor:pointer;text-decoration:underline;text-underline-offset:2px">${esc(tv.abbr||tv.name)} ↗</span>`:''}
        </div>`;
      }).join('')}
    </div>` : '';

  return `<div class="mcard" style="border-left-color:${col}">
    <div class="mcard-name" style="color:${col}">${esc(l.name||'Unknown Mission')}</div>
    <div class="mcard-sub">${esc(vehicle)} · ${esc(loc||pad)}</div>
    <div class="mcard-meta">
      <span class="mtag" style="background:${col}22;color:${col}">${esc(op)}</span>
      ${missionType?`<span class="mtag" style="background:#1a2a3a;color:var(--t5)">${esc(missionType)}</span>`:''}
      <span class="mtag" style="background:${statusCol}22;color:${statusCol}">${esc(status)}</span>
    </div>
    <div class="mcountdown" style="color:${isPast?'var(--t5)':col}" ${net?`data-net="${net}"`:''}>${net?'calculating…':'Date TBD'}</div>
    <div class="mcountdown-lbl">${esc(netStr)}${isPast?` · <span style="color:${/Success/i.test(status)?'#00ff88':'#ff4444'};font-weight:700">${esc(status)}</span>`:''}</div>
    ${catchV?`<div class="vessel-link" onclick="openVesselFromMission('${catchVessel}')"
      style="margin-top:10px;padding:10px 12px;background:${opColor(catchV.operator)}11;border:1px solid ${opColor(catchV.operator)}44;border-radius:2px;cursor:pointer">
      <div style="font-size:11px;font-weight:600;color:var(--t4);letter-spacing:.06em;margin-bottom:4px">PROJECTED CATCH VESSEL ↗</div>
      <div style="font-size:15px;font-weight:700;color:${opColor(catchV.operator)}">${esc(catchV.name||catchV.abbr)}</div>
      <div style="font-size:12px;color:var(--t5);margin-top:2px">${esc(catchV.role)} · ${esc(catchV.homePort||'')}</div>
      <div style="font-size:12px;color:var(--t4);margin-top:3px">${esc(catchEvents[0].label)}</div>
    </div>`:''}
    ${hasMismatch?`<div style="background:rgba(255,140,0,.07);border:1px solid #553300;padding:7px 10px;font-size:12px;color:#cc7700;margin-top:8px">⚠ API assigned ${esc(VESSEL_DB[apiDroneMMSI]?.abbr||apiDroneMMSI)} — corrected to ${esc(VESSEL_DB[droneMMSI]?.abbr||droneMMSI)} based on launch site</div>`:''}
    ${uncertain?`<div class="mcard-uncertain">⚠ Launch window may shift — verify at nextspaceflight.com</div>`:''}
    ${desc?`<div class="mcard-desc">${esc(desc.slice(0,300))}${desc.length>300?'…':''}</div>`:''}
    ${timelineHTML}
    ${vessels.length&&!catchV?`<div class="mcard-vessels">
      <div style="font-size:11px;color:var(--t4);font-weight:600;letter-spacing:.06em;margin-bottom:6px">VESSELS DEPLOYED</div>
      ${vessels.map(m=>{const v=VESSEL_DB[m];return`<div class="vessel-link" onclick="openVesselFromMission('${m}')" style="font-size:13px;color:${opColor(v.operator)};padding:3px 0;cursor:pointer">
        ${esc(v.abbr||v.name)} <span style="color:var(--t5);font-size:11px">· ${esc(v.role)}</span> <span style="font-size:11px">↗</span>
      </div>`;}).join('')}
    </div>`:''}
  </div>`;
}

function openVesselFromMission(mmsi) {
  document.getElementById('missions-panel').style.display='none';
  selectVessel(mmsi);
}

// ── Suggestions ───────────────────────────────────────────────
function showSuggestModal() {
  const m=document.getElementById('suggestmodal');
  m.style.display='flex';
  m.onclick=e=>{if(e.target===m)closeSuggestModal();};
  document.getElementById('sg-msg').textContent='';
}
function closeSuggestModal() {
  document.getElementById('suggestmodal').style.display='none';
}

async function submitSuggestion() {
  const type   =document.getElementById('sg-type').value;
  const name   =document.getElementById('sg-name').value.trim();
  const mmsi   =document.getElementById('sg-mmsi').value.trim();
  const notes  =document.getElementById('sg-notes').value.trim();
  const contact=document.getElementById('sg-contact').value.trim();
  const msg    =document.getElementById('sg-msg');

  if(!name && !mmsi) { msg.style.color='var(--hi)'; msg.textContent='Enter at least a vessel name or MMSI.'; return; }
  if(!SB.ready) { msg.style.color='var(--hi)'; msg.textContent='No database connected — suggestion cannot be saved.'; return; }

  msg.style.color='var(--t4)'; msg.textContent='Submitting…';
  try {
    await fetch(`${SB.url}/rest/v1/suggestions`, {
      method:'POST',
      headers:{ 'apikey':SB.akey, 'Authorization':`Bearer ${SB.akey}`,
                'Content-Type':'application/json', 'Prefer':'return=minimal' },
      body:JSON.stringify({ type, vessel_name:name||null, mmsi:mmsi||null, notes:notes||null, contact:contact||null }),
    });
    msg.style.color='var(--grn)'; msg.textContent='Submitted — thank you!';
    ['sg-name','sg-mmsi','sg-notes','sg-contact'].forEach(id=>document.getElementById(id).value='');
    setTimeout(closeSuggestModal, 1800);
  } catch(e) {
    msg.style.color='var(--hi)'; msg.textContent='Error: '+e.message;
  }
}

async function loadSuggestions() {
  const el=document.getElementById('sg-list');
  const count=document.getElementById('sg-count');
  if(!el) return;
  if(!SB.ready) { el.innerHTML='<div style="font-size:12px;color:var(--t4)">Supabase not configured.</div>'; return; }
  try {
    const r=await fetch(`${SB.url}/rest/v1/suggestions?status=eq.pending&order=ts.desc&limit=50`,
      {headers:{'apikey':SB.akey,'Authorization':`Bearer ${SB.akey}`}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows=await r.json();
    if(count) count.textContent=rows.length?`(${rows.length} pending)`:'(none)';
    if(!rows.length){el.innerHTML='<div style="font-size:12px;color:var(--t4)">No pending suggestions.</div>';return;}
    el.innerHTML=rows.map(s=>{
      const clip=`Type: ${s.type}\nVessel: ${s.vessel_name||'—'}\nMMSI: ${s.mmsi||'—'}\nNotes: ${s.notes||'—'}\nContact: ${s.contact||'—'}\nSubmitted: ${new Date(s.ts).toLocaleString()}`;
      return`<div id="sg-row-${s.id}" style="padding:10px 0;border-bottom:1px solid var(--bdr2)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:700;color:var(--acc);letter-spacing:.06em">${esc(s.type.replace('_',' ').toUpperCase())}</span>
          <span style="font-size:10px;color:var(--t4)">${new Date(s.ts).toLocaleString()}</span>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify(clip).replace(/"/g,"'")})"
            style="margin-left:auto;background:none;border:1px solid var(--bdr);color:var(--t4);font-size:10px;padding:2px 8px;cursor:pointer">COPY</button>
          <button onclick="deleteSuggestion(${s.id})"
            style="background:none;border:1px solid var(--hi)44;color:var(--hi);font-size:10px;padding:2px 8px;cursor:pointer">DELETE</button>
        </div>
        ${s.vessel_name?`<div style="font-size:13px;font-weight:600;color:var(--t2)">${esc(s.vessel_name)}</div>`:''}
        ${s.mmsi?`<div style="font-size:12px;color:var(--acc);font-family:var(--fm)">${esc(s.mmsi)}</div>`:''}
        ${s.notes?`<div style="font-size:12px;color:var(--t);margin-top:3px;line-height:1.6">${esc(s.notes)}</div>`:''}
        ${s.contact?`<div style="font-size:11px;color:var(--t4);margin-top:3px">Contact: ${esc(s.contact)}</div>`:''}
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML=`<div style="font-size:12px;color:var(--hi)">Error loading suggestions: ${esc(e.message)}</div>`;
  }
}

async function deleteSuggestion(id) {
  if(!SB.ready) return;
  try {
    const r=await fetch(`${SB.url}/rest/v1/suggestions?id=eq.${id}`,
      {method:'DELETE',headers:{'apikey':SB.akey,'Authorization':`Bearer ${SB.akey}`}});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const row=document.getElementById(`sg-row-${id}`);
    if(row) row.remove();
    const el=document.getElementById('sg-list');
    const count=document.getElementById('sg-count');
    if(el&&!el.children.length) el.innerHTML='<div style="font-size:12px;color:var(--t4)">No pending suggestions.</div>';
    const remaining=el?el.querySelectorAll('[id^=sg-row-]').length:0;
    if(count) count.textContent=remaining?`(${remaining} pending)`:'(none)';
  } catch(e) {
    alert('Delete failed: '+e.message+'\n\nYou may need to add a DELETE policy to your Supabase suggestions table:\ncreate policy "delete_suggestions" on suggestions for delete using (true);');
  }
}

// ── Share link ────────────────────────────────────────────────
function copyShareLink() {
  const sbUrl = localStorage.getItem(LS.SB_URL)||'';
  const sbKey = localStorage.getItem(LS.SB_AKEY)||'';
  let url = `${location.origin}${location.pathname}?share`;
  if(sbUrl) url += `&sb_url=${encodeURIComponent(sbUrl)}`;
  if(sbKey) url += `&sb_key=${encodeURIComponent(sbKey)}`;
  navigator.clipboard.writeText(url).then(()=>{
    const msg=document.getElementById('share-link-msg');
    if(msg){msg.textContent='Copied ✓';setTimeout(()=>msg.textContent='',3000);}
  }).catch(()=>{
    const msg=document.getElementById('share-link-msg');
    if(msg) msg.textContent='Copy failed — check clipboard permissions';
  });
}

// ── Launch banner ─────────────────────────────────────────────
function renderLaunchBanner() {
  const banner=document.getElementById('launch-banner');
  if(!banner) return;
  const now=Date.now();
  const soon=missionsCache.find(l=>{
    const net=l.net?new Date(l.net).getTime():null;
    return net && net > now - 3600000 && net < now + 86400000;
  });
  if(!soon){banner.style.display='none';return;}
  const net=new Date(soon.net).getTime();
  const op=Object.entries(OPERATOR_MATCH).find(([k])=>(soon.launch_service_provider?.name||'').includes(k))?.[1]||'';
  const col=opColor(op);
  const vessels=vesselHintsForLaunch(op, soon.pad?.name||'', soon.pad?.location?.name||'');
  const droneMMSI=vessels.find(m=>{const r=(VESSEL_DB[m]?.role||'').toLowerCase();return r.includes('drone')||r.includes('landing platform');});
  const droneV=droneMMSI?VESSEL_DB[droneMMSI]:null;
  banner.style.display='flex';
  banner.style.background=`linear-gradient(90deg,${col}18 0%,var(--bg3) 100%)`;
  banner.style.borderColor=`var(--bdr)`;
  banner.style.borderLeftColor=col;
  banner.style.borderLeftWidth='3px';
  banner.innerHTML=
    `<span class="lb-label" style="color:${col}">⚡ LAUNCH</span>`+
    `<span class="lb-name" style="color:${col}">${esc(soon.name||'')}</span>`+
    `<span class="lb-cd" style="color:${col}" data-net="${net}">calculating…</span>`+
    (droneV?`<span class="lb-vessel" style="color:${opColor(droneV.operator)}" onclick="openVesselFromMission('${droneMMSI}');event.stopPropagation()">${esc(droneV.abbr||droneV.name)}</span>`:'');
  banner.onclick=()=>showMissions();
  startCountdowns();
}

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
    if(sub) sub.textContent='GLOBAL FLEET · SPACEX · BLUE ORIGIN · ROCKET LAB · ULA';
    const p=new URLSearchParams(location.search);
    const sbUrl=p.get('sb_url'), sbKey=p.get('sb_key');
    if(sbUrl) localStorage.setItem(LS.SB_URL, sbUrl);
    if(sbKey) localStorage.setItem(LS.SB_AKEY, sbKey);
  }

  SB.init();
  initTZSelect();
  initMap();
  renderOpLegend();
  renderFleet();
  renderRight();
  updateHeaderStats();
  setInterval(()=>{renderFleet();updateHeaderStats();},5000);

  loadSBData().then(()=>loadVapiPositions());
  fetchMissionsBackground().then(()=>renderLaunchBanner());
  pollAircraft();
  setInterval(pollAircraft, AIRCRAFT_POLL_MS);

  if(!SHARE_MODE && !localStorage.getItem(LS.KEY)) showSettings();
  if(SHARE_MODE) setInterval(loadSBData, 180000);
};
