/**
 * app.js — application coordinator
 *
 * Responsibilities:
 *  - Tab switching (List / Map / Calendar)
 *  - List view: filter state, deduplication, water selection, geolocation
 *  - Map tab: lazy initialization, flyTo from detail panel
 *  - Calendar tab: month navigation
 *  - Dark mode toggle
 */
(function () {

  var activeState = window.CaliforniaState;

  /* ── App state ──────────────────────────────────────────────── */
  var allRecords        = [];
  var filter7days       = false;
  var mapReady          = false;
  var calYear           = new Date().getFullYear();
  var calMonth          = new Date().getMonth();
  var selectedWaterName = null;   // waterName of currently highlighted card
  var currentWaters     = [];     // deduplicated list after filters
  var geoCoords         = null;   // { lat, lon } when permission granted
  var geoActive         = false;  // true while geo filter is applied

  var TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);

  /* ── Haversine distance (miles) ─────────────────────────────── */

  function haversine(lat1, lon1, lat2, lon2) {
    var R    = 3958.8; // Earth radius in miles
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* ── Tab switching ──────────────────────────────────────────── */

  function switchTab(name) {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === name);
    });
    document.querySelectorAll(".view-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.id === "view-" + name);
    });

    if (name === "map") {
      if (!mapReady) {
        mapReady = true;
        UI.initMap(allRecords);
      } else {
        UI.resizeMap();
      }
    }

    if (name === "calendar") {
      UI.renderCalendar(allRecords, calYear, calMonth, onCalendarDayClick);
    }
  }

  /* ── Calendar ───────────────────────────────────────────────── */

  function onCalendarDayClick(dateStr, dayRecords) {
    UI.renderCalendarDetail(dateStr, dayRecords);
  }

  document.getElementById("cal-prev").addEventListener("click", function () {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    UI.renderCalendar(allRecords, calYear, calMonth, onCalendarDayClick);
  });

  document.getElementById("cal-next").addEventListener("click", function () {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    UI.renderCalendar(allRecords, calYear, calMonth, onCalendarDayClick);
  });

  /* ── Tab buttons ────────────────────────────────────────────── */

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
  });

  /* ── Get Alerts button ──────────────────────────────────────── */

  document.getElementById("btn-get-alerts").addEventListener("click", function () {
    alert("Email alerts are coming soon! Check back shortly.");
  });

  /* ── Dark mode toggle ───────────────────────────────────────── */

  var darkBtn = document.getElementById("btn-dark-mode");

  function updateDarkIcon() {
    var isDark = document.documentElement.classList.contains("dark-mode");
    darkBtn.textContent = isDark ? "☀️" : "🌙";
  }

  updateDarkIcon();

  darkBtn.addEventListener("click", function () {
    var isDark = document.documentElement.classList.toggle("dark-mode");
    localStorage.setItem("fsa-theme", isDark ? "dark" : "light");
    updateDarkIcon();
  });

  /* ── Build filtered + deduplicated water list ───────────────── */

  function getDeduped() {
    var county          = document.getElementById("filter-county").value;
    var selectedSpecies = UI.getSelectedSpecies(); // null = all; Set = specific species
    var searchEl = document.getElementById("list-search");
    var search   = searchEl ? searchEl.value.trim().toLowerCase() : "";
    var cutoff   = filter7days ? new Date(TODAY.getTime() - 7 * 86400000) : null;

    // Apply county / species / date filters to raw records
    var filtered = allRecords.filter(function (r) {
      if (county && r.county !== county) return false;
      if (selectedSpecies !== null && selectedSpecies.size > 0 && !selectedSpecies.has(r.species)) return false;
      if (cutoff) {
        var d = UI.parseDateStr(r.dateStocked);
        if (!d || d < cutoff) return false;
      }
      return true;
    });

    // Deduplicate by water name (newest event per water)
    var waters = UI.buildWaterList(filtered);

    // Apply water-name search against the deduped list
    if (search) {
      waters = waters.filter(function (w) {
        return (w.waterName || "").toLowerCase().includes(search);
      });
    }

    // Geo filter
    if (geoActive && geoCoords) {
      waters.forEach(function (w) {
        w.distanceMiles = (w.lat && w.lon)
          ? haversine(geoCoords.lat, geoCoords.lon, w.lat, w.lon)
          : null;
      });

      var within = waters.filter(function (w) {
        return w.distanceMiles !== null && w.distanceMiles <= 100;
      });

      if (within.length > 0) {
        within.sort(function (a, b) { return a.distanceMiles - b.distanceMiles; });
        return { waters: within, nearestOnly: false };
      }

      // Nothing within 100 miles — show the single nearest water
      var withCoords = waters.filter(function (w) { return w.distanceMiles !== null; });
      if (withCoords.length === 0) return { waters: [], nearestOnly: false };
      withCoords.sort(function (a, b) { return a.distanceMiles - b.distanceMiles; });
      return { waters: [withCoords[0]], nearestOnly: true };
    }

    return { waters: waters, nearestOnly: false };
  }

  /* ── Select a water and render the detail panel ─────────────── */

  function selectWater(waterName, waters) {
    selectedWaterName = waterName;
    var waterObj = (waters || currentWaters).find(function (w) {
      return w.waterName === waterName;
    });

    // Update selected highlight in left panel
    document.querySelectorAll(".water-card").forEach(function (card) {
      card.classList.toggle("selected", card.dataset.water === waterName);
    });

    // Scroll selected card into view
    var sel = document.querySelector(".water-card.selected");
    if (sel) sel.scrollIntoView({ block: "nearest", behavior: "smooth" });

    // Render the right panel
    UI.renderWaterDetail(waterObj, function (lat, lon) {
      // "Open in full map" callback
      switchTab("map");
      setTimeout(function () { UI.flyTo(lat, lon, 13); }, 150);
    });
  }

  /* ── Apply all filters and re-render the left panel ─────────── */

  function applyListFilters() {
    var result        = getDeduped();
    var waters        = result.waters;
    currentWaters     = waters;

    // Update geo UI
    var noResultsBanner = document.getElementById("geo-no-results-banner");
    var geoActiveText   = document.getElementById("geo-active-text");

    if (noResultsBanner) {
      noResultsBanner.style.display = result.nearestOnly ? "block" : "none";
    }

    if (geoActive && geoActiveText) {
      geoActiveText.textContent = result.nearestOnly
        ? "📍 Nearest water to you"
        : "📍 Waters near you · " + waters.length + " result" + (waters.length !== 1 ? "s" : "");
    }

    // Render left-panel cards
    UI.renderWaterList(waters, selectedWaterName);

    // Wire up card click handlers after render
    document.querySelectorAll(".water-card").forEach(function (card) {
      card.addEventListener("click", function () {
        selectWater(card.dataset.water, waters);
      });
    });

    // Auto-select: keep current selection if still in list; else select first
    var stillExists = waters.some(function (w) { return w.waterName === selectedWaterName; });
    if (!stillExists) {
      if (waters.length > 0) {
        selectWater(waters[0].waterName, waters);
      } else {
        selectedWaterName = null;
        UI.renderWaterDetail(null, null);
      }
    }
  }

  /* ── Geolocation handlers ───────────────────────────────────── */

  var geoBanner    = document.getElementById("geo-banner");
  var geoAllowBtn  = document.getElementById("geo-allow-btn");
  var geoSkipBtn   = document.getElementById("geo-skip-btn");
  var geoActiveBar = document.getElementById("geo-active-bar");
  var geoClearBtn  = document.getElementById("geo-clear-btn");

  if (geoAllowBtn) {
    geoAllowBtn.addEventListener("click", function () {
      if (!navigator.geolocation) {
        if (geoBanner) geoBanner.style.display = "none";
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          geoCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          geoActive = true;
          if (geoBanner)    geoBanner.style.display    = "none";
          if (geoActiveBar) geoActiveBar.style.display = "flex";
          applyListFilters();
        },
        function () {
          // Permission denied or position unavailable — just hide the banner
          if (geoBanner) geoBanner.style.display = "none";
        }
      );
    });
  }

  if (geoSkipBtn) {
    geoSkipBtn.addEventListener("click", function () {
      if (geoBanner) geoBanner.style.display = "none";
    });
  }

  if (geoClearBtn) {
    geoClearBtn.addEventListener("click", function (e) {
      e.preventDefault();
      geoActive = false;
      geoCoords = null;
      if (geoActiveBar) geoActiveBar.style.display = "none";
      if (geoBanner)    geoBanner.style.display    = "flex";
      var noRes = document.getElementById("geo-no-results-banner");
      if (noRes) noRes.style.display = "none";
      applyListFilters();
    });
  }

  /* ── Filter event listeners ─────────────────────────────────── */

  document.getElementById("filter-county").addEventListener("change", applyListFilters);

  var listSearch = document.getElementById("list-search");
  if (listSearch) listSearch.addEventListener("input", applyListFilters);

  document.getElementById("btn-7days").addEventListener("click", function () {
    filter7days = !filter7days;
    document.getElementById("btn-7days").classList.toggle("active", filter7days);
    applyListFilters();
  });

  document.getElementById("reset-btn").addEventListener("click", function () {
    document.getElementById("filter-county").value = "";
    UI.resetSpeciesFilter();
    if (listSearch) listSearch.value = "";
    filter7days = false;
    document.getElementById("btn-7days").classList.remove("active");
    applyListFilters();
  });

  /* ── Data loading ───────────────────────────────────────────── */

  async function loadData() {
    UI.showSpinner("Loading stocking data for " + activeState.name + "…");
    try {
      var records = await activeState.fetchData();
      allRecords  = records;

      UI.updateStats(records, activeState.name);
      UI.populateFilters(records, applyListFilters);
      UI.hideSpinner();

      document.getElementById("tab-nav").style.display = "flex";
      switchTab("list");
      applyListFilters();

      // Update footer source link to match active state
      var link = document.getElementById("source-link");
      if (link) {
        link.href        = activeState.sourceUrl;
        link.textContent = activeState.sourceLabel;
      }

    } catch (err) {
      UI.hideSpinner();
      UI.showError(
        "Could not load data for " + activeState.name + ": "
        + err.message + " — Please try refreshing the page."
      );
    }
  }

  loadData();

})();
