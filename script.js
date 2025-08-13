// DOM elements
const mapEl = document.getElementById('map');
const statusEl = document.getElementById('status');
const latEl = document.getElementById('lat');
const lngEl = document.getElementById('lng');
const accEl = document.getElementById('acc');
const btnLocate = document.getElementById('btnLocate');
const btnCopy = document.getElementById('btnCopy');
const btnClear = document.getElementById('btnClear');

// Init world view
const map = L.map(mapEl).setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let marker = null;
let accuracyCircle = null;

function writeStatus(lines) {
  if (Array.isArray(lines)) {
    statusEl.textContent = lines.join('\n');
  } else {
    statusEl.textContent = String(lines || '');
  }
}

function updateInfo(lat, lng, acc) {
  latEl.textContent = lat.toFixed(6);
  lngEl.textContent = lng.toFixed(6);
  accEl.textContent = (acc != null && !Number.isNaN(acc)) ? Math.round(acc) : '—';
}

function updateInfoPlaceholders() {
  latEl.textContent = '—';
  lngEl.textContent = '—';
  accEl.textContent = '—';
}

function setScan(active) {
  document.body.classList.toggle('scan-running', !!active);
  document.body.classList.toggle('scan-paused', !active);
}

function clearMarker() {
  if (marker) { map.removeLayer(marker); marker = null; }
  if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
  updateInfoPlaceholders();
  writeStatus('[OK] Buffer limpiado.');
}

function placeMarker(lat, lng, acc) {
  if (marker) marker.setLatLng([lat, lng]);
  else marker = L.marker([lat, lng], { draggable: true }).addTo(map);

  if (accuracyCircle) accuracyCircle.setLatLng([lat, lng]);
  else accuracyCircle = L.circle([lat, lng], {
    radius: acc || 0,
    stroke: true, weight: 1, opacity: 0.6, fillOpacity: 0.08
  }).addTo(map);

  marker.bindPopup('TARGET LOCKED').openPopup();
  updateInfo(lat, lng, acc);
  map.flyTo([lat, lng], 16, { duration: 0.75 });
}

// Fancy locate flow
function locateMe() {
  if (!('geolocation' in navigator)) {
    writeStatus('[ERR] Geolocation no soportada por este navegador.');
    return;
  }

  setScan(true);
  writeStatus([
    '[SYS] Abriendo canal encriptado...',
    '[SYS] Cargando módulos GEO...', 
    '[~] Triangulando señal...'
  ]);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      placeMarker(latitude, longitude, accuracy);
      writeStatus([
        '[OK] Coordenadas obtenidas.',
        `LAT=${latitude.toFixed(6)} LNG=${longitude.toFixed(6)} ACC=${Math.round(accuracy)}m`
      ]);
      setScan(false);
    },
    (err) => {
      const msg = {
        1: '[DENY] Permiso denegado. Usá click en el mapa para setear manualmente.',
        2: '[WARN] Posición no disponible. Verificá conexión / GPS.',
        3: '[TIMEOUT] Operación expirada. Intentá de nuevo.'
      }[err.code] || '[ERR] Error desconocido al obtener posición.';
      writeStatus(msg);
      setScan(false);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Manual click
map.on('click', (e) => {
  const { lat, lng } = e.latlng;
  placeMarker(lat, lng, 0);
  writeStatus(`[MANUAL] Marcador en LAT=${lat.toFixed(6)} LNG=${lng.toFixed(6)}`);
});

// Drag marker
function attachDragHandler() {
  if (!marker) return;
  marker.on('moveend', (e) => {
    const { lat, lng } = e.target.getLatLng();
    placeMarker(lat, lng, accuracyCircle ? accuracyCircle.getRadius() : 0);
    writeStatus(`[MOVE] Nuevo target LAT=${lat.toFixed(6)} LNG=${lng.toFixed(6)}`);
  });
}
map.on('layeradd', () => attachDragHandler());

// Copy coords
async function copyCoords() {
  const lat = latEl.textContent;
  const lng = lngEl.textContent;
  if (lat === '—' || lng === '—') {
    writeStatus('[WARN] No hay coordenadas para copiar.');
    return;
  }
  const text = `${lat}, ${lng}`;
  try {
    await navigator.clipboard.writeText(text);
    writeStatus('[OK] Coordenadas copiadas al portapapeles.');
  } catch {
    writeStatus('[ERR] No se pudo copiar automáticamente.');
  }
}

// Events
btnLocate.addEventListener('click', locateMe);
btnCopy.addEventListener('click', copyCoords);
btnClear.addEventListener('click', clearMarker);

// Initial message
writeStatus('[READY] Presioná "Obtener ubicación" para iniciar rastreo.');
