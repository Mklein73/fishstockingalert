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

  var activeState = window._FSA_STATE || window.CaliforniaState;

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
  var SUPA_URL = 'https://usujeptqshjvvmsgdqpe.supabase.co';
  var SUPA_KEY = 'sb_publishable_xL0oywu3JPt2ALS8vu2UIQ_bq3OeMIY';
  var _supa    = null;

  function _getSupa() {
    if (!_supa && window.supabase) {
      _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    }
    return _supa;
  }

  /* ── Alert modal state ──────────────────────────────────────── */
  var _selectedWaters = []; /* string[] — water names chosen so far */

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
    var footer = document.querySelector(".data-footer");
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
    var footer      = document.querySelector(".data-footer");
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
    var footer     = document.querySelector(".data-footer");

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
        UI.resizeMap();
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

  var MOON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>';
  var SUN_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

  function updateDarkIcon() {
    darkBtn.innerHTML = document.documentElement.classList.contains("dark-mode") ? SUN_SVG : MOON_SVG;
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

  var btn7days = document.getElementById("btn-7days");
  if (btn7days) {
    btn7days.addEventListener("click", function () {
      filter7days = !filter7days;
      this.classList.toggle("active", filter7days);
      applyFilters();
    });
  }

  document.getElementById("reset-btn").addEventListener("click", function () {
    filterCounty = "";
    filterSearch = "";
    filter7days  = false;
    UI.resetSpeciesFilter();
    var b7 = document.getElementById("btn-7days");
    if (b7) b7.classList.remove("active");
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
      var b7m = document.getElementById("btn-7days");
      if (b7m) b7m.classList.remove("active");
      applyFilters();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     ALERT SIGNUP MODAL
     ══════════════════════════════════════════════════════════════ */

  function _escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _filterWatersForModal(query) {
    if (!query || query.length < 2) return [];
    var q    = query.toLowerCase();
    var seen = {};
    var out  = [];
    allRecords.forEach(function (r) {
      if (!r.waterName || seen[r.waterName]) return;
      if (_selectedWaters.indexOf(r.waterName) !== -1) return; /* already a tag */
      if (r.waterName.toLowerCase().indexOf(q) !== -1) {
        seen[r.waterName] = true;
        out.push({ name: r.waterName, county: r.county || '' });
      }
    });
    return out.slice(0, 8);
  }

  function _renderWaterSuggestions(query, results) {
    var suggestEl = document.getElementById('alert-water-suggestions');
    if (!suggestEl) return;
    if (!results || results.length === 0) {
      if (!query || query.length < 2) {
        suggestEl.innerHTML = '';
        suggestEl.style.display = 'none';
      } else {
        suggestEl.innerHTML = '<div class="alert-suggestion-empty">No waters found.</div>';
        suggestEl.style.display = 'block';
      }
      return;
    }
    var ql   = query.toLowerCase();
    var html = '';
    results.forEach(function (item) {
      var name = item.name;
      var idx  = name.toLowerCase().indexOf(ql);
      var highlighted = idx === -1
        ? _escHtml(name)
        : _escHtml(name.slice(0, idx))
            + '<span class="alert-hl">' + _escHtml(name.slice(idx, idx + query.length)) + '</span>'
            + _escHtml(name.slice(idx + query.length));
      var _stAbbr = (window._FSA_CONFIG && window._FSA_CONFIG.stateAbbr) || 'CA';
      var county = item.county ? _escHtml(item.county) + ' County, ' + _stAbbr : _stAbbr;
      html += '<div class="alert-suggestion-item" data-name="' + _escHtml(item.name) + '">'
            + '<span class="alert-sug-name">' + highlighted + '</span>'
            + '<span class="alert-sug-county">' + county + '</span>'
            + '</div>';
    });
    suggestEl.innerHTML = html;
    suggestEl.style.display = 'block';
    suggestEl.querySelectorAll('.alert-suggestion-item').forEach(function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        _addWaterToModal(el.getAttribute('data-name'));
      });
    });
  }

  function _updateSubmitState() {
    var btn = document.getElementById('alert-submit-btn');
    if (!btn) return;
    var email = ((document.getElementById('alert-email-input') || {}).value || '').trim();
    btn.disabled = !(email.indexOf('@') !== -1 && email.length > 5);
  }

  function _renderTagsInModal() {
    var wrap = document.getElementById('alert-tags-wrap');
    if (!wrap) return;
    if (_selectedWaters.length === 0) {
      wrap.innerHTML = '';
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'flex';
    var html = '';
    _selectedWaters.forEach(function (name) {
      html += '<span class="alert-tag">'
            + '<span class="alert-tag-name">' + _escHtml(name) + '</span>'
            + '<button class="alert-tag-remove" type="button" data-name="' + _escHtml(name) + '" aria-label="Remove ' + _escHtml(name) + '">×</button>'
            + '</span>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.alert-tag-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = btn.getAttribute('data-name');
        _selectedWaters = _selectedWaters.filter(function (w) { return w !== n; });
        _renderTagsInModal();
      });
    });
  }

  function _addWaterToModal(name) {
    if (_selectedWaters.indexOf(name) !== -1) return; /* already selected */
    _selectedWaters.push(name);
    _renderTagsInModal();
    var waterIn   = document.getElementById('alert-water-input');
    var suggestEl = document.getElementById('alert-water-suggestions');
    var errorEl   = document.getElementById('alert-error');
    if (waterIn)   { waterIn.value = ''; waterIn.focus(); }
    if (suggestEl) { suggestEl.innerHTML = ''; suggestEl.style.display = 'none'; }
    if (errorEl)   errorEl.style.display = 'none';
  }

  function openAlertModal(waterName) {
    var overlay    = document.getElementById('alert-modal');
    var stepForm   = document.getElementById('alert-step-form');
    var stepDone   = document.getElementById('alert-step-done');
    var errorEl    = document.getElementById('alert-error');
    var waterIn    = document.getElementById('alert-water-input');
    var suggestEl  = document.getElementById('alert-water-suggestions');
    var emailInput = document.getElementById('alert-email-input');

    _selectedWaters = waterName ? [waterName] : [];

    if (stepForm)   stepForm.style.display  = 'block';
    if (stepDone)   stepDone.style.display  = 'none';
    if (errorEl)    { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    if (emailInput) emailInput.value = '';
    if (waterIn)    waterIn.value = '';
    if (suggestEl)  { suggestEl.innerHTML = ''; suggestEl.style.display = 'none'; }

    _renderTagsInModal();
    _updateSubmitState();

    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';

    setTimeout(function () {
      if (waterName) {
        if (emailInput) emailInput.focus();
      } else {
        if (waterIn) waterIn.focus();
      }
    }, 120);
  }

  function closeAlertModal() {
    var overlay = document.getElementById('alert-modal');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    _selectedWaters = [];
  }

  async function _submitAlert() {
    var emailEl   = document.getElementById('alert-email-input');
    var errorEl   = document.getElementById('alert-error');
    var submitBtn = document.getElementById('alert-submit-btn');
    var stepForm  = document.getElementById('alert-step-form');
    var stepDone  = document.getElementById('alert-step-done');
    var doneMsg   = document.getElementById('alert-done-msg');

    var email = emailEl ? emailEl.value.trim() : '';

    if (!email || email.indexOf('@') === -1) {
      if (errorEl) { errorEl.textContent = 'Please enter a valid email address.'; errorEl.style.display = 'block'; }
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing you up…'; }
    if (errorEl)   errorEl.style.display = 'none';

    try {
      var supa = _getSupa();
      if (!supa) throw new Error('Could not connect. Please try again.');

      /* One row per selected water; __ALL__ sentinel if none selected (matches any stocking) */
      var watersToSign = _selectedWaters.length > 0 ? _selectedWaters : ['__ALL__'];
      var firstIsNew   = false;
      var firstToken   = null;

      for (var i = 0; i < watersToSign.length; i++) {
        var result = await supa.rpc('signup_for_alert', {
          p_email:      email,
          p_water_name: watersToSign[i],
          p_state:      (window._FSA_CONFIG && window._FSA_CONFIG.stateAbbr) || 'CA'
        });
        if (result.error) throw result.error;
        if (i === 0 && result.data && result.data.is_new) {
          firstIsNew = true;
          firstToken = result.data.confirmation_token || null;
        }
      }

      /* Fire confirmation email — silently skip if Cloudflare Worker not live yet */
      if (firstIsNew && firstToken) {
        try {
          await fetch('https://fishstockingalert.com/api/confirm-email', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              email:              email,
              confirmation_token: firstToken,
              water_name:         watersToSign[0] === '__ALL__' ? null : watersToSign[0]
            })
          });
        } catch (_) { /* Worker not deployed yet — continue */ }
      }

      if (stepForm) stepForm.style.display = 'none';
      if (stepDone) stepDone.style.display = 'block';

      if (doneMsg) {
        if (_selectedWaters.length > 0) {
          var names = _selectedWaters.map(function (n) {
            return '<strong>' + _escHtml(n) + '</strong>';
          }).join(', ');
          doneMsg.innerHTML = "You're signed up! We'll email you when "
            + names + ' ' + (_selectedWaters.length === 1 ? 'is' : 'are') + ' stocked.';
        } else {
          doneMsg.innerHTML = "You're signed up! We'll email you when any " + activeState.name + " water is stocked.";
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
    var waterIn    = document.getElementById('alert-water-input');
    var submitBtn  = document.getElementById('alert-submit-btn');
    var emailInput = document.getElementById('alert-email-input');

    if (closeBtn)  closeBtn.addEventListener('click', closeAlertModal);
    if (doneClose) doneClose.addEventListener('click', closeAlertModal);

    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeAlertModal();
      });
    }

    if (waterIn) {
      waterIn.addEventListener('input', function () {
        var q = this.value.trim();
        _renderWaterSuggestions(q, _filterWatersForModal(q));
      });
      waterIn.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAlertModal();
      });
      waterIn.addEventListener('blur', function () {
        setTimeout(function () {
          var s = document.getElementById('alert-water-suggestions');
          if (s) { s.innerHTML = ''; s.style.display = 'none'; }
        }, 200);
      });
    }

    if (emailInput) {
      emailInput.addEventListener('input', _updateSubmitState);
      emailInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !submitBtn.disabled) _submitAlert();
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
