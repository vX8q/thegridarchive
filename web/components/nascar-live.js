// NASCAR live leaderboards (Cup, O'Reilly, Truck) for the /live tab.
(function () {
  if (typeof window === 'undefined') return;
  window.TGA = window.TGA || {};

  var refreshTimer = null;
  var REFRESH_MS = 15000;

  function t(key) {
    return window.TGA.t ? window.TGA.t(key) : key;
  }

  function esc(s) {
    return window.TGA.esc ? window.TGA.esc(s) : String(s == null ? '' : s);
  }

  function driverDisplayName(name) {
    return window.TGA.driverDisplayName ? window.TGA.driverDisplayName(name) : name;
  }

  function slugify(str) {
    return window.TGA.slugify ? window.TGA.slugify(str) : String(str || '').toLowerCase();
  }

  function normalizeNascarLiveDriverName(name) {
    var s = driverDisplayName(name);
    if (s == null || s === '') return '';
    s = String(s).replace(/^\*+\s*/, '').trim();
    if (/^#\d*$/.test(s) || s === '#') return '';
    if (/\s#$/i.test(s)) {
      s = s.replace(/\s#$/i, '').trim();
    }
    return s;
  }

  function driverSurnameParts(parts) {
    if (!parts || parts.length < 2) return parts;
    var particles = /^(van|von|de|del|della|la|le|st|di|bin|al|mc)$/i;
    var lastIdx = parts.length - 1;
    if (lastIdx >= 1 && particles.test(parts[lastIdx - 1])) {
      return [parts[0], parts.slice(lastIdx - 1).join(' ')];
    }
    return [parts[0], parts[lastIdx]];
  }

  function driverShortName(name) {
    var full = normalizeNascarLiveDriverName(name);
    if (!full) return '—';
    var parts = String(full).trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    var pair = driverSurnameParts(parts);
    var first = pair[0];
    var last = pair[1];
    if (!last || /^#/.test(last)) {
      last = parts.slice(1).join(' ');
    }
    if (!last || /^#/.test(last)) return full;
    var initial = first.charAt(0);
    if (initial) initial = initial.toUpperCase() + '.';
    if (/^A\.?\s*J\.?$/i.test(first) || /^A\.?\s*J\.?\s*$/i.test(first + '.')) {
      return 'A. J. ' + last;
    }
    return initial ? initial + ' ' + last : last;
  }

  function driverLinkHtml(name) {
    var display = normalizeNascarLiveDriverName(name);
    if (!display) return '<span class="nlb-driver-link">—</span>';
    return '<a href="/driver/' + encodeURIComponent(slugify(driverDisplayName(display) || display)) + '" class="nlb-driver-link">' + esc(driverShortName(display)) + '</a>';
  }

  function formatGap(position, gapSeconds, gapDisplay) {
    if (gapDisplay) return gapDisplay;
    if (position === 1 || gapSeconds == null || gapSeconds === 0) return '—';
    var n = Number(gapSeconds);
    if (!isFinite(n) || n <= 0) return '—';
    var s = n.toFixed(3).replace(/\.?0+$/, '');
    return '+' + s + 's';
  }

  function seriesColor(seriesKey) {
    var colors = window.TGA_SERIES_COLORS || {};
    return colors[seriesKey] || '#ffb400';
  }

  function seriesShortLabel(seriesKey, seriesName) {
    var short = window.TGA_SERIES_SHORT || {};
    if (short[seriesKey]) return short[seriesKey];
    if (seriesKey === 'NOAPS') return "O'Reilly";
    return seriesName || seriesKey;
  }

  function boardTitle(board) {
    if (board.run_name) return board.run_name;
    if (board.track_name) return board.track_name;
    return board.series_name || '';
  }

  function renderLeaderRow(entry) {
    var meta = esc(entry.manufacturer || '');
    if (entry.car_number) {
      meta += (meta ? ' · ' : '') + '#' + esc(entry.car_number);
    }
    return (
      '<tr class="nlb-row">' +
        '<td class="nlb-pos">' + esc(entry.position) + '</td>' +
        '<td class="nlb-driver">' +
          '<span class="nlb-driver-name">' + driverLinkHtml(entry.driver) + '</span>' +
          (meta ? '<span class="nlb-driver-meta">' + meta + '</span>' : '') +
        '</td>' +
        '<td class="nlb-grid">' + esc(entry.starting_position || '—') + '</td>' +
        '<td class="nlb-gap">' + esc(formatGap(entry.position, entry.gap_seconds, entry.gap_display)) + '</td>' +
      '</tr>'
    );
  }

  function isLiveBoard(board) {
    if (!board || board.error) return false;
    var leaders = board.leaders;
    return Array.isArray(leaders) && leaders.length > 0;
  }

  function renderBoard(board) {
    if (!isLiveBoard(board)) return '';
    var color = seriesColor(board.series_key);
    var badge = seriesShortLabel(board.series_key, board.series_name);
    var title = boardTitle(board);
    var lapLine = '';
    if (board.lap_number && board.laps_in_race) {
      lapLine = t('live.lap_of')
        .replace('{lap}', board.lap_number)
        .replace('{total}', board.laps_in_race);
    } else if (board.lap_number) {
      lapLine = t('live.lap') + ' ' + board.lap_number;
    }

    var leaders = board.leaders;
    if (!Array.isArray(leaders) || !leaders.length) return '';

    var eventLink = board.event_id
      ? '<a class="nlb-event-link" href="/event/' + encodeURIComponent(String(board.event_id).toLowerCase()) + '">' + esc(t('live.view_event')) + '</a>'
      : '';

    var rows = leaders.map(renderLeaderRow).join('');

    return (
      '<article class="nlb-card" style="--nlb-accent:' + esc(color) + '">' +
        '<header class="nlb-head">' +
          '<div class="nlb-head-top">' +
            '<span class="nlb-badge">' + esc(badge) + '</span>' +
            '<span class="nlb-live"><span class="nlb-live-dot" aria-hidden="true"></span>' + esc(t('live.badge')) + '</span>' +
          '</div>' +
          '<h2 class="nlb-title">' + esc(title) + '</h2>' +
          (board.track_name && board.run_name && board.track_name !== board.run_name
            ? '<p class="nlb-track">' + esc(board.track_name) + '</p>'
            : '') +
          (lapLine ? '<p class="nlb-lap">' + esc(lapLine) + '</p>' : '') +
          '<p class="nlb-leaders-label">' + esc(t('live.leaders')) + '</p>' +
        '</header>' +
        '<div class="nlb-table-wrap">' +
          '<table class="nlb-table">' +
            '<thead><tr>' +
              '<th scope="col">' + esc(t('live.col_pos')) + '</th>' +
              '<th scope="col">' + esc(t('live.col_driver')) + '</th>' +
              '<th scope="col">' + esc(t('live.col_grid')) + '</th>' +
              '<th scope="col">' + esc(t('live.col_gap')) + '</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
        eventLink +
      '</article>'
    );
  }

  function renderBoards(payload) {
    var root = document.getElementById('nascar-live-root');
    if (!root) return;

    var boards = payload && Array.isArray(payload.boards) ? payload.boards : [];
    var fetchedAt = payload && payload.fetched_at ? String(payload.fetched_at) : '';

    var cards = boards.map(renderBoard).filter(Boolean).join('');
    var html = '';

    html += '<header class="nascar-live-header">';
    html += '<h1 class="nascar-live-title">' + esc(t('live.title')) + '</h1>';
    if (fetchedAt) {
      html += '<p class="nascar-live-meta">' + esc(t('live.updated')) + ' <time datetime="' + esc(fetchedAt) + '">' + esc(fetchedAt.replace('T', ' ').replace('Z', ' UTC')) + '</time></p>';
    }
    html += '</header>';

    if (!cards) {
      html += '<p class="nascar-live-empty">' + esc(t('live.no_live')) + '</p>';
    } else {
      html += '<div class="nascar-live-boards">' + cards + '</div>';
    }

    root.innerHTML = html;
  }

  function fetchBoards() {
    var API = window.TGA && window.TGA.API;
    var req = API && API.getLiveBoards
      ? API.getLiveBoards()
      : API && API.getNASCARLive
      ? API.getNASCARLive()
      : fetch('/api/live-boards?_=' + Date.now()).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
    return req;
  }

  function fetchAndRender() {
    var root = document.getElementById('nascar-live-root');
    if (!root) return Promise.resolve();
    return fetchBoards()
      .then(renderBoards)
      .catch(function (err) {
        root.innerHTML =
          '<header class="nascar-live-header">' +
            '<h1 class="nascar-live-title">' + esc(t('live.title')) + '</h1>' +
            '<p class="nlb-error">' + esc(t('live.load_failed')) + ': ' + esc(err && err.message ? err.message : err) + '</p>' +
          '</header>';
      });
  }

  function stopNASCARLiveRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function startNASCARLiveRefresh() {
    stopNASCARLiveRefresh();
    fetchAndRender();
    refreshTimer = setInterval(fetchAndRender, REFRESH_MS);
  }

  window.TGA.renderNASCARLive = startNASCARLiveRefresh;
  window.TGA.stopNASCARLiveRefresh = stopNASCARLiveRefresh;
  window.TGA.fetchNASCARLiveBoards = fetchBoards;
})();
