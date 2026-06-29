/**
 * alert-modal.js — standalone alert signup modal for non-app pages
 *
 * Self-contained: fetches the CA water list lazily from the CDFW API
 * the moment the modal first opens (background fetch, no page-load cost).
 * Exports window.openAlertModal(waterName) for any page to call.
 *
 * Does NOT touch app.js or app.html — those pages use their own copy
 * of the modal wired to the already-loaded allRecords dataset.
 */
(function () {

  var SUPA_URL = 'https://usujeptqshjvvmsgdqpe.supabase.co';
  var SUPA_KEY = 'sb_publishable_xL0oywu3JPt2ALS8vu2UIQ_bq3OeMIY';

  var _supa            = null;
  var _modalWater      = null;
  var _modalWaterValid = false;
  var _caWaters        = null;   /* {name, county}[] — loaded lazily  */
  var _loadPromise     = null;

  /* ── Supabase ───────────────────────────────────────────────── */

  function _getSupa() {
    if (!_supa && window.supabase) {
      _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    }
    return _supa;
  }

  /* ── Water list (CDFW, lazy) ────────────────────────────────── */

  var _API = "https://services2.arcgis.com/Uq9r85Potqm3MfRV/arcgis/rest/services/biosds2897_fmu/FeatureServer/0/query";

  function _fetchPage(offset) {
    var url = _API
      + "?where=1%3D1"
      + "&outFields=WaterName%2CCounties"
      + "&orderByFields=WaterName+ASC"
      + "&resultOffset=" + offset
      + "&resultRecordCount=2000"
      + "&f=json";
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (d) {
      if (d.error) throw new Error(d.error.message);
      return d.features.map(function (f) { return f.attributes; });
    });
  }

  function _loadCaWaters() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = _fetchPage(0).then(function (first) {
      var raw = first;
      if (first.length < 2000) return raw;
      return fetch(_API + "?where=1%3D1&returnCountOnly=true&f=json")
        .then(function (r) { return r.json(); })
        .then(function (cd) {
          var total = cd.count || 0;
          var jobs  = [];
          for (var off = 2000; off < total; off += 2000) { jobs.push(_fetchPage(off)); }
          return Promise.all(jobs).then(function (pages) {
            pages.forEach(function (p) { raw = raw.concat(p); });
            return raw;
          });
        });
    }).then(function (raw) {
      var seen   = Object.create(null);
      var waters = [];
      raw.forEach(function (r) {
        var name = (r.WaterName || '').trim();
        if (name && !seen[name]) {
          seen[name] = true;
          waters.push({ name: name, county: (r.Counties || '').trim() });
        }
      });
      waters.sort(function (a, b) { return a.name.localeCompare(b.name); });
      _caWaters = waters;
      return waters;
    }).catch(function (err) {
      console.warn('[alert-modal] water load failed:', err);
      _caWaters  = [];
      _loadPromise = null;   /* allow retry on next open */
    });
    return _loadPromise;
  }

  /* Start background fetch as early as possible */
  _loadCaWaters();

  /* ── Helpers ────────────────────────────────────────────────── */

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _filterWaters(query) {
    if (!query || query.length < 2 || !_caWaters) return [];
    var q   = query.toLowerCase();
    var out = [];
    for (var i = 0; i < _caWaters.length && out.length < 8; i++) {
      if (_caWaters[i].name.toLowerCase().indexOf(q) !== -1) {
        out.push(_caWaters[i]);
      }
    }
    return out;
  }

  function _renderSuggestions(query, results) {
    var el = document.getElementById('alert-water-suggestions');
    if (!el) return;
    if (!results || results.length === 0) {
      if (!query || query.length < 2) {
        el.innerHTML = '';
        el.style.display = 'none';
      } else if (!_caWaters) {
        el.innerHTML = '<div class="alert-suggestion-empty">Loading waters…</div>';
        el.style.display = 'block';
      } else {
        el.innerHTML = '<div class="alert-suggestion-empty">No waters found.</div>';
        el.style.display = 'block';
      }
      return;
    }
    var ql   = query.toLowerCase();
    var html = '';
    results.forEach(function (item) {
      var name = item.name;
      var idx  = name.toLowerCase().indexOf(ql);
      var hi   = idx === -1
        ? _esc(name)
        : _esc(name.slice(0, idx))
            + '<span class="alert-hl">' + _esc(name.slice(idx, idx + query.length)) + '</span>'
            + _esc(name.slice(idx + query.length));
      var loc  = item.county ? _esc(item.county) + ' County, CA' : 'CA';
      html += '<div class="alert-suggestion-item" data-name="' + _esc(name) + '">'
            + '<span class="alert-sug-name">' + hi  + '</span>'
            + '<span class="alert-sug-county">' + loc + '</span>'
            + '</div>';
    });
    el.innerHTML = html;
    el.style.display = 'block';
    el.querySelectorAll('.alert-suggestion-item').forEach(function (row) {
      row.addEventListener('mousedown', function (e) {
        e.preventDefault();
        _selectWater(row.getAttribute('data-name'));
      });
    });
  }

  /* ── Modal state ────────────────────────────────────────────── */

  function _updateSubmitState() {
    var btn = document.getElementById('alert-submit-btn');
    if (!btn) return;
    var email = ((document.getElementById('alert-email-input') || {}).value || '').trim();
    btn.disabled = !(email.indexOf('@') !== -1 && email.length > 5);
  }

  function _selectWater(name) {
    _modalWater      = name;
    _modalWaterValid = true;
    var waterIn  = document.getElementById('alert-water-input');
    var sugEl    = document.getElementById('alert-water-suggestions');
    var errorEl  = document.getElementById('alert-error');
    if (waterIn)  waterIn.value = name;
    if (sugEl)    { sugEl.innerHTML = ''; sugEl.style.display = 'none'; }
    if (errorEl)  errorEl.style.display = 'none';
    _updateSubmitState();
    var emailIn = document.getElementById('alert-email-input');
    if (emailIn) setTimeout(function () { emailIn.focus(); }, 60);
  }

  function openAlertModal(waterName) {
    var overlay  = document.getElementById('alert-modal');
    var stepForm = document.getElementById('alert-step-form');
    var stepDone = document.getElementById('alert-step-done');
    var errorEl  = document.getElementById('alert-error');
    var waterIn  = document.getElementById('alert-water-input');
    var sugEl    = document.getElementById('alert-water-suggestions');
    var emailIn  = document.getElementById('alert-email-input');

    _modalWater      = waterName || null;
    _modalWaterValid = !!waterName;

    if (stepForm) stepForm.style.display = 'block';
    if (stepDone) stepDone.style.display = 'none';
    if (errorEl)  { errorEl.textContent = ''; errorEl.style.display = 'none'; }
    if (emailIn)  emailIn.value = '';
    if (waterIn)  waterIn.value = waterName || '';
    if (sugEl)    { sugEl.innerHTML = ''; sugEl.style.display = 'none'; }

    _updateSubmitState();

    overlay.style.display        = 'block';
    document.body.style.overflow = 'hidden';

    if (waterName) {
      setTimeout(function () { if (emailIn) emailIn.focus(); }, 120);
    } else {
      setTimeout(function () { if (waterIn) waterIn.focus(); }, 120);
    }

    /* Kick off fetch if it somehow didn't start (e.g. CORS cold-start) */
    if (!_caWaters && !_loadPromise) _loadCaWaters();
  }

  function closeAlertModal() {
    var overlay = document.getElementById('alert-modal');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    _modalWater      = null;
    _modalWaterValid = false;
  }

  /* ── Submit ─────────────────────────────────────────────────── */

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

      var waterName = (_modalWaterValid && _modalWater) ? _modalWater : null;

      var result = await supa.rpc('signup_for_alert', {
        p_email:      email,
        p_water_name: waterName,
        p_state:      'CA'
      });

      if (result.error) throw result.error;
      var data = result.data;

      if (data && data.is_new && data.confirmation_token) {
        try {
          await fetch('https://fishstockingalert.com/api/confirm-email', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              email:              email,
              confirmation_token: data.confirmation_token,
              water_name:         waterName
            })
          });
        } catch (_) { /* Worker not deployed yet — continue */ }
      }

      if (stepForm) stepForm.style.display = 'none';
      if (stepDone) stepDone.style.display = 'block';

      if (doneMsg) {
        if (waterName) {
          if (data && data.is_new) {
            doneMsg.innerHTML =
              'Check <strong>' + _esc(email) + '</strong> for a confirmation link. '
              + "Once confirmed, you'll get alerts whenever <strong>"
              + _esc(waterName) + '</strong> is stocked.';
          } else {
            doneMsg.innerHTML =
              '<strong>' + _esc(waterName) + '</strong> has been added to your alert list. '
              + "You'll be notified the next time it's stocked.";
          }
        } else {
          if (data && data.is_new) {
            doneMsg.innerHTML =
              'Check <strong>' + _esc(email) + '</strong> for a confirmation link. '
              + "Once confirmed, you'll get alerts whenever any California water is stocked.";
          } else {
            doneMsg.innerHTML =
              "You're signed up for all California waters. "
              + "You'll be notified whenever a new stocking is reported.";
          }
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

  /* ── Wire DOM events ────────────────────────────────────────── */

  (function () {
    var overlay   = document.getElementById('alert-modal');
    var closeBtn  = document.getElementById('alert-modal-close');
    var doneClose = document.getElementById('alert-done-close');
    var waterIn   = document.getElementById('alert-water-input');
    var submitBtn = document.getElementById('alert-submit-btn');
    var emailIn   = document.getElementById('alert-email-input');

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
        if (_modalWaterValid) {
          _modalWater      = null;
          _modalWaterValid = false;
          _updateSubmitState();
        }
        if (q.length >= 2 && !_caWaters) {
          /* Data still loading — show spinner text, then re-render on resolve */
          var sugEl = document.getElementById('alert-water-suggestions');
          if (sugEl) {
            sugEl.innerHTML = '<div class="alert-suggestion-empty">Loading waters…</div>';
            sugEl.style.display = 'block';
          }
          _loadCaWaters().then(function () {
            if (waterIn.value.trim() === q) {
              _renderSuggestions(q, _filterWaters(q));
            }
          });
        } else {
          _renderSuggestions(q, _filterWaters(q));
        }
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

    if (emailIn) {
      emailIn.addEventListener('input', _updateSubmitState);
      emailIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && submitBtn && !submitBtn.disabled) _submitAlert();
        if (e.key === 'Escape') closeAlertModal();
      });
    }

    if (submitBtn) submitBtn.addEventListener('click', _submitAlert);

    document.addEventListener('keydown', function (e) {
      var modal = document.getElementById('alert-modal');
      if (e.key === 'Escape' && modal && modal.style.display !== 'none') closeAlertModal();
    });
  })();

  window.openAlertModal = openAlertModal;

})();
