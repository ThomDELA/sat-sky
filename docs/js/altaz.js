"use strict";

const WGS84_A = 6378137.0;
const WGS84_E2 = 6.69437999014e-3;

const ids = {
  obsLat: document.getElementById("obs-lat"),
  obsLon: document.getElementById("obs-lon"),
  obsAlt: document.getElementById("obs-alt"),
  tgtLat: document.getElementById("tgt-lat"),
  tgtLon: document.getElementById("tgt-lon"),
  tgtAlt: document.getElementById("tgt-alt"),
  status: document.getElementById("status"),
  out: document.getElementById("out"),
  compute: document.getElementById("compute")
};

function deg2rad(deg) {
  return deg * Math.PI / 180;
}

function rad2deg(rad) {
  return rad * 180 / Math.PI;
}

function toEcef(latDeg, lonDeg, altM) {
  const lat = deg2rad(latDeg);
  const lon = deg2rad(lonDeg);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const x = (N + altM) * cosLat * cosLon;
  const y = (N + altM) * cosLat * sinLon;
  const z = (N * (1 - WGS84_E2) + altM) * sinLat;

  return { x, y, z };
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

  const east = -sinLon * dx + cosLon * dy;
  const north = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz;
  const up = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;

  return { east, north, up };
}

function enuToAltAz(enu) {
  const horizontal = Math.hypot(enu.east, enu.north);
  const range = Math.hypot(horizontal, enu.up);
  const altitude = rad2deg(Math.atan2(enu.up, horizontal));
  const azimuth = (rad2deg(Math.atan2(enu.east, enu.north)) + 360) % 360;
  return { altitude, azimuth, range };
}

function fmt(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "NaN";
}

function compute() {
  try {
    ids.status.textContent = "Computing…";

    const observer = {
      lat: Number(ids.obsLat.value),
      lon: Number(ids.obsLon.value),
      alt: Number(ids.obsAlt.value)
    };
    const target = {
      lat: Number(ids.tgtLat.value),
      lon: Number(ids.tgtLon.value),
      alt: Number(ids.tgtAlt.value)
    };

    const obsEcef = toEcef(observer.lat, observer.lon, observer.alt);
    const tgtEcef = toEcef(target.lat, target.lon, target.alt);
    const enu = ecefToEnu(observer.lat, observer.lon, obsEcef, tgtEcef);
    const altAz = enuToAltAz(enu);

    ids.out.textContent = [
      "Coordinate pipeline",
      "",
      `Observer geodetic: lat=${fmt(observer.lat, 4)}°, lon=${fmt(observer.lon, 4)}°, alt=${fmt(observer.alt, 1)} m`,
      `Target geodetic:   lat=${fmt(target.lat, 4)}°, lon=${fmt(target.lon, 4)}°, alt=${fmt(target.alt, 1)} m`,
      "",
      "Observer ECEF (m)",
      `  x=${fmt(obsEcef.x, 3)}  y=${fmt(obsEcef.y, 3)}  z=${fmt(obsEcef.z, 3)}`,
      "Target ECEF (m)",
      `  x=${fmt(tgtEcef.x, 3)}  y=${fmt(tgtEcef.y, 3)}  z=${fmt(tgtEcef.z, 3)}`,
      "",
      "Relative ENU vector (m)",
      `  east=${fmt(enu.east, 3)}  north=${fmt(enu.north, 3)}  up=${fmt(enu.up, 3)}`,
      "",
      "Topocentric result",
      `  altitude=${fmt(altAz.altitude, 4)}°`,
      `  azimuth=${fmt(altAz.azimuth, 4)}°`,
      `  slant range=${fmt(altAz.range / 1000, 3)} km`
    ].join("\n");

    ids.status.textContent = "OK";
  } catch (error) {
    ids.status.textContent = "Error";
    ids.out.textContent = `Failed to compute coordinates.\n\n${String(error?.message || error)}`;
  }
}

ids.compute.addEventListener("click", compute);
compute();
