"use strict";

const WGS84_A = 6378137.0;
const WGS84_E2 = 6.69437999014e-3;
const ORBIT_MINUTES = 95;
const MAX_LAT = 51.6;
const SAT_ALT_M = 420000;

const ids = {
  slider: document.getElementById("time-slider"),
  timeLabel: document.getElementById("time-label"),
  status: document.getElementById("status"),
  out: document.getElementById("out"),
  obsLat: document.getElementById("obs-lat"),
  obsLon: document.getElementById("obs-lon"),
  stepMs: document.getElementById("step-ms"),
  play: document.getElementById("play"),
  pause: document.getElementById("pause"),
  canvas: document.getElementById("sky-canvas")
};

const ctx = ids.canvas.getContext("2d");
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
  return { lat, lon, altM: SAT_ALT_M };
}

function toEcef(latDeg, lonDeg, altM) {
  const lat = deg2rad(latDeg);
  const lon = deg2rad(lonDeg);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  return {
    x: (n + altM) * cosLat * cosLon,
    y: (n + altM) * cosLat * sinLon,
    z: (n * (1 - WGS84_E2) + altM) * sinLat
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

function skyPoint(azDeg, altDeg, radius) {
  const r = ((90 - altDeg) / 90) * radius;
  const azRad = deg2rad(azDeg);
  return {
    x: r * Math.sin(azRad),
    y: -r * Math.cos(azRad)
  };
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "NaN";
}

function computeTopocentric(minute, observer) {
  const sat = satSubpoint(minute);
  const obsEcef = toEcef(observer.lat, observer.lon, 0);
  const satEcef = toEcef(sat.lat, sat.lon, sat.altM);
  const enu = ecefToEnu(observer.lat, observer.lon, obsEcef, satEcef);
  const topo = enuToAltAz(enu);
  return { sat, topo };
}

function drawSkyGrid(cx, cy, radius) {
  ctx.clearRect(0, 0, ids.canvas.width, ids.canvas.height);
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = "#f8fbff";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  [radius, (2 * radius) / 3, radius / 3].forEach((r, idx) => {
    ctx.strokeStyle = idx === 0 ? "#4b5563" : "#cbd5e1";
    ctx.lineWidth = idx === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-radius, 0);
  ctx.lineTo(radius, 0);
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, radius);
  ctx.stroke();

  ctx.fillStyle = "#334155";
  ctx.font = "12px system-ui";
  ctx.fillText("N", -4, -radius - 8);
  ctx.fillText("E", radius + 6, 4);
  ctx.fillText("S", -4, radius + 18);
  ctx.fillText("W", -radius - 14, 4);

  ctx.fillStyle = "#64748b";
  ctx.fillText("30°", 6, -(2 * radius) / 3 + 4);
  ctx.fillText("60°", 6, -radius / 3 + 4);

  ctx.restore();
}

function drawTrajectory(allTopocentric, currentMinute, radius, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  const visible = allTopocentric.filter((p) => p.topo.altDeg >= 0);
  if (visible.length > 1) {
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    visible.forEach((point, index) => {
      const coords = skyPoint(point.topo.azDeg, point.topo.altDeg, radius);
      if (index === 0) {
        ctx.moveTo(coords.x, coords.y);
      } else {
        ctx.lineTo(coords.x, coords.y);
      }
    });
    ctx.stroke();
  }

  const current = allTopocentric[currentMinute];
  if (current.topo.altDeg >= 0) {
    const marker = skyPoint(current.topo.azDeg, current.topo.altDeg, radius);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function render() {
  const currentMinute = Number(ids.slider.value);
  const observer = {
    lat: Number(ids.obsLat.value),
    lon: Number(ids.obsLon.value)
  };

  const allTopocentric = [];
  for (let minute = 0; minute <= ORBIT_MINUTES; minute += 1) {
    allTopocentric.push(computeTopocentric(minute, observer));
  }

  const current = allTopocentric[currentMinute];
  const visibleCount = allTopocentric.filter((step) => step.topo.altDeg > 0).length;

  ids.timeLabel.textContent = `${currentMinute} / ${ORBIT_MINUTES} min`;
  ids.status.textContent = visibleCount > 0 ? "Trajectory drawn" : "Never above horizon at this location";

  const cx = ids.canvas.width / 2;
  const cy = ids.canvas.height / 2;
  const radius = Math.min(cx, cy) - 26;
  drawSkyGrid(cx, cy, radius);
  drawTrajectory(allTopocentric, currentMinute, radius, cx, cy);

  ids.out.textContent = [
    "Synthetic orbit to local sky trajectory",
    "",
    `Observer: lat=${fmt(observer.lat, 4)}°, lon=${fmt(observer.lon, 4)}°`,
    `Orbit minute: ${currentMinute} / ${ORBIT_MINUTES}`,
    `Satellite subpoint: lat=${fmt(current.sat.lat, 4)}°, lon=${fmt(current.sat.lon, 4)}°, alt=${fmt(current.sat.altM / 1000, 1)} km`,
    "",
    "Current local sky coordinates",
    `  altitude=${fmt(current.topo.altDeg, 3)}°`,
    `  azimuth=${fmt(current.topo.azDeg, 3)}°`,
    `  slant range=${fmt(current.topo.rangeKm, 3)} km`,
    `  visible now=${current.topo.altDeg > 0 ? "YES" : "NO"}`,
    `  visible samples this orbit=${visibleCount}/${ORBIT_MINUTES + 1}`
  ].join("\n");
}

function play() {
  if (timer) return;
  const stepMs = Math.max(20, Number(ids.stepMs.value) || 120);
  timer = setInterval(() => {
    const next = (Number(ids.slider.value) + 1) % (ORBIT_MINUTES + 1);
    ids.slider.value = String(next);
    render();
  }, stepMs);
}

function pause() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

ids.slider.addEventListener("input", render);
ids.obsLat.addEventListener("input", render);
ids.obsLon.addEventListener("input", render);
ids.stepMs.addEventListener("change", () => {
  if (timer) {
    pause();
    play();
  }
});
ids.play.addEventListener("click", play);
ids.pause.addEventListener("click", pause);

render();
