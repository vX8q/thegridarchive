// Blocking first-paint boot (no defer). CSP forbids inline scripts, so this
// lives in its own file. Sets html.spa-boot-inner before <body> parses so
// #view-list cannot flash on /driver/* and other inner routes.
(function () {
  var p = String(location.pathname || '/').replace(/\/+$/, '') || '/';
  var home = (p === '/' || p === '/live') && String(location.search || '').indexOf('full_schedule=1') === -1;
  if (home) return;
  document.documentElement.classList.add('spa-boot-inner');
  if (p.indexOf('/driver/') === 0) {
    document.documentElement.classList.add('spa-boot-driver');
  }
})();
