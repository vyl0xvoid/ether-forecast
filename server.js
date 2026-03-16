const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { spawn } = require("child_process");
const Astronomy = require("astronomy-engine");
const { Origin, Horoscope } = require("circular-natal-horoscope-js");

const PORT = Number(process.env.PORT) || 3021;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

/* ── Birth Data Parsing ──────────────────────── */

function parseBirthParams(url) {
  const p = url.searchParams;
  if (!p.has("birthDate")) return null;
  const [year, month, day] = p.get("birthDate").split("-").map(Number);
  const [hour, minute] = (p.get("birthTime") || "12:00").split(":").map(Number);
  return {
    year, month, date: day,
    hour: hour || 12, minute: minute || 0,
    latitude: Number(p.get("lat")) || 0,
    longitude: Number(p.get("lng")) || 0,
    city: p.get("city") || "Unknown",
    houseSystem: "placidus", zodiac: "tropical"
  };
}

function configFromBody(profile) {
  if (!profile || !profile.birthDate) return null;
  const [y, m, d] = profile.birthDate.split("-").map(Number);
  const [hr, mn] = (profile.birthTime || "12:00").split(":").map(Number);
  return {
    year: y, month: m, date: d,
    hour: hr || 12, minute: mn || 0,
    latitude: Number(profile.lat) || 0,
    longitude: Number(profile.lng) || 0,
    city: profile.city || "Unknown",
    houseSystem: "placidus", zodiac: "tropical"
  };
}

function getConfig(url) {
  return parseBirthParams(url);
}

function requireConfig(res, config) {
  if (!config) {
    sendJson(res, 200, { error: "no_profile", message: "Set up your birth data first." });
    return false;
  }
  return true;
}

/* ── Numerology ──────────────────────────────── */

function reduceToSingleDigit(n) {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split("").reduce((s, d) => s + Number(d), 0);
  }
  return n;
}

const NUMEROLOGY_MEANINGS = {
  1: { theme: "New Beginnings", energy: "Initiative, independence, leadership. Start something. Take the first step. Trust the instinct to move.", good: "Starting projects, solo decisions, courage" },
  2: { theme: "Partnership", energy: "Patience, diplomacy, sensitivity. Listen more than you speak. Collaborate. Let things develop at their own pace.", good: "Collaboration, nurturing, details" },
  3: { theme: "Expression", energy: "Creativity, joy, social connection. Your voice carries today. Write, share, make something. Don't overthink it.", good: "Writing, art, socializing, play" },
  4: { theme: "Foundation", energy: "Structure, discipline, practical work. Build the container. Organize. Show up for the necessary.", good: "Planning, organizing, physical work, routines" },
  5: { theme: "Change", energy: "Movement, freedom, the unexpected. Flexibility wins today. Something better might show up if you don't cling to the plan.", good: "Travel, new experiences, adaptability" },
  6: { theme: "Nurture", energy: "Home, responsibility, care. Tend to what matters. Heal something. Be of service without losing yourself.", good: "Home, family, healing, aesthetics" },
  7: { theme: "Reflection", energy: "Solitude, analysis, inner work. Go inward. Research. Meditate. Your best insights come alone today.", good: "Research, meditation, study, spiritual practice" },
  8: { theme: "Power", energy: "Authority, abundance, manifestation. Think bigger. Make the decision. Step into your authority.", good: "Business, money moves, strategy, ambition" },
  9: { theme: "Completion", energy: "Release, wisdom, generosity. Let something go. Finish what's lingering. Compassion over control.", good: "Endings, forgiveness, big-picture thinking" },
  11: { theme: "Illumination", energy: "Spiritual insight, heightened intuition, visionary thinking. Pay attention to what flashes through your mind uninvited.", good: "Intuitive work, teaching, channeling" },
  22: { theme: "Master Builder", energy: "Large-scale creation, turning vision into structure. Dream practically. Build something that outlasts the mood.", good: "Big projects, infrastructure, manifesting" },
  33: { theme: "Master Teacher", energy: "Healing through compassion, uplifting others, selfless service. The highest vibration of care.", good: "Teaching, healing, creative devotion" }
};

function getDailyNumerology(config) {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const y = now.getFullYear();

  const universalDay = reduceToSingleDigit(m + d + reduceToSingleDigit(y));
  const birthMonth = config.month;
  const birthDay = config.date;
  const personalYear = reduceToSingleDigit(reduceToSingleDigit(birthMonth) + reduceToSingleDigit(birthDay) + reduceToSingleDigit(y));
  const personalDay = reduceToSingleDigit(personalYear + m + d);

  return {
    personalDay, personalYear, universalDay,
    personalDayMeaning: NUMEROLOGY_MEANINGS[personalDay] || NUMEROLOGY_MEANINGS[reduceToSingleDigit(personalDay)],
    universalDayMeaning: NUMEROLOGY_MEANINGS[universalDay] || NUMEROLOGY_MEANINGS[reduceToSingleDigit(universalDay)]
  };
}

/* ── Destiny Matrix Calculation ──────────────── */

function reduceTo22(n) {
  if (n <= 0) return 1;
  if (n <= 22) return n;
  // Sum digits until <= 22
  while (n > 22) {
    n = String(n).split("").reduce((s, d) => s + Number(d), 0);
  }
  return n || 1;
}

function calculateDestinyMatrix(birthDate) {
  const [year, month, day] = birthDate.split("-").map(Number);

  const A = reduceTo22(day);               // Top - Talents / Conscious
  const B = reduceTo22(month);             // Right - Purpose
  const C = reduceTo22(                     // Bottom - Karmic Tail
    String(year).split("").reduce((s, d) => s + Number(d), 0)
  );
  const D = reduceTo22(A + B + C);         // Left - Outer Self
  const center = reduceTo22(A + B + C + D); // Center - Core

  // Corners (diagonals between cardinal points)
  const TL = reduceTo22(A + D);  // top-left
  const TR = reduceTo22(A + B);  // top-right
  const BL = reduceTo22(C + D);  // bottom-left
  const BR = reduceTo22(B + C);  // bottom-right

  // Edge midpoints
  const topLeft = reduceTo22(A + TL);
  const topRight = reduceTo22(A + TR);
  const rightTop = reduceTo22(B + TR);
  const rightBottom = reduceTo22(B + BR);
  const leftTop = reduceTo22(D + TL);
  const leftBottom = reduceTo22(D + BL);
  const bottomRight = reduceTo22(C + BR);
  const bottomLeft = reduceTo22(C + BL);

  // Inner ring (between center and cardinal)
  const innerTop = reduceTo22(center + A);
  const innerRight = reduceTo22(center + B);
  const innerBottom = reduceTo22(center + C);
  const innerLeft = reduceTo22(center + D);

  // Life path
  const lifePath = reduceToSingleDigit(
    String(year).split("").reduce((s, d) => s + Number(d), 0) + month + day
  );

  // Current age cycle (personal year arcana)
  const age = new Date().getFullYear() - year;
  const currentCycleArcana = reduceTo22(age);

  return {
    center, A, B, C, D,
    TL, TR, BL, BR,
    edges: { topLeft, topRight, rightTop, rightBottom, leftTop, leftBottom, bottomRight, bottomLeft },
    inner: { top: innerTop, right: innerRight, bottom: innerBottom, left: innerLeft },
    lifePath, currentCycleArcana, currentAge: age,
    birthDate
  };
}

/* ── Aspect Calculation ──────────────────────── */

function angleDifference(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

const TRANSIT_ENERGY = {
  Sun: "identity and conscious direction",
  Moon: "emotional currents and instinctive needs",
  Mercury: "thinking, communication, and mental clarity",
  Venus: "love, beauty, pleasure, and connection",
  Mars: "drive, desire, and physical energy",
  Jupiter: "growth, faith, and expansion",
  Saturn: "discipline, structure, and accountability",
  Uranus: "sudden insight, disruption, and liberation",
  Neptune: "dreams, intuition, and spiritual openness",
  Pluto: "deep transformation and power"
};

const NATAL_THEME = {
  Sun: "your core identity and life force",
  Moon: "your emotional body and deepest comfort needs",
  Mercury: "your mind and how you process the world",
  Venus: "your heart, aesthetics, and sense of pleasure",
  Mars: "your drive, courage, and physical vitality",
  Jupiter: "your sense of meaning and where you seek growth",
  Saturn: "your structures, boundaries, and long-term commitments",
  Uranus: "your need for freedom and unconventional expression",
  Neptune: "your imagination, spiritual life, and idealism",
  Pluto: "your relationship with power, depth, and regeneration"
};

const ASPECT_DYNAMICS = {
  Conjunction: { verb: "activating", tone: "intense and focused", feel: "This amplifies the energy like a spotlight — concentrated, undeniable." },
  Opposition: { verb: "opposing", tone: "tense but illuminating", feel: "Something asks to be seen from the other side. The tension itself is the teacher." },
  Trine: { verb: "harmonizing with", tone: "easy and flowing", feel: "A green light. The energy moves without friction — use it before it passes." },
  Square: { verb: "challenging", tone: "frictional and demanding", feel: "Something needs to shift. The discomfort is pointing somewhere real." },
  Sextile: { verb: "gently supporting", tone: "an open door", feel: "The opportunity is there if you reach for it." }
};

function generateAspectReading(transitBody, transitSign, natalBody, natalSign, aspect, orb) {
  const tEnergy = TRANSIT_ENERGY[transitBody] || transitBody;
  const nTheme = NATAL_THEME[natalBody] || natalBody;
  const dynamics = ASPECT_DYNAMICS[aspect];
  const tight = orb < 2;
  let reading = `Transit ${transitBody} in ${transitSign} is ${dynamics.verb} your natal ${natalBody} in ${natalSign}. `;
  reading += `The energy around ${tEnergy} meets ${nTheme} — ${dynamics.tone}. `;
  if (tight) reading += `This one is tight at ${orb}°, so you'll feel it. `;
  reading += dynamics.feel;
  return reading;
}

/* ── Sky Events ──────────────────────────────── */

const METEOR_SHOWERS = [
  { name: "Quadrantids", peak: "01-03", end: "01-04", rate: "up to 120/hr" },
  { name: "Lyrids", peak: "04-22", end: "04-23", rate: "up to 18/hr" },
  { name: "Eta Aquariids", peak: "05-06", end: "05-07", rate: "up to 50/hr" },
  { name: "Delta Aquariids", peak: "07-30", end: "07-31", rate: "up to 25/hr" },
  { name: "Perseids", peak: "08-12", end: "08-13", rate: "up to 100/hr" },
  { name: "Draconids", peak: "10-08", end: "10-09", rate: "up to 10/hr" },
  { name: "Orionids", peak: "10-21", end: "10-22", rate: "up to 20/hr" },
  { name: "Leonids", peak: "11-17", end: "11-18", rate: "up to 15/hr" },
  { name: "Geminids", peak: "12-14", end: "12-15", rate: "up to 150/hr" },
  { name: "Ursids", peak: "12-22", end: "12-23", rate: "up to 10/hr" }
];

function getSkyEvents(now) {
  const events = [];
  const year = now.getFullYear();
  const today = now.toISOString().slice(5, 10); // MM-DD
  const msPerDay = 86400000;

  // Eclipses (next 365 days)
  try {
    const le = Astronomy.SearchLunarEclipse(now);
    if (le && le.peak.date - now < 365 * msPerDay) {
      const daysAway = Math.ceil((le.peak.date - now) / msPerDay);
      const kindLabel = le.kind === "total" ? "Total Lunar Eclipse" : le.kind === "partial" ? "Partial Lunar Eclipse" : "Penumbral Lunar Eclipse";
      events.push({ type: "eclipse", name: kindLabel, date: le.peak.date.toISOString().slice(0, 10), daysAway });
    }
  } catch {}

  try {
    const se = Astronomy.SearchGlobalSolarEclipse(now);
    if (se && se.peak.date - now < 365 * msPerDay) {
      const daysAway = Math.ceil((se.peak.date - now) / msPerDay);
      const kindLabel = se.kind === "total" ? "Total Solar Eclipse" : se.kind === "annular" ? "Annular Solar Eclipse" : "Partial Solar Eclipse";
      events.push({ type: "eclipse", name: kindLabel, date: se.peak.date.toISOString().slice(0, 10), daysAway });
    }
  } catch {}

  // Meteor showers — show if within 30 days
  for (const shower of METEOR_SHOWERS) {
    const peakDate = new Date(`${year}-${shower.peak}T00:00:00`);
    // If peak is past, check next year
    if (peakDate < now) peakDate.setFullYear(year + 1);
    const daysAway = Math.ceil((peakDate - now) / msPerDay);
    if (daysAway <= 30) {
      events.push({ type: "meteor", name: `${shower.name} meteor shower`, date: peakDate.toISOString().slice(0, 10), daysAway, note: shower.rate });
    }
  }

  // Solstices & Equinoxes (next occurrence)
  try {
    const seasons = Astronomy.Seasons(year);
    const seasonEvents = [
      { name: "Vernal Equinox", date: seasons.mar_equinox.date },
      { name: "Summer Solstice", date: seasons.jun_solstice.date },
      { name: "Autumnal Equinox", date: seasons.sep_equinox.date },
      { name: "Winter Solstice", date: seasons.dec_solstice.date }
    ];
    // Also check next year's vernal equinox
    const nextSeasons = Astronomy.Seasons(year + 1);
    seasonEvents.push({ name: "Vernal Equinox", date: nextSeasons.mar_equinox.date });

    for (const s of seasonEvents) {
      const daysAway = Math.ceil((s.date - now) / msPerDay);
      if (daysAway > 0 && daysAway <= 45) {
        events.push({ type: "season", name: s.name, date: s.date.toISOString().slice(0, 10), daysAway });
      }
    }
  } catch {}

  events.sort((a, b) => a.daysAway - b.daysAway);
  return events;
}

/* ── Retrograde Detection ────────────────────── */

function getRetrogrades(now) {
  const retrogrades = [];
  const later = new Date(now.getTime() + 86400000);
  const RETRO_PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
  const obs = new Astronomy.Observer(0, 0, 0);

  for (const body of RETRO_PLANETS) {
    // Must use GEOCENTRIC longitude (apparent from Earth) not heliocentric
    const eq1 = Astronomy.Equator(body, now, obs, true, true);
    const ec1 = Astronomy.Ecliptic(eq1.vec);
    const eq2 = Astronomy.Equator(body, later, obs, true, true);
    const ec2 = Astronomy.Ecliptic(eq2.vec);

    let diff = ec2.elon - ec1.elon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (diff < 0) {
      const { sign, degree } = zodiacFromLongitude(ec1.elon);
      retrogrades.push({ body, sign, degree });
    }
  }
  return retrogrades;
}

/* ── Transit Snapshot ────────────────────────── */

function zodiacFromLongitude(longitude) {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  return { sign: SIGNS[signIndex], degree: Number((normalized % 30).toFixed(1)), longitude: Number(normalized.toFixed(2)) };
}

function getPlanetLongitude(body, date) {
  // Sun's geocentric ecliptic longitude
  if (body === "Sun") return Astronomy.SunPosition(date).elon;
  // All other planets: use GEOCENTRIC ecliptic longitude (apparent from Earth)
  // EclipticLongitude() returns heliocentric which is wrong for astrology
  const obs = new Astronomy.Observer(0, 0, 0);
  const eq = Astronomy.Equator(body, date, obs, true, true);
  const ec = Astronomy.Ecliptic(eq.vec);
  return ec.elon;
}

function getTransitSnapshot() {
  const now = new Date();
  const transits = PLANETS.map((body) => ({ body, ...zodiacFromLongitude(getPlanetLongitude(body, now)) }));
  const moonPhaseDegrees = Astronomy.MoonPhase(now);
  const moonPhaseLabel =
    moonPhaseDegrees < 45 ? "New Moon" :
    moonPhaseDegrees < 90 ? "Waxing Crescent" :
    moonPhaseDegrees < 135 ? "First Quarter" :
    moonPhaseDegrees < 180 ? "Waxing Gibbous" :
    moonPhaseDegrees < 225 ? "Full Moon" :
    moonPhaseDegrees < 270 ? "Waning Gibbous" :
    moonPhaseDegrees < 315 ? "Last Quarter" : "Waning Crescent";
  // Next full & new moon
  const nextFull = Astronomy.SearchMoonPhase(180, now, 40);
  const nextNew = Astronomy.SearchMoonPhase(0, now, 40);
  const daysToFull = Math.ceil((nextFull.date - now) / (1000 * 60 * 60 * 24));
  const daysToNew = Math.ceil((nextNew.date - now) / (1000 * 60 * 60 * 24));

  // Full moon name based on month
  const fullMoonMonth = nextFull.date.getMonth();
  const MOON_NAMES = [
    "Wolf Moon", "Snow Moon", "Worm Moon", "Pink Moon", "Flower Moon", "Strawberry Moon",
    "Buck Moon", "Sturgeon Moon", "Harvest Moon", "Hunter's Moon", "Beaver Moon", "Cold Moon"
  ];

  // Supermoon check: full moon within 2 days of perigee, and perigee < 360,000 km
  let isSupermoon = false;
  let supermoonNote = null;
  try {
    let apsis = Astronomy.SearchLunarApsis(new Date(nextFull.date.getTime() - 15 * 86400000));
    for (let i = 0; i < 4; i++) {
      if (apsis.kind === 0 && apsis.dist_km < 360000) {
        const daysBetween = Math.abs((apsis.time.date - nextFull.date) / 86400000);
        if (daysBetween < 2) { isSupermoon = true; break; }
      }
      apsis = Astronomy.NextLunarApsis(apsis);
    }
  } catch {}
  if (isSupermoon) supermoonNote = "Supermoon";

  // Micro moon check: full moon near apogee > 404,000 km
  let isMicromoon = false;
  try {
    let apsis = Astronomy.SearchLunarApsis(new Date(nextFull.date.getTime() - 15 * 86400000));
    for (let i = 0; i < 4; i++) {
      if (apsis.kind === 1 && apsis.dist_km > 404000) {
        const daysBetween = Math.abs((apsis.time.date - nextFull.date) / 86400000);
        if (daysBetween < 2) { isMicromoon = true; break; }
      }
      apsis = Astronomy.NextLunarApsis(apsis);
    }
  } catch {}
  if (isMicromoon && !isSupermoon) supermoonNote = "Micro Moon";

  return {
    updatedAt: now.toISOString(), moonPhase: moonPhaseLabel, transits,
    nextFullMoon: {
      date: nextFull.date.toISOString().slice(0, 10),
      daysAway: daysToFull,
      name: MOON_NAMES[fullMoonMonth],
      note: supermoonNote
    },
    nextNewMoon: { date: nextNew.date.toISOString().slice(0, 10), daysAway: daysToNew },
    skyEvents: getSkyEvents(now),
    retrogrades: getRetrogrades(now)
  };
}

/* ── Natal Chart Snapshot ────────────────────── */

function formatArc(arc) {
  // Convert to sign-relative degree (0-29° within the sign)
  const totalDegrees = arc.degrees;
  const signDegree = totalDegrees % 30;
  return `${signDegree}° ${arc.minutes}'`;
}

function getNatalChartSnapshot(config) {
  const origin = new Origin({
    year: config.year, month: config.month - 1, date: config.date,
    hour: config.hour, minute: config.minute,
    latitude: config.latitude, longitude: config.longitude
  });
  const chart = new Horoscope({
    origin, houseSystem: config.houseSystem || "placidus",
    zodiac: config.zodiac || "tropical",
    aspectPoints: ["bodies", "points", "angles"],
    aspectWithPoints: ["bodies", "points", "angles"],
    aspectTypes: ["major"], language: "en"
  });

  const majorBodies = chart.CelestialBodies.all.map((body) => ({
    key: body.key, label: body.label, sign: body.Sign.label,
    house: body.House.id, degree: formatArc(body.ChartPosition.Ecliptic.ArcDegrees)
  }));

  const chartPoints = [
    { label: "Ascendant", sign: chart.Ascendant.Sign.label, degree: formatArc(chart.Ascendant.ChartPosition.Ecliptic.ArcDegrees) },
    { label: "Midheaven", sign: chart.Midheaven.Sign.label, degree: formatArc(chart.Midheaven.ChartPosition.Ecliptic.ArcDegrees) }
  ];

  const aspects = chart.Aspects.all
    .filter((a) => a.aspectLevel === "major")
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 8)
    .map((a) => ({ from: a.point1Label, type: a.label, to: a.point2Label, orb: Number(a.orb.toFixed(2)) }));

  const wheelPlanets = chart.CelestialBodies.all.map((body) => ({
    label: body.label, angle: body.ChartPosition.Ecliptic.DecimalDegrees
  }));

  const houseCusps = chart.Houses.map((house) => ({
    id: house.id, angle: house.ChartPosition.StartPosition.Ecliptic.DecimalDegrees
  }));

  const birthDisplay = new Date(config.year, config.month - 1, config.date)
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const timeDisplay = `${config.hour % 12 || 12}:${String(config.minute).padStart(2, "0")} ${config.hour >= 12 ? "PM" : "AM"}`;

  return {
    birth: { date: birthDisplay, time: timeDisplay, place: config.city },
    bigThree: {
      sun: majorBodies.find((b) => b.key === "sun"),
      moon: majorBodies.find((b) => b.key === "moon"),
      rising: { label: "Ascendant", sign: chart.Ascendant.Sign.label, house: 1, degree: formatArc(chart.Ascendant.ChartPosition.Ecliptic.ArcDegrees) }
    },
    points: chartPoints, bodies: majorBodies, aspects,
    wheel: { planets: wheelPlanets, houses: houseCusps },
    // These are generated by Claude on demand, not hardcoded
    chartReading: null,
    deepDives: null
  };
}

/* ── Vedic Chart ─────────────────────────────── */

function getVedicChartSnapshot(config) {
  const origin = new Origin({
    year: config.year, month: config.month - 1, date: config.date,
    hour: config.hour, minute: config.minute,
    latitude: config.latitude, longitude: config.longitude
  });
  const chart = new Horoscope({
    origin, houseSystem: config.houseSystem || "placidus", zodiac: "sidereal",
    aspectPoints: ["bodies", "angles"], aspectWithPoints: ["bodies", "angles"],
    aspectTypes: ["major"], language: "en"
  });
  const bodies = chart.CelestialBodies.all.map((body) => ({
    label: body.label, sign: body.Sign.label, house: body.House.id,
    degree: formatArc(body.ChartPosition.Ecliptic.ArcDegrees)
  }));
  return {
    zodiac: "Sidereal",
    bigThree: {
      sun: bodies.find((b) => b.label === "Sun"),
      moon: bodies.find((b) => b.label === "Moon"),
      rising: { label: "Ascendant", sign: chart.Ascendant.Sign.label, house: 1, degree: formatArc(chart.Ascendant.ChartPosition.Ecliptic.ArcDegrees) }
    },
    bodies: bodies.slice(0, 10)
  };
}

/* ── Galactic Center & Star Systems ───────────── */

// Individual fixed stars for the galactic connection table
const FIXED_STARS = [
  // Constellation groupings with primary star longitudes
  { constellation: "Andromeda", stars: [{ name: "Mirach", longitude: 30.4 }, { name: "Almach", longitude: 44.0 }] },
  { constellation: "Bootes", stars: [{ name: "Arcturus", longitude: 204.2 }] },
  { constellation: "Canis Minor", stars: [{ name: "Procyon", longitude: 115.7 }] },
  { constellation: "Canis Major", stars: [{ name: "Sirius", longitude: 104.1 }] },
  { constellation: "Centaurus", stars: [{ name: "Alpha Centauri", longitude: 239.7 }, { name: "Hadar", longitude: 233.8 }] },
  { constellation: "Galactic", stars: [{ name: "Galactic Center", longitude: 266.4 }] },
  { constellation: "Lyra", stars: [{ name: "Vega", longitude: 285.3 }] },
  { constellation: "Orion", stars: [{ name: "Betelgeuse", longitude: 88.8 }, { name: "Rigel", longitude: 77.0 }, { name: "Bellatrix", longitude: 81.0 }] },
  { constellation: "Pleiades", stars: [{ name: "Alcyone", longitude: 60.0 }] },
  { constellation: "Virgo", stars: [{ name: "Spica", longitude: 203.8 }, { name: "Vindemiatrix", longitude: 190.0 }] },
  { constellation: "Piscis Austrinus", stars: [{ name: "Fomalhaut", longitude: 334.0 }] },
  { constellation: "Leo", stars: [{ name: "Regulus", longitude: 150.0 }] },
  { constellation: "Scorpius", stars: [{ name: "Antares", longitude: 249.8 }] },
  { constellation: "Taurus", stars: [{ name: "Aldebaran", longitude: 69.8 }] },
  { constellation: "Aquila", stars: [{ name: "Altair", longitude: 301.8 }] },
  { constellation: "Cygnus", stars: [{ name: "Deneb", longitude: 335.3 }] },
  { constellation: "Ursa Major", stars: [{ name: "Dubhe", longitude: 135.2 }] },
  { constellation: "Draco", stars: [{ name: "Thuban", longitude: 127.5 }] },
  { constellation: "Cassiopeia", stars: [{ name: "Schedar", longitude: 37.5 }] },
  { constellation: "Perseus", stars: [{ name: "Algol", longitude: 56.2 }] }
];

const CONSTELLATION_LORE = {
  "Andromeda": "Freedom, sovereignty, creative vision, multidimensional artistry.",
  "Bootes": "The Guardian. Future technology, healing architecture, bridge-building.",
  "Canis Minor": "The Loyal Companion. Devotion, service, emotional intelligence.",
  "Canis Major": "Sirius lineage. Ancient Egypt, Isis mysteries, advanced technology, water codes.",
  "Centaurus": "The Centaur. Grounded cosmic wisdom, bridge between worlds, practical spirituality.",
  "Galactic": "Galactic Center. Source signal, cosmic downloads, connection to central sun consciousness.",
  "Lyra": "The Harp. Original humanoid seed. Music, frequency, ancient memory, the first home.",
  "Orion": "The Hunter. Duality, warrior energy, light/dark integration, cosmic battle scars.",
  "Pleiades": "The Seven Sisters. Healing, compassion, sensitivity, emotional telepathy.",
  "Virgo": "The Priestess. Sacred service, harvest wisdom, earth-body connection.",
  "Piscis Austrinus": "The Southern Fish. Mysticism, idealism, dreams made manifest. Royal star Fomalhaut.",
  "Leo": "The Lion. Royal star Regulus. Leadership, courage, karmic tests of power.",
  "Scorpius": "The Scorpion. Antares, rival of Mars. Raw power, transformation through fire.",
  "Taurus": "The Bull. Aldebaran, Eye of the Bull. Integrity, truth-telling, moral courage.",
  "Aquila": "The Eagle. Ascension, vision from above, spiritual flight.",
  "Cygnus": "The Swan. Cosmic gateway, higher consciousness, transmutation.",
  "Ursa Major": "The Great Bear. Protection, shamanic power, ancestral guidance.",
  "Draco": "The Dragon. Ancient knowledge, kundalini, guardian of cosmic secrets.",
  "Cassiopeia": "The Queen. Sovereignty, divine feminine power, star throne.",
  "Perseus": "The Hero. Algol — the demon star. Shadow integration, fierce protection."
};

const ORB_CONJUNCT = 5;
const ORB_OPPOSITE = 5;

function getGalacticSnapshot(config) {
  const natal = getNatalChartSnapshot(config);

  // Build the table: for each planet, find conjunct and opposite constellation connections
  const planetTable = natal.bodies.filter(b => b.label !== "Sirius").map(body => {
    const planetAngle = natal.wheel.planets.find(p => p.label === body.label)?.angle;
    if (planetAngle === undefined) return null;

    const conjunct = [];
    const opposite = [];

    for (const group of FIXED_STARS) {
      for (const star of group.stars) {
        const diff = angleDifference(planetAngle, star.longitude);
        if (diff <= ORB_CONJUNCT) {
          conjunct.push({ constellation: group.constellation, star: star.name, orb: Number(diff.toFixed(1)) });
        }
        if (Math.abs(diff - 180) <= ORB_OPPOSITE) {
          opposite.push({ constellation: group.constellation, star: star.name, orb: Number(Math.abs(diff - 180).toFixed(1)) });
        }
      }
    }

    // Deduplicate by constellation (keep tightest orb)
    const dedup = (arr) => {
      const map = {};
      for (const c of arr) {
        if (!map[c.constellation] || c.orb < map[c.constellation].orb) map[c.constellation] = c;
      }
      return Object.values(map).sort((a, b) => a.orb - b.orb);
    };

    return {
      planet: body.label,
      sign: body.sign,
      degree: body.degree,
      house: body.house,
      conjunct: dedup(conjunct),
      opposite: dedup(opposite)
    };
  }).filter(Boolean);

  // Summary: which constellations appear most across all connections
  const constellationCount = {};
  for (const row of planetTable) {
    for (const c of [...row.conjunct, ...row.opposite]) {
      constellationCount[c.constellation] = (constellationCount[c.constellation] || 0) + 1;
    }
  }
  const topConstellations = Object.entries(constellationCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, lore: CONSTELLATION_LORE[name] || "" }));

  return {
    galacticCenter: { sign: "Sagittarius", degree: "26° 24'" },
    planetTable,
    topConstellations,
    interpretation: null
  };
}

/* ── Daily Reading ───────────────────────────── */

function getDailyReadingSnapshot(config) {
  const now = new Date();
  const transits = getTransitSnapshot();
  const natal = getNatalChartSnapshot(config);

  const MAJOR_BODIES = new Set(PLANETS);
  const natalPositions = {};
  natal.wheel.planets.forEach(p => { if (MAJOR_BODIES.has(p.label)) natalPositions[p.label] = p.angle; });
  const natalSigns = {};
  natal.bodies.forEach(b => { if (MAJOR_BODIES.has(b.label)) natalSigns[b.label] = b.sign; });

  const ASPECT_DEFS = [
    { name: "Conjunction", angle: 0, orb: 8 }, { name: "Opposition", angle: 180, orb: 8 },
    { name: "Trine", angle: 120, orb: 7 }, { name: "Square", angle: 90, orb: 7 },
    { name: "Sextile", angle: 60, orb: 5 }
  ];

  const activeAspects = [];
  for (const transit of transits.transits) {
    for (const [natalName, natalLong] of Object.entries(natalPositions)) {
      if (transit.body === natalName) continue;
      const diff = angleDifference(transit.longitude, natalLong);
      for (const aspect of ASPECT_DEFS) {
        const orb = Math.abs(diff - aspect.angle);
        if (orb <= aspect.orb) {
          activeAspects.push({
            transit: transit.body, transitSign: transit.sign,
            natal: natalName, natalSign: natalSigns[natalName] || "",
            aspect: aspect.name, orb: Number(orb.toFixed(1)),
            intensity: Number((1 - orb / aspect.orb).toFixed(2)),
            reading: generateAspectReading(transit.body, transit.sign, natalName, natalSigns[natalName] || "", aspect.name, Number(orb.toFixed(1)))
          });
        }
      }
    }
  }

  activeAspects.sort((a, b) => b.intensity - a.intensity);
  const topAspects = activeAspects.slice(0, 6);

  let headline = "Quiet sky today — rest and integrate.";
  if (topAspects.length > 0) {
    const top = topAspects[0];
    headline = `${top.transit} ${top.aspect.toLowerCase()}s your ${top.natal} — ${ASPECT_DYNAMICS[top.aspect].tone}.`;
  }

  const moonTransit = transits.transits.find(t => t.body === "Moon");

  return {
    date: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    headline,
    moonSign: moonTransit ? moonTransit.sign : "Unknown",
    moonDegree: moonTransit ? moonTransit.degree : 0,
    moonPhase: transits.moonPhase,
    nextFullMoon: transits.nextFullMoon,
    nextNewMoon: transits.nextNewMoon,
    skyEvents: transits.skyEvents,
    retrogrades: transits.retrogrades,
    aspects: topAspects,
    transits: transits.transits,
    numerology: getDailyNumerology(config)
  };
}

/* ── Annual Forecast (skeleton) ──────────────── */

function getAnnualForecastSkeleton(config) {
  const transits = getTransitSnapshot();
  const natal = getNatalChartSnapshot(config);
  const byBody = Object.fromEntries(transits.transits.map((b) => [b.body, b]));
  const year = new Date().getFullYear();

  return {
    year,
    basedOn: {
      natal: `${natal.bigThree.sun.sign} Sun, ${natal.bigThree.moon.sign} Moon, ${natal.bigThree.rising.sign} Rising`,
      currentSky: `Sun in ${byBody.Sun.sign}, Jupiter in ${byBody.Jupiter.sign}, Saturn in ${byBody.Saturn.sign}`
    },
    // All content generated by Claude on demand
    headline: null, themes: null, sections: null,
    months: null, guidance: null, windows: null
  };
}

/* ── Space Weather ───────────────────────────── */

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "cosmic-weather-localhost" } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

function kpTone(kp) {
  if (kp >= 7) return "wild";
  if (kp >= 5) return "electric";
  if (kp >= 4) return "activated";
  if (kp >= 2) return "steady";
  return "quiet";
}

function flareTone(fluxClass) {
  if (fluxClass.startsWith("X")) return "solar storm potential";
  if (fluxClass.startsWith("M")) return "charged";
  if (fluxClass.startsWith("C")) return "moderately active";
  return "soft";
}

function classifyXrayFlux(flux) {
  if (flux >= 1e-4) return "X";
  if (flux >= 1e-5) return "M";
  if (flux >= 1e-6) return "C";
  if (flux >= 1e-7) return "B";
  return "A";
}

async function getSpaceWeatherSnapshot() {
  const [kpTable, xrayTable, plasmaTable] = await Promise.all([
    fetchJson("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"),
    fetchJson("https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json"),
    fetchJson("https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json")
  ]);
  const kpRows = kpTable.slice(1).filter((r) => r[0] && r[1]);
  const latestKp = kpRows[kpRows.length - 1];
  const xrayRows = xrayTable.filter((r) => r.energy === "0.1-0.8nm" && typeof r.flux === "number");
  const latestXray = xrayRows[xrayRows.length - 1];
  const xrayClass = classifyXrayFlux(latestXray.flux);
  const plasmaRows = plasmaTable.slice(1).filter((r) => r[0] && r[1]);
  const latestPlasma = plasmaRows[plasmaRows.length - 1];
  const solarWindSpeed = Number(latestPlasma[2]);
  const density = Number(latestPlasma[1]);
  const kpValue = Number(latestKp[1]);
  const resonanceProxy = Math.min(100, Math.round(kpValue * 14 + solarWindSpeed / 20 + (xrayClass === "X" ? 20 : xrayClass === "M" ? 12 : xrayClass === "C" ? 6 : 2)));

  // Human-readable summary of how this might affect people
  let bodySummary;
  if (kpValue >= 7) {
    bodySummary = "Geomagnetic storm active. Sensitive people may feel headaches, sleep disruption, anxiety, or heightened emotional intensity. Ground yourself — bare feet on earth, magnesium, water.";
  } else if (kpValue >= 5) {
    bodySummary = "Elevated geomagnetic activity. You might notice restless sleep, vivid dreams, or emotional sensitivity. Heart palpitations and fatigue are common. Stay hydrated and go easy on yourself.";
  } else if (kpValue >= 4) {
    bodySummary = "Mildly active field. Some people feel subtle buzzing, mild headaches, or emotional shifts. Good day for grounding practices — walk outside, breathe slowly, avoid overstimulation.";
  } else if (solarWindSpeed > 500) {
    bodySummary = "Solar wind is running fast. Even without high Kp, this can affect the nervous system — watch for brain fog, fatigue, or feeling \"wired but tired.\" Rest when your body asks.";
  } else if (xrayClass === "X" || xrayClass === "M") {
    bodySummary = `${xrayClass}-class solar flare detected. CME effects may arrive in 1-3 days. Pre-flare sensitivity is real — if you're feeling off today, the sun might be why.`;
  } else {
    bodySummary = "Quiet conditions. The electromagnetic environment is calm — good baseline for noticing your own rhythms without geomagnetic interference.";
  }

  return {
    updatedAt: new Date().toISOString(), kpIndex: kpValue, kpTone: kpTone(kpValue),
    solarWindSpeed, protonDensity: density, xrayClass, xrayTone: flareTone(xrayClass),
    resonanceProxy, bodySummary
  };
}

/* ── Claude AI Bridge ────────────────────────── */

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["-p", "--output-format", "text"], {
      timeout: 120000,
      env: { ...process.env, LANG: "en_US.UTF-8" }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d; });
    proc.stderr.on("data", (d) => { stderr += d; });
    proc.stdin.write(prompt);
    proc.stdin.end();
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `claude exited with code ${code}`));
      else resolve(stdout.trim());
    });
    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error("Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code && claude login"));
      } else {
        reject(err);
      }
    });
  });
}

function buildChartSummary(config) {
  const natal = getNatalChartSnapshot(config);
  const transits = getTransitSnapshot();

  const natalLines = natal.bodies.map(b => `${b.label}: ${b.sign} H${b.house} ${b.degree}`).join("\n");
  const transitLines = transits.transits.map(t => `${t.body}: ${t.sign} ${t.degree}°`).join("\n");
  const bigThree = `${natal.bigThree.sun.sign} Sun, ${natal.bigThree.moon.sign} Moon, ${natal.bigThree.rising.sign} Rising`;
  const birthDisplay = `${config.month}/${config.date}/${config.year}, ${config.hour % 12 || 12}:${String(config.minute).padStart(2, "0")} ${config.hour >= 12 ? "PM" : "AM"}, ${config.city}`;
  const aspects = natal.aspects.map(a => `${a.from} ${a.type} ${a.to} (${a.orb}°)`).join(", ");

  return { natalLines, transitLines, bigThree, birthDisplay, aspects, natal, transits };
}

const GENERATE_PROMPTS = {
  "chart-reading": (ctx) => `You are an expert astrologer. Given this natal chart, write exactly 6 reading sections as a JSON array. Each object has "title" and "text" fields.

Sections: 1) Core Pattern, 2) Emotional Architecture, 3) Depth Engine, 4) Relationship Classroom, 5) The Wound That Heals, 6) Creative Channel.

Each section should be 3-5 sentences, deeply specific to THESE exact placements. No generic horoscope language. Reference specific signs, houses, and aspects.

Birth: ${ctx.birthDisplay}
Big Three: ${ctx.bigThree}
Placements:
${ctx.natalLines}
Key Aspects: ${ctx.aspects}

Return ONLY valid JSON array, no markdown fences, no other text.`,

  "full-natal": (ctx) => `You are an expert astrologer. Given this natal chart, return a JSON object with two keys:

1. "reading": an array of 6 objects with "title" and "text" fields. Sections: Core Pattern, Emotional Architecture, Depth Engine, Relationship Classroom, The Wound That Heals, Creative Channel. Each 3-5 sentences.

2. "placements": an object where each key is a planet/point name (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Chiron, NorthNode) and the value is a string — a detailed 4-6 sentence interpretation of that placement in this chart. Include sign, house, and degree context. Only include placements that exist in the chart data below.

Birth: ${ctx.birthDisplay}
Big Three: ${ctx.bigThree}
Placements:
${ctx.natalLines}
Key Aspects: ${ctx.aspects}

Be deeply specific to THESE exact placements. No generic horoscope language. Reference specific signs, houses, and how placements interact.

Return ONLY valid JSON, no markdown fences.`,

  "vedic-overview": (ctx, extra) => {
    // Use sidereal data if provided
    const lines = extra.vedicPlacements || ctx.natalLines;
    const b3 = extra.vedicBigThree || ctx.bigThree;
    return `You are an expert Vedic (Jyotish) astrologer. Given this sidereal natal chart, write a concise overview (3-4 paragraphs). Cover: the overall nature of this chart in Vedic terms, key differences from the tropical/Western perspective, notable yogas or combinations, and practical guidance from the Vedic lens.

Birth: ${ctx.birthDisplay}
Big Three (Sidereal): ${b3}
Placements (Sidereal):
${lines}

Be specific to these placements. Reference Nakshatras where relevant. Keep it accessible — not everyone knows Vedic terminology.

Return ONLY the text, no headers or JSON.`;
  },

  "life-theme": (ctx, extra) => `You are an expert astrologer. Write a focused 4-6 sentence interpretation of this life area based on the natal chart below. Be specific to the placements. No generic language.

Life area: ${extra.theme}

Birth: ${ctx.birthDisplay}
Big Three: ${ctx.bigThree}
Placements:
${ctx.natalLines}
Key Aspects: ${ctx.aspects}

Return ONLY the paragraph text, no headers or formatting.`,

  "chart-question": (ctx, extra) => `You are an expert astrologer giving a personalized reading based on a natal chart. Be warm, specific, and reference actual placements.

Birth: ${ctx.birthDisplay}
Big Three: ${ctx.bigThree}
Placements:
${ctx.natalLines}
Key Aspects: ${ctx.aspects}

The user asks: "${extra.question}"

Give a focused, insightful answer (3-5 paragraphs). Reference specific natal placements, houses, and aspects that are relevant to their question. Be honest and nuanced.`,

  "placement-dive": (ctx, extra) => `You are an expert astrologer. Write a detailed interpretation (1 substantial paragraph, 5-8 sentences) for this natal placement:

${extra.label} in ${extra.sign} in House ${extra.house} at ${extra.degree}

Full chart context — Big Three: ${ctx.bigThree}
Key Aspects: ${ctx.aspects}

Be specific about personality, life themes, growth edges, and how this placement interacts with the rest of the chart. No generic descriptions.

Return ONLY the paragraph text, no headers or formatting.`,

  "annual-forecast": (ctx) => `You are an expert astrologer. Write a ${new Date().getFullYear()} forecast for this chart.

Big Three: ${ctx.bigThree}
Key placements: ${ctx.natalLines}
Current sky: ${ctx.transitLines}

Return JSON with:
- "headline": one sentence year summary
- "themes": array of 4 objects {"title","text"} (core themes, 2 sentences each)
- "sections": array of 4 objects {"title","text"} (Relationships, Career, Health, Spiritual Growth — 2 sentences each)
- "windows": array of 4 strings (one per season)
- "guidance": array of 3 strings

Be specific to this chart. JSON only, no markdown.`,

  "annual-months": (ctx) => `You are an expert astrologer. Write month-by-month forecast for ${new Date().getFullYear()}.

Big Three: ${ctx.bigThree}

Return JSON: {"months": [{"month":"January","theme":"...","text":"1-2 sentences"},...]  } for all 12 months. Be concise. JSON only, no markdown.`,

  "galactic-interpretation": (ctx, extra) => `You are a starseed astrologer and galactic lineage reader. Given this person's natal connections to star systems and the Galactic Center, write a deeply esoteric reading.

Birth: ${ctx.birthDisplay}
Big Three: ${ctx.bigThree}

Top constellation connections (by frequency):
${(extra.topConstellations || []).map(c => `${c.name} (${c.count} connections) — ${c.lore}`).join("\n")}

Planet-star alignment table:
${(extra.planetTable || []).map(r => {
  const conj = (r.conjunct || []).map(c => c.constellation).join(", ") || "none";
  const opp = (r.opposite || []).map(c => c.constellation).join(", ") || "none";
  return `${r.planet} ${r.sign} ${r.degree}: conjunct [${conj}], opposite [${opp}]`;
}).join("\n")}

Write a JSON object with:
- "gcReading": 2-3 sentences about their Galactic Center connection and what transmissions they receive
- "primaryLineage": which star system is their strongest connection and why (3-4 sentences, deeply esoteric — talk about the soul origin, what gifts they carry from that system, how it shows up in this life)
- "secondaryLineages": array of objects for each additional star connection, with "star" and "reading" (1-2 sentences each)
- "galacticMission": what this soul came here to do from a galactic perspective (2-3 sentences)
- "activationAdvice": how to strengthen their galactic connections — specific practices, meditations, or awareness (2-3 sentences)

Be mystical and specific. Reference the actual planets making the connections. This is not generic starseed content — it's specific to THIS chart. JSON only, no markdown fences.`,

  "human-design": (ctx, extra) => `You are an expert in Human Design. Describe a ${extra.type} with ${extra.profile} profile and ${extra.authority} authority. Return JSON with these keys:
- "strategy": their correct HD strategy (1 sentence)
- "notSelfTheme": their not-self theme (2-4 words)
- "designSnapshot": what this design is about, how the type and authority work together (2-3 sentences)
- "profileTone": how the ${extra.profile} profile shapes their life path and relationships (2-3 sentences)
- "decisionStyle": how ${extra.authority} authority works practically, what to trust and what to wait on (2-3 sentences)
- "aligned": what life feels like when they're living their design (2 sentences)
- "misaligned": what happens when they're off track, specific signs (2 sentences)
- "bestPrompt": a powerful self-inquiry question for this specific design
- "definedCenters": array of which of the 9 centers are MOST LIKELY defined for a ${extra.type} with ${extra.authority} authority. Use these exact names: ["Head","Ajna","Throat","G/Self","Heart/Ego","Sacral","Solar Plexus","Spleen","Root"]. Only include centers that are almost certainly defined based on type and authority.
- "dailyLife": object with these keys (each 2-3 sentences, practical and specific to this type/profile):
  - "work": ideal work style and environment
  - "relationships": how to navigate relationships
  - "decisions": daily decision-making tips
  - "rest": how this type needs to rest and recharge
  - "notSelfSigns": specific warning signs they're out of alignment

Be specific and practical, not generic. JSON only, no markdown fences.`,

  "destiny-matrix-reading": (ctx, extra) => `You are an expert in the Destiny Matrix system (22 Major Arcana). Given these calculated matrix numbers:

Center (Core): ${extra.center}
Top (Talents/Conscious): ${extra.A}
Right (Purpose): ${extra.B}
Bottom (Karmic Tail): ${extra.C}
Left (Outer Self): ${extra.D}
Current Life Cycle: Arcana ${extra.currentCycleArcana} (age ${extra.currentAge})

Birth chart Big Three for additional context: ${ctx.bigThree}

Write interpretations as a JSON array of 9 objects, each with "label", "summary", and "text" fields:
1. Core (center number meaning)
2. Inner Self (center number as inner experience)
3. Outer Self (left number as how others see you)
4. Karmic Tail (bottom number as the pattern to transform)
5. Life Cycle (current cycle arcana for current age)
6. Talents (top number as innate gifts)
7. Love Line (karmic patterns in relationships)
8. Money Line (financial energies)
9. Purpose (right number as spiritual purpose)

Each "text" should be 4-8 sentences. Be specific to these arcana numbers. Reference the actual Major Arcana card meanings.

Return ONLY valid JSON array, no markdown fences.`,

  "mbti-reading": (ctx, extra) => `You are an MBTI expert. Write a concise personality reading for an ${extra.type}. Cover: core cognitive functions, strengths, blind spots, how they show up in relationships and work, and growth edges. 3-4 paragraphs, warm but honest. Reference the specific cognitive stack. Return ONLY the text, no JSON, no headers.`,

  "enneagram-reading": (ctx, extra) => `You are an Enneagram expert. Write a concise personality reading for a Type ${extra.type}. Cover: core motivation and fear, how they show up at their best and worst, relationship patterns, growth direction (integration/disintegration), and practical advice. 3-4 paragraphs, warm but honest. Return ONLY the text, no JSON, no headers.`,

  "personality-synthesis": (ctx, extra) => `You are an expert in personality systems. Write a unified personality analysis that synthesizes these three frameworks into one coherent portrait:

MBTI: ${extra.mbti || "unknown"}
Enneagram: ${extra.enneagram || "unknown"}
Life Path: ${extra.lifePath || "unknown"}

Write 3-4 paragraphs covering: how these three systems reinforce or tension each other, what the combination reveals that no single system captures alone, the person's core paradoxes and superpowers, and practical advice for someone with this exact combination. Be specific — don't just describe each system separately, show how they interact. Warm, direct, insightful. Return ONLY the text.`,

  "personality": (ctx) => `You are a personality systems expert. Given this natal chart, suggest likely personality types.

Big Three: ${ctx.bigThree}
Placements:
${ctx.natalLines}
Key Aspects: ${ctx.aspects}

Return a JSON object with:
- "mbti": suggested MBTI type
- "mbtiReasoning": 2-3 sentences explaining why based on chart
- "enneagram": suggested Enneagram type (number)
- "enneagramReasoning": 2-3 sentences explaining why
- "caveat": brief note that these are astrological inferences, not assessed types

Return ONLY valid JSON, no markdown fences.`,

  "cosmic-ask": (ctx, extra) => `You are an expert astrologer interpreting current transits against a natal chart. Be warm but direct — no generic horoscope fluff.

TODAY: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
MOON PHASE: ${ctx.transits.moonPhase}

CURRENT TRANSITS:
${ctx.transitLines}

NATAL CHART (${ctx.birthDisplay}):
Big Three: ${ctx.bigThree}
${ctx.natalLines}
Key Aspects: ${ctx.aspects}

The user asks: "${extra.question}"

Give a focused, practical answer (3-6 paragraphs). Reference specific transits and natal placements. If asking about timing, give specific windows. Be honest if the sky is neutral or unfavorable.`
};

/* ── HTTP Helpers ─────────────────────────────── */

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  fs.readFile(filePath, (error, content) => {
    if (error) { sendJson(res, 404, { error: "Not found" }); return; }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function safePublicPath(urlPathname) {
  const requested = urlPathname === "/" ? "/index.html" : urlPathname;
  const resolved = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!resolved.startsWith(PUBLIC_DIR)) return null;
  return resolved;
}

/* ── HTTP Server ─────────────────────────────── */

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    // Universal endpoints (no birth data needed)
    if (req.method === "GET" && requestUrl.pathname === "/api/transits") {
      sendJson(res, 200, getTransitSnapshot());
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/space-weather") {
      sendJson(res, 200, await getSpaceWeatherSnapshot());
      return;
    }

    // Geocode
    if (req.method === "GET" && requestUrl.pathname === "/api/geocode") {
      const query = requestUrl.searchParams.get("q");
      if (!query) { sendJson(res, 400, { error: "No query" }); return; }
      try {
        const geoRes = await fetchJson(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
        if (geoRes.length === 0) {
          sendJson(res, 200, { found: false });
        } else {
          sendJson(res, 200, { found: true, lat: Number(geoRes[0].lat), lng: Number(geoRes[0].lon), display: geoRes[0].display_name });
        }
      } catch (err) { sendJson(res, 500, { error: "Geocoding failed: " + err.message }); }
      return;
    }

    // Profile-required GET endpoints
    if (req.method === "GET" && requestUrl.pathname === "/api/natal") {
      const config = getConfig(requestUrl);
      if (!requireConfig(res, config)) return;
      sendJson(res, 200, getNatalChartSnapshot(config));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/vedic") {
      const config = getConfig(requestUrl);
      if (!requireConfig(res, config)) return;
      sendJson(res, 200, getVedicChartSnapshot(config));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/galactic") {
      const config = getConfig(requestUrl);
      if (!requireConfig(res, config)) return;
      sendJson(res, 200, getGalacticSnapshot(config));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/annual-forecast") {
      const config = getConfig(requestUrl);
      if (!requireConfig(res, config)) return;
      sendJson(res, 200, getAnnualForecastSkeleton(config));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/daily-reading") {
      const config = getConfig(requestUrl);
      if (!requireConfig(res, config)) return;
      sendJson(res, 200, getDailyReadingSnapshot(config));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/destiny-matrix") {
      const birthDate = requestUrl.searchParams.get("birthDate");
      if (!birthDate) { sendJson(res, 200, { error: "no_profile" }); return; }
      sendJson(res, 200, calculateDestinyMatrix(birthDate));
      return;
    }

    // Claude generation endpoint
    if (req.method === "POST" && requestUrl.pathname === "/api/generate-reading") {
      const body = JSON.parse(await readBody(req));
      const config = configFromBody(body.profile);
      if (!config) { sendJson(res, 400, { error: "No birth data provided." }); return; }

      const type = body.type;
      const promptFn = GENERATE_PROMPTS[type];
      if (!promptFn) { sendJson(res, 400, { error: `Unknown reading type: ${type}` }); return; }

      try {
        const ctx = buildChartSummary(config);
        const prompt = promptFn(ctx, body.extra || {});
        const raw = await callClaude(prompt);

        // Try to parse as JSON if the prompt expects it
        const jsonTypes = ["chart-reading", "full-natal", "annual-forecast", "annual-months", "galactic-interpretation", "human-design", "destiny-matrix-reading", "personality"];
        if (jsonTypes.includes(type)) {
          try {
            // Strip markdown fences if Claude added them
            const cleaned = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
            const parsed = JSON.parse(cleaned);
            sendJson(res, 200, { reading: parsed, generatedAt: new Date().toISOString() });
          } catch {
            // Return raw if JSON parse fails
            sendJson(res, 200, { reading: raw, generatedAt: new Date().toISOString(), rawText: true });
          }
        } else {
          sendJson(res, 200, { reading: raw, generatedAt: new Date().toISOString() });
        }
      } catch (err) {
        sendJson(res, 500, { error: "Generation failed: " + err.message });
      }
      return;
    }

    // Cosmic Ask (convenience wrapper)
    if (req.method === "POST" && requestUrl.pathname === "/api/cosmic-ask") {
      const body = JSON.parse(await readBody(req));
      const question = (body.question || "").trim();
      if (!question) { sendJson(res, 400, { error: "No question provided." }); return; }
      const config = configFromBody(body.profile);
      if (!config) { sendJson(res, 400, { error: "Set up your birth data first." }); return; }
      try {
        const ctx = buildChartSummary(config);
        const prompt = GENERATE_PROMPTS["cosmic-ask"](ctx, { question });
        const answer = await callClaude(prompt);
        sendJson(res, 200, { answer });
      } catch (err) {
        sendJson(res, 500, { error: "Could not consult the sky right now. " + err.message });
      }
      return;
    }

    // Static files
    if (req.method === "GET") {
      const filePath = safePublicPath(requestUrl.pathname);
      if (!filePath) { sendJson(res, 404, { error: "Not found" }); return; }
      sendFile(res, filePath);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: "Could not load cosmic data right now.", details: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Cosmic Weather is running at http://localhost:${PORT}`);
});
