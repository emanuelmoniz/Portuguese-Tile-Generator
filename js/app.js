(function () {
  var root = document.documentElement;
  function $(id) { return document.getElementById(id); }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function t(key) {
    var s = I18N[root.lang][key];
    for (var i = 1; i < arguments.length; i++) s = s.replace('{' + (i - 1) + '}', arguments[i]);
    return s;
  }

  var tile = null;      // { groups, report, colors, svg } of the current design
  var errors = {};      // field id -> [i18n key, ...args]
  var s3d = { emboss: 1, plate: 3 };  // last confirmed 3D settings (mm)
  var lastGenerated = null;           // form params of the last generated tile

  function setTheme(dark) {
    root.classList.toggle('dark', dark);
    set('theme', dark ? 'dark' : 'light');
    Viewer.setTheme(dark);
  }
  function setLang(lang) {
    var d = I18N[lang];
    root.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.dataset.i18n;
      el.textContent = d[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = d[el.dataset.i18nTitle]; });
    document.title = d.title;
    $('lang-toggle').textContent = lang === 'en' ? 'PT' : 'EN';
    set('lang', lang);
    showErrors();
    renderReport();
    render3d();
    syncFrame();
  }

  // ---- form ----
  function numRaised() { return parseInt($('numColors').value, 10) - 1; }

  function syncRows() {
    var k = numRaised();
    for (var i = 1; i <= 3; i++) $('row' + i).classList.toggle('hidden', i > k);
    var even = [[100], [50, 50], [34, 33, 33]][k - 1];
    even.forEach(function (v, i) { $('pct' + (i + 1)).value = v; });
    $('pct1').disabled = k === 1;
    syncFrame();
  }

  // frame color: options follow numColors, disabled without a border or a choice
  function syncFrame() {
    var k = numRaised(), sel = $('frameColor');
    for (var i = 1; i <= 3; i++) {
      sel.options[i].textContent = t('raised') + ' ' + i;
      sel.options[i].hidden = sel.options[i].disabled = i > k;
    }
    if (sel.value !== 'auto' && +sel.value > k) sel.value = 'auto';
    sel.disabled = $('border').value === 'off' || k < 2;
    validate();
  }

  // returns the parsed params, or null if any field is invalid (errors shown inline)
  function validate() {
    var k = numRaised(), p = { colors: [], percents: [] }, i, v;
    errors = {};
    for (i = 0; i <= k; i++) {
      v = $('color' + i).value;
      if (!/^#[0-9a-f]{6}$/i.test(v)) errors['color' + i] = ['errHex'];
      p.colors.push(v);
    }
    v = parseFloat($('size').value);
    if (!(v >= 15 && v <= 200)) errors.size = ['errSize'];
    p.sizeMm = v;
    v = parseFloat($('coverage').value);
    if (!(v >= 30 && v <= 90)) errors.coverage = ['errCoverage'];
    p.coverage = v;
    v = $('complexity').value;
    p.complexity = v === 'auto' ? v : parseInt(v, 10);
    var sum = 0, bad = false;
    for (i = 1; i <= k; i++) {
      v = parseFloat($('pct' + i).value);
      if (!(v >= 0 && v <= 100)) bad = true;
      sum += v || 0; p.percents.push(v);
    }
    if (bad || Math.abs(sum - 100) > 1e-6) errors.pct1 = ['errPct', Math.round(sum * 100) / 100];
    p.border = $('border').value;
    p.frameColor = $('frameColor').value;
    if (p.frameColor !== 'auto' && !(+p.frameColor <= k)) errors.frameColor = ['errFrameColor'];
    showErrors();
    p = Object.keys(errors).length ? null : p;
    $('update').disabled = !(tile && lastGenerated && p && Engine.isStyleOnly(Engine.changedParams(lastGenerated, p)));
    return p;
  }

  function showErrors() {
    document.querySelectorAll('[data-err]').forEach(function (el) {
      var e = errors[el.dataset.err];
      el.textContent = e ? t.apply(null, e) : '';
    });
  }

  // ---- generate / preview / report ----
  function paths(groups) { // groups[i] = shapes; a shape is a ring or an array of rings
    return groups.map(function (shapes) {
      var d = '';
      shapes.forEach(function (s) {
        (typeof s[0][0] === 'number' ? [s] : s).forEach(function (r) {
          d += 'M' + r.map(function (q) { return q[0] + ' ' + q[1]; }).join('L') + 'Z';
        });
      });
      return d;
    });
  }

  function draw(cv, groups, colors, sizeMm) {
    var px = 1200, sc = px / sizeMm, ctx = cv.getContext('2d');
    cv.width = cv.height = px;
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, px, px);
    ctx.scale(sc, sc);
    paths(groups).forEach(function (d, i) { ctx.fillStyle = colors[i + 1]; ctx.fill(new Path2D(d), 'evenodd'); });
  }

  function renderReport() {
    var el = $('report');
    el.classList.toggle('text-muted', !tile);
    if (!tile) { el.textContent = t('reportEmpty'); return; }
    var r = tile.report, f = function (x) { return x.toFixed(1); }, h = '';
    h += '<p>' + t('rSeed') + ': <b class="tabular-nums">' + r.seed + '</b> · ' + t('rBorder') + ': ' + t(r.border ? 'yes' : 'no') + ' · ' + t('rMode') + ': ' + r.mode + ' · ' + t('complexity') + ': ' + r.complexity + (r.complexityAuto ? ' (' + t('cxAutoShort') + ')' : '') + '</p>';
    h += '<p>' + t('rCoverage') + ': <b>' + f(r.coverage.achieved) + '%</b> (' + t('rTarget') + ' ' + r.coverage.target + '%)</p>';
    h += '<p>' + t('rShares') + ': ' + r.shares.map(function (s, i) {
      return '<span class="whitespace-nowrap"><span class="inline-block h-3 w-3 rounded-sm border border-line align-middle" style="background:' + tile.colors[i + 1] + '"></span> <b>' + f(s.achieved) + '%</b> (' + s.target + '%)</span>';
    }).join(' · ') + '</p>';
    var sh = r.shapes, sp = function (x) { return x < 1 ? x.toFixed(2) : f(x); };
    h += '<p>' + t('rShapes') + ': ' + t('rShapesText', sh.count, sp(sh.smallestPct), sp(sh.largestPct), sh.min, sh.max) + '</p>';
    r.warnings.forEach(function (w) { h += '<p class="text-ocre">⚠ ' + t('w' + w, sp(sh.smallestPct), sh.min, sp(sh.largestPct), sh.max) + '</p>'; });
    el.innerHTML = h;
  }

  function render3d() {
    var el = $('info3d');
    el.textContent = tile ? t('info3d', s3d.emboss, s3d.plate) + (tile.mf ? ' · ' + t('info3dReady', tile.mf.parts.length, tile.mf.tris) : '') : '';
  }

  // 2D canvas, 3D viewer or the empty hint; 3D only while a 3MF exists
  function view(m) {
    var has = !!tile, can = has && !!tile.mf, is3 = m === '3d' && can;
    $('preview').classList.toggle('hidden', !has || is3);
    $('view3d').classList.toggle('hidden', !is3);
    $('resetView').classList.toggle('hidden', !is3);
    $('previewEmpty').classList.toggle('hidden', has);
    $('tab3d').disabled = !can;
    $('tab2d').classList.toggle('bg-cobalt', !is3); $('tab2d').classList.toggle('text-on-cobalt', !is3);
    $('tab3d').classList.toggle('bg-cobalt', is3); $('tab3d').classList.toggle('text-on-cobalt', is3);
    if (is3) Viewer.resize();
  }

  function setButtons() {
    var on = !!tile;
    if (!(on && tile.mf)) Viewer.dispose(); // the 3MF is gone: free the viewer
    ['saveSvg', 'savePng', 'open3d', 'clear', 'exportJson', 'copyJson'].forEach(function (id) { $(id).disabled = !on; });
    ['save3mf', 'saveBundle'].forEach(function (id) { $(id).disabled = !(on && tile.mf); });
    render3d();
    view('2d');
    validate();
  }

  function show() {
    $('seed').textContent = tile.report.seed;
    draw($('preview'), tile.groups, tile.colors, tile.report.sizeMm);
    renderReport();
    setButtons();
  }

  // style-only change: same shapes, new size and colors; 3MF must be regenerated
  var importing = false; // import runs generate/updateTile itself and keeps its text
  function clearImport() {
    if (importing) return;
    $('importText').value = $('importFile').value = '';
    $('importMsg').innerHTML = '';
  }

  function updateTile() {
    var p = validate();
    if (!p || !lastGenerated) return;
    clearImport();
    var res = Engine.rescale({ groups: tile.groups, report: tile.report }, p.sizeMm);
    if (tile.report.border && lastGenerated.frameColor !== p.frameColor) res = Engine.reframe(res, p.frameColor);
    tile = { groups: res.groups, report: res.report, colors: p.colors, svg: svgString(res.groups, p.colors, p.sizeMm), gen: tile.gen };
    lastGenerated = p;
    show();
  }

  // "Generate" after a style-only change: ask whether to keep the design
  function generateClicked() {
    var p = validate();
    if (!p) return;
    var keys = lastGenerated && tile ? Engine.changedParams(lastGenerated, p) : [];
    if (!keys.length || !Engine.isStyleOnly(keys)) return generate();
    var names = [];
    if (keys.indexOf('sizeMm') >= 0) names.push(t('chSize'));
    if (keys.indexOf('frameColor') >= 0) names.push(t('chFrame'));
    if (keys.indexOf('colors') >= 0) p.colors.forEach(function (c, i) {
      if (c.toLowerCase() !== lastGenerated.colors[i].toLowerCase()) names.push(i ? t('raised') + ' ' + i : t('chBase'));
    });
    $('dlgUpdateMsg').textContent = t('dlgUpdateMsg', names.join(', '));
    $('dlgUpdate').showModal();
  }

  function generate(seed) { // seed: only when re-creating an imported design
    var p = validate();
    if (!p) return;
    clearImport();
    try {
      var fc = p.border === 'off' || p.frameColor === 'auto' ? 'auto' : p.frameColor;
      var res = Engine.generate({ seed: seed, sizeMm: p.sizeMm, colors: p.colors, percents: p.percents, coverage: p.coverage, border: p.border, frameColor: fc, complexity: p.complexity });
      tile = { groups: res.groups, report: res.report, colors: p.colors, svg: svgString(res.groups, p.colors, p.sizeMm), gen: { sizeMm: p.sizeMm, frameColor: fc } };
    } catch (e) {
      tile = lastGenerated = null;
      $('report').textContent = t('wfail', e.message);
      setButtons();
      return;
    }
    lastGenerated = p;
    show();
  }

  function clearAll() {
    tile = lastGenerated = null;
    $('params').reset();
    $('form3d').reset();
    s3d = { emboss: 1, plate: 3 };
    $('seed').textContent = '-';
    syncRows();
    renderReport();
    setButtons();
  }

  // ---- 3D ----
  function validate3d() {
    var e = parseFloat($('emboss').value), p = parseFloat($('plate').value);
    delete errors.emboss; delete errors.plate;
    if (!(e >= 0 && e <= 5)) errors.emboss = ['errEmboss'];
    if (!(p >= 1 && p <= 10)) errors.plate = ['errPlate'];
    showErrors();
    return errors.emboss || errors.plate ? null : { emboss: e, plate: p };
  }

  function open3d() {
    $('emboss').value = s3d.emboss;
    $('plate').value = s3d.plate;
    validate3d();
    $('dlg3d').showModal();
  }

  function gen3mf(ev) {
    ev.preventDefault();
    var o = validate3d();
    if (!o) return;
    try {
      var r = Mesh3mf.generate(tile.groups, tile.colors, tile.report.sizeMm, o);
      s3d = o;
      tile.mf = { bytes: r.bytes, parts: r.parts, tris: r.parts.reduce(function (n, p) { return n + p.mesh.t.length / 3; }, 0) };
    } catch (e) {
      tile.mf = null;
      $('info3d').textContent = t('wfail3d', e.message);
      $('dlg3d').close();
      setButtons();
      return;
    }
    $('dlg3d').close();
    setButtons();
    view('3d');
    Viewer.show($('view3d'), tile.mf.parts, tile.colors, tile.report.sizeMm);
  }

  // ---- save ----
  function baseName(t) { return 'tile_' + t.report.sizeMm + 'mm_seed' + t.report.seed; }
  function save(blob, ext, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name || baseName(tile)) + '.' + ext;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---- wiring ----
  var theme = get('theme');
  setTheme(theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);

  document.querySelectorAll('#size, #coverage, #complexity, #pct1, #pct2, #pct3, #border, #frameColor, [id^=color]').forEach(function (el) {
    el.addEventListener('input', validate);
  });
  $('border').addEventListener('input', syncFrame);
  function errSlot(id, after) {
    var p = document.createElement('p');
    p.className = 'mt-1 text-sm text-manganes';
    p.dataset.err = id;
    after.after(p);
  }
  errSlot('size', $('size').closest('label'));
  errSlot('coverage', $('coverage').closest('label'));
  errSlot('frameColor', $('frameColor').closest('label'));
  errSlot('pct1', $('row3'));
  for (var i = 0; i <= 3; i++) (function (i) {
    errSlot('color' + i, $('row' + i));
  })(i);

  $('numColors').onchange = syncRows;
  $('generate').onclick = generateClicked;
  $('update').onclick = updateTile;
  $('dlgNew').onclick = function () { $('dlgUpdate').close(); generate(); };
  // ---- export / import ----
  function exportText() {
    return JSON.stringify(Export.build({ seed: tile.report.seed, generatedSizeMm: tile.gen.sizeMm, sizeMm: tile.report.sizeMm, colors: tile.colors,
      percents: lastGenerated.percents, coverage: lastGenerated.coverage, border: lastGenerated.border, frameColor: tile.gen.frameColor, complexity: lastGenerated.complexity }), null, 2);
  }
  function importMsg(errs, warns, ok) {
    var el = $('importMsg');
    el.innerHTML = '';
    function add(cls, e) { var p = document.createElement('p'); p.className = cls; p.textContent = t.apply(null, e); el.appendChild(p); }
    errs.forEach(function (e) { add('text-manganes', e); });
    warns.forEach(function (e) { add('text-ocre', e); });
    if (ok) add('text-cobalt', ['importOk']);
  }
  function importDesign(text) {
    var r = Export.parse(text);
    if (!r.data) return importMsg(r.errors, r.warnings);
    var d = r.data, sp = d.shapeParams;
    $('numColors').value = sp.numColors;
    syncRows();
    sp.percents.forEach(function (v, i) { $('pct' + (i + 1)).value = v; });
    d.colors.forEach(function (c, i) { $('color' + i).value = c; });
    $('coverage').value = sp.coverage;
    $('complexity').value = String(sp.complexity);
    $('border').value = sp.border;
    $('frameColor').value = String(sp.frameColor);
    syncFrame();
    importing = true;
    $('size').value = d.generatedSizeMm; // regenerate at the size the engine ran at, then restyle
    generate(d.seed);
    if (tile) { $('size').value = d.sizeMm; updateTile(); }
    importing = false;
    if (!tile) return importMsg([['errField', 'design']], r.warnings);
    importMsg([], r.warnings, true);
  }
  $('exportJson').onclick = function () { save(new Blob([exportText()], { type: 'application/json' }), 'json'); };
  $('copyJson').onclick = function () {
    navigator.clipboard.writeText(exportText()).then(function () { importMsg([], [], false); var p = document.createElement('p'); p.textContent = t('copied'); $('importMsg').appendChild(p); });
  };
  $('importBtn').onclick = function () { importDesign($('importText').value); };
  $('importFile').onchange = function () {
    var f = this.files[0];
    if (f) f.text().then(function (s) { $('importText').value = s; importDesign(s); });
  };
  $('dlgOnly').onclick = function () { $('dlgUpdate').close(); updateTile(); };
  $('dlgCancel').onclick = function () { $('dlgUpdate').close(); };
  $('clear').onclick = clearAll;
  $('saveSvg').onclick = function () { save(new Blob([tile.svg], { type: 'image/svg+xml' }), 'svg'); };
  $('savePng').onclick = function () { var n = baseName(tile); $('preview').toBlob(function (b) { save(b, 'png', n); }, 'image/png'); };
  ['emboss', 'plate'].forEach(function (id) { $(id).addEventListener('input', validate3d); });
  $('open3d').onclick = open3d;
  $('tab2d').onclick = function () { view('2d'); };
  $('tab3d').onclick = function () { view('3d'); };
  $('resetView').onclick = Viewer.reset;
  $('form3d').onsubmit = gen3mf;
  $('cancel3d').onclick = function () { $('dlg3d').close(); };
  $('save3mf').onclick = function () { save(new Blob([tile.mf.bytes], { type: 'model/3mf' }), '3mf'); };
  $('saveBundle').onclick = function () {
    var t = tile, n = baseName(t);
    $('preview').toBlob(function (b) {
      b.arrayBuffer().then(function (ab) {
        var z = {};
        z[n + '.svg'] = fflate.strToU8(t.svg);
        z[n + '.png'] = [new Uint8Array(ab), { level: 0 }];
        z[n + '.3mf'] = [t.mf.bytes, { level: 0 }];
        save(new Blob([fflate.zipSync(z)], { type: 'application/zip' }), 'zip', n);
      });
    }, 'image/png');
  };
  $('theme-toggle').onclick = function () { setTheme(!root.classList.contains('dark')); };
  $('lang-toggle').onclick = function () { setLang(root.lang === 'en' ? 'pt' : 'en'); };

  setLang(get('lang') || (navigator.language.slice(0, 2) === 'pt' ? 'pt' : 'en'));
  syncRows();

  // Footer initialization
  var d = new Date();
  $('footerDate').textContent = d.getFullYear();
  $('footerVersion').textContent = 'v3.0.0';
})();
