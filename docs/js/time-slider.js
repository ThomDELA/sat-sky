"use strict";

const sliderEl = document.getElementById("time-slider");
const phaseLabelEl = document.getElementById("phase-label");
const outEl = document.getElementById("out");
const obsLatEl = document.getElementById("obs-lat");
const obsLonEl = document.getElementById("obs-lon");
const playBtn = document.getElementById("play");
const pauseBtn = document.getElementById("pause");

const ORBIT_MINUTES = 95;
const MAX_LAT = 51.6;
let timer = null;

function deg2rad(deg) {
  return deg * Math.PI / 180;
}

function rad2deg(rad) {
  return rad * 180 / Math.PI;
}

function normalizeLon(deg) {
  let value = ((deg + 180) % 360 + 360) % 360 - 180;
  if (value === -180) value = 180;
  return value;
}

function satSubpoint(phaseMinutes) {
  const phase = (phaseMinutes / ORBIT_MINUTES) * 2 * Math.PI;
  const lat = MAX_LAT * Math.sin(phase);
  const lon = normalizeLon(phaseMinutes * 3.6 - 180);
  const altM = 420000;
  return { lat, lon, altM };
}

function toEcef(latDeg, lonDeg, altM) {
  const a = 6378137.0;
  const e2 = 6.69437999014e-3;
  const lat = deg2rad(latDeg);
  const lon = deg2rad(lonDeg);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);

  return {
    x: (n + altM) * cosLat * cosLon,
    y: (n + altM) * cosLat * sinLon,
    z: (n * (1 - e2) + altM) * sinLat
  };
}

function ecefToEnu(observerLatDeg, observerLonDeg, obsEcef, tgtEcef) {
  const lat = deg2rad(observerLatDeg);
  const lon = deg2rad(observerLonDeg);
  const dx = tgtEcef.x - obsEcef.x;
  const dy = tgtEcef.y - obsEcef.y;
  const dz = tgtEcef.z - obsEcef.z;

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  return {
    east: -sinLon * dx + cosLon * dy,
    north: -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz,
    up: cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz
  };
}

function enuToAltAz(enu) {
  const horizontal = Math.hypot(enu.east, enu.north);
  return {
    altDeg: rad2deg(Math.atan2(enu.up, horizontal)),
    azDeg: (rad2deg(Math.atan2(enu.east, enu.north)) + 360) % 360,
    rangeKm: Math.hypot(horizontal, enu.up) / 1000
  };
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "NaN";
}

function render() {
  const phaseMinutes = Number(sliderEl.value);
  const observer = {
    lat: Number(obsLatEl.value),
    lon: Number(obsLonEl.value),
    altM: 0
  };
  const sat = satSubpoint(phaseMinutes);

  const obsEcef = toEcef(observer.lat, observer.lon, observer.altM);
  const satEcef = toEcef(sat.lat, sat.lon, sat.altM);
  const enu = ecefToEnu(observer.lat, observer.lon, obsEcef, satEcef);
  const topo = enuToAltAz(enu);

  phaseLabelEl.textContent = `${phaseMinutes} / ${ORBIT_MINUTES} min`;
  outEl.textContent = [
    "Synthetic moving subpoint example",
    "",
    `Observer: lat=${fmt(observer.lat, 4)}°, lon=${fmt(observer.lon, 4)}°`,
    `Satellite subpoint: lat=${fmt(sat.lat, 4)}°, lon=${fmt(sat.lon, 4)}°, alt=${fmt(sat.altM / 1000, 1)} km`,
    "",
    "Observer-relative topocentric coordinates",
    `  altitude=${fmt(topo.altDeg, 3)}°`,
    `  azimuth=${fmt(topo.azDeg, 3)}°`,
    `  slant range=${fmt(topo.rangeKm, 3)} km`,
    "",
    `Visible above horizon: ${topo.altDeg > 0 ? "YES" : "NO"}`
  ].join("\n");
}

function play() {
  if (timer) return;
  timer = setInterval(() => {
    const next = (Number(sliderEl.value) + 1) % (ORBIT_MINUTES + 1);
    sliderEl.value = String(next);
    render();
  }, 180);
}

function pause() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

sliderEl.addEventListener("input", render);
obsLatEl.addEventListener("input", render);
obsLonEl.addEventListener("input", render);
playBtn.addEventListener("click", play);
pauseBtn.addEventListener("click", pause);

render();
