#!/usr/bin/env node
/** One-off builder for data/events/NASCAR Cup Series/2026/nascar_cup_2026_16.json */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'data', 'events', 'NASCAR Cup Series', '2026', 'nascar_cup_2026_16.json');

const slug = (name) =>
  name
    .replace(/\s*\(i\)|\s*\(R\)/gi, '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/'/g, '')
    .replace(/\s+/g, '-');

const qualifying = [
  ['1', '11', 'Denny Hamlin', 'Joe Gibbs Racing', 'Toyota', '51.948', '173.250'],
  ['2', '5', 'Kyle Larson', 'Hendrick Motorsports', 'Chevrolet', '52.003', '173.067'],
  ['3', '7', 'Daniel Suarez', 'Spire Motorsports', 'Chevrolet', '52.059', '172.881'],
  ['4', '54', 'Ty Gibbs', 'Joe Gibbs Racing', 'Toyota', '52.092', '172.771'],
  ['5', '19', 'Chase Briscoe', 'Joe Gibbs Racing', 'Toyota', '52.132', '172.639'],
  ['6', '17', 'Chris Buescher', 'RFK Racing', 'Ford', '52.176', '172.493'],
  ['7', '43', 'Erik Jones', 'Legacy Motor Club', 'Toyota', '52.189', '172.450'],
  ['8', '42', 'John Hunter Nemechek', 'Legacy Motor Club', 'Toyota', '52.277', '172.160'],
  ['9', '24', 'William Byron', 'Hendrick Motorsports', 'Chevrolet', '52.331', '171.982'],
  ['10', '12', 'Ryan Blaney', 'Team Penske', 'Ford', '52.366', '171.867'],
  ['11', '22', 'Joey Logano', 'Team Penske', 'Ford', '52.467', '171.536'],
  ['12', '48', 'Alex Bowman', 'Hendrick Motorsports', 'Chevrolet', '52.484', '171.481'],
  ['13', '71', 'Michael McDowell', 'Spire Motorsports', 'Chevrolet', '52.488', '171.468'],
  ['14', '33', 'Austin Hill (i)', 'Richard Childress Racing', 'Chevrolet', '52.537', '171.308'],
  ['15', '41', 'Cole Custer', 'Haas Factory Team', 'Chevrolet', '52.567', '171.210'],
  ['16', '45', 'Tyler Reddick', '23XI Racing', 'Toyota', '52.568', '171.207'],
  ['17', '2', 'Austin Cindric', 'Team Penske', 'Ford', '52.577', '171.178'],
  ['18', '38', 'Zane Smith', 'Front Row Motorsports', 'Ford', '52.591', '171.132'],
  ['19', '16', 'A. J. Allmendinger', 'Kaulig Racing', 'Chevrolet', '52.604', '171.090'],
  ['20', '21', 'Josh Berry', 'Wood Brothers Racing', 'Ford', '52.627', '171.015'],
  ['21', '47', 'Ricky Stenhouse Jr.', 'Hyak Motorsports', 'Chevrolet', '52.656', '170.921'],
  ['22', '20', 'Christopher Bell', 'Joe Gibbs Racing', 'Toyota', '52.724', '170.700'],
  ['23', '9', 'Chase Elliott', 'Hendrick Motorsports', 'Chevrolet', '52.728', '170.687'],
  ['24', '1', 'Ross Chastain', 'Trackhouse Racing', 'Chevrolet', '52.730', '170.681'],
  ['25', '35', 'Riley Herbst', '23XI Racing', 'Toyota', '52.818', '170.396'],
  ['26', '77', 'Carson Hocevar', 'Spire Motorsports', 'Chevrolet', '52.838', '170.332'],
  ['27', '10', 'Ty Dillon', 'Kaulig Racing', 'Chevrolet', '52.859', '170.264'],
  ['28', '88', 'Connor Zilisch (R)', 'Trackhouse Racing', 'Chevrolet', '52.949', '169.975'],
  ['29', '34', 'Todd Gilliland', 'Front Row Motorsports', 'Ford', '53.052', '169.645'],
  ['30', '4', 'Noah Gragson', 'Front Row Motorsports', 'Ford', '53.077', '169.565'],
  ['31', '97', 'Shane van Gisbergen', 'Trackhouse Racing', 'Chevrolet', '53.191', '169.202'],
  ['32', '3', 'Austin Dillon', 'Richard Childress Racing', 'Chevrolet', '53.214', '169.128'],
  ['33', '51', 'Cody Ware', 'Rick Ware Racing', 'Chevrolet', '53.488', '168.262'],
  ['34', '78', 'Daniel Dye (i)', 'Live Fast Motorsports', 'Chevrolet', '53.642', '167.779'],
  ['35', '60', 'Ryan Preece', 'RFK Racing', 'Ford', '53.721', '167.532'],
  ['36', '62', 'Casey Mears', 'Beard Motorsports', 'Chevrolet', '54.212', '166.015'],
  ['37', '6', 'Brad Keselowski', 'RFK Racing', 'Ford', '71.136', '126.518'],
  ['38', '23', 'Bubba Wallace', '23XI Racing', 'Toyota', '0.000', '0.000'],
];

const gridByCar = Object.fromEntries(qualifying.map((r) => [r[1], r[0]]));

const raceResults = [
  [1, 11, 'Denny Hamlin', 'Joe Gibbs Racing', 'Toyota', 160, 47, 'running', 67],
  [2, 45, 'Tyler Reddick', '23XI Racing', 'Toyota', 160, 2, 'running', 35],
  [3, 24, 'William Byron', 'Hendrick Motorsports', 'Chevrolet', 160, 0, 'running', 38],
  [4, 42, 'John Hunter Nemechek', 'Legacy Motor Club', 'Toyota', 160, 8, 'running', 41],
  [5, 5, 'Kyle Larson', 'Hendrick Motorsports', 'Chevrolet', 160, 18, 'running', 41],
  [6, 43, 'Erik Jones', 'Legacy Motor Club', 'Toyota', 160, 0, 'running', 41],
  [7, 17, 'Chris Buescher', 'RFK Racing', 'Ford', 160, 0, 'running', 37],
  [8, 1, 'Ross Chastain', 'Trackhouse Racing', 'Chevrolet', 160, 0, 'running', 34],
  [9, 54, 'Ty Gibbs', 'Joe Gibbs Racing', 'Toyota', 160, 0, 'running', 36],
  [10, 12, 'Ryan Blaney', 'Team Penske', 'Ford', 160, 0, 'running', 27],
  [11, 9, 'Chase Elliott', 'Hendrick Motorsports', 'Chevrolet', 160, 0, 'running', 27],
  [12, 19, 'Chase Briscoe', 'Joe Gibbs Racing', 'Toyota', 160, 0, 'running', 41],
  [13, 7, 'Daniel Suarez', 'Spire Motorsports', 'Chevrolet', 160, 0, 'running', 32],
  [14, 2, 'Austin Cindric', 'Team Penske', 'Ford', 160, 0, 'running', 23],
  [15, 47, 'Ricky Stenhouse Jr.', 'Hyak Motorsports', 'Chevrolet', 160, 0, 'running', 28],
  [16, 35, 'Riley Herbst', '23XI Racing', 'Toyota', 160, 0, 'running', 21],
  [17, 71, 'Michael McDowell', 'Spire Motorsports', 'Chevrolet', 160, 0, 'running', 20],
  [18, 33, 'Austin Hill (i)', 'Richard Childress Racing', 'Chevrolet', 160, 0, 'running', 0],
  [19, 34, 'Todd Gilliland', 'Front Row Motorsports', 'Ford', 160, 6, 'running', 28],
  [20, 77, 'Carson Hocevar', 'Spire Motorsports', 'Chevrolet', 160, 0, 'running', 21],
  [21, 23, 'Bubba Wallace', '23XI Racing', 'Toyota', 160, 0, 'running', 16],
  [22, 16, 'A. J. Allmendinger', 'Kaulig Racing', 'Chevrolet', 160, 0, 'running', 15],
  [23, 88, 'Connor Zilisch (R)', 'Trackhouse Racing', 'Chevrolet', 160, 0, 'running', 14],
  [24, 41, 'Cole Custer', 'Haas Factory Team', 'Chevrolet', 160, 0, 'running', 13],
  [25, 3, 'Austin Dillon', 'Richard Childress Racing', 'Chevrolet', 160, 0, 'running', 12],
  [26, 20, 'Christopher Bell', 'Joe Gibbs Racing', 'Toyota', 160, 0, 'running', 11],
  [27, 48, 'Alex Bowman', 'Hendrick Motorsports', 'Chevrolet', 160, 0, 'running', 10],
  [28, 60, 'Ryan Preece', 'RFK Racing', 'Ford', 159, 0, 'running', 9],
  [29, 78, 'Daniel Dye (i)', 'Live Fast Motorsports', 'Chevrolet', 159, 0, 'running', 0],
  [30, 51, 'Cody Ware', 'Rick Ware Racing', 'Chevrolet', 159, 0, 'running', 7],
  [31, 97, 'Shane van Gisbergen', 'Trackhouse Racing', 'Chevrolet', 158, 0, 'running', 6],
  [32, 10, 'Ty Dillon', 'Kaulig Racing', 'Chevrolet', 158, 0, 'running', 5],
  [33, 21, 'Josh Berry', 'Wood Brothers Racing', 'Ford', 157, 0, 'crash', 4],
  [34, 22, 'Joey Logano', 'Team Penske', 'Ford', 156, 0, 'running', 5],
  [35, 4, 'Noah Gragson', 'Front Row Motorsports', 'Ford', 107, 0, 'crash', 2],
  [36, 62, 'Casey Mears', 'Beard Motorsports', 'Chevrolet', 105, 0, 'mechanical', 1],
  [37, 38, 'Zane Smith', 'Front Row Motorsports', 'Ford', 66, 0, 'crash', 1],
  [38, 6, 'Brad Keselowski', 'RFK Racing', 'Ford', 46, 0, 'crash', 1],
];

const stage1 = [
  ['1', '11', 'Denny Hamlin', 'Joe Gibbs Racing', 'Toyota', '10'],
  ['2', '5', 'Kyle Larson', 'Hendrick Motorsports', 'Chevrolet', '9'],
  ['3', '54', 'Ty Gibbs', 'Joe Gibbs Racing', 'Toyota', '8'],
  ['4', '19', 'Chase Briscoe', 'Joe Gibbs Racing', 'Toyota', '7'],
  ['5', '17', 'Chris Buescher', 'RFK Racing', 'Ford', '6'],
  ['6', '7', 'Daniel Suarez', 'Spire Motorsports', 'Chevrolet', '5'],
  ['7', '24', 'William Byron', 'Hendrick Motorsports', 'Chevrolet', '4'],
  ['8', '43', 'Erik Jones', 'Legacy Motor Club', 'Toyota', '3'],
  ['9', '22', 'Joey Logano', 'Team Penske', 'Ford', '2'],
  ['10', '33', 'Austin Hill (i)', 'Richard Childress Racing', 'Chevrolet', '1'],
];

const stage2 = [
  ['1', '34', 'Todd Gilliland', 'Front Row Motorsports', 'Ford', '10'],
  ['2', '19', 'Chase Briscoe', 'Joe Gibbs Racing', 'Toyota', '9'],
  ['3', '42', 'John Hunter Nemechek', 'Legacy Motor Club', 'Toyota', '8'],
  ['4', '43', 'Erik Jones', 'Legacy Motor Club', 'Toyota', '7'],
  ['5', '47', 'Ricky Stenhouse Jr.', 'Hyak Motorsports', 'Chevrolet', '6'],
  ['6', '1', 'Ross Chastain', 'Trackhouse Racing', 'Chevrolet', '5'],
  ['7', '77', 'Carson Hocevar', 'Spire Motorsports', 'Chevrolet', '4'],
  ['8', '7', 'Daniel Suarez', 'Spire Motorsports', 'Chevrolet', '3'],
  ['9', '11', 'Denny Hamlin', 'Joe Gibbs Racing', 'Toyota', '2'],
  ['10', '9', 'Chase Elliott', 'Hendrick Motorsports', 'Chevrolet', '1'],
];

const crewChiefs = {
  '11': 'Chris Gayle', '5': 'Cliff Daniels', '7': 'Ryan Sparks', '54': 'Tyler Allen', '19': 'James Small',
  '17': 'Scott Graves', '43': 'Justin Alexander', '42': 'Travis Mack', '24': 'Rudy Fugle', '12': 'Jonathan Hassler',
  '22': 'Paul Wolfe', '48': 'Blake Harris', '71': 'Travis Peterson', '33': 'Andy Street', '41': 'Aaron Kramer',
  '45': 'Billy Scott', '2': 'Brian Wilson', '38': 'Ryan Bergenty', '16': 'Trent Owens', '21': 'Samuel Stanley',
  '47': 'Mike Kelley', '20': 'Adam Stevens', '9': 'Alan Gustafson', '1': 'Brandon McSwain', '35': 'Davin Restivo',
  '77': 'Lucas Lambert', '10': 'Mike Cook', '88': 'Randall Burnett', '34': 'Chris Lawson', '4': 'Grant Hutchens',
  '97': 'Stephen Doran', '3': 'Richard Boswell II', '51': 'Billy Plourde', '78': 'George Ingram', '60': 'Derrick Finley',
  '62': 'Darren Shaw', '6': 'Jeremy Bullins', '23': 'Charles Denike',
};

const entryList = qualifying.map((q) => {
  const num = q[1];
  const driver = q[2];
  const entry = {
    number: num,
    driver,
    team: q[3],
    manufacturer: q[4],
    crew_chief: crewChiefs[num] || '',
    driver_slug: slug(driver),
  };
  if (/\(i\)/i.test(driver)) entry.points_eligible = false;
  return entry;
});

const event = {
  event_id: 'NASCAR_CUP_2026_16',
  series: 'NASCAR Cup Series',
  race: 'The Great American Getaway 400',
  date: 'Sunday, June 14, 2026',
  start_date: '2026-06-14',
  end_date: '2026-06-14',
  track: 'Pocono Raceway',
  location: 'Long Pond, Pennsylvania',
  laps: '160',
  distance: '400 mi (643.7 km)',
  stage1_laps: '30',
  stage2_laps: '65',
  stage3_laps: '65',
  event_preview:
    'Pocono Raceway is a 2.5-mile (4.023 km) tri-oval in Long Pond, Pennsylvania, known as the Tricky Triangle for its three distinct turns. The Great American Getaway 400 is the sixteenth points-paying race of the 2026 NASCAR Cup Series season, contested over 400 miles on Sunday, June 14.\n\nDenny Hamlin started from the pole and won his fourth race of 2026 — his third in a row and his record eighth Cup victory at Pocono — holding off Tyler Reddick by 1.678 seconds in a fuel-mileage finish. William Byron finished third. Todd Gilliland scored his first career stage win in Stage 2. Christopher Bell gambled on fuel and finished 26th after running out on the final lap.',
  race_statistics: {
    'Lead changes': '18 among 12 different drivers',
    'Cautions / Laps': '6 for 32 laps',
    'Red flags': '0',
    'Time of race': '2 hours, 56 minutes, and 36 seconds',
    'Average speed': '135.852 miles per hour (218.652 km/h)',
  },
  entry_list: entryList,
  tables: {
    qualifying: {
      headers: ['Pos', 'No.', 'Driver', 'Team', 'Manufacturer', 'Time', 'Speed'],
      rows: qualifying,
    },
    stage_1: {
      headers: ['Pos', 'No', 'Driver', 'Team', 'Manufacturer', 'Points'],
      rows: stage1,
    },
    stage_2: {
      headers: ['Pos', 'No', 'Driver', 'Team', 'Manufacturer', 'Points'],
      rows: stage2,
    },
    race_results: {
      headers: ['Pos', 'Grid', 'No', 'Driver', 'Team', 'Manufacturer', 'Laps', 'Led', 'Status', 'Points'],
      rows: raceResults.map(([pos, car, driver, team, manu, laps, led, status, pts]) => [
        String(pos),
        gridByCar[String(car)] || '',
        String(car),
        driver,
        team,
        manu,
        String(laps),
        String(led),
        status,
        String(pts),
      ]),
    },
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(event, null, 2) + '\n', 'utf8');
console.log('Wrote', outPath);
