// Vector checks (clipper) + SVG writer.
// groups = array (one per raised color) of shapes; colors = [base, raised1, ...] hex strings.
var CL = typeof ClipperLib !== 'undefined' ? ClipperLib : require('../vendor/clipper.js');
var SC = 1000; // clipper integer units per mm
var MIN_FEATURE_MM = 1.0, MIN_CHANNEL_MM = 1.5;

function toPaths(shape) {
  var rings = typeof shape[0][0] === 'number' ? [shape] : shape;
  return rings.map(function (r) { return r.map(function (p) { return { X: Math.round(p[0] * SC), Y: Math.round(p[1] * SC) }; }); });
}

function exec(type, subj, clip, fill) {
  var c = new CL.Clipper(), out = new CL.Paths();
  c.AddPaths(subj, CL.PolyType.ptSubject, true);
  if (clip) c.AddPaths(clip, CL.PolyType.ptClip, true);
  if (fill === undefined) fill = CL.PolyFillType.pftNonZero; // pftEvenOdd is 0, so no ||
  c.Execute(type, out, fill, fill);
  return out;
}

// Union of all shapes of one color (each shape even-odd on its own, then nonzero union).
function unionOf(shapes) {
  var all = [];
  shapes.forEach(function (s) {
    all = all.concat(exec(CL.ClipType.ctUnion, toPaths(s), null, CL.PolyFillType.pftEvenOdd));
  });
  return exec(CL.ClipType.ctUnion, all, null);
}

function area(paths) { // mm2 (net: holes subtract)
  var a = 0;
  paths.forEach(function (p) { a += CL.Clipper.Area(p); });
  return Math.abs(a) / (SC * SC);
}

function offset(paths, deltaMm) {
  var co = new CL.ClipperOffset(2, 0.25 * SC / 100), out = new CL.Paths();
  co.AddPaths(paths, CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
  co.Execute(out, deltaMm * SC);
  return out;
}

// Area of `paths` that a disk of diameter widthMm cannot reach (morphological opening).
function thinerThan(paths, widthMm) {
  if (!paths.length) return 0;
  var opened = offset(offset(paths, -widthMm / 2), widthMm / 2);
  return Math.max(0, area(paths) - area(opened));
}

function transformed(paths, size, f) {
  return paths.map(function (p) {
    return p.map(function (q) { var r = f(q.X, q.Y); return { X: r[0], Y: r[1] }; }).reverse();
  });
}

function symmetry(unions, size) {
  var S = Math.round(size * SC), fs = {
    vertical: function (x, y) { return [S - x, y]; },
    horizontal: function (x, y) { return [x, S - y]; },
    diagonal: function (x, y) { return [y, x]; },
    antidiagonal: function (x, y) { return [S - y, S - x]; }
  }, res = {}, max = 0;
  Object.keys(fs).forEach(function (k) {
    var bad = 0;
    unions.forEach(function (u) { bad += area(exec(CL.ClipType.ctXor, u, transformed(u, size, fs[k]))); });
    res[k] = bad; max = Math.max(max, bad);
  });
  res.max = max;
  return res;
}

function analyze(groups, sizeMm) {
  var S = sizeMm * SC, // shapes may stick out of the tile: clip to it
      square = [[{ X: 0, Y: 0 }, { X: S, Y: 0 }, { X: S, Y: S }, { X: 0, Y: S }]],
      unions = groups.map(function (g) { return exec(CL.ClipType.ctIntersection, unionOf(g), square); }),
      areas = unions.map(area), all = [], overlap = 0;
  unions.forEach(function (u) {
    overlap += area(exec(CL.ClipType.ctIntersection, all, u));
    all = exec(CL.ClipType.ctUnion, all.concat(u), null);
  });
  var raised = area(all);
  return {
    raisedArea: raised,
    coverage: raised / (sizeMm * sizeMm) * 100,
    shares: areas.map(function (a) { return raised ? a / raised * 100 : 0; }),
    overlap: overlap,                                   // mm2 shared between different colors
    thinFeatures: unions.map(function (u) { return thinerThan(u, MIN_FEATURE_MM); }), // mm2 per raised color
    thinChannels: thinerThan(exec(CL.ClipType.ctDifference, square, all), MIN_CHANNEL_MM), // base-color mm2
    symmetry: symmetry(unions, sizeMm)                  // mismatch mm2 per mirror axis, + max
  };
}

function svgString(groups, colors, sizeMm) {
  var f = function (v) { return v.toFixed(3); };
  var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + sizeMm + ' ' + sizeMm + '" width="' + sizeMm + 'mm" height="' + sizeMm + 'mm">',
    '  <rect id="base" width="' + sizeMm + '" height="' + sizeMm + '" fill="' + colors[0] + '"/>'];
  groups.forEach(function (shapes, i) {
    out.push('  <g id="color' + (i + 1) + '" fill="' + colors[i + 1] + '" fill-rule="evenodd">');
    shapes.forEach(function (s) {
      var rings = typeof s[0][0] === 'number' ? [s] : s;
      out.push('    <path d="' + rings.map(function (r) {
        return 'M ' + r.map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join(' L ') + ' Z';
      }).join(' ') + '"/>');
    });
    out.push('  </g>');
  });
  out.push('</svg>');
  return out.join('\n');
}

if (typeof module !== 'undefined') module.exports = { unionOf: unionOf, area: area, analyze: analyze, svgString: svgString, MIN_FEATURE_MM: MIN_FEATURE_MM, MIN_CHANNEL_MM: MIN_CHANNEL_MM };
