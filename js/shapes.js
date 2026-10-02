// Port of tile_shapes.py. A shape is one ring (array of [x, y] mm points) or an array of rings
// (inner rings are holes, even-odd fill).
var D2R = Math.PI / 180;

function ringsOf(shape) {
  return typeof shape[0][0] === 'number' ? [shape] : shape;
}

function rotate(points, cx, cy, angleDeg) {
  var a = angleDeg * D2R, ca = Math.cos(a), sa = Math.sin(a);
  return points.map(function (p) {
    return [cx + (p[0] - cx) * ca - (p[1] - cy) * sa, cy + (p[0] - cx) * sa + (p[1] - cy) * ca];
  });
}

function polar(cx, cy, r, angleDeg) {
  var a = angleDeg * D2R;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function circlePoly(cx, cy, r, n) {
  n = n || 48;
  var pts = [];
  for (var i = 0; i < n; i++) pts.push([cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
  return pts;
}

// Ring from r(theta_radians). Partial arc + pie=true closes through the center (a wedge).
function polarShape(cx, cy, rFunc, a0, a1, n, pie) {
  a0 = a0 || 0; if (a1 === undefined) a1 = 360; n = n || 240;
  var full = (((a1 - a0) % 360) + 360) % 360 === 0, pts = [], m = full ? n : n + 1;
  for (var i = 0; i < m; i++) {
    var th = (a0 + (a1 - a0) * i / n) * D2R, r = rFunc(th);
    pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  if (pie) pts.push([cx, cy]);
  return pts;
}

// End point (and final heading) of a lensPetal's midline, for placing accents at a curled tip.
function curveTip(cx, cy, angleDeg, length, bend, n) {
  bend = bend || 0; n = n || 40;
  var x = cx, y = cy, a = angleDeg * D2R, step = length / n;
  for (var i = 0; i < n; i++) {
    a = (angleDeg + bend * (i + 1) / n) * D2R;
    x += step * Math.cos(a); y += step * Math.sin(a);
  }
  return [x, y, a / D2R];
}

// Pointed petal from base (cx,cy) toward angleDeg. bend = degrees the midline turns base->tip;
// belly > 1 puts the widest part nearer the tip. opts: {plumpness, bend, belly, n}
function lensPetal(cx, cy, angleDeg, length, width, opts) {
  opts = opts || {};
  var plump = opts.plumpness === undefined ? 0.9 : opts.plumpness,
      bend = opts.bend || 0, belly = opts.belly === undefined ? 1 : opts.belly, n = opts.n || 40;
  var mid = [], x = cx, y = cy, step = length / n;
  for (var i = 0; i <= n; i++) {
    var t = i / n, a = (angleDeg + bend * t) * D2R;
    mid.push([x, y, a, (width / 2) * Math.pow(Math.sin(Math.PI * Math.pow(t, belly)), plump)]);
    x += step * Math.cos(a); y += step * Math.sin(a);
  }
  var upper = mid.map(function (m) { return [m[0] - Math.sin(m[2]) * m[3], m[1] + Math.cos(m[2]) * m[3]]; });
  var lower = mid.slice().reverse().map(function (m) { return [m[0] + Math.sin(m[2]) * m[3], m[1] - Math.cos(m[2]) * m[3]]; });
  return upper.concat(lower);
}

function starPoly(cx, cy, points, rOuter, rInner, rotationDeg) {
  var step = 180 / points, pts = [];
  for (var i = 0; i < points * 2; i++) pts.push(polar(cx, cy, i % 2 === 0 ? rOuter : rInner, (rotationDeg || 0) + i * step));
  return pts;
}

function crossPoly(cx, cy, armLen, armWid, rotationDeg) {
  var h = armWid / 2, L = armLen;
  var pts = [[-h, -L], [h, -L], [h, -h], [L, -h], [L, h], [h, h], [h, L], [-h, L], [-h, h], [-L, h], [-L, -h], [-h, -h]];
  return rotate(pts.map(function (p) { return [cx + p[0], cy + p[1]]; }), cx, cy, rotationDeg || 0);
}

// Four overlapping bars forming a square ring.
function borderFrame(size, w) {
  return [
    [[0, 0], [size, 0], [size, w], [0, w]],
    [[0, size - w], [size, size - w], [size, size], [0, size]],
    [[0, 0], [w, 0], [w, size], [0, size]],
    [[size - w, 0], [size, 0], [size, size], [size - w, size]]
  ];
}

if (typeof module !== 'undefined') module.exports = {
  ringsOf: ringsOf, rotate: rotate, polar: polar, circlePoly: circlePoly, polarShape: polarShape,
  curveTip: curveTip, lensPetal: lensPetal, starPoly: starPoly, crossPoly: crossPoly, borderFrame: borderFrame
};
