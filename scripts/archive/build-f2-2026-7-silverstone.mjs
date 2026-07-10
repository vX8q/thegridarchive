#!/usr/bin/env node
/**
 * Build F2 2026 R7 (Silverstone) from official session reports.
 * Run: node scripts/build-f2-2026-7-silverstone.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventPath = path.join(__dirname, '../data/events/F2/2026/f2_2026_7.json');
const refPath = path.join(__dirname, '../data/events/F2/2026/f2_2026_6.json');

const TEAMS = {
  1: 'Invicta Racing', 2: 'Invicta Racing', 3: 'Hitech TGR', 4: 'Hitech TGR',
  5: 'Campos Racing', 6: 'Campos Racing', 7: 'DAMS Lucas Oil', 8: 'DAMS Lucas Oil',
  9: 'MP Motorsport', 10: 'MP Motorsport', 11: 'Prema Racing', 12: 'Prema Racing',
  14: 'Rodin Motorsport', 15: 'Rodin Motorsport', 16: 'ART Grand Prix', 17: 'ART Grand Prix',
  20: 'AIX Racing', 21: 'AIX Racing', 22: 'Van Amersfoort Racing', 23: 'Van Amersfoort Racing',
  24: 'Trident', 25: 'Trident',
};

const NAMES = {
  1: 'R. Câmara', 2: 'J. Dürksen', 3: 'R. Miyata', 4: 'C. Herta', 5: 'N. León',
  6: 'N. Tsolov', 7: 'D. Beganovic', 8: 'R. Bilinski', 9: 'G. Minì', 10: 'O. Goethe',
  11: 'S. Montoya', 12: 'M. Boya', 14: 'M. Stenshorne', 15: 'A. Dunne', 16: 'K. Maini',
  17: 'T. Inthraphuvasak', 20: 'E. Fittipaldi', 21: 'C. Shields', 22: 'N. Varrone',
  23: 'R. Villagómez', 24: 'L. van Hoepen', 25: 'J. Bennett',
};

const RACE_TEAMS = {
  ...TEAMS,
  3: 'Hitech', 4: 'Hitech',
};

const SPRINT_PTS = [10, 8, 6, 5, 4, 3, 2, 1];
const FEATURE_PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const POLE_NUM = 1;

function kphFromLap(timeStr) {
  const m = String(timeStr).match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!m) return '—';
  const sec = Number(m[1]) * 60 + Number(m[2]);
  if (!sec) return '—';
  return ((5.891 / sec) * 3600).toFixed(3);
}

function raceRow(pos, num, laps, time, gap, int, pts, race = false) {
  const team = race ? RACE_TEAMS[num] : TEAMS[num];
  return [String(pos), String(num), NAMES[num], team, String(laps), time, gap, int, '—', '—', '—', pts];
}

function dnfRow(status, num, laps = '—') {
  return [status, String(num), NAMES[num], RACE_TEAMS[num], String(laps), '—', 'DNF', '—', '—', '—', '—', '0'];
}

function gapToSeconds(gapStr) {
  const s = String(gapStr).replace(/^\+/, '');
  const hm = s.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function addSeconds(timeStr, addSec) {
  const m = String(timeStr).match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!m) return '—';
  let sec = Number(m[1]) * 60 + Number(m[2]) + addSec;
  const mins = Math.floor(sec / 60);
  sec -= mins * 60;
  return `${mins}:${sec.toFixed(3).replace(/^0+/, '')}`;
}

function buildRaceRows(results, laps, ptsFn) {
  const winnerTime = results[0][2];
  let prevGap = 0;
  return results.map(([pos, num, third], idx) => {
    const gap = idx === 0 ? '—' : third;
    const gapSec = idx === 0 ? 0 : gapToSeconds(third);
    const int = idx === 0 ? '—' : String(gapSec - prevGap).replace(/^(\d+\.\d*?)0+$/, '$1').replace(/\.$/, '');
    if (idx > 0) prevGap = gapSec;
    const time = idx === 0 ? third : addSeconds(winnerTime, gapSec);
    return raceRow(pos, num, laps, time, gap, int, ptsFn(pos, num), true);
  });
}

const practiceRowsData = [
  [1, 15, 21, '1:42.065', '—', '—', '207.785'],
  [2, 1, 20, '1:42.136', '0.071', '0.071', '207.640'],
  [3, 7, 20, '1:42.141', '0.076', '0.005', '207.630'],
  [4, 8, 20, '1:42.326', '0.261', '0.185', '207.255'],
  [5, 9, 21, '1:42.354', '0.289', '0.028', '207.198'],
  [6, 2, 22, '1:42.398', '0.333', '0.044', '207.109'],
  [7, 25, 21, '1:42.408', '0.343', '0.010', '207.089'],
  [8, 17, 19, '1:42.411', '0.346', '0.003', '207.083'],
  [9, 16, 20, '1:42.413', '0.348', '0.002', '207.079'],
  [10, 6, 21, '1:42.419', '0.354', '0.006', '207.067'],
  [11, 12, 20, '1:42.423', '0.358', '0.004', '207.058'],
  [12, 23, 20, '1:42.606', '0.541', '0.183', '206.689'],
  [13, 14, 21, '1:42.651', '0.586', '0.045', '206.599'],
  [14, 3, 22, '1:42.662', '0.597', '0.011', '206.576'],
  [15, 10, 21, '1:42.691', '0.626', '0.029', '206.518'],
  [16, 5, 19, '1:42.724', '0.659', '0.033', '206.452'],
  [17, 24, 21, '1:43.059', '0.994', '0.335', '205.781'],
  [18, 22, 20, '1:43.255', '1.190', '0.196', '205.390'],
  [19, 20, 21, '1:43.256', '1.191', '0.001', '205.388'],
  [20, 21, 21, '1:44.451', '2.386', '1.195', '203.038'],
  [21, 4, 5, '2:00.647', '18.582', '16.196', '175.782'],
];

const practiceRows = practiceRowsData.map(([pos, num, laps, time, gap, int, kph]) => [
  String(pos), String(num), NAMES[num], TEAMS[num], String(laps), time, gap, int, kph,
]);

const quali = [
  [1, 1, 11, '1:39.690', '—', '—', '212.735'],
  [2, 15, 11, '1:39.891', '0.201', '0.201', '212.307'],
  [3, 16, 10, '1:39.892', '0.202', '0.001', '212.305'],
  [4, 8, 11, '1:39.967', '0.277', '0.075', '212.146'],
  [5, 6, 10, '1:39.972', '0.282', '0.005', '212.135'],
  [6, 17, 11, '1:40.243', '0.553', '0.271', '211.561'],
  [7, 2, 11, '1:40.309', '0.619', '0.066', '211.422'],
  [8, 23, 12, '1:40.328', '0.638', '0.019', '211.382'],
  [9, 3, 10, '1:40.362', '0.672', '0.034', '211.311'],
  [10, 9, 11, '1:40.382', '0.692', '0.020', '211.268'],
  [11, 7, 12, '1:40.461', '0.771', '0.079', '211.102'],
  [12, 12, 10, '1:40.470', '0.780', '0.009', '211.083'],
  [13, 10, 12, '1:40.486', '0.796', '0.016', '211.050'],
  [14, 11, 11, '1:40.529', '0.839', '0.043', '210.960'],
  [15, 4, 12, '1:40.539', '0.849', '0.010', '210.939'],
  [16, 5, 12, '1:40.547', '0.857', '0.008', '210.922'],
  [17, 14, 12, '1:40.548', '0.858', '0.001', '210.920'],
  [18, 25, 13, '1:40.552', '0.862', '0.004', '210.911'],
  [19, 22, 12, '1:40.581', '0.891', '0.029', '210.850'],
  [20, 24, 12, '1:40.635', '0.945', '0.054', '210.737'],
  [21, 20, 11, '1:40.782', '1.092', '0.147', '210.430'],
  [22, 21, 13, '1:40.972', '1.282', '0.190', '210.034'],
];

function qualRowFromData([pos, num, laps, time, gap, int, kph]) {
  return [String(pos), String(num), NAMES[num], TEAMS[num], String(laps), time, gap, int, kph];
}

function lapToSec(timeStr) {
  const m = String(timeStr).match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!m) return Infinity;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Fastest lap point among classified finishers in top `posMax` (F2: top 10). */
function fastestLapInTop(results, posMax = 10) {
  let bestSec = Infinity;
  let bestNum = null;
  for (const [pos, num, , , , , , bestLap] of results) {
    if (Number(pos) > posMax) continue;
    const sec = lapToSec(bestLap);
    if (sec < bestSec) {
      bestSec = sec;
      bestNum = num;
    }
  }
  return bestNum;
}

function sprintPts(pos, num, sprintFlNum) {
  let pts = pos >= 1 && pos <= 8 ? SPRINT_PTS[pos - 1] : 0;
  if (sprintFlNum != null && num === sprintFlNum && pos >= 1 && pos <= 10) pts += 1;
  return String(pts);
}

function sprintRow([pos, num, laps, time, gap, int, kph, best, lap], sprintFlNum) {
  const p = pos === 'DNF' ? pos : Number(pos);
  const pts = pos === 'DNF' ? '0' : sprintPts(p, num, sprintFlNum);
  const lapStr = lap === '—' ? '—' : String(lap);
  return [String(pos), String(num), NAMES[num], RACE_TEAMS[num], String(laps), time, gap, int, kph, best, lapStr, pts];
}

const sprintResults = [
  [1, 6, 21, '41:04.635', '—', '—', '180.504', '1:44.940', 13],
  [2, 9, 21, '41:05.926', '1.291', '1.291', '180.409', '1:45.121', 13],
  [3, 23, 21, '41:06.333', '1.698', '0.407', '180.380', '1:45.130', 17],
  [4, 16, 21, '41:07.647', '3.012', '1.314', '180.283', '1:44.877', 17],
  [5, 17, 21, '41:11.328', '6.693', '3.681', '180.015', '1:45.083', 19],
  [6, 7, 21, '41:13.465', '8.830', '2.137', '179.859', '1:44.852', 20],
  [7, 8, 21, '41:14.539', '9.904', '1.074', '179.781', '1:44.997', 18],
  [8, 2, 21, '41:15.434', '10.799', '0.895', '179.716', '1:45.271', 18],
  [9, 15, 21, '41:16.262', '11.627', '0.828', '179.656', '1:44.956', 18],
  [10, 1, 21, '41:17.194', '12.559', '0.932', '179.589', '1:45.068', 20],
  [11, 3, 21, '41:23.381', '18.746', '6.187', '179.141', '1:46.103', 17],
  [12, 5, 21, '41:24.276', '19.641', '0.895', '179.077', '1:45.412', 20],
  [13, 12, 21, '41:28.040', '23.405', '3.764', '178.806', '1:45.731', 13],
  [14, 24, 21, '41:28.280', '23.645', '0.240', '178.789', '1:46.084', 17],
  [15, 4, 21, '41:28.559', '23.924', '0.279', '178.768', '1:46.040', 14],
  [16, 10, 21, '41:30.517', '25.882', '1.958', '178.628', '1:45.767', 17],
  [17, 20, 21, '41:32.508', '27.873', '1.991', '178.485', '1:46.087', 18],
  [18, 22, 21, '41:33.194', '28.559', '0.686', '178.436', '1:45.825', 20],
  [19, 21, 21, '42:14.310', '69.675', '41.116', '175.541', '1:44.533', 9],
  [20, 14, 21, '43:30.147', '145.512', '75.837', '170.441', '1:46.158', 12],
];

const sprintDNF = [
  ['DNF', 11, 1, '1:56.205', 'DNF', '—', '178.350', '—', '—'],
  ['DNF', 25, 1, '2:02.340', 'DNF', '—', '169.406', '—', '—'],
];

const SPRINT_FL_NUM = fastestLapInTop(sprintResults); // Shields P19 outright → Beganovic P6 among top 10

const featureResults = [
  [1, 6, 29, '51:22.101', '—', '—', '199.389', '1:44.449', 28],
  [2, 23, 29, '51:25.334', '3.233', '3.233', '199.180', '1:43.048', 28],
  [3, 16, 29, '51:29.982', '7.881', '4.648', '198.880', '1:44.045', 2],
  [4, 15, 29, '51:30.602', '8.501', '0.620', '198.840', '1:44.293', 10],
  [5, 1, 29, '51:31.133', '9.032', '0.531', '198.806', '1:44.328', 10],
  [6, 9, 29, '51:37.401', '15.300', '6.268', '198.404', '1:43.526', 25],
  [7, 5, 29, '51:37.759', '15.658', '0.358', '198.381', '1:43.021', 27],
  [8, 8, 29, '51:39.321', '17.220', '1.562', '198.281', '1:44.471', 10],
  [9, 2, 29, '51:39.533', '17.432', '0.212', '198.267', '1:43.480', 27],
  [10, 17, 29, '51:49.154', '27.053', '9.621', '197.654', '1:44.607', 10],
  [11, 25, 29, '51:51.239', '29.138', '2.085', '197.521', '1:43.266', 23],
  [12, 7, 29, '51:53.387', '31.286', '2.148', '197.385', '1:44.584', 10],
  [13, 22, 29, '51:54.834', '32.733', '1.447', '197.293', '1:44.830', 16],
  [14, 3, 29, '51:55.444', '33.343', '0.610', '197.255', '1:45.165', 11],
  [15, 12, 29, '51:55.568', '33.467', '0.124', '197.247', '1:43.733', 28],
  [16, 4, 29, '51:55.855', '33.754', '0.287', '197.229', '1:44.599', 10],
  [17, 24, 29, '51:57.370', '35.269', '1.515', '197.133', '1:44.451', 9],
  [18, 10, 29, '51:57.532', '35.431', '0.162', '197.123', '1:43.108', 29],
  [19, 21, 29, '52:05.222', '43.121', '7.690', '196.638', '1:43.391', 24],
  [20, 20, 29, '52:06.646', '44.545', '1.424', '196.548', '1:45.541', 8],
];

const featureDNF = [
  ['DNF', 11, 16, '29:16.731', 'DNF', '—', '192.880', '1:44.823', 9],
  ['DNS', 14, '—', '—', 'DNS', '—', '—', '—', '—'],
];

function featurePts(pos, num, featureFlNum) {
  let pts = pos >= 1 && pos <= 10 ? FEATURE_PTS[pos - 1] : 0;
  if (num === POLE_NUM && pos >= 1) pts += 2;
  if (num === featureFlNum && pos >= 1 && pos <= 10) pts += 1;
  return String(pts);
}

const FEATURE_FL_NUM = fastestLapInTop(featureResults);

function featureRow([pos, num, laps, time, gap, int, kph, best, lap]) {
  const p = pos === 'DNF' || pos === 'DNS' ? pos : Number(pos);
  const pts = pos === 'DNF' || pos === 'DNS' ? '0' : featurePts(p, num, FEATURE_FL_NUM);
  const lapStr = lap === '—' ? '—' : String(lap);
  return [String(pos), String(num), NAMES[num], RACE_TEAMS[num], String(laps), time, gap, int, kph, best, lapStr, pts];
}

const raceHeaders = ['Pos', 'No.', 'Driver', 'Team', 'Laps', 'Time', 'Gap', 'Int', 'KPH', 'Best', 'Lap', 'Pts'];
const practiceHeaders = ['Pos', 'No.', 'Driver', 'Team', 'Laps', 'Time', 'Gap', 'Int', 'KPH'];
const qualHeaders = practiceHeaders;

const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
const existing = JSON.parse(fs.readFileSync(eventPath, 'utf8'));

const eventPreview = existing.event_preview;
const eventPreviewRu = existing.event_preview_ru;
const youtubeHighlights = existing.youtube_highlights;

const event = {
  ...existing,
  laps: existing.laps ?? '',
  distance: existing.distance ?? '',
  event_preview: eventPreview,
  event_preview_ru: eventPreviewRu,
  youtube_highlights: youtubeHighlights,
  entry_list: ref.entry_list,
  tables: {
    practice: {
      title: '2026 FIA Formula 2 Championship - Practice',
      subtitle: 'Silverstone',
      meta: {
        Championship: '2026 FIA Formula 2 Championship',
        Session: 'Practice',
        Date: 'Fri 3 Jul 2026',
        Start: '11:00 AM',
        Length: '45 mins',
      },
      headers: practiceHeaders,
      rows: practiceRows,
    },
    qualifying: {
      title: '2026 FIA Formula 2 Championship - Qualifying',
      subtitle: 'Silverstone',
      meta: {
        Championship: '2026 FIA Formula 2 Championship',
        Session: 'Qualifying',
        Date: 'Fri 3 Jul 2026',
        Start: '3:00 PM',
        Length: '30 mins',
      },
      headers: qualHeaders,
      rows: quali.map(qualRowFromData),
    },
    race: {
      sessions: [
        {
          title: 'Sprint Race Results',
          subtitle: 'Silverstone',
          meta: {
            Championship: '2026 FIA Formula 2 Championship',
            Session: 'Sprint Race',
            Date: 'Sat 4 Jul 2026',
          },
          headers: raceHeaders,
          rows: [
            ...sprintResults.map((r) => sprintRow(r, SPRINT_FL_NUM)),
            ...sprintDNF.map((r) => sprintRow(r, SPRINT_FL_NUM)),
          ],
        },
        {
          title: 'Feature Race Results',
          subtitle: 'Silverstone',
          meta: {
            Championship: '2026 FIA Formula 2 Championship',
            Session: 'Feature Race',
            Date: 'Sun 5 Jul 2026',
          },
          headers: raceHeaders,
          rows: [
            ...featureResults.map(featureRow),
            ...featureDNF.map(featureRow),
          ],
        },
      ],
    },
  },
};

fs.writeFileSync(eventPath, JSON.stringify(event, null, 2) + '\n');
console.log('Updated', eventPath);
