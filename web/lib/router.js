// web/lib/router.js — SPA routing (pathname → page renderers on window.TGA)
// Load before app.js; call window.TGA.initRouter() from app.js after handlers are registered.
(function () {
  'use strict';
  window.TGA = window.TGA || {};
  var state = window.TGA._state;

  function route() {
    var T = window.TGA;
    var showView = T.showView || function () {};
    var renderList = T.renderList || function () {};
    var renderSchedulePage = T.renderSchedulePage || function () {};
    var renderSearchPage = T.renderSearchPage || function () {};
    var renderEventPage = T.renderEventPage || function () {};
    var renderTrackDetail = T.renderTrackDetail || function () {};
    var renderDriverDetail = T.renderDriverDetail || function () {};
    var renderTeamDetail = T.renderTeamDetail || function () {};
    var renderCrewChiefDetail = T.renderCrewChiefDetail || function () {};
    var renderFeedbackPage = T.renderFeedbackPage || function () {};
    var renderDetail = T.renderDetail || function () {};
    var renderLiveDebugPage = T.renderLiveDebugPage || function () {};
    var renderHomeRaceFeed = T.renderHomeRaceFeed || function () {};

    var path = window.location.pathname;
    var search = window.location.search || '';
    if (path !== path.toLowerCase() && (path.indexOf('/series/') === 0 || path.indexOf('/event/') === 0)) {
      history.replaceState(null, '', path.toLowerCase());
      path = path.toLowerCase();
    }
    var seriesList = document.getElementById('series-list');

    if (path === '/' || path === '') {
      // Separate mode: "Full Schedule" button goes to /?full_schedule=1
      if (search.indexOf('full_schedule=1') !== -1) {
        state.loadedSeriesId = null;
        renderSchedulePage();
        return;
      }
      state.loadedSeriesId = null;
      document.title = (window.TGA.t && window.TGA.t('app.title_year')) || 'The Grid Archive (TGA) — 2026';
      showView('view-list');
      renderHomeRaceFeed();
      renderList(seriesList);
      return;
    }
    if (path === '/live') {
      state.loadedSeriesId = null;
      document.title = (window.TGA.documentTitle || function (m) { return m + ' — The Grid Archive (TGA)'; })(
        (window.TGA.t && window.TGA.t('live.debug_title')) || 'Live debug'
      );
      showView('view-list');
      renderLiveDebugPage();
      return;
    }
    if (path === '/schedule') {
      state.loadedSeriesId = null;
      renderSchedulePage();
      return;
    }
    if (path === '/search') {
      var params = new URLSearchParams(search || '');
      var q = params.get('q') || '';
      renderSearchPage(q);
      return;
    }
    if (path === '/feedback') {
      renderFeedbackPage();
      return;
    }
    if (path.indexOf('/event/') === 0) {
      var evRest = path.slice('/event/'.length);
      var evSlash = evRest.indexOf('/');
      var evId = decodeURIComponent(evSlash >= 0 ? evRest.slice(0, evSlash) : evRest);
      var evSection = evSlash >= 0 ? evRest.slice(evSlash + 1).replace(/\/.*$/, '') : '';
      if (evId) { renderEventPage(evId, evSection); return; }
    }
    if (path.indexOf('/track/') === 0) {
      var trackSlug = path.slice('/track/'.length).replace(/\/.*$/, '');
      if (trackSlug) { renderTrackDetail(trackSlug); return; }
    }
    if (path.indexOf('/driver/') === 0) {
      var driverSlug = path.slice('/driver/'.length).replace(/\/.*$/, '');
      // Canonical slug for Hülkenberg:
      // - stored profile uses "nico-h-lkenberg" (ü -> dash)
      // - user-facing URL should use "nico-hulkenberg" (ü -> u)
      // - tables may generate "nicolas-hulkenberg" depending on whether they show "Nico" or "Nicolas"
      var hulkenbergCanonical = null;
      if (driverSlug === 'nico-h-lkenberg' || driverSlug === 'nicolas-hulkenberg' || driverSlug === 'nicolas-h-lkenberg') {
        hulkenbergCanonical = '/driver/nico-hulkenberg';
      }
      if (hulkenbergCanonical && path + search !== hulkenbergCanonical) {
        history.replaceState(null, '', hulkenbergCanonical);
        driverSlug = 'nico-hulkenberg';
      }

      // Canonical slug for Sergio Pérez.
      // DB profile uses "sergio-p-rez" because "é" may turn into '-' during slugification,
      // but user-facing URL should stay "sergio-perez".
      if (driverSlug === 'sergio-p-rez') {
        var perezCanonical = '/driver/sergio-perez';
        if (path + search !== perezCanonical) {
          history.replaceState(null, '', perezCanonical);
          driverSlug = 'sergio-perez';
        }
      }
      if (driverSlug) { renderDriverDetail(driverSlug); return; }
    }
    if (path.indexOf('/team/') === 0) {
      var teamSlug = path.slice('/team/'.length).replace(/\/.*$/, '');
      if (teamSlug) { renderTeamDetail(teamSlug); return; }
    }
    if (path.indexOf('/crew-chief/') === 0) {
      var crewChiefSlug = path.slice('/crew-chief/'.length).replace(/\/.*$/, '');
      if (crewChiefSlug) { renderCrewChiefDetail(crewChiefSlug); return; }
    }
    // F1 season pages: /season/f1-2025, /season/f1-2025/standings, etc. (1950–2025)
    if (path.indexOf('/season/') === 0) {
      var seasonRest = path.slice('/season/'.length);
      var seasonSlash = seasonRest.indexOf('/');
      var seasonSlug = (seasonSlash >= 0 ? seasonRest.slice(0, seasonSlash) : seasonRest).replace(/^\/+|\/+$/g, '');
      var seasonSubPath = seasonSlash >= 0 ? seasonRest.slice(seasonSlash + 1).replace(/\/.*$/, '') : '';
      try { seasonSlug = decodeURIComponent(seasonSlug); } catch (e) {}
      if (seasonSlug && seasonSlug.indexOf('f1-') === 0) {
        renderDetail(seasonSlug, seasonSubPath);
        return;
      }
    }
    if (path.indexOf('/series/') === 0) {
      var rest = path.slice('/series/'.length);
      var slash = rest.indexOf('/');
      var id = (slash >= 0 ? rest.slice(0, slash) : rest).replace(/^\/+|\/+$/g, '');
      try { id = decodeURIComponent(id); } catch (e) {}
      // URL uses hyphens (nascar-cup); code uses underscores (nascar_cup)
      id = id.replace(/-/g, '_');
      if (id === 'nascar_xfinity') id = 'noaps';
      var subPath = slash >= 0 ? rest.slice(slash + 1).replace(/\/.*$/, '') : '';
      // /series/f1 (no subpath) — current season schedule at /season/f1-2026.
      if (id === 'f1' && subPath === '') {
        history.replaceState(null, '', '/season/f1-2026');
        renderDetail('f1-2026', '');
        return;
      }
      // IMSA: /specs maps to same panel as /classes — rewrite URL to /classes
      if (id === 'imsa' && subPath === 'specs') {
        history.replaceState(null, '', '/series/imsa/classes');
        subPath = 'classes';
      }
      if (id) {
        renderDetail(id, subPath);
        return;
      }
    }
    state.loadedSeriesId = null;
    showView('view-list');
    renderList(seriesList);
  }

  function navigate(href) {
    if (!href || href.charAt(0) !== '/') return;
    window.scrollTo(0, 0);
    if (href !== window.location.pathname + window.location.search) {
      history.pushState(null, '', href);
    }
    route();
  }

  function initRouter() {
    if (window.TGA._routerInitDone) return;
    window.TGA._routerInitDone = true;

    window.addEventListener('popstate', route);
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) route();
    });

    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest && e.target.closest('a[href]');
      if (!link) return;

      // Respect default browser behavior: new tabs, modifiers, external links.
      if (e.defaultPrevented) return;
      if (e.button && e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.target && link.target.toLowerCase() === '_blank') return;
      if (link.hasAttribute('download')) return;

      var href = link.getAttribute('href');
      if (!href || href.charAt(0) !== '/' || href.indexOf('/web/') === 0 || href.indexOf('/api/') === 0) return;

      // Series-nav tabs get the panel fade transition
      if (link.closest('#series-nav') && href.indexOf('/series/') === 0) {
        e.preventDefault();
        var wrap = document.getElementById('detail-panels-wrap');
        if (wrap) {
          wrap.style.height = wrap.offsetHeight + 'px';
          wrap.classList.add('detail-panels-fade-out');
        }
        window.scrollTo(0, 0);
        setTimeout(function () {
          history.pushState(null, '', href);
          route();
          requestAnimationFrame(function () {
            if (wrap) {
              wrap.classList.remove('detail-panels-fade-out');
              requestAnimationFrame(function () { if (wrap) wrap.style.height = ''; });
            }
          });
        }, 180);
        return;
      }

      // All other internal links — plain SPA navigation
      e.preventDefault();
      window.scrollTo(0, 0);
      if (href !== window.location.pathname + window.location.search) {
        history.pushState(null, '', href);
      }
      route();
    });

    route();
  }

  window.TGA.route = route;
  window.TGA.navigate = navigate;
  window.TGA.initRouter = initRouter;
})();
