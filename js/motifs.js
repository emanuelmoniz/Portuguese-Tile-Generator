// Motif builders for js/engine.js, in local mm coordinates.
// Axis motifs: base at the origin, growing along +x up to length L, mirror-symmetric about the x axis.
// Radial motifs: centered on the origin, outer radius R, symmetric under all 8 square symmetries
// (placed at a tile corner or edge midpoint and clipped, they become corner quarters / edge halves).
// Each returns parts [{role, shape}]; f(role) scales that role (the engine's tuning knob),
// v holds the seeded variant, g is the white gap (mm) kept between parts of different roles.
var Motifs = (function () {
  var TS = typeof module !== 'undefined' ? require('./shapes.js') : window;
  var MINW = 1.6, D = Math.PI / 180; // narrowest petal / band drawn (min raised feature is 1.0 mm)
  var WF = 1; // petal width factor of the axis motif being built (v.wf, fitted by the engine)

  function W(x) { return Math.max(MINW, x); }
  function part(role, shape) { return { role: role, shape: shape }; }
  function petal(x, y, a, len, wid, opts) { return TS.lensPetal(x, y, a, len, W(wid * WF), opts); }
  function axis(fn) { return function (L, f, v, g) { WF = v.wf || 1; var out = fn(L, f, v, g); WF = 1; return out; }; }
  function sides(a) { return a ? [-1, 1] : [1]; }
  function dot(x, y, r) { return TS.circlePoly(x, y, Math.max(0.8, r), 48); }
  function lobed(R, amp, k) { // max radius R, k lobes (multiple of 4 keeps D4 symmetry)
    return TS.polarShape(0, 0, function (th) { return R - amp + amp * Math.cos(k * th); }, 0, 360, 240);
  }
  // fan of petals from (t, 0): rows [angle, length, width, bend] as fractions of len
  function fan(role, t, len, rows, belly) {
    var out = [];
    rows.forEach(function (q) {
      sides(q[0]).forEach(function (s) {
        out.push(part(role, petal(t, 0, s * q[0], len * q[1], len * q[2], { bend: s * q[3], belly: belly })));
      });
    });
    return out;
  }

  // ---- axis motifs ----
  function palmette(L, f, v, g) {
    var rd = v.dot ? W(0.2 * L) / 2 : 0, t0 = v.dot ? 2 * rd + g : 0;
    var rows = v.n === 3 ? [[0, 1, .44, 0], [46, .74, .4, 14]] : [[0, 1, .44, 0], [26, .8, .42, 12], [52, .62, .38, 30]];
    var out = fan('a', t0, (L - t0) * f('a'), rows, 1.4);
    if (v.dot) out.push(part('b', dot(rd, 0, rd * Math.min(f('b'), 1.2))));
    return out;
  }

  function tulip(L, f, v, g) {
    var t0 = 0.3 * L, fb = f('b'), out = [part('a', petal(t0, 0, 0, (L - t0) * f('a'), 0.6 * L * f('a') * v.fat, { belly: 1.45 }))];
    sides(1).forEach(function (s) {
      out.push(part('b', petal(0.04 * L, s * 0.1 * L, s * 62, 0.5 * L * fb, 0.2 * L * fb, { bend: s * 40 })));
    });
    return out;
  }

  function carnation(L, f, v, g) {
    var cup = 0.4 * L * Math.min(f('b'), 1.2), t = cup + g;
    return [part('b', petal(0, 0, 0, cup, 0.34 * L * f('b'), { belly: 1.6, plumpness: 0.7 }))]
      .concat(fan('a', t, (L - t) * f('a'), [[0, 1, .34, 0], [34, .88, .3, 10], [66, .7, .26, 22]], 1.3));
  }

  function fleur(L, f, v, g) {
    var fa = f('a'), bw = W(0.09 * L * f('b')), tb = 0.24 * L, tp = tb + 0.06 * L + g, hb = 0.19 * L * f('b'), tf = tb - 0.06 * L - g;
    var out = [part('a', petal(tp, 0, 0, (L - tp) * fa, 0.3 * L * fa, { belly: 1.2 })), part('b', petal(tb, -hb, 90, 2 * hb, bw, {}))];
    sides(1).forEach(function (s) {
      out.push(part('a', petal(tp, s * 0.05 * L, s * 40, 0.5 * L * fa, 0.17 * L * fa, { bend: s * 105, belly: 0.9 })));
    });
    if (tf > 1.5) out.push(part('a', petal(tf, 0, 180, tf, 0.22 * L * fa, { belly: 0.8 })));
    return out;
  }

  function scrolls(L, f, v, g) { // two leaves curling outward, a bud or tip dots in the second color
    var fa = f('a'), len = 0.85 * L * fa, out = [];
    sides(1).forEach(function (s) {
      out.push(part('a', petal(0, s * 0.08 * L, s * 24, len, 0.24 * L * fa, { bend: s * 80, belly: 0.75 })));
      if (!v.bud) {
        var tip = TS.curveTip(0, s * 0.08 * L, s * 24, len, s * 80), r = W(0.12 * L) / 2;
        out.push(part('b', dot(tip[0] + (g + r) * Math.cos(tip[2] * D), tip[1] + (g + r) * Math.sin(tip[2] * D), r * Math.min(f('b'), 1.2))));
      }
    });
    if (v.bud) out.push(part('b', petal(0.2 * L, 0, 0, 0.6 * L * f('b'), 0.22 * L * f('b'), { belly: 1.3 })));
    return out;
  }

  function bud(L, f) { return [part('a', petal(0, 0, 0, L * f('a'), 0.5 * L * f('a'), { belly: 1.3 }))]; }

  // ---- radial motifs ----
  function medallion(R, f, v, g) { // lobed band around a flower and a heart
    var amp = v.amp * R, bwN = W(v.band * R), bw = Math.min(W(bwN * f('a')), bwN * 1.3);
    var out = [part('a', [lobed(R, amp, v.k), lobed(R - bw, amp, v.k)])];
    var Ri = R - 2 * amp - bwN * 1.3 - g, rh = Math.max(0.8, 0.17 * Ri), r0 = rh * 1.2 + g, lp = Ri - r0;
    if (lp >= 2.5) {
      var len = lp * f('b'), wid = Math.min(0.7 * len, 0.8 * 2 * Math.PI * (r0 + len / 2) / v.n);
      for (var i = 0; i < v.n; i++) {
        var a = v.po + i * 360 / v.n, p = TS.polar(0, 0, r0, a);
        out.push(part('b', petal(p[0], p[1], a, len, wid, { belly: 1.2 })));
      }
      out.push(part('c', dot(0, 0, rh * Math.min(f('c'), 1.2))));
    } else if (Ri > 1) out.push(part('c', dot(0, 0, 0.8 * Ri * Math.min(f('c'), 1.2))));
    return out;
  }

  function rosette(R, f, v, g) { // 8 petals, long and short, around a heart
    var rh = Math.max(0.8, 0.13 * R), big = R > 9, r0 = big ? rh * 1.2 + g : 0.12 * R, lp = R - r0, out = [];
    for (var i = 0; i < 8; i++) {
      var a = i * 45, long = (i % 2 === 0) !== v.diagLong, role = long ? 'a' : 'b';
      var len = lp * (long ? 1 : 0.7) * f(role), p = TS.polar(0, 0, r0, a);
      out.push(part(role, petal(p[0], p[1], a, len, Math.min(0.6 * len, 0.8 * 2 * Math.PI * (r0 + len / 2) / 8), { belly: 1.25 })));
    }
    if (big) out.push(part('c', dot(0, 0, rh * Math.min(f('c'), 1.2))));
    return out;
  }

  function lobedDisc(R, f, v, g) { // solid lobed disc, with a dot in the center or on the diagonals
    var Rf = R * Math.min(f('a'), 1.3), amp = 0.09 * Rf, rings = [lobed(Rf, amp, v.k)], dots = [];
    var rd = Math.max(0.8, 0.12 * R), dc = v.dots === 'c' ? 0 : 0.55 * R, hole = rd * 1.2 + g;
    if (dc + hole + MINW < 0.82 * R) { // decided at nominal size, so the roles don't depend on f
      (dc ? [45, 135, 225, 315].map(function (a) { return TS.polar(0, 0, dc, a); }) : [[0, 0]]).forEach(function (p) {
        if (dc + hole + MINW < Rf - 2 * amp) rings.push(TS.circlePoly(p[0], p[1], hole, 48));
        dots.push(part('b', dot(p[0], p[1], rd * Math.min(f('b'), 1.2))));
      });
    }
    return [part('a', rings)].concat(dots);
  }

  // rotate local parts by a degrees and move the origin to (x, y)
  function place(parts, x, y, a) {
    var c = Math.cos(a * D), s = Math.sin(a * D);
    return parts.map(function (p) {
      return part(p.role, TS.ringsOf(p.shape).map(function (r) {
        return r.map(function (q) { return [x + q[0] * c - q[1] * s, y + q[0] * s + q[1] * c]; });
      }));
    });
  }

  return {
    MINW: MINW, place: place, dot: dot,
    palmette: axis(palmette), tulip: axis(tulip), carnation: axis(carnation), fleur: axis(fleur), scrolls: axis(scrolls), bud: axis(bud),
    medallion: medallion, rosette: rosette, lobedDisc: lobedDisc
  };
})();

if (typeof module !== 'undefined') module.exports = Motifs;
