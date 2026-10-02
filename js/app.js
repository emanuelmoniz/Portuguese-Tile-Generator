(function () {
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function setTheme(dark) {
    root.classList.toggle('dark', dark);
    set('theme', dark ? 'dark' : 'light');
  }
  function setLang(lang) {
    var d = I18N[lang];
    root.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = d[el.dataset.i18n]; });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = d[el.dataset.i18nTitle]; });
    document.title = d.title;
    document.getElementById('lang-toggle').textContent = lang === 'en' ? 'PT' : 'EN';
    set('lang', lang);
  }

  var theme = get('theme');
  setTheme(theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  setLang(get('lang') || (navigator.language.slice(0, 2) === 'pt' ? 'pt' : 'en'));

  document.getElementById('theme-toggle').onclick = function () { setTheme(!root.classList.contains('dark')); };
  document.getElementById('lang-toggle').onclick = function () { setLang(root.lang === 'en' ? 'pt' : 'en'); };
})();
