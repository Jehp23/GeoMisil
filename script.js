const $ = (sel) => document.querySelector(sel);
const statusEl = $('#status');
function writeStatus(msg){
  const now = new Date().toLocaleTimeString();
  statusEl.textContent = `[${now}] ${msg}`;
}

const btnLocate = $('#btnLocate');
const btnFire = $('#btnFire');
const btnTrackStart = $('#btnTrackStart');
const btnTrackStop = $('#btnTrackStop');
const btnExport = $('#btnExport');
const btnClearHistory = $('#btnClearHistory');
const btnToggleHistory = $('#btnToggleHistory');

const historyPanel = $('#history-panel');
const historyList = $('#history-list');
const historyCount = $('#history-count');

const map = L.map('map').setView([-24.786, -65.410], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20
}).addTo(map);

let marker = null;
let accuracyCircle = null;

function placeMarker(lat, lng, accuracy = 0){
  if(!marker){
    marker = L.marker([lat, lng], { draggable:true }).addTo(map);
    marker.on('moveend', (e) => {
      const p = e.target.getLatLng();
      if (accuracyCircle) accuracyCircle.setLatLng(p);
      if (tracking) addToHistory(p.lat, p.lng, accuracyCircle ? accuracyCircle.getRadius() : 0);
    });
  } else {
    marker.setLatLng([lat, lng]);
  }
  if(!accuracyCircle){
    accuracyCircle = L.circle([lat,lng], { radius: accuracy, weight:1, fillOpacity:.07 }).addTo(map);
  } else {
    accuracyCircle.setLatLng([lat, lng]);
    accuracyCircle.setRadius(accuracy);
  }
}

map.on('click', (e) => {
  const { lat, lng } = e.latlng;
  placeMarker(lat, lng, accuracyCircle ? accuracyCircle.getRadius() : 0);
  if (tracking) addToHistory(lat, lng, accuracyCircle ? accuracyCircle.getRadius() : 0);
});

function locateOnce(){
  if(!('geolocation' in navigator)){
    writeStatus('Geolocalización no disponible.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude:lat, longitude:lng, accuracy } = pos.coords;
      placeMarker(lat, lng, accuracy);
      map.setView([lat,lng], 16);
      if (tracking) addToHistory(lat, lng, accuracy);
    },
    (err) => writeStatus(`Error: ${err.message}`),
    { enableHighAccuracy: true }
  );
}
btnLocate.addEventListener('click', locateOnce);

// ===== Disparar misil =====
btnFire.addEventListener('click', () => {
  if(!marker){ writeStatus('No hay objetivo.'); return; }
  const { lat, lng } = marker.getLatLng();
  writeStatus(`🔥 Misil disparado a LAT=${lat.toFixed(5)}, LNG=${lng.toFixed(5)}`);
  // acá podés disparar tu animación de explosión
});

// ===== Seguimiento con historial =====
let tracking = false;
let watchId = null;
let trackPolyline = null;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('history')) || []; }
  catch { return []; }
}
function saveHistory(list) {
  localStorage.setItem('history', JSON.stringify(list));
  historyCount.textContent = list.length;
}
let history = loadHistory(); saveHistory(history);

function fmtTime(ts){ return new Date(ts).toLocaleTimeString(); }
function addToHistory(lat, lng, acc=0){
  const item = { lat, lng, acc, ts: Date.now() };
  history.push(item); saveHistory(history);
  renderHistory(); redrawTrack();
}
function clearHistory(){
  history=[]; saveHistory(history);
  renderHistory(); redrawTrack();
}
function renderHistory(){
  historyList.innerHTML='';
  history.slice().reverse().forEach(h=>{
    const li=document.createElement('li');
    li.innerHTML=`<span class="coords">LAT=${h.lat.toFixed(6)} · LNG=${h.lng.toFixed(6)} · ACC=${Math.round(h.acc)}m</span>
    <span class="time">${fmtTime(h.ts)}</span>`;
    li.addEventListener('click',()=>map.setView([h.lat,h.lng],17));
    historyList.appendChild(li);
  });
}
function redrawTrack(){
  if(trackPolyline){ map.removeLayer(trackPolyline); trackPolyline=null; }
  if(history.length>=2){
    trackPolyline=L.polyline(history.map(h=>[h.lat,h.lng]),{weight:3}).addTo(map);
  }
}
renderHistory(); redrawTrack();

function updateTrackButtons(){
  btnTrackStart.disabled=tracking;
  btnTrackStop.disabled=!tracking;
}
btnTrackStart.addEventListener('click',()=>{
  if(tracking) return;
  tracking=true; updateTrackButtons();
  if('geolocation'in navigator && watchId===null){
    watchId=navigator.geolocation.watchPosition(
      (pos)=>{
        const {latitude:lat,longitude:lng,accuracy:acc}=pos.coords;
        placeMarker(lat,lng,acc);
        addToHistory(lat,lng,acc);
      },
      (err)=>writeStatus(`Seguimiento error: ${err.message}`),
      {enableHighAccuracy:true}
    );
  }
});
btnTrackStop.addEventListener('click',()=>{
  tracking=false; updateTrackButtons();
  if(watchId!==null){ navigator.geolocation.clearWatch(watchId); watchId=null; }
});
updateTrackButtons();

btnExport.addEventListener('click',()=>{
  if(!history.length) return;
  const header='timestamp,datetime,lat,lng,accuracy\n';
  const rows=history.map(h=>{
    const iso=new Date(h.ts).toISOString();
    return `${h.ts},${iso},${h.lat},${h.lng},${Math.round(h.acc)}`;
  }).join('\n');
  const blob=new Blob([header+rows],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='historial.csv'; a.click();
  URL.revokeObjectURL(url);
});
btnClearHistory.addEventListener('click',()=>{ if(confirm('¿Borrar historial?')) clearHistory(); });
btnToggleHistory.addEventListener('click',()=>historyPanel.classList.toggle('hidden'));

locateOnce();
