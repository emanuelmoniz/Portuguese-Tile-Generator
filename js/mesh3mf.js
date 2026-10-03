// 3D (plan.md section 2 "3D"): clipper polygons-with-holes -> closed prisms (earcut caps + side walls),
// emboss / inlay layout, 3MF writer (core basematerials + Bambu/Orca extruder metadata).
// build(groups, sizeMm, {emboss, plate}) -> parts [{name, extruder, mesh}]   mesh = {v: [x,y,z,...], t: [a,b,c,...], vol}
//   emboss > 0: base slab (plate) + one prism of `emboss` mm per raised color on top.
//   emboss = 0: inlay, base slab (plate - INLAY) + perforated base layer + colors INLAY mm thick, flush with the top.
// write3mf(parts, colors, sizeMm) -> Uint8Array.   inspect(mesh) -> {bad, vol, tris} (bad = edges not used once each way)
var Mesh3mf = (function () {
  var node = typeof module !== 'undefined';
  var CK = node ? require('./check.js') : window, CL = node ? require('../vendor/clipper.js') : window.ClipperLib,
      EC = (node ? require('../vendor/earcut.min.js') : window.earcut).default,
      FF = node ? require('../vendor/fflate.min.js') : window.fflate;
  var SC = CK.SC, CORNER = 1, INLAY = 0.6, STEPS = 8, CLEAN = 0.01, DUST = 0.002; // mm, mm2

  function rrect(size) { // tile outline with CORNER mm rounded corners, clipper ints
    var s = size * SC, r = CORNER * SC, p = [];
    [[s - r, r, -90], [s - r, s - r, 0], [r, s - r, 90], [r, r, 180]].forEach(function (c) {
      for (var i = 0; i <= STEPS; i++) {
        var a = (c[2] + 90 * i / STEPS) * Math.PI / 180;
        p.push({ X: Math.round(c[0] + r * Math.cos(a)), Y: Math.round(c[1] + r * Math.sin(a)) });
      }
    });
    return [p];
  }

  function polys(paths, strict) { // clipper paths -> [{outer, holes}]
    var c = new CL.Clipper(), t = new CL.PolyTree(), out = [], nz = CL.PolyFillType.pftNonZero;
    c.StrictlySimple = !!strict; // slow, so only used as a retry: rings touching at a vertex pinch the prism walls
    c.AddPaths(paths, CL.PolyType.ptSubject, true);
    c.Execute(CL.ClipType.ctUnion, t, nz, nz);
    (function walk(n) {
      n.Childs().forEach(function (o) {
        var big = function (c) { return Math.abs(CL.Clipper.Area(c)) >= DUST * SC * SC; }; // slivers confuse earcut and are not printable
        if (big(o.Contour())) out.push({ outer: o.Contour(), holes: o.Childs().map(function (h) { return h.Contour(); }).filter(big) });
        o.Childs().forEach(walk);
      });
    })(t);
    return out;
  }

  function area2(q) { // twice the signed area
    var a = 0;
    for (var i = 0; i < q.length; i++) { var j = (i + 1) % q.length; a += q[i][0] * q[j][1] - q[j][0] * q[i][1]; }
    return a;
  }

  // closed prism z0..z1 per polygon, appended to mesh m. Tile centered on x/y = 0, y up (SVG y is flipped).
  function prism(m, pls, z0, z1, size, retry) {
    pls.forEach(function (pl) {
      var sub = newMesh();
      emit(sub, pl, z0, z1, size);
      if (inspect(sub).bad) { // pinched ring (earcut quirk): split it with a strictly simple union and retry,
        // then once more without micron spikes (vertices within CLEAN of their neighbors' line)
        var rings = [pl.outer].concat(pl.holes);
        if (retry === 2) throw new Error('mesh not watertight');
        return prism(m, polys(retry ? CL.Clipper.CleanPolygons(rings, CLEAN * SC) : rings, true), z0, z1, size, (retry || 0) + 1);
      }
      var b = m.v.length / 3;
      sub.v.forEach(function (x) { m.v.push(x); });
      sub.t.forEach(function (x) { m.t.push(x + b); });
      m.vol += sub.vol;
    });
  }

  function emit(m, pl, z0, z1, size) {
    var h = size / 2;
    var rs = [pl.outer].concat(pl.holes).map(function (r, k) { // outer CCW, holes CW
      var q = r.map(function (p) { return [p.X / SC - h, h - p.Y / SC, p.X, p.Y]; });
      return (area2(q) > 0) === (k === 0) ? q : q.reverse();
    });
    var flat = [], ints = [], holeAt = [], i, A = 0;
    rs.forEach(function (q, k) {
      if (k) holeAt.push(flat.length / 2);
      A += area2(q) / 2;
      q.forEach(function (p) { flat.push(p[0], p[1]); ints.push(p[2], p[3]); });
    });
    // triangulate the clipper integers: earcut's orientation tests are exact on them (in mm, rounding can pinch
    // a ring that comes within a micron of itself)
    var N = flat.length / 2, b = m.v.length / 3, tri = EC(ints, holeAt, 2), s = 0;
    for (i = 0; i < N; i++) m.v.push(flat[2 * i], flat[2 * i + 1], z0);
    for (i = 0; i < N; i++) m.v.push(flat[2 * i], flat[2 * i + 1], z1);
    for (i = 0; i < tri.length; i += 3) { // earcut orientation is uniform; make the top cap face +z
      var a = tri[i], c = tri[i + 1], d = tri[i + 2];
      s += (flat[2 * c] - flat[2 * a]) * (flat[2 * d + 1] - flat[2 * a + 1]) - (flat[2 * d] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]);
    }
    for (i = 0; i < tri.length; i += 3) {
      if (s < 0) { var x = tri[i + 1]; tri[i + 1] = tri[i + 2]; tri[i + 2] = x; }
      m.t.push(b + N + tri[i], b + N + tri[i + 1], b + N + tri[i + 2], b + tri[i], b + tri[i + 2], b + tri[i + 1]);
    }
    var cap = {}; // walls follow the cap's own boundary (earcut may drop collinear points): directed edges without a reverse
    for (i = 0; i < tri.length; i += 3) for (var k = 0; k < 3; k++) cap[tri[i + k] + ',' + tri[i + (k + 1) % 3]] = 1;
    Object.keys(cap).forEach(function (key) {
      var e = key.split(',').map(Number);
      if (!cap[e[1] + ',' + e[0]]) m.t.push(b + e[0], b + e[1], b + N + e[1], b + e[0], b + N + e[1], b + N + e[0]);
    });
    m.vol += A * (z1 - z0);
  }

  function newMesh() { return { v: [], t: [], vol: 0 }; }

  function inspect(m) {
    var e = new Map(), bad = 0, vol = 0, i, k, v = m.v, t = m.t, K = v.length / 3 + 1;
    for (i = 0; i < t.length; i += 3) {
      for (k = 0; k < 3; k++) { var key = t[i + k] * K + t[i + (k + 1) % 3]; e.set(key, (e.get(key) || 0) + 1); }
      var a = 3 * t[i], b = 3 * t[i + 1], c = 3 * t[i + 2];
      vol += (v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) +
              v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c])) / 6;
    }
    e.forEach(function (n, key) { // every directed edge once, and its reverse once
      if (n !== 1 || e.get((key % K) * K + Math.floor(key / K)) !== 1) bad++;
    });
    return { bad: bad, vol: vol, tris: t.length / 3 };
  }

  // close then open: drops micron-wide slits, spikes and pinches left by the boolean ops
  function clean(p) { return CK.offset(CK.offset(CK.offset(CK.offset(p, CLEAN), -CLEAN), -CLEAN), CLEAN); }

  function build(groups, sizeMm, o) {
    var T = o.plate, E = o.emboss, R = rrect(sizeMm), taken = [], cols = [], parts = [], top = E > 0 ? T : T - INLAY, z1 = E > 0 ? T + E : T;
    groups.forEach(function (g) { // clip to the tile, remove overlaps between colors (earlier color wins)
      var p = CK.exec(CL.ClipType.ctDifference, CK.exec(CL.ClipType.ctIntersection, CK.unionOf(g), R), taken);
      p = clean(p);
      cols.push(p);
      taken = CK.exec(CL.ClipType.ctUnion, taken.concat(p), null);
    });
    var base = newMesh();
    prism(base, polys(R), 0, top, sizeMm);
    if (E === 0) prism(base, polys(clean(CK.exec(CL.ClipType.ctDifference, R, taken))), top, T, sizeMm);
    parts.push({ name: 'base', extruder: 1, mesh: base });
    cols.forEach(function (p, i) {
      if (!p.length) return;
      var m = newMesh();
      prism(m, polys(p), top, z1, sizeMm);
      parts.push({ name: 'color' + (i + 1), extruder: i + 2, mesh: m });
    });
    return parts;
  }

  // ---- 3MF ----
  function write3mf(parts, colors, sizeMm) {
    var NS = 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"', c = Math.max(90, sizeMm / 2 + 5),
        f = function (x) { return x.toFixed(4); }, res = [], comps = [], pcfg = [], oid = 2; // id 1 = basematerials
    var mats = parts.map(function (p) { return '<base name="' + p.name + '" displaycolor="' + colors[p.extruder - 1].toUpperCase() + '"/>'; });
    parts.forEach(function (p, i) {
      var m = p.mesh, vs = [], ts = [], k;
      for (k = 0; k < m.v.length; k += 3) vs.push('<vertex x="' + f(m.v[k]) + '" y="' + f(m.v[k + 1]) + '" z="' + f(m.v[k + 2]) + '"/>');
      for (k = 0; k < m.t.length; k += 3) ts.push('<triangle v1="' + m.t[k] + '" v2="' + m.t[k + 1] + '" v3="' + m.t[k + 2] + '"/>');
      res.push('<object id="' + oid + '" type="model" pid="1" pindex="' + i + '"><mesh><vertices>' + vs.join('') + '</vertices><triangles>' + ts.join('') + '</triangles></mesh></object>');
      comps.push('<component objectid="' + oid + '"/>');
      pcfg.push('<part id="' + oid + '" subtype="normal_part"><metadata key="name" value="' + p.name + '"/><metadata key="extruder" value="' + p.extruder + '"/></part>');
      oid++;
    });
    var model = '<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" ' + NS + '>' +
      '<metadata name="Application">BambuStudio-02.00.00.00</metadata><metadata name="BambuStudio:3mfVersion">1</metadata>' +
      '<resources><basematerials id="1">' + mats.join('') + '</basematerials>' + res.join('') +
      '<object id="' + oid + '" type="model"><components>' + comps.join('') + '</components></object></resources>' +
      '<build><item objectid="' + oid + '" transform="1 0 0 0 1 0 0 0 1 ' + c + ' ' + c + ' 0" printable="1"/></build></model>';
    var cfg = '<?xml version="1.0" encoding="UTF-8"?><config><object id="' + oid + '"><metadata key="name" value="tile"/><metadata key="extruder" value="1"/>' + pcfg.join('') + '</object>' +
      '<plate><metadata key="plater_id" value="1"/><metadata key="plater_name" value=""/><metadata key="locked" value="false"/>' +
      '<model_instance><metadata key="object_id" value="' + oid + '"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="' + (100 + oid) + '"/></model_instance></plate></config>';
    var proj = JSON.stringify({ from: 'project', name: 'project_settings', version: '02.00.00.00',
      filament_colour: colors.map(function (x) { return x.toUpperCase(); }), filament_type: colors.map(function () { return 'PLA'; }) });
    var ct = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
      '<Default Extension="config" ContentType="text/xml"/><Default Extension="json" ContentType="application/json"/></Types>';
    var rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
    var z = {}, u = FF.strToU8;
    z['[Content_Types].xml'] = u(ct); z['_rels/.rels'] = u(rels); z['3D/3dmodel.model'] = u(model);
    z['Metadata/model_settings.config'] = u(cfg); z['Metadata/project_settings.config'] = u(proj);
    return FF.zipSync(z);
  }

  function generate(groups, colors, sizeMm, o) {
    var parts = build(groups, sizeMm, o);
    return { parts: parts, bytes: write3mf(parts, colors, sizeMm) };
  }

  return { build: build, write3mf: write3mf, generate: generate, inspect: inspect, INLAY: INLAY, rrect: rrect, polys: polys };
})();
if (typeof module !== 'undefined') module.exports = Mesh3mf;
