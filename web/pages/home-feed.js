// Home feed tabs: All vs Live leaderboards.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  function stopHomeLiveRefresh() {
    if (window.TGA.stopNASCARLiveRefresh) window.TGA.stopNASCARLiveRefresh();
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

  function renderLiveFeedPage() {
    document.title = (window.TGA.documentTitle || function (m) { return m + ' — The Grid Archive (TGA)'; })(
      (window.TGA.t && window.TGA.t('live.title')) || 'Live'
    );
    setHomeFeedTab('live');
    if (window.TGA.renderNASCARLive) window.TGA.renderNASCARLive();
  }

  function renderHomeRaceFeed() {
    setHomeFeedTab('race');
    stopHomeLiveRefresh();
  }

  window.TGA.renderLiveFeedPage = renderLiveFeedPage;
  window.TGA.renderHomeRaceFeed = renderHomeRaceFeed;
  window.TGA.stopHomeLiveRefresh = stopHomeLiveRefresh;
  window.TGA.setHomeFeedTab = setHomeFeedTab;
})();
