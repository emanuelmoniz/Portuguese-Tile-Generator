// Design engine (plan.md section 2): seeded padrao layout -> color assignment -> tuning loop.
// generate({seed, sizeMm, colors, percents, coverage, border, frameColor}) -> {groups, report}
//   percents = share of the raised area per raised color (sum 100), coverage = raised / tile area in %,
//   border = 'on' | 'off' | 'random' (decided by the seed).
// groups[k] = shapes of raised color k in tile mm coordinates (one shape of rings, even-odd), as check.js expects.
// Modes: "white" = colored motifs on the base color (low coverage); "ground" = a raised color fills the tile
// outside a white central reserve, some motifs cut out of it in the base color; "two" = like ground, but the
// reserve is filled by a second raised color (high coverage with 2-3 colors). The first that hits the targets wins.
// Exact D4 symmetry: all clipper work is done on one eighth of the tile, then mirrored.
var Engine = (function () {
  var node = typeof module !== 'undefined';
  var TS = node ? require('./shapes.js') : window, CK = node ? require('./check.js') : window,
      M = node ? require('./motifs.js') : window.Motifs, CL = node ? require('../vendor/clipper.js') : window.ClipperLib;
  var SC = CK.SC, CHANNEL = 1.7, FEATURE = 1.1, TOL = 5, FMIN = 0.55, GROW = 1.12, R4 = [0, 1, 2, 3], DEG = Math.PI / 180;

  function mulberry32(a) {
    return function () {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function one() { return 1; }
  function grow() { return GROW; }

  // clipper helpers: integer paths in tile coordinates
  function U(a) { return CK.exec(CL.ClipType.ctUnion, a, null); }
  function I(a, b) { return CK.exec(CL.ClipType.ctIntersection, a, b); }
  function D(a, b) { return CK.exec(CL.ClipType.ctDifference, a, b); }
  function off(a, d) { // round offset, 0.02 mm arc tolerance (check.js's finer one is too slow for the loop)
    if (!d || !a.length) return a;
    var co = new CL.ClipperOffset(2, 0.02 * SC), out = new CL.Paths();
    co.AddPaths(CL.Clipper.CleanPolygons(a, 0.01 * SC), CL.JoinType.jtRound, CL.EndType.etClosedPolygon);
    co.Execute(out, d * SC);
    return out;
  }
  function opening(a, d) { return off(off(a, -d / 2), d / 2); }
  function closing(a, d) { return off(off(a, d / 2), -d / 2); }
  function flat(a) { return [].concat.apply([], a); }
  function square(S) { var s = S * SC; return [[{ X: 0, Y: 0 }, { X: s, Y: 0 }, { X: s, Y: s }, { X: 0, Y: s }]]; }
  function inside(paths, x, y) { // even-odd point test
    var pt = { X: Math.round(x * SC), Y: Math.round(y * SC) }, n = 0;
    paths.forEach(function (p) { if (CL.Clipper.PointInPolygon(pt, p) !== 0) n++; });
    return n % 2 === 1;
  }
  // rotate a centered shape by k * 90 degrees (exact) and shift it by h
  function rot(shape, k, h) {
    return TS.ringsOf(shape).map(function (r) {
      return r.map(function (p) {
        var x = p[0], y = p[1];
        return k === 0 ? [h + x, h + y] : k === 1 ? [h - y, h + x] : k === 2 ? [h - x, h - y] : [h + y, h - x];
      });
    });
  }

  // ---- 1. seeded layout: slots in tile-centered coordinates, each repeated by its rotations ----
  function makeLayout(rng, S, border) {
    var h = S / 2, lvl = S < 30 ? 0 : S < 70 ? 1 : S < 140 ? 2 : 3, g = clamp(0.03 * S, CHANNEL, 5);
    var bw = border ? Math.max(1.2, 0.03 * S) : 0, hi = h - bw * GROW, slots = [];
    function rnd(a, b) { return a + (b - a) * rng(); }
    function pick(a) { return a[Math.floor(rng() * a.length)]; }
    function variant(kind) {
      if (kind === 'medallion') {
        var k = pick([4, 8, 8, 12, 16]);
        return { k: k, amp: k === 4 ? 0.16 : rnd(0.05, 0.08), band: rnd(0.1, 0.16), n: k === 4 ? 4 : lvl >= 3 && rng() < 0.5 ? 16 : 8, po: k === 4 ? 45 : 0 };
      }
      if (kind === 'rosette') return { diagLong: rng() < 0.5 };
      if (kind === 'lobedDisc') return { k: pick([8, 12, 16]), dots: pick(['c', 'diag']) };
      if (kind === 'palmette') return { n: lvl >= 2 ? pick([3, 5]) : 3, dot: rng() < 0.5 };
      if (kind === 'tulip') return { fat: rnd(0.85, 1.15) };
      if (kind === 'scrolls') return { bud: rng() < 0.5 };
      return {};
    }
    function radial(name, kind, R, x, y, rots) {
      var v = variant(kind);
      slots.push({ name: name, kind: kind, rots: rots, make: function (f) { return M.place(M[kind](R, f, v, g), x, y, 0); } });
    }

    // every slot may grow to GROW x its nominal size without touching its neighbors (room reserved below)
    var Rm = hi * (lvl ? rnd(0.4, 0.5) : rnd(0.6, 0.68));
    radial('center', lvl ? pick(['medallion', 'medallion', 'rosette']) : 'lobedDisc', Rm, 0, 0, [0]);
    var Rq = h * (lvl ? rnd(0.3, 0.4) : rnd(0.36, 0.44));
    radial('corner', lvl ? pick(['lobedDisc', 'medallion', 'rosette']) : 'lobedDisc', Rq, h, h, R4);
    var Re = lvl >= 2 && rng() < 0.5 ? h * rnd(0.16, 0.24) : 0;
    if (Re) radial('edge', pick(['rosette', 'lobedDisc']), Re, h, 0, R4);
    Rm *= GROW; Rq *= GROW; Re *= GROW;

    // axis motifs: as long as fits between the medallion, the corners/edges, the frame and its angular sector
    var corners = [[h, h], [-h, h], [-h, -h], [h, -h]], mids = [[h, 0], [0, h], [-h, 0], [0, -h]];
    function near(q, cs, r) { return cs.some(function (c) { return Math.hypot(q[0] - c[0], q[1] - c[1]) < r; }); }
    function fits(parts, alpha, half) {
      return parts.every(function (p) {
        return p.shape.every(function (r) {
          return r.every(function (q) {
            var d = Math.hypot(q[0], q[1]);
            if (d < Rm + g - 0.01 || Math.abs(q[0]) > hi - g || Math.abs(q[1]) > hi - g) return false;
            if (near(q, corners, Rq + g) || (Re && near(q, mids, Re + g))) return false;
            return Math.abs(Math.atan2(q[1], q[0]) - alpha * DEG) <= half - g / 2 / d;
          });
        });
      });
    }
    function axis(name, kinds, alpha, half, Lmax) {
      var kind = pick(kinds), v = variant(kind), base = TS.polar(0, 0, Rm + g, alpha), lo = 0, up = Lmax;
      var make = function (L, f) { return M.place(M[kind](L, f, v, g), base[0], base[1], alpha); };
      for (var i = 0; i < 14 && up > 4; i++) {
        var mid = (lo + up) / 2;
        if (fits(make(mid, grow), alpha, half)) lo = mid; else up = mid;
      }
      var wlo = 1, wup = 1.4; // then fatten the petals until the motif fills its sector
      for (i = 0; i < 6 && lo >= 4; i++) {
        v.wf = (wlo + wup) / 2;
        if (fits(make(lo, grow), alpha, half)) wlo = v.wf; else wup = v.wf;
      }
      v.wf = wlo;
      if (lo >= 4) slots.push({ name: name, kind: kind, rots: R4, make: function (f) { return make(lo, f); } });
      return kind;
    }
    var split = rnd(0.48, 0.62); // the diagonal motif's part of the 45 degree quadrant
    var dk = axis('diagonal', lvl ? ['palmette', 'palmette', 'tulip', 'carnation', 'fleur', 'scrolls'] : ['bud'], 45, 45 * split * DEG,
      Math.SQRT2 * h - Rq - Rm - 2 * g);
    axis('cardinal', lvl ? ['tulip', 'fleur', 'carnation', 'scrolls', 'palmette', 'bud'].filter(function (k) { return k !== dk; }) : ['bud'],
      0, 45 * (1 - split) * DEG, (Re ? h - Re : hi) - Rm - 2 * g);

    // no diagonal motif: the corners may grow into the free room up to the medallion
    if (!slots.some(function (s) { return s.name === 'diagonal'; })) slots[1].cap = clamp((Math.SQRT2 * h - g - Rm) / (Rq / GROW), GROW, 1.6);
    var frameAt = slots.length;
    if (border) slots.push({ name: 'frame', rots: [0], make: function (f) {
      return TS.borderFrame(S, Math.max(1.2, bw * f('a'))).map(function (r) {
        return { role: 'a', shape: [r.map(function (p) { return [p[0] - h, p[1] - h]; })] };
      });
    } });
    // fillers: small rosettes / lobed discs (dots when small) in the biggest white gaps,
    // one orbit of 8 (4 on a mirror line) at a time, until the layout is dense enough to tune
    var sqC = [[{ X: -h * SC, Y: -h * SC }, { X: h * SC, Y: -h * SC }, { X: h * SC, Y: h * SC }, { X: -h * SC, Y: h * SC }]];
    var pts = [], u = [], filled = 0;
    function add(s) {
      var shapes = [];
      s.make(one).forEach(function (p) { s.rots.forEach(function (k) { shapes.push(rot(p.shape, k, 0)); }); });
      if (s.name !== 'frame') shapes.forEach(function (sh) { sh.forEach(function (r) { pts.push.apply(pts, r); }); });
      u = U(u.concat(CK.unionOf(shapes)));
      filled = CK.area(I(u, sqC));
    }
    slots.forEach(add);
    for (var n = 0; n < [1, 2, 2, 3][lvl] && filled < 0.58 * S * S; n++) {
      var best = null, st = S / 70;
      for (var x = st / 2; x < hi; x += st) {
        for (var y = 0; y <= x; y += st) { // one eighth of the tile, the rest follows by symmetry
          var c = hi - x, beat = (best ? best[2] : 0.8) + g;
          for (var i = 0; i < pts.length && c > beat; i++) c = Math.min(c, Math.hypot(pts[i][0] - x, pts[i][1] - y));
          if (c > beat && !inside(u, x, y)) best = [x, y, c - g];
        }
      }
      if (!best) break;
      slots.push(filler(best[0], best[1], Math.min(best[2], 0.12 * S) / GROW));
      add(slots[slots.length - 1]);
    }
    function filler(x, y, r) {
      var kind = r >= 3.5 ? pick(['rosette', 'lobedDisc']) : 'dot', v = variant(kind), seen = {}, pos = [];
      [[x, y], [-x, y], [x, -y], [-x, -y], [y, x], [-y, x], [y, -x], [-y, -x]].forEach(function (q) {
        var key = q[0].toFixed(3) + ',' + q[1].toFixed(3);
        if (!seen[key]) { seen[key] = 1; pos.push(q); }
      });
      if (kind === 'dot') r = Math.min(r, 2.5 + 0.01 * S);
      return { name: 'filler', kind: kind, rots: [0], make: function (f) {
        return flat(pos.map(function (q) {
          return kind === 'dot' ? [{ role: 'a', shape: [M.dot(q[0], q[1], r * Math.min(f('a'), 1.2))] }] : M.place(M[kind](r, f, v, g), q[0], q[1], 0);
        }));
      } };
    }
    return { S: S, h: h, g: g, border: border, slots: slots, frame: border ? frameAt : -1 };
  }

  function groupsOf(lay) { // one group per (slot, role), with its area at f = 1
    var sq = square(lay.S), out = [];
    lay.slots.forEach(function (s, si) {
      var byRole = {};
      s.make(one).forEach(function (p) {
        s.rots.forEach(function (k) { (byRole[p.role] = byRole[p.role] || []).push(rot(p.shape, k, lay.h)); });
      });
      Object.keys(byRole).forEach(function (role) {
        out.push({ key: si + role, slot: si, area: CK.area(I(CK.unionOf(byRole[role]), sq)) });
      });
    });
    return out;
  }

  // ---- 2. color assignment: groups -> colors (index K = white, ground modes only) ----
  // mode 'white': no ground; 'ground': color kg fills the rest; 'two': kg outside the reserve, ki inside it
  function assign(gs, p, T, S2, mode, rng, pin) { // pin = {i: group index, k: color} or null
    var pi = pin ? pin.i : -1;
    var K = p.length, ground = mode !== 'white', nc = ground ? K + 1 : K, best = null, lnMin = Math.log(FMIN), lnMax = Math.log(GROW);
    function dev(x, lo, hi) { return 0.5 * Math.abs(x) + 10 * Math.max(0, lo - x, x - hi); }
    function cost(a, kg, ki) {
      var A = [], c = 0, i, j, k;
      for (k = 0; k < nc; k++) A.push(0);
      for (i = 0; i < a.length; i++) A[a[i]] += gs[i].area;
      for (k = 0; k < K; k++) {
        var t = p[k] / 100 * T;
        if (k === kg || k === ki) { if (A[k] > 0.7 * t) c += 2 * Math.log(A[k] / (0.7 * t)); continue; }
        if (!A[k]) return 1e9;
        c += dev(Math.log(t / A[k]) / 2, lnMin, lnMax);
      }
      // full ground (no reserve) gives at most 1 - white coverage
      if (ground && A[K] > 0.8 * (S2 - T)) c += 3 * Math.log(A[K] / (0.8 * (S2 - T) + 1e-9));
      for (i = 0; i < a.length; i++) for (j = i + 1; j < a.length; j++) if (gs[i].slot === gs[j].slot && a[i] === a[j]) c += 0.15;
      return c;
    }
    var pairs = [];
    p.forEach(function (x, kg) {
      if (mode === 'ground') pairs.push([kg, -1]);
      if (mode === 'two') p.forEach(function (y, ki) { if (ki !== kg) pairs.push([kg, ki]); });
    });
    if (mode === 'white') pairs.push([-1, -1]);
    pairs.forEach(function (pr) {
      for (var trial = 0; trial < (mode === 'two' ? 20 : 40); trial++) {
        var a = gs.map(function (g, i) { return i === pi ? pin.k : Math.floor(rng() * nc); }), c = cost(a, pr[0], pr[1]), better = true;
        while (better) {
          better = false;
          for (var i = 0; i < a.length; i++) {
            for (var k = 0; k < nc; k++) {
              if (a[i] === k || i === pi) continue;
              var old = a[i]; a[i] = k;
              var c2 = cost(a, pr[0], pr[1]);
              if (c2 < c - 1e-9) { c = c2; better = true; } else a[i] = old;
            }
          }
        }
        c += rng() * 0.03; // the seed picks among near-equal assignments
        if (!best || c < best.c) best = { c: c, a: a.slice(), kg: pr[0], ki: pr[1] };
      }
    });
    if (!best) return null; // 'two' needs 2+ colors
    var asg = {};
    gs.forEach(function (gr, i) { asg[gr.key] = best.a[i]; });
    return { asg: asg, color: best.kg, inner: best.ki };
  }

  // ---- geometry for one set of knobs F (size factor per color, F[K] = white motifs) ----
  function build(lay, asg, F, gr) {
    var K = F.length - 1, lists = F.map(function () { return []; }), sq = square(lay.S), k;
    lay.slots.forEach(function (s, si) {
      var f = function (role) { return Math.min(s.cap || GROW, F[asg[si + role]]); };
      s.make(f).forEach(function (p) {
        var c = asg[si + p.role];
        s.rots.forEach(function (k) { lists[c].push(rot(p.shape, k, lay.h)); });
      });
    });
    // only the eighth that symmetrize() keeps is computed, plus a margin wider than all offsets below
    var m = lay.S * SC / 2, keep = I(off([[{ X: m, Y: m }, { X: 2 * m, Y: m }, { X: 2 * m, Y: 2 * m }]], 4 * CHANNEL + 3), sq);
    // same color: drop slivers thinner than a feature, then fill gaps narrower than a channel
    // (the ring outside the tile makes motifs that come close to the edge join it)
    var ring = D(off(sq, 2 * CHANNEL), sq), corners = I(closing(ring, CHANNEL), sq); // = fillets in the tile corners
    var u = lists.map(function (l) {
      var p = opening(I(CK.unionOf(l), keep), FEATURE);
      return U(D(I(closing(p.concat(ring), CHANNEL), keep), corners).concat(I(p, corners)));
    }), white = u.pop();
    // different colors: keep a white channel between them (the frame's color is never cut)
    var order = [], fc = asg[lay.frame + 'a'];
    for (k = 0; k < K; k++) if (k !== fc) order.push(k);
    if (fc !== undefined && fc < K) order.unshift(fc);
    order.forEach(function (k, i) {
      if (i) u[k] = opening(D(u[k], off(U(flat(order.slice(0, i).map(function (j) { return u[j]; }))), CHANNEL)), FEATURE);
    });
    if (gr) { // ground: fills the rest outside a lobed reserve of radius rho, outlined around its own color;
      // the reserve stays white, or (two-tone) is filled the same way by the inner color
      var reserve = gr.rho > 0 ? CK.toPaths(TS.polarShape(lay.h, lay.h, function (th) { return gr.rho * (0.92 + 0.08 * Math.cos(8 * th)); }, 0, 360, 240)) : [];
      var fillGround = function (kc, region) {
        var holes = U(white.concat(flat(u.map(function (p, k) { return k === kc ? off(p, gr.gap) : p; }))));
        u[kc] = U(u[kc].concat(D(opening(D(region, holes), FEATURE), holes)));
      };
      var inner = gr.inner >= 0 && reserve.length ? I(keep, off(reserve, -gr.gap)) : null; // white line between the fields
      fillGround(gr.color, D(keep, reserve));
      if (inner) fillGround(gr.inner, D(inner, u[gr.color]));
    }
    // white channels still narrower than CHANNEL go to a neighboring color
    var base = D(keep, U(flat(u))), thin = D(base, opening(base, CHANNEL));
    for (k = 0; k < K && CK.area(thin) > 1e-3; k++) {
      var t = I(thin, off(u[k], CHANNEL));
      if (t.length) { u[k] = U(u[k].concat(t)); thin = D(thin, t); }
    }
    // mirror the eighth (so the loop measures what it returns) and drop specks left by the cuts
    // (a hole is smaller than its outline, so holes never lose their outline). Mirrored again after the
    // filter: clipper may split the same notch differently on two sides, and the filter must not see that.
    var speck = Math.max(1.5, 1.5e-4 * lay.S * lay.S) * SC * SC;
    u = u.map(function (p) {
      return symmetrize(symmetrize(p, lay.S).filter(function (q) { return Math.abs(CL.Clipper.Area(q)) >= speck; }), lay.S);
    });
    var areas = u.map(CK.area);
    return { u: u, areas: areas, raised: sum(areas), white: CK.area(white) };
  }

  // exact D4 symmetry: keep the eighth 0 <= y <= x (tile-centered) and mirror it 8 ways
  function symmetrize(paths, S) {
    var s = S * SC, m = s / 2, piece = I(paths, [[{ X: m, Y: m }, { X: s, Y: m }, { X: s, Y: s }]]), all = [];
    piece.forEach(function (p) { // clipper rounds cut points on the diagonal: put them exactly on it
      p.forEach(function (q) { if (Math.abs(q.X - q.Y) <= 2) q.X = q.Y = Math.round((q.X + q.Y) / 2); });
    });
    [0, 1, 2, 3, 4, 5, 6, 7].forEach(function (k) {
      var fx = k & 1, fy = k & 2, sw = k & 4, flip = (fx ? 1 : 0) ^ (fy ? 1 : 0) ^ (sw ? 1 : 0);
      piece.forEach(function (p) {
        var q = p.map(function (v) { var x = fx ? s - v.X : v.X, y = fy ? s - v.Y : v.Y; return sw ? { X: y, Y: x } : { X: x, Y: y }; });
        all.push(flip ? q.reverse() : q);
      });
    });
    return U(all);
  }

  // ---- 3. tuning loop: resize per color until coverage and shares hit the targets ----
  function tune(lay, a, p, cov) {
    var K = p.length, S2 = lay.S * lay.S, T = cov / 100 * S2, F = [], best = null, gain = 0, k;
    var gr = a.color >= 0 ? { color: a.color, inner: a.inner, gap: CHANNEL, rho: a.inner >= 0 ? lay.h : 0 } : null;
    var lo = 0, hi = lay.S;
    function step(f, want, have, lo, hi) { return clamp(f * clamp(Math.sqrt(Math.max(want, 1e-6) / Math.max(have, 1e-6)), 0.7, 1.4), lo, hi); }
    var cap = []; // per color: the most any of its slots can grow (no wind-up past that)
    for (k = 0; k <= K; k++) { F.push(1); cap.push(GROW); }
    Object.keys(a.asg).forEach(function (key) { var c = a.asg[key]; cap[c] = Math.max(cap[c], lay.slots[parseInt(key, 10)].cap || GROW); });
    for (var it = 0; it < 12; it++) {
      var r = build(lay, a.asg, F, gr), c = r.raised / S2 * 100;
      var sh = r.areas.map(function (x) { return r.raised ? x / r.raised * 100 : 0; });
      var err = Math.max.apply(null, [Math.abs(c - cov)].concat(sh.map(function (s, k) { return Math.abs(s - p[k]); })));
      if (!best || err < best.err - 0.2) gain = it;
      else if (it - gain >= 4) break; // no progress
      if (!best || err < best.err) best = { r: r, err: err, F: F.slice(), asg: a.asg, mode: !gr ? 'white' : gr.inner >= 0 ? 'two' : 'ground' };
      if (err < 1) break;
      var was = F.join();
      for (k = 0; k < K; k++) if (!gr || k !== gr.color) F[k] = step(F[k], p[k] / 100 * T, r.areas[k], FMIN, cap[k]);
      var whiteF = function (lo2) { return step(F[K], (S2 - T) - (S2 - r.raised - r.white), r.white, lo2, GROW); };
      if (gr && gr.inner >= 0) { // two-tone: the reserve splits the two ground colors, white motifs set the coverage
        if (sh[gr.inner] > p[gr.inner]) hi = gr.rho; else lo = gr.rho;
        gr.rho = (lo + hi) / 2;
        F[K] = whiteF(0.3);
        if (F[K] >= GROW && c > cov) gr.gap = Math.min(gr.gap * 1.3, 3 * CHANNEL); // white maxed out: wider outlines
      } else if (gr) { // bisect the reserve radius: a bigger white reserve = less ground
        if (c > cov) lo = gr.rho; else hi = gr.rho;
        gr.rho = (lo + hi) / 2;
        // full ground and still too little coverage: shrink the white motifs
        if (gr.rho < 0.01 * lay.S && c < cov) F[K] = whiteF(FMIN);
      } else if (F.join() === was) break; // every knob is at its limit
    }
    return best;
  }

  function generate(o) {
    var seed = (o.seed === undefined ? Math.floor(Math.random() * 4294967296) : o.seed) >>> 0, rng = mulberry32(seed);
    var S = o.sizeMm, p = o.percents, cov = o.coverage, S2 = S * S, T = cov / 100 * S2;
    var border = o.border === 'random' ? rng() < 0.5 : o.border === 'on';
    var lay = makeLayout(rng, S, border), gs = groupsOf(lay), nominal = sum(gs.map(function (x) { return x.area; })) / S2 * 100;
    var fc = border && o.frameColor !== undefined && o.frameColor !== 'auto' ? parseInt(o.frameColor, 10) - 1 : -1;
    if (!(fc >= 0 && fc < p.length)) fc = -1;
    var pin = null;
    if (fc >= 0) gs.forEach(function (g, i) { if (g.key === lay.frame + 'a') pin = { i: i, k: fc }; });
    var order = cov > Math.max(45, nominal * GROW * GROW) ? ['ground', 'two', 'white'] : ['white', 'ground', 'two'], best = null;
    order.forEach(function (mode) {
      if (best && best.err <= 3.5) return; // a mode hit the targets: skip the rest
      var a = assign(gs, p, T, S2, mode, rng, pin), r = a && tune(lay, a, p, cov);
      if (r && (!best || r.err < best.err)) best = r;
    });

    var groups = best.r.u.map(function (paths) {
      return paths.length ? [paths.map(function (pa) { return pa.map(function (q) { return [q.X / SC, q.Y / SC]; }); })] : [];
    });
    var fi = lay.frame >= 0 ? best.asg[lay.frame + 'a'] : -1; // color group of the frame (white = none)
    return { groups: groups, report: makeReport(groups, S, { seed: seed, border: border, fc: fc, mode: best.mode, coverage: cov, percents: p,
      frameIdx: fi >= 0 && fi < p.length ? fi : -1, frameWidth: Math.max(1.2, Math.max(1.2, 0.03 * S) * Math.min(GROW, best.F[fi])) }) };
  }

  function makeReport(groups, S, o) {
    var p = o.percents, cov = o.coverage, fc = o.fc, S2 = S * S;
    // allowed mm2: channels/symmetry = numeric noise (+ the 4 open tile corners); features also = pointed petal tips
    var an = CK.analyze(groups, S), eps = 1 + 1e-4 * S2, epsTips = 1 + 0.01 * S2;
    var report = {
      seed: o.seed, sizeMm: S, border: o.border, frameColor: fc < 0 ? 'auto' : fc + 1, mode: o.mode,
      coverage: { target: cov, achieved: an.coverage },
      shares: p.map(function (x, k) { return { target: x, achieved: an.shares[k] }; }),
      thinFeatures: sum(an.thinFeatures), thinChannels: an.thinChannels, overlap: an.overlap, symmetry: an.symmetry.max,
      frameIdx: o.frameIdx, frameWidth: o.frameWidth, warnings: []
    };
    if (Math.abs(an.coverage - cov) > TOL) report.warnings.push('coverage');
    if (report.shares.some(function (s) { return Math.abs(s.achieved - s.target) > TOL; })) report.warnings.push('shares');
    if (fc >= 0 && Math.abs(an.shares[fc] - p[fc]) > TOL) report.warnings.push('frameColorConflict');
    if (an.thinChannels > eps) report.warnings.push('channels');
    if (report.thinFeatures > epsTips) report.warnings.push('features');
    if (an.symmetry.max > eps) report.warnings.push('symmetry');
    if (an.overlap > eps / 10) report.warnings.push('overlap');
    return report;
  }

  // "Update tile": same design at a new size. groups = shapes (ring | array of rings), ring = [[x, y], ...]
  function scaleGroups(groups, k) {
    var sc = function (a) { return typeof a[0] === 'number' ? [a[0] * k, a[1] * k] : a.map(sc); };
    return sc(groups);
  }
  function rescale(res, newSizeMm) {
    var r = res.report, groups = scaleGroups(res.groups, newSizeMm / r.sizeMm);
    return { groups: groups, report: makeReport(groups, newSizeMm, { seed: r.seed, border: r.border, fc: r.frameColor === 'auto' ? -1 : r.frameColor - 1, mode: r.mode, frameIdx: r.frameIdx, frameWidth: r.frameWidth * newSizeMm / r.sizeMm, coverage: r.coverage.target, percents: r.shares.map(function (s) { return s.target; }) }) };
  }

  // new frame color: only the frame rectangles move to another color group, everything else stays
  function reframe(res, frameColor) {
    var r = res.report, S = r.sizeMm, k = r.shares.length, to = frameColor === 'auto' ? r.frameIdx : frameColor - 1, groups = res.groups, fc = frameColor === 'auto' ? -1 : to;
    if (r.frameIdx < 0 || !(to >= 0 && to < k)) return res;
    if (to !== r.frameIdx) {
      var band = CK.unionOf([TS.borderFrame(S, r.frameWidth)]), g = groups.map(function (s) { return CK.unionOf(s); });
      g[r.frameIdx] = D(g[r.frameIdx], band);
      g[to] = U(g[to].concat(band));
      groups = g.map(function (paths) { return paths.length ? [paths.map(function (pa) { return pa.map(function (q) { return [q.X / SC, q.Y / SC]; }); })] : []; });
    }
    return { groups: groups, report: makeReport(groups, S, { seed: r.seed, border: r.border, fc: fc, mode: r.mode, frameIdx: to, frameWidth: r.frameWidth, coverage: r.coverage.target, percents: r.shares.map(function (s) { return s.target; }) }) };
  }

  // form params that differ from the last generated ones (keys of a, compared by value)
  var STYLE = ['sizeMm', 'colors', 'frameColor'];
  function changedParams(last, cur) {
    return Object.keys(last).filter(function (k) { return JSON.stringify(last[k]).toLowerCase() !== JSON.stringify(cur[k]).toLowerCase(); });
  }
  function isStyleOnly(keys) { return keys.every(function (k) { return STYLE.indexOf(k) >= 0; }); }

  return { version: '1.5.0', generate: generate, rescale: rescale, reframe: reframe, changedParams: changedParams, isStyleOnly: isStyleOnly, mulberry32: mulberry32 };
})();

if (typeof module !== 'undefined') module.exports = Engine;
