// node test/selfcheck.js  (dev only)
const assert = require('assert');
const path = require('path');
const { execSync } = require('child_process');
const ts = require('../js/shapes.js');
const check = require('../js/check.js');

// ---- make_design_02.py, rebuilt ----
function design02() {
  const SIZE = 100, C = [50, 50], BORDER_W = 3;
  const lobed = (r, amp, lobes = 8) => th => r + amp * Math.cos(lobes * th);
  const PALM = [[-52, 16, 10.5, -30], [-26, 21, 11.5, -12], [0, 27, 13, 0], [26, 21, 11.5, 12], [52, 16, 10.5, 30]];
  const marine = [], ice = [], yellow = [];
  marine.push(...ts.borderFrame(SIZE, BORDER_W));
  marine.push([ts.polarShape(...C, lobed(23, 2.4)), ts.polarShape(...C, lobed(23 - 3.4, 2.4))]);
  for (let k = 0; k < 8; k++) yellow.push(ts.lensPetal(...ts.polar(...C, 4.5, k * 45), k * 45, 14, 9, { belly: 1.3 }));
  ice.push(ts.circlePoly(...C, 3.6));
  for (const diag of [45, 135, 225, 315]) {
    const base = ts.polar(...C, 27, diag);
    for (const [da, len, wid, bend] of PALM) ice.push(ts.lensPetal(...base, diag + da, len, wid, { bend, belly: 1.4 }));
  }
  for (const card of [0, 90, 180, 270]) {
    yellow.push(ts.lensPetal(...ts.polar(...C, 28, card), card, 18, 17.5, { belly: 1.5 }));
    const leaf = ts.polar(...C, 28 - 3.5, card);
    for (const side of [-1, 1]) marine.push(ts.lensPetal(...leaf, card + side * 58, 9, 4.8, { bend: side * 30 }));
  }
  for (const [corner, a0] of [[[0, 0], 0], [[SIZE, 0], 90], [[SIZE, SIZE], 180], [[0, SIZE], 270]]) {
    const dot = ts.polar(...corner, 10.5, a0 + 45);
    marine.push([ts.polarShape(...corner, lobed(16, 0), a0, a0 + 90, 90, true), ts.circlePoly(...dot, 2.6 + 1.1)]);
    yellow.push(ts.circlePoly(...dot, 2.6));
  }
  return { size: SIZE, groups: [marine, ice, yellow], names: ['marine', 'ice', 'yellow'] };
}

// ---- reference numbers from the Python raster checker ----
const dir = path.join(__dirname, '..', '..', 'projects', '132_tile-coasters-set', '01_designs');
const py = execSync('python check_design.py make_design_02', { cwd: dir, encoding: 'utf8' });
const pyCov = +py.match(/Raised coverage:\s*([\d.]+)%/)[1];

const d = design02(), r = check.analyze(d.groups, d.size);
console.log('coverage', r.coverage.toFixed(2), 'py', pyCov);
assert(Math.abs(r.coverage - pyCov) < 0.5, 'coverage');
d.names.forEach((n, i) => {
  const pyShare = +py.match(new RegExp(n + '\\s+([\\d.]+)% of raised'))[1];
  console.log(n, r.shares[i].toFixed(2), 'py', pyShare);
  assert(Math.abs(r.shares[i] - pyShare) < 0.5, 'share ' + n);
});
console.log('overlap', r.overlap.toFixed(3), 'thin', r.thinFeatures.map(x => x.toFixed(2)), 'channels', r.thinChannels.toFixed(2), 'sym', r.symmetry);
assert(r.overlap < 0.01, 'no cross-color overlap');

const svg = check.svgString(d.groups, ['#ffffff', '#0078BF', '#A3D8E1', '#F7D959'], d.size);
assert.strictEqual((svg.match(/<g /g) || []).length, 3);
assert(svg.includes('fill-rule="evenodd"') && svg.includes('<rect'));

// ---- design engine: 8 cases, each within +-5%, clean channels and symmetry ----
const fs = require('fs');
const Engine = require('../js/engine.js');
const COLORS = ['#FFFFFF', '#1F4E9E', '#F2C230', '#8CC4E8'];
const CASES = [
  { sizeMm: 15, percents: [100], coverage: 60, border: 'on' },
  { sizeMm: 15, percents: [60, 40], coverage: 30, border: 'off' },
  { sizeMm: 50, percents: [55, 45], coverage: 60, border: 'off' },
  { sizeMm: 50, percents: [50, 30, 20], coverage: 90, border: 'on' },
  { sizeMm: 100, percents: [40, 35, 25], coverage: 60, border: 'on' },
  { sizeMm: 100, percents: [100], coverage: 30, border: 'off' },
  { sizeMm: 200, percents: [50, 30, 20], coverage: 30, border: 'on' },
  { sizeMm: 200, percents: [70, 30], coverage: 90, border: 'off' },
];
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
const fails = [];
CASES.forEach((c, i) => {
  const t0 = Date.now(), { groups, report: r } = Engine.generate({ seed: 1000 + i, colors: COLORS.slice(0, c.percents.length + 1), ...c });
  const name = `case${i + 1}_${c.sizeMm}mm_${c.percents.length}c_${c.coverage}_${c.border}`;
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ size: c.sizeMm, colors: COLORS.slice(0, c.percents.length + 1), groups, report: r }));
  console.log(name.padEnd(28), `${Date.now() - t0}ms`, r.mode.padEnd(6),
    'cov', r.coverage.achieved.toFixed(1), 'shares', r.shares.map(s => s.achieved.toFixed(1)).join('/'),
    'thin', r.thinFeatures.toFixed(2), 'chan', r.thinChannels.toFixed(2), 'sym', r.symmetry.toFixed(2), 'ovl', r.overlap.toFixed(3),
    r.warnings.length ? 'WARN ' + r.warnings : '');
  if (r.warnings.length) fails.push(name);
});
assert(!fails.length, 'engine cases off target: ' + fails.join(', '));
console.log('selfcheck OK');
