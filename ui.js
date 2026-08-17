'use strict';

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
        ['SOURCE',   srcLabel(v)],
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
// Where a position came from, and how current it is. Deliberately names the
// feed rather than saying "satellite AIS" — every source here is terrestrial
// AIS, which is exactly why deep-ocean vessels go dark.
function srcLabel(v){
  if(!v.lat) return 'no position';
  if(v._historical) return 'position history (Supabase)';
  if(v._vapi) {
    const chk = v._vapiChecked ? ` · checked ${ageStr(v._vapiChecked)}` : '';
    return `VesselAPI snapshot${chk}`;
  }
  const age = v.ts ? Date.now()-v.ts : Infinity;
  if(age < 600000) return 'AIS live (terrestrial)';
  return `AIS terrestrial · no signal ${ageStr(v.ts)}`;
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
// ── VesselAPI static positions ────────────────────────────────────────────
// GitHub Actions writes data/vapi-positions.json every 3 days. Vessels are
// tiered by activity, so any given vessel may not have been polled on the most
// recent run — hence `checked` is stored per vessel, not taken from the file's
// `fetched` stamp. Two distinct ages matter: when the vessel last reported a
// position (ts), and when we last looked (checked).
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
          track: existing?.track || [],
          _vapi: true,
          // Per-vessel poll time; falls back to the file stamp for entries
          // written before `checked` existed.
          _vapiChecked: vp.checked ? new Date(vp.checked).getTime() : fetchedTs,
        };
        updateMarker(S.vessels[mmsi]);
        added++;
      }
    }
    if(added) { renderFleet(); addLog(`VesselAPI: +${added} positions from static snapshot (${new Date(fetchedTs).toLocaleTimeString()})`, 'sys'); }
  } catch(e) { /* vapi-positions.json not present */ }
}

function toggleMobileFleet() {
  const left = document.getElementById('left');
  const overlay = document.getElementById('mob-overlay');
  const opening = !left.classList.contains('mob-open');
  left.classList.toggle('mob-open', opening);
  overlay.classList.toggle('active', opening);
  if (opening) document.getElementById('right').classList.add('collapsed');
}

function toggleMobileEvents() {
  const right = document.getElementById('right');
  const overlay = document.getElementById('mob-overlay');
  const opening = right.classList.contains('collapsed');
  right.classList.toggle('collapsed', !opening);
  overlay.classList.toggle('active', opening);
  if (opening) document.getElementById('left').classList.remove('mob-open');
}

function closeMobilePanels() {
  document.getElementById('left').classList.remove('mob-open');
  document.getElementById('right').classList.add('collapsed');
  document.getElementById('mob-overlay').classList.remove('active');
}

