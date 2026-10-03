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
// Pieces under DUST_MM2 are polygon-approximation noise along curves, below print resolution: ignored.
var DUST_MM2 = 0.02;
function thinerThan(paths, widthMm) {
  if (!paths.length) return 0;
  var opened = offset(offset(paths, -widthMm / 2), widthMm / 2), a = 0;
  exec(CL.ClipType.ctDifference, paths, opened).forEach(function (p) {
    var pa = CL.Clipper.Area(p) / (SC * SC);
    if (Math.abs(pa) >= DUST_MM2) a += pa;
  });
  return Math.max(0, a);
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

// Connected islands of one color: [{paths: [outer, its holes...], area}], from a clipper PolyTree.
// Strictly simple: pieces that touch at a point are always split the same way, whatever the input rings were.
function split(paths) {
  var c = new CL.Clipper(), tree = new CL.PolyTree(), out = [];
  c.StrictlySimple = true;
  c.AddPaths(paths, CL.PolyType.ptSubject, true);
  c.Execute(CL.ClipType.ctUnion, tree, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
  (function walk(outers) { // children of an outer are its holes, children of a hole are the next outers
    outers.forEach(function (n) {
      var isl = [n.Contour()];
      n.Childs().forEach(function (h) { isl.push(h.Contour()); walk(h.Childs()); });
      out.push({ paths: isl, area: area(isl) });
    });
  })(tree.Childs());
  return out;
}

// Printed islands per raised color, measured without the frame band: [[{area, pct, exempt, paths}, ...], ...].
// unions = clipper paths per color. opts.frameWidth (0 = no raised frame), opts.fill = clipper paths of the
// ground fill: an island holding any of it is exempt.
var BAND_EDGE_MM = 0.85, ISLAND_DUST_MM2 = 0.1; // slivers the D4 mirroring leaves on its seams: smaller than a 0.4 mm nozzle can print, not islands
var borderFrameOf =typeof module !== 'undefined' ? require('./shapes.js').borderFrame : borderFrame;
function islandsOf(unions, sizeMm, opts) {
  // the band widened by the fillets that join shapes to the frame (closing by the 1.7 mm channel reaches 0.85 mm):
  // those bits are frame edge, not islands
  var band = opts.frameWidth ? offset(exec(CL.ClipType.ctUnion, toPaths(borderFrameOf(sizeMm, opts.frameWidth)), null), BAND_EDGE_MM) : null, S2 = sizeMm * sizeMm;
  // one point well inside each fill piece (the fill is at least a feature wide): a vertex of every ring of it eroded
  var pts = opts.fill && opts.fill.length ? offset(opts.fill, -0.05).map(function (p) { return p[0]; }) : [];
  function holds(isl, q) {
    return CL.Clipper.PointInPolygon(q, isl[0]) === 1 && isl.slice(1).every(function (h) { return CL.Clipper.PointInPolygon(q, h) === 0; });
  }
  return unions.map(function (u) {
    var isl = split(band ? exec(CL.ClipType.ctDifference, u, band) : u).filter(function (i) { return i.area >= ISLAND_DUST_MM2; });
    isl.forEach(function (i) { i.pct = i.area / S2 * 100; i.exempt = pts.some(function (q) { return holds(i.paths, q); }); });
    return isl;
  });
}
// the same for shapes in mm (groups as analyze takes them, opts.fill = shapes of the fill)
function islands(groups, sizeMm, opts) {
  return islandsOf(groups.map(unionOf), sizeMm, { frameWidth: opts.frameWidth, fill: opts.fill && unionOf(opts.fill) }).map(function (isl) {
    return isl.map(function (i) { return { area: i.area, pct: i.pct, exempt: i.exempt }; });
  });
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

if (typeof module !== 'undefined') module.exports = {
  SC: SC, toPaths: toPaths, exec: exec, offset: offset, unionOf: unionOf, area: area, analyze: analyze, svgString: svgString,
  split: split, islandsOf: islandsOf, islands: islands, BAND_EDGE_MM: BAND_EDGE_MM,
  MIN_FEATURE_MM: MIN_FEATURE_MM, MIN_CHANNEL_MM: MIN_CHANNEL_MM
};
