(function () {
  var el = document.getElementById('site-header');
  if (!el) return;

  var inBlog = window.location.pathname.indexOf('/blog/') !== -1;
  var r = inBlog ? '../' : '';
  var blogHref = inBlog ? 'index.html' : 'blog/index.html';

  var s = document.createElement('style');
  s.textContent =
    '.header-actions{display:flex;align-items:center;gap:0.85rem;flex-shrink:0}' +
    '.btn-alerts{background:var(--teal);color:var(--white);border:none;padding:0.5rem 1.35rem;border-radius:var(--radius-pill);font-family:"Inter",sans-serif;font-size:0.9rem;font-weight:700;cursor:pointer;transition:background 0.15s,transform 0.1s;white-space:nowrap}' +
    '.btn-alerts:hover{background:var(--teal-dark)}' +
    '.btn-alerts:active{transform:scale(0.97)}' +
    '.header-blog-link{color:rgba(255,255,255,0.82);text-decoration:none;font-size:0.9rem;font-weight:600;transition:color 0.15s;white-space:nowrap}' +
    '.header-blog-link:hover{color:#0ea5e9}' +
    '.header-tagline{font-size:0.72rem;font-weight:500;color:rgba(255,255,255,0.38);letter-spacing:0.01em;margin-left:0.5rem;white-space:nowrap}' +
    '@media(max-width:700px){.header-tagline{display:none}}' +
    '@media(max-width:480px){.btn-alerts{padding:0.45rem 0.9rem;font-size:0.82rem}}';
  document.head.appendChild(s);

  var MOON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>';
  var SUN_SVG  = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

  el.outerHTML =
    '<header class="site-header">' +
    '<div class="header-inner">' +
    '<div class="header-logo">' +
    '<span class="logo-icon">🐟</span>' +
    '<a href="' + r + 'index.html" class="logo-text">Fish Stocking <span class="logo-accent">Alert</span></a>' +
    '<span class="header-tagline">Be first to the bite</span>' +
    '</div>' +
    '<div class="header-actions">' +
    '<a href="' + blogHref + '" class="header-blog-link">Blog</a>' +
    '<button class="btn-alerts" id="btn-get-alerts">Get Alerts</button>' +
    '<button class="btn-dark-mode" id="btn-dark-mode" aria-label="Toggle dark mode">' + MOON_SVG + '</button>' +
    '</div>' +
    '</div>' +
    '</header>';

  var darkBtn = document.getElementById('btn-dark-mode');

  function updateDarkIcon() {
    darkBtn.innerHTML = document.documentElement.classList.contains('dark-mode') ? SUN_SVG : MOON_SVG;
  }

  updateDarkIcon();

  darkBtn.addEventListener('click', function () {
    var isDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('fsa-theme', isDark ? 'dark' : 'light');
    updateDarkIcon();
  });

  document.getElementById('btn-get-alerts').addEventListener('click', function () {
    if (typeof window.openAlertModal === 'function') {
      window.openAlertModal(null);
    }
  });
}());
