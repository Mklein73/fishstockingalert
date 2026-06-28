/**
 * ui.js — everything that draws on screen
 *
 * Receives normalized records { waterName, county, species, dateStocked, lat, lon }
 * and renders the list view, map tab, and calendar tab.
 */
window.UI = (function () {

  /* ── Private state ──────────────────────────────────────────── */
  var _map          = null;
  var _markersLayer = null;
  var _previewMap   = null;

  var _selectedSpecies      = null;   // null = all; Set = specific species
  var _speciesUIs           = [];     // [{panel, btn, labelEl, allCb}] for sync
  var _speciesListenerAdded = false;

  /* ── Fishing tips ───────────────────────────────────────────── */

  var TIPS = {

    rainbowTrout: [
      "Hatchery rainbows are most catchable in the first 24–72 hours post-stocking. Fish as close as possible to where the stocking truck entered the water — trout congregate near their release point before dispersing.",
      "PowerBait in chartreuse, rainbow, or salmon-egg colors is the go-to for stocked fish. Float it 18–24 inches off the bottom with a sliding sinker rig so it stays in the strike zone without dragging.",
      "Small in-line spinners (Panther Martin or Blue Fox, size 0–2) retrieved slow and steady are deadly on fresh plants. Let the spinner sink a beat before starting the retrieve to cover multiple depth layers.",
      "Stocked trout school tight. If you're not biting, move along the bank every 20–30 minutes until you find the school, then stay put. Look for sheltered coves and inlet channels where current slows.",
      "In summer, stocked rainbows push deep to find cooler water. Target 10–20 feet down near the thermocline. Early morning and evening are the only productive windows when surface temps exceed 65°F.",
      "Drop down to 4 lb fluorocarbon leader material. Stocked trout in clear water become noticeably line-shy after a day or two of pressure — lighter line means a more natural presentation and more strikes.",
      "After day 3, surviving fish that have seen heavy pressure become wary of PowerBait. Switch to natural presentations: nightcrawlers under a small float or small olive/brown jigs. Live bait outperforms scented bait on educated fish.",
      "In cold water (below 50°F), slow everything way down. Trout metabolize slowly in cold conditions and won't chase a fast retrieve. Soak bait on the bottom and wait for the rod to load — don't twitch or reel.",
      "Egg patterns in orange, peach, and pink — Berkley Powerbait eggs, canned corn, or real salmon eggs — mimic hatchery pellets. Fish conditioned on pellets respond immediately to round, bright objects on a bare hook under a small float.",
      "For larger stocked rainbows, work a nightcrawler on a single size-8 hook with no weight in calm, shallow sections at first light. Big fish move shallow at dawn before retreating to deeper water as sun hits the surface."
    ],

    trout: [
      "Brown trout are more wary than rainbows and hold in deeper, shaded structure. Target submerged logs, undercut banks, and bridge shadows — not open water.",
      "Fish after dark for larger browns. Trophy fish feed heavily at night on mice, large insects, and small baitfish. Use a 4-inch swimming lure or large streamer and work the surface aggressively in shallow flats.",
      "Browns respond well to natural bait — nightcrawlers, minnows, and crayfish imitations. Avoid PowerBait for pressured fish; they wise up faster than rainbows to artificial scents.",
      "Small Rapala F5 or F7 in silver or black, fished parallel to the bank at dawn, is a consistent brown trout producer in reservoirs and slower rivers.",
      "In spring, fish subsurface egg imitations near tributaries. Spawn activity triggers aggressive feeding behavior even in non-spawning fish nearby.",
      "Late-season trout are more active as water cools. You can fish heavier and faster in October and November than during the summer doldrums."
    ],

    catfish: [
      "Catfish feed primarily by scent. Cut shad or cut carp soaked overnight develops a stronger odor trail that draws fish from far greater distances than fresh-cut bait.",
      "Most catfish are caught after dark. Set up near deep holes adjacent to shallow feeding flats, use glow sticks on your rod tips, and run multiple lines to cover water.",
      "Find the thermocline in warm months — channel catfish stack near the cooler bottom layer. Soak bait directly on bottom with a slip-sinker rig in the deepest accessible area.",
      "Chicken liver in a mesh sleeve stays on the hook in current far longer than bare liver. The sleeve doubles your fishing time per bait and keeps the scent trail going.",
      "Stink baits and dip baits on sponge hooks work well for channel cats. Load the sponge heavy — the bait needs to leach scent slowly for several minutes to build an effective trail.",
      "Target catfish near current seams — fish hold behind structure in slower water but position to intercept food washing through faster sections. Bridge pilings, channel bends, and fallen trees are classic spots."
    ],

    bass: [
      "Target the first two hours after sunrise for largemouth in shallow cover. Bass move shallow to feed in low light and retreat to deeper structure as sun penetrates the water column.",
      "Texas-rigged plastic worms (6–8 inch, purple or green pumpkin) fished painfully slow through vegetation is the most reliable largemouth technique year-round. Bass often pick up a bait sitting completely still.",
      "Frog lures on surface mats produce explosive strikes. Don't set the hook on the boil — wait until you feel the full weight of the fish loading the rod, then set hard.",
      "Smallmouth favor rocky structure and current. Tube jigs and finesse drop-shots in natural colors (green pumpkin, watermelon) fished along rocky points and channel edges consistently produce.",
      "Fish crayfish imitations in early spring during pre-spawn feeding. Brown and orange jig-and-pig combos work best when dragged slowly along the bottom near gravel-to-sand transitions.",
      "Topwater baits are most effective at dawn, dusk, and when bass are visibly pushing shad to the surface. Watch for diving birds — they mark active bass schools corralling baitfish."
    ],

    salmon: [
      "Chinook salmon respond aggressively to large spinners and spoons trolled near structure. Silver with blue prism tape or green-and-chartreuse patterns produce in most California conditions.",
      "Anchor and drift fresh roe near the bottom in salmon rivers during the fall run. Keep the bait drifting naturally through the current with no added action — salmon in clear water want an unmanipulated presentation.",
      "Fish the tail-outs of pools at first light — salmon stage in tail-outs before pushing through riffles. Presentation accuracy matters more than lure selection; get your bait precisely in front of holding fish.",
      "Salmon drop in feeding activity once they have been in freshwater for more than two weeks. Target fresh-run fish near river mouths and inlet channels where they are still in active feeding mode.",
      "Staged salmon strike out of aggression and territorial response more than hunger. Small, bright offerings placed precisely in front of a visible fish trigger reflex strikes.",
      "Coho in reservoirs respond well to spoons trolled at 2–2.5 mph at 25–45 feet during summer. Chartreuse and orange patterns excel in stained water — go silver or chrome in clear conditions."
    ],

    general: [
      "Find the bait fish and you will find the predators. Look for diving birds, surface swirls, and color changes in the water that signal baitfish concentrations, then fish the edges of those areas.",
      "Morning and evening bites are almost universally more productive than midday. Plan your time on the water around the transitions — especially in warm months when midday sun pushes fish deep.",
      "Downsize your presentation on tough days. Smaller hooks, lighter line, and smaller bait all lead to more natural presentations that spook fewer fish and trigger more strikes.",
      "Fish structure every time. Rocks, fallen trees, docks, weed edges, and depth changes all concentrate fish. Open water holds far fewer fish — always have a reason for where your bait lands.",
      "Match the hatch: observe what insects or bait fish are active near the surface and match your lure or bait to what fish are already keyed on. When fish are feeding visually, presentation matters more than scent.",
      "A slip float lets you target fish suspended at a precise depth. When fish aren't responding to bottom presentations, rig a float and experiment with depth until you find where they are holding in the water column."
    ]

  };

  /* ── Date helpers ───────────────────────────────────────────── */

  var TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);

  function parseDateStr(raw) {
    if (!raw) return null;
    var d = new Date(raw + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  function daysAgo(d) {
    return Math.floor((TODAY - d) / 86400000);
  }

  function formatDateSimple(raw) {
    var d = parseDateStr(raw);
    if (!d) return "—";
    var label = d.toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric"
    });
    var n = daysAgo(d);
    var agoText;
    if      (n === 0) agoText = "today";
    else if (n === 1) agoText = "1 day ago";
    else if (n  <  0) agoText = "upcoming";
    else              agoText = n + " days ago";
    return label + " (" + agoText + ")";
  }

  /* ── Species helpers ────────────────────────────────────────── */

  function badgeClass(species) {
    if (!species) return "badge-other";
    var t = species.toLowerCase();
    if (t.includes("trout"))   return "badge-trout";
    if (t.includes("catfish")) return "badge-catfish";
    if (t.includes("bass"))    return "badge-bass";
    if (t.includes("salmon"))  return "badge-salmon";
    return "badge-other";
  }

  function speciesColor(species) {
    if (!species) return "#94a3b8";
    var t = species.toLowerCase();
    if (t.includes("trout"))   return "#0ea5e9";
    if (t.includes("catfish")) return "#f97316";
    if (t.includes("bass"))    return "#10b981";
    if (t.includes("salmon"))  return "#6366f1";
    return "#94a3b8";
  }

  /* ── Announce period ────────────────────────────────────────── */

  function announcePeriod(dateStr) {
    var d = parseDateStr(dateStr);
    if (!d) return "Past";
    var n = daysAgo(d);
    if (n < 0)   return "Upcoming";
    if (n <= 14) return "Current";
    return "Past";
  }

  /* ── Spinner / error ────────────────────────────────────────── */

  function showSpinner(message) {
    var wrap = document.getElementById("spinner");
    var msg  = document.getElementById("spinner-msg");
    if (msg) msg.textContent = message || "Loading…";
    wrap.style.display = "flex";
  }

  function hideSpinner() {
    document.getElementById("spinner").style.display = "none";
  }

  function showError(message) {
    var el = document.getElementById("error-msg");
    el.textContent   = message;
    el.style.display = "block";
  }

  /* ── Stats bar ──────────────────────────────────────────────── */

  function updateStats(records, stateName) {
    var uniqueWaters   = new Set(records.map(function (r) { return r.waterName; })).size;
    var totalStockings = records.length;
    var uniqueSpecies  = new Set(records.map(function (r) { return r.species; }).filter(Boolean)).size;

    var elWaters    = document.getElementById("stat-waters");
    var elStocking  = document.getElementById("stat-stockings");
    var elSpecies   = document.getElementById("stat-species");
    var elStateName = document.getElementById("stat-state-name");

    if (elWaters)    elWaters.textContent    = uniqueWaters.toLocaleString();
    if (elStocking)  elStocking.textContent  = totalStockings.toLocaleString();
    if (elSpecies)   elSpecies.textContent   = uniqueSpecies.toLocaleString();
    if (elStateName && stateName) elStateName.textContent = stateName;

    document.getElementById("stats-bar").style.display = "flex";
  }

  /* ══════════════════════════════════════════════════════════════
     SPECIES MULTI-SELECT
     Shared state: _selectedSpecies is the single source of truth.
     Multiple UI instances (home tab + map tab) stay in sync.
     ══════════════════════════════════════════════════════════════ */

  function _ensureSpeciesDocListener() {
    if (_speciesListenerAdded) return;
    _speciesListenerAdded = true;
    document.addEventListener("click", function (e) {
      _speciesUIs.forEach(function (ui) {
        if (!ui.panel || !ui.btn) return;
        if (!ui.panel.contains(e.target) && !ui.btn.contains(e.target)) {
          ui.panel.classList.remove("is-open");
          ui.btn.classList.remove("is-open");
        }
      });
    });
  }

  /* Sync all species UIs to reflect current _selectedSpecies */
  function _syncAllSpeciesUIs() {
    _speciesUIs.forEach(function (ui) {
      /* Update label */
      if (_selectedSpecies === null) {
        ui.labelEl.textContent = "All Species";
      } else if (_selectedSpecies.size === 0) {
        ui.labelEl.textContent = "None selected";
      } else {
        ui.labelEl.textContent = Array.from(_selectedSpecies).join(", ");
      }
      /* Sync individual species checkboxes */
      ui.panel.querySelectorAll(".ms-species-cb").forEach(function (cb) {
        cb.checked = (_selectedSpecies === null || _selectedSpecies.has(cb.value));
      });
      /* Sync "All Species" master checkbox */
      if (ui.allCb) {
        ui.allCb.checked = (_selectedSpecies === null);
      }
    });
  }

  /**
   * Build a species multi-select panel.
   * ids: { panel, btn, label, allCb } — element IDs for this instance.
   */
  function _buildSpeciesMultiSelect(speciesList, onChange, ids) {
    ids = ids || {};
    var panelId = ids.panel || "filter-species-panel";
    var btnId   = ids.btn   || "filter-species-btn";
    var labelId = ids.label || "filter-species-label";
    var allCbId = ids.allCb || "ms-all-species";

    var panel   = document.getElementById(panelId);
    var btn     = document.getElementById(btnId);
    var labelEl = document.getElementById(labelId);
    if (!panel || !btn || !labelEl) return;

    var html = '<label class="ms-item">'
      + '<input type="checkbox" id="' + allCbId + '" checked>'
      + '<span>All Species</span></label>';
    speciesList.forEach(function (s) {
      html += '<label class="ms-item">'
        + '<input type="checkbox" class="ms-species-cb" value="' + s + '" checked>'
        + '<span>' + s + '</span></label>';
    });
    panel.innerHTML = html;

    var allCb = document.getElementById(allCbId);

    /* Register this UI for sync */
    _speciesUIs.push({ panel: panel, btn: btn, labelEl: labelEl, allCb: allCb });

    btn.onclick = function (e) {
      e.stopPropagation();
      var open = panel.classList.toggle("is-open");
      btn.classList.toggle("is-open", open);
    };

    _ensureSpeciesDocListener();

    allCb.addEventListener("change", function () {
      panel.querySelectorAll(".ms-species-cb").forEach(function (cb) {
        cb.checked = allCb.checked;
      });
      _selectedSpecies = allCb.checked ? null : new Set();
      _syncAllSpeciesUIs();
      if (onChange) onChange();
    });

    panel.addEventListener("change", function (e) {
      if (!e.target.classList.contains("ms-species-cb")) return;
      var allCbs  = panel.querySelectorAll(".ms-species-cb");
      var checked = Array.from(allCbs).filter(function (c) { return c.checked; });
      var allChkd = checked.length === allCbs.length;
      _selectedSpecies = allChkd
        ? null
        : new Set(checked.map(function (c) { return c.value; }));
      _syncAllSpeciesUIs();
      if (onChange) onChange();
    });
  }

  function getSelectedSpecies() { return _selectedSpecies; }

  function resetSpeciesFilter() {
    _selectedSpecies = null;
    _syncAllSpeciesUIs();
    _speciesUIs.forEach(function (ui) {
      if (ui.panel) ui.panel.classList.remove("is-open");
      if (ui.btn)   ui.btn.classList.remove("is-open");
    });
  }

  /* ── Filter dropdowns ───────────────────────────────────────── */

  function populateFilters(records, onChange) {
    var counties = Array.from(new Set(records.map(function (r) { return r.county;  }).filter(Boolean))).sort();
    var species  = Array.from(new Set(records.map(function (r) { return r.species; }).filter(Boolean))).sort();

    /* Home tab county */
    var countyEl = document.getElementById("filter-county");
    countyEl.innerHTML = '<option value="">All Counties</option>';
    counties.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c; opt.textContent = c;
      countyEl.appendChild(opt);
    });

    /* Map tab county (mirror) */
    var mapCountyEl = document.getElementById("map-filter-county");
    if (mapCountyEl) {
      mapCountyEl.innerHTML = '<option value="">All Counties</option>';
      counties.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c; opt.textContent = c;
        mapCountyEl.appendChild(opt);
      });
    }

    _selectedSpecies = null;
    _speciesUIs      = [];   /* reset so re-population doesn't duplicate */

    /* Home tab species */
    _buildSpeciesMultiSelect(species, onChange, {
      panel: "filter-species-panel",
      btn:   "filter-species-btn",
      label: "filter-species-label",
      allCb: "ms-all-species"
    });

    /* Map tab species */
    _buildSpeciesMultiSelect(species, onChange, {
      panel: "map-filter-species-panel",
      btn:   "map-filter-species-btn",
      label: "map-filter-species-label",
      allCb: "map-ms-all-species"
    });
  }

  /* ══════════════════════════════════════════════════════════════
     LIST VIEW
     ══════════════════════════════════════════════════════════════ */

  function buildWaterList(records) {
    var groups = {};
    records.forEach(function (r) {
      var key = r.waterName || "(Unknown)";
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    return Object.keys(groups).map(function (name) {
      var events = groups[name].slice().sort(function (a, b) {
        return (b.dateStocked || "") > (a.dateStocked || "") ? 1 : -1;
      });
      var latest = events[0];
      return {
        waterName:     name,
        county:        latest.county  || "",
        lat:           latest.lat     || null,
        lon:           latest.lon     || null,
        distanceMiles: null,
        latestRecord:  latest,
        allEvents:     events
      };
    }).sort(function (a, b) {
      var da = a.latestRecord.dateStocked || "";
      var db = b.latestRecord.dateStocked || "";
      return db > da ? 1 : db < da ? -1 : 0;
    });
  }

  function renderWaterList(waters, selectedName) {
    var container = document.getElementById("water-list");
    var countEl   = document.getElementById("list-count");

    if (countEl) {
      countEl.textContent = "Showing " + waters.length + " water" + (waters.length !== 1 ? "s" : "");
    }

    if (!container) return;

    if (waters.length === 0) {
      container.innerHTML = '<div class="water-list-empty">No waters match your filters.</div>';
      return;
    }

    var frag = document.createDocumentFragment();
    waters.forEach(function (w) {
      var div = document.createElement("div");
      div.dataset.water = w.waterName;

      var d0  = parseDateStr(w.latestRecord.dateStocked);
      var n0  = d0 ? daysAgo(d0) : null;
      var statusTxt = n0 === null ? ""
                    : n0 < 0     ? d0.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : n0 === 0   ? "today"
                    : n0 === 1   ? "1 day ago"
                    :               n0 + " days ago";

      div.className = "water-card" + (w.waterName === selectedName ? " selected" : "");

      var distHtml = (w.distanceMiles !== null)
        ? '<span class="water-card-distance">' + Math.round(w.distanceMiles) + " mi</span>"
        : "";

      div.style.setProperty('--wc-border-color', speciesColor(w.latestRecord ? w.latestRecord.species : null));

      div.innerHTML =
        '<div class="water-card-body">'
        +   '<div class="water-card-name" title="' + (w.waterName || "—") + '">' + (w.waterName || "—") + "</div>"
        +   '<div class="water-card-meta">'
        +     "<span>" + (w.county || "—") + "</span>"
        +     distHtml
        +   "</div>"
        +   (statusTxt ? '<div class="water-card-status">' + statusTxt + "</div>" : "")
        + "</div>";

      frag.appendChild(div);
    });

    container.innerHTML = "";
    container.appendChild(frag);
  }

  /* ── Preview map (column 2) ────────────────────────────────── */

  function _destroyPreviewMap() {
    if (_previewMap) {
      _previewMap.remove();
      _previewMap = null;
    }
  }

  function _initPreviewMap(lat, lon) {
    _destroyPreviewMap();
    if (!lat || !lon) return;

    var el = document.getElementById("preview-map");
    if (!el) return;

    _previewMap = L.map("preview-map", {
      zoomControl:        false,
      scrollWheelZoom:    false,
      dragging:           false,
      doubleClickZoom:    false,
      touchZoom:          false,
      boxZoom:            false,
      keyboard:           false,
      attributionControl: false
    }).setView([lat, lon], 13);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }
    ).addTo(_previewMap);

    L.circleMarker([lat, lon], {
      radius: 14, fillColor: "#0ea5e9", color: "none",
      weight: 0, opacity: 0, fillOpacity: 0.20
    }).addTo(_previewMap);
    L.circleMarker([lat, lon], {
      radius: 10, fillColor: "#0ea5e9", color: "#ffffff",
      weight: 2, opacity: 1, fillOpacity: 1
    }).addTo(_previewMap);

    setTimeout(function () {
      if (_previewMap) _previewMap.invalidateSize();
    }, 100);
  }

  /* ── Moon phase ─────────────────────────────────────────────── */

  function getMoonPhase(dateStr) {
    var date = parseDateStr(dateStr);
    if (!date) date = new Date();

    var yr = date.getFullYear();
    var mo = date.getMonth() + 1;
    var dy = date.getDate();

    var a   = Math.floor((14 - mo) / 12);
    var y   = yr + 4800 - a;
    var m   = mo + 12 * a - 3;
    var jdn = dy + Math.floor((153 * m + 2) / 5) + 365 * y
            + Math.floor(y / 4) - Math.floor(y / 100)
            + Math.floor(y / 400) - 32045;

    var daysSince = (jdn - 2451550) % 29.53059;
    if (daysSince < 0) daysSince += 29.53059;

    var idx    = Math.round(daysSince / 29.53059 * 8) % 8;
    var names  = ["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous",
                  "Full Moon","Waning Gibbous","Third Quarter","Waning Crescent"];
    var emojis = ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"];

    return { name: names[idx], emoji: emojis[idx], index: idx };
  }

  /* ── Metric cards ───────────────────────────────────────────── */

  function _hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function _buildMetricCard(color, label, valueText, barPct, note) {
    var trackColor = _hexToRgba(color, 0.12);
    var barHtml;
    if (barPct !== null && barPct !== undefined) {
      var pct    = Math.max(0, Math.min(1, barPct));
      var pctStr = (pct * 100).toFixed(1);
      barHtml = '<div class="mc-bar-wrap">'
        + '<div class="mc-bar-track" style="position:absolute;inset:0;border-radius:7px;background:' + trackColor + '"></div>'
        + (pct > 0
            ? '<div class="mc-bar-fill" style="position:absolute;top:0;left:0;height:100%;width:' + pctStr + '%;border-radius:7px;background:' + color + '"></div>'
            : '')
        + '<div class="mc-bar-dot" style="position:absolute;top:50%;left:' + pctStr + '%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:' + color + ';box-shadow:0 1px 4px rgba(0,0,0,0.22)"></div>'
        + '</div>';
    } else {
      barHtml = '<div class="mc-bar-wrap">'
        + '<div class="mc-bar-track" style="position:absolute;inset:0;border-radius:7px;background:' + trackColor + '"></div>'
        + '</div>';
    }
    var valueHtml = note
      ? '<div style="text-align:right"><span class="mc-value">' + (valueText || '—') + '</span>'
          + '<span class="mc-note">' + note + '</span></div>'
      : '<span class="mc-value">' + (valueText || '—') + '</span>';
    return '<div class="metric-card">'
      + '<div class="mc-header">'
      +   '<span class="mc-label">' + label + '</span>'
      +   valueHtml
      + '</div>'
      + barHtml
      + '</div>';
  }

  function _buildMetricCards(waterObj) {
    if (!waterObj) {
      var emptyCard = function(label) {
        return '<div class="metric-card">'
          + '<div class="mc-header">'
          +   '<span class="mc-label">' + label + '</span>'
          +   '<span class="mc-value" style="color:#94a3b8">—</span>'
          + '</div>'
          + '<div class="mc-bar-wrap"><div class="mc-bar-track mc-bar-track--empty" style="position:absolute;inset:0;border-radius:7px;background:#f1f5f9"></div></div>'
          + '</div>';
      };
      return emptyCard('STOCKING FRESHNESS') + emptyCard('STOCKING FREQUENCY')
           + emptyCard('PLANT SIZE')         + emptyCard('FISH DENSITY')
           + emptyCard('TEMP SUITABILITY')   + emptyCard('ANGLER PRESSURE');
    }

    var r   = waterObj.latestRecord;
    var all = waterObj.allEvents;

    var d0           = parseDateStr(r.dateStocked);
    var days         = d0 ? daysAgo(d0) : null;
    var freshnessVal = days === null ? "No data"
                     : days === 0   ? "Today"
                     : days < 0     ? "In " + Math.abs(days) + " days"
                     :                days + " days ago";
    var freshnessPct = (days === null) ? 0
                     : days < 0       ? 1
                     :                  Math.max(0, 1 - days / 30);

    var freqVal = all.length <= 1 ? "First stocking" : "No data";
    var freqPct = 0;
    if (all.length >= 2) {
      var sorted = all.slice().sort(function (a, b) {
        return (a.dateStocked || "") > (b.dateStocked || "") ? 1 : -1;
      });
      var oldest = parseDateStr(sorted[0].dateStocked);
      var newest = parseDateStr(sorted[sorted.length - 1].dateStocked);
      if (oldest && newest) {
        var spanDays = Math.abs(daysAgo(oldest) - daysAgo(newest));
        var avgGap   = spanDays / (all.length - 1);
        freqVal = "Every " + Math.round(avgGap) + " days avg";
        freqPct = Math.max(0, 1 - avgGap / 90);
      }
    }

    var maxCount = 0;
    all.forEach(function (e) { if (e.fishCount) maxCount = Math.max(maxCount, Number(e.fishCount)); });
    var sizeVal = r.fishCount ? Number(r.fishCount).toLocaleString() + " fish" : "Not reported by agency";
    var sizePct = (r.fishCount && maxCount > 0) ? Number(r.fishCount) / maxCount : null;

    var densVal = "Data pending";
    var densPct = null;
    if (r.fishCount && r.acreage && Number(r.acreage) > 0) {
      var fpa = Number(r.fishCount) / Number(r.acreage);
      densVal = fpa.toFixed(1) + " fish/acre";
      densPct = Math.min(1, fpa / 5);
    }

    var month     = new Date().getMonth() + 1;
    var sp        = (r.species || "").toLowerCase();
    var isCold    = sp.includes("trout") || sp.includes("salmon");
    var isWarm    = sp.includes("catfish") || sp.includes("bass");
    var tempColor, tempVal, tempPct;
    if (isCold) {
      if (month >= 10 || month <= 5) { tempColor = "#10b981"; tempVal = "Ideal conditions";      tempPct = 1.0; }
      else if (month === 6 || month === 9) { tempColor = "#eab308"; tempVal = "Marginal — warming"; tempPct = 0.6; }
      else                            { tempColor = "#ef4444"; tempVal = "Too warm — fish stressed"; tempPct = 0.3; }
    } else if (isWarm) {
      if (month >= 6 && month <= 9)  { tempColor = "#10b981"; tempVal = "Ideal conditions";    tempPct = 1.0; }
      else if (month === 5 || month === 10) { tempColor = "#eab308"; tempVal = "Warming to ideal"; tempPct = 0.7; }
      else                            { tempColor = "#3b82f6"; tempVal = "Cold — slower bite";  tempPct = 0.4; }
    } else {
      tempColor = "#94a3b8"; tempVal = "Varies by species"; tempPct = 0.5;
    }

    var recencyFactor = (days !== null && days >= 0) ? Math.max(0, 1 - days / 14) : 0.5;
    var eventFactor   = Math.min(1, all.length / 5);
    var pressureScore = recencyFactor * 0.7 + eventFactor * 0.3;
    var pressurePct   = Math.min(1, pressureScore);
    var pressureVal   = pressureScore >= 0.67 ? "Heavy"
                      : pressureScore >= 0.33 ? "Moderate"
                      :                         "Light";

    return _buildMetricCard("#0ea5e9", "STOCKING FRESHNESS", freshnessVal, freshnessPct)
         + _buildMetricCard("#3b82f6", "STOCKING FREQUENCY", freqVal,      freqPct)
         + _buildMetricCard("#f97316", "PLANT SIZE",          sizeVal,      sizePct)
         + _buildMetricCard("#10b981", "FISH DENSITY",        densVal,      densPct)
         + _buildMetricCard(tempColor, "TEMP SUITABILITY",    tempVal,      tempPct)
         + _buildMetricCard("#8b5cf6", "ANGLER PRESSURE",     pressureVal,  pressurePct,
             "Based on recency and frequency");
  }

  /* ── Moon widget ────────────────────────────────────────────── */

  function _buildMoonWidget(waterObj) {
    var today     = new Date();
    var todayMoon = getMoonPhase(null);

    var todayDateLabel = today.toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric", year: "numeric"
    });

    var leftSide = '<div class="moon-widget-side">'
      + '<span class="moon-widget-label">MOON PHASE TODAY</span>'
      + '<span class="moon-widget-date">' + todayDateLabel + '</span>'
      + '<span class="moon-widget-emoji">' + todayMoon.emoji + '</span>'
      + '<span class="moon-widget-phase">' + todayMoon.name + '</span>'
      + '</div>';

    var rightSide = '';
    if (waterObj) {
      var stockMoon = getMoonPhase(waterObj.latestRecord.dateStocked);
      if (stockMoon.name !== todayMoon.name) {
        var stockDate     = parseDateStr(waterObj.latestRecord.dateStocked);
        var stockShortLbl = stockDate
          ? stockDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "";
        var stockFullLbl  = stockDate
          ? stockDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })
          : "";
        rightSide = '<div class="moon-widget-side moon-widget-side--right">'
          + '<span class="moon-widget-label">STOCK DATE' + (stockShortLbl ? ' (' + stockShortLbl + ')' : '') + '</span>'
          + '<span class="moon-widget-date">' + stockFullLbl + '</span>'
          + '<span class="moon-widget-emoji">' + stockMoon.emoji + '</span>'
          + '<span class="moon-widget-phase">' + stockMoon.name + '</span>'
          + '</div>';
      }
    }

    return leftSide + rightSide;
  }

  /* ── Update column 2 ────────────────────────────────────────── */

  function _updatePreviewColumn(waterObj, onOpenFullMap) {
    _destroyPreviewMap();

    var moonEl  = document.getElementById("moon-widget");
    var stripEl = document.getElementById("metric-strip");
    var openBtn = document.getElementById("preview-open-btn");

    if (moonEl)  moonEl.innerHTML  = _buildMoonWidget(waterObj || null);
    if (stripEl) stripEl.innerHTML = _buildMetricCards(waterObj || null);

    if (openBtn) {
      var hasCoords = !!(waterObj && waterObj.lat && waterObj.lon);
      openBtn.style.display = hasCoords ? "block" : "none";
      if (hasCoords && typeof onOpenFullMap === "function") {
        openBtn.onclick = function () { onOpenFullMap(waterObj.lat, waterObj.lon); };
      }
    }

    if (waterObj && waterObj.lat && waterObj.lon) {
      setTimeout(function () { _initPreviewMap(waterObj.lat, waterObj.lon); }, 60);
    }
  }

  /* ── Detail panel helpers ───────────────────────────────────── */

  function _getTip(species) {
    var t   = (species || "").toLowerCase();
    var arr;
    if      (t === "trout" || t.includes("rainbow")) arr = TIPS.rainbowTrout;
    else if (t.includes("trout"))                   arr = TIPS.trout;
    else if (t.includes("catfish")) arr = TIPS.catfish;
    else if (t.includes("bass"))    arr = TIPS.bass;
    else if (t.includes("salmon"))  arr = TIPS.salmon;
    else                            arr = TIPS.general;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function _fieldRow(label, valueHtml) {
    return '<div class="field-row">'
      + '<span class="field-label">' + label + "</span>"
      + '<span class="field-value">'  + valueHtml + "</span>"
      + "</div>";
  }

  function _buildCollapsible(id, icon, title, contentHtml, opts) {
    var cls = "collapsible";
    if (opts && opts.startCollapsed) cls += " is-collapsed";
    if (opts && opts.noToggle)       cls += " collapsible--notoggle";
    return '<div class="' + cls + '" id="' + id + '">'
      +   '<button class="collapsible-header">'
      +     '<div class="collapsible-header-left">'
      +       '<span class="sec-icon"><i data-lucide="' + icon + '"></i></span>'
      +       '<span class="collapsible-header-title">' + title + "</span>"
      +     "</div>"
      +     '<span class="collapsible-chevron"><i data-lucide="chevron-down"></i></span>'
      +   "</button>"
      +   '<div class="collapsible-body">'
      +     '<div class="collapsible-content">' + contentHtml + "</div>"
      +   "</div>"
      + "</div>";
  }

  function _wireCollapsibles(panel) {
    panel.querySelectorAll(".collapsible-header").forEach(function (btn) {
      var sec = btn.closest(".collapsible");
      if (sec && sec.classList.contains("collapsible--notoggle")) return;
      btn.addEventListener("click", function () {
        var body = sec.querySelector(".collapsible-body");
        if (sec.classList.contains("is-collapsed")) {
          sec.classList.remove("is-collapsed");
          body.style.maxHeight = body.scrollHeight + "px";
          body.addEventListener("transitionend", function onEnd() {
            body.style.maxHeight = "2000px";
            body.removeEventListener("transitionend", onEnd);
          });
        } else {
          body.style.maxHeight = body.scrollHeight + "px";
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              body.style.maxHeight = "0";
              sec.classList.add("is-collapsed");
            });
          });
        }
      });
    });
  }

  /* ── Render column 3 detail panel ──────────────────────────── */

  function renderWaterDetail(waterObj, onOpenFullMap) {
    _updatePreviewColumn(waterObj, onOpenFullMap);

    var placeholder = document.getElementById("detail-placeholder");
    var panel       = document.getElementById("detail-panel");
    if (!panel) return;

    if (!waterObj) {
      if (placeholder) placeholder.style.display = "flex";
      panel.style.display = "none";
      return;
    }

    if (placeholder) placeholder.style.display = "none";
    panel.style.display = "block";

    var r       = waterObj.latestRecord;
    var all     = waterObj.allEvents;
    var ap      = announcePeriod(r.dateStocked);
    var apColor = ap === "Upcoming" ? "#0ea5e9"
                : ap === "Current"  ? "#10b981"
                :                     "#94a3b8";

    var html = "";

    var countyLine   = (waterObj.county || "—") + ", California";
    var typePillHtml = waterObj.waterType
      ? '<div class="detail-col-pills"><span class="water-type-pill">' + waterObj.waterType + "</span></div>"
      : "";
    var distHtml = (waterObj.distanceMiles !== null && waterObj.distanceMiles !== undefined)
      ? '<div class="detail-col-distance">📍 ' + Math.round(waterObj.distanceMiles) + " mi from you</div>"
      : "";

    html += '<div class="detail-col-name">' + (waterObj.waterName || "—") + "</div>"
         +  '<div class="detail-col-county">' + countyLine + "</div>"
         +  '<div class="detail-col-status-row">'
         +    '<span class="status-dot" style="background:' + apColor + ';"></span>'
         +    '<span class="status-text" style="color:' + apColor + ';">' + ap + "</span>"
         +  "</div>"
         +  typePillHtml
         +  distHtml
         +  '<button class="detail-alert-btn" id="detail-alert-btn"><i data-lucide="bell"></i> Get Alert</button>';

    var stockingContent = "";
    var d0     = parseDateStr(r.dateStocked);
    var dLabel = d0 ? d0.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
    var n0     = d0 ? daysAgo(d0) : null;
    var agoTxt = n0 === null ? ""
               : n0 === 0   ? "today"
               : n0 === 1   ? "1 day ago"
               : n0  <  0   ? "upcoming"
               :               n0 + " days ago";

    stockingContent += _fieldRow("Date",
      dLabel + (agoTxt ? ' <span class="days-ago">(' + agoTxt + ")</span>" : "")
    );
    stockingContent += _fieldRow("Species",
      '<span class="species-dot" style="background:' + speciesColor(r.species) + ';"></span>'
      + (r.species || "—")
    );

    var hasCountSize  = r.fishCount || r.fishSize;
    var hasAcreage    = r.acreage;
    var hasSourceInfo = r.hatchery || r.method;

    if (hasCountSize) {
      stockingContent += '<hr class="field-divider" />';
      if (r.fishCount) stockingContent += _fieldRow("Fish Count", Number(r.fishCount).toLocaleString() + " fish");
      if (r.fishSize)  stockingContent += _fieldRow("Fish Size",  r.fishSize + " in avg");
    }

    if (hasAcreage) {
      if (!hasCountSize) stockingContent += '<hr class="field-divider" />';
      stockingContent += _fieldRow("Acreage", Number(r.acreage).toLocaleString() + " acres");
      if (r.fishCount) {
        var fpaD = (Number(r.fishCount) / Number(r.acreage)).toFixed(2);
        stockingContent += _fieldRow("Fish / Acre",
          fpaD + ' <span class="field-calc">(' + Number(r.fishCount).toLocaleString() + " ÷ " + Number(r.acreage).toLocaleString() + ")</span>"
        );
      }
    }

    if (hasSourceInfo) {
      stockingContent += '<hr class="field-divider" />';
      if (r.hatchery) stockingContent += _fieldRow("Hatchery", r.hatchery);
      if (r.method)   stockingContent += _fieldRow("Method",   r.method);
    }

    html += _buildCollapsible("det-stocking", "droplets", "Latest Stocking", stockingContent);

    var regsContent = "";
    regsContent += _fieldRow("LICENSE",
      'Required, age 16+'
      + ' &nbsp;<a class="field-action-link" href="https://wildlife.ca.gov/Licensing/Fishing"'
      + ' target="_blank" rel="noopener">Buy CA License →</a>'
    );
    regsContent += _fieldRow("SEASON",
      (r.season || "Open year-round (most stocked waters)")
      + ' &nbsp;<a class="field-action-link" href="https://wildlife.ca.gov/fishing"'
      + ' target="_blank" rel="noopener">Check specific water →</a>'
    );
    regsContent += _fieldRow("BAG LIMIT",   r.bagLimit || "5 trout per day (combined species)");
    regsContent += _fieldRow("SIZE LIMIT",  r.minSize  || "No minimum on stocked waters");
    regsContent += _fieldRow("BAIT",        r.bait     || "Artificial and bait allowed (check water-specific rules)");
    if (r.rods) regsContent += _fieldRow("RODS", r.rods);
    regsContent +=
      '<hr class="field-divider" />'
      + '<div class="regs-link-row">'
      +   '<a class="field-action-link" href="https://nrm.dfg.ca.gov/FileHandler.ashx?DocumentID=209090&inline="'
      +   ' target="_blank" rel="noopener">Full CA Regulations (PDF) →</a>'
      +   '<a class="field-action-link" href="https://wildlife.ca.gov/enforcement"'
      +   ' target="_blank" rel="noopener">Report a Violation →</a>'
      + '</div>'
      + '<p class="regs-disclaimer">Default statewide rules shown. Always verify at wildlife.ca.gov before fishing.</p>';
    html += _buildCollapsible("det-regs", "shield", "Regulations", regsContent);

    var waterDetailsContent = "";
    var _wdField = function(label, val) {
      if (val) return _fieldRow(label, val);
      return '<div class="field-row field-row--empty">'
        + '<span class="field-label">' + label + '</span>'
        + '<span class="field-value">—</span>'
        + '</div>';
    };
    waterDetailsContent += _wdField("WATER TYPE",   waterObj.waterType);
    waterDetailsContent += _wdField("ACCESS",       waterObj.access);
    waterDetailsContent += _wdField("MOTORS",       waterObj.motors);
    waterDetailsContent += _wdField("SHORE ACCESS", waterObj.shoreAccess);
    waterDetailsContent += _wdField("PARKING",      waterObj.parking);
    waterDetailsContent += _wdField("FEE",          waterObj.fee);
    waterDetailsContent += _wdField("ACCESSIBLE",   waterObj.accessible);
    waterDetailsContent += '<p class="water-detail-disclaimer">Water details coming soon. Data is added as coverage expands.</p>';
    html += _buildCollapsible("det-water", "map-pin", "Water Details", waterDetailsContent,
      { startCollapsed: true });

    var tip      = _getTip(r.species);
    var tipTitle = "Fishing Tips" + (r.species ? " · " + r.species : "");
    html += _buildCollapsible("det-tips", "lightbulb", tipTitle,
      '<p class="tip-text">' + tip + "</p>",
      { noToggle: true }
    );

    if (all.length > 1) {
      var histContent  = '<div class="timeline-wrap">';
      var latestSpecies = r.species || "";

      all.forEach(function (evt, idx) {
        var evtDate  = parseDateStr(evt.dateStocked);
        var evtLabel = evtDate
          ? evtDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
          : "—";
        var evtColor    = speciesColor(evt.species);
        var isLast      = (idx === all.length - 1);
        var showSpecies = (evt.species || "") !== latestSpecies;

        histContent +=
          '<div class="timeline-item">'
          +   '<div class="tl-track">'
          +     '<div class="tl-track-top"></div>'
          +     '<div class="tl-dot" style="background:' + evtColor + '"></div>'
          +     '<div class="tl-track-bottom' + (isLast ? " tl-track-bottom--last" : "") + '"></div>'
          +   '</div>'
          +   '<div class="tl-body">'
          +     '<span class="history-date">' + evtLabel + "</span>"
          +     '<div class="history-meta">';

        if (showSpecies) {
          histContent += '<span class="species-dot" style="background:' + evtColor + ';"></span>'
            + '<span>' + (evt.species || "—") + "</span>";
        }

        if (evt.fishSize)  histContent += '<span class="history-extra">' + evt.fishSize  + " in</span>";
        if (evt.fishCount) histContent += '<span class="history-extra">' + Number(evt.fishCount).toLocaleString() + " fish</span>";

        histContent += "</div></div></div>";
      });

      histContent += "</div>";
      html += _buildCollapsible("det-history", "clock", "Stocking History (" + all.length + ")", histContent,
        { startCollapsed: all.length < 3 }
      );
    }

    html +=
      '<div class="detail-source-footer">'
      +   'Data sourced from <a href="https://data.cnra.ca.gov" target="_blank" rel="noopener">CDFW Open Data Portal</a>. '
      +   "Dates reflect week of plant start."
      + "</div>";

    panel.innerHTML = html;
    _wireCollapsibles(panel);

    var alertBtnEl = panel.querySelector("#detail-alert-btn");
    if (alertBtnEl) {
      alertBtnEl.innerHTML = '<i data-lucide="bell"></i> Get Alert for ' + (waterObj.waterName || "this Water");
      alertBtnEl.onclick = function () {
        if (typeof window.openAlertModal === 'function') {
          window.openAlertModal(waterObj.waterName);
        } else {
          alert('Alert signup coming soon! We will notify you when ' + waterObj.waterName + ' gets stocked.');
        }
      };
    }

    if (window.lucide) lucide.createIcons();
  }

  /* ── Fly main map ───────────────────────────────────────────── */

  function flyTo(lat, lon, zoom) {
    if (_map) _map.flyTo([lat, lon], zoom || 13);
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN MAP TAB  (Leaflet)
     ══════════════════════════════════════════════════════════════ */

  function initMap(records) {
    _map = L.map("leaflet-map").setView([37.5, -119.5], 6);

    var _streetsLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }
    );

    var _satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri &mdash; Esri, USGS, USDA, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGS & GIS User Community",
        maxZoom: 19
      }
    );

    var _labelsLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 1 }
    );

    _satelliteLayer.addTo(_map);
    _labelsLayer.addTo(_map);

    var tileControl = L.control({ position: "bottomright" });
    tileControl.onAdd = function () {
      var panel = L.DomUtil.create("div", "map-tile-panel");
      L.DomEvent.disableClickPropagation(panel);
      L.DomEvent.disableScrollPropagation(panel);

      panel.innerHTML =
        '<label class="tile-radio"><input type="radio" name="fsa-tile" value="satellite" checked> Satellite</label>'
        + '<label class="tile-radio"><input type="radio" name="fsa-tile" value="streets"> Streets</label>'
        + '<hr class="tile-divider">'
        + '<label class="tile-check"><input type="checkbox" id="fsa-labels" checked> Place names</label>';

      var radios   = panel.querySelectorAll('input[name="fsa-tile"]');
      var chkLabel = panel.querySelector("#fsa-labels");

      function applyTile() {
        var isSat = panel.querySelector('input[value="satellite"]').checked;
        if (isSat) {
          _map.removeLayer(_streetsLayer);
          _satelliteLayer.addTo(_map);
          if (chkLabel.checked) _labelsLayer.addTo(_map);
          chkLabel.parentElement.classList.remove("tile-check-disabled");
        } else {
          _map.removeLayer(_satelliteLayer);
          _map.removeLayer(_labelsLayer);
          _streetsLayer.addTo(_map);
          chkLabel.parentElement.classList.add("tile-check-disabled");
        }
      }

      radios.forEach(function (r) { L.DomEvent.on(r, "change", applyTile); });

      L.DomEvent.on(chkLabel, "change", function () {
        var isSat = panel.querySelector('input[value="satellite"]').checked;
        if (!isSat) return;
        if (chkLabel.checked) { _labelsLayer.addTo(_map); }
        else                  { _map.removeLayer(_labelsLayer); }
      });

      return panel;
    };
    tileControl.addTo(_map);

    _markersLayer = L.layerGroup().addTo(_map);

    var legend = L.control({ position: "bottomleft" });
    legend.onAdd = function () {
      var div = L.DomUtil.create("div", "map-legend");
      div.innerHTML =
        '<div class="legend-title">Species</div>'
        + _legendItem("#0ea5e9", "Trout")
        + _legendItem("#10b981", "Bass")
        + _legendItem("#f97316", "Catfish")
        + _legendItem("#6366f1", "Salmon")
        + _legendItem("#94a3b8", "Other");
      return div;
    };
    legend.addTo(_map);

    /* Initial plot — fit bounds only on first load */
    _addPins(records, true);
  }

  function _legendItem(color, label) {
    return '<div class="legend-item">'
      + '<span class="legend-dot" style="background:' + color + ';border-color:rgba(255,255,255,0.8)"></span>'
      + label + "</div>";
  }

  function _addPins(records, doFitBounds) {
    if (!_markersLayer) return;
    _markersLayer.clearLayers();
    var bounds = [];

    records.forEach(function (r) {
      if (!r.lat || !r.lon) return;
      var color  = speciesColor(r.species);
      var marker = L.circleMarker([r.lat, r.lon], {
        radius: 7, fillColor: color, color: "#ffffff",
        weight: 1.5, opacity: 1, fillOpacity: 0.88
      });

      var tooltipHtml =
        '<div class="tip-name">' + (r.waterName || "Unknown water") + "</div>"
        + '<div class="tip-row"><span class="tip-label">County</span>'  + (r.county  || "—") + "</div>"
        + '<div class="tip-row"><span class="tip-label">Species</span>' + (r.species || "—") + "</div>"
        + '<div class="tip-row"><span class="tip-label">Date</span>'    + formatDateSimple(r.dateStocked) + "</div>";

      marker.bindTooltip(tooltipHtml, {
        direction: "top", offset: [0, -8],
        className: "map-pin-tooltip", opacity: 1,
        permanent: false, interactive: false
      });
      marker.off("mouseover");

      marker.on("mouseover", function () {
        var self = this;
        self._tipTimer = setTimeout(function () { self.openTooltip(); }, 600);
      });
      marker.on("mouseout", function () {
        clearTimeout(this._tipTimer);
        this.closeTooltip();
      });

      _markersLayer.addLayer(marker);
      bounds.push([r.lat, r.lon]);
    });

    if (doFitBounds && bounds.length > 0 && window.innerWidth >= 768) {
      try { _map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 }); }
      catch (e) {}
    }
  }

  /* Update map markers without re-fitting bounds */
  function updateMapMarkers(records) {
    if (!_map) return;
    _addPins(records, false);
  }

  function resizeMap() {
    if (_map) setTimeout(function () { _map.invalidateSize(); }, 50);
  }

  /* ══════════════════════════════════════════════════════════════
     CALENDAR TAB
     ══════════════════════════════════════════════════════════════ */

  function renderCalendar(records, year, month, onDayClick) {
    var grid    = document.getElementById("calendar-grid");
    var titleEl = document.getElementById("cal-title");
    grid.innerHTML = "";

    var monthName = new Date(year, month, 1).toLocaleDateString("en-US", {
      month: "long", year: "numeric"
    });
    if (titleEl) titleEl.textContent = monthName;

    var dayMap = {};
    records.forEach(function (r) {
      if (!r.dateStocked) return;
      var key = String(r.dateStocked).slice(0, 10);
      if (!dayMap[key]) dayMap[key] = [];
      dayMap[key].push(r);
    });

    var firstDay  = new Date(year, month, 1);
    var lastDay   = new Date(year, month + 1, 0);
    var startDow  = firstDay.getDay();
    var totalDays = lastDay.getDate();
    var frag      = document.createDocumentFragment();

    for (var e = 0; e < startDow; e++) {
      var empty = document.createElement("div");
      empty.className = "cal-day empty";
      frag.appendChild(empty);
    }

    for (var day = 1; day <= totalDays; day++) {
      var dateStr = year + "-"
        + String(month + 1).padStart(2, "0") + "-"
        + String(day).padStart(2, "0");

      var cell = document.createElement("div");
      cell.className   = "cal-day";
      cell.textContent = day;

      var dayRecords = dayMap[dateStr] || [];
      if (dayRecords.length > 0) {
        cell.classList.add("has-data");
        (function (ds, dr, el) {
          el.addEventListener("click", function () {
            document.querySelectorAll(".cal-day.selected")
              .forEach(function (c) { c.classList.remove("selected"); });
            el.classList.add("selected");
            onDayClick(ds, dr);
          });
        })(dateStr, dayRecords, cell);
      }
      frag.appendChild(cell);
    }

    grid.appendChild(frag);

    var detail = document.getElementById("calendar-detail");
    if (detail) {
      detail.innerHTML = '<p class="cal-detail-hint">Click a highlighted date to see what was stocked.</p>';
    }
  }

  function renderCalendarDetail(dateStr, dayRecords) {
    var detail = document.getElementById("calendar-detail");
    if (!detail) return;

    var d = parseDateStr(dateStr);
    var heading = d
      ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : dateStr;

    var html =
      '<div class="cal-detail-heading">'
      + heading + " &mdash; "
      + "<strong>" + dayRecords.length + "</strong> stocking"
      + (dayRecords.length !== 1 ? "s" : "")
      + "</div>";

    dayRecords.forEach(function (r) {
      html +=
        '<div class="cal-detail-item">'
        + '<div class="cal-detail-water">' + (r.waterName || "—") + "</div>"
        + '<div class="cal-detail-meta">'
        +   (r.county || "") + (r.county && r.species ? " &bull; " : "")
        +   '<span class="badge ' + badgeClass(r.species) + '">' + (r.species || "—") + "</span>"
        + "</div>"
        + "</div>";
    });

    detail.innerHTML = html;
  }

  /* ── Public API ─────────────────────────────────────────────── */
  return {
    parseDateStr:         parseDateStr,
    badgeClass:           badgeClass,
    showSpinner:          showSpinner,
    hideSpinner:          hideSpinner,
    showError:            showError,
    updateStats:          updateStats,
    populateFilters:      populateFilters,
    getSelectedSpecies:   getSelectedSpecies,
    resetSpeciesFilter:   resetSpeciesFilter,
    buildWaterList:       buildWaterList,
    renderWaterList:      renderWaterList,
    renderWaterDetail:    renderWaterDetail,
    flyTo:                flyTo,
    initMap:              initMap,
    updateMapMarkers:     updateMapMarkers,
    resizeMap:            resizeMap,
    renderCalendar:       renderCalendar,
    renderCalendarDetail: renderCalendarDetail,
    getMoonPhase:         getMoonPhase
  };

})();
