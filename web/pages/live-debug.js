// Temporary live debug page: NASCAR live leaderboards + raw API debug.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var refreshTimer = null;

  function stopLiveDebugRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (window.TGA.stopNASCARLiveRefresh) window.TGA.stopNASCARLiveRefresh();
  }

  function esc(s) {
    return window.TGA.esc ? window.TGA.esc(s) : String(s == null ? '' : s);
  }

  function prettyJSON(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  function setHomeFeedTab(activeTab) {
    var nav = document.getElementById('home-feed-nav');
    if (!nav) return;
    nav.querySelectorAll('.home-feed-nav-link').forEach(function (link) {
      var tab = link.getAttribute('data-home-tab');
      link.classList.toggle('active', tab === activeTab);
    });
    var raceFeed = document.getElementById('home-race-feed');
    var liveFeed = document.getElementById('home-live-feed');
    var seriesSection = document.querySelector('#view-list .series-section');
    if (raceFeed) raceFeed.classList.toggle('hidden', activeTab !== 'race');
    if (liveFeed) liveFeed.classList.toggle('hidden', activeTab !== 'live');
    if (seriesSection) seriesSection.classList.toggle('hidden', activeTab === 'live');
  }

  function renderDebugPayload(data) {
    var root = document.getElementById('live-debug-root');
    if (!root) return;

    var html = '';
    html += renderSection(
      'GET /api/live-events',
      '<pre class="live-debug-pre">' + esc(prettyJSON(data && data.live_events_served)) + '</pre>'
    );
    html += renderSection(
      'data/live.json',
      '<pre class="live-debug-pre">' + esc(prettyJSON(data && data.live_json)) + '</pre>'
    );
    html += renderSection(
      'Live sources (raw)',
      '<pre class="live-debug-pre live-debug-pre--full">' + esc(prettyJSON({
        nascar: data && data.nascar,
        openf1: data && data.openf1,
        wec: data && data.wec,
        super_formula: data && data.super_formula
      })) + '</pre>'
    );
    root.innerHTML = html;
  }

  function renderSection(title, bodyHtml) {
    return (
      '<section class="live-debug-section">' +
        '<h2 class="live-debug-section-title">' + esc(title) + '</h2>' +
        bodyHtml +
      '</section>'
    );
  }

  function fetchDebug() {
    var API = window.TGA && window.TGA.API;
    return API && API.getLiveDebug
      ? API.getLiveDebug()
      : fetch('/api/live-debug').then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
  }

  function fetchAndRenderDebug() {
    var root = document.getElementById('live-debug-root');
    if (!root) return Promise.resolve();
    return fetchDebug()
      .then(renderDebugPayload)
      .catch(function (err) {
        root.innerHTML = '<p class="live-debug-error">Failed to load debug: ' + esc(err && err.message ? err.message : err) + '</p>';
      });
  }

  function renderLiveDebugPage() {
    document.title = 'Live — The Grid Archive (TGA)';
    setHomeFeedTab('live');
    stopLiveDebugRefresh();
    if (window.TGA.renderNASCARLive) window.TGA.renderNASCARLive();
    fetchAndRenderDebug();
    refreshTimer = setInterval(fetchAndRenderDebug, 60000);
  }

  function renderHomeRaceFeed() {
    setHomeFeedTab('race');
    stopLiveDebugRefresh();
  }

  window.TGA.renderLiveDebugPage = renderLiveDebugPage;
  window.TGA.renderHomeRaceFeed = renderHomeRaceFeed;
  window.TGA.stopLiveDebugRefresh = stopLiveDebugRefresh;
  window.TGA.setHomeFeedTab = setHomeFeedTab;
})();
