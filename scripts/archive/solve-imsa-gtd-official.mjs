#!/usr/bin/env node
/** Build verified [qual,race] x6 from PDF token lines. */
const QUAL = [35, 32, 30, 28, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const RACE = [350, 320, 300, 280, 260, 250, 240, 230, 220, 210, 200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100, 0];

const GTD_LINES = {
  '27': [1540, 300, 35, 320, 30, 210, 30, 320, '/', '/', 0, 260],
  '12': [1383, 220, 25, 190, 25, 350, 26, 250, '/', '/', 0, 280],
  '96': [1380, 210, 30, 260, 26, 320, 24, 240, '/', '/', 0, 240],
  '120': [1256, 110, 24, 300, 18, 160, 23, 280, '/', '/', 0, 320],
  '34': [1234, 170, 17, 240, 24, 300, 35, 180, '/', '/', 0, 250],
  '57': [1240, 350, 32, 130, 28, 220, 28, 260, '/', '/', 0, 160],
  '13': [1153, 280, 14, 250, 15, 190, 19, 190, '/', '/', 0, 180],
  '70': [1113, 180, 19, 140, 20, 280, 22, 300, '/', '/', 0, 130],
  '45': [1083, 230, 20, 150, 32, 140, 32, 350, '/', '/', 0, 110],
  '16': [1023, 120, 16, 200, 17, 240, 20, 230, '/', '/', 0, 170],
  '66': [976, 130, 0, 230, 21, 150, 21, 220, '/', '/', 0, 190],
  '81': [931, 150, 13, 160, 16, 200, 18, 200, '/', '/', 0, 150],
  '36': [894, 140, 21, 220, 35, 250, '/', '/', '/', '/', 0, 200],
  '21': [801, 260, 26, 350, '/', '/', '/', '/', '/', '/', 0, 140],
  '80': [791, 250, 28, 280, '/', '/', '/', '/', '/', '/', 0, 210],
  '912': [688, 190, 15, 120, '/', '/', '/', '/', '/', '/', 0, 350],
  '023': [682, 240, 22, 170, '/', '/', '/', '/', '/', '/', 0, 230],
  '28': [559, 100, 18, 210, '/', '/', '/', '/', '/', '/', 0, 220],
  '44': [456, 320, '/', '/', '/', '/', '/', '/', '/', '/', 0, 120],
  '068': [1213, 200, 23, 180, 19, 230, 25, 210, '/', '/', 0, 300],
  '89': [260, 0, 260, '/', '/', '/', '/', '/', '/', '/'],
  '177': [202, '/', '/', 22, 180, '/', '/', '/', '/', '/'],
  '46': [193, '/', '/', 23, 170, '/', '/', '/', '/', '/'],
  '123': [172, 160, '/', '/', '/', '/', '/', '/', '/', '/'],
};

function parseTokens(nums) {
  const rounds = [];
  let i = 0;
  while (i < nums.length && rounds.length < 6) {
    let a = nums[i++];
    let b = nums[i++];
    if (a === '/') a = 0;
    if (b === '/') b = 0;
    if (b === undefined) {
      rounds.push([0, a || 0]);
      continue;
    }
    rounds.push([b, a]); // PDF Race,Qual -> [qual,race]
  }
  while (rounds.length < 6) rounds.push([0, 0]);
  return rounds;
}

function solve(total, nums) {
  const base = parseTokens(nums);
  const unk = [];
  for (let r = 0; r < 6; r++) {
    if (base[r][0] === 0 && base[r][1] > 0) unk.push([r, 0]);
    if (base[r][1] === 0 && base[r][0] > 0) unk.push([r, 1]);
  }
  let best = null;
  function dfs(k, cur) {
    if (k === unk.length) {
      const s = cur.reduce((a, [q, r]) => a + q + r, 0);
      if (s === total) best = cur.map((x) => [...x]);
      return;
    }
    const [ri, fi] = unk[k];
    const opts = fi === 0 ? QUAL : RACE;
    for (const v of opts) {
      const next = cur.map((p) => [...p]);
      next[ri][fi] = v;
      dfs(k + 1, next);
      if (best) return;
    }
  }
  dfs(0, base);
  return best;
}

const out = {};
let fail = 0;
for (const [car, arr] of Object.entries(GTD_LINES)) {
  const total = arr[0];
  const solved = solve(total, arr.slice(1));
  const sum = solved ? solved.reduce((a, [q, r]) => a + q + r, 0) : -1;
  if (sum !== total) {
    fail++;
    console.log('FAIL #' + car, 'want', total, 'got', sum, parseTokens(arr.slice(1)));
  } else {
    out[car] = solved;
    console.log('OK #' + car, JSON.stringify(solved));
  }
}
if (fail) process.exit(1);
console.log('\nexport const OFFICIAL_GTD = ' + JSON.stringify(out, null, 2) + ';');
