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

  function setTheme(dark) {
    root.classList.toggle('dark', dark);
    set('theme', dark ? 'dark' : 'light');
  }
  function setLang(lang) {
    var d = I18N[lang];
    root.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = d[el.dataset.i18n];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = d[el.dataset.i18nTitle]; });
    document.title = d.title;
    $('lang-toggle').textContent = lang === 'en' ? 'PT' : 'EN';
    set('lang', lang);
    showErrors();
    renderReport();
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

  function setButtons() {
    var on = !!tile;
    ['regenerate', 'saveSvg', 'savePng', 'clear'].forEach(function (id) { $(id).disabled = !on; });
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
    $('seed').textContent = '-';
    $('preview').classList.add('hidden');
    $('previewEmpty').classList.remove('hidden');
    syncRows();
    renderReport();
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
  $('theme-toggle').onclick = function () { setTheme(!root.classList.contains('dark')); };
  $('lang-toggle').onclick = function () { setLang(root.lang === 'en' ? 'pt' : 'en'); };

  setLang(get('lang') || (navigator.language.slice(0, 2) === 'pt' ? 'pt' : 'en'));
  syncRows();
})();
