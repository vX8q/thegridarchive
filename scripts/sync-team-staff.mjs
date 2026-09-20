/**
 * Sync staff[] for all team org profiles.
 *
 * - Builds baseline staff from owner / president / team_principal
 * - Applies curated ENRICHED overrides (major orgs, researched)
 * - Writes data/team_org_metadata.json then runs apply-team-org-metadata.mjs
 *
 * Staff rows: { name, role, group, seasons? }
 *   seasons omitted  → applies to every season chip (legacy / stable leadership)
 *   seasons: ["2024"] → only that year on the Staff tab
 *
 * Usage: node scripts/sync-team-staff.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** F1 seasons present in TGA event data. */
const F1Y = ['2024', '2025', '2026'];

function s(name, role, group, seasons) {
  const row = { name, role, group };
  if (seasons != null) {
    const list = (Array.isArray(seasons) ? seasons : [seasons])
      .map((y) => String(y).trim())
      .filter(Boolean);
    if (list.length) row.seasons = list;
  }
  return row;
}

/**
 * Curated staff for high-profile orgs (ASCII names/roles).
 * Sources: official team / F1.com releases; mid-season moves use end-of-year tenure
 * for the year chip (e.g. Mekies on RBR for 2025 after July appointment).
 */
const ENRICHED = {
  // ── F1 ──
  mclaren: {
    team_principal: 'Andrea Stella',
    staff: [
      s('Zak Brown', 'CEO, McLaren Racing', 'management', F1Y),
      s('Andrea Stella', 'Team Principal', 'management', F1Y),
      s('Rob Marshall', 'Chief Designer', 'technical', ['2025', '2026']),
      s('Neil Hannon', 'Racing Director', 'sporting', ['2025', '2026']),
      s('Will Courtenay', 'Sporting Director', 'sporting', ['2026']),
      s('Peter Prodromou', 'Technical Director (Aerodynamics)', 'technical', F1Y),
      s('David Sanchez', 'Technical Director (Concept / Performance)', 'technical', ['2024']),
    ],
  },
  mercedes: {
    team_principal: 'Toto Wolff',
    staff: [
      s('Toto Wolff', 'Team Principal / CEO', 'management', F1Y),
      s('James Allison', 'Technical Director', 'technical', F1Y),
      s('Andrew Shovlin', 'Trackside Engineering Director', 'sporting', F1Y),
      s('Ron Meadows', 'Sporting Director', 'sporting', F1Y),
    ],
  },
  ferrari: {
    team_principal: 'Frederic Vasseur',
    owner: 'Ferrari N.V.',
    staff: [
      s('Frederic Vasseur', 'Team Principal', 'management', F1Y),
      s('Loic Serra', 'Chassis Technical Director', 'technical', ['2025', '2026']),
      s('Enrico Cardile', 'Chassis Technical Director', 'technical', ['2024']),
      s('Diego Tondi', 'Head of Vehicle Performance', 'sporting', ['2025', '2026']),
      // RE pairings (Autosport / Motorsport.com / BBC / PlanetF1):
      // 2024: Bozzi→Leclerc (from Imola; year-chip = end-of-year), Adami→Sainz
      // 2025: Bozzi→Leclerc, Adami→Hamilton (Sainz left after 2024)
      // 2026: Bozzi→Leclerc, Carlo Santi→Hamilton (Adami moved off race engineering)
      s('Bryan Bozzi', 'Race Engineer (Charles Leclerc)', 'sporting', F1Y),
      s('Riccardo Adami', 'Race Engineer (Carlos Sainz)', 'sporting', ['2024']),
      s('Riccardo Adami', 'Race Engineer (Lewis Hamilton)', 'sporting', ['2025']),
      s('Carlo Santi', 'Race Engineer (Lewis Hamilton)', 'sporting', ['2026']),
    ],
  },
  'red-bull-racing': {
    team_principal: 'Laurent Mekies',
    staff: [
      s('Christian Horner', 'Team Principal / CEO', 'management', ['2024']),
      s('Laurent Mekies', 'Team Principal / CEO', 'management', ['2025', '2026']),
      s('Pierre Wache', 'Technical Director', 'technical', F1Y),
      s('Jonathan Wheatley', 'Sporting Director', 'sporting', ['2024']),
      s('Gianpiero Lambiase', 'Race Engineer (Max Verstappen)', 'sporting', ['2024']),
      s('Gianpiero Lambiase', 'Head of Racing / Race Engineer (Max Verstappen)', 'sporting', [
        '2025',
        '2026',
      ]),
      // Richard Wood: Lawson (races 1-2, 2025) → Tsunoda (from Japanese GP) → Hadjar (2026).
      // Sources: RacingNews365, Motorsport.com, AutoHebdo, GPBlog.
      s('Richard Wood', 'Race Engineer (Liam Lawson)', 'sporting', ['2025']),
      s('Richard Wood', 'Race Engineer (Yuki Tsunoda)', 'sporting', ['2025']),
      s('Richard Wood', 'Race Engineer (Isack Hadjar)', 'sporting', ['2026']),
      s('Ben Waterhouse', 'Chief Performance and Design Engineer', 'technical', ['2026']),
      s('Helmut Marko', 'Motorsport Advisor', 'management', ['2024', '2025']),
    ],
  },
  williams: {
    team_principal: 'James Vowles',
    staff: [
      s('James Vowles', 'Team Principal', 'management', F1Y),
      s('Pat Fry', 'Chief Technical Officer', 'technical', ['2024', '2025']),
      s('David Wheater', 'Head of Aerodynamics', 'technical', F1Y),
    ],
  },
  'racing-bulls': {
    team_principal: 'Alan Permane',
    staff: [
      s('Laurent Mekies', 'Team Principal', 'management', ['2024']),
      s('Alan Permane', 'Racing Director', 'sporting', ['2024']),
      s('Alan Permane', 'Team Principal', 'management', ['2025', '2026']),
      s('Peter Bayer', 'CEO', 'management', F1Y),
      s('Jody Egginton', 'Technical Director', 'technical', ['2024', '2025']),
      // Hadjar's Racing Bulls RE in 2025 (RacingNews365 / Motorsport.com / GPBlog).
      s('Pierre Hamelin', 'Race Engineer (Isack Hadjar)', 'sporting', ['2025']),
    ],
  },
  'aston-martin': {
    team_principal: 'Adrian Newey',
    owner: 'Lawrence Stroll',
    staff: [
      s('Lawrence Stroll', 'Owner / Executive Chairman', 'management', F1Y),
      s('Mike Krack', 'Team Principal', 'management', ['2024', '2025']),
      s('Adrian Newey', 'Managing Technical Partner', 'technical', ['2025']),
      s('Adrian Newey', 'Team Principal / Managing Technical Partner', 'management', ['2026']),
      s('Andy Cowell', 'CEO, Aston Martin Performance Technologies', 'management', ['2025', '2026']),
      s('Bob Bell', 'Executive Director, Technical', 'technical', ['2024']),
    ],
  },
  haas: {
    team_principal: 'Ayao Komatsu',
    owner: 'Gene Haas',
    staff: [
      s('Gene Haas', 'Owner', 'management', F1Y),
      s('Ayao Komatsu', 'Team Principal', 'management', F1Y),
      s('Joe Custer', 'President / Board Member', 'management', F1Y),
      s('Andrea De Zordo', 'Technical Director', 'technical', ['2025', '2026']),
    ],
  },
  audi: {
    team_principal: 'Jonathan Wheatley',
    owner: 'Audi AG',
    staff: [
      s('Jonathan Wheatley', 'Team Principal', 'management', ['2025', '2026']),
      s('Mattia Binotto', 'Chief Operating and Technical Officer', 'management', ['2025', '2026']),
      s('Allan McNish', 'Racing Director', 'sporting', ['2025', '2026']),
    ],
  },
  'kick-sauber': {
    team_principal: 'Jonathan Wheatley',
    owner: 'Audi',
    staff: [
      s('Alessandro Alunni Bravi', 'Team Representative', 'management', ['2024']),
      s('Jonathan Wheatley', 'Team Principal', 'management', ['2025', '2026']),
      s('Mattia Binotto', 'Chief Operating and Technical Officer', 'management', ['2025', '2026']),
      s('Allan McNish', 'Racing Director', 'sporting', ['2025', '2026']),
    ],
  },
  alpine: {
    team_principal: 'Flavio Briatore',
    owner: 'Renault Group',
    staff: [
      s('Bruno Famin', 'Team Principal / VP Motorsports Alpine', 'management', ['2024']),
      s('Oliver Oakes', 'Team Principal', 'management', ['2025']),
      s('Flavio Briatore', 'Executive Advisor', 'management', ['2025', '2026']),
      s('Steve Nielsen', 'Managing Director', 'management', ['2026']),
      s('David Sanchez', 'Executive Technical Director', 'technical', ['2025', '2026']),
      s('Matt Harman', 'Technical Director', 'technical', ['2024']),
    ],
  },
  cadillac: {
    team_principal: 'Marcin Budkowski',
    owner: 'General Motors / TWG Motorsports',
    staff: [
      s('Marcin Budkowski', 'Team Principal', 'management', ['2026']),
      s('Graeme Lowdon', 'CEO, Cadillac Formula 1 Team', 'management', ['2026']),
      s('Nick Chester', 'Chassis Technical Director', 'technical', ['2026']),
    ],
  },

  // ── NASCAR Cup majors (leadership largely stable; omit seasons = all years) ──
  'hendrick-motorsports': {
    owner: 'Rick Hendrick',
    president: 'Jeff Andrews',
    staff: [
      s('Rick Hendrick', 'Owner', 'management'),
      s('Jeff Gordon', 'Vice Chairman', 'management'),
      s('Jeff Andrews', 'President and General Manager', 'management'),
      s('Marshall Carlson', 'President, Hendrick Companies', 'management'),
      s('Chad Knaus', 'Vice President of Competition', 'sporting'),
      s('Brian Whitesell', 'Vice President of Manufacturing', 'technical'),
      s('Alba Colon', 'Director, Technical Partnerships', 'technical'),
      s('Ashly Ennis', 'Director of Racing Communications', 'operations'),
    ],
  },
  'joe-gibbs-racing': {
    owner: 'Joe Gibbs',
    president: 'Coy Gibbs',
    staff: [
      s('Joe Gibbs', 'Owner', 'management'),
      s('Coy Gibbs', 'President', 'management'),
      s('Dave Alpern', 'President of Business Operations', 'operations'),
      s('Chris Gabehart', 'Competition Director', 'sporting'),
    ],
  },
  'team-penske': {
    owner: 'Roger Penske',
    president: 'Michael Nelson',
    staff: [
      s('Roger Penske', 'Owner', 'management'),
      s('Michael Nelson', 'President, Penske Racing South (NASCAR)', 'management'),
      s('Jonathan Diuguid', 'President, Penske Racing (IndyCar)', 'management'),
      s('Travis Geisler', 'Vice President of NASCAR Competition', 'sporting'),
      s('Travis Law', 'Competition Director, IndyCar', 'sporting'),
    ],
  },
  'richard-childress-racing': {
    owner: 'Richard Childress',
    president: 'Mike Dillon',
    staff: [
      s('Richard Childress', 'Chairman and CEO', 'management'),
      s('Mike Dillon', 'Chief Operating Officer', 'management'),
      s('John Klausmeier', 'Technical Director', 'technical'),
      s('Andy Street', 'Performance Director', 'sporting'),
    ],
  },
  'jr-motorsports': {
    owner: 'Dale Earnhardt Jr., Kelley Earnhardt Miller',
    president: 'Kelley Earnhardt Miller',
    staff: [
      s('Dale Earnhardt Jr.', 'Owner', 'management'),
      s('Kelley Earnhardt Miller', 'Owner / President', 'management'),
    ],
  },
  'rfk-racing': {
    owner: 'Jack Roush / Brad Keselowski',
    president: 'Joey Cohen',
    staff: [
      s('Jack Roush', 'Co-Owner', 'management'),
      s('Brad Keselowski', 'Co-Owner / Driver', 'management'),
      s('Joey Cohen', 'President', 'management'),
    ],
  },
  'trackhouse-racing': {
    owner: 'Justin Marks / Pitbull',
    president: 'Todd Meredith',
    staff: [
      s('Justin Marks', 'Owner', 'management'),
      s('Pitbull', 'Co-Owner', 'management'),
      s('Todd Meredith', 'President', 'management'),
      s('Darian Grubb', 'Competition Director', 'sporting'),
    ],
  },
  '23xi-racing': {
    owner: 'Michael Jordan / Denny Hamlin',
    president: 'Curtis Polk',
    staff: [
      s('Michael Jordan', 'Co-Owner', 'management'),
      s('Denny Hamlin', 'Co-Owner', 'management'),
      s('Curtis Polk', 'President', 'management'),
      s("Steve O'Donnell", 'President of Competition and Operations', 'sporting'),
    ],
  },
  'haas-factory-team': {
    owner: 'Gene Haas',
    president: 'Joe Custer',
    staff: [
      s('Gene Haas', 'Owner', 'management'),
      s('Joe Custer', 'President', 'management'),
    ],
  },
  'kaulig-racing': {
    owner: 'Matt Kaulig',
    president: 'Chris Rice',
    staff: [
      s('Matt Kaulig', 'Owner', 'management'),
      s('Chris Rice', 'President', 'management'),
    ],
  },
  'legacy-motor-club': {
    owner: 'Jimmie Johnson / Maury Gallagher / Planet Fitness',
    president: 'T. J. Majors',
    staff: [
      s('Jimmie Johnson', 'Co-Owner', 'management'),
      s('Maury Gallagher', 'Co-Owner', 'management'),
      s('T. J. Majors', 'President', 'management'),
    ],
  },
  'front-row-motorsports': {
    owner: 'Bob Jenkins',
    president: 'Jerry Freeze',
    staff: [
      s('Bob Jenkins', 'Owner', 'management'),
      s('Jerry Freeze', 'General Manager', 'management'),
    ],
  },
  'spire-motorsports': {
    owner: 'Jeff Dickerson / T. J. Gizzo',
    staff: [
      s('Jeff Dickerson', 'Co-Owner', 'management'),
      s('T. J. Gizzo', 'Co-Owner', 'management'),
    ],
  },
  'rick-ware-racing': {
    owner: 'Rick Ware',
    staff: [s('Rick Ware', 'Owner', 'management')],
  },
  'wood-brothers-racing': {
    owner: 'Wood family',
    president: 'Eddie Wood / Len Wood',
    staff: [
      s('Eddie Wood', 'Co-Owner / President', 'management'),
      s('Len Wood', 'Co-Owner / President', 'management'),
    ],
  },

  // ── IndyCar ──
  'chip-ganassi-racing': {
    owner: 'Chip Ganassi',
    staff: [
      s('Chip Ganassi', 'Owner', 'management'),
      s('Mike Hull', 'Managing Director', 'management'),
    ],
  },
  'andretti-global': {
    owner: 'Michael Andretti',
    team_principal: 'Ron Ruzewski',
    staff: [
      s('Michael Andretti', 'Owner', 'management'),
      s('Rob Edwards', 'COO, Andretti Global', 'management'),
      s('Ron Ruzewski', 'Team Principal, IndyCar / Indy NXT', 'sporting'),
    ],
  },
  'arrow-mclaren': {
    owner: 'McLaren Racing',
    team_principal: 'Tony Kanaan',
    staff: [
      s('Zak Brown', 'CEO, McLaren Racing', 'management'),
      s('Tony Kanaan', 'Team Principal', 'management'),
      s('Gavin Ward', 'Director of Performance Engineering', 'technical'),
    ],
  },
  'rahal-letterman-lanigan-racing': {
    owner: 'Bobby Rahal / David Letterman / Mike Lanigan',
    staff: [
      s('Bobby Rahal', 'Co-Owner', 'management'),
      s('David Letterman', 'Co-Owner', 'management'),
      s('Mike Lanigan', 'Co-Owner', 'management'),
      s('Ricky Taylor', 'Sporting Director', 'sporting'),
    ],
  },
  'meyer-shank-racing-with-curb-agajanian': {
    owner: 'Michael Shank / Jim Meyer',
    staff: [
      s('Michael Shank', 'Co-Owner', 'management'),
      s('Jim Meyer', 'Co-Owner', 'management'),
    ],
  },
  'ed-carpenter-racing': {
    owner: 'Ed Carpenter',
    staff: [s('Ed Carpenter', 'Owner / Driver', 'management')],
  },
  'dale-coyne-racing': {
    owner: 'Dale Coyne',
    staff: [s('Dale Coyne', 'Owner', 'management')],
  },
  'a-j-foyt-enterprises': {
    owner: 'A. J. Foyt',
    staff: [s('A. J. Foyt', 'Owner', 'management')],
  },
  'juncos-hollinger-racing': {
    owner: 'Ricardo Juncos / Brad Hollinger',
    staff: [
      s('Ricardo Juncos', 'Co-Owner / Team Principal', 'management'),
      s('Brad Hollinger', 'Co-Owner', 'management'),
    ],
  },

  // ── IMSA notables ──
  'porsche-penske-motorsport': {
    owner: 'Porsche / Roger Penske',
    staff: [
      s('Roger Penske', 'Owner', 'management'),
      s('Jonathan Diuguid', 'Managing Director', 'management'),
      s('Urs Kuratle', 'Director of Factory Motorsport LMDh', 'sporting'),
    ],
  },
  'cadillac-whelen': {
    owner: 'General Motors / Whelen',
    staff: [
      s('Laura Whelen Quigley', 'Owner, Whelen Engineering', 'management'),
    ],
  },
  'bmw-m-team-wrt': {
    staff: [
      s('Vincent Vosse', 'Team Principal, WRT', 'management'),
      s('Andreas Roos', 'Head of BMW M Motorsport', 'management'),
    ],
  },
  'af-corse': {
    staff: [
      s('Amato Ferrari', 'Team Principal', 'management'),
    ],
  },
  'corvette-racing-by-pratt-miller-motorsports': {
    staff: [
      s('Jim Miller', 'Co-Owner, Pratt Miller', 'management'),
      s('Gary Pratt', 'Co-Owner, Pratt Miller', 'management'),
    ],
  },
  'meyer-shank-racing': {
    owner: 'Michael Shank / Jim Meyer',
    staff: [
      s('Michael Shank', 'Co-Owner', 'management'),
      s('Jim Meyer', 'Co-Owner', 'management'),
    ],
  },

  // ── Other notable ──
  'prema-racing': {
    owner: 'Angelo Rosin / Rene Rosin',
    staff: [
      s('Angelo Rosin', 'Owner', 'management'),
      s('Rene Rosin', 'Team Principal', 'management'),
    ],
  },
  'invicta-racing': {
    team_principal: 'Andy Roche',
    staff: [s('Andy Roche', 'Team Principal', 'management')],
  },
  'aix-racing': {
    owner: 'Paul Muller',
    staff: [s('Paul Muller', 'Owner', 'management')],
  },
  'phm-racing': {
    owner: 'Paul Muller',
    staff: [s('Paul Muller', 'Owner', 'management')],
  },
  'r-ace-gp': {
    owner: 'Bertrand Pugnet',
    staff: [s('Bertrand Pugnet', 'Founder / Owner', 'management')],
  },
  'sainteloc-racing': {
    team_principal: 'Philippe Sinault',
    staff: [s('Philippe Sinault', 'Team Principal', 'management')],
  },
  'herberth-motorsport': {
    owner: 'Alfred Herberth',
    staff: [s('Alfred Herberth', 'Owner / Team Principal', 'management')],
  },
  'tds-racing': {
    team_principal: 'Xavier Combet',
    staff: [s('Xavier Combet', 'Team Principal', 'management')],
  },
  'nielsen-racing': {
    owner: 'David Nielsen',
    staff: [s('David Nielsen', 'Owner', 'management')],
  },
  'high-class-racing': {
    owner: 'Anders Fjordbach / Dennis Andersen',
    staff: [
      s('Anders Fjordbach', 'Co-owner', 'management'),
      s('Dennis Andersen', 'Co-owner', 'management'),
    ],
  },
  'optimum-motorsport': {
    owner: 'Shaun Goff',
    staff: [s('Shaun Goff', 'Owner / Team Principal', 'management')],
  },
  'vector-sport': {
    owner: 'Phil Hall',
    staff: [s('Phil Hall', 'Owner / Team Principal', 'management')],
  },
  getspeed: {
    owner: 'Adam Osieka',
    staff: [s('Adam Osieka', 'Owner / Team Principal', 'management')],
  },
  'rutronik-racing': {
    owner: 'Michael Rebhan',
    staff: [s('Michael Rebhan', 'Owner / Team Principal', 'management')],
  },
  'schumacher-clrt': {
    owner: 'Christophe Lemeret',
    staff: [s('Christophe Lemeret', 'Owner', 'management')],
  },
  'dinamic-motorsport': {
    owner: 'Roberto Paladino',
    staff: [s('Roberto Paladino', 'Owner / Team Principal', 'management')],
  },

  // ── Junior single-seaters (F2 / F3 / FREC / Italian F4) ──
  'art-grand-prix': {
    owner: 'Nicolas Todt',
    team_principal: 'Sebastien Philippe',
    staff: [
      s('Nicolas Todt', 'Co-founder / Owner', 'management'),
      s('Sebastien Philippe', 'Team Principal', 'management'),
    ],
  },
  'campos-racing': {
    team_principal: 'Adrian Campos Jr.',
    staff: [
      s('Adrian Campos', 'Founder', 'management'),
      s('Adrian Campos Jr.', 'Team Principal', 'management'),
    ],
  },
  'dams-lucas-oil': {
    owner: 'Gregory Driot / Olivier Driot',
    staff: [
      s('Gregory Driot', 'Co-owner / Team Principal', 'management'),
      s('Olivier Driot', 'Co-owner', 'management'),
    ],
  },
  hitech: {
    owner: 'Oliver Oakes',
    staff: [s('Oliver Oakes', 'Founder', 'management')],
  },
  'mp-motorsport': {
    owner: 'Sander Dorsman',
    staff: [s('Sander Dorsman', 'Owner / Team Principal', 'management')],
  },
  'rodin-motorsport': {
    owner: 'David Dicker',
    staff: [s('David Dicker', 'Owner', 'management')],
  },
  trident: {
    owner: 'Maurizio Salvadori',
    staff: [s('Maurizio Salvadori', 'Owner / Team Principal', 'management')],
  },
  'van-amersfoort-racing': {
    owner: 'Frits van Amersfoort',
    staff: [
      s('Frits van Amersfoort', 'Founder / Owner', 'management'),
      s('Rob Niessink', 'CEO', 'management'),
    ],
  },
  'us-racing': {
    owner: 'Ralf Schumacher / Gerhard Ungar',
    staff: [
      s('Ralf Schumacher', 'Co-founder / Co-owner', 'management'),
      s('Gerhard Ungar', 'Co-founder / Team Principal', 'management'),
    ],
  },
  'jenzer-motorsport': {
    owner: 'Andreas Jenzer',
    staff: [s('Andreas Jenzer', 'Founder / Team Principal', 'management')],
  },
  'zengo-motorsport': {
    owner: 'Zoltan Zengo',
    staff: [s('Zoltan Zengo', 'Founder / Owner', 'management')],
  },

  // ── Supercars ──
  'triple-eight-race-engineering': {
    owner: 'Tony Quinn',
    team_principal: 'Jamie Whincup',
    staff: [
      s('Tony Quinn', 'Owner', 'management'),
      s('Jamie Whincup', 'Co-owner / Team Principal', 'management'),
    ],
  },
  'dick-johnson-racing': {
    owner: 'Dick Johnson / Ryan Story',
    team_principal: 'Ryan Story',
    staff: [
      s('Dick Johnson', 'Co-owner', 'management'),
      s('Ryan Story', 'Co-owner / Managing Director', 'management'),
    ],
  },
  'walkinshaw-twg-racing': {
    owner: 'Ryan Walkinshaw / TWG Motorsports',
    staff: [
      s('Ryan Walkinshaw', 'Co-owner', 'management'),
      s('Zak Brown', 'Co-owner', 'management'),
    ],
  },
  'erebus-motorsport': {
    owner: 'Betty Klimenko',
    staff: [
      s('Betty Klimenko', 'Owner', 'management'),
      s('Barry Ryan', 'CEO', 'management'),
    ],
  },
  'brad-jones-racing': {
    owner: 'Brad Jones / Kim Jones',
    staff: [
      s('Brad Jones', 'Co-owner / Team Principal', 'management'),
      s('Kim Jones', 'Co-owner', 'management'),
    ],
  },
  'tickford-racing': {
    owner: 'Rod Nash',
    staff: [s('Rod Nash', 'Owner', 'management')],
  },
  'grove-racing': {
    owner: 'Stephen Grove / Brenton Grove',
    staff: [
      s('Stephen Grove', 'Co-owner', 'management'),
      s('Brenton Grove', 'Co-owner', 'management'),
    ],
  },
  'matt-stone-racing': {
    owner: 'Matt Stone / Jimmy Stone',
    staff: [
      s('Matt Stone', 'Co-owner / Team Principal', 'management'),
      s('Jimmy Stone', 'Co-owner', 'management'),
    ],
  },
  'team-18': {
    owner: 'Charlie Schwerkolt',
    staff: [s('Charlie Schwerkolt', 'Owner', 'management')],
  },
  'blanchard-racing-team': {
    owner: 'Tim Blanchard',
    staff: [s('Tim Blanchard', 'Owner', 'management')],
  },
  'premiair-racing': {
    owner: 'Peter Xiberras',
    staff: [s('Peter Xiberras', 'Owner', 'management')],
  },

  // ── DTM ──
  'schubert-motorsport': {
    owner: 'Torsten Schubert',
    staff: [s('Torsten Schubert', 'Owner / Team Principal', 'management')],
  },
  'red-bull-team-abt': {
    owner: 'Abt Sportsline',
    staff: [
      s('Hans-Jurgen Abt', 'CEO, Abt Sportsline', 'management'),
      s('Thomas Biermaier', 'CEO / Team Principal', 'management'),
    ],
  },
  'manthey-racing': {
    staff: [
      s('Olaf Manthey', 'Founder', 'management'),
      s('Nicolas Raeder', 'CEO', 'management'),
    ],
  },
  'manthey-1st-phorm': {
    staff: [
      s('Olaf Manthey', 'Founder', 'management'),
      s('Nicolas Raeder', 'CEO', 'management'),
    ],
  },
  'dorr-motorsport': {
    owner: 'Rainer Dorr',
    staff: [
      s('Rainer Dorr', 'Founder / Owner', 'management'),
      s('Ben Dorr', 'Team Manager', 'operations'),
    ],
  },
  'mercedes-amg-team-landgraf': {
    owner: 'Klaus Landgraf',
    staff: [s('Klaus Landgraf', 'Owner / Team Principal', 'management')],
  },
  'emil-frey-racing': {
    owner: 'Lorenz Frey-Hilti',
    staff: [s('Lorenz Frey-Hilti', 'Owner', 'management')],
  },
  'comtoyou-racing': {
    owner: 'Jean-Michel Baert',
    staff: [s('Jean-Michel Baert', 'Founder / Owner', 'management')],
  },
  'tgi-team-by-grt': {
    owner: 'Gottfried Grasser',
    staff: [s('Gottfried Grasser', 'Owner / Team Principal', 'management')],
  },
  'land-motorsport': {
    owner: 'Wolfgang Land',
    staff: [
      s('Wolfgang Land', 'Founder / Owner', 'management'),
      s('Christian Land', 'Team Manager', 'operations'),
    ],
  },
  'hrt-ford-racing': {
    owner: 'Hubert Haupt',
    staff: [
      s('Hubert Haupt', 'Founder / Owner', 'management'),
      s('Ulrich Fritz', 'Managing Director', 'management'),
    ],
  },

  // ── Endurance / GT (IMSA, ELMS, GTWCE) ──
  'united-autosports': {
    owner: 'Richard Dean / Zak Brown',
    staff: [
      s('Richard Dean', 'Co-owner / CEO', 'management'),
      s('Zak Brown', 'Co-owner', 'management'),
    ],
  },
  'united-autosports-usa': {
    owner: 'Richard Dean / Zak Brown',
    staff: [
      s('Richard Dean', 'Co-owner / CEO', 'management'),
      s('Zak Brown', 'Co-owner', 'management'),
    ],
  },
  'team-wrt': {
    team_principal: 'Vincent Vosse',
    staff: [s('Vincent Vosse', 'Founder / Team Principal', 'management')],
  },
  'proton-competition': {
    owner: 'Christian Ried',
    staff: [s('Christian Ried', 'Founder / Owner', 'management')],
  },
  'iron-lynx': {
    owner: 'Claudio Schiavoni',
    staff: [
      s('Claudio Schiavoni', 'Founder / Owner', 'management'),
      s('Andrea Piccini', 'Team Principal', 'management'),
    ],
  },
  'team-qatar-by-iron-lynx': {
    owner: 'Claudio Schiavoni',
    staff: [
      s('Claudio Schiavoni', 'Founder / Owner', 'management'),
      s('Andrea Piccini', 'Team Principal', 'management'),
    ],
  },
  'inter-europol-competition': {
    owner: 'Mariusz Lisiewicz',
    staff: [s('Mariusz Lisiewicz', 'Founder / Owner', 'management')],
  },
  'algarve-pro-racing': {
    owner: 'Stewart Cox',
    staff: [s('Stewart Cox', 'Owner / Team Principal', 'management')],
  },
  'duqueine-team': {
    owner: 'Jean-Marc Duqueine',
    staff: [s('Jean-Marc Duqueine', 'Owner', 'management')],
  },
  'tf-sport': {
    owner: 'Tom Ferrier',
    staff: [s('Tom Ferrier', 'Founder / Owner', 'management')],
  },
  'ao-by-tf': {
    owner: 'PJ Hyett',
    staff: [
      s('PJ Hyett', 'Owner', 'management'),
      s('Tom Ferrier', 'Team Principal, TF Sport', 'management'),
    ],
  },
  'ao-racing': {
    owner: 'PJ Hyett',
    staff: [
      s('PJ Hyett', 'Owner', 'management'),
      s('Gunnar Jeannette', 'Team Principal', 'management'),
    ],
  },
  'idec-sport': {
    owner: 'Patrice Lafargue',
    staff: [
      s('Patrice Lafargue', 'Owner', 'management'),
      s('Paul Lafargue', 'Co-owner', 'management'),
    ],
  },
  'kessel-racing': {
    owner: 'Ronnie Kessel',
    staff: [
      s('Loris Kessel', 'Founder', 'management'),
      s('Ronnie Kessel', 'CEO / Team Principal', 'management'),
    ],
  },
  'garage-59': {
    owner: 'Andrew Kirkaldy',
    staff: [s('Andrew Kirkaldy', 'Co-owner / Team Principal', 'management')],
  },
  'rowe-racing': {
    team_principal: 'Hans-Peter Naundorf',
    staff: [s('Hans-Peter Naundorf', 'Founder / Team Principal', 'management')],
  },
  'boutsen-vds': {
    owner: 'Thierry Boutsen',
    staff: [s('Thierry Boutsen', 'Co-owner', 'management')],
  },
  'winward-racing': {
    owner: 'Bryce Ward',
    staff: [
      s('Bryce Ward', 'Owner', 'management'),
      s('Russell Ward', 'Co-owner', 'management'),
    ],
  },
  'wright-motorsports': {
    owner: 'John Wright',
    staff: [s('John Wright', 'Owner / Team Principal', 'management')],
  },
  'paul-miller-racing': {
    owner: 'Paul Miller',
    staff: [s('Paul Miller', 'Owner', 'management')],
  },
  'turner-motorsport': {
    owner: 'Will Turner',
    staff: [s('Will Turner', 'Owner / Team Principal', 'management')],
  },
  'risi-competizione': {
    owner: 'Giuseppe Risi',
    staff: [s('Giuseppe Risi', 'Owner', 'management')],
  },
  'wayne-taylor-racing': {
    owner: 'Wayne Taylor',
    staff: [s('Wayne Taylor', 'Owner / Team Principal', 'management')],
  },
  dragonspeed: {
    owner: 'Elton Julian',
    staff: [s('Elton Julian', 'Owner / Team Principal', 'management')],
  },
  'era-motorsport': {
    owner: 'Kyle Tilley',
    staff: [s('Kyle Tilley', 'Owner', 'management')],
  },
  'tower-motorsports': {
    owner: 'John Farano',
    staff: [s('John Farano', 'Owner', 'management')],
  },
  'heart-of-racing-team': {
    owner: 'Gabe Newell',
    team_principal: 'Ian James',
    staff: [
      s('Gabe Newell', 'Owner', 'management'),
      s('Ian James', 'Team Principal', 'management'),
    ],
  },
  'vasser-sullivan-racing': {
    owner: 'Jimmy Vasser / James Sullivan',
    staff: [
      s('Jimmy Vasser', 'Co-owner', 'management'),
      s('James Sullivan', 'Co-owner', 'management'),
    ],
  },
  'magnus-racing': {
    owner: 'John Potter',
    staff: [s('John Potter', 'Owner', 'management')],
  },
  'muhlner-motorsport': {
    owner: 'Bernhard Muhlner',
    staff: [s('Bernhard Muhlner', 'Owner / Team Principal', 'management')],
  },
  'walkenhorst-motorsport': {
    owner: 'Henry Walkenhorst',
    staff: [s('Henry Walkenhorst', 'Owner', 'management')],
  },
  'natural-elements-by-walkenhorst-motorsport': {
    owner: 'Henry Walkenhorst',
    staff: [s('Henry Walkenhorst', 'Owner, Walkenhorst Motorsport', 'management')],
  },
  'jmw-motorsport': {
    owner: 'Jim McWhirter',
    staff: [s('Jim McWhirter', 'Owner', 'management')],
  },
  'pure-rxcing': {
    owner: 'Alex Malykhin',
    staff: [s('Alex Malykhin', 'Owner', 'management')],
  },
  vsr: {
    owner: 'Vincenzo Sospiri',
    staff: [s('Vincenzo Sospiri', 'Founder / Owner', 'management')],
  },

  // ── Japan (Super GT / Super Formula) ──
  'team-impul': {
    owner: 'Kazuyoshi Hoshino',
    staff: [s('Kazuyoshi Hoshino', 'Owner / Team Principal', 'management')],
  },
  'kondo-racing': {
    owner: 'Masahiko Kondo',
    staff: [s('Masahiko Kondo', 'Owner', 'management')],
  },
  'realize-kondo-racing': {
    owner: 'Masahiko Kondo',
    staff: [s('Masahiko Kondo', 'Owner', 'management')],
  },
  'team-mugen-autobacs': {
    owner: 'Hirotoshi Honda',
    staff: [s('Hirotoshi Honda', 'Founder / Owner, M-TEC (Mugen)', 'management')],
  },
  'modulo-nakajima-racing': {
    owner: 'Satoru Nakajima',
    staff: [s('Satoru Nakajima', 'Founder / Owner', 'management')],
  },
  'ponos-nakajima-racing': {
    owner: 'Satoru Nakajima',
    staff: [s('Satoru Nakajima', 'Founder / Owner', 'management')],
  },
  'tgr-team-au-tom-s': {
    staff: [s('Nobuhide Tachi', "Co-founder, TOM'S", 'management')],
  },
  'tgr-team-deloitte-tom-s': {
    staff: [s('Nobuhide Tachi', "Co-founder, TOM'S", 'management')],
  },
  'vantelin-team-tom-s': {
    staff: [s('Nobuhide Tachi', "Co-founder, TOM'S", 'management')],
  },
  'arta-mugen': {
    owner: 'Aguri Suzuki',
    staff: [s('Aguri Suzuki', 'Founder / Team Owner, ARTA', 'management')],
  },
  'team-hrc-arta-mugen': {
    owner: 'Aguri Suzuki',
    staff: [s('Aguri Suzuki', 'Founder / Team Owner, ARTA', 'management')],
  },
  'stanley-team-kunimitsu': {
    staff: [s('Kunimitsu Takahashi', 'Founder', 'management')],
  },
  'team-goh': {
    owner: 'Kazumichi Goh',
    staff: [s('Kazumichi Goh', 'Owner', 'management')],
  },
  'team-eneos-rookie': {
    owner: 'Akio Toyoda',
    staff: [s('Akio Toyoda', 'Owner, Rookie Racing', 'management')],
  },
  'tgr-team-eneos-rookie': {
    owner: 'Akio Toyoda',
    staff: [s('Akio Toyoda', 'Owner, Rookie Racing', 'management')],
  },
  'ntt-docomo-business-rookie': {
    owner: 'Akio Toyoda',
    staff: [s('Akio Toyoda', 'Owner, Rookie Racing', 'management')],
  },
  'goodsmile-racing-teamukyo': {
    staff: [
      s('Ukyo Katayama', 'Team Principal, Team Ukyo', 'management'),
      s('Takanori Aki', 'Owner, Good Smile Racing', 'management'),
    ],
  },
  kcmg: {
    owner: 'Paul Ip',
    staff: [s('Paul Ip', 'Founder', 'management')],
  },
  'carguy-mks-racing': {
    owner: 'Takeshi Kimura',
    staff: [s('Takeshi Kimura', 'Owner', 'management')],
  },
  'hoppy-team-tsuchiya': {
    staff: [s('Keiichi Tsuchiya', 'Founder, Team Tsuchiya', 'management')],
  },
  'd-station-racing': {
    owner: 'Satoshi Hoshino',
    staff: [s('Satoshi Hoshino', 'Owner', 'management')],
  },

  // ── Porsche Supercup ──
  'bwt-lechner-racing': {
    owner: 'Walter Lechner Jr.',
    staff: [
      s('Walter Lechner', 'Founder', 'management'),
      s('Walter Lechner Jr.', 'Team Principal', 'management'),
    ],
  },

  // ── NASCAR national tours (Truck / Xfinity) ──
  'thorsport-racing': {
    owner: 'Duke Thorson',
    staff: [
      s('Duke Thorson', 'Owner', 'management'),
      s('Rhonda Thorson', 'Co-owner', 'management'),
    ],
  },
  'tricon-garage': {
    owner: 'David Gilliland',
    staff: [s('David Gilliland', 'Co-owner', 'management')],
  },
  'halmar-friesen-racing': {
    owner: 'Chris Larsen / Stewart Friesen',
    staff: [
      s('Chris Larsen', 'Co-owner', 'management'),
      s('Stewart Friesen', 'Co-owner / Driver', 'management'),
    ],
  },
  'mcanally-hilgemann-racing': {
    owner: 'Bill McAnally / Chris Hilgemann',
    staff: [
      s('Bill McAnally', 'Co-owner', 'management'),
      s('Chris Hilgemann', 'Co-owner', 'management'),
    ],
  },
  'alpha-prime-racing': {
    owner: 'Tommy Joe Martins / Caesar Bacarella',
    staff: [
      s('Tommy Joe Martins', 'Co-owner', 'management'),
      s('Caesar Bacarella', 'Co-owner', 'management'),
    ],
  },
  'big-machine-racing': {
    owner: 'Scott Borchetta',
    staff: [s('Scott Borchetta', 'Owner', 'management')],
  },
};

function foldKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function shouldSkipOwnerAsStaff(owner, canon) {
  const a = foldKey(owner);
  const b = foldKey(canon);
  if (!a) return true;
  if (a === b) return true;
  // Corporate entity named after / as the org (e.g. "McLaren Racing", "Renault Group")
  if (/\b(gmbh|group|llc|inc|ltd|holdings|automotive|factory|companies)\b/.test(a)) {
    const a0 = a.split(/\s+/)[0];
    const b0 = b.split(/\s+/)[0];
    if (a0 && b0 && (a0 === b0 || a.includes(b0) || b.includes(a0))) return true;
  }
  if (/\b(racing|motorsports|motorsport)\b/.test(a)) {
    const stripped = a.replace(/\s+(racing|motorsports|motorsport)\b/g, '').trim();
    if (stripped === b || a.startsWith(b + ' ')) return true;
  }
  return false;
}

function staffFromLeadership(fields, canonName) {
  const out = [];
  const seen = new Set();
  const add = (name, role, group) => {
    name = String(name || '').trim();
    role = String(role || '').trim();
    if (!name || !role) return;
    const key = foldKey(name) + '|' + foldKey(role);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s(name, role, group));
  };
  const owner = String(fields.owner || '').trim();
  if (owner && !shouldSkipOwnerAsStaff(owner, canonName)) {
    add(owner, 'Owner', 'management');
  }
  const president = String(fields.president || '').trim();
  if (president && foldKey(president) !== foldKey(canonName)) {
    add(president, 'President', 'management');
  }
  const tp = String(fields.team_principal || '').trim();
  if (tp) add(tp, 'Team Principal', 'management');
  return out;
}

function dedupeStaff(list) {
  const out = [];
  const seen = new Set();
  for (const row of list || []) {
    if (!row || !row.name || !row.role) continue;
    const seasons = Array.isArray(row.seasons) ? row.seasons.join(',') : '';
    const key = foldKey(row.name) + '|' + foldKey(row.role) + '|' + seasons;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function main() {
  const profilesPath = path.join(root, 'data', 'team_profiles.json');
  const metaPath = path.join(root, 'data', 'team_org_metadata.json');
  const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  let enriched = 0;
  let baseline = 0;
  let cleared = 0;
  let scalarUpdated = 0;

  for (const [slug, profile] of Object.entries(profiles)) {
    if (!meta[slug]) meta[slug] = {};
    const entry = meta[slug];
    const canon = profile.canonical_name || slug;
    const pack = ENRICHED[slug];

    if (pack && pack.staff) {
      if (pack.owner != null) {
        entry.owner = pack.owner;
        scalarUpdated++;
      }
      if (pack.president != null) {
        entry.president = pack.president;
        scalarUpdated++;
      }
      if (pack.team_principal != null) {
        entry.team_principal = pack.team_principal;
        scalarUpdated++;
      }
      entry.staff = dedupeStaff(pack.staff);
      enriched++;
      continue;
    }

    // Merge current meta scalars with profile for baseline build
    const fields = {
      owner: entry.owner != null ? entry.owner : profile.owner,
      president: entry.president != null ? entry.president : profile.president,
      team_principal:
        entry.team_principal != null ? entry.team_principal : profile.team_principal,
    };
    const staff = staffFromLeadership(fields, canon);
    if (staff.length) {
      entry.staff = staff;
      baseline++;
    } else if (entry.staff) {
      delete entry.staff;
      cleared++;
    }
  }

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(
    JSON.stringify(
      {
        enriched,
        baseline,
        cleared,
        scalarUpdated,
        metaSlugs: Object.keys(meta).length,
      },
      null,
      2
    )
  );

  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'apply-team-org-metadata.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });
  if (r.status) process.exit(r.status);

  // Coverage report
  const after = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  let withStaff = 0;
  let people = 0;
  let withSeasons = 0;
  for (const v of Object.values(after)) {
    if (v.staff && v.staff.length) {
      withStaff++;
      people += v.staff.length;
      if (v.staff.some((row) => Array.isArray(row.seasons) && row.seasons.length)) withSeasons++;
    }
  }
  console.log(
    JSON.stringify({ profilesWithStaff: withStaff, totalStaffRows: people, profilesWithSeasonScopedStaff: withSeasons }, null, 2)
  );
}

main();
