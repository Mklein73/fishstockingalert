/**
 * app.js — application coordinator
 *
 * Responsibilities:
 *  - Tab switching (Home / Map / Calendar)
 *  - Shared filter state: filterCounty, filterSearch, filter7days
 *    Both Home and Map tab controls write to the same state variables.
 *    applyFilters() syncs both sets of controls and re-renders both views.
 *  - Water selection and detail panel
 *  - Geolocation
 *  - Calendar
 *  - Dark mode toggle
 */
(function () {

  var activeState = window.CaliforniaState;

  /* ── Shared filter state ────────────────────────────────────── */
  var allRecords        = [];
  var filterCounty      = "";        // synced across Home + Map county selects
  var filterSearch      = "";        // synced across list-search + map-search
  var filter7days       = false;
  var mapReady          = false;
  var calYear           = new Date().getFullYear();
  var calMonth          = new Date().getMonth();
  var selectedWaterName = null;
  var currentWaters     = [];
  var geoCoords         = null;
  var geoActive         = false;

  /* ── Supabase ──────────────────────────────────────────────── */
  var SUPA_URL = 'https://usujeptqshjvmsgdqpe.supabase.co';
  var SUPA_KEY = 'sb_publishable_xL0oywu3JPt2ALS8vu2UIQ_bq3OeMIY';
  var _supa    = null;

  function _getSupa() {
    if (!_supa && window.supabase) {
      _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    }
    return _supa;
  }

  /* ── Alert modal state ──────────────────────────────────────── */
  var _modalWater = null;

  var TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);

  /* ── Haversine ──────────────────────────────────────────────── */

  function haversine(lat1, lon1, lat2, lon2) {
    var R    = 3958.8;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* ── Mobile map layout ──────────────────────────────────────── */

  var _mobileMapListenerAttached = false;

  function _getVH() {
    return (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  }

  function _ensureFooterHidden() {
    if (window.innerWidth >= 768) return;
    var footer = document.querySelector(".site-footer");
    if (!footer) return;
    footer.style.display =
      document.getElementById("view-map").classList.contains("active") ? "none" : "";
  }

  function _onMobileResize() {
    _ensureFooterHidden();
    if (document.getElementById("view-map").classList.contains("active")) {
      setTimeout(_applyMobileMapLayout, 150);
    }
  }

  function _applyMobileMapLayout() {
    var header      = document.querySelector(".site-header");
    var statsBar    = document.getElementById("stats-bar");
    var tabNav      = document.getElementById("tab-nav");
    var viewMap     = document.getElementById("view-map");
    var leafletMap  = document.getElementById("leaflet-map");
    var footer      = document.querySelector(".site-footer");
    var mapControls = document.getElementById("map-controls");

    var vh = _getVH();
    var chromeHeight =
      (header      ? header.offsetHeight      : 0) +
      (statsBar    ? statsBar.offsetHeight    : 0) +
      (tabNav      ? tabNav.offsetHeight      : 0);
    var mapCtrlH = mapControls ? mapControls.offsetHeight : 0;

    document.documentElement.style.height   = vh + "px";
    document.documentElement.style.overflow = "hidden";
    document.body.style.height              = vh + "px";
    document.body.style.overflow            = "hidden";

    /* view-map fills everything below the chrome */
    viewMap.style.height   = (vh - chromeHeight) + "px";
    /* leaflet-map fills view-map minus the filter bar */
    leafletMap.style.width  = "100%";
    leafletMap.style.height = (vh - chromeHeight - mapCtrlH) + "px";

    if (footer) { footer.style.display = "none"; }

    setTimeout(function () { UI.resizeMap(); }, 50);

    if (!_mobileMapListenerAttached) {
      _mobileMapListenerAttached = true;
      window.addEventListener("resize", _onMobileResize);
      window.addEventListener("orientationchange", _onMobileResize);
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", _onMobileResize);
      }
    }
  }

  function _restoreMobileLayout() {
    document.documentElement.style.height   = "";
    document.documentElement.style.overflow = "";
    document.body.style.height              = "";
    document.body.style.overflow            = "";

    var viewMap    = document.getElementById("view-map");
    var leafletMap = document.getElementById("leaflet-map");
    var footer     = document.querySelector(".site-footer");

    viewMap.style.height    = "";
    leafletMap.style.width  = "";
    leafletMap.style.height = "";

    if (footer) { footer.style.display = ""; }
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
      if (window.innerWidth < 768) { _applyMobileMapLayout(); }
      if (!mapReady) {
        mapReady = true;
        UI.initMap(getFilteredMapRecords());
      } else {
        UI.updateMapMarkers(getFilteredMapRecords());
        UI.resizeMap();
      }
    } else {
      if (window.innerWidth < 768) { _restoreMobileLayout(); }
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
    openAlertModal(null);
  });

  /* ── Dark mode ──────────────────────────────────────────────── */

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

  /* ── Build filtered water list for the Home tab ─────────────── */

  function getDeduped() {
    var county          = filterCounty;
    var selectedSpecies = UI.getSelectedSpecies();
    var search          = filterSearch.toLowerCase();
    var cutoff          = filter7days ? new Date(TODAY.getTime() - 7 * 86400000) : null;

    var filtered = allRecords.filter(function (r) {
      if (county && r.county !== county) return false;
      if (selectedSpecies !== null && selectedSpecies.size > 0 && !selectedSpecies.has(r.species)) return false;
      if (cutoff) {
        var d = UI.parseDateStr(r.dateStocked);
        if (!d || d < cutoff) return false;
      }
      return true;
    });

    var waters = UI.buildWaterList(filtered);

    if (search) {
      waters = waters.filter(function (w) {
        return (w.waterName || "").toLowerCase().includes(search);
      });
    }

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

      var withCoords = waters.filter(function (w) { return w.distanceMiles !== null; });
      if (withCoords.length === 0) return { waters: [], nearestOnly: false };
      withCoords.sort(function (a, b) { return a.distanceMiles - b.distanceMiles; });
      return { waters: [withCoords[0]], nearestOnly: true };
    }

    return { waters: waters, nearestOnly: false };
  }

  /* ── Build filtered records for the Map tab ─────────────────── */

  function getFilteredMapRecords() {
    var selectedSpecies = UI.getSelectedSpecies();
    var search          = filterSearch.toLowerCase();
    var cutoff          = filter7days ? new Date(TODAY.getTime() - 7 * 86400000) : null;

    return allRecords.filter(function (r) {
      if (filterCounty && r.county !== filterCounty) return false;
      if (selectedSpecies !== null && selectedSpecies.size > 0 && !selectedSpecies.has(r.species)) return false;
      if (cutoff) {
        var d = UI.parseDateStr(r.dateStocked);
        if (!d || d < cutoff) return false;
      }
      if (search && !(r.waterName || "").toLowerCase().includes(search)) return false;
      return true;
    });
  }

  /* ── Select a water ─────────────────────────────────────────── */

  function selectWater(waterName, waters) {
    selectedWaterName = waterName;
    var waterObj = (waters || currentWaters).find(function (w) {
      return w.waterName === waterName;
    });

    document.querySelectorAll(".water-card").forEach(function (card) {
      card.classList.toggle("selected", card.dataset.water === waterName);
    });

    var sel = document.querySelector(".water-card.selected");
    if (sel) sel.scrollIntoView({ block: "nearest", behavior: "smooth" });

    UI.renderWaterDetail(waterObj, function (lat, lon) {
      switchTab("map");
      setTimeout(function () { UI.flyTo(lat, lon, 13); }, 150);
    });
  }

  /* ── Apply all filters and sync both tabs ───────────────────── */

  function applyFilters() {
    /* Sync county dropdowns */
    var listCountyEl = document.getElementById("filter-county");
    var mapCountyEl  = document.getElementById("map-filter-county");
    if (listCountyEl && listCountyEl.value !== filterCounty) listCountyEl.value = filterCounty;
    if (mapCountyEl  && mapCountyEl.value  !== filterCounty) mapCountyEl.value  = filterCounty;

    /* Sync search inputs */
    var listSearchEl = document.getElementById("list-search");
    var mapSearchEl  = document.getElementById("map-search");
    if (listSearchEl && listSearchEl.value !== filterSearch) listSearchEl.value = filterSearch;
    if (mapSearchEl  && mapSearchEl.value  !== filterSearch) mapSearchEl.value  = filterSearch;

    /* Re-render Home tab list */
    applyListFilters();

    /* Re-render Map tab markers (if map has been opened) */
    if (mapReady) {
      UI.updateMapMarkers(getFilteredMapRecords());
    }
  }

  function applyListFilters() {
    var result    = getDeduped();
    var waters    = result.waters;
    currentWaters = waters;

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

    UI.renderWaterList(waters, selectedWaterName);

    document.querySelectorAll(".water-card").forEach(function (card) {
      card.addEventListener("click", function () {
        selectWater(card.dataset.water, waters);
      });
    });

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

  /* ── Geolocation ────────────────────────────────────────────── */

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
          applyFilters();
        },
        function () {
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
      applyFilters();
    });
  }

  /* ── Filter event listeners — Home tab ──────────────────────── */

  document.getElementById("filter-county").addEventListener("change", function () {
    filterCounty = this.value;
    applyFilters();
  });

  var listSearch = document.getElementById("list-search");
  if (listSearch) {
    listSearch.addEventListener("input", function () {
      filterSearch = this.value.trim();
      applyFilters();
    });
  }

  document.getElementById("btn-7days").addEventListener("click", function () {
    filter7days = !filter7days;
    this.classList.toggle("active", filter7days);
    applyFilters();
  });

  document.getElementById("reset-btn").addEventListener("click", function () {
    filterCounty = "";
    filterSearch = "";
    filter7days  = false;
    UI.resetSpeciesFilter();
    document.getElementById("btn-7days").classList.remove("active");
    applyFilters();
  });

  /* ── Filter event listeners — Map tab ───────────────────────── */

  var mapCountyEl = document.getElementById("map-filter-county");
  if (mapCountyEl) {
    mapCountyEl.addEventListener("change", function () {
      filterCounty = this.value;
      applyFilters();
    });
  }

  var mapSearchEl = document.getElementById("map-search");
  if (mapSearchEl) {
    mapSearchEl.addEventListener("input", function () {
      filterSearch = this.value.trim();
      applyFilters();
    });
  }

  var mapResetBtn = document.getElementById("map-reset-btn");
  if (mapResetBtn) {
    mapResetBtn.addEventListener("click", function () {
      filterCounty = "";
      filterSearch = "";
      filter7days  = false;
      UI.resetSpeciesFilter();
      document.getElementById("btn-7days").classList.remove("active");
      applyFilters();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     ALERT SIGNUP MODAL
     ══════════════════════════════════════════════════════════════ */

  function _filterWatersForModal(query) {
    if (!query) return [];
    var q = query.toLowerCase();
    var seen = {};
    var results = [];
    allRecords.forEach(function (r) {
      if (!r.waterName || seen[r.waterName]) return;
      if (r.waterName.toLowerCase().indexOf(q) !== -1) {
        seen[r.waterName] = true;
        results.push(r.waterName);
      }
    });
    return results.slice(0, 8);
  }

  function _renderWaterSuggestions(query, names) {
    var suggestEl = document.getElementById('alert-water-suggestions');
    if (!suggestEl) return;
    if (!query) {
      suggestEl.innerHTML = '';
      suggestEl.style.display = 'none';
      return;
    }
    if (!names || names.length === 0) {
      suggestEl.innerHTML = '<div class="alert-suggestion-empty">No waters found — try a different name.</div>';
      suggestEl.style.display = 'block';
      return;
    }
    var html = '';
    names.forEach(function (name) {
      html += '<div class="alert-suggestion-item">' + name + '</div>';
    });
    suggestEl.innerHTML = html;
    suggestEl.style.display = 'block';
    suggestEl.querySelectorAll('.alert-suggestion-item').forEach(function (item) {
      item.addEventListener('click', function () {
        _selectWaterInModal(item.textContent);
      });
    });
  }

  function _selectWaterInModal(waterName) {
    _modalWater = waterName;
    var stepWater  = document.getElementById('alert-step-water');
    var stepEmail  = document.getElementById('alert-step-email');
    var waterDisp  = document.getElementById('alert-water-display');
    var emailInput = document.getElementById('alert-email-input');
    var errorEl    = document.getElementById('alert-error');
    if (stepWater)  stepWater.style.display  = 'none';
    if (stepEmail)  stepEmail.style.display  = 'block';
    if (waterDisp)  waterDisp.textContent    = waterName;
    if (errorEl)    errorEl.style.display    = 'none';
    setTimeout(function () { if (emailInput) emailInput.focus(); }, 80);
  }

  function openAlertModal(waterName) {
    var overlay     = document.getElementById('alert-modal');
    var stepWater   = document.getElementById('alert-step-water');
    var stepEmail   = document.getElementById('alert-step-email');
    var stepDone    = document.getElementById('alert-step-done');
    var waterDisp   = document.getElementById('alert-water-display');
    var emailInput  = document.getElementById('alert-email-input');
    var errorEl     = document.getElementById('alert-error');
    var searchInput = document.getElementById('alert-water-search');
    var suggestEl   = document.getElementById('alert-water-suggestions');
    var submitBtn   = document.getElementById('alert-submit-btn');

    _modalWater = waterName || null;

    if (errorEl)   { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    if (emailInput) emailInput.value = '';
    if (submitBtn)  { submitBtn.disabled = false; submitBtn.textContent = 'Get Free Alerts'; }

    if (_modalWater) {
      if (stepWater) stepWater.style.display = 'none';
      if (stepEmail) stepEmail.style.display = 'block';
      if (stepDone)  stepDone.style.display  = 'none';
      if (waterDisp) waterDisp.textContent = _modalWater;
      setTimeout(function () { if (emailInput) emailInput.focus(); }, 120);
    } else {
      if (stepWater) stepWater.style.display = 'block';
      if (stepEmail) stepEmail.style.display = 'none';
      if (stepDone)  stepDone.style.display  = 'none';
      if (searchInput) searchInput.value = '';
      if (suggestEl)   { suggestEl.innerHTML = ''; suggestEl.style.display = 'none'; }
      setTimeout(function () { if (searchInput) searchInput.focus(); }, 120);
    }

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeAlertModal() {
    var overlay = document.getElementById('alert-modal');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    _modalWater = null;
  }

  async function _submitAlert() {
    var emailEl   = document.getElementById('alert-email-input');
    var errorEl   = document.getElementById('alert-error');
    var submitBtn = document.getElementById('alert-submit-btn');
    var stepEmail = document.getElementById('alert-step-email');
    var stepDone  = document.getElementById('alert-step-done');
    var doneMsg   = document.getElementById('alert-done-msg');

    var email = emailEl ? emailEl.value.trim() : '';

    if (!email || email.indexOf('@') === -1) {
      if (errorEl) { errorEl.textContent = 'Please enter a valid email address.'; errorEl.style.display = 'block'; }
      return;
    }
    if (!_modalWater) {
      if (errorEl) { errorEl.textContent = 'Please select a water first.'; errorEl.style.display = 'block'; }
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing you up…'; }
    if (errorEl)   errorEl.style.display = 'none';

    try {
      var supa = _getSupa();
      if (!supa) throw new Error('Could not connect. Please try again.');

      var result = await supa.rpc('signup_for_alert', {
        p_email:      email,
        p_water_name: _modalWater,
        p_state:      'CA'
      });

      if (result.error) throw result.error;

      var data = result.data;

      /* Fire confirmation email — silently skip if Cloudflare Worker not live yet */
      if (data && data.is_new && data.confirmation_token) {
        try {
          await fetch('https://fishstockingalert.com/api/confirm-email', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              email:              email,
              confirmation_token: data.confirmation_token,
              water_name:         _modalWater
            })
          });
        } catch (_) { /* Worker not deployed yet — continue */ }
      }

      if (stepEmail) stepEmail.style.display = 'none';
      if (stepDone)  stepDone.style.display  = 'block';

      if (doneMsg) {
        if (data && data.is_new) {
          doneMsg.innerHTML =
            'Check <strong>' + email + '</strong> for a confirmation link. '
            + "Once confirmed, you'll get alerts whenever <strong>"
            + _modalWater + '</strong> is stocked.';
        } else {
          doneMsg.innerHTML =
            '<strong>' + _modalWater + '</strong> has been added to your alert list. '
            + "You'll be notified the next time it's stocked.";
        }
      }

    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Something went wrong. Please try again.';
        errorEl.style.display = 'block';
      }
      console.error('[alert signup]', err);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Get Free Alerts'; }
    }
  }

  /* ── Modal event listeners ──────────────────────────────────── */
  (function () {
    var overlay    = document.getElementById('alert-modal');
    var closeBtn   = document.getElementById('alert-modal-close');
    var doneClose  = document.getElementById('alert-done-close');
    var searchIn   = document.getElementById('alert-water-search');
    var submitBtn  = document.getElementById('alert-submit-btn');
    var emailInput = document.getElementById('alert-email-input');

    if (closeBtn)  closeBtn.addEventListener('click', closeAlertModal);
    if (doneClose) doneClose.addEventListener('click', closeAlertModal);

    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeAlertModal();
      });
    }

    if (searchIn) {
      searchIn.addEventListener('input', function () {
        var q = this.value.trim();
        _renderWaterSuggestions(q, _filterWatersForModal(q));
      });
      searchIn.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAlertModal();
      });
    }

    if (emailInput) {
      emailInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter')  _submitAlert();
        if (e.key === 'Escape') closeAlertModal();
      });
    }

    if (submitBtn) submitBtn.addEventListener('click', _submitAlert);

    document.addEventListener('keydown', function (e) {
      var modal = document.getElementById('alert-modal');
      if (e.key === 'Escape' && modal && modal.style.display !== 'none') closeAlertModal();
    });
  })();

  /* ── Data loading ───────────────────────────────────────────── */

  async function loadData() {
    UI.showSpinner("Loading stocking data for " + activeState.name + "…");
    try {
      var records = await activeState.fetchData();
      allRecords  = records;

      UI.updateStats(records, activeState.name);
      UI.populateFilters(records, applyFilters);
      UI.hideSpinner();

      document.getElementById("tab-nav").style.display = "flex";
      switchTab("list");
      applyListFilters();

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
  window.openAlertModal = openAlertModal;

  document.addEventListener("DOMContentLoaded", _ensureFooterHidden);
  window.addEventListener("resize", _ensureFooterHidden);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", _ensureFooterHidden);
  }

})();
