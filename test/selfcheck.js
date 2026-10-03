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
const fails = [], RESULTS = [];
CASES.forEach((c, i) => {
  const t0 = Date.now(), { groups, report: r } = Engine.generate({ seed: 1000 + i, colors: COLORS.slice(0, c.percents.length + 1), ...c });
  const name = `case${i + 1}_${c.sizeMm}mm_${c.percents.length}c_${c.coverage}_${c.border}`;
  RESULTS.push({ name, c, colors: COLORS.slice(0, c.percents.length + 1), groups, r });
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ size: c.sizeMm, colors: COLORS.slice(0, c.percents.length + 1), groups, report: r }));
  console.log(name.padEnd(28), `${Date.now() - t0}ms`, r.mode.padEnd(6),
    'cov', r.coverage.achieved.toFixed(1), 'shares', r.shares.map(s => s.achieved.toFixed(1)).join('/'),
    'thin', r.thinFeatures.toFixed(2), 'chan', r.thinChannels.toFixed(2), 'sym', r.symmetry.toFixed(2), 'ovl', r.overlap.toFixed(3),
    r.warnings.length ? 'WARN ' + r.warnings : '');
  if (r.warnings.length) fails.push(name);
});
assert(!fails.length, 'engine cases off target: ' + fails.join(', '));

// ---- frame color: the frame ring (sampled on its midline) lies entirely in the chosen group; border off ignores it ----
function inGroup(shapes, x, y) {
  let n = 0;
  shapes.forEach(s => (typeof s[0][0] === 'number' ? [s] : s).forEach(r => {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++)
      if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) n++;
  }));
  return n % 2 === 1;
}
[1, 2, 3].forEach(fcIdx => {
  const S = 60, pc = [34, 33, 33], { groups, report: r } = Engine.generate({ seed: 7, sizeMm: S, colors: COLORS, percents: pc, coverage: 60, border: 'on', frameColor: fcIdx });
  assert.strictEqual(r.frameColor, fcIdx);
  for (let i = 1; i < 20; i++) {
    const x = S * i / 20;
    assert(inGroup(groups[fcIdx - 1], x, 0.5) && inGroup(groups[fcIdx - 1], 0.5, x), `frame not in color ${fcIdx} at ${x}`);
  }
  assert(!r.warnings.includes('symmetry') && !r.warnings.includes('overlap'), 'frameColor ' + fcIdx + ': ' + r.warnings);
  console.log('frameColor', fcIdx, 'cov', r.coverage.achieved.toFixed(1), 'shares', r.shares.map(s => s.achieved.toFixed(1)).join('/'), r.warnings.length ? 'WARN ' + r.warnings : '');
});
assert.strictEqual(Engine.generate({ seed: 7, sizeMm: 60, colors: COLORS, percents: [34, 33, 33], coverage: 60, border: 'off', frameColor: 2 }).report.frameColor, 'auto');

// ---- Update tile: scale keeps polygon count + coverage; style-only state logic ----
RESULTS.forEach(({ name, groups, r }) => {
  const up = Engine.rescale({ groups, report: r }, r.sizeMm * 1.5);
  assert.strictEqual(JSON.stringify(up.groups).match(/\]\],\[\[/g)?.length, JSON.stringify(groups).match(/\]\],\[\[/g)?.length, name + ' polygon count');
  assert.deepStrictEqual(up.groups.map(g => g.length), groups.map(g => g.length), name + ' shapes per group');
  assert(Math.abs(up.report.coverage.achieved - r.coverage.achieved) < 0.01, name + ' coverage after scale');
  assert.strictEqual(up.report.seed, r.seed);
});
{
  const last = { sizeMm: 60, colors: ['#ffffff', '#1d4e9e'], percents: [100], coverage: 60, border: 'on', frameColor: 'auto' };
  const style = x => Engine.isStyleOnly(Engine.changedParams(last, { ...last, ...x }));
  assert(style({ sizeMm: 80 }) && style({ colors: ['#ffffff', '#1D4E9F'] }) && style({}));
  assert(!style({ coverage: 50 }) && !style({ sizeMm: 80, border: 'off' }) && !style({ percents: [50, 50] }) && style({ frameColor: '1' }));
  assert(style({ coverage: 60 }), 'changed back to generated value re-enables');
}

// ---- reframe: only the frame moves; everything else keeps its geometry ----
{
  const S = 60, base = Engine.generate({ seed: 7, sizeMm: S, colors: COLORS, percents: [34, 33, 33], coverage: 60, border: 'on', frameColor: 1 });
  [2, 3, 1, 'auto'].forEach(fc => {
    const up = Engine.reframe(base, fc), n = fc === 'auto' ? 1 : fc;
    assert.strictEqual(up.report.frameIdx, n - 1);
    for (let i = 1; i < 20; i++) {
      const x = S * i / 20;
      assert(inGroup(up.groups[n - 1], x, 0.5) && inGroup(up.groups[n - 1], 0.5, x), 'reframe ' + fc + ' at ' + x);
    }
    assert(Math.abs(up.report.coverage.achieved - base.report.coverage.achieved) < 0.01, 'reframe keeps coverage');
    console.log('reframe', fc, 'shares', up.report.shares.map(s => s.achieved.toFixed(1)).join('/'), up.report.warnings.length ? 'WARN ' + up.report.warnings : '');
  });
}

// ---- export/import: deterministic round trip ----
{
  const Exp = require('../js/export.js'), P = { sizeMm: 60, colors: COLORS, percents: [34, 33, 33], coverage: 55, border: 'on', frameColor: 2 };
  const gen = () => Engine.generate({ seed: 4242, ...P });
  assert.strictEqual(JSON.stringify(gen().groups), JSON.stringify(gen().groups), 'same seed + params -> identical polygons');
  // exported after Update tile: size 90 and new colors, generated at 60
  const newColors = ['#000000', '#111111', '#222222', '#333333'], g0 = gen();
  const text = JSON.stringify(Exp.build({ seed: 4242, generatedSizeMm: 60, sizeMm: 90, colors: newColors, percents: P.percents, coverage: P.coverage, border: P.border, frameColor: 2 }));
  const r = Exp.parse(text), d = r.data;
  assert(d && !r.warnings.length, JSON.stringify(r));
  assert.deepStrictEqual([d.shapeParams.numColors, d.shapeParams.percents, d.shapeParams.coverage, d.shapeParams.border, d.shapeParams.frameColor], [4, P.percents, 55, 'on', 2]);
  const g1 = Engine.generate({ seed: d.seed, sizeMm: d.generatedSizeMm, colors: d.colors, percents: d.shapeParams.percents, coverage: d.shapeParams.coverage, border: d.shapeParams.border, frameColor: d.shapeParams.frameColor });
  assert.strictEqual(check.svgString(g1.groups, COLORS, 60), check.svgString(g0.groups, COLORS, 60), 'round trip SVG identical');
  const up = Engine.rescale(g1, d.sizeMm);
  assert.strictEqual(up.report.sizeMm, 90);
  assert.strictEqual(d.colors[1], '#111111');
  // validation
  const bad = (f) => Exp.parse(JSON.stringify(f(JSON.parse(text)))).errors.length > 0;
  assert(Exp.parse('{').errors.length && bad(o => ({ ...o, extra: 1 })) && bad(o => ({ ...o, version: '2.0.0' })) && bad(o => ({ ...o, format: 'x' })));
  assert(bad(o => ({ ...o, sizeMm: 5 })) && bad(o => ({ ...o, colors: ['#fff'] })) && bad(o => { o.shapeParams.percents = [50, 40, 5]; return o; }));
  assert(bad(o => { o.shapeParams.coverage = 95; return o; }) && bad(o => { o.shapeParams.border = 'x'; return o; }) && bad(o => { o.shapeParams.frameColor = 4; return o; }));
  assert.strictEqual(Exp.parse(JSON.stringify({ ...JSON.parse(text), engineVersion: '0.9' })).warnings.length, 1);
}

// ---- P6e: 10 extra cases (3 frame color, 4 update tile, 3 export/import) ----
{
  const Exp = require('../js/export.js');
  const near = (a, b, m) => assert(Math.abs(a - b) <= 5, m + ' ' + a + ' vs ' + b);
  // frame color 1/2/3, 3 colors, border on: coverage and shares within +-5
  [1, 2, 3].forEach(fc => {
    const pc = [40, 35, 25], { report: r } = Engine.generate({ seed: 31 + fc, sizeMm: 80, colors: COLORS, percents: pc, coverage: 60, border: 'on', frameColor: fc });
    near(r.coverage.achieved, 60, 'frame ' + fc + ' coverage');
    r.shares.forEach((s, i) => near(s.achieved, pc[i], 'frame ' + fc + ' share ' + i));
    assert(r.symmetry >= 0.99 || !r.warnings.includes('symmetry'), 'frame ' + fc + ' symmetry');
  });
  // update tile: style-only vs shape-param changes, and re-enable
  const last = { sizeMm: 60, colors: ['#ffffff', '#1d4e9e', '#f2c230'], percents: [60, 40], coverage: 60, border: 'on', frameColor: 'auto' };
  const style = x => Engine.isStyleOnly(Engine.changedParams(last, { ...last, ...x }));
  assert(style({ sizeMm: 120, colors: ['#000000', '#1d4e9e', '#f2c230'] }), 'size + colors are style-only');
  assert(!style({ coverage: 70 }) && !style({ border: 'off' }) && !style({ percents: [50, 50] }), 'shape params need Generate');
  assert(!style({ coverage: 70, sizeMm: 90 }) && style({ coverage: 70 }) === false, 'mixed change needs Generate');
  assert(style({ coverage: 60, sizeMm: 90 }), 'reverting a shape param re-enables Update');
  // export/import round trip across sizes, color counts, frameColor
  [{ sizeMm: 15, n: 2, fc: 'auto', border: 'off' }, { sizeMm: 100, n: 3, fc: 2, border: 'on' }, { sizeMm: 200, n: 4, fc: 1, border: 'on' }].forEach(({ sizeMm, n, fc, border }, k) => {
    const cols = COLORS.slice(0, n), pc = [[100], [50, 50], [50, 30, 20]][n - 2], coverage = 50 + k * 10;
    const P = { seed: 900 + k, sizeMm, colors: cols, percents: pc, coverage, border, frameColor: fc }, g0 = Engine.generate(P);
    const r = Exp.parse(JSON.stringify(Exp.build({ ...P, generatedSizeMm: sizeMm })));
    assert(r.data && !r.errors.length && !r.warnings.length, 'import ' + JSON.stringify(r));
    const d = r.data, g1 = Engine.generate({ seed: d.seed, sizeMm: d.generatedSizeMm, colors: d.colors, ...d.shapeParams });
    assert.strictEqual(check.svgString(g1.groups, COLORS, sizeMm), check.svgString(g0.groups, COLORS, sizeMm), 'round trip ' + sizeMm + 'mm');
  });
}

// ---- P7a: shape-size limits: every non-exempt island within min/max, or the matching warning is set ----
[15, 60, 200].forEach((S, i) => [[100], [40, 35, 25]].forEach(pc => {
  const t0 = Date.now(), res = Engine.generate({ seed: 70 + i, sizeMm: S, colors: COLORS.slice(0, pc.length + 1), percents: pc, coverage: 60, border: 'random' }), r = res.report;
  const isl = check.islands(res.groups, S, { frameWidth: r.frameIdx >= 0 ? r.frameWidth : 0, fill: res.fill }).flat().filter(x => !x.exempt);
  assert.strictEqual(r.shapes.count, isl.length, S + 'mm shape count');
  assert(isl.every(x => x.pct >= r.shapes.min) || r.warnings.includes('shapeTooSmall'), S + 'mm island under the min without a warning');
  assert(isl.every(x => x.pct <= r.shapes.max) || r.warnings.includes('shapeTooBig'), S + 'mm island over the max without a warning');
  const up = Engine.rescale(res, S * 1.5).report.shapes; // Update tile re-measures only: same design, same %
  assert(up.count === r.shapes.count && Math.abs(up.smallestPct - r.shapes.smallestPct) < 1e-3, S + 'mm rescale shapes');
  console.log('shapes', String(S).padStart(3) + 'mm', pc.length + 1 + 'c', `${Date.now() - t0}ms`, r.mode.padEnd(6), r.shapes.count, 'islands',
    r.shapes.smallestPct.toFixed(2) + '-' + r.shapes.largestPct.toFixed(1) + '%', r.warnings.length ? 'WARN ' + r.warnings : '');
}));

// ---- 3D: every mesh watertight (each directed edge once, reverse once), positive volume, volume matches analytics ----
const Mesh = require('../js/mesh3mf.js'), fflate = require('../vendor/fflate.min.js');
function check3d(label, groups, colors, size, opts, coverage) {
  const { parts, bytes } = Mesh.generate(groups, colors, size, opts);
  let raised = 0;
  parts.forEach(p => {
    const i = Mesh.inspect(p.mesh);
    assert.strictEqual(i.bad, 0, label + ' ' + p.name + ' not watertight');
    assert(i.vol > 0, label + ' ' + p.name + ' volume');
    assert(Math.abs(i.vol - p.mesh.vol) / i.vol < 1e-3, label + ' ' + p.name + ' volume vs cap area');
    if (p.name !== 'base') raised += i.vol;
  });
  const h = opts.emboss || Mesh.INLAY, cov = raised / h / (size * size) * 100;
  assert(Math.abs(cov - coverage) < 0.5, label + ' coverage ' + cov.toFixed(2) + ' vs ' + coverage.toFixed(2));
  const rrVol = (size * size - (4 - Math.PI)) * opts.plate, baseVol = parts[0].mesh.vol;
  assert(Math.abs(baseVol - (opts.emboss ? rrVol : rrVol - raised)) / rrVol < 1e-3, label + ' base volume');
  // read the 3MF back: same triangle/vertex counts, 1 basematerial per part
  const z = fflate.unzipSync(bytes), model = Buffer.from(z['3D/3dmodel.model']).toString();
  assert.strictEqual((model.match(/<triangle /g) || []).length, parts.reduce((s, p) => s + p.mesh.t.length / 3, 0));
  assert.strictEqual((model.match(/<base /g) || []).length, parts.length);
  assert(z['Metadata/model_settings.config'] && z['Metadata/project_settings.config']);
  return { parts, bytes };
}
RESULTS.forEach(({ name, c, colors, groups, r }) => {
  [{ emboss: 1.5, plate: 3 }, { emboss: 0, plate: 3 }].forEach(o => {
    const t0 = Date.now();
    check3d(name + ' emboss' + o.emboss, groups, colors, c.sizeMm, o, r.coverage.achieved);
    console.log('3D', name.padEnd(28), 'emboss', o.emboss, `${Date.now() - t0}ms`);
  });
});
// designs whose rings come within a micron of themselves (pinch / spike): failed "not watertight" before v2.1.0
[{ seed: 1003, sizeMm: 50, minShapePct: 0, maxShapePct: 100 }, { seed: 1007, sizeMm: 100 }].forEach(o => {
  const g = Engine.generate({ colors: COLORS, percents: [40, 35, 25], coverage: 60, border: 'on', ...o });
  [1.5, 0].forEach(emboss => check3d('pinch ' + o.sizeMm + 'mm seed ' + o.seed + ' emboss ' + emboss, g.groups, COLORS, o.sizeMm, { emboss, plate: 3 }, g.report.coverage.achieved));
});
// sample files for the slicer check
const S = RESULTS[2];
fs.writeFileSync(path.join(out, 'sample_emboss.3mf'), check3d('sample', S.groups, S.colors, S.c.sizeMm, { emboss: 1.2, plate: 3 }, S.r.coverage.achieved).bytes);
fs.writeFileSync(path.join(out, 'sample_inlay.3mf'), check3d('sample', S.groups, S.colors, S.c.sizeMm, { emboss: 0, plate: 3 }, S.r.coverage.achieved).bytes);
console.log('selfcheck OK');
