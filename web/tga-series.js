// tga-series.js — F1 2025 static teams/chassis/engine/tech-spec data for series pages.
// History tables and teams HTML live in web/pages/series.js.
// Depends: lib/state.js. Load before app.js.

(function () {
  'use strict';
  window.TGA = window.TGA || {};

  // F1 2025 teams: canonical data for /season/f1-2025/teams (used when API returns wrong/2026 data)
  var F1_2025_TEAMS = [
    { manufacturer: 'Alpine-Renault', team: 'BWT Alpine F1 Team', number: '7', driver: 'Jack Doohan', rounds: '1–6' },
    { manufacturer: 'Alpine-Renault', team: 'BWT Alpine F1 Team', number: '43', driver: 'Franco Colapinto', rounds: '7–24' },
    { manufacturer: 'Alpine-Renault', team: 'BWT Alpine F1 Team', number: '10', driver: 'Pierre Gasly', rounds: 'All' },
    { manufacturer: 'Aston Martin Aramco-Mercedes', team: 'Aston Martin Aramco F1 Team', number: '14', driver: 'Fernando Alonso', rounds: 'All' },
    { manufacturer: 'Aston Martin Aramco-Mercedes', team: 'Aston Martin Aramco F1 Team', number: '18', driver: 'Lance Stroll', rounds: 'All' },
    { manufacturer: 'Ferrari', team: 'Scuderia Ferrari HP', number: '16', driver: 'Charles Leclerc', rounds: 'All' },
    { manufacturer: 'Ferrari', team: 'Scuderia Ferrari HP', number: '44', driver: 'Lewis Hamilton', rounds: 'All' },
    { manufacturer: 'Haas-Ferrari', team: 'MoneyGram Haas F1 Team', number: '31', driver: 'Esteban Ocon', rounds: 'All' },
    { manufacturer: 'Haas-Ferrari', team: 'MoneyGram Haas F1 Team', number: '87', driver: 'Oliver Bearman', rounds: 'All' },
    { manufacturer: 'Kick Sauber-Ferrari', team: 'Stake F1 Team Kick Sauber', number: '5', driver: 'Gabriel Bortoleto', rounds: 'All' },
    { manufacturer: 'Kick Sauber-Ferrari', team: 'Stake F1 Team Kick Sauber', number: '27', driver: 'Nico Hülkenberg', rounds: 'All' },
    { manufacturer: 'McLaren-Mercedes', team: 'McLaren Formula 1 Team', number: '4', driver: 'Lando Norris', rounds: 'All' },
    { manufacturer: 'McLaren-Mercedes', team: 'McLaren Formula 1 Team', number: '81', driver: 'Oscar Piastri', rounds: 'All' },
    { manufacturer: 'Mercedes', team: 'Mercedes-AMG Petronas F1 Team', number: '12', driver: 'Kimi Antonelli', rounds: 'All' },
    { manufacturer: 'Mercedes', team: 'Mercedes-AMG Petronas F1 Team', number: '63', driver: 'George Russell', rounds: 'All' },
    { manufacturer: 'Racing Bulls-Honda RBPT', team: 'Visa Cash App Racing Bulls F1 Team', number: '6', driver: 'Isack Hadjar', rounds: 'All' },
    { manufacturer: 'Racing Bulls-Honda RBPT', team: 'Visa Cash App Racing Bulls F1 Team', number: '22', driver: 'Yuki Tsunoda', rounds: '1–2' },
    { manufacturer: 'Racing Bulls-Honda RBPT', team: 'Visa Cash App Racing Bulls F1 Team', number: '30', driver: 'Liam Lawson', rounds: '3–24' },
    { manufacturer: 'Red Bull Racing-Honda RBPT', team: 'Oracle Red Bull Racing', number: '1', driver: 'Max Verstappen', rounds: 'All' },
    { manufacturer: 'Red Bull Racing-Honda RBPT', team: 'Oracle Red Bull Racing', number: '30', driver: 'Liam Lawson', rounds: '1–2' },
    { manufacturer: 'Red Bull Racing-Honda RBPT', team: 'Oracle Red Bull Racing', number: '22', driver: 'Yuki Tsunoda', rounds: '3–24' },
    { manufacturer: 'Williams-Mercedes', team: 'Atlassian Williams Racing', number: '23', driver: 'Alexander Albon', rounds: 'All' },
    { manufacturer: 'Williams-Mercedes', team: 'Atlassian Williams Racing', number: '55', driver: 'Carlos Sainz Jr.', rounds: 'All' }
  ];

  // F1 2025 teams: chassis and engine by constructor name (manufacturer)
  // Used for /season/f1-2025/teams and F1_2025_1 entry list.
  var F1_2025_CHASSIS = {
    'Alpine-Renault': 'A525',
    'Aston Martin Aramco-Mercedes': 'AMR25',
    'Ferrari': 'SF-25',
    'Haas-Ferrari': 'VF-25',
    'Kick Sauber-Ferrari': 'C45',
    'McLaren-Mercedes': 'MCL39',
    'Mercedes': 'F1 W16',
    'Racing Bulls-Honda RBPT': 'VCARB02',
    'Red Bull Racing-Honda RBPT': 'RB21',
    'Williams-Mercedes': 'FW47'
  };
  var F1_2025_ENGINE = {
    'Alpine-Renault': 'Renault E-Tech RE25',
    'Aston Martin Aramco-Mercedes': 'Mercedes-AMG F1 M16',
    'Ferrari': 'Ferrari 066/15',
    'Haas-Ferrari': 'Ferrari 066/15',
    'Kick Sauber-Ferrari': 'Ferrari 066/15',
    'McLaren-Mercedes': 'Mercedes-AMG F1 M16',
    'Mercedes': 'Mercedes-AMG F1 M16',
    'Racing Bulls-Honda RBPT': 'Honda RBPTH003',
    'Red Bull Racing-Honda RBPT': 'Honda RBPTH003',
    'Williams-Mercedes': 'Mercedes-AMG F1 M16'
  };

  // Chassis map by driver name for F1 2025 (used on /season/f1-2025/stats).
  var F1_2025_CHASSIS_BY_DRIVER = {};
  F1_2025_TEAMS.forEach(function (row) {
    var man = row.manufacturer;
    var drv = row.driver;
    if (!man || !drv) return;
    var ch = F1_2025_CHASSIS[man];
    if (!ch) return;
    // If one driver appears in multiple rows (extra numbers/rounds),
    // keep the first non-empty value.
    if (!F1_2025_CHASSIS_BY_DRIVER[drv]) {
      F1_2025_CHASSIS_BY_DRIVER[drv] = ch;
    }
  });

  var F1_2025_TECH_SPEC = (typeof window !== 'undefined' && window.F1_2025_TECH_SPEC) || [];

  window.TGA.F1_2025_TEAMS = F1_2025_TEAMS;
  window.TGA.F1_2025_CHASSIS = F1_2025_CHASSIS;
  window.TGA.F1_2025_CHASSIS_BY_DRIVER = F1_2025_CHASSIS_BY_DRIVER;
  window.TGA.F1_2025_ENGINE = F1_2025_ENGINE;
  window.TGA.F1_2025_TECH_SPEC = F1_2025_TECH_SPEC;
})();
