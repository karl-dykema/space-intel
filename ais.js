'use strict';

let _aisReconnectDelay = 10000;
let _aisReconnectTimer = null;
let _aisManualDisconnect = false;

function toggleConnect() {
  if(S.ws){disconnect();return;}
  const key=localStorage.getItem(LS.KEY);
  if(!key){showSettings();return;}
  connect(key);
}


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
