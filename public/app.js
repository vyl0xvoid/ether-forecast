const $ = (id) => document.getElementById(id);

/* ── Profile Management ─────────────────────── */
const PROFILE_KEY = "cosmic-weather-profile";
const READINGS_KEY = "cosmic-weather-readings";

function getProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; } }
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
function clearAllProfile() { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(READINGS_KEY); }
function hasProfile() { const p = getProfile(); return p && p.birthDate; }

function profileQueryString() {
  const p = getProfile();
  if (!p || !p.birthDate) return "";
  return "?" + new URLSearchParams({ birthDate: p.birthDate, birthTime: p.birthTime || "12:00", lat: p.lat || 0, lng: p.lng || 0, city: p.city || "" }).toString();
}

/* ── Readings Cache ──────────────────────────── */
function getReadings() { try { return JSON.parse(localStorage.getItem(READINGS_KEY)) || {}; } catch { return {}; } }
function getReading(key) { return getReadings()[key] || null; }
function saveReading(key, data) {
  const r = getReadings();
  r[key] = { ...data, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(READINGS_KEY, JSON.stringify(r));
    showSaveToast(key);
  } catch (e) {
    console.error("Failed to save reading:", key, e);
    alert("Storage full — try deleting some old readings.");
  }
}

function showSaveToast(key) {
  let toast = document.getElementById("save-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "save-toast";
    toast.className = "save-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = `Saved: ${key.replace(/-/g, " ")}`;
  toast.classList.add("show");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove("show"), 2000);
}
function deleteReading(key) { const r = getReadings(); delete r[key]; localStorage.setItem(READINGS_KEY, JSON.stringify(r)); }
function clearAllReadings() { localStorage.removeItem(READINGS_KEY); }

/* ── Helpers ──────────────────────────────────── */
function formatTimestamp(v) { return new Date(v).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function polarPoint(angle, radius, center = 210) {
  const r = ((angle - 90) * Math.PI) / 180;
  return { x: center + Math.cos(r) * radius, y: center + Math.sin(r) * radius };
}
function detailItem(title, text) {
  return `<div class="detail-item"><strong>${title}</strong><span>${text}</span></div>`;
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ── Generate Button Bar ─────────────────────── */
function genControls(key, { generateLabel = "Generate", onGenerate, onDiveDeeper, onDelete }) {
  const existing = getReading(key);
  const el = document.createElement("div");
  el.className = "gen-bar";

  if (!existing) {
    el.innerHTML = `<button class="gen-btn gen-primary">${generateLabel}</button>`;
    el.querySelector(".gen-primary").addEventListener("click", () => onGenerate(el));
  } else {
    el.innerHTML = `
      <span class="gen-saved-label">Generated ${formatTimestamp(existing.savedAt)}</span>
      <button class="gen-btn gen-dive">Dive Deeper</button>
      <button class="gen-btn gen-delete">Delete</button>
    `;
    el.querySelector(".gen-dive").addEventListener("click", () => onDiveDeeper(el));
    el.querySelector(".gen-delete").addEventListener("click", () => {
      deleteReading(key);
      onDelete();
    });
  }
  return el;
}

function showLoading(el) {
  el.innerHTML = `<div class="cosmic-ask-loading">Generating reading...</div>`;
}

async function generateReading(type, extra = {}) {
  const profile = getProfile();
  const res = await fetch("/api/generate-reading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, profile, extra })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/* ── Collective Transit Meanings ──────────────── */
const PLANET_COLLECTIVE = {
  Sun: { theme: "collective identity and focus", verb: "Everyone's attention turns toward" },
  Moon: { theme: "collective mood and emotional undercurrent", verb: "The emotional weather shifts toward" },
  Mercury: { theme: "how we all think, communicate, and process", verb: "Collective thinking gravitates toward" },
  Venus: { theme: "what we collectively value, desire, and find beautiful", verb: "The collective heart opens to" },
  Mars: { theme: "collective drive, conflict, and what we fight for", verb: "Collective energy and motivation center on" },
  Jupiter: { theme: "where society seeks growth, meaning, and expansion", verb: "Expansion and opportunity flow through" },
  Saturn: { theme: "collective structures, limits, and accountability", verb: "Collective responsibility and pressure land on" },
  Uranus: { theme: "where disruption, innovation, and liberation are happening", verb: "Collective breakthroughs and upheaval come through" },
  Neptune: { theme: "collective dreams, illusions, and spiritual currents", verb: "The collective imagination dissolves into" },
  Pluto: { theme: "deep collective transformation and power shifts", verb: "Deep societal transformation is reshaping" }
};

const SIGN_ENERGY = {
  Aries: { quality: "action, courage, and raw initiative", season: "New impulses demand to be followed. The collective mood is bold, impatient, and pioneering." },
  Taurus: { quality: "stability, pleasure, and material security", season: "The pace slows. Comfort, money, nature, and what's tangible take priority." },
  Gemini: { quality: "curiosity, communication, and mental agility", season: "Information moves fast. Conversations multiply. Adaptability and wit matter more than depth." },
  Cancer: { quality: "home, emotional safety, and nurturing", season: "The collective turns inward — family, roots, protection, and care rise to the surface." },
  Leo: { quality: "self-expression, creativity, and visibility", season: "The spotlight is on. Generosity, drama, and the need to be seen shape the atmosphere." },
  Virgo: { quality: "precision, service, and practical improvement", season: "Details matter. The collective mood favors fixing, refining, and getting things right." },
  Libra: { quality: "balance, relationships, and justice", season: "Harmony-seeking energy rises. Partnerships, fairness, and diplomacy take center stage." },
  Scorpio: { quality: "depth, intensity, and transformation", season: "The collective mood deepens. Hidden truths surface. Power dynamics are impossible to ignore." },
  Sagittarius: { quality: "expansion, truth-seeking, and big-picture vision", season: "The collective wants meaning, adventure, and honesty. Optimism and restlessness both grow." },
  Capricorn: { quality: "structure, ambition, and long-term building", season: "Discipline, authority, and legacy dominate. The collective mood is serious and goal-oriented." },
  Aquarius: { quality: "innovation, collective vision, and breaking norms", season: "The collective leans toward the future. Technology, community, and nonconformity are amplified." },
  Pisces: { quality: "intuition, compassion, and dissolution of boundaries", season: "Boundaries blur. Empathy, creativity, and spiritual sensitivity flood the collective field." }
};

function getCollectiveMeaning(body, sign) {
  const p = PLANET_COLLECTIVE[body];
  const s = SIGN_ENERGY[sign];
  if (!p || !s) return "Transit active.";
  return `${p.verb} ${s.quality}. ${s.season}`;
}

/* ── Daily Dashboard ──────────────────────────── */
function renderDaily(data) {
  $("daily-date").textContent = data.date;
  $("daily-headline").textContent = data.headline;
  $("hero-moon-phase").textContent = data.moonPhase;
  $("hero-moon-sign").textContent = data.moonSign;

  // Moon countdown — show whichever is sooner
  if (data.nextFullMoon && data.nextNewMoon) {
    const full = data.nextFullMoon;
    const nw = data.nextNewMoon;
    const isFullCloser = full.daysAway <= nw.daysAway;
    const next = isFullCloser
      ? { label: full.name || "Full Moon", days: full.daysAway }
      : { label: "New Moon", days: nw.daysAway };

    let badge = "";
    if (full.note) badge = ` <span class="moon-note">${full.note}</span>`;

    if (next.days === 0) {
      $("moon-countdown").innerHTML = `<strong>${next.label}</strong> today${badge}`;
    } else if (next.days === 1) {
      $("moon-countdown").innerHTML = `<strong>${next.label}</strong> tomorrow${badge}`;
    } else if (isFullCloser) {
      $("moon-countdown").innerHTML = `<strong>${next.days}</strong> days to ${next.label}${badge}`;
    } else {
      $("moon-countdown").innerHTML = `<strong>${next.days}</strong> days to ${next.label}`;
    }
  }

  // Sky Events + Retrogrades — compact chips below current sky
  const strip = $("sky-events-strip");
  const chips = [];

  // Retrogrades first
  if (data.retrogrades && data.retrogrades.length > 0) {
    for (const r of data.retrogrades) {
      chips.push(`<span class="sky-event-chip retro-chip"><span class="event-icon">&#8634;</span> <strong>${r.body}</strong> Rx in ${r.sign}</span>`);
    }
  }

  // Sky events
  if (data.skyEvents) {
    for (const e of data.skyEvents) {
      const icon = e.type === "eclipse" ? "\u25D1" : e.type === "meteor" ? "\u2604\uFE0F" : "\u2600\uFE0F";
      const timing = e.daysAway === 0 ? "today" : e.daysAway === 1 ? "tomorrow" : `${e.daysAway}d`;
      const note = e.note ? ` · ${e.note}` : "";
      chips.push(`<span class="sky-event-chip"><span class="event-icon">${icon}</span> <strong>${timing}</strong> ${e.name}${note}</span>`);
    }
  }

  if (chips.length > 0) {
    strip.style.display = "flex";
    strip.innerHTML = chips.join("");
  } else {
    strip.style.display = "none";
  }

  if (data.numerology) {
    const n = data.numerology;
    const pm = n.personalDayMeaning || {};
    $("numerology-content").innerHTML = `
      <div class="numerology-row">
        <div class="num-big">${n.personalDay}</div>
        <div class="num-info">
          <strong>${pm.theme} Day</strong>
          <p>${pm.energy}</p>
          <span class="small">Good for: ${pm.good}</span>
        </div>
      </div>`;
    const um = n.universalDayMeaning;
    if (um) {
      $("collective-numerology-content").innerHTML = `
        <div class="numerology-row">
          <div class="num-big num-collective">${n.universalDay}</div>
          <div class="num-info">
            <strong>${um.theme} Day</strong>
            <p>${um.energy}</p>
            <span class="small">Good for: ${um.good}</span>
          </div>
        </div>`;
    }
  }

  const el = $("daily-aspects");
  if (!data.aspects || data.aspects.length === 0) {
    el.innerHTML = `<div class="aspect-card"><p>Quiet sky today. No tight transit-natal aspects active.</p></div>`;
  } else {
    el.innerHTML = data.aspects.map((a) => `
      <div class="aspect-card">
        <div class="aspect-card-head">
          <span class="aspect-card-title">${a.transit} ${a.aspect} ${a.natal}</span>
          <span class="aspect-card-badge">${a.orb}&deg; orb</span>
        </div>
        <p>${a.reading}</p>
      </div>`).join("");
  }

  $("transit-list").innerHTML = (data.transits || []).map((t) =>
    `<div class="sky-pill" data-body="${t.body}" data-sign="${t.sign}" data-degree="${t.degree}"><span>${t.body}</span><strong>${t.sign}</strong><span class="sky-deg">${t.degree}&deg;</span></div>`
  ).join("");
  $("transit-updated").textContent = "Live";

  // Click to expand collective meaning
  $("transit-list").querySelectorAll(".sky-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const body = pill.dataset.body;
      const sign = pill.dataset.sign;
      const detail = $("transit-detail");
      const isOpen = pill.classList.contains("sky-pill-active");

      // Clear all active
      $("transit-list").querySelectorAll(".sky-pill").forEach(p => p.classList.remove("sky-pill-active"));

      if (isOpen) {
        detail.style.display = "none";
        return;
      }

      pill.classList.add("sky-pill-active");
      const meaning = getCollectiveMeaning(body, sign);
      detail.style.display = "block";
      detail.innerHTML = `<strong>${body} in ${sign}</strong><p>${meaning}</p>`;
    });
  });

  // Update Ask the Sky greeting with name
  const profile = getProfile();
  if (profile && profile.name) {
    $("cosmic-ask-greeting").innerHTML = `Hi <strong>${escapeHtml(profile.name)}</strong> — ask about timing, transits, or your chart.`;
  }
}

/* ── Natal Chart ──────────────────────────────── */
let natalData = null; // cached for deep dive generation

function renderNatal(data) {
  natalData = data;
  const birth = data.birth || {};
  $("natal-birth").textContent = `${birth.date || ""} · ${birth.time || ""} · ${birth.place || ""}`;

  $("placement-list").innerHTML = (data.bodies || []).map((b) => `
    <div class="placement-row">
      <span class="placement-label">${b.label}</span>
      <span class="placement-sign">${b.sign} ${b.degree}</span>
      <span class="placement-house">H${b.house}</span>
    </div>`).join("") + `
    <div class="placement-row">
      <span class="placement-label">Ascendant</span>
      <span class="placement-sign">${((data.points || [])[0] || {}).sign || ""} ${((data.points || [])[0] || {}).degree || ""}</span>
      <span class="placement-house">H1</span>
    </div>
    <div class="placement-row">
      <span class="placement-label">Midheaven</span>
      <span class="placement-sign">${((data.points || [])[1] || {}).sign || ""} ${((data.points || [])[1] || {}).degree || ""}</span>
      <span class="placement-house">H10</span>
    </div>`;

  // Aspects (always show)
  $("aspect-list").innerHTML = (data.aspects || []).map((a) =>
    detailItem(`${a.from} ${a.type} ${a.to}`, `Orb ${a.orb}&deg;`)
  ).join("");

  renderBigThree(data);
  setupChartReading();
  setupLifeThemes();
  setupDeepDives(data.bodies || []);

  // Wheel — improved with sign ring and aspect lines
  const SIGN_GLYPHS = ["\u2648","\u2649","\u264A","\u264B","\u264C","\u264D","\u264E","\u264F","\u2650","\u2651","\u2652","\u2653"];
  const SIGN_COLORS = [
    "#ff8888","#88cc88","#ffdd66","#88bbff","#ff8888","#88cc88",
    "#ffdd66","#88bbff","#ff8888","#88cc88","#ffdd66","#88bbff"
  ];

  // Sign ring
  const signRing = SIGN_GLYPHS.map((g, i) => {
    const midAngle = i * 30 + 15;
    const pos = polarPoint(midAngle, 170);
    const divStart = polarPoint(i * 30, 158);
    const divEnd = polarPoint(i * 30, 185);
    return `<line x1="${divStart.x}" y1="${divStart.y}" x2="${divEnd.x}" y2="${divEnd.y}" stroke="rgba(255,170,200,0.1)" stroke-width="0.5"/>
      <text x="${pos.x}" y="${pos.y + 4}" text-anchor="middle" fill="${SIGN_COLORS[i]}" font-size="12" opacity="0.5">${g}</text>`;
  }).join("");

  // House lines
  const houseLines = ((data.wheel || {}).houses || []).map((h) => {
    const s = polarPoint(h.angle, 50), e = polarPoint(h.angle, 155), l = polarPoint(h.angle + 10, 142);
    return `<line x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}" stroke="rgba(255,170,200,0.12)" stroke-width="0.8" />
      <text x="${l.x}" y="${l.y}" fill="rgba(255,200,220,0.4)" font-size="9" text-anchor="middle">${h.id}</text>`;
  }).join("");

  // Aspect lines between planets
  const ASPECT_COLORS = {
    Conjunction: "rgba(255,210,140,0.25)", Opposition: "rgba(255,120,120,0.2)",
    Trine: "rgba(120,200,255,0.2)", Square: "rgba(255,120,120,0.15)", Sextile: "rgba(140,220,180,0.15)"
  };
  const planetPositions = {};
  ((data.wheel || {}).planets || []).forEach(p => { planetPositions[p.label] = polarPoint(p.angle, 120); });

  const aspectLines = (data.aspects || []).map(a => {
    const p1 = planetPositions[a.from];
    const p2 = planetPositions[a.to];
    if (!p1 || !p2) return "";
    const color = ASPECT_COLORS[a.type] || "rgba(255,170,200,0.1)";
    const dash = a.type === "Square" || a.type === "Opposition" ? 'stroke-dasharray="4 3"' : "";
    return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="1" ${dash}/>`;
  }).join("");

  // Planet dots — offset to avoid overlap
  const usedSlots = [];
  const dots = ((data.wheel || {}).planets || []).map((p) => {
    let angle = p.angle;
    // Nudge if too close to another planet
    for (const used of usedSlots) {
      if (Math.abs(angle - used) < 8) angle += 9;
    }
    usedSlots.push(angle);
    const d = polarPoint(angle, 120);
    const l = polarPoint(angle, 100);
    return `<circle cx="${d.x}" cy="${d.y}" r="4.5" fill="#ffb0cc" filter="url(#glow)"/>
      <text x="${l.x}" y="${l.y + 3}" fill="#ffd6e8" font-size="8.5" font-family="Nunito,sans-serif" text-anchor="middle" font-weight="600">${p.label.slice(0,3)}</text>`;
  }).join("");

  $("chart-wheel").innerHTML = `
    <defs>
      <radialGradient id="wg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,170,200,0.06)" /><stop offset="100%" stop-color="rgba(255,170,200,0.01)" /></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="210" cy="210" r="188" fill="url(#wg)" stroke="rgba(255,170,200,0.12)" stroke-width="1" />
    <circle cx="210" cy="210" r="155" fill="none" stroke="rgba(255,170,200,0.06)" stroke-width="0.5" />
    <circle cx="210" cy="210" r="120" fill="none" stroke="rgba(255,170,200,0.08)" stroke-width="0.6" />
    <circle cx="210" cy="210" r="50" fill="none" stroke="rgba(255,170,200,0.04)" stroke-width="0.5" />
    ${signRing}${houseLines}${aspectLines}${dots}`;
}

function setupChartReading() {
  const controls = $("chart-reading-controls");
  const container = $("chart-reading");
  const cached = getReading("chart-reading");

  if (cached && cached.reading) {
    renderCollapsibleReading(container, cached.reading);
  }

  controls.innerHTML = "";
  if (!cached) {
    const btn = document.createElement("button");
    btn.className = "gen-btn gen-primary";
    btn.textContent = "Generate Chart Reading";
    btn.addEventListener("click", async () => {
      showLoading(container);
      try {
        const result = await generateReading("chart-reading");
        saveReading("chart-reading", result);
        renderCollapsibleReading(container, result.reading);
        setupChartReading();
      } catch (e) { container.innerHTML = `<p class="cosmic-ask-error">${e.message}</p>`; }
    });
    controls.appendChild(btn);
  } else {
    const bar = document.createElement("div");
    bar.className = "gen-bar";
    bar.innerHTML = `
      <span class="gen-saved-label">Generated ${formatTimestamp(cached.savedAt)}</span>
      <button class="gen-btn gen-delete gen-small">Delete</button>`;
    bar.querySelector(".gen-delete").addEventListener("click", () => {
      deleteReading("chart-reading");
      container.innerHTML = "";
      setupChartReading();
    });
    controls.appendChild(bar);
  }
}

function setupDeepDives(bodies) {
  const controls = $("deep-dives-controls");
  const container = $("deep-dives");
  const filtered = bodies.filter(b => b.label !== "Sirius");

  // Check if any placements are cached
  const allCached = filtered.every(b => getReading(`placement-${b.label}`));
  const anyCached = filtered.some(b => getReading(`placement-${b.label}`));

  // Always render the expandable list
  container.innerHTML = filtered.map(b => {
    const cached = getReading(`placement-${b.label}`);
    return `
      <div class="deep-dive-item" data-label="${b.label}">
        <button class="deep-dive-toggle" onclick="this.parentElement.classList.toggle('open')">
          <span class="deep-dive-planet">${b.label}</span>
          <span class="deep-dive-summary">${b.sign} in House ${b.house} · ${b.degree}</span>
          <span class="deep-dive-arrow">&#9662;</span>
        </button>
        <div class="deep-dive-body">
          ${cached ? `<p>${escapeHtml(cached.reading)}</p>` : `<p class="small" style="opacity:0.4">Not yet generated.</p>`}
        </div>
      </div>`;
  }).join("");

  // Controls
  controls.innerHTML = "";
  if (!allCached) {
    const btn = document.createElement("button");
    btn.className = "gen-btn gen-primary gen-small";
    btn.textContent = anyCached ? "Generate Remaining" : "Generate All Placements";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Generating...";

      // Fire all uncached placements in parallel
      const uncached = filtered.filter(b => !getReading(`placement-${b.label}`));
      const promises = uncached.map(async (b) => {
        try {
          const result = await generateReading("placement-dive", {
            label: b.label, sign: b.sign, house: b.house, degree: b.degree
          });
          saveReading(`placement-${b.label}`, result);
          // Update the DOM immediately
          const item = container.querySelector(`[data-label="${b.label}"]`);
          if (item) {
            const body = item.querySelector(".deep-dive-body");
            body.innerHTML = `<p>${escapeHtml(result.reading)}</p>`;
          }
        } catch (e) {
          const item = container.querySelector(`[data-label="${b.label}"]`);
          if (item) {
            const body = item.querySelector(".deep-dive-body");
            body.innerHTML = `<p class="cosmic-ask-error">Failed: ${e.message}</p>`;
          }
        }
      });

      await Promise.all(promises);
      setupDeepDives(filtered);
    });
    controls.appendChild(btn);
  }

  if (anyCached) {
    const del = document.createElement("button");
    del.className = "gen-btn gen-delete gen-small";
    del.textContent = "Delete All";
    del.style.marginLeft = "0.5rem";
    del.addEventListener("click", () => {
      filtered.forEach(b => deleteReading(`placement-${b.label}`));
      setupDeepDives(filtered);
    });
    controls.appendChild(del);
  }
}

/* ── Collapsible Reading Renderer ─────────────── */
function renderCollapsibleReading(container, reading) {
  if (!Array.isArray(reading)) {
    container.innerHTML = `<div class="detail-item"><span>${escapeHtml(reading)}</span></div>`;
    return;
  }
  container.innerHTML = reading.map((s, i) => `
    <div class="deep-dive-item" data-index="${i}">
      <button class="deep-dive-toggle" onclick="this.parentElement.classList.toggle('open')">
        <span class="deep-dive-planet">${escapeHtml(s.title)}</span>
        <span class="deep-dive-arrow">&#9662;</span>
      </button>
      <div class="deep-dive-body"><p>${escapeHtml(s.text)}</p></div>
    </div>
  `).join("");
}

/* ── Big 3 ────────────────────────────────────── */
const BIG3_MEANINGS = {
  Aries: { sun: "Bold, direct, pioneering energy", moon: "Needs action, independence, fresh starts", rising: "Comes across as confident and assertive" },
  Taurus: { sun: "Steady, sensual, values-driven", moon: "Needs comfort, beauty, and stability", rising: "Comes across as grounded and warm" },
  Gemini: { sun: "Curious, adaptable, mentally quick", moon: "Needs variety, conversation, stimulation", rising: "Comes across as witty and engaging" },
  Cancer: { sun: "Protective, intuitive, emotionally deep", moon: "Needs safety, home, and emotional honesty", rising: "Comes across as nurturing and approachable" },
  Leo: { sun: "Creative, generous, magnetically present", moon: "Needs recognition, warmth, and self-expression", rising: "Comes across as radiant and commanding" },
  Virgo: { sun: "Analytical, devoted, service-oriented", moon: "Needs order, usefulness, and clean systems", rising: "Comes across as precise and thoughtful" },
  Libra: { sun: "Harmonious, relational, aesthetically attuned", moon: "Needs balance, beauty, and partnership", rising: "Comes across as charming and diplomatic" },
  Scorpio: { sun: "Intense, transformative, psychologically deep", moon: "Needs depth, loyalty, and emotional truth", rising: "Comes across as magnetic and private" },
  Sagittarius: { sun: "Expansive, truth-seeking, freedom-loving", moon: "Needs meaning, adventure, and open horizons", rising: "Comes across as optimistic and philosophical" },
  Capricorn: { sun: "Ambitious, disciplined, authority-building", moon: "Needs structure, achievement, and respect", rising: "Comes across as capable and composed" },
  Aquarius: { sun: "Independent, visionary, unconventional", moon: "Needs freedom, community, and intellectual space", rising: "Comes across as unique and detached" },
  Pisces: { sun: "Intuitive, compassionate, boundary-dissolving", moon: "Needs spiritual connection and creative flow", rising: "Comes across as dreamy and empathic" }
};

function renderBigThree(data) {
  const b3 = data.bigThree;
  if (!b3) return;
  const sunM = BIG3_MEANINGS[(b3.sun || {}).sign] || {};
  const moonM = BIG3_MEANINGS[(b3.moon || {}).sign] || {};
  const risingM = BIG3_MEANINGS[(b3.rising || {}).sign] || {};

  $("big-three-strip").innerHTML = `
    <div class="big-three-card">
      <div class="b3-label">Sun</div>
      <div class="b3-sign">${(b3.sun || {}).sign || ""}</div>
      <div class="b3-meaning">${sunM.sun || ""}</div>
    </div>
    <div class="big-three-card">
      <div class="b3-label">Moon</div>
      <div class="b3-sign">${(b3.moon || {}).sign || ""}</div>
      <div class="b3-meaning">${moonM.moon || ""}</div>
    </div>
    <div class="big-three-card">
      <div class="b3-label">Rising</div>
      <div class="b3-sign">${(b3.rising || {}).sign || ""}</div>
      <div class="b3-meaning">${risingM.rising || ""}</div>
    </div>`;
}

/* ── Life Themes ─────────────────────────────── */
const LIFE_THEMES = [
  { key: "love", label: "Love & Relationships", theme: "Love, relationships, romantic patterns, and partnership style" },
  { key: "career", label: "Career & Purpose", theme: "Career direction, vocation, purpose, and how they build authority" },
  { key: "strengths", label: "Strengths & Challenges", theme: "Core strengths, natural talents, and the main growth edges or recurring challenges" },
  { key: "health", label: "Health & Body", theme: "Health patterns, nervous system tendencies, and body-mind connection" }
];

function setupLifeThemes() {
  const container = $("life-themes");
  container.innerHTML = LIFE_THEMES.map(t => {
    const cached = getReading(`theme-${t.key}`);
    return `
      <div class="deep-dive-item ${cached ? '' : 'open'}" data-theme-key="${t.key}">
        <button class="deep-dive-toggle" onclick="this.parentElement.classList.toggle('open')">
          <span class="deep-dive-planet">${t.label}</span>
          <span class="deep-dive-summary">${cached ? 'Click to expand' : 'Not generated'}</span>
          <span class="deep-dive-arrow">&#9662;</span>
        </button>
        <div class="deep-dive-body">
          ${cached
            ? `<p>${escapeHtml(cached.reading)}</p>`
            : ``
          }
          <div class="life-theme-actions" style="margin-top:0.5rem">
            ${cached
              ? `<button class="gen-btn gen-delete gen-small" data-action="delete">Delete</button>`
              : `<button class="gen-btn gen-primary gen-small" data-action="generate">Generate</button>`
            }
          </div>
        </div>
      </div>`;
  }).join("");

  // Attach handlers
  container.querySelectorAll("[data-action='generate']").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const card = btn.closest("[data-theme-key]");
      const key = card.dataset.themeKey;
      const theme = LIFE_THEMES.find(t => t.key === key);
      btn.disabled = true; btn.textContent = "...";
      try {
        const result = await generateReading("life-theme", { theme: theme.theme });
        saveReading(`theme-${key}`, result);
        setupLifeThemes();
      } catch (e) {
        btn.textContent = "Failed";
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll("[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = btn.closest("[data-theme-key]").dataset.themeKey;
      deleteReading(`theme-${key}`);
      setupLifeThemes();
    });
  });
}

/* ── Personality Synthesis ────────────────────── */
function setupSynthesis() {
  const controls = $("synthesis-controls");
  const container = $("synthesis-reading");
  const cached = getReading("personality-synthesis");
  const p = getProfile();

  // Get life path number
  let lifePath = "--";
  if (p && p.birthDate) {
    const dateStr = p.birthDate.replace(/-/g, "");
    let c = dateStr.split("").reduce((s, d) => s + Number(d), 0);
    while (c > 9 && c !== 11 && c !== 22 && c !== 33) c = String(c).split("").reduce((s, d) => s + Number(d), 0);
    lifePath = c;
  }

  if (cached && cached.reading) {
    const text = typeof cached.reading === "string" ? cached.reading : JSON.stringify(cached.reading);
    container.innerHTML = `<div class="pers-reading">${escapeHtml(text).replace(/\n/g, "<br/>")}</div>`;
  }

  controls.innerHTML = "";
  if (!cached) {
    const btn = document.createElement("button");
    btn.className = "gen-btn gen-primary";
    btn.textContent = "Generate Personality Synthesis";
    btn.addEventListener("click", async () => {
      showLoading(container);
      try {
        const result = await generateReading("personality-synthesis", {
          mbti: p?.mbti || "not set",
          enneagram: p?.enneagram || "not set",
          lifePath: lifePath
        });
        saveReading("personality-synthesis", result);
        const text = typeof result.reading === "string" ? result.reading : JSON.stringify(result.reading);
        container.innerHTML = `<div class="pers-reading">${escapeHtml(text).replace(/\n/g, "<br/>")}</div>`;
        setupSynthesis();
      } catch (e) { container.innerHTML = `<p class="cosmic-ask-error">${e.message}</p>`; }
    });
    controls.appendChild(btn);
  } else {
    const bar = document.createElement("div");
    bar.className = "gen-bar";
    bar.innerHTML = `
      <span class="gen-saved-label">Generated ${formatTimestamp(cached.savedAt)}</span>
      <button class="gen-btn gen-delete gen-small">Delete</button>`;
    bar.querySelector(".gen-delete").addEventListener("click", () => {
      deleteReading("personality-synthesis");
      container.innerHTML = "";
      setupSynthesis();
    });
    controls.appendChild(bar);
  }
}

/* ── Vedic ────────────────────────────────────── */
const VEDIC_SIGN_MEANINGS = {
  Pisces: { sun: "Spiritual, intuitive, seeks dissolution of ego", moon: "Needs transcendence, creative flow, emotional merging", rising: "Appears dreamy, empathic, hard to pin down" },
  Aries: { sun: "Pioneering, courageous, self-initiating", moon: "Needs independence, challenge, fresh starts", rising: "Appears bold, direct, energetic" },
  Taurus: { sun: "Grounded, sensual, resource-oriented", moon: "Needs stability, beauty, material comfort", rising: "Appears steady, reliable, attractive" },
  Gemini: { sun: "Mentally agile, communicative, dual-natured", moon: "Needs variety, dialogue, intellectual stimulation", rising: "Appears curious, witty, youthful" },
  Cancer: { sun: "Nurturing, protective, emotionally rich", moon: "Needs safety, home, emotional reciprocity", rising: "Appears caring, receptive, moody" },
  Leo: { sun: "Regal, creative, seeks recognition", moon: "Needs admiration, self-expression, warmth", rising: "Appears commanding, generous, proud" },
  Virgo: { sun: "Analytical, service-driven, detail-oriented", moon: "Needs order, purpose, practical usefulness", rising: "Appears modest, precise, health-conscious" },
  Libra: { sun: "Diplomatic, beauty-seeking, partnership-oriented", moon: "Needs harmony, fairness, relational balance", rising: "Appears graceful, sociable, indecisive" },
  Scorpio: { sun: "Intense, transformative, power-aware", moon: "Needs depth, loyalty, emotional control", rising: "Appears magnetic, secretive, penetrating" },
  Sagittarius: { sun: "Philosophical, adventurous, truth-seeking", moon: "Needs meaning, expansion, freedom of belief", rising: "Appears optimistic, restless, teacher-like" },
  Capricorn: { sun: "Ambitious, disciplined, legacy-building", moon: "Needs achievement, structure, earned respect", rising: "Appears serious, capable, authoritative" },
  Aquarius: { sun: "Innovative, humanitarian, convention-breaking", moon: "Needs intellectual freedom, community, uniqueness", rising: "Appears detached, progressive, eccentric" }
};

function getVedicPlacementNote(label, sign) {
  const meanings = VEDIC_SIGN_MEANINGS[sign];
  if (!meanings) return `${label} in ${sign} in the sidereal zodiac.`;
  const key = label === "Sun" ? "sun" : label === "Moon" ? "moon" : label === "Ascendant" ? "rising" : null;
  if (key && meanings[key]) return meanings[key];
  // Generic for other planets
  const PLANET_VERBS = {
    Mercury: "Thinking and communication style",
    Venus: "Love and aesthetic expression",
    Mars: "Drive and assertion",
    Jupiter: "Growth and wisdom-seeking",
    Saturn: "Discipline and karmic lessons",
    Uranus: "Disruption and innovation",
    Neptune: "Imagination and spiritual pull",
    Pluto: "Transformation and hidden power",
    Chiron: "Core wound and healing gift",
    "North Node": "Soul growth direction",
    Sirius: "Fixed star influence"
  };
  const verb = PLANET_VERBS[label] || label;
  return `${verb} expressed through ${sign} energy in the sidereal framework.`;
}

function renderVedic(data) {
  // Big 3 strip
  const b3 = data.bigThree || {};
  const sunM = VEDIC_SIGN_MEANINGS[((b3.sun || {}).sign)] || {};
  const moonM = VEDIC_SIGN_MEANINGS[((b3.moon || {}).sign)] || {};
  const risingM = VEDIC_SIGN_MEANINGS[((b3.rising || {}).sign)] || {};

  $("vedic-big-three").innerHTML = `
    <div class="big-three-card">
      <div class="b3-label">Sun</div>
      <div class="b3-sign">${(b3.sun || {}).sign || ""}</div>
      <div class="b3-meaning">${sunM.sun || ""}</div>
    </div>
    <div class="big-three-card">
      <div class="b3-label">Moon</div>
      <div class="b3-sign">${(b3.moon || {}).sign || ""}</div>
      <div class="b3-meaning">${moonM.moon || ""}</div>
    </div>
    <div class="big-three-card">
      <div class="b3-label">Rising</div>
      <div class="b3-sign">${(b3.rising || {}).sign || ""}</div>
      <div class="b3-meaning">${risingM.rising || ""}</div>
    </div>`;

  // Placement grid with hover tooltips
  const allPlacements = (data.bodies || []).filter(b => b.label !== "Sirius");
  $("vedic-placements").innerHTML = allPlacements.map(b =>
    `<div class="vedic-pill" data-label="${b.label}" data-sign="${b.sign}" data-house="${b.house}" data-degree="${b.degree}">
      <span class="vp-body">${b.label}</span>
      <span class="vp-sign">${b.sign}</span>
      <span class="vp-meta">H${b.house} · ${b.degree}</span>
    </div>`
  ).join("");

  // Click/hover handler for tooltip
  const tooltip = $("vedic-tooltip");
  $("vedic-placements").querySelectorAll(".vedic-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const isActive = pill.classList.contains("active");
      $("vedic-placements").querySelectorAll(".vedic-pill").forEach(p => p.classList.remove("active"));
      if (isActive) {
        tooltip.style.display = "none";
        return;
      }
      pill.classList.add("active");
      const label = pill.dataset.label;
      const sign = pill.dataset.sign;
      const note = getVedicPlacementNote(label, sign);
      tooltip.style.display = "block";
      tooltip.innerHTML = `<strong>${label} in ${sign}</strong><p>${note}</p><p class="small" style="margin-top:0.4rem; opacity:0.5">Sidereal · House ${pill.dataset.house} · ${pill.dataset.degree}</p>`;
    });
  });

  // Vedic overview generate — stash sidereal data for the prompt
  vedicPlacementData = {
    vedicPlacements: allPlacements.map(b => `${b.label}: ${b.sign} H${b.house} ${b.degree}`).join("\n"),
    vedicBigThree: `${(b3.sun || {}).sign || ""} Sun, ${(b3.moon || {}).sign || ""} Moon, ${(b3.rising || {}).sign || ""} Rising`
  };
  setupVedicOverview();
}

let vedicPlacementData = null;

function renderVedicOverviewContent(container, reading) {
  const text = typeof reading === "string" ? reading : JSON.stringify(reading);
  container.innerHTML = `
    <div class="deep-dive-item open">
      <button class="deep-dive-toggle" onclick="this.parentElement.classList.toggle('open')">
        <span class="deep-dive-planet">Vedic Overview</span>
        <span class="deep-dive-arrow">&#9662;</span>
      </button>
      <div class="deep-dive-body">
        <p>${escapeHtml(text).replace(/\n/g, "<br/>")}</p>
      </div>
    </div>`;
}

function setupVedicOverview() {
  const controls = $("vedic-overview-controls");
  const container = $("vedic-overview");
  const cached = getReading("vedic-overview");

  if (cached && cached.reading) {
    renderVedicOverviewContent(container, cached.reading);
  }

  controls.innerHTML = "";
  if (!cached) {
    const btn = document.createElement("button");
    btn.className = "gen-btn gen-primary";
    btn.textContent = "Generate Vedic Overview";
    btn.addEventListener("click", async () => {
      showLoading(container);
      try {
        const result = await generateReading("vedic-overview", vedicPlacementData || {});
        saveReading("vedic-overview", result);
        renderVedicOverviewContent(container, result.reading);
        setupVedicOverview();
      } catch (e) { container.innerHTML = `<p class="cosmic-ask-error">${e.message}</p>`; }
    });
    controls.appendChild(btn);
  } else {
    const bar = document.createElement("div");
    bar.className = "gen-bar";
    bar.innerHTML = `
      <span class="gen-saved-label">Generated ${formatTimestamp(cached.savedAt)}</span>
      <button class="gen-btn gen-delete gen-small">Delete</button>`;
    bar.querySelector(".gen-delete").addEventListener("click", () => {
      deleteReading("vedic-overview");
      container.innerHTML = "";
      setupVedicOverview();
    });
    controls.appendChild(bar);
  }
}

/* ── Galactic ─────────────────────────────────── */
let galacticData = null;

const ALIEN_EMOJI = {
  "Andromeda": "\uD83D\uDC7D", "Bootes": "\uD83D\uDC7D", "Canis Minor": "\uD83D\uDC7D",
  "Canis Major": "\uD83D\uDC7D", "Centaurus": "\uD83D\uDC7D", "Galactic": "\uD83D\uDC7D",
  "Lyra": "\uD83D\uDC7D", "Orion": "\uD83D\uDC7D", "Pleiades": "\uD83D\uDC7D",
  "Virgo": "\uD83D\uDC7D", "Piscis Austrinus": "\uD83D\uDC7D", "Leo": "\uD83D\uDC7D",
  "Scorpius": "\uD83D\uDC7D", "Taurus": "\uD83D\uDC7D", "Aquila": "\uD83D\uDC7D",
  "Cygnus": "\uD83D\uDC7D", "Ursa Major": "\uD83D\uDC7D", "Draco": "\uD83D\uDC7D",
  "Cassiopeia": "\uD83D\uDC7D", "Perseus": "\uD83D\uDC7D"
};

function renderGalactic(data) {
  galacticData = data;
  try {
    // Alien identity widget
    const alienEl = $("alien-widget");
    const topConst = data.topConstellations || [];
    const pTable = data.planetTable || [];

    if (topConst.length > 0 && alienEl) {
      const top = topConst[0];
      const emoji = ALIEN_EMOJI[top.name] || "\uD83D\uDC7D";
      const connectedPlanets = [];
      for (const row of pTable) {
        for (const c of [...(row.conjunct || []), ...(row.opposite || [])]) {
          if (c.constellation === top.name) connectedPlanets.push(row.planet);
        }
      }
      alienEl.style.display = "block";
      alienEl.innerHTML = `
        <div class="alien-label">The alien you're most likely to be</div>
        <div class="alien-name">${emoji} ${top.name} ${emoji}</div>
        <div class="alien-lore">${top.lore}</div>
        <div class="alien-planets">
          ${[...new Set(connectedPlanets)].map(p => `<span class="star-planet-chip">${p}</span>`).join("")}
        </div>`;
    }

    // Connection table
    $("galactic-table-wrap").innerHTML = `
      <table class="galactic-table">
        <thead><tr><th>Planet</th><th>Position</th><th>H</th><th>Conjunct Alignments</th><th>Opposite Alignments</th></tr></thead>
        <tbody>
          ${pTable.map(r => `<tr>
            <td class="gt-planet">${r.planet}</td>
            <td class="gt-pos">${r.sign} ${r.degree}</td>
            <td class="gt-house">${r.house}</td>
            <td>${(r.conjunct||[]).length > 0 ? (r.conjunct||[]).map(c => `<span class="gt-constellation gt-conjunct">${c.constellation.toUpperCase()}</span>`).join("") : `<span class="gt-empty">—</span>`}</td>
            <td>${(r.opposite||[]).length > 0 ? (r.opposite||[]).map(c => `<span class="gt-constellation gt-opposite">${c.constellation.toUpperCase()}</span>`).join("") : `<span class="gt-empty">—</span>`}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;

    // Top lineages as star cards
    const topEl = $("top-lineages");
    if (topConst.length > 0 && topEl) {
      topEl.innerHTML = topConst.map(c => `
        <div class="star-card">
          <div class="star-card-name">${c.name}</div>
          <div class="star-card-pos">${c.count} connection${c.count > 1 ? "s" : ""}</div>
          <div class="star-card-lore">${c.lore}</div>
        </div>`).join("");
    }
  } catch (e) {
    console.error("Galactic render error:", e);
  }

  setupGalacticReading(data);
}

function setupGalacticReading(data) {
  const controls = $("galactic-interp-controls");
  const container = $("galactic-reading");
  const cached = getReading("galactic-interpretation");

  if (cached && cached.reading) {
    renderGalacticReading(cached.reading);
  }

  controls.innerHTML = "";
  if (!cached) {
    const btn = document.createElement("button");
    btn.className = "gen-btn gen-primary";
    btn.textContent = "Reveal Galactic Lineage";
    btn.addEventListener("click", async () => {
      showLoading(container);
      try {
        const result = await generateReading("galactic-interpretation", {
          planetTable: data.planetTable || [],
          topConstellations: data.topConstellations || []
        });
        saveReading("galactic-interpretation", result);
        renderGalacticReading(result.reading);
        setupGalacticReading(data);
      } catch (e) { container.innerHTML = `<p class="cosmic-ask-error">${e.message}</p>`; }
    });
    controls.appendChild(btn);
  } else {
    const bar = document.createElement("div");
    bar.className = "gen-bar";
    bar.innerHTML = `
      <span class="gen-saved-label">Revealed ${formatTimestamp(cached.savedAt)}</span>
      <button class="gen-btn gen-delete gen-small">Delete</button>`;
    bar.querySelector(".gen-delete").addEventListener("click", () => {
      deleteReading("galactic-interpretation");
      container.innerHTML = "";
      setupGalacticReading(data);
    });
    controls.appendChild(bar);
  }
}

function renderGalacticReading(r) {
  const container = $("galactic-reading");
  if (typeof r === "string") {
    container.innerHTML = `<div class="galactic-section"><p>${escapeHtml(r).replace(/\n/g, "<br/>")}</p></div>`;
    return;
  }

  let html = "";

  if (r.primaryLineage) {
    html += `<div class="galactic-section">
      <div class="galactic-section-label">Primary Lineage</div>
      <p>${escapeHtml(r.primaryLineage)}</p>
    </div>`;
  }

  if (r.gcReading) {
    html += `<div class="galactic-section">
      <div class="galactic-section-label">Galactic Center Transmission</div>
      <p>${escapeHtml(r.gcReading)}</p>
    </div>`;
  }

  if (r.secondaryLineages && (r.secondaryLineages || []).length > 0) {
    html += `<div class="galactic-section">
      <div class="galactic-section-label">Secondary Lineages</div>
      ${(r.secondaryLineages || []).map(s => `<p><strong>${escapeHtml(s.star)}:</strong> ${escapeHtml(s.reading)}</p>`).join("")}
    </div>`;
  }

  if (r.galacticMission) {
    html += `<div class="galactic-section">
      <div class="galactic-section-label">Galactic Mission</div>
      <p>${escapeHtml(r.galacticMission)}</p>
    </div>`;
  }

  if (r.activationAdvice) {
    html += `<div class="galactic-section">
      <div class="galactic-section-label">Activation Practices</div>
      <p>${escapeHtml(r.activationAdvice)}</p>
    </div>`;
  }

  container.innerHTML = html;
}

/* ── Annual Forecast ──────────────────────────── */
function renderForecast(data) {
  $("forecast-year-label").textContent = `${data.year || ""} Annual Forecast`;
  const basedOn = data.basedOn || {};
  $("forecast-based-on").textContent = `${basedOn.natal || ""} · ${basedOn.currentSky || ""}`;

  setupForecast(data);
}

function setupForecast() {
  const controls = $("forecast-controls");
  const generated = $("forecast-generated");
  const cached = getReading("annual-forecast");

  if (cached && cached.reading) {
    renderForecastContent(cached.reading);
    generated.style.display = "block";
  } else {
    generated.style.display = "none";
  }

  controls.innerHTML = "";
  if (!cached) {
    const btn = document.createElement("button");
    btn.className = "gen-btn gen-primary";
    btn.textContent = "Generate Annual Forecast";
    btn.addEventListener("click", async () => {
      controls.innerHTML = `<div class="cosmic-ask-loading">Generating forecast (two parts)...</div>`;
      try {
        // Run overview first, then months — sequential to avoid overwhelming Claude
        const overview = await generateReading("annual-forecast");
        controls.innerHTML = `<div class="cosmic-ask-loading">Got overview, generating months...</div>`;
        let monthsData = [];
        try {
          const months = await generateReading("annual-months");
          monthsData = (months.reading || {}).months || [];
        } catch { /* months failed, still save overview */ }

        const merged = { ...(overview.reading || {}), months: monthsData };
        saveReading("annual-forecast", { reading: merged, generatedAt: new Date().toISOString() });
        renderForecastContent(merged);
        generated.style.display = "block";
        setupForecast();
      } catch (e) { controls.innerHTML = `<p class="cosmic-ask-error">${e.message}</p>`; }
    });
    controls.appendChild(btn);
  } else {
    const bar = document.createElement("div");
    bar.className = "gen-bar";
    bar.innerHTML = `
      <span class="gen-saved-label">Generated ${formatTimestamp(cached.savedAt)}</span>
      <button class="gen-btn gen-delete gen-small">Delete</button>`;
    bar.querySelector(".gen-delete").addEventListener("click", () => {
      deleteReading("annual-forecast");
      generated.style.display = "none";
      setupForecast();
    });
    controls.appendChild(bar);
  }
}

function renderForecastContent(r) {
  if (typeof r === "string") { $("forecast-headline").textContent = r; return; }
  $("forecast-headline").textContent = r.headline || "";
  $("forecast-themes").innerHTML = (r.themes || []).map((t) => detailItem(t.title, t.text)).join("");
  $("forecast-sections").innerHTML = (r.sections || []).map((s) => detailItem(s.title, s.text)).join("");
  if (r.months) {
    $("forecast-months").innerHTML = (r.months || []).map((m) => `
      <div class="month-card">
        <div class="month-card-head"><strong>${m.month}</strong><span>${m.theme}</span></div>
        <p>${m.text}</p>
      </div>`).join("");
  }
  $("forecast-windows").innerHTML = (r.windows || []).join("<br />");
  $("forecast-guidance").innerHTML = (r.guidance || []).join("<br />");
}

/* ── Human Design ────────────────────────────── */
function setupHumanDesign() {
  const form = $("hd-form");
  const formSection = $("hd-form-section");
  const reading = $("hd-reading");
  const cached = getReading("human-design");

  if (cached && cached.reading) {
    renderHDReading(cached.inputs || {}, cached.reading);
  } else {
    $("hd-form-section").style.display = "block";
    $("hd-reading").innerHTML = "";
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const type = $("hd-type").value;
      const profile = $("hd-profile").value;
      const authority = $("hd-authority").value;
      if (!type || !profile || !authority) return;

      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Generating...";
      try {
        const result = await generateReading("human-design", { type, profile, authority });
        result.inputs = { type, profile, authority };
        saveReading("human-design", result);
        renderHDReading({ type, profile, authority }, result.reading);
      } catch (err) {
        reading.innerHTML = `<p class="cosmic-ask-error">${err.message}</p>`;
      } finally {
        btn.disabled = false; btn.textContent = "Generate Reading";
      }
    });
  }
}

function renderHDCenters(definedCenters) {
  const ALL_CENTERS = [
    { name: "Head", x: 185, y: 15, desc: "Inspiration & mental pressure" },
    { name: "Ajna", x: 185, y: 75, desc: "Conceptualization & thinking" },
    { name: "Throat", x: 185, y: 140, desc: "Communication & manifestation" },
    { name: "G/Self", x: 185, y: 210, desc: "Identity, direction & love" },
    { name: "Heart/Ego", x: 110, y: 185, desc: "Willpower & ego" },
    { name: "Sacral", x: 185, y: 280, desc: "Life force & fertility" },
    { name: "Solar Plexus", x: 265, y: 265, desc: "Emotions & awareness" },
    { name: "Spleen", x: 105, y: 265, desc: "Intuition, health & timing" },
    { name: "Root", x: 185, y: 350, desc: "Adrenaline & drive" }
  ];
  const defined = new Set(definedCenters || []);

  const channels = [
    [0,1],[1,2],[2,3],[3,5],[4,2],[4,3],[6,5],[6,3],[7,3],[7,5],[8,5]
  ];

  const channelLines = channels.map(([a,b]) => {
    const ca = ALL_CENTERS[a], cb = ALL_CENTERS[b];
    const bothDefined = defined.has(ca.name) && defined.has(cb.name);
    return `<line x1="${ca.x}" y1="${ca.y+16}" x2="${cb.x}" y2="${cb.y+16}" stroke="${bothDefined ? 'rgba(255,170,200,0.25)' : 'rgba(255,170,200,0.07)'}" stroke-width="2"/>`;
  }).join("");

  const shapes = ALL_CENTERS.map(c => {
    const isDefined = defined.has(c.name);
    const fill = isDefined ? "rgba(255,170,200,0.2)" : "rgba(255,170,200,0.03)";
    const stroke = isDefined ? "rgba(255,170,200,0.4)" : "rgba(255,170,200,0.1)";
    const textFill = isDefined ? "var(--text)" : "var(--muted)";
    const opacity = isDefined ? "1" : "0.4";
    // Use different shapes: triangles for Head/Ajna, squares for some, diamond for G
    return `<g opacity="${opacity}">
      <rect x="${c.x-28}" y="${c.y}" rx="8" width="56" height="32" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>
      <text x="${c.x}" y="${c.y+20}" text-anchor="middle" fill="${textFill}" font-size="9" font-family="Nunito,sans-serif" font-weight="${isDefined ? '600' : '400'}">${c.name}</text>
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 370 390" class="hd-bodygraph">${channelLines}${shapes}</svg>`;
}

function renderHDReading(inputs, r) {
  if (typeof r === "string") { $("hd-reading").innerHTML = `<div class="detail-item"><span>${escapeHtml(r)}</span></div>`; return; }

  $("hd-form-section").style.display = "none";
  const dl = r.dailyLife || {};

  $("hd-reading").innerHTML = `
    <div class="hd-header-strip">
      <div class="hd-stat"><span class="hd-stat-label">Type</span><strong>${inputs.type}</strong></div>
      <div class="hd-stat"><span class="hd-stat-label">Profile</span><strong>${inputs.profile}</strong></div>
      <div class="hd-stat"><span class="hd-stat-label">Authority</span><strong>${inputs.authority}</strong></div>
      <div class="hd-stat"><span class="hd-stat-label">Strategy</span><strong>${r.strategy || "—"}</strong></div>
      <div class="hd-stat"><span class="hd-stat-label">Not-Self</span><strong>${r.notSelfTheme || "—"}</strong></div>
    </div>

    <!-- Centers + Reading side by side -->
    <div class="hd-main-layout">
      <div class="hd-centers-side">
        <p class="label" style="text-align:center">Energy Centers</p>
        ${renderHDCenters(r.definedCenters)}
        <p class="small" style="text-align:center; margin-top:0.3rem; opacity:0.4">Bright = defined · Dim = open</p>
      </div>
      <div class="hd-text-side">
        <div class="hd-reading-body">
          <p>${escapeHtml(r.designSnapshot || "")}</p>
          <p>${escapeHtml(r.profileTone || "")}</p>
          <p>${escapeHtml(r.decisionStyle || "")}</p>
        </div>
        <div class="hd-aligned-row">
          <div class="hd-aligned-card">
            <span class="hd-aligned-label">When aligned</span>
            <p>${escapeHtml(r.aligned || "")}</p>
          </div>
          <div class="hd-aligned-card">
            <span class="hd-aligned-label">When off</span>
            <p>${escapeHtml(r.misaligned || "")}</p>
          </div>
        </div>
        ${r.bestPrompt ? `<div class="hd-prompt"><span class="hd-aligned-label">Self-inquiry</span><p>${escapeHtml(r.bestPrompt)}</p></div>` : ""}
      </div>
    </div>

    <!-- Living Your Design -->
    ${dl.work || dl.relationships ? `
    <div class="hd-daily-section">
      <p class="label">Living Your Design</p>
      <div class="hd-daily-grid">
        ${dl.work ? `<div class="hd-daily-card"><span class="hd-aligned-label">Work & Environment</span><p>${escapeHtml(dl.work)}</p></div>` : ""}
        ${dl.relationships ? `<div class="hd-daily-card"><span class="hd-aligned-label">Relationships</span><p>${escapeHtml(dl.relationships)}</p></div>` : ""}
        ${dl.decisions ? `<div class="hd-daily-card"><span class="hd-aligned-label">Daily Decisions</span><p>${escapeHtml(dl.decisions)}</p></div>` : ""}
        ${dl.rest ? `<div class="hd-daily-card"><span class="hd-aligned-label">Rest & Recharge</span><p>${escapeHtml(dl.rest)}</p></div>` : ""}
      </div>
      ${dl.notSelfSigns ? `<div class="hd-prompt" style="margin-top:0.6rem"><span class="hd-aligned-label">Warning Signs You're Off Track</span><p>${escapeHtml(dl.notSelfSigns)}</p></div>` : ""}
    </div>` : ""}

    <div style="margin-top:1rem; text-align:right">
      <button class="gen-btn gen-delete gen-small" id="hd-delete-btn">Delete</button>
    </div>`;

  $("hd-delete-btn").addEventListener("click", () => {
    deleteReading("human-design");
    $("hd-reading").innerHTML = "";
    $("hd-form-section").style.display = "block";
  });
}

/* ── Destiny Matrix ──────────────────────────── */
let matrixNumbers = null;

function renderDestinyMatrixSVG(n) {
  matrixNumbers = n;
  $("matrix-birth-label").textContent = `22 Arcana · ${n.birthDate}`;

  const node = (cx, cy, r, num, fill, stroke, textFill, fontSize) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
     <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${textFill}" font-size="${fontSize}" font-weight="600" font-family="Cinzel,serif">${num}</text>`;

  const smallNode = (cx, cy, num) => node(cx, cy, 10, num, "rgba(255,170,200,0.1)", "rgba(255,170,200,0.18)", "#f0d4e0", 9);

  $("matrix-svg").innerHTML = `
    <!-- Lines -->
    <line x1="200" y1="40" x2="360" y2="200" stroke="rgba(255,170,200,0.15)" stroke-width="1"/>
    <line x1="360" y1="200" x2="200" y2="380" stroke="rgba(255,170,200,0.15)" stroke-width="1"/>
    <line x1="200" y1="380" x2="40" y2="200" stroke="rgba(255,170,200,0.15)" stroke-width="1"/>
    <line x1="40" y1="200" x2="200" y2="40" stroke="rgba(255,170,200,0.15)" stroke-width="1"/>
    <line x1="200" y1="40" x2="200" y2="380" stroke="rgba(255,170,200,0.08)" stroke-width="1"/>
    <line x1="40" y1="200" x2="360" y2="200" stroke="rgba(255,170,200,0.08)" stroke-width="1"/>
    <line x1="120" y1="120" x2="280" y2="280" stroke="rgba(255,170,200,0.08)" stroke-width="1"/>
    <line x1="280" y1="120" x2="120" y2="280" stroke="rgba(255,170,200,0.08)" stroke-width="1"/>

    <!-- Center -->
    ${node(200, 210, 22, n.center, "rgba(255,210,140,0.3)", "rgba(255,210,140,0.5)", "#ffd6aa", 16)}
    <!-- Cardinal points -->
    ${node(200, 40, 16, n.A, "rgba(255,210,140,0.25)", "rgba(255,210,140,0.4)", "#ffd6aa", 12)}
    ${node(360, 200, 16, n.B, "rgba(160,210,255,0.25)", "rgba(160,210,255,0.4)", "#b8d8ff", 12)}
    ${node(200, 380, 16, n.C, "rgba(140,220,180,0.25)", "rgba(140,220,180,0.4)", "#a8e8c8", 12)}
    ${node(40, 200, 16, n.D, "rgba(140,170,255,0.25)", "rgba(140,170,255,0.4)", "#a8b8ff", 12)}
    <!-- Corners -->
    ${node(120, 120, 13, n.TL, "rgba(255,170,200,0.15)", "rgba(255,170,200,0.25)", "#ffb8d4", 11)}
    ${node(280, 120, 13, n.TR, "rgba(255,140,180,0.2)", "rgba(255,140,180,0.35)", "#ffb0cc", 11)}
    ${node(120, 290, 13, n.BL, "rgba(255,170,200,0.15)", "rgba(255,170,200,0.25)", "#ffb8d4", 11)}
    ${node(280, 290, 13, n.BR, "rgba(255,170,200,0.15)", "rgba(255,170,200,0.25)", "#ffb8d4", 11)}
    <!-- Edge midpoints -->
    ${smallNode(160, 80, n.edges.topLeft)}
    ${smallNode(240, 80, n.edges.topRight)}
    ${smallNode(320, 160, n.edges.rightTop)}
    ${smallNode(320, 250, n.edges.rightBottom)}
    ${smallNode(80, 160, n.edges.leftTop)}
    ${smallNode(80, 250, n.edges.leftBottom)}
    ${smallNode(240, 340, n.edges.bottomRight)}
    ${smallNode(160, 340, n.edges.bottomLeft)}
    <!-- Inner ring -->
    ${smallNode(200, 140, n.inner.top)}
    ${smallNode(260, 210, n.inner.right)}
    ${smallNode(200, 280, n.inner.bottom)}
    ${smallNode(140, 210, n.inner.left)}
    <!-- Labels -->
    <text x="200" y="24" text-anchor="middle" fill="rgba(255,200,220,0.5)" font-size="8" font-family="Nunito,sans-serif" letter-spacing="0.1em">TALENTS</text>
    <text x="200" y="415" text-anchor="middle" fill="rgba(140,220,180,0.5)" font-size="8" font-family="Nunito,sans-serif" letter-spacing="0.1em">KARMIC TAIL</text>
    <text x="16" y="185" text-anchor="middle" fill="rgba(140,170,255,0.5)" font-size="8" font-family="Nunito,sans-serif" letter-spacing="0.1em">OUTER</text>
    <text x="384" y="185" text-anchor="middle" fill="rgba(160,210,255,0.5)" font-size="8" font-family="Nunito,sans-serif" letter-spacing="0.1em">PURPOSE</text>`;
}

function setupMatrixReading() {
  const controls = $("matrix-reading-controls");
  const container = $("matrix-reading");
  const cached = getReading("destiny-matrix-reading");

  if (cached && cached.reading) {
    renderMatrixReadingSections(cached.reading);
  }

  controls.innerHTML = "";
  controls.appendChild(genControls("destiny-matrix-reading", {
    generateLabel: "Generate Matrix Reading",
    onGenerate: async (el) => {
      showLoading(container);
      try {
        const result = await generateReading("destiny-matrix-reading", matrixNumbers);
        saveReading("destiny-matrix-reading", result);
        renderMatrixReadingSections(result.reading);
        setupMatrixReading();
      } catch (e) { container.innerHTML = `<p class="cosmic-ask-error">${e.message}</p>`; }
    },
    onDiveDeeper: async (el) => {
      showLoading(container);
      try {
        const result = await generateReading("destiny-matrix-reading", matrixNumbers);
        saveReading("destiny-matrix-reading", result);
        renderMatrixReadingSections(result.reading);
        setupMatrixReading();
      } catch (e) { container.innerHTML = `<p class="cosmic-ask-error">${e.message}</p>`; }
    },
    onDelete: () => { container.innerHTML = ""; setupMatrixReading(); }
  }));
}

function renderMatrixReadingSections(reading) {
  const container = $("matrix-reading");
  if (Array.isArray(reading)) {
    container.innerHTML = reading.map((d, i) => `
      <div class="deep-dive-item" data-index="${i}">
        <button class="deep-dive-toggle" onclick="this.parentElement.classList.toggle('open')">
          <span class="deep-dive-planet">${escapeHtml(d.label)}</span>
          <span class="deep-dive-summary">${escapeHtml(d.summary)}</span>
          <span class="deep-dive-arrow">&#9662;</span>
        </button>
        <div class="deep-dive-body"><p>${escapeHtml(d.text)}</p></div>
      </div>`).join("");
  } else {
    container.innerHTML = `<div class="detail-item"><span>${escapeHtml(reading)}</span></div>`;
  }
}

/* ── Personality (Other page) ─────────────────── */
function setupPersonality() {
  const p = getProfile();
  const mbti = p && p.mbti;
  const enneagram = p && p.enneagram;
  const hasTypes = mbti || enneagram;

  $("no-types-msg").style.display = hasTypes ? "none" : "block";

  // MBTI
  const mbtiPanel = $("mbti-panel");
  if (mbti) {
    mbtiPanel.style.display = "block";
    $("mbti-display").textContent = mbti;
    setupTypeReading("mbti", mbti);
  } else {
    mbtiPanel.style.display = "none";
  }

  // Enneagram
  const ennPanel = $("enneagram-panel");
  if (enneagram) {
    ennPanel.style.display = "block";
    $("enneagram-display").textContent = enneagram;
    setupTypeReading("enneagram", enneagram);
  } else {
    ennPanel.style.display = "none";
  }

  setupSynthesis();
}

function setupTypeReading(type, value) {
  const readingKey = `${type}-reading`;
  const controls = $(readingKey === "mbti-reading" ? "mbti-controls" : "enneagram-controls");
  const container = $(readingKey);
  const cached = getReading(readingKey);

  if (cached && cached.reading) {
    container.innerHTML = `<div class="pers-reading">${escapeHtml(cached.reading).replace(/\n/g, "<br/>")}</div>`;
  }

  controls.innerHTML = "";
  if (!cached) {
    const btn = document.createElement("button");
    btn.className = "gen-btn gen-primary gen-small";
    btn.textContent = "Generate Analysis";
    btn.addEventListener("click", async () => {
      btn.disabled = true; btn.textContent = "...";
      try {
        const result = await generateReading(readingKey, { type: value });
        saveReading(readingKey, result);
        const text = typeof result.reading === "string" ? result.reading : JSON.stringify(result.reading);
        container.innerHTML = `<div class="pers-reading">${escapeHtml(text).replace(/\n/g, "<br/>")}</div>`;
        setupTypeReading(type, value);
      } catch (e) { container.innerHTML = `<p class="cosmic-ask-error">${e.message}</p>`; }
    });
    controls.appendChild(btn);
  } else {
    const bar = document.createElement("div");
    bar.className = "gen-bar";
    bar.innerHTML = `
      <span class="gen-saved-label">Generated ${formatTimestamp(cached.savedAt)}</span>
      <button class="gen-btn gen-delete gen-small">Delete</button>`;
    bar.querySelector(".gen-delete").addEventListener("click", () => {
      deleteReading(readingKey);
      container.innerHTML = "";
      setupTypeReading(type, value);
    });
    controls.appendChild(bar);
  }
}

/* ── Life Path ────────────────────────────────── */
const LIFE_PATH_DATA = {
  1: { title: "The Leader", reading: "Life Path 1 is the path of the pioneer, the innovator, the one who goes first. You came here to develop independence, self-trust, and the courage to forge your own way. Your energy is initiating — you start things, you push through, you don't wait for permission. The shadow side is isolation, stubbornness, or an inability to ask for help. Your growth comes from learning that true leadership isn't about doing everything alone — it's about trusting your vision enough to let others help you build it. When you're on path, you're magnetic. When you're off path, you're frustrated by everyone else's pace." },
  2: { title: "The Peacemaker", reading: "Life Path 2 is the path of sensitivity, partnership, and emotional intelligence. You came here to learn about cooperation, patience, and the power of being the bridge between people. You feel everything — the room, the relationship, the unspoken tension. Your gift is diplomacy and the ability to hold space for others without losing yourself. The shadow is people-pleasing, codependency, or disappearing into someone else's needs. Your growth comes from learning that your sensitivity is strength, not weakness, and that setting boundaries is an act of love, not selfishness." },
  3: { title: "The Creative", reading: "Life Path 3 is the path of expression, creativity, voice, and making meaning through style and communication. You came here to create — to turn inner experience into outer form that others can feel. Words, art, music, design, performance, writing — the medium matters less than the fact that you're channeling something through you. The shadow is self-doubt disguised as perfectionism, scattered energy, or using charm to avoid depth. Your growth comes from learning that your voice doesn't need to be polished to be powerful — it needs to be honest. When you stop editing yourself for palatability, everything changes." },
  4: { title: "The Builder", reading: "Life Path 4 is the path of structure, discipline, and making things real. You came here to build — systems, foundations, containers that outlast the mood. You're the one who turns vision into something tangible. Your gift is patience and the ability to show up consistently when others lose interest. The shadow is rigidity, workaholism, or feeling trapped by the very structures you've created. Your growth comes from learning that stability doesn't mean stagnation — you can build and still breathe, plan and still pivot." },
  5: { title: "The Free Spirit", reading: "Life Path 5 is the path of freedom, change, adventure, and sensory experience. You came here to experience everything — to taste, travel, try, fail, reinvent. Routine kills you. Restriction makes you rebellious. Your gift is adaptability and the ability to make any situation more alive. The shadow is restlessness, avoidance of commitment, or using novelty to escape depth. Your growth comes from learning that real freedom isn't running from things — it's choosing what's worth staying for." },
  6: { title: "The Nurturer", reading: "Life Path 6 is the path of responsibility, beauty, home, and service. You came here to care — for people, spaces, aesthetics, and the emotional fabric of your world. Your gift is creating beauty and holding people in it. The shadow is over-responsibility, martyrdom, or controlling others under the guise of helping them. Your growth comes from learning that you can't pour from an empty cup, and that the most powerful thing you can nurture is yourself." },
  7: { title: "The Seeker", reading: "Life Path 7 is the path of analysis, solitude, spiritual depth, and inner knowing. You came here to go deep — to question, research, meditate, and find the truth beneath the truth. Your mind is your greatest instrument. The shadow is overthinking, emotional withdrawal, or using intellectualism to avoid feeling. Your growth comes from learning to trust your intuition as much as your analysis — the answers you seek are often ones your body already knows." },
  8: { title: "The Powerhouse", reading: "Life Path 8 is the path of power, authority, abundance, and karmic balance. You came here to master the material world — money, influence, leadership, and the responsible use of power. Your gift is the ability to see the big picture and organize resources to make things happen. The shadow is workaholism, control, or equating self-worth with financial success. Your growth comes from learning that real power is clean — it doesn't need to dominate, manipulate, or prove. When you lead with integrity, abundance follows you." },
  9: { title: "The Humanitarian", reading: "Life Path 9 is the path of wisdom, completion, compassion, and letting go. You came here to learn, synthesize, and give back. You've lived a lot — even young, you feel old. Your gift is perspective and the ability to see the whole picture. The shadow is resentment from giving too much, difficulty with endings, or spiritual bypassing. Your growth comes from learning that letting go isn't losing — it's making space. Every ending in your life is a door, not a wall." },
  11: { title: "The Illuminator", reading: "Life Path 11 is a master number — the intuitive illuminator. You came here to receive and transmit spiritual insight. You're a channel, an antenna, a lightning rod for ideas and energy that aren't entirely your own. Your gift is vision — you see what others can't, you feel what's coming, you know things before they happen. The shadow is anxiety from carrying too much signal, nervous system overwhelm, or feeling like you're too much for the world. Your growth comes from learning to ground the lightning — to take the download and turn it into something usable." },
  22: { title: "The Master Builder", reading: "Life Path 22 is a master number — the architect of lasting structures. You carry the vision of the 11 but with the practical power to build it into reality. You came here to create things that outlast you — organizations, systems, movements, infrastructure. The shadow is the crushing weight of potential, paralysis from the gap between vision and reality, or burnout from trying to build the cathedral alone. Your growth comes from learning to build one brick at a time and trust that the blueprint is already inside you." },
  33: { title: "The Master Teacher", reading: "Life Path 33 is the rarest master number — the healer-teacher who leads through love. You came here to uplift, to hold the highest vibration of compassion, and to teach through presence rather than instruction. Your gift is the ability to make people feel seen and held just by being in the room. The shadow is self-sacrifice to the point of dissolution, or carrying the world's pain as if it were your own. Your growth comes from learning that your compassion is most powerful when it includes yourself." }
};

function renderLifePath() {
  const p = getProfile();
  if (!p || !p.birthDate) { $("life-path-value").textContent = "--"; return; }

  const dateStr = p.birthDate.replace(/-/g, "");
  let c = dateStr.split("").reduce((s, d) => s + Number(d), 0);
  while (c > 9 && c !== 11 && c !== 22 && c !== 33) c = String(c).split("").reduce((s, d) => s + Number(d), 0);

  const data = LIFE_PATH_DATA[c] || { title: `Path ${c}`, reading: "" };
  $("life-path-value").textContent = c;
  $("life-path-title").textContent = data.title;
  $("life-path-reading").textContent = data.reading;
}

/* ── Space Weather ────────────────────────────── */
function renderWeather(data) {
  $("space-updated").textContent = `Updated ${formatTimestamp(data.updatedAt)}`;
  $("kp-index").textContent = data.kpIndex.toFixed(1);
  $("kp-tone").textContent = data.kpTone;
  $("solar-wind").textContent = Math.round(data.solarWindSpeed);
  $("xray-class").textContent = data.xrayClass;
  $("xray-tone").textContent = data.xrayTone;
  $("proton-density").textContent = data.protonDensity.toFixed(1);

  if (data.bodySummary) {
    $("atmo-summary").textContent = data.bodySummary;
  }

  // Refresh Schumann spectrogram (cache-bust)
  const img = $("schumann-img");
  if (img) img.src = "https://sosrff.tsu.ru/new/shm.jpg?t=" + Date.now();
}

/* ── Profile Gating ──────────────────────────── */
function updateProfileGating() {
  const has = hasProfile();
  const sections = ["natal", "vedic", "hd", "galactic", "forecast", "matrix", "personality"];
  sections.forEach(s => {
    const needsProfile = $(`${s}-needs-profile`);
    const content = $(`${s}-content`);
    if (needsProfile) needsProfile.style.display = has ? "none" : "block";
    if (content) content.style.display = has ? "block" : "none";
  });

  $("setup-banner").style.display = has ? "none" : "flex";
  // Hide cosmic ask if no profile
  const askSection = $("cosmic-ask-section");
  if (askSection) askSection.style.display = has ? "block" : "none";
}

/* ── Tabs ─────────────────────────────────────── */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === tab));
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === target));
  });
});

/* ── Settings ─────────────────────────────────── */
function renderProfileDisplay() {
  const p = getProfile();
  const display = $("current-profile-display");
  if (!p || !p.birthDate) { display.innerHTML = `<p class="small">No profile saved yet.</p>`; return; }
  const [y, m, d] = p.birthDate.split("-");
  const dateDisplay = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  display.innerHTML = `
    ${p.name ? detailItem("Name", p.name) : ""}
    ${detailItem("Birth Date", dateDisplay)}
    ${detailItem("Birth Time", p.birthTime || "12:00")}
    ${detailItem("Birth Place", p.city || "Not set")}
    ${p.lat ? detailItem("Coordinates", `${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}`) : ""}`;
}

function populateFormFromProfile() {
  const p = getProfile();
  if (!p) return;
  if (p.name) $("profile-name").value = p.name;
  if (p.birthDate) $("profile-date").value = p.birthDate;
  if (p.birthTime) $("profile-time").value = p.birthTime;
  if (p.city) $("profile-place").value = p.city;
  if (p.lat) { $("profile-lat").value = p.lat; $("profile-lng").value = p.lng; }
  if (p.lat && p.city) $("geocode-result").textContent = `${p.city} (${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)})`;
  if (p.mbti) $("profile-mbti").value = p.mbti;
  if (p.enneagram) $("profile-enneagram").value = p.enneagram;
}

/* ── Load ─────────────────────────────────────── */
async function load() {
  updateProfileGating();

  // Always load space weather
  try {
    const wR = await fetch("/api/space-weather", { cache: "no-store" });
    renderWeather(await wR.json());
  } catch {}

  if (!hasProfile()) {
    $("daily-headline").textContent = "Set up your birth data to begin.";
    return;
  }

  const qs = profileQueryString();

  async function safeLoad(url, renderer, label) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (data.error === "no_profile") return;
      renderer(data);
    } catch (e) {
      console.warn(`Failed to load ${label}:`, e.message);
    }
  }

  // Fire all endpoints independently — one failure doesn't block others
  await Promise.allSettled([
    safeLoad("/api/daily-reading" + qs, renderDaily, "daily"),
    safeLoad("/api/natal" + qs, renderNatal, "natal"),
    safeLoad("/api/vedic" + qs, renderVedic, "vedic"),
    safeLoad("/api/galactic" + qs, renderGalactic, "galactic"),
    safeLoad("/api/annual-forecast" + qs, renderForecast, "forecast"),
    safeLoad("/api/destiny-matrix?birthDate=" + getProfile().birthDate, (data) => {
      if (!data.error) { renderDestinyMatrixSVG(data); setupMatrixReading(); }
    }, "destiny-matrix")
  ]);

  renderLifePath();
  setupHumanDesign();
  setupPersonality();
}

// Init
renderProfileDisplay();
populateFormFromProfile();
updateHeaderProfile();
load();

function updateHeaderProfile() {
  const p = getProfile();
  const el = $("header-profile-initial");
  if (p && p.name) {
    el.textContent = p.name.charAt(0).toUpperCase();
  } else {
    el.textContent = "\u2699";
  }
}

// Profile button in header opens settings tab
$("header-profile-btn").addEventListener("click", () => {
  // Deactivate all tabs and panes
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  // Activate settings pane
  document.querySelector('[data-pane="settings"]').classList.add("active");
});

/* ── Auto-refresh ────────────────────────────── */
setInterval(() => {
  if (!hasProfile()) return;
  const qs = profileQueryString();
  Promise.all([
    fetch("/api/daily-reading" + qs, { cache: "no-store" }),
    fetch("/api/space-weather", { cache: "no-store" })
  ]).then(([dR, wR]) => Promise.all([dR.json(), wR.json()]))
    .then(([daily, weather]) => { renderDaily(daily); renderWeather(weather); })
    .catch(() => {});
}, 5 * 60 * 1000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && hasProfile()) {
    const qs = profileQueryString();
    Promise.all([
      fetch("/api/daily-reading" + qs, { cache: "no-store" }),
      fetch("/api/space-weather", { cache: "no-store" })
    ]).then(([dR, wR]) => Promise.all([dR.json(), wR.json()]))
      .then(([daily, weather]) => { renderDaily(daily); renderWeather(weather); })
      .catch(() => {});
  }
});

/* ── Cosmic Ask ──────────────────────────────── */
const askForm = $("cosmic-ask-form");
if (askForm) {
  askForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = $("cosmic-ask-input").value.trim();
    if (!question) return;
    const btn = $("cosmic-ask-btn");
    const result = $("cosmic-ask-result");
    btn.disabled = true; btn.textContent = "Reading...";
    result.style.display = "block";
    result.innerHTML = `<div class="cosmic-ask-loading">Consulting the sky...</div>`;
    try {
      const res = await fetch("/api/cosmic-ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, profile: getProfile() })
      });
      const data = await res.json();
      if (data.error) {
        result.innerHTML = `<p class="cosmic-ask-error">${data.error}</p>`;
      } else {
        const answerHtml = data.answer.replace(/\n/g, "<br/>");
        result.innerHTML = `
          <div class="cosmic-ask-answer">${answerHtml}</div>
          <div class="cosmic-ask-actions">
            <button class="gen-btn gen-dive gen-small" id="save-ask-btn">Save Reading</button>
          </div>`;
        $("save-ask-btn").addEventListener("click", () => {
          const saved = getSavedAsks();
          saved.push({
            question: question,
            answer: data.answer,
            date: new Date().toISOString()
          });
          localStorage.setItem("cosmic-weather-asks", JSON.stringify(saved));
          $("save-ask-btn").textContent = "Saved";
          $("save-ask-btn").disabled = true;
          renderSavedAsks();
        });
      }
    } catch { result.innerHTML = `<p class="cosmic-ask-error">Could not reach the sky right now.</p>`; }
    finally { btn.disabled = false; btn.textContent = "\u2726 Ask"; }
  });
}

/* ── Settings Form ───────────────────────────── */
$("geocode-btn").addEventListener("click", async () => {
  const place = $("profile-place").value.trim();
  if (!place) return;
  const btn = $("geocode-btn");
  btn.textContent = "Looking up..."; btn.disabled = true;
  try {
    const res = await fetch("/api/geocode?q=" + encodeURIComponent(place));
    const data = await res.json();
    if (data.found) {
      $("profile-lat").value = data.lat; $("profile-lng").value = data.lng;
      $("geocode-result").textContent = `${data.display} (${data.lat.toFixed(4)}, ${data.lng.toFixed(4)})`;
      $("geocode-result").style.color = "#a8e8c8";
    } else {
      $("geocode-result").textContent = "Place not found. Try a more specific city name.";
      $("geocode-result").style.color = "#ffb0b0";
    }
  } catch { $("geocode-result").textContent = "Geocoding failed."; $("geocode-result").style.color = "#ffb0b0"; }
  finally { btn.textContent = "Look up"; btn.disabled = false; }
});

$("profile-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const lat = $("profile-lat").value;
  const lng = $("profile-lng").value;
  if (!lat || !lng) {
    $("geocode-result").textContent = "Please look up your birth place first.";
    $("geocode-result").style.color = "#ffb0b0";
    return;
  }
  const profile = {
    name: $("profile-name").value.trim(),
    birthDate: $("profile-date").value,
    birthTime: $("profile-time").value,
    city: $("profile-place").value.trim(),
    lat: Number(lat), lng: Number(lng),
    mbti: $("profile-mbti").value || null,
    enneagram: $("profile-enneagram").value || null
  };
  // Only clear readings if birth data actually changed
  const oldProfile = getProfile();
  const birthChanged = !oldProfile ||
    oldProfile.birthDate !== profile.birthDate ||
    oldProfile.birthTime !== profile.birthTime ||
    oldProfile.lat !== profile.lat ||
    oldProfile.lng !== profile.lng;

  saveProfile(profile);
  if (birthChanged) {
    clearAllReadings();
  }
  renderProfileDisplay();
  updateHeaderProfile();

  const status = $("profile-status");
  status.style.display = "block";
  status.className = "profile-status success";
  status.textContent = "Profile saved! Reloading charts...";

  load().then(() => {
    status.textContent = "Profile saved! All charts updated. Generate readings on each tab.";
    setTimeout(() => { status.style.display = "none"; }, 4000);
  });
});

/* ── Chart Question (Natal Tab) ───────────────── */
const chartAskForm = $("chart-ask-form");
if (chartAskForm) {
  chartAskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = $("chart-ask-input").value.trim();
    if (!question) return;
    const btn = $("chart-ask-btn");
    const result = $("chart-ask-result");
    btn.disabled = true; btn.textContent = "Reading...";
    result.style.display = "block";
    result.innerHTML = `<div class="cosmic-ask-loading">Reading your chart...</div>`;
    try {
      const res = await fetch("/api/generate-reading", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "chart-question", profile: getProfile(), extra: { question } })
      });
      const data = await res.json();
      if (data.error) {
        result.innerHTML = `<p class="cosmic-ask-error">${data.error}</p>`;
      } else {
        const answer = typeof data.reading === "string" ? data.reading : JSON.stringify(data.reading);
        result.innerHTML = `<div class="cosmic-ask-answer">${answer.replace(/\n/g, "<br/>")}</div>`;
      }
    } catch { result.innerHTML = `<p class="cosmic-ask-error">Could not read the chart right now.</p>`; }
    finally { btn.disabled = false; btn.textContent = "\u2726 Ask"; }
  });
}

/* ── Saved Asks ───────────────────────────────── */
function getSavedAsks() {
  try { return JSON.parse(localStorage.getItem("cosmic-weather-asks")) || []; }
  catch { return []; }
}

function renderSavedAsks() {
  const container = $("saved-asks");
  if (!container) return;
  const saved = getSavedAsks();
  if (saved.length === 0) {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";
  container.innerHTML = `
    <div class="panel-head"><p class="label">Saved Readings</p></div>
    ${saved.map((s, i) => `
      <div class="saved-ask-item">
        <div class="saved-ask-head">
          <strong>${escapeHtml(s.question)}</strong>
          <div class="saved-ask-meta">
            <span class="small">${new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <button class="gen-btn gen-delete gen-small" data-ask-idx="${i}">Delete</button>
          </div>
        </div>
        <p>${escapeHtml(s.answer).replace(/\n/g, "<br/>")}</p>
      </div>
    `).join("")}`;

  container.querySelectorAll("[data-ask-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const saved = getSavedAsks();
      saved.splice(Number(btn.dataset.askIdx), 1);
      localStorage.setItem("cosmic-weather-asks", JSON.stringify(saved));
      renderSavedAsks();
    });
  });
}

// Init saved asks on load
setTimeout(renderSavedAsks, 100);

/* ── Background Picker ────────────────────────── */
const BG_KEY = "cosmic-weather-bg";
const CUSTOM_BG_KEY = "cosmic-weather-custom-bg";
const BG_MAP = { default: "", constellations: "bg-constellations", kawaii: "bg-kawaii", glitch: "bg-glitch", custom: "bg-custom" };

function applyBackground(id) {
  Object.values(BG_MAP).forEach(cls => { if (cls) document.body.classList.remove(cls); });
  if (id === "custom") {
    const customUrl = localStorage.getItem(CUSTOM_BG_KEY);
    if (customUrl) {
      document.body.style.setProperty("--custom-bg", `url(${customUrl})`);
      document.body.classList.add("bg-custom");
    }
  } else {
    document.body.style.removeProperty("--custom-bg");
    if (BG_MAP[id]) document.body.classList.add(BG_MAP[id]);
  }
  localStorage.setItem(BG_KEY, id);
  document.querySelectorAll(".bg-option").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.bg === id);
  });
  // Also highlight upload option
  const uploadOption = document.querySelector(".bg-upload-option");
  if (uploadOption) uploadOption.classList.toggle("active", id === "custom");
}

// Init background from saved preference
applyBackground(localStorage.getItem(BG_KEY) || "default");

// Show custom preview if exists
const savedCustom = localStorage.getItem(CUSTOM_BG_KEY);
if (savedCustom) {
  const preview = $("bg-upload-preview");
  if (preview) preview.innerHTML = `<img src="${savedCustom}" alt="Custom" />`;
}

document.querySelectorAll(".bg-option[data-bg]").forEach(btn => {
  btn.addEventListener("click", () => applyBackground(btn.dataset.bg));
});

// Custom background upload
const bgUpload = $("bg-upload");
if (bgUpload) {
  bgUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      try {
        localStorage.setItem(CUSTOM_BG_KEY, dataUrl);
        const preview = $("bg-upload-preview");
        if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Custom" />`;
        applyBackground("custom");
      } catch {
        alert("Image too large for localStorage. Try a smaller file (under 2MB).");
      }
    };
    reader.readAsDataURL(file);
  });
}

$("clear-profile-btn").addEventListener("click", () => {
  clearAllProfile();
  $("profile-form").reset();
  $("profile-lat").value = ""; $("profile-lng").value = "";
  $("geocode-result").textContent = "";
  renderProfileDisplay();
  load();
});
