// Design export/import (JSON). build(state) -> object; parse(text) -> {data, errors, warnings}
// errors / warnings = [[i18n key, ...args], ...]
var Export = (function () {
  var FORMAT = 'portuguese-tile-v1', VERSION = '1.0.0', MAX_BYTES = 10240;
  var TOP = ['format', 'version', 'engineVersion', 'seed', 'generatedSizeMm', 'sizeMm', 'colors', 'shapeParams'];
  var SHAPE = ['numColors', 'percents', 'coverage', 'border', 'frameColor'];
  var engineVersion = typeof Engine !== 'undefined' ? Engine.version : require('./engine.js').version;

  // s = { seed, generatedSizeMm, sizeMm, colors, percents, coverage, border, frameColor }
  function build(s) {
    return {
      format: FORMAT, version: VERSION, engineVersion: engineVersion, seed: s.seed,
      generatedSizeMm: s.generatedSizeMm, sizeMm: s.sizeMm, colors: s.colors,
      shapeParams: { numColors: s.colors.length, percents: s.percents, coverage: s.coverage, border: s.border, frameColor: s.frameColor }
    };
  }

  function sameKeys(o, keys) {
    return o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(function (k) { return k in o; });
  }
  function num(x, lo, hi) { return typeof x === 'number' && x >= lo && x <= hi; }

  function parse(text) {
    var errors = [], warnings = [], d;
    if (text.length > MAX_BYTES) warnings.push(['warnBig']);
    try { d = JSON.parse(text); } catch (e) { return { errors: [['errJson']], warnings: warnings }; }
    if (!sameKeys(d, TOP) || !sameKeys(d.shapeParams, SHAPE)) return { errors: [['errKeys']], warnings: warnings };
    if (d.format !== FORMAT) return { errors: [['errFormat']], warnings: warnings };
    if (d.version !== VERSION) return { errors: [['errVersion', String(d.version)]], warnings: warnings };
    if (d.engineVersion !== engineVersion) warnings.push(['warnEngine', String(d.engineVersion), engineVersion]);
    var p = d.shapeParams, n = p.numColors, bad = function (f) { errors.push(['errField', f]); };
    if (!(Number.isInteger(d.seed) && d.seed >= 0 && d.seed <= 4294967295)) bad('seed');
    if (!num(d.generatedSizeMm, 15, 200)) bad('generatedSizeMm');
    if (!num(d.sizeMm, 15, 200)) bad('sizeMm');
    if (!(Number.isInteger(n) && n >= 2 && n <= 4)) bad('numColors');
    else {
      if (!(Array.isArray(d.colors) && d.colors.length === n && d.colors.every(function (c) { return /^#[0-9a-f]{6}$/i.test(c); }))) bad('colors');
      if (!(Array.isArray(p.percents) && p.percents.length === n - 1 && p.percents.every(function (x) { return num(x, 0, 100); }) &&
        Math.abs(p.percents.reduce(function (a, b) { return a + b; }, 0) - 100) < 1e-6)) bad('percents');
      if (!(p.frameColor === 'auto' || (Number.isInteger(p.frameColor) && p.frameColor >= 1 && p.frameColor <= n - 1))) bad('frameColor');
    }
    if (!num(p.coverage, 30, 90)) bad('coverage');
    if (['on', 'off', 'random'].indexOf(p.border) < 0) bad('border');
    return { data: errors.length ? null : d, errors: errors, warnings: warnings };
  }

  return { build: build, parse: parse };
})();

if (typeof module !== 'undefined') module.exports = Export;
