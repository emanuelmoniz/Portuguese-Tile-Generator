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

  function setTheme(dark) {
    root.classList.toggle('dark', dark);
    set('theme', dark ? 'dark' : 'light');
  }
  function setLang(lang) {
    var d = I18N[lang];
    root.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.dataset.i18n;
      if (key === 'instructionsList') {
        el.innerHTML = d[key];
      } else {
        el.textContent = d[key];
      }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = d[el.dataset.i18nTitle]; });
    document.title = d.title;
    $('lang-toggle').textContent = lang === 'en' ? 'PT' : 'EN';
    set('lang', lang);
    showErrors();
    renderReport();
    render3d();
  }

  // ---- form ----
  function numRaised() { return parseInt($('numColors').value, 10) - 1; }

  function syncRows() {
    var k = numRaised();
    for (var i = 1; i <= 3; i++) $('row' + i).classList.toggle('hidden', i > k);
    var even = [[100], [50, 50], [34, 33, 33]][k - 1];
    even.forEach(function (v, i) { $('pct' + (i + 1)).value = v; });
    $('pct1').disabled = k === 1;
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
    var sum = 0, bad = false;
    for (i = 1; i <= k; i++) {
      v = parseFloat($('pct' + i).value);
      if (!(v >= 0 && v <= 100)) bad = true;
      sum += v || 0; p.percents.push(v);
    }
    if (bad || Math.abs(sum - 100) > 1e-6) errors.pct1 = ['errPct', Math.round(sum * 100) / 100];
    p.border = $('border').value;
    showErrors();
    return Object.keys(errors).length ? null : p;
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
    el.classList.toggle('text-slate-500', !tile);
    if (!tile) { el.textContent = t('reportEmpty'); return; }
    var r = tile.report, f = function (x) { return x.toFixed(1); }, h = '';
    h += '<p>' + t('rSeed') + ': <b class="font-mono">' + r.seed + '</b> · ' + t('rBorder') + ': ' + t(r.border ? 'yes' : 'no') + ' · ' + t('rMode') + ': ' + r.mode + '</p>';
    h += '<p>' + t('rCoverage') + ': <b>' + f(r.coverage.achieved) + '%</b> (' + t('rTarget') + ' ' + r.coverage.target + '%)</p>';
    h += '<p>' + t('rShares') + ': ' + r.shares.map(function (s, i) {
      return '<span class="whitespace-nowrap"><span class="inline-block h-3 w-3 rounded-sm border border-slate-400 align-middle" style="background:' + tile.colors[i + 1] + '"></span> <b>' + f(s.achieved) + '%</b> (' + s.target + '%)</span>';
    }).join(' · ') + '</p>';
    r.warnings.forEach(function (w) { h += '<p class="text-amber-600 dark:text-amber-400">⚠ ' + t('w' + w) + '</p>'; });
    el.innerHTML = h;
  }

  function render3d() {
    var el = $('info3d');
    el.textContent = tile ? t('info3d', s3d.emboss, s3d.plate) + (tile.mf ? ' · ' + t('info3dReady', tile.mf.parts.length, tile.mf.tris) : '') : '';
  }

  function setButtons() {
    var on = !!tile;
    ['regenerate', 'saveSvg', 'savePng', 'open3d', 'clear'].forEach(function (id) { $(id).disabled = !on; });
    ['save3mf', 'saveBundle'].forEach(function (id) { $(id).disabled = !(on && tile.mf); });
    render3d();
  }

  function generate() {
    var p = validate();
    if (!p) return;
    try {
      var res = Engine.generate({ sizeMm: p.sizeMm, colors: p.colors, percents: p.percents, coverage: p.coverage, border: p.border });
      tile = { groups: res.groups, report: res.report, colors: p.colors, svg: svgString(res.groups, p.colors, p.sizeMm) };
    } catch (e) {
      tile = null;
      $('report').textContent = t('wfail', e.message);
      setButtons();
      return;
    }
    $('seed').textContent = tile.report.seed;
    draw($('preview'), tile.groups, tile.colors, p.sizeMm);
    $('preview').classList.remove('hidden');
    $('previewEmpty').classList.add('hidden');
    renderReport();
    setButtons();
  }

  function clearAll() {
    tile = null;
    $('params').reset();
    $('form3d').reset();
    s3d = { emboss: 1, plate: 3 };
    $('seed').textContent = '-';
    $('preview').classList.add('hidden');
    $('previewEmpty').classList.remove('hidden');
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
      return;
    }
    $('dlg3d').close();
    setButtons();
  }

  // ---- save ----
  function save(blob, ext) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tile_' + tile.report.sizeMm + 'mm_seed' + tile.report.seed + '.' + ext;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---- wiring ----
  var theme = get('theme');
  setTheme(theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);

  document.querySelectorAll('#size, #coverage, #pct1, #pct2, #pct3, #border, [id^=color]').forEach(function (el) {
    el.addEventListener('input', validate);
  });
  function errSlot(id, after) {
    var p = document.createElement('p');
    p.className = 'mt-1 text-xs text-red-600 dark:text-red-400';
    p.dataset.err = id;
    after.after(p);
  }
  errSlot('size', $('size').closest('label'));
  errSlot('coverage', $('coverage').closest('label'));
  errSlot('pct1', $('row3'));
  for (var i = 0; i <= 3; i++) (function (i) {
    errSlot('color' + i, $('row' + i));
  })(i);

  $('numColors').onchange = syncRows;
  $('generate').onclick = generate;
  $('regenerate').onclick = generate;
  $('clear').onclick = clearAll;
  $('saveSvg').onclick = function () { save(new Blob([tile.svg], { type: 'image/svg+xml' }), 'svg'); };
  $('savePng').onclick = function () { $('preview').toBlob(function (b) { save(b, 'png'); }, 'image/png'); };
  ['emboss', 'plate'].forEach(function (id) { $(id).addEventListener('input', validate3d); });
  $('open3d').onclick = open3d;
  $('form3d').onsubmit = gen3mf;
  $('cancel3d').onclick = function () { $('dlg3d').close(); };
  $('save3mf').onclick = function () { save(new Blob([tile.mf.bytes], { type: 'model/3mf' }), '3mf'); };
  $('saveBundle').onclick = function () {
    $('preview').toBlob(function (b) {
      b.arrayBuffer().then(function (ab) {
        var n = 'tile_' + tile.report.sizeMm + 'mm_seed' + tile.report.seed, z = {};
        z[n + '.svg'] = fflate.strToU8(tile.svg);
        z[n + '.png'] = [new Uint8Array(ab), { level: 0 }];
        z[n + '.3mf'] = [tile.mf.bytes, { level: 0 }];
        save(new Blob([fflate.zipSync(z)], { type: 'application/zip' }), 'zip');
      });
    }, 'image/png');
  };
  $('theme-toggle').onclick = function () { setTheme(!root.classList.contains('dark')); };
  $('lang-toggle').onclick = function () { setLang(root.lang === 'en' ? 'pt' : 'en'); };

  setLang(get('lang') || (navigator.language.slice(0, 2) === 'pt' ? 'pt' : 'en'));
  syncRows();

  // Footer initialization
  var d = new Date();
  var dateStr = [d.getFullYear(), ('0' + (d.getMonth() + 1)).slice(-2), ('0' + d.getDate()).slice(-2)].join('-');
  $('footerDate').textContent = dateStr;
  $('footerVersion').textContent = 'v1.1.0';
})();
