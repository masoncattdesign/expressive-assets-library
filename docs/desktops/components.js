/* Components: the surfaces and widgets in code, in the four board themes.

   Each surface is one function that returns its markup at the native size of
   its Figma component (Surface/Start is 832x864, and so on). The page scales
   it to fit. Theme is only a class on a wrapper (.th-w11, .th-wnext, .th-nova,
   .th-bebop) whose tokens components.css takes from the Figma "Surfaces"
   variables, so the structure never changes and the theme does the rest.
   That is the "Distinctly Windows, Uniquely Mine" point, in code.

   Pick a theme with the chips or 1 to 4; Compare (or 0) shows all four. */

const THEMES = [
  { id: 'w11', name: 'Windows 11', tag: 'Today', a: '#cfe3ff', b: '#2f6fea' },
  { id: 'wnext', name: 'WNext Default', tag: 'Inevitable', a: '#fad9c8', b: '#a9b6f2' },
  { id: 'nova', name: 'Nova', tag: 'Intermediate', a: '#efe7dc', b: '#d9734e' },
  { id: 'bebop', name: 'Bebop', tag: 'Copilot language', a: '#ffffff', b: '#242424' },
];

// The library's Solitaire icon is still placeholder art, so the real one rides along inline.
const SOLITAIRE = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="a" x1="18" y1="28" x2="4.6" y2="4.8" gradientUnits="userSpaceOnUse"><stop stop-color="#243A5E"/><stop offset="1" stop-color="#0C59A4"/></linearGradient><linearGradient id="b" x1="22.4" y1="26.4" x2="8.6" y2="2.6" gradientUnits="userSpaceOnUse"><stop stop-color="#1B9DE2"/><stop offset="1" stop-color="#35C1F1"/></linearGradient><linearGradient id="c" x1="26.7" y1="29.4" x2="14.6" y2="3.6" gradientUnits="userSpaceOnUse"><stop stop-color="#CCC"/><stop offset="1" stop-color="#fff"/></linearGradient><linearGradient id="d" x1="21.7" y1="22.7" x2="18.7" y2="11.2" gradientUnits="userSpaceOnUse"><stop/><stop offset="1" stop-color="#4D4D4D"/></linearGradient></defs><path d="M7.16 29.95L21.67 26.06C22.38 25.87 22.81 25.13 22.62 24.42L17.14 3.99C16.95 3.28 16.21 2.85 15.5 3.04L.99 6.93C.28 7.12-.15 7.86.04 8.58L5.51 29C5.71 29.72 6.44 30.14 7.16 29.95Z" fill="url(#a)"/><path d="M22.67 3H8.33C7.6 3 7 3.6 7 4.33V24.67C7 25.4 7.6 26 8.33 26H22.67C23.4 26 24 25.4 24 24.67V4.33C24 3.6 23.4 3 22.67 3Z" fill="url(#b)"/><path d="M31.01 6.93L16.5 3.04C15.79 2.85 15.05 3.28 14.86 3.99L9.38 24.42C9.19 25.13 9.62 25.87 10.33 26.06L24.84 29.95C25.56 30.14 26.29 29.72 26.49 29L31.96 8.58C32.15 7.86 31.72 7.12 31.01 6.93Z" fill="url(#c)"/><path d="M22.25 10.28C22.3 10.2 22.4 10.24 22.41 10.32C22.64 11.87 25.79 15.77 26.11 16.58C26.46 17.4 26.53 18.31 26.3 19.17C26.07 20.02 25.56 20.78 24.85 21.31C24.21 21.78 23.37 21.95 22.6 21.76C21.56 21.48 20.79 20.43 20.61 19.37C20.59 19.23 20.4 19.2 20.33 19.33C20.18 19.57 20.11 19.83 20.04 20.09C19.82 21.03 19.9 22.04 20.33 22.88C20.38 22.98 20.29 23.09 20.19 23.06L17.81 22.43C17.69 22.4 17.67 22.25 17.77 22.19C18.62 21.68 19.18 20.87 19.42 19.93C19.49 19.66 19.53 19.39 19.55 19.12C19.56 18.98 19.38 18.91 19.29 19.02C18.67 19.78 17.68 20.29 16.73 20.17C15.79 20.06 14.98 19.39 14.65 18.58C14.3 17.76 14.23 16.85 14.46 15.99C14.69 15.14 15.2 14.38 15.91 13.85C16.6 13.31 21.28 11.51 22.25 10.28Z" fill="url(#d)"/></svg>`);
// Full-color icons, by literal path so the download kit can find them.
const img = (p, s = 32) => `<img src="${p === 'app/solitaire/standard-32.svg' ? SOLITAIRE : ICONS + p}" width="${s}" height="${s}" alt="">`;
const caps = () => `<div class="caps"><span>${ic('subtract', 12)}</span><span>${ic('maximize', 12)}</span><span>${ic('dismiss', 12)}</span></div>`;
const tog = (on = true) => `<span class="tog">${on ? 'On' : 'Off'}<i></i></span>`;
const chev = name => `<span class="chev">${ic(name, 12)}</span>`;

/* ---- Taskbar ------------------------------------------------------------- */
function taskbar() {
  return `<div class="sf tb">
    <div class="tb-wx">${ic('weather-sunny', 24, 'filled')}<div><b>78°F</b><span class="sec">Sunny</span></div></div>
    <div class="tb-mid">
      <span title="Start"><i class="winlogo"><i></i><i></i><i></i><i></i></i></span>
      <span class="tb-search">${ic('search', 16)}Search</span>
      <span title="Task view">${ic('square-multiple', 20)}</span>
      <span>${img('product/copilot/standard-24.svg', 24)}</span>
      <span>${img('app/file-explorer/standard-24.svg', 24)}</span>
      <span>${img('product/edge/standard-24.svg', 24)}</span>
      <span>${img('app/store-light-theme/standard-24.svg', 24)}</span>
      <span>${img('product/outlook/standard-24.svg', 24)}</span>
    </div>
    <div class="tb-tray">
      <span>${ic('chevron-up', 12)}</span>
      <span>${img('product/onedrive/standard-16.svg', 16)}</span>
      <span class="qs">${ic('wifi-1', 16)}${ic('speaker-2', 16)}${ic('battery-10', 16)}</span>
      <span class="clock">10:42 AM<br>10/12/2026</span>
      <span>${ic('alert', 16)}</span>
    </div>
  </div>`;
}

/* ---- Desktop ------------------------------------------------------------- */
function desktop() {
  const icons = [['app/file-explorer/standard-48.svg', 'File Explorer'], ['product/word/standard-48.svg', 'Lisbon itinerary'], ['product/excel/standard-48.svg', 'Family budget'], ['app/photos/standard-48.svg', 'Big Sur']];
  return `<div class="sf desk"><div class="desk-bloom"></div>
    <div class="desk-icons">${icons.map(([p, l]) => `<span>${img(p, 44)}${l}</span>`).join('')}</div>
    ${taskbar()}</div>`;
}

/* ---- Start --------------------------------------------------------------- */
function start() {
  const pins = [['product/edge/standard-32.svg', 'Edge'], ['product/word/standard-32.svg', 'Word'], ['product/excel/standard-32.svg', 'Excel'], ['product/powerpoint/standard-32.svg', 'PowerPoint'],
    ['product/outlook/standard-32.svg', 'Outlook'], ['app/store-light-theme/standard-32.svg', 'Microsoft Store'], ['app/settings/standard-32.svg', 'Settings'], ['app/photos/standard-32.svg', 'Photos'],
    ['app/xbox/standard-32.svg', 'Xbox'], ['app/solitaire/standard-32.svg', 'Solitaire & Casual Games'], ['app/paint/standard-32.svg', 'Paint'], ['product/linkedin/standard-32.svg', 'LinkedIn'],
    ['app/calculator/standard-32.svg', 'Calculator'], ['app/alarms-and-clock/standard-32.svg', 'Clock'], ['app/notepad/standard-32.svg', 'Notepad'], ['app/snipping-tool/standard-32.svg', 'Snipping Tool']];
  const rec = [['product/clipchamp/standard-32.svg', 'Clipchamp', 'Recently added'], ['file/pdf/standard-32.svg', 'School forms', '16h ago'],
    ['product/powerpoint/standard-32.svg', 'Lily\'s recital program', '1h ago'], ['product/excel/standard-32.svg', 'Packing list - Lisbon', 'Yesterday at 4:26 PM'],
    ['product/word/standard-32.svg', 'Lisbon itinerary', '4h ago'], ['product/powerpoint/standard-32.svg', 'Big Sur slideshow', 'Saturday at 9:18 AM']];
  const mini = `<span class="mini">${img('product/edge/standard-16.svg', 16)}${img('product/outlook/standard-16.svg', 16)}${img('product/teams/standard-16.svg', 16)}${img('product/designer/standard-16.svg', 16)}</span>`;
  const cats = [['Productivity', ['product/word/standard-32.svg', 'product/powerpoint/standard-32.svg', 'product/excel/standard-32.svg', mini]],
    ['Social', ['product/groupme/standard-32.svg', 'product/teams/standard-32.svg', 'product/linkedin/standard-32.svg', 'product/outlook/standard-32.svg']],
    ['Creativity', ['app/camera/standard-32.svg', 'product/designer/standard-32.svg', 'product/clipchamp/standard-32.svg', 'app/paint/standard-32.svg']],
    ['Entertainment', ['app/xbox/standard-32.svg', 'app/solitaire/standard-32.svg', 'app/media-player/standard-32.svg', 'app/photos/standard-32.svg']],
    ['Utilities & Tools', ['app/calculator/standard-32.svg', 'app/alarms-and-clock/standard-32.svg', 'app/snipping-tool/standard-32.svg', 'app/notepad/standard-32.svg']],
    ['Developer Tools', ['app/notepad/standard-32.svg', 'app/settings/standard-32.svg', 'product/edge/standard-32.svg', 'product/word/standard-32.svg']],
    ['Lifestyle', ['app/store-light-theme/standard-32.svg', 'app/photos/standard-32.svg', 'product/edge/standard-32.svg', 'product/outlook/standard-32.svg']],
    ['Accessibility', ['app/settings/standard-32.svg', 'app/alarms-and-clock/standard-32.svg', 'app/paint/standard-32.svg', 'app/store-light-theme/standard-32.svg']]];
  return `<div class="sf start">
    <div class="st-search">${ic('search', 18)}<i class="caret"></i>Search for apps, settings, and documents</div>
    <div class="st-phone">${ic('phone', 16)}</div>
    <div class="st-layer">
      <div class="st-hdr" style="top:14px"><b>Pinned</b><span class="btn ghost">Show all ${ic('chevron-down', 12)}</span></div>
      <div class="st-pins">${pins.map(([p, l]) => `<span>${img(p)}${l}</span>`).join('')}</div>
      <div class="st-hdr" style="top:256px"><b>Recent</b><span class="btn">Show all ${ic('chevron-right', 12)}</span></div>
      <div class="st-rec">${rec.map(([p, n, s]) => `<span class="ri">${img(p)}<span class="rt">${n}<small>${s}</small></span></span>`).join('')}</div>
      <div class="st-hdr" style="top:448px"><b>All</b><span class="btn">View: Category ${ic('chevron-down', 12)}</span></div>
      <div class="st-cats">${cats.map(([l, ps]) => `<div class="st-cat"><div>${ps.map(p => p.startsWith('<') ? p : img(p)).join('')}</div>${l}</div>`).join('')}</div>
    </div>
    <div class="st-foot"><span class="avatar" style="width:32px;height:32px;font-size:12px">AR</span>Alex Rivera<span class="power">${ic('power', 16)}</span></div>
  </div>`;
}

/* ---- Universal Composer -------------------------------------------------- */
function composer() {
  return `<div class="sf uc">
    <div class="uc-row">${ic('add', 20)}${img('product/copilot/standard-24.svg', 24)}<span class="ph">Ask Copilot anything</span>${ic('mic', 20)}<span class="uc-send">${ic('arrow-up', 16)}</span></div>
    <div class="hdiv"></div>
    <div class="uc-chips"><span>${ic('sparkle', 14)}Plan Lily's birthday party</span><span>${ic('sparkle', 14)}Catch me up on my inbox</span><span>${ic('sparkle', 14)}Find my Big Sur photos</span></div>
  </div>`;
}

/* ---- File Explorer ------------------------------------------------------- */
function explorer() {
  const row = (icon, c, on) => `<div class="fe-row${on ? ' on' : ''}"><span>${icon}${c[0]}</span><span>${c[1]}</span><span>${c[2]}</span><span>${c[3]}</span></div>`;
  const fd = ic('folder', 20, 'filled');
  const files = [[fd, ['Big Sur trip', '10/6/2026 9:12 PM', 'File folder', '']], [fd, ['Recipes', '9/28/2026 7:40 PM', 'File folder', '']], [fd, ['School forms', '9/2/2026 8:03 AM', 'File folder', '']],
    [img('product/word/standard-20.svg', 20), ['Lisbon itinerary', '10/12/2026 8:20 AM', 'Word Document', '48 KB'], true],
    [img('product/excel/standard-20.svg', 20), ['Family budget', '10/11/2026 6:14 PM', 'Excel Worksheet', '36 KB']],
    [img('product/powerpoint/standard-20.svg', 20), ['Lily\'s recital program', '10/9/2026 4:55 PM', 'PowerPoint Presentation', '2.1 MB']],
    [img('app/notepad/standard-20.svg', 20), ['Packing list', '10/12/2026 10:31 AM', 'Text Document', '1 KB']],
    [img('app/paint/standard-20.svg', 20), ['Garden plan', '10/4/2026 2:18 PM', 'PNG File', '640 KB']],
    [img('product/word/standard-20.svg', 20), ['Book club notes', '9/21/2026 9:47 PM', 'Word Document', '22 KB']]];
  const nav = (i, l, cls = '') => `<span class="${cls}">${ic(i, 16, cls === 'on' ? 'filled' : 'outline')}${l}</span>`;
  return `<div class="sf win fe">
    <div class="win-bar fe-tabs"><div class="fe-tab">${ic('folder', 16, 'filled')}Documents${ic('dismiss', 12).replace('class="ic"', 'class="ic x"')}</div><span class="ib">${ic('add', 14)}</span>${caps()}</div>
    <div class="fe-tools">
      <div class="fe-addr"><span class="ib">${ic('arrow-left', 16)}</span><span class="ib">${ic('chevron-right', 16)}</span><span class="ib">${ic('arrow-up', 16)}</span><span class="ib">${ic('arrow-clockwise', 16)}</span>
        <span class="field">${ic('desktop', 16)}${ic('chevron-right', 12)}This PC${ic('chevron-right', 12)}Documents</span>
        <span class="field search">Search Documents${ic('search', 16)}</span></div>
      <div class="fe-cmd"><span class="btn acc">${ic('add', 16)}New</span><i class="div"></i>
        ${['cut', 'copy', 'clipboard-paste', 'rename', 'share', 'delete'].map(n => `<span class="ib">${ic(n, 16)}</span>`).join('')}<i class="div"></i>
        <span class="btn ghost">${ic('arrow-sort', 16)}Sort</span><span class="btn ghost">${ic('grid', 16)}View</span><span class="grow"></span><span class="ib">${ic('more-horizontal', 16)}</span></div>
    </div>
    <div class="fe-body">
      <div class="fe-nav">${nav('home', 'Home')}${nav('image', 'Gallery')}${nav('cloud', 'Alex - Personal', 'cloud')}<hr>${nav('desktop', 'Desktop')}${nav('arrow-download', 'Downloads')}${nav('document', 'Documents', 'on')}${nav('image', 'Pictures')}${nav('music-note-2', 'Music')}</div>
      <div class="fe-list"><div class="fe-row head"><span>Name</span><span>Date modified</span><span>Type</span><span>Size</span></div>${files.map(f => row(f[0], f[1], f[2])).join('')}</div>
    </div>
    <div class="fe-status"><span>9 items</span><span>1 item selected  48 KB</span></div>
  </div>`;
}

/* ---- Settings: Personalization > Start ----------------------------------- */
function settings() {
  const nav = [['home', 'Home', '#e8743b'], ['desktop', 'System', '#0f7bd0'], ['bluetooth', 'Bluetooth & devices', '#1a73e8'], ['wifi-1', 'Network & internet', '#0b8bd4'],
    ['paint-brush', 'Personalization', '#c2652f', true], ['apps', 'Apps', '#5d5ad6'], ['person', 'Accounts', '#1d9b6c'], ['globe', 'Time & language', '#2a8fd6'],
    ['games', 'Gaming', '#6b6b6b'], ['accessibility', 'Accessibility', '#0e74d6'], ['shield-checkmark', 'Privacy & security', '#6f7782'], ['arrow-sync', 'Windows Update', '#1683d8']];
  const sq = (n, x, y, w = 7, h = 7) => Array.from({ length: n }, (_, i) => `linear-gradient(rgba(97,97,97,.45),rgba(97,97,97,.45)) ${x(i)}px ${y(i)}px / ${w}px ${h}px no-repeat`);
  const pvDefault = [...sq(14, i => 8 + (i % 7) * 11, i => 8 + Math.floor(i / 7) * 11), ...sq(6, i => 8 + (i % 3) * 27, i => 36 + Math.floor(i / 3) * 11, 20, 4), ...sq(3, i => 16 + i * 22, () => 64, 16, 16)].join(',');
  const pvPins = [...sq(12, i => 10 + (i % 6) * 12, i => 10 + Math.floor(i / 6) * 12, 8, 8), ...sq(9, i => 8 + (i % 3) * 27, i => 42 + Math.floor(i / 3) * 12, 20, 4)].join(',');
  const pvAll = [...sq(6, i => 12 + (i % 3) * 26, i => 10 + Math.floor(i / 3) * 38, 16, 16), ...sq(6, i => 14 + (i % 3) * 26, i => 30 + Math.floor(i / 3) * 38, 14, 2)].join(',');
  const preset = (g, t, s, on) => `<div class="set-preset${on ? ' on' : ''}"><div class="pv"><i style="--g:${g}"></i></div><div><b>${t}</b><small>${s}</small></div></div>`;
  const row = (icon, t, s, ctl, cls = '') => `<div class="set-row ${cls}">${icon ? ic(icon, 20) : '<span style="width:20px"></span>'}<span class="tx">${t}<small>${s}</small></span>${ctl}</div>`;
  const check = (on, t) => `<div class="set-row sub"><span class="cb${on ? '' : ' off'}">${on ? ic('checkmark', 12) : ''}</span>${t}</div>`;
  return `<div class="sf win set">
    <div class="win-bar"><span class="back">${ic('arrow-left', 12)}</span>Settings${caps()}</div>
    <div class="set-body">
      <div class="set-nav">
        <div class="set-acct"><span class="avatar">AR</span><span><b>Alex Rivera</b><small>alexrivera@outlook.com</small></span></div>
        <div class="field"><span>Search</span>${ic('search', 14)}</div>
        <nav>${nav.map(([i, l, c, on]) => `<span class="${on ? 'on' : ''}" style="--c:${c}">${ic(i, 20, 'filled')}${l}</span>`).join('')}</nav>
      </div>
      <div class="set-page">
        <div class="set-title disp"><span class="sec">Personalization</span>${ic('chevron-right', 16)}<span>Start</span></div>
        <div class="set-gh">Layout presets</div>
        <div class="set-presets">${preset(pvDefault, 'Default', 'All sections enabled', true)}${preset(pvPins, 'Pins and recent', 'Your favorite apps and recent files')}${preset(pvAll, 'All apps only', 'Only the full list of installed apps')}</div>
        <div class="set-card">${row('pin', 'Pinned', 'Pinned apps that can be customized inside the Start menu', tog() + chev('chevron-right'))}</div>
        <div class="set-card">${row('history', 'Recent', 'Recent apps and files', tog() + chev('chevron-up'))}${check(true, 'Recently added apps')}${check(true, 'Recent and suggested files')}${check(false, 'Suggested tips and app recommendations')}</div>
        <div class="set-card">${row('list', 'All', 'Installed apps on your device', tog() + chev('chevron-up'))}${row('', 'Show most used apps', 'For list and grid views, show a list of most used apps at the top', tog(), 'child')}</div>
        <div class="set-gh">Other</div>
        <div class="set-card">${row('phone', 'Show mobile device in Start', 'Call, text, and other notifications are shown in the Start menu', tog() + chev('chevron-down'))}</div>
        <div class="set-card">${row('alert', 'Show account-related notifications', 'When off, required notifications are still shown', tog() + '<span style="width:40px"></span>')}</div>
      </div>
    </div>
  </div>`;
}

/* ---- Paint --------------------------------------------------------------- */
// The canvas is the person's own drawing, so it is the one thing no theme touches.
const PAINTING = `<svg viewBox="0 0 512 512" width="512" height="512" style="display:block"><rect width="512" height="512" fill="#c8c8c8"/>
  <rect y="0" width="512" height="250" fill="#f1e6b8"/><rect y="240" width="512" height="10" fill="#9cd3ec"/>
  <g stroke-linecap="round" fill="none"><path d="M20 10v190M60 20v170M120 0v150M200 10v180M260 0v140M330 20v160M380 0v130M430 10v190M480 0v150" stroke="#7a9cc8" stroke-width="26"/>
  <path d="M40 0v150M90 30v170M160 10v190M230 20v150M300 0v180M360 30v140M410 0v120M460 20v170" stroke="#9b4aa8" stroke-width="30"/>
  <path d="M45 120v80M95 150v70M150 40v40M175 110v100M230 130v80M280 120v90M330 40v40M150 0v20" stroke="#e5262a" stroke-width="34"/></g>
  <path d="M0 290h300v200H0z" fill="#d2a85a"/><path d="M10 300h280v180H10z" fill="#7a5c33"/>
  <g stroke="#d2a85a" stroke-width="4" opacity=".6"><path d="M30 320h240M30 360h240M30 400h240M30 440h240M120 300v180"/></g>
  <path d="M380 400h110l-15 112H395z" fill="#b5795a"/>
  <path d="M440 520c-10-90 0-200 30-280" stroke="#27b14b" stroke-width="16" fill="none"/>
  <g fill="#435011"><ellipse cx="420" cy="260" rx="70" ry="40"/><ellipse cx="370" cy="330" rx="60" ry="34"/><ellipse cx="470" cy="330" rx="50" ry="60"/><ellipse cx="420" cy="410" rx="66" ry="36"/><ellipse cx="350" cy="200" rx="40" ry="60"/><ellipse cx="480" cy="200" rx="34" ry="54"/><ellipse cx="300" cy="420" rx="60" ry="28"/></g>
  <path d="M0 470h160v42H0z" fill="#8a8a8a" opacity=".5"/></svg>`;
function paint() {
  const g = (label, inner) => `<div class="pt-g">${inner}<small>${label}</small></div>`;
  const pal = ['#000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
    '#fff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7'];
  const handles = [[-4, -4], [252, -4], [508, -4], [-4, 252], [508, 252], [-4, 508], [252, 508], [508, 508]].map(([x, y]) => `<b style="left:${x}px;top:${y}px"></b>`).join('');
  return `<div class="sf win paint">
    <div class="win-bar">${img('app/paint/standard-16.svg', 16)}Paint - Untitled${caps()}</div>
    <div class="pt-menu"><span class="btn ghost">File</span><span class="btn ghost">Edit</span><span class="btn ghost">View</span><i class="div"></i>
      <span class="ib">${ic('save', 16)}</span><i class="div"></i><span class="ib">${ic('share', 16)}</span><i class="div"></i><span class="ib dim">${ic('arrow-undo', 16)}</span><span class="ib dim">${ic('arrow-redo', 16)}</span>
      <span class="me"><img src="media/person-sam.jpg" alt=""><span class="ib">${ic('settings', 18)}</span></span></div>
    <div class="pt-tools">
      ${g('Selection', `<span class="big">${ic('select-all-off', 22)}</span>`)}
      ${g('Image', `<div class="grid">${['crop', 'arrow-clockwise', 'resize', 'image-edit', 'flip-horizontal', 'scan-dash'].map(n => `<span>${ic(n, 18)}</span>`).join('')}</div>`)}
      ${g('Tools', `<div class="grid"><span class="sel">${ic('pen', 18)}</span><span>${ic('paint-bucket', 18)}</span><span>${ic('text-t', 18)}</span><span>${ic('eraser', 18)}</span><span>${ic('eyedropper', 18)}</span><span>${ic('zoom-in', 18)}</span></div>`)}
      ${g('Brushes', `<span class="big">${ic('paint-brush', 22)}</span>`)}
      ${g('Shapes', `<span class="big" style="box-shadow:none;background:none">${ic('shapes', 22)}</span>`)}
      ${g('Color', `<div class="pt-color"><span class="pt-cur"><i></i><i></i></span><span class="pt-pal">${pal.map(c => `<i style="--c:${c}"></i>`).join('')}${Array(10).fill('<i class="e"></i>').join('')}</span><span class="pt-wheel"></span></div>`)}
      ${g('Copilot', `<span class="big">${img('product/copilot/standard-24.svg', 24)}</span>`)}
      ${g('Layers', `<span class="big" style="box-shadow:none;background:none">${ic('layer', 22)}</span>`)}
    </div>
    <div class="pt-canvas">
      <div class="pt-slider"><span>${ic('paint-brush', 14)}</span><span class="rail"></span></div>
      <div class="pt-art">${PAINTING}${handles}</div>
      <div class="pt-cocreator"><h4 class="disp">Cocreator${ic('dismiss', 14)}</h4>
        <div class="pt-prompt">Warm mid century home interior, modern soft leather couch, indoor plant, picture frame of abstract colorful impressionism</div>
        <div class="pt-out"><img src="media/photo-living.jpg" alt=""></div>
        <div class="pt-cre">Creativity</div><div class="pt-range"></div>
        <div class="pt-acts"><span class="btn">No selection ${ic('chevron-down', 12)}</span><span class="btn acc">${ic('add', 16)}Apply</span></div>
      </div>
    </div>
    <div class="pt-status"><span>${ic('cursor', 14)}314, 124px</span><span>${ic('select-all-off', 14)}300 × 125px</span><span>${ic('resize', 14)}800 × 512px</span><span>${ic('save', 14)}Size: 20.4KB</span>
      <span class="zoom">${ic('zoom-fit', 14)}<span class="btn" style="height:24px">100% ${ic('chevron-down', 12)}</span>${ic('zoom-out', 14)}<i class="zbar"></i>${ic('zoom-in', 14)}</span></div>
  </div>`;
}

/* ---- Notepad ------------------------------------------------------------- */
function notepad() {
  return `<div class="sf win np">
    <div class="win-bar np-tabs"><div class="np-tab on">${img('app/notepad/standard-16.svg', 16)}Packing list${ic('dismiss', 12).replace('class="ic"', 'class="ic x"')}</div>
      <div class="np-tab sec">${img('app/notepad/standard-16.svg', 16)}Recipes to try</div><span class="ib">${ic('add', 14)}</span>${caps()}</div>
    <div class="np-menu"><span class="btn ghost">File</span><span class="btn ghost">Edit</span><span class="btn ghost">View</span><span class="grow"></span><span class="ib">${ic('sparkle', 16)}</span><span class="ib">${ic('settings', 16)}</span></div>
    <div class="np-edit">Lisbon packing list

Passports (both in the blue folder)
Phone chargers and the plug adapter
Walking shoes
Light jacket for evenings
Sunscreen
Lily's recital dress, pick up Thursday
Tram card
Camera and spare battery

Before we leave: water the plants, ask Sam to grab the mail</div>
    <div class="np-status"><span>Ln 8, Col 38</span><span>324 characters</span><span class="r"><span>100%</span><span>Windows (CRLF)</span><span>UTF-8</span></span></div>
  </div>`;
}

/* ---- The catalog --------------------------------------------------------- */
const SURFACES = [
  { id: 'desktop', name: 'Desktop', w: 1440, h: 900, build: desktop, stays: 'Taskbar along the bottom, desktop icons top left, wallpaper edge to edge.', changes: 'Wallpaper palette and bloom, taskbar floats with an inset or stays docked.' },
  { id: 'start', name: 'Start', w: 832, h: 864, build: start, stays: 'Copilot search on top, then Pinned, Recent and All by category, with account and power in the footer. Same order, same app icons.', changes: 'Shell material and tint, corner radii, card surfaces, button and avatar accent, typeface.' },
  { id: 'taskbar', name: 'Taskbar', w: 1440, h: 48, build: taskbar, stays: 'Widgets left, Start, search, Task view and pinned apps centered, tray and clock right.', changes: 'Docked or floating, end radius, material.' },
  { id: 'uc', name: 'Universal Composer', w: 720, h: 130, build: composer, stays: 'One input, attach, voice, send, three suggestions underneath.', changes: 'Field shape, send button color, chip shape, typeface.' },
  { id: 'explorer', name: 'File Explorer', w: 1040, h: 640, build: explorer, stays: 'Tabs, address bar, command bar, navigation pane, details view, status bar.', changes: 'Pane and content contrast, selection fill, button and window radii.' },
  { id: 'settings', name: 'Settings', note: 'Personalization > Start', w: 1128, h: 920, build: settings, stays: 'Account, search and navigation, then presets and toggles in the same order. Nav icons keep their full color.', changes: 'Preset previews pick up the theme\'s wallpaper and Start material. Toggles, checks and selection take the accent, and the page title takes the display face.' },
  { id: 'paint', name: 'Paint', w: 1200, h: 800, build: paint, stays: 'Menu row, toolbar groups, palette, canvas, Cocreator panel and status bar. The drawing and the generated image are untouched.', changes: 'Only the chrome around the work: window material, toolbar and panel surfaces, ink, dividers and accent.' },
  { id: 'notepad', name: 'Notepad', w: 760, h: 520, build: notepad, stays: 'Tabs, menu, editor, status bar.', changes: 'Text face and editor surface, Copilot accent.' },
];
const SIZE_NAME = { s: 'Square', w: 'Wide', t: 'Tall' };

let current = store('components-theme') || 'w11';

function view(s, t) {
  return `<div class="view th-${t.id}"><span class="view-tag">${t.name}</span><div class="fit" data-w="${s.w}" data-h="${s.h}">${s.build()}</div></div>`;
}
function renderSurfaces() {
  const compare = current === 'all', list = compare ? THEMES : THEMES.filter(t => t.id === current);
  $('#surface-list').innerHTML = SURFACES.map(s => `<article class="spec" id="sf-${s.id}">
    <div><h3>${s.name}${s.note ? `<small>${s.note}</small>` : ''}<small>${s.w} × ${s.h}</small></h3>
      <dl><dt class="stays">Stays</dt><dd>${s.stays}</dd><dt class="changes">Changes</dt><dd>${s.changes}</dd></dl></div>
    <div class="views">${list.map(t => view(s, t)).join('')}</div></article>`).join('');
}
function renderWidgets() {
  const box = $('#widget-list'); box.innerHTML = '';
  if (current === 'all') {
    box.appendChild(html(`<div class="wg-grid"></div>`));
    const grid = box.firstChild;
    grid.appendChild(html('<span></span>')); THEMES.forEach(t => grid.appendChild(html(`<span class="wg-col-head">${t.name}</span>`)));
    for (const id of WG_ORDER) {
      const spec = WIDGETS[id], sz = spec.fits[0];
      grid.appendChild(html(`<h4>${spec.name}<small>${SIZE_NAME[sz]}</small></h4>`));
      for (const t of THEMES) { const cell = html(`<div class="wg-sizes th-${t.id}"></div>`); const b = html(`<div class="wg-box ${sz}"></div>`); b.appendChild(widget(id, { size: sz })); cell.appendChild(b); grid.appendChild(cell); }
    }
  } else {
    const grid = html(`<div class="wg-grid th-${current}"></div>`); box.appendChild(grid);
    for (const id of WG_ORDER) {
      const spec = WIDGETS[id];
      const el = html(`<div class="wg-spec"><small>${spec.name}<span>${spec.fits.map(f => SIZE_NAME[f]).join(', ')}</span></small><div class="wg-sizes"></div></div>`);
      for (const sz of spec.fits) { const b = html(`<div class="wg-box ${sz}"></div>`); b.appendChild(widget(id, { size: sz })); el.lastChild.appendChild(b); }
      grid.appendChild(el);
    }
  }
}
// Scale each native-size surface to the width its view has.
function fitAll() {
  for (const f of $$('.fit')) {
    const v = f.parentElement, cs = getComputedStyle(v);
    const avail = v.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const w = +f.dataset.w, h = +f.dataset.h, k = Math.min(1, avail / w);
    f.style.width = w * k + 'px'; f.style.height = h * k + 'px';
    f.firstElementChild.style.width = w + 'px';
    f.firstElementChild.style.transform = `scale(${k})`;
  }
}
function setTheme(id) {
  current = id; store('components-theme', id);
  document.body.classList.toggle('compare', id === 'all');
  $$('.cp-themes button').forEach(b => b.classList.toggle('on', b.dataset.t === id));
  renderSurfaces(); renderWidgets(); fitAll();
}

document.addEventListener('DOMContentLoaded', () => {
  $('.cp-themes').innerHTML = THEMES.map((t, i) => `<button data-t="${t.id}" title="${t.tag} (${i + 1})"><i style="--a:${t.a};--b:${t.b}"></i>${t.name}</button>`).join('') + `<button class="all" data-t="all" title="All four side by side (0)">Compare</button>`;
  $$('.cp-themes button').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.t)));
  addEventListener('keydown', e => {
    if (e.target.closest('input, textarea')) return;
    const n = '01234'.indexOf(e.key); if (n < 0) return;
    setTheme(n === 0 ? 'all' : THEMES[n - 1].id);
  });
  addEventListener('resize', fitAll);
  setTheme(THEMES.some(t => t.id === current) || current === 'all' ? current : 'w11');
});
