// Viewer.show(canvas, parts, colors, sizeMm): three.js view of Mesh3mf parts (mesh = {v, t}, z up). Render on demand.
// Viewer.dispose(): free GPU objects.  Viewer.reset(): back to the start view.  Viewer.setTheme(dark).  Viewer.resize().
var Viewer = (function () {
  var S = null; // { r, scene, cam, ctl, canvas, dist }

  function bg(dark) { return dark ? 0x0f172a : 0xf8fafc; }
  function render() { if (S) S.r.render(S.scene, S.cam); }

  function resize() {
    if (!S) return;
    var w = S.canvas.clientWidth, h = S.canvas.clientHeight;
    if (!w || !h) return;
    S.r.setSize(w, h, false);
    S.cam.aspect = w / h;
    S.cam.updateProjectionMatrix();
    render();
  }

  function reset() {
    if (!S) return;
    var c = S.center, d = S.dist;
    S.cam.position.set(c.x + d * 0.5, c.y - d * 0.9, c.z + d * 0.8);
    S.ctl.target.copy(c);
    S.ctl.update();
    render();
  }

  function dispose() {
    if (!S) return;
    window.removeEventListener('resize', resize);
    S.ctl.dispose();
    S.scene.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    S.r.dispose();
    S = null;
  }

  function show(canvas, parts, colors, sizeMm) {
    dispose();
    var scene = new THREE.Scene(), box = new THREE.Box3();
    parts.forEach(function (p) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.mesh.v, 3));
      g.setIndex(p.mesh.t);
      g = g.toNonIndexed(); // flat shading
      g.computeVertexNormals();
      var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: colors[p.extruder - 1], roughness: 0.6, metalness: 0 }));
      scene.add(m);
      box.expandByObject(m);
    });
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 0.8));
    var sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(1, -1, 2);
    scene.add(sun);

    var cam = new THREE.PerspectiveCamera(35, 1, 0.1, sizeMm * 20);
    cam.up.set(0, 0, 1);
    var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    r.setPixelRatio(window.devicePixelRatio || 1);
    var ctl = new THREE.OrbitControls(cam, canvas);
    ctl.addEventListener('change', render);
    S = { r: r, scene: scene, cam: cam, ctl: ctl, canvas: canvas, center: box.getCenter(new THREE.Vector3()), dist: sizeMm * 2 };
    window.addEventListener('resize', resize);
    setTheme(document.documentElement.classList.contains('dark'));
    resize();
    reset();
  }

  function setTheme(dark) { if (S) { S.r.setClearColor(bg(dark)); render(); } }

  return { show: show, dispose: dispose, reset: reset, resize: resize, setTheme: setTheme };
})();

if (typeof module !== 'undefined') module.exports = Viewer;
