/**
 * Theme control, shared by every page.
 *
 * Bridge is light only. An icon library cannot be: checking artwork against
 * both grounds is the job rather than a preference, so the theme is a control
 * here and not a guess.
 *
 * Three states, and the third one matters. Once someone has chosen light or
 * dark, "follow the system" has to stay reachable, or the choice is a trap.
 * System stamps nothing and lets the media query decide; light and dark stamp
 * data-theme on the root, which both stylesheets are written to respect in
 * either direction.
 *
 * Applied before first paint via applyStoredTheme(), which every page calls
 * inline in its head. A toggle that flashes the wrong theme on load is worse
 * than no toggle.
 */
(function () {
  var KEY = 'expressive-assets-theme';
  var MODES = ['light', 'dark', 'system'];

  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return MODES.indexOf(v) === -1 ? 'system' : v;
    } catch (e) {
      // Private window, or storage refused. Following the system is a fine
      // place to land.
      return 'system';
    }
  }

  function apply(mode) {
    var root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
  }

  function save(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* not fatal */ }
  }

  window.applyStoredTheme = function () { apply(stored()); };

  /** Renders into any element with data-theme-switch. */
  window.mountThemeSwitch = function () {
    var hosts = document.querySelectorAll('[data-theme-switch]');
    if (!hosts.length) return;
    var current = stored();

    hosts.forEach(function (host) {
      host.classList.add('theme-switch');
      host.setAttribute('role', 'group');
      host.setAttribute('aria-label', 'Theme');
      host.innerHTML = '';

      MODES.forEach(function (mode) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = mode === 'system' ? 'Auto' : mode[0].toUpperCase() + mode.slice(1);
        b.title = mode === 'system' ? 'Follow the operating system' : mode[0].toUpperCase() + mode.slice(1);
        b.setAttribute('aria-pressed', String(mode === current));
        b.addEventListener('click', function () {
          current = mode;
          apply(mode);
          save(mode);
          document.querySelectorAll('[data-theme-switch] button').forEach(function (other) {
            other.setAttribute('aria-pressed', String(other.textContent === b.textContent));
          });
          // The tools repaint artwork against the surface, so let them know.
          document.dispatchEvent(new CustomEvent('themechange', { detail: { mode: mode } }));
        });
        host.appendChild(b);
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.mountThemeSwitch);
  } else {
    window.mountThemeSwitch();
  }
})();
