(function () {
  var el = document.getElementById('site-footer');
  if (!el) return;

  var variant = el.getAttribute('data-footer-variant') || 'home';
  var copyKey = el.getAttribute('data-footer-copy') || '';

  /* Path prefix: blog sub-pages need ../ for root-level hrefs */
  var inBlog = window.location.pathname.indexOf('/blog/') !== -1;
  var r = inBlog ? '../' : '';

  /* Inject Ko-fi button CSS (all other footer CSS already present per page) */
  var s = document.createElement('style');
  s.textContent =
    '.footer-kofi-wrap{text-align:center;margin:0.35rem 0}' +
    '.footer-kofi{display:inline-flex;align-items:center;gap:0.35rem;color:#64748b;text-decoration:none;font-size:0.82rem;font-weight:500;transition:color 0.15s}' +
    '.footer-kofi:hover{color:#94a3b8}' +
    '.footer-kofi svg{flex-shrink:0}';
  document.head.appendChild(s);

  /* Ko-fi support button — muted, no competing with Get Alerts */
  var kofi =
    '<div class="footer-kofi-wrap">' +
    '<a href="https://ko-fi.com/mklein1973" target="_blank" rel="noopener" class="footer-kofi">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
    '</svg>' +
    'Support this site' +
    '</a>' +
    '</div>';

  var html;

  if (variant === 'home') {
    html =
      '<footer class="home-footer">' +
      '<div class="footer-inner">' +
      '<div class="footer-brand">' +
      '<span class="footer-logo-icon">🐟</span>' +
      '<span class="footer-logo-text">Fish Stocking <strong>Alert</strong></span>' +
      '</div>' +
      '<div class="footer-links">' +
      '<a href="' + r + 'app.html">Data View</a>' +
      (inBlog ? '<a href="index.html">Blog</a>' : '<a href="blog/index.html">Blog</a>') +
      '<a href="' + r + 'contact.html">Contact</a>' +
      '<a href="' + r + 'privacy.html">Privacy Policy</a>' +
      '<a href="' + r + 'about.html">About</a>' +
      '</div>' +
      kofi +
      '<div class="footer-copy">' +
      '© 2026 Fish Stocking Alert. Data sourced from state fish &amp; wildlife agencies. All stocking schedules subject to change.' +
      '</div>' +
      '</div>' +
      '</footer>';

  } else {
    /* data-footer variant — app.html (ca) and pennsylvania.html (pa) */
    var copyHtml = copyKey === 'ca'
      ? '© 2026 Fish Stocking Alert · Data sourced from <a href="https://data-cdfw.opendata.arcgis.com/datasets/CDFW::planting-location-cdfw-ds2897" target="_blank" rel="noopener">CDFW Open Data Portal</a>. All fish plants are subject to change depending on road, water, weather, and operational conditions.'
      : '© 2026 Fish Stocking Alert · Data sourced from the <a href="https://fbweb.pa.gov/arcgis/rest/services/PFBC_Map_Services/" target="_blank" rel="noopener">PA Fish &amp; Boat Commission ArcGIS Portal</a>. Pre-season stocking allocations for 2026. Individual stocking schedules subject to change.';

    html =
      '<footer class="data-footer">' +
      '<div class="data-footer-inner">' +
      '<div class="data-footer-links">' +
      '<a href="index.html">Home</a>' +
      '<a href="blog/index.html">Blog</a>' +
      '<a href="contact.html">Contact</a>' +
      '<a href="privacy.html">Privacy Policy</a>' +
      '<a href="about.html">About</a>' +
      '</div>' +
      kofi +
      '<div class="data-footer-copy">' + copyHtml + '</div>' +
      '</div>' +
      '</footer>';
  }

  el.outerHTML = html;
}());
