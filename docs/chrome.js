/**
 * Page chrome shared by every page: the theme control and the app menu.
 *
 * Bridge is light only, and its own interface offers no switch at all. An icon
 * library cannot be light only, because checking artwork against both grounds
 * is the job here rather than a preference. So the theme stays a control, and
 * it is the two states Bridge's own token model names: light and dark.
 *
 * There is deliberately no "follow the system". A system guess is the thing
 * this control exists to override, and Bridge has no such mode to mirror. Two
 * states also make the switch readable at a glance, which a three-way pill
 * squeezed into a toolbar was not.
 *
 * Applied before first paint via applyStoredTheme(), which every page calls
 * inline in its head. A toggle that flashes the wrong theme on load is worse
 * than no toggle.
 */
(function () {
  var KEY = 'expressive-assets-theme';
  var MODES = ['light', 'dark'];

  /* Anything else, including the 'system' this used to store, lands on light:
     that is Bridge's ground, and it is what an unvisited page shows. */
  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return MODES.indexOf(v) === -1 ? 'light' : v;
    } catch (e) {
      return 'light';
    }
  }

  function apply(mode) {
    document.documentElement.setAttribute('data-theme', mode);
  }

  function save(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* not fatal */ }
  }

  window.applyStoredTheme = function () { apply(stored()); };

  var ART = {
    light: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    dark: '<path d="M20 13.4A8.2 8.2 0 0 1 10.6 4a8.4 8.4 0 1 0 9.4 9.4Z"/>',
  };

  function svg(path) {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + path + '</svg>';
  }

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
        var label = mode[0].toUpperCase() + mode.slice(1);
        var b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = svg(ART[mode]);
        b.title = label;
        b.setAttribute('aria-label', label);
        b.setAttribute('data-mode', mode);
        b.setAttribute('aria-pressed', String(mode === current));
        b.addEventListener('click', function () {
          current = mode;
          apply(mode);
          save(mode);
          document.querySelectorAll('[data-theme-switch] button').forEach(function (o) {
            o.setAttribute('aria-pressed', String(o.getAttribute('data-mode') === mode));
          });
          // The tools repaint artwork against the surface, so let them know.
          document.dispatchEvent(new CustomEvent('themechange', { detail: { mode: mode } }));
        });
        host.appendChild(b);
      });
    });
  };

  /* --- App menu ------------------------------------------------------- */

  /* Every page, in one list, in one place. Until this existed the only way
     between two pages was whichever links one of them happened to carry.

     Ordering is by what someone is here to do: the three tools first, then the
     documents, with the work page at the head of them because it is the way
     into everything else. BentoOS is a self-contained prototype and does not
     load this file, so it appears in the menu but does not show one. */
  var PAGES = [
    { group: 'Tools', items: [
      { href: 'index.html', label: 'Gallery' },
      { href: 'customizer.html', label: 'Customizer' },
      { href: 'bentos.html', label: 'BentoOS' },
    ] },
    { group: 'Project', items: [
      { href: 'work.html', label: 'Work' },
      { href: 'updates.html', label: 'Updates' },
      { href: 'about.html', label: 'About' },
      { href: 'system-map.html', label: 'System Map' },
      { href: 'asset-anatomy.html', label: 'Asset Anatomy' },
    ] },
  ];

  function here() {
    var file = location.pathname.split('/').pop();
    return file === '' ? 'index.html' : file;
  }

  window.mountAppMenu = function () {
    var hosts = document.querySelectorAll('[data-app-menu]');
    if (!hosts.length) return;
    var current = here();

    hosts.forEach(function (host) {
      host.classList.add('app-menu');
      host.innerHTML = '';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-menu-btn';
      btn.title = 'Go to';
      btn.setAttribute('aria-label', 'Go to');
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = svg('<rect x="4" y="5.4" width="16" height="2.2" rx="1.1"/><rect x="4" y="10.9" width="16" height="2.2" rx="1.1"/><rect x="4" y="16.4" width="16" height="2.2" rx="1.1"/>');

      var pop = document.createElement('div');
      pop.className = 'app-menu-pop';
      pop.hidden = true;

      PAGES.forEach(function (section) {
        var h = document.createElement('div');
        h.className = 'app-menu-group';
        h.textContent = section.group;
        pop.appendChild(h);

        section.items.forEach(function (item) {
          var a = document.createElement('a');
          a.href = item.href;
          a.textContent = item.label;
          if (item.href === current) {
            a.className = 'on';
            a.setAttribute('aria-current', 'page');
          }
          pop.appendChild(a);
        });
      });

      function open(yes) {
        pop.hidden = !yes;
        btn.setAttribute('aria-expanded', String(yes));
      }

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        open(pop.hidden);
      });
      pop.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function () { open(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !pop.hidden) { open(false); btn.focus(); }
      });

      host.appendChild(btn);
      host.appendChild(pop);
    });
  };

  function mount() {
    window.mountThemeSwitch();
    window.mountAppMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
