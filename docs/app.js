/**
 * Gallery — the browsing tool for Expressive Assets.
 *
 * Gallery is the tool; Expressive Assets is the library. Gallery knows nothing
 * about this library in particular — it reads the manifest, so it can show any
 * library that emits one.
 *
 * Reads manifest.json — the library's public contract — and the SVG files it
 * points at. No framework, no build tooling: the whole app is three files
 * GitHub Pages serves as-is, so a designer can open a PR against it without
 * setting up a toolchain.
 *
 * Three things here are sized for a 500+ asset library rather than a demo:
 *
 *  1. Cards render as empty shells immediately and an IntersectionObserver
 *     fills in the artwork as they scroll into view. First paint never waits
 *     on SVG payload, and only what you actually scroll to is ever fetched.
 *  2. Drawings are fetched individually and cached, rather than bundled. The
 *     product icons alone are 828 separate files because Windows artwork is
 *     redrawn per size; bundling them was 2.3 MB for one collection.
 *  3. The grid appends in chunks, so 500 cards never become one long frame.
 */

/** Point this at the repo — drives the "Add Assets" and "View source" links. */
const REPO = 'https://github.com/masoncattdesign/expressive-assets-library';

/** The three themes. Standard is the full-colour base; outline and filled are its
 *  monochrome reductions. Keys and labels deliberately match — an earlier split
 *  had "regular" meaning Outline here and the full-weight base in Fluent, which
 *  is exactly the kind of collision that costs someone an afternoon. */
const THEMES = [
  { key: 'standard', label: 'Standard' },
  { key: 'outline', label: 'Outline' },
  { key: 'filled', label: 'Filled' },
];

/**
 * Asset families. The library holds three shapes of thing, and they do not want
 * the same panel. A System icon is monochrome line work with no brand colour of
 * its own. A Product icon (app and file icons both, for now) ships full-colour
 * Standard artwork that cannot be retinted. An Illustration is a scene built
 * from colour roles.
 *
 * Family decides which styles are offered, which one opens by default, and
 * whether a Colors section says anything true. System icons have no Standard,
 * so the control does not offer one.
 */
const FAMILIES = {
  system: {
    label: 'System icon',
    styles: ['outline', 'filled'],
    fallback: 'filled',
    brandColors: false,
    colorNote: 'Monochrome. Follows the surface it sits on until you pick an accent.',
  },
  product: {
    label: 'Product icon',
    styles: ['standard', 'outline', 'filled'],
    fallback: 'standard',
    brandColors: true,
  },
  illustration: {
    label: 'Illustration',
    styles: ['standard', 'outline', 'filled'],
    fallback: 'standard',
    brandColors: true,
  },
};

/** File and app icons sit in the product family for now: to a person choosing
 *  one they are the same kind of object, whatever the collection says. */
function familyOf(asset) {
  if (asset.type === 'illustration') return 'illustration';
  if (asset.collection === 'system') return 'system';
  return 'product';
}

/** The styles this asset actually offers, in family order. A style the artwork
 *  never had is left out rather than shown disabled, because a greyed-out
 *  button still claims the style exists somewhere. */
function stylesFor(asset) {
  const family = FAMILIES[familyOf(asset)];
  const offered = family.styles.filter((k) => asset.themes.includes(k));
  return offered.length ? offered : asset.themes.slice();
}

/** Which style is on screen for this asset: the family's remembered choice if
 *  the asset has it, then the family default, then whatever exists. Remembering
 *  per family stops a choice made in System Icons following you into Product
 *  Icons, where it means something different. */
function themeFor(asset) {
  const family = familyOf(asset);
  const styles = stylesFor(asset);
  const chosen = state.themes[family];
  if (chosen && styles.includes(chosen)) return chosen;
  const fallback = FAMILIES[family].fallback;
  return styles.includes(fallback) ? fallback : styles[0];
}

/** Windows accent pairs. `null` means "use the asset's own brand colors". */
const ACCENTS = [
  { id: 'default', label: 'Asset default', primary: null, secondary: null },
  { id: 'blue', label: 'Windows blue', primary: '#0078D4', secondary: '#2AA0DA' },
  { id: 'purple', label: 'Purple', primary: '#8764B8', secondary: '#C239B3' },
  { id: 'green', label: 'Green', primary: '#107C10', secondary: '#4CAF50' },
  { id: 'teal', label: 'Teal', primary: '#038387', secondary: '#38C6C6' },
  { id: 'red', label: 'Red', primary: '#D13438', secondary: '#E74856' },
  { id: 'orange', label: 'Orange', primary: '#CA5010', secondary: '#F7A501' },
  { id: 'yellow', label: 'Yellow', primary: '#C19C00', secondary: '#F7A501' },
  { id: 'magenta', label: 'Magenta', primary: '#E3008C', secondary: '#C239B3' },
];

const STATUS_LABEL = { draft: 'Draft', published: 'Published', deprecated: 'Deprecated' };

/* The sidebar marks are assets, not drawings kept in this file. Regenerate
 * with `node scripts/inline-nav-icons.mjs` after changing the picks there. */
/* The sidebar marks are assets, not drawings kept in this file. Regenerate
 * with `node scripts/inline-nav-icons.mjs` after changing the picks there. */
/* The sidebar marks are assets, not drawings kept in this file. Regenerate
 * with `node scripts/inline-nav-icons.mjs` after changing the picks there. */
/* The sidebar marks are assets, not drawings kept in this file. Regenerate
 * with `node scripts/inline-nav-icons.mjs` after changing the picks there. */
const NAV_ICONS = {
  'all': '<path d="M8.75 13C9.99264 13 11 14.0074 11 15.25V18.75C11 19.9926 9.99264 21 8.75 21H5.25C4.00736 21 3 19.9926 3 18.75V15.25C3 14.0074 4.00736 13 5.25 13H8.75ZM18.75 13C19.9926 13 21 14.0074 21 15.25V18.75C21 19.9926 19.9926 21 18.75 21H15.25C14.0074 21 13 19.9926 13 18.75V15.25C13 14.0074 14.0074 13 15.25 13H18.75ZM8.75 3C9.99264 3 11 4.00736 11 5.25V8.75C11 9.99264 9.99264 11 8.75 11H5.25C4.00736 11 3 9.99264 3 8.75V5.25C3 4.00736 4.00736 3 5.25 3H8.75ZM18.75 3C19.9926 3 21 4.00736 21 5.25V8.75C21 9.99264 19.9926 11 18.75 11H15.25C14.0074 11 13 9.99264 13 8.75V5.25C13 4.00736 14.0074 3 15.25 3H18.75Z"/>', // system.grid filled — Everything, evenly
  'product-icons': '<path d="M18.4923 2.33034L21.671 5.50911C22.5497 6.38779 22.5497 7.81241 21.671 8.69109L19.0866 11.275C20.1696 11.4375 21 12.3718 21 13.5V18.75C21 19.9926 19.9926 21 18.75 21H5.25C4.00736 21 3 19.9926 3 18.75V5.25001C3 4.00736 4.00736 3.00001 5.25 3.00001H10.5C11.6289 3.00001 12.5637 3.83146 12.7253 4.91541L15.3103 2.33034C16.189 1.45166 17.6136 1.45166 18.4923 2.33034ZM4.5 18.75C4.5 19.1642 4.83579 19.5 5.25 19.5L11.249 19.4993L11.25 12.75L4.5 12.7493V18.75ZM12.749 19.4993L18.75 19.5C19.1642 19.5 19.5 19.1642 19.5 18.75V13.5C19.5 13.0858 19.1642 12.75 18.75 12.75L12.749 12.7493V19.4993ZM10.5 4.50001H5.25C4.83579 4.50001 4.5 4.83579 4.5 5.25001V11.2493H11.25V5.25001C11.25 4.83579 10.9142 4.50001 10.5 4.50001ZM12.75 9.30933V11.25L14.69 11.2493L12.75 9.30933Z"/>', // system.apps filled — A group of app tiles
  'product-icons:product': '<path d="M3 6.25C3 4.45507 4.45507 3 6.25 3H17.75C19.5449 3 21 4.45507 21 6.25V17.75C21 19.5449 19.5449 21 17.75 21H6.25C4.45507 21 3 19.5449 3 17.75V6.25ZM6.25 4.5C5.2835 4.5 4.5 5.2835 4.5 6.25V6.5H19.5V6.25C19.5 5.2835 18.7165 4.5 17.75 4.5H6.25ZM4.5 17.75C4.5 18.7165 5.2835 19.5 6.25 19.5H17.75C18.7165 19.5 19.5 18.7165 19.5 17.75V8H4.5V17.75ZM6.85 9.5H10.15C10.6194 9.5 11 9.88056 11 10.35V17.15C11 17.6194 10.6194 18 10.15 18H6.85C6.38056 18 6 17.6194 6 17.15V10.35C6 9.88056 6.38056 9.5 6.85 9.5ZM7.5 16.5H9.5V11H7.5V16.5ZM12 10.25C12 9.83579 12.3358 9.5 12.75 9.5H17.25C17.6642 9.5 18 9.83579 18 10.25C18 10.6642 17.6642 11 17.25 11H12.75C12.3358 11 12 10.6642 12 10.25ZM12.75 12.5C12.3358 12.5 12 12.8358 12 13.25C12 13.6642 12.3358 14 12.75 14H16.25C16.6642 14 17 13.6642 17 13.25C17 12.8358 16.6642 12.5 16.25 12.5H12.75Z"/>', // system.app-generic outline — One app
  'product-icons:app': '<path d="M6.25 3C4.45507 3 3 4.45507 3 6.25V17.75C3 19.5449 4.45507 21 6.25 21H9.00947C9.0032 20.9175 9 20.8341 9 20.75V19.5H6.25C5.2835 19.5 4.5 18.7165 4.5 17.75V8.5H19.5V9H20.75C20.8341 9 20.9175 9.0032 21 9.00947V6.25C21 4.45507 19.5449 3 17.75 3H6.25ZM19.5 7H4.5V6.25C4.5 5.2835 5.2835 4.5 6.25 4.5H17.75C18.7165 4.5 19.5 5.2835 19.5 6.25V7ZM12.25 15.5H15.5V12.25C15.5 11.0074 16.5074 10 17.75 10H20.75C21.9926 10 23 11.0074 23 12.25V19.75C23 21.5449 21.5449 23 19.75 23H12.25C11.0074 23 10 21.9926 10 20.75V17.75C10 16.5074 11.0074 15.5 12.25 15.5ZM17 12.25V15.5H21.5V12.25C21.5 11.8358 21.1642 11.5 20.75 11.5H17.75C17.3358 11.5 17 11.8358 17 12.25ZM15.5 21.5V17H12.25C11.8358 17 11.5 17.3358 11.5 17.75V20.75C11.5 21.1642 11.8358 21.5 12.25 21.5H15.5ZM17 17V21.5H19.75C20.7165 21.5 21.5 20.7165 21.5 19.75V17H17Z"/>', // system.window-apps outline — An app on the desktop
  'product-icons:third-party': '<path d="M13 2.00423C14.5977 2.00423 15.9037 3.25315 15.994 4.82327L15.999 4.999L18.25 5C19.1172 5 19.837 5.63072 19.9758 6.45858L19.9942 6.60663L20 6.75018L19.9991 10.5012L18.0015 10.5013C17.2579 10.5013 16.6353 11.0445 16.5215 11.7403L16.5062 11.8725L16.5015 12.0013C16.5015 12.7449 17.0446 13.3675 17.7405 13.4813L17.8727 13.4965L18.0014 13.5013L19.9991 13.5012L20 17.2526C20 18.1708 19.2929 18.9238 18.3934 18.9968L18.2499 19.0026L15.999 19.002L15.9949 19.1747C15.9106 20.6305 14.7881 21.8078 13.3567 21.9774L13.1763 21.9933L13 21.9984C11.4023 21.9984 10.0963 20.7495 10.0051 19.1779L10 19.002L7.75 19.0026C6.88283 19.0026 6.16298 18.3719 6.02417 17.5443L6.0058 17.3963L6 17.2528L5.999 15.001L5.836 14.9962C4.38017 14.9119 3.20285 13.7894 3.03326 12.3581L3.01736 12.1776L3.01227 12.0013C3.01227 10.4036 4.26119 9.09765 5.83593 9.0064L5.999 9.001L6 6.75C6 5.88283 6.63072 5.16298 7.45831 5.02418L7.60631 5.0058L7.74981 5L9.999 4.999L10.0051 4.82796C10.0894 3.37214 11.2119 2.19482 12.6432 2.02523L12.8237 2.00933L13 2.00423ZM13 3.50423C12.2203 3.50423 11.5795 4.09912 11.5069 4.86039L11.5 5.00497L11.4985 6.49904L7.75 6.5C7.63165 6.5 7.53251 6.58223 7.5066 6.69279L7.5 6.75018L7.49909 10.5012L6.01227 10.5013C5.18384 10.5013 4.51227 11.1729 4.51227 12.0013C4.51227 12.781 5.10716 13.4218 5.86775 13.4944L6.01219 13.5013L7.49909 13.5012L7.5 17.2526C7.5 17.371 7.58223 17.4701 7.69261 17.496L7.7499 17.5026L11.4985 17.5021L11.5 18.9984C11.5 19.8268 12.1716 20.4984 13 20.4984C13.7797 20.4984 14.4204 19.9035 14.4931 19.1434L14.5 18.9991L14.4985 17.5021L18.25 17.5026C18.3683 17.5026 18.4675 17.4204 18.4934 17.3101L18.5 17.2528L18.499 15L17.9762 15.0009L17.7968 14.9944C16.2855 14.8922 15.0927 13.6769 15.0068 12.1532L15.0019 11.976L15.0084 11.7967C15.1105 10.2854 16.3258 9.09259 17.827 9.00631L18.0014 9.00131L18.499 9.001L18.5 6.75C18.5 6.65532 18.4474 6.57294 18.3697 6.5305L18.3072 6.5066L18.2498 6.5L14.4985 6.49904L14.5 5.00423C14.5 4.17581 13.8284 3.50423 13 3.50423Z"/>', // system.puzzle-piece outline — Something from outside that plugs in
  'product-icons:wip': '<path d="M11.0002 7.5C11.0002 4.46243 13.4627 2 16.5002 2C17.267 2 17.999 2.15735 18.6641 2.44223C18.8929 2.54023 19.0582 2.74534 19.1053 2.98974C19.1524 3.23414 19.0751 3.48599 18.8991 3.66198L16.3111 6.25L17.7505 7.68934L20.3384 5.10142C20.5144 4.92542 20.7663 4.8482 21.0107 4.8953C21.2551 4.94241 21.4602 5.10771 21.5582 5.33652C21.8429 6.00153 22.0002 6.73337 22.0002 7.5C22.0002 10.5376 19.5378 13 16.5002 13C16.058 13 15.6272 12.9477 15.214 12.8486L6.90165 21.1609C5.78033 22.2823 3.96231 22.2823 2.84099 21.1609C1.71967 20.0396 1.71967 18.2216 2.84099 17.1003L11.1523 8.78899C11.0528 8.37496 11.0002 7.94322 11.0002 7.5ZM16.5002 3.5C14.2911 3.5 12.5002 5.29086 12.5002 7.5C12.5002 7.94506 12.5726 8.37169 12.7057 8.76964C12.7959 9.0393 12.7258 9.33677 12.5248 9.53783L3.90165 18.1609C3.36612 18.6965 3.36612 19.5648 3.90165 20.1003C4.43718 20.6358 5.30546 20.6358 5.84099 20.1003L14.465 11.4763C14.6659 11.2754 14.9632 11.2053 15.2327 11.2952C15.6301 11.4279 16.056 11.5 16.5002 11.5C18.7094 11.5 20.5002 9.70914 20.5002 7.5C20.5002 7.35886 20.4929 7.21955 20.4787 7.08239L18.6344 8.92678C18.1462 9.41493 17.3547 9.41493 16.8666 8.92678L15.0737 7.13388C14.5855 6.64573 14.5855 5.85427 15.0737 5.36612L16.9183 3.52153C16.781 3.5073 16.6415 3.5 16.5002 3.5Z"/>', // system.wrench outline — Still being made
  'file-icons': '<path d="M12 2V8C12 9.10457 12.8954 10 14 10H20V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4C4 2.89543 4.89543 2 6 2H12ZM13.5 2.5V8C13.5 8.27614 13.7239 8.5 14 8.5H19.5L13.5 2.5Z"/>', // system.document filled — A file
  'system-icons': '<path d="M2 8.75C2 5.02208 5.02208 2 8.75 2C12.2244 2 15.0857 4.62504 15.4588 8H12.25C9.90279 8 8 9.90279 8 12.25V15.4588C4.62504 15.0857 2 12.2244 2 8.75ZM12.25 9C10.4551 9 9 10.4551 9 12.25V18.75C9 20.5449 10.4551 22 12.25 22H18.75C20.5449 22 22 20.5449 22 18.75V12.25C22 10.4551 20.5449 9 18.75 9H12.25Z"/>', // system.shapes filled — Glyphs, which is what a system icon is
  'illustrations': '<path d="M11.5582 13.6469L11.4746 13.7179L4.54692 20.5186C5.04216 20.8239 5.62551 21 6.25 21H17.75C18.3745 21 18.9578 20.8239 19.4531 20.5186L12.5254 13.7179L12.432 13.6399C12.1705 13.4552 11.8174 13.4576 11.5582 13.6469ZM21 6.25C21 4.45507 19.5449 3 17.75 3H6.25C4.45507 3 3 4.45507 3 6.25V17.75C3 18.3771 3.17758 18.9626 3.4852 19.4592L10.4238 12.6475L10.5592 12.5248C11.3941 11.8273 12.615 11.8293 13.4477 12.5306L13.5762 12.6475L20.5148 19.4592C20.8224 18.9626 21 18.3771 21 17.75V6.25ZM15.25 10.75C14.1454 10.75 13.25 9.85457 13.25 8.75C13.25 7.64543 14.1454 6.75 15.25 6.75C16.3546 6.75 17.25 7.64543 17.25 8.75C17.25 9.85457 16.3546 10.75 15.25 10.75Z"/>', // system.image filled — A picture
  'illustrations:oobe': '<path d="M13.0572 7.43077C14.0335 6.45446 15.6164 6.45446 16.5927 7.43077C17.569 8.40708 17.569 9.98999 16.5927 10.9663C15.6164 11.9426 14.0335 11.9426 13.0572 10.9663C12.0809 9.98999 12.0809 8.40708 13.0572 7.43077ZM15.532 8.49143C15.1415 8.10091 14.5084 8.1009 14.1178 8.49143C13.7273 8.88195 13.7273 9.51512 14.1178 9.90564C14.5084 10.2962 15.1415 10.2962 15.532 9.90564C15.9226 9.51512 15.9226 8.88195 15.532 8.49143ZM21.5086 4.32216C21.2398 3.45736 20.5625 2.78032 19.6976 2.5119L19.0355 2.30643C16.642 1.5636 14.034 2.20802 12.2618 3.98013L11.266 4.97601C9.89622 3.94737 7.94316 4.05621 6.69685 5.30253L5.45432 6.54506C5.16142 6.83795 5.16142 7.31283 5.45432 7.60572L7.04529 9.19669L6.86548 9.3765C6.18206 10.0599 6.18206 11.168 6.86548 11.8514L7.36083 12.3467L5.96527 13.1427C5.76212 13.2585 5.62465 13.4625 5.59352 13.6943C5.56238 13.9261 5.64115 14.1591 5.80651 14.3245L9.69562 18.2136C9.86086 18.3788 10.0937 18.4576 10.3253 18.4267C10.557 18.3957 10.7609 18.2585 10.877 18.0557L11.6749 16.6608L12.1721 17.1579C12.8555 17.8414 13.9635 17.8414 14.6469 17.1579L14.8237 16.9812L16.4133 18.5708C16.7062 18.8636 17.1811 18.8636 17.474 18.5708L18.7165 17.3282C19.9623 16.0824 20.0716 14.1303 19.0442 12.7607L20.0421 11.7627C21.8149 9.98994 22.4591 7.38062 21.715 4.98647L21.5086 4.32216ZM19.253 3.94449C19.6461 4.0665 19.954 4.37425 20.0762 4.76734L20.2826 5.43165C20.8613 7.29377 20.3603 9.32324 18.9815 10.7021L13.5863 16.0973C13.4886 16.1949 13.3303 16.1949 13.2327 16.0973L7.92614 10.7907C7.82851 10.6931 7.82851 10.5348 7.92614 10.4372L13.3225 5.04079C14.7008 3.66249 16.7293 3.16127 18.5909 3.73902L19.253 3.94449ZM17.9641 13.8408C18.4166 14.6065 18.3139 15.6095 17.6558 16.2676L16.9436 16.9798L15.8844 15.9205L17.9641 13.8408ZM7.75751 6.36319C8.41602 5.70468 9.42005 5.60227 10.186 6.05596L8.10595 8.13603L7.04531 7.07539L7.75751 6.36319ZM10.5756 15.5615L10.0623 16.4589L7.56209 13.9588L8.46047 13.4464L10.5756 15.5615ZM6.68987 18.3942C6.98276 18.1013 6.98276 17.6264 6.68987 17.3335C6.39697 17.0406 5.9221 17.0406 5.62921 17.3335L3.15433 19.8084C2.86144 20.1013 2.86144 20.5762 3.15433 20.8691C3.44723 21.162 3.9221 21.162 4.21499 20.8691L6.68987 18.3942ZM4.74529 15.389C5.03818 15.6819 5.03818 16.1568 4.74529 16.4497L3.68463 17.5103C3.39173 17.8032 2.91686 17.8032 2.62397 17.5103C2.33107 17.2174 2.33107 16.7425 2.62397 16.4497L3.68463 15.389C3.97752 15.0961 4.45239 15.0961 4.74529 15.389ZM8.63238 20.3408C8.92528 20.0479 8.92528 19.5731 8.63239 19.2802C8.33951 18.9873 7.86463 18.9873 7.57173 19.2802L6.51313 20.3387C6.22023 20.6316 6.22023 21.1065 6.51312 21.3994C6.80601 21.6923 7.28088 21.6923 7.57378 21.3994L8.63238 20.3408Z"/>', // system.rocket outline — First run
  'illustrations:m365': '<path d="M13.75 2C14.9926 2 16 3.00736 16 4.25V6H18.75C20.5449 6 22 7.45507 22 9.25V17.75C22 19.5449 20.5449 21 18.75 21H5.25C3.45507 21 2 19.5449 2 17.75V9.25C2 7.45507 3.45507 6 5.25 6H8V4.25C8 3.00736 9.00736 2 10.25 2H13.75ZM20.5 13.4873C19.9947 13.811 19.3947 14 18.75 14H14C14 14.5523 13.5523 15 13 15H11C10.4477 15 10 14.5523 10 14H5.25C4.60533 14 4.00532 13.811 3.5 13.4873V17.75C3.5 18.7165 4.2835 19.5 5.25 19.5H18.75C19.7165 19.5 20.5 18.7165 20.5 17.75V13.4873ZM5.25 7.5C4.2835 7.5 3.5 8.2835 3.5 9.25V10.75C3.5 11.7165 4.2835 12.5 5.25 12.5H10V12C10 11.4477 10.4477 11 11 11H13C13.5523 11 14 11.4477 14 12V12.5H18.75C19.7165 12.5 20.5 11.7165 20.5 10.75V9.25C20.5 8.2835 19.7165 7.5 18.75 7.5H5.25ZM10.25 3.5C9.83579 3.5 9.5 3.83579 9.5 4.25V6H14.5V4.25C14.5 3.83579 14.1642 3.5 13.75 3.5H10.25Z"/>', // system.briefcase outline — Work
  'illustrations:product': '<path d="M17.75 3C19.5449 3 21 4.45507 21 6.25V17.75C21 19.5449 19.5449 21 17.75 21H6.25C4.45507 21 3 19.5449 3 17.75V6.25C3 4.45507 4.45507 3 6.25 3H17.75ZM18.3305 19.4014L12.5247 13.7148C12.2596 13.4553 11.8501 13.4316 11.5588 13.644L11.4752 13.7148L5.66845 19.4011C5.8504 19.4651 6.04613 19.5 6.25 19.5H17.75C17.9535 19.5 18.1489 19.4653 18.3305 19.4014L12.5247 13.7148L18.3305 19.4014ZM17.75 4.5H6.25C5.2835 4.5 4.5 5.2835 4.5 6.25V17.75C4.5 17.9584 4.53643 18.1583 4.60326 18.3437L10.4258 12.643C11.2589 11.8273 12.5675 11.7885 13.4458 12.5266L13.5742 12.6431L19.3964 18.3447C19.4634 18.159 19.5 17.9588 19.5 17.75V6.25C19.5 5.2835 18.7165 4.5 17.75 4.5ZM15.2521 6.5C16.4959 6.5 17.5042 7.50831 17.5042 8.75212C17.5042 9.99592 16.4959 11.0042 15.2521 11.0042C14.0083 11.0042 13 9.99592 13 8.75212C13 7.50831 14.0083 6.5 15.2521 6.5ZM15.2521 8C14.8367 8 14.5 8.33673 14.5 8.75212C14.5 9.1675 14.8367 9.50423 15.2521 9.50423C15.6675 9.50423 16.0042 9.1675 16.0042 8.75212C16.0042 8.33673 15.6675 8 15.2521 8Z"/>', // system.image outline — A picture, one level down
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  manifest: null,
  filter: { group: 'all', collection: null, query: '', status: '' },
  view: 'grid',
  selectedId: null,
  themes: { system: 'filled', product: 'standard', illustration: 'standard' },
  size: null,
  accent: 'default',
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const kid of [].concat(kids)) node.append(kid);
  return node;
};

/* ------------------------------------------------------------------ */
/* Drawings                                                            */
/* ------------------------------------------------------------------ */

/**
 * Resolve which drawing file to use for an asset at a given theme and size.
 *
 * Windows product icons are REDRAWN per size — the 16px Excel icon is a
 * different drawing from the 48px one, not a scaled copy — so asking for 16px
 * should get the 16px file. Order: exact size, then a size-agnostic "any", then
 * the nearest size below (scaling a bigger drawing down beats blowing a smaller
 * one up), then whatever is left.
 */
function drawingPath(asset, theme = themeFor(asset), size = state.size) {
  const drawings = asset.variants?.[theme] || asset.variants?.[asset.themes[0]];
  if (!drawings) return null;

  if (size && drawings[size]) return drawings[size];
  if (drawings.any) return drawings.any;

  const numeric = Object.keys(drawings)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!numeric.length) return Object.values(drawings)[0] || null;

  const below = numeric.filter((n) => n <= (size || Infinity)).pop();
  return drawings[below ?? numeric[numeric.length - 1]];
}

/** path -> svg source. Fetched once, kept for the session. */
const drawings = new Map();
/** path -> in-flight promise, so ten cards scrolling in fire one request each. */
const inflight = new Map();

function loadDrawing(path) {
  if (!path) return Promise.resolve(null);
  if (drawings.has(path)) return Promise.resolve(drawings.get(path));
  if (inflight.has(path)) return inflight.get(path);

  const req = fetch(path)
    .then((r) => (r.ok ? r.text() : null))
    .then((text) => {
      if (text) drawings.set(path, text);
      return text;
    })
    .catch(() => null)
    .finally(() => inflight.delete(path));

  inflight.set(path, req);
  return req;
}

/** Synchronous read of an already-loaded drawing. */
function sourceFor(asset, theme = themeFor(asset), size = state.size) {
  const path = drawingPath(asset, theme, size);
  return path ? drawings.get(path) || null : null;
}

/** Whether the accent picker can actually do anything to this drawing.
 *  Brand artwork ships with its colors baked in and has no tint hooks —
 *  better to say so than to offer a control that silently does nothing. */
function isTintable(asset, theme = themeFor(asset)) {
  if (asset.recolorable === false) return false;
  const source = sourceFor(asset, theme);
  return Boolean(source) && (source.includes('--ea-primary') || source.includes('currentColor'));
}

/* ------------------------------------------------------------------ */
/* SVG rendering                                                       */
/* ------------------------------------------------------------------ */

const HEX = '#[0-9A-Fa-f]{6}';

/**
 * Bake the current color choices into an SVG source string.
 *
 * Two tinting conventions live side by side. Generated artwork declares
 * --ea-primary / --ea-secondary custom properties. Imported monochrome artwork
 * (the Outline and Filled themes of the real product icons) is drawn in
 * currentColor, which tints by setting `color` on the root.
 */
/** Mix a hex toward white. The illustration palette pairs every hue with a much
 *  lighter companion — purple with lavender, coral with periwinkle. Recolouring
 *  the hue and leaving its companion behind pulls the drawing in two, so the
 *  companions move with it. */
function lighten(hex, toward) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const parts = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * toward);
  });
  return `#${parts.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function tint(source, { ink, inkSecondary, size }) {
  let out = source;
  const primary = ink;
  const secondary = inkSecondary;

  // Generated artwork declares the properties inside a <style> block, so the
  // value is substituted in place.
  if (primary) out = out.replace(new RegExp(`--ea-primary:${HEX}`), `--ea-primary:${primary}`);
  if (secondary) out = out.replace(new RegExp(`--ea-secondary:${HEX}`), `--ea-secondary:${secondary}`);

  // Imported artwork carries its hooks inline as `var(--ea-role, #shipped)` and
  // has no style block to patch, so the properties are set on the root instead.
  // Both kinds, plus currentColor, resolve into ONE style attribute — writing a
  // second one produces invalid markup that browsers silently drop.
  const decls = [];
  if (primary && out.includes('currentColor')) decls.push(`color:${primary}`);
  if (primary && out.includes('var(--ea-primary,')) {
    const second = secondary || primary;
    decls.push(
      `--ea-primary:${primary}`,
      `--ea-primary-tint:${lighten(primary, 0.72)}`,
      `--ea-secondary:${second}`,
      `--ea-tint:${lighten(second, 0.8)}`
    );
  }
  if (decls.length && !/<svg[^>]*\sstyle=/.test(out)) {
    out = out.replace('<svg ', `<svg style="${decls.join(';')}" `);
  }

  if (size) out = out.replace(/width="\d+"\s+height="\d+"/, `width="${size}" height="${size}"`);
  return out;
}

/** Effective colors for an asset. Artwork with no tint hooks keeps its own
 *  colors — brand marks ship as authored or not at all. */
function colorsFor(asset, accentId = state.accent, theme = themeFor(asset)) {
  const accent = ACCENTS.find((a) => a.id === accentId) || ACCENTS[0];
  const canTint = isTintable(asset, theme);
  const chosen = canTint && accent.primary ? accent : null;
  return {
    // What the metadata panel reports: the asset's own colours unless an accent
    // is overriding them.
    primary: (chosen && chosen.primary) || asset.colors.primary,
    secondary: (chosen && chosen.secondary) || asset.colors.secondary,
    // What actually gets painted onto currentColor and the --ea-* hooks. Null
    // means "leave it alone". A monochrome glyph has no colour of its own — the
    // hex in `colors` was extracted from the FULL-COLOUR variant at import, so
    // painting Outline with it turned every system icon Fluent blue and every
    // file icon PDF red. Untinted, these inherit the surface: near-white on
    // dark, near-black on light, which is what a monochrome style is for.
    ink: chosen ? chosen.primary : null,
    inkSecondary: chosen ? chosen.secondary : null,
  };
}

function svgNode(source, size) {
  const wrap = document.createElement('div');
  wrap.innerHTML = source;
  const svg = wrap.firstElementChild;
  if (svg && size) {
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
  }
  return svg;
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

/** Groups are the top level of the sidebar, and they are not the same thing as
 *  `type`: Product Icons and System Icons are both `icon`, and both Product
 *  Icons and Illustrations own a collection called `product`. So a group is
 *  matched on its type AND its own collection list, never on either alone. */
function groupById(id) {
  return state.manifest.groups.find((g) => g.id === id) || null;
}

function inGroup(asset, g) {
  return asset.type === g.type && g.collections.some((c) => c.id === asset.collection);
}

function visibleAssets() {
  const { group, collection, query, status } = state.filter;
  const q = query.trim().toLowerCase();
  return state.manifest.assets.filter((a) => {
    if (group !== 'all') {
      const g = groupById(group);
      if (!g || !inGroup(a, g)) return false;
    }
    if (collection && a.collection !== collection) return false;
    if (status && a.status !== status) return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      (a.keywords || []).some((k) => k.includes(q)) ||
      (a.aliases || []).some((x) => x.toLowerCase().includes(q)) ||
      (a.description || '').toLowerCase().includes(q)
    );
  });
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function navButton({ label, count, icon, active, onClick }) {
  const btn = el('button', { className: `nav-item${active ? ' on' : ''}`, type: 'button' });
  btn.innerHTML =
    `<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${icon}</svg>` +
    `<span class="label"></span><span class="n">${count}</span>`;
  btn.querySelector('.label').textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderNav() {
  const nav = $('#nav');
  nav.replaceChildren();
  const { group, collection } = state.filter;

  nav.append(
    navButton({
      label: 'All Assets',
      count: state.manifest.total,
      icon: NAV_ICONS.all,
      active: group === 'all' && !collection,
      onClick: () => selectCollection('all', null),
    })
  );

  for (const g of state.manifest.groups) {
    // The group itself is the row you click. Its collections sit under it, and
    // a group holding exactly one collection does not repeat itself.
    const head = navButton({
      label: g.label,
      count: g.collections.reduce((n, c) => n + c.count, 0),
      icon: NAV_ICONS[g.id] || NAV_ICONS.all,
      active: group === g.id && !collection,
      onClick: () => selectCollection(g.id, null),
    });
    head.classList.add('nav-top');
    nav.append(head);
    if (g.collections.length < 2) continue;
    for (const c of g.collections) {
      const btn = navButton({
        label: c.label,
        count: c.count,
        icon: NAV_ICONS[g.id + ':' + c.id] || NAV_ICONS[g.id] || NAV_ICONS.all,
        active: group === g.id && collection === c.id,
        onClick: () => selectCollection(g.id, c.id),
      });
      btn.classList.add('nav-sub');
      nav.append(btn);
    }
  }
}

function selectCollection(group, collection) {
  state.filter.group = group;
  state.filter.collection = collection;
  renderNav();
  renderGrid();
}

/* ------------------------------------------------------------------ */
/* Grid                                                               */
/* ------------------------------------------------------------------ */

/** Fills a card's artwork once it is actually on screen. Everything below the
 *  fold in a 500-asset library costs nothing until you scroll to it. */
const painter = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      painter.unobserve(entry.target);
      paintCard(entry.target);
    }
  },
  { rootMargin: '400px' }
);

async function paintCard(card) {
  const asset = state.manifest.assets.find((a) => a.id === card.dataset.id);
  if (!asset) return;
  await loadDrawing(drawingPath(asset));

  const source = sourceFor(asset);
  const thumb = card.querySelector('.thumb');
  if (!source || !thumb || !card.isConnected) return;

  const node = svgNode(tint(source, colorsFor(asset)), null);
  if (node) thumb.replaceChildren(node);
}

/** Repaint cards already showing artwork — after a theme or accent change. */
function repaintVisible() {
  for (const card of document.querySelectorAll('.card')) {
    if (card.querySelector('.thumb')?.childElementCount) paintCard(card);
  }
}

function buildCard(asset) {
  const card = el('button', { className: `card${asset.id === state.selectedId ? ' on' : ''}`, type: 'button' });
  card.dataset.id = asset.id;
  // Illustrations get a bigger thumbnail than icons. A 360px scene shown in a
  // 40px box is a smudge — you cannot tell two onboarding illustrations apart.
  card.dataset.type = asset.type;

  const thumb = el('div', { className: 'thumb' });
  const meta = el('div', { className: 'meta' });
  meta.append(el('span', { textContent: asset.id }));
  if (asset.status !== 'published') {
    meta.append(el('span', { className: `badge ${asset.status}`, textContent: STATUS_LABEL[asset.status] }));
  }

  card.append(thumb, el('div', { className: 'name', textContent: asset.name }), meta);
  card.addEventListener('click', () => openPanel(asset.id));
  painter.observe(card);
  return card;
}

let renderToken = 0;

/**
 * Cards are added a page at a time as you scroll, not all at once.
 *
 * Building every card up front is what a 2,900-icon collection costs: measured
 * at 2.6s of pure DOM construction on every collection switch, before a single
 * pixel was painted. content-visibility fixes layout and paint but not element
 * creation, so the only real answer is to create fewer.
 *
 * A sentinel after the last card pulls in the next page when it scrolls close.
 * The count in the toolbar always reflects the full filtered set, not what
 * happens to be rendered — the paging is a rendering detail, not a filter.
 */
const PAGE_SIZE = 240;

const paging = { assets: [], rendered: 0, token: 0 };

/* A scroll check rather than an IntersectionObserver on a sentinel. The
   observer version fired once and then stopped: appending cards moves the
   sentinel, and the intersection state never cleanly re-entered. A scroll
   handler is one line of logic with no such subtlety, and it runs on a frame
   the browser was already going to render. */
function maybeRenderMore() {
  const grid = $('#grid');
  if (paging.rendered >= paging.assets.length) return;
  const remaining = grid.scrollHeight - grid.scrollTop - grid.clientHeight;
  if (remaining < 800) renderNextPage();
}

function renderNextPage() {
  const grid = $('#grid');
  const token = paging.token;

  const slice = paging.assets.slice(paging.rendered, paging.rendered + PAGE_SIZE);
  if (!slice.length) return;

  const frag = document.createDocumentFragment();
  for (const asset of slice) frag.append(buildCard(asset));
  if (token !== paging.token) return;

  grid.append(frag);
  paging.rendered += slice.length;
}

function renderGrid() {
  const grid = $('#grid');
  const assets = visibleAssets();
  renderToken++;

  grid.className = `grid${state.view === 'list' ? ' list' : ''}`;
  grid.replaceChildren();

  const searching = state.filter.query.trim().length > 0;
  $('#count').textContent = searching
    ? `${assets.length} match${assets.length === 1 ? '' : 'es'}`
    : `${assets.length} asset${assets.length === 1 ? '' : 's'}`;

  if (!assets.length) {
    const empty = el('div', { className: 'empty' });
    empty.innerHTML =
      '<strong>No assets match those filters</strong>Try a different search term, or clear the status filter.';
    grid.append(empty);
    return;
  }

  paging.assets = assets;
  paging.rendered = 0;
  paging.token++;
  renderNextPage();

  // The first page may not fill a tall window; keep going until it does.
  requestAnimationFrame(maybeRenderMore);
}

/* ------------------------------------------------------------------ */
/* Detail panel                                                        */
/* ------------------------------------------------------------------ */

async function openPanel(id) {
  const asset = state.manifest.assets.find((a) => a.id === id);
  if (!asset) return;

  state.selectedId = id;
  state.size = asset.sizes.includes(state.size) ? state.size : asset.sizes[asset.sizes.length - 1];

  for (const card of document.querySelectorAll('.card')) {
    card.classList.toggle('on', card.dataset.id === id);
  }

  // Load every theme's drawing at this size so the Style toggle and the
  // accent-availability note are correct the moment the panel opens.
  await Promise.all(stylesFor(asset).map((t) => loadDrawing(drawingPath(asset, t))));
  if (state.selectedId === id) renderPanel();
}

function closePanel() {
  state.selectedId = null;
  $('#panel').hidden = true;
  for (const card of document.querySelectorAll('.card.on')) card.classList.remove('on');
}

/** "One scalable drawing" vs "6 sizes: 16, 20, 24…" — tells you at a glance
 *  whether you are looking at per-size artwork or one scalable file. */
function drawingSummary(asset) {
  const drawings = asset.variants?.[themeFor(asset)] || {};
  const sizes = Object.keys(drawings).filter((k) => k !== 'any');
  if (!sizes.length) return 'One scalable drawing';
  return `${sizes.length} per-size (${sizes.map(Number).sort((a, b) => a - b).join(', ')})`;
}

/** Repo path of the drawing currently on screen. */
function sourcePath(asset) {
  const drawings = asset.variants?.[themeFor(asset)] || asset.variants?.[asset.themes[0]] || {};
  if (drawings[state.size]) return drawings[state.size];
  if (drawings.any) return drawings.any;
  const numeric = Object.keys(drawings).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const below = numeric.filter((n) => n <= state.size).pop();
  return drawings[below ?? numeric[numeric.length - 1]] || '';
}

/** Was the cell on screen produced here rather than received? Provenance is
 *  per variant, not per asset: an icon can be published, real artwork and
 *  still show you a style that was derived from it. Saying so on the preview
 *  is the difference between a library and a pile of drawings. */
function isGenerated(asset, theme, size) {
  const cells = asset.generated || [];
  if (!cells.length) return false;
  return cells.indexOf(theme + ':' + size) !== -1 || cells.indexOf(theme + ':any') !== -1;
}

function collectionLabel(asset) {
  for (const g of state.manifest.groups) {
    const c = g.collections.find((x) => x.id === asset.collection);
    if (g.type === asset.type && c) return c.label;
  }
  return asset.collection;
}

function renderPanel() {
  const panel = $('#panel');
  const asset = state.manifest.assets.find((a) => a.id === state.selectedId);
  if (!asset) return closePanel();

  panel.hidden = false;
  panel.replaceChildren();

  const colors = colorsFor(asset);
  const canTint = isTintable(asset);
  // Which themes CAN take an accent — used to explain why the picker is off.
  const tintableThemes = stylesFor(asset).filter((t) => isTintable(asset, t));

  /* Head */
  const head = el('div', { className: 'panel-head' });
  head.append(el('h2', { textContent: asset.name }));
  const close = el('button', { className: 'close', type: 'button', title: 'Close', ariaLabel: 'Close details' });
  close.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  close.addEventListener('click', closePanel);
  head.append(close);
  panel.append(head);

  const kicker = el('p', { className: 'kicker' });
  kicker.append(`${collectionLabel(asset)}${asset.product ? ` · ${asset.product}` : ''}`);
  if (asset.status !== 'published') {
    kicker.append(' ', el('span', { className: `badge ${asset.status}`, textContent: STATUS_LABEL[asset.status] }));
  }
  panel.append(kicker);

  if (asset.status === 'deprecated' && asset.replacedBy) {
    const note = el('p', { className: 'callout' });
    note.append('Deprecated. Use ');
    const link = el('button', { className: 'linkish', type: 'button', textContent: asset.replacedBy });
    link.addEventListener('click', () => openPanel(asset.replacedBy));
    note.append(link, ' instead.');
    panel.append(note);
  }

  if (asset.description) panel.append(el('p', { className: 'blurb', textContent: asset.description }));

  /* Preview */
  const preview = el('div', { className: 'preview' });
  const source = sourceFor(asset);
  if (source) {
    const node = svgNode(tint(source, colors), state.size);
    if (node) preview.append(node);
  }
  panel.append(preview);
  const note = el('p', { className: 'preview-note' });
  note.append(`Shown at actual size — ${state.size}px`);
  if (isGenerated(asset, themeFor(asset), state.size)) {
    note.append(' ', el('span', { className: 'badge generated', textContent: 'Generated' }));
  }
  panel.append(note);

  /* Style. Only what this family offers and this asset has: a System icon
     shows Outline and Filled, and never a Standard it was never drawn in. */
  const family = FAMILIES[familyOf(asset)];
  const styles = stylesFor(asset);
  const theme = themeFor(asset);
  if (styles.length > 1) {
    panel.append(el('h3', { textContent: 'Style' }));
    const seg = el('div', { className: 'segment', role: 'group' });
    for (const key of styles) {
      const label = THEMES.find((t) => t.key === key)?.label || key;
      const btn = el('button', {
        type: 'button',
        textContent: label,
        className: theme === key ? 'on' : '',
        title: `${label} (${key})`,
      });
      btn.setAttribute('aria-pressed', String(theme === key));
      btn.addEventListener('click', async () => {
        state.themes[familyOf(asset)] = key;
        await loadDrawing(drawingPath(asset));
        repaintVisible();
        renderPanel();
      });
      seg.append(btn);
    }
    panel.append(seg);
  }

  /* Size */
  const sizeRow = el('div', { className: 'size-row' });
  sizeRow.append(el('h3', { textContent: 'Size' }), el('span', { className: 'val', textContent: `${state.size}px` }));
  panel.append(sizeRow);
  const slider = el('input', {
    type: 'range',
    min: 0,
    max: asset.sizes.length - 1,
    step: 1,
    value: asset.sizes.indexOf(state.size),
  });
  slider.setAttribute('aria-label', 'Preview size');
  slider.addEventListener('input', async () => {
    state.size = asset.sizes[Number(slider.value)];
    // Per-size artwork means a new size is a different FILE, which may not be
    // fetched yet. Render immediately so the slider feels live, then re-render
    // once the drawing lands.
    renderPanel();
    if (await loadDrawing(drawingPath(asset))) renderPanel();
  });
  panel.append(slider);

  /* Colors. A System icon has no brand colour of its own — the pair stored on
     it is a library-wide default — so showing swatches would be inventing
     information. That family gets a sentence under Color instead. */
  if (family.brandColors) {
    panel.append(el('h3', { textContent: 'Colors' }));
    const rows = el('div', { className: 'rows' });
    for (const [key, value] of [['Primary', colors.primary], ['Secondary', colors.secondary]]) {
      const row = el('div', { className: 'row' });
      const v = el('div', { className: 'v' });
      v.append(el('code', { textContent: value }), el('span', { className: 'chip-color', style: `background:${value}` }));
      row.append(el('span', { className: 'k', textContent: key }), v);
      rows.append(row);
    }
    panel.append(rows);
  }

  /* Accents */
  panel.append(el('h3', { textContent: family.brandColors ? 'Windows accents' : 'Color' }));
  if (family.colorNote) panel.append(el('p', { className: 'hint', textContent: family.colorNote }));
  if (!canTint) {
    const others = tintableThemes.map((t) => THEMES.find((x) => x.key === t)?.label).filter(Boolean);
    panel.append(
      el('p', {
        className: 'callout',
        textContent: others.length
          ? `${THEMES.find((t) => t.key === theme)?.label} ships in brand colors and can't be retinted. Switch to ${others.join(' or ')} to apply an accent.`
          : 'Not recolorable — this asset ships in its own brand colors.',
      })
    );
  } else {
    const accents = el('div', { className: 'accents' });
    for (const accent of ACCENTS) {
      // "Asset default" means different things per family: a brand pair for a
      // product icon, the surrounding surface for a monochrome system icon. The
      // swatch has to say which, or it reads as a colour the icon does not have.
      const followsSurface = accent.id === 'default' && !family.brandColors;
      const label = followsSurface ? 'Follow the surface' : accent.label;
      const btn = el('button', {
        type: 'button',
        className: state.accent === accent.id ? 'on' : '',
        title: label,
        ariaLabel: label,
        // Hard stops, not a blend: the pair is information, the sheen was not.
        style: followsSurface
          ? 'background:linear-gradient(135deg, var(--text) 0 50%, var(--text-3) 50% 100%)'
          : `background:linear-gradient(135deg, ${accent.primary || asset.colors.primary} 0 50%, ${accent.secondary || asset.colors.secondary} 50% 100%)`,
      });
      btn.addEventListener('click', () => {
        state.accent = accent.id;
        repaintVisible();
        renderPanel();
      });
      accents.append(btn);
    }
    panel.append(accents);
  }

  /* Metadata */
  panel.append(el('h3', { textContent: 'Metadata' }));
  const metaRows = el('div', { className: 'rows' });
  const entries = [
    ['ID', asset.id],
    ['Family', family.label],
    ['Status', STATUS_LABEL[asset.status]],
    ['Styles', styles.map((k) => THEMES.find((t) => t.key === k)?.label || k).join(', ')],
    ['Sizes', asset.sizes.join(', ')],
    ['Accent', tintableThemes.length ? `${tintableThemes.length} of ${styles.length} styles` : 'Not applicable'],
    ['Drawings', drawingSummary(asset)],
    ['Version', `${asset.version} · ${asset.updated}`],
  ];
  if (asset.generated?.length) {
    const total = Object.values(asset.variants || {}).reduce((n, d) => n + Object.keys(d).length, 0);
    entries.splice(6, 0, ['Generated', `${asset.generated.length} of ${total} drawings`]);
  }
  if (asset.aliases?.length) entries.splice(1, 0, ['Also known as', asset.aliases.join(', ')]);
  if (asset.owner) entries.push(['Owner', asset.owner]);
  if (asset.source) entries.push(['Source', `${asset.source.project} · ${asset.source.license}`]);
  for (const [k, v] of entries) {
    const row = el('div', { className: 'row' });
    row.append(el('span', { className: 'k', textContent: k }), el('span', { className: 'v', textContent: v }));
    metaRows.append(row);
  }
  panel.append(metaRows);

  /* Provenance. Shown where someone is about to copy the artwork, not buried
     in a repo file they will never open. */
  if (asset.source) {
    const note = el('p', { className: 'callout' });
    note.append(`${asset.source.copyright || asset.source.project}. Used under ${asset.source.license}. `);
    if (asset.source.url) {
      note.append(
        el('a', { href: asset.source.url, target: '_blank', rel: 'noopener', className: 'linkish', textContent: 'View upstream' })
      );
    }
    if (asset.notes) note.append(el('span', { className: 'fine', textContent: asset.notes }));
    panel.append(note);
  }

  /* Keywords */
  panel.append(el('h3', { textContent: 'Keywords' }));
  if (asset.keywords?.length) {
    const tags = el('div', { className: 'tags' });
    for (const keyword of asset.keywords) {
      const btn = el('button', { type: 'button', textContent: keyword });
      btn.addEventListener('click', () => {
        $('#search').value = keyword;
        state.filter.query = keyword;
        renderGrid();
      });
      tags.append(btn);
    }
    panel.append(tags);
  } else {
    panel.append(el('p', { className: 'muted', textContent: 'None yet — findable only by name.' }));
  }

  /* Actions */
  const exportSource = () => tint(sourceFor(asset) || '', { ...colors, size: state.size });
  const actions = el('div', { className: 'actions' });

  const copy = el('button', { className: 'btn', type: 'button' });
  copy.innerHTML =
    '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5" stroke-linecap="round"/></svg>';
  copy.append('Copy SVG code');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exportSource());
      toast('SVG copied to clipboard');
    } catch {
      toast('Clipboard blocked — use Download instead');
    }
  });

  const download = el('button', { className: 'btn btn-primary', type: 'button' });
  download.innerHTML =
    '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0 4-4m-4 4-4-4M4.5 19.5h15"/></svg>';
  download.append('Download SVG');
  download.addEventListener('click', () => {
    const blob = new Blob([exportSource()], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `${asset.id.replace('.', '-')}-${theme}-${state.size}.svg` });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Customizer is the sibling tool: Gallery shows the library, Customizer
  // restyles a piece of it. Deep-linked by asset id rather than file path so
  // the link survives a re-import that changes which sizes exist. Standard
  // only: it reads source colour, which Outline and Filled do not carry.
  const customize = el('a', {
    className: 'btn',
    href: `customizer.html?asset=${encodeURIComponent(asset.id)}`,
    target: '_blank',
    rel: 'noopener',
  });
  customize.innerHTML =
    '<svg class="ico" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="9.5" cy="15" r="1.3" fill="currentColor" stroke="none"/><path d="M12 20.5a2.6 2.6 0 0 0 2.2-4 1.7 1.7 0 0 1 1.4-2.7h1.3"/></svg>';
  customize.append('Open in Customizer');

  actions.append(copy, download, customize);
  actions.append(
    el('a', {
      className: 'btn',
      href: `${REPO}/tree/main/${sourcePath(asset)}`,
      target: '_blank',
      rel: 'noopener',
      textContent: 'View source on GitHub',
    })
  );
  panel.append(actions);
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

let toastTimer;
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('on'), 2200);
}

function columnCount() {
  if (state.view === 'list') return 1;
  const cols = getComputedStyle($('#grid')).gridTemplateColumns.split(' ').length;
  return Math.max(1, cols);
}

function moveSelection(delta) {
  const cards = [...document.querySelectorAll('.card')];
  if (!cards.length) return;
  const current = cards.findIndex((c) => c.dataset.id === state.selectedId);
  const next = cards[Math.max(0, Math.min(cards.length - 1, current + delta))];
  if (!next) return;
  next.scrollIntoView({ block: 'nearest' });
  openPanel(next.dataset.id);
}

function wireChrome() {
  $('#search').addEventListener('input', (e) => {
    state.filter.query = e.target.value;
    renderGrid();
  });

  $('#filter-status').addEventListener('change', (e) => {
    state.filter.status = e.target.value;
    renderGrid();
  });

  for (const btn of document.querySelectorAll('.view button')) {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      for (const other of document.querySelectorAll('.view button')) {
        const on = other === btn;
        other.classList.toggle('on', on);
        other.setAttribute('aria-pressed', String(on));
      }
      renderGrid();
    });
  }

  let scrollQueued = false;
  $('#grid').addEventListener(
    'scroll',
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        maybeRenderMore();
      });
    },
    { passive: true }
  );

  $('#contribute').href = `${REPO}/blob/main/CONTRIBUTING.md`;

  document.addEventListener('keydown', (e) => {
    const typing = document.activeElement === $('#search');
    if (e.key === 'Escape' && state.selectedId) return closePanel();
    if (e.key === '/' && !typing) {
      e.preventDefault();
      return $('#search').focus();
    }
    if (typing || !state.selectedId) return;
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columnCount(), ArrowUp: -columnCount() };
    if (moves[e.key]) {
      e.preventDefault();
      moveSelection(moves[e.key]);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function boot() {
  try {
    state.manifest = await (await fetch('manifest.json')).json();
  } catch {
    $('#grid').innerHTML =
      '<div class="empty"><strong>Could not load manifest.json</strong>Run <code>npm run build</code> and serve the <code>_site</code> folder — opening index.html straight from disk blocks the fetch.</div>';
    return;
  }

  wireChrome();
  renderNav();
  renderGrid();

  // Open the first asset in library order, so the panel matches whatever the
  // sidebar puts first rather than a hard-coded favourite.
  const [first] = state.manifest.assets;
  if (first) openPanel(first.id);
}

boot();
