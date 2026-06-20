import fs from 'fs';

const TRACK_KM = 4.657;

function lapKph(t) {
  const p = t.split(':');
  const sec = p.length === 2 ? +p[0] * 60 + +p[1] : +p[0] * 3600 + +p[1] * 60 + +p[2];
  return (TRACK_KM / sec * 3600).toFixed(3);
}

function raceKph(laps, timeStr) {
  const p = timeStr.split(':');
  const sec = +p[0] * 60 + +p[1];
  return (laps * TRACK_KM / sec * 3600).toFixed(3);
}

function addRaceTime(base, gapSec) {
  const bp = base.split(':');
  let sec = +bp[0] * 60 + +bp[1] + gapSec;
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

function timeToSec(t) {
  const p = t.split(':');
  return p.length === 2 ? +p[0] * 60 + +p[1] : +p[0] * 3600 + +p[1] * 60 + +p[2];
}

function buildLapRows(items) {
  const leader = timeToSec(items[0].time);
  return items.map((r, i) => {
    const sec = timeToSec(r.time);
    const gap = i === 0 ? '—' : (sec - leader).toFixed(3);
    const int = i === 0 ? '—' : (sec - timeToSec(items[i - 1].time)).toFixed(3);
    return [String(i + 1), r.no, r.driver, r.team, String(r.laps), r.time, gap, int, lapKph(r.time)];
  });
}

function buildRaceRows(items, laps, winnerTime, sprint) {
  const ptsScale = sprint ? [10, 8, 6, 5, 4, 3, 2, 1] : null;
  return items.map((r, i) => {
    const gapSec = r.gapSec ?? 0;
    const time = i === 0 ? winnerTime : addRaceTime(winnerTime, gapSec);
    const gap = i === 0 ? '—' : gapSec.toFixed(3);
    const int = i === 0 ? '—' : (gapSec - (items[i - 1].gapSec ?? 0)).toFixed(3);
    let pts = '0';
    if (r.pts != null) pts = String(r.pts);
    else if (sprint && i < 8) pts = String(ptsScale[i]);
    return [String(i + 1), r.no, r.driver, r.team, String(laps), time, gap, int, raceKph(laps, time), r.best, r.bestLap, pts];
  });
}

const entry_list = [
  {"number": "1", "driver": "Rafael Camara", "team": "Invicta Racing", "driver_slug": "rafael-camara"},
  {"number": "2", "driver": "Joshua Durksen", "team": "Invicta Racing", "driver_slug": "joshua-durksen"},
  {"number": "3", "driver": "Ritomo Miyata", "team": "Hitech", "driver_slug": "ritomo-miyata"},
  {"number": "4", "driver": "Colton Herta", "team": "Hitech", "driver_slug": "colton-herta"},
  {"number": "5", "driver": "Noel Leon", "team": "Campos Racing", "driver_slug": "noel-leon"},
  {"number": "6", "driver": "Nikola Tsolov", "team": "Campos Racing", "driver_slug": "nikola-tsolov"},
  {"number": "7", "driver": "Dino Beganovic", "team": "DAMS Lucas Oil", "driver_slug": "dino-beganovic"},
  {"number": "8", "driver": "Roman Bilinski", "team": "DAMS Lucas Oil", "driver_slug": "roman-bilinski"},
  {"number": "9", "driver": "Gabriele Mini", "team": "MP Motorsport", "driver_slug": "gabriele-mini"},
  {"number": "10", "driver": "Oliver Goethe", "team": "MP Motorsport", "driver_slug": "oliver-goethe"},
  {"number": "11", "driver": "Sebastian Montoya", "team": "Prema Racing", "driver_slug": "sebastian-montoya"},
  {"number": "12", "driver": "Mari Boya", "team": "Prema Racing", "driver_slug": "mari-boya"},
  {"number": "14", "driver": "Martinius Stenshorne", "team": "Rodin Motorsport", "driver_slug": "martinius-stenshorne"},
  {"number": "15", "driver": "Alex Dunne", "team": "Rodin Motorsport", "driver_slug": "alex-dunne"},
  {"number": "16", "driver": "Kush Maini", "team": "ART Grand Prix", "driver_slug": "kush-maini"},
  {"number": "17", "driver": "Tasanapol Inthraphuvasak", "team": "ART Grand Prix", "driver_slug": "tasanapol-inthraphuvasak"},
  {"number": "20", "driver": "Emerson Fittipaldi Jr.", "team": "AIX Racing", "driver_slug": "emerson-fittipaldi-jr"},
  {"number": "21", "driver": "Cian Shields", "team": "AIX Racing", "driver_slug": "cian-shields"},
  {"number": "22", "driver": "Nicolas Varrone", "team": "Van Amersfoort Racing", "driver_slug": "nicolas-varrone"},
  {"number": "23", "driver": "Rafael Villagomez", "team": "Van Amersfoort Racing", "driver_slug": "rafael-villagomez"},
  {"number": "24", "driver": "Laurens van Hoepen", "team": "Trident", "driver_slug": "laurens-van-hoepen"},
  {"number": "25", "driver": "John Bennett", "team": "Trident", "driver_slug": "john-bennett"},
];

const practiceItems = [
  { no: '24', driver: 'L. van Hoepen', team: 'Trident', laps: 9, time: '1:26.776' },
  { no: '8', driver: 'R. Bilinski', team: 'DAMS Lucas Oil', laps: 9, time: '1:26.827' },
  { no: '15', driver: 'A. Dunne', team: 'Rodin Motorsport', laps: 10, time: '1:26.846' },
  { no: '23', driver: 'R. Villagomez', team: 'Van Amersfoort Racing', laps: 10, time: '1:26.907' },
  { no: '14', driver: 'M. Stenshorne', team: 'Rodin Motorsport', laps: 10, time: '1:26.995' },
  { no: '9', driver: 'G. Mini', team: 'MP Motorsport', laps: 10, time: '1:27.001' },
  { no: '1', driver: 'R. Camara', team: 'Invicta Racing', laps: 9, time: '1:27.060' },
  { no: '4', driver: 'C. Herta', team: 'Hitech TGR', laps: 10, time: '1:27.070' },
  { no: '6', driver: 'N. Tsolov', team: 'Campos Racing', laps: 9, time: '1:27.136' },
  { no: '11', driver: 'S. Montoya', team: 'Prema Racing', laps: 9, time: '1:27.142' },
  { no: '3', driver: 'R. Miyata', team: 'Hitech TGR', laps: 10, time: '1:27.174' },
  { no: '16', driver: 'K. Maini', team: 'ART Grand Prix', laps: 9, time: '1:27.191' },
  { no: '22', driver: 'N. Varrone', team: 'Van Amersfoort Racing', laps: 10, time: '1:27.204' },
  { no: '7', driver: 'D. Beganovic', team: 'DAMS Lucas Oil', laps: 9, time: '1:27.263' },
  { no: '12', driver: 'M. Boya', team: 'Prema Racing', laps: 9, time: '1:27.306' },
  { no: '2', driver: 'J. Durksen', team: 'Invicta Racing', laps: 9, time: '1:27.520' },
  { no: '17', driver: 'T. Inthraphuvasak', team: 'ART Grand Prix', laps: 9, time: '1:27.783' },
  { no: '25', driver: 'J. Bennett', team: 'Trident', laps: 9, time: '1:27.924' },
  { no: '20', driver: 'E. Fittipaldi', team: 'AIX Racing', laps: 9, time: '1:28.119' },
  { no: '21', driver: 'C. Shields', team: 'AIX Racing', laps: 9, time: '1:28.377' },
  { no: '5', driver: 'N. Leon', team: 'Campos Racing', laps: 3, time: '1:40.654' },
  { no: '10', driver: 'O. Goethe', team: 'MP Motorsport', laps: 5, time: '1:41.044' },
];

const qualItems = [
  { no: '1', driver: 'R. Camara', team: 'Invicta Racing', laps: 7, time: '1:24.810' },
  { no: '2', driver: 'J. Durksen', team: 'Invicta Racing', laps: 9, time: '1:24.945' },
  { no: '15', driver: 'A. Dunne', team: 'Rodin Motorsport', laps: 8, time: '1:25.035' },
  { no: '9', driver: 'G. Mini', team: 'MP Motorsport', laps: 8, time: '1:25.144' },
  { no: '23', driver: 'R. Villagomez', team: 'Van Amersfoort Racing', laps: 9, time: '1:25.183' },
  { no: '6', driver: 'N. Tsolov', team: 'Campos Racing', laps: 6, time: '1:25.222' },
  { no: '22', driver: 'N. Varrone', team: 'Van Amersfoort Racing', laps: 9, time: '1:25.237' },
  { no: '4', driver: 'C. Herta', team: 'Hitech TGR', laps: 10, time: '1:25.240' },
  { no: '16', driver: 'K. Maini', team: 'ART Grand Prix', laps: 8, time: '1:25.264' },
  { no: '5', driver: 'N. Leon', team: 'Campos Racing', laps: 9, time: '1:25.265' },
  { no: '17', driver: 'T. Inthraphuvasak', team: 'ART Grand Prix', laps: 9, time: '1:25.408' },
  { no: '7', driver: 'D. Beganovic', team: 'DAMS Lucas Oil', laps: 11, time: '1:25.418' },
  { no: '3', driver: 'R. Miyata', team: 'Hitech TGR', laps: 7, time: '1:25.443' },
  { no: '24', driver: 'L. van Hoepen', team: 'Trident', laps: 8, time: '1:25.521' },
  { no: '10', driver: 'O. Goethe', team: 'MP Motorsport', laps: 11, time: '1:25.535' },
  { no: '14', driver: 'M. Stenshorne', team: 'Rodin Motorsport', laps: 10, time: '1:25.574' },
  { no: '8', driver: 'R. Bilinski', team: 'DAMS Lucas Oil', laps: 10, time: '1:25.576' },
  { no: '20', driver: 'E. Fittipaldi', team: 'AIX Racing', laps: 9, time: '1:25.664' },
  { no: '25', driver: 'J. Bennett', team: 'Trident', laps: 8, time: '1:25.736' },
  { no: '11', driver: 'S. Montoya', team: 'Prema Racing', laps: 8, time: '1:25.879' },
  { no: '12', driver: 'M. Boya', team: 'Prema Racing', laps: 8, time: '1:26.019' },
  { no: '21', driver: 'C. Shields', team: 'AIX Racing', laps: 11, time: '1:26.248' },
];

const sprintItems = [
  { no: '16', driver: 'K. Maini', team: 'ART Grand Prix', gapSec: 0, best: '1:30.376', bestLap: '4', pts: 11 },
  { no: '9', driver: 'G. Mini', team: 'MP Motorsport', gapSec: 7.269, best: '1:30.756', bestLap: '8' },
  { no: '6', driver: 'N. Tsolov', team: 'Campos Racing', gapSec: 12.164, best: '1:30.853', bestLap: '8' },
  { no: '5', driver: 'N. Leon', team: 'Campos Racing', gapSec: 12.784, best: '1:31.210', bestLap: '5' },
  { no: '4', driver: 'C. Herta', team: 'Hitech TGR', gapSec: 13.453, best: '1:31.481', bestLap: '3' },
  { no: '1', driver: 'R. Camara', team: 'Invicta Racing', gapSec: 13.828, best: '1:31.285', bestLap: '3' },
  { no: '7', driver: 'D. Beganovic', team: 'DAMS Lucas Oil', gapSec: 16.841, best: '1:31.219', bestLap: '3' },
  { no: '15', driver: 'A. Dunne', team: 'Rodin Motorsport', gapSec: 17.723, best: '1:31.177', bestLap: '3' },
  { no: '17', driver: 'T. Inthraphuvasak', team: 'ART Grand Prix', gapSec: 26.573, best: '1:31.395', bestLap: '3' },
  { no: '11', driver: 'S. Montoya', team: 'Prema Racing', gapSec: 31.007, best: '1:31.432', bestLap: '5' },
  { no: '10', driver: 'O. Goethe', team: 'MP Motorsport', gapSec: 31.893, best: '1:31.284', bestLap: '4' },
  { no: '22', driver: 'N. Varrone', team: 'Van Amersfoort Racing', gapSec: 34.918, best: '1:31.304', bestLap: '4' },
  { no: '25', driver: 'J. Bennett', team: 'Trident', gapSec: 35.514, best: '1:31.378', bestLap: '5' },
  { no: '3', driver: 'R. Miyata', team: 'Hitech TGR', gapSec: 35.814, best: '1:31.561', bestLap: '5' },
  { no: '12', driver: 'M. Boya', team: 'Prema Racing', gapSec: 37.837, best: '1:31.287', bestLap: '5' },
  { no: '20', driver: 'E. Fittipaldi', team: 'AIX Racing', gapSec: 38.367, best: '1:31.638', bestLap: '6' },
  { no: '23', driver: 'R. Villagomez', team: 'Van Amersfoort Racing', gapSec: 38.460, best: '1:31.378', bestLap: '3' },
  { no: '14', driver: 'M. Stenshorne', team: 'Rodin Motorsport', gapSec: 40.402, best: '1:31.395', bestLap: '4' },
  { no: '24', driver: 'L. van Hoepen', team: 'Trident', gapSec: 41.087, best: '1:31.602', bestLap: '4' },
  { no: '2', driver: 'J. Durksen', team: 'Invicta Racing', gapSec: 41.775, best: '1:31.101', bestLap: '6' },
  { no: '8', driver: 'R. Bilinski', team: 'DAMS Lucas Oil', gapSec: 49.523, best: '1:31.486', bestLap: '6' },
  { no: '21', driver: 'C. Shields', team: 'AIX Racing', gapSec: 54.885, best: '1:30.604', bestLap: '17' },
];

const dash = { best: '—', bestLap: '—' };

const featureItems = [
  { no: '1', driver: 'R. Camara', team: 'Invicta Racing', gapSec: 0, pts: 27, ...dash },
  { no: '15', driver: 'A. Dunne', team: 'Rodin Motorsport', gapSec: 12.406, pts: 18, ...dash },
  { no: '9', driver: 'G. Mini', team: 'MP Motorsport', gapSec: 13.468, pts: 15, ...dash },
  { no: '6', driver: 'N. Tsolov', team: 'Campos Racing', gapSec: 14.851, pts: 12, ...dash },
  { no: '24', driver: 'L. van Hoepen', team: 'Trident', gapSec: 16.973, pts: 10, ...dash },
  { no: '7', driver: 'D. Beganovic', team: 'DAMS Lucas Oil', gapSec: 22.187, pts: 8, ...dash },
  { no: '25', driver: 'J. Bennett', team: 'Trident', gapSec: 23.713, pts: 7, best: '1:29.478', bestLap: '26' },
  { no: '5', driver: 'N. Leon', team: 'Campos Racing', gapSec: 27.186, pts: 4, ...dash },
  { no: '16', driver: 'K. Maini', team: 'ART Grand Prix', gapSec: 27.804, pts: 2, ...dash },
  { no: '8', driver: 'R. Bilinski', team: 'DAMS Lucas Oil', gapSec: 29.126, pts: 1, ...dash },
  { no: '23', driver: 'R. Villagomez', team: 'Van Amersfoort Racing', gapSec: 32.407, pts: 0, ...dash },
  { no: '17', driver: 'T. Inthraphuvasak', team: 'ART Grand Prix', gapSec: 33.166, pts: 0, ...dash },
  { no: '22', driver: 'N. Varrone', team: 'Van Amersfoort Racing', gapSec: 36.335, pts: 0, ...dash },
  { no: '2', driver: 'J. Durksen', team: 'Invicta Racing', gapSec: 40.474, pts: 0, ...dash },
  { no: '4', driver: 'C. Herta', team: 'Hitech TGR', gapSec: 41.309, pts: 0, ...dash },
  { no: '11', driver: 'S. Montoya', team: 'Prema Racing', gapSec: 48.471, pts: 0, ...dash },
  { no: '14', driver: 'M. Stenshorne', team: 'Rodin Motorsport', gapSec: 49.767, pts: 0, ...dash },
  { no: '3', driver: 'R. Miyata', team: 'Hitech TGR', gapSec: 50.749, pts: 0, ...dash },
  { no: '20', driver: 'E. Fittipaldi', team: 'AIX Racing', gapSec: 53.624, pts: 0, ...dash },
  { no: '21', driver: 'C. Shields', team: 'AIX Racing', gapSec: 93.632, pts: 0, ...dash },
];

function buildFeatureRows() {
  const winnerTime = '58:35.839';
  const laps = 37;
  const rows = buildRaceRows(featureItems.slice(0, 20), laps, winnerTime, false);
  rows.push(['21', '12', 'M. Boya', 'Prema Racing', '36', '58:35.839', '1 LAP', '—', raceKph(36, winnerTime), '—', '—', '0']);
  rows.push(['DNF', '10', 'O. Goethe', 'MP Motorsport', '4', 'DNF', 'DNF', '—', '—', '—', '—', '0']);
  return rows;
}

const event = {
  event_id: 'F2_2026_5',
  series: 'FIA Formula 2 Championship',
  race: 'Barcelona',
  date: '13–14 June 2026',
  track: 'Circuit de Barcelona-Catalunya',
  location: 'Montmeló',
  start_date: '2026-06-13',
  end_date: '2026-06-14',
  laps: '',
  distance: '',
  event_preview: 'Circuit de Barcelona-Catalunya is a 4.657 km (2.894 mi) permanent road course in Montmeló, north of Barcelona. Round 5 of the 2026 FIA Formula 2 Championship takes place June 12-14, supporting the Spanish Grand Prix. The weekend follows the now-familiar format, with a qualifying session setting the Feature Race grid and determining the reverse-grid order for Saturday\'s Sprint Race.\n\nHeading into Barcelona, Gabriele Minì held a narrow one-point championship lead over Nikola Tsolov following Tsolov\'s victory at Monaco, with Martinius Stenshorne third and Alex Dunne fourth — Dunne having reached the podium at every round so far in 2026. Rafael Câmara, the former FIA Formula 3 champion in his first full F2 season, suffered a heartbreaking retirement at Monaco while battling Tsolov for the lead after a mysterious loss of performance following his pit stop, leaving him eager to bounce back on a circuit he knows well from his junior categories. Colton Herta, the nine-time IndyCar winner racing on a partial schedule, continued his pursuit of a Super Licence heading into the round.\n\nThe all-time Formula 2 qualifying record at Barcelona belongs to Paul Aron, who set a 1:24.766 to claim pole for the 2024 feature race — the fastest lap turned in F2 qualifying at the circuit since the series adopted its current car in 2018.',
  youtube_highlights: [
    { id: '-UwHI7kEt40', title: 'Sprint highlights' },
    { id: 'HSZ695EllLM', title: 'Feature highlights' },
  ],
  entry_list,
  tables: {
    practice: {
      title: '2026 FIA Formula 2 Championship - Practice',
      subtitle: 'Barcelona',
      meta: {
        Championship: '2026 FIA Formula 2 Championship',
        Session: 'Practice',
        Date: 'Fri 12 Jun 2026',
        Start: '09:05 AM',
        Length: '45 mins',
      },
      headers: ['Pos', 'No.', 'Driver', 'Team', 'Laps', 'Time', 'Gap', 'Int', 'KPH'],
      rows: buildLapRows(practiceItems),
    },
    qualifying: {
      title: '2026 FIA Formula 2 Championship - Qualifying',
      subtitle: 'Barcelona',
      meta: {
        Championship: '2026 FIA Formula 2 Championship',
        Session: 'Qualifying',
        Date: 'Fri 12 Jun 2026',
        Start: '01:55 PM',
        Length: '30 mins',
      },
      headers: ['Pos', 'No.', 'Driver', 'Team', 'Laps', 'Time', 'Gap', 'Int', 'KPH'],
      rows: buildLapRows(qualItems),
    },
    race: {
      sessions: [
        {
          title: 'Sprint Race Results',
          subtitle: 'Barcelona',
          meta: {
            Championship: '2026 FIA Formula 2 Championship',
            Session: 'Sprint Race',
            Date: 'Sat 13 Jun 2026',
          },
          headers: ['Pos', 'No.', 'Driver', 'Team', 'Laps', 'Time', 'Gap', 'Int', 'KPH', 'Best', 'Lap', 'Pts'],
          rows: buildRaceRows(sprintItems, 26, '39:55.725', true),
        },
        {
          title: 'Feature Race Results',
          subtitle: 'Barcelona',
          meta: {
            Championship: '2026 FIA Formula 2 Championship',
            Session: 'Feature Race',
            Date: 'Sun 14 Jun 2026',
          },
          headers: ['Pos', 'No.', 'Driver', 'Team', 'Laps', 'Time', 'Gap', 'Int', 'KPH', 'Best', 'Lap', 'Pts'],
          rows: buildFeatureRows(),
        },
      ],
    },
  },
};

const out = new URL('../data/events/F2/2026/f2_2026_5.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify(event, null, 2) + '\n');
console.log('written', out.pathname);
