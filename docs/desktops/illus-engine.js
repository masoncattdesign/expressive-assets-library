/* Style engine from the Windows illustration library (illustration-library/).
   styled(svgSource, style) restyles a Windows-style illustration by color role:
   windows (as drawn), m365, grain, texture, glass, aero, win95, skeuo, neon, stipple.
   Copied as is so the desktops and the library stay in step. */
// ---------- color helpers
const hx=h=>{h=h.replace('#','');if(h.length==3)h=h.split('').map(c=>c+c).join('');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)};
const lin=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
function oklab(h){const[r,g,b]=hx(h).map(lin);const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 const L=.2104542553*l+.7936177850*m-.0040720468*s,a=1.9779984951*l-2.4285922050*m+.4505937099*s,B=.0259040371*l+.7827717662*m-.8086757660*s;return{L,C:Math.hypot(a,B),H:(Math.atan2(B,a)*180/Math.PI+360)%360}}
function role(h){if(!h||h[0]!=='#')return null;const{L,C,H}=oklab(h);
 if(C<.035){return L>.985?'white':L>.9?'paper':L>.78?'surface':L>.6?'mid':'dark'}
 const fam=(H>150&&H<215)?'teal':(H>=215&&H<280)?'blue':(H>=280&&H<340)?'purple':'warm';
 const step=L>.84?'pale':L>.71?'soft':L>.58?'loud':'heavy';return fam+'.'+step}
function mix(h,t,k){const a=hx(h),b=hx(t);return'#'+a.map((v,i)=>Math.round((v*(1-k)+b[i]*k)*255).toString(16).padStart(2,'0')).join('')}
// ---------- style maps
const M365={white:'#FFFFFF',paper:'#F5F5F5',surface:'#F5F5F5',mid:'#F5F5F5',dark:'#484848',
 'blue.heavy':'#238CD9','blue.loud':'#2F95F4','blue.soft':'#2F95F4','blue.pale':'#C6E1FF',
 'purple.heavy':'#8661C5','purple.loud':'#8661C5','purple.soft':'#E4D6FF','purple.pale':'#E4D6FF',
 'teal.heavy':'#FB966E','teal.loud':'#FB966E','teal.soft':'#FB966E','teal.pale':'#FFA38B','warm.loud':'#FB966E'};
const GR={fill1:['#FCEBEC','#D39AD7'],fill2:['#EDC2B6','#5A94FA'],fill3:['#C996DA','#3D62D6'],fill4:['#8A6BD4','#203A7A'],fill5:['#3A6FE8','#1B2A63']};
const GRAIN={white:'#FCEBEC',paper:'fill1',surface:'fill1',mid:'fill1',dark:'#141A30',
 'blue.heavy':'fill5','blue.loud':'fill3','blue.soft':'fill2','blue.pale':'fill1','purple.heavy':'fill4','purple.loud':'fill4',
 'purple.soft':'fill1','purple.pale':'fill1','teal.heavy':'fill3','teal.loud':'fill2','teal.soft':'fill2','teal.pale':'fill1'};
const TEX={blue:'stripes',purple:'dots',teal:'grid',warm:'dots',surface:'stipple',paper:'stipple',mid:'stipple'};
let uid=0;
function styled(src,style){
 const doc=new DOMParser().parseFromString(src,'image/svg+xml');const svg=doc.documentElement;
 const p='s'+(uid++)+'-';
 svg.querySelectorAll('[id]').forEach(e=>e.id=p+e.id);
 svg.querySelectorAll('*').forEach(e=>{for(const a of['fill','stroke','filter','clip-path','mask']){const v=e.getAttribute(a);if(v&&v.includes('url(#'))e.setAttribute(a,v.replace(/url\(#/g,'url(#'+p))}});
 svg.removeAttribute('width');svg.removeAttribute('height');
 const NS='http://www.w3.org/2000/svg';let defs=svg.querySelector('defs');if(!defs){defs=doc.createElementNS(NS,'defs');svg.appendChild(defs)}
 const add=h=>{const t=doc.createElementNS(NS,'g');t.innerHTML=h;[...t.childNodes].forEach(n=>defs.appendChild(n))};
 const stopsOf=id=>{const g=svg.querySelector('#'+CSS.escape(id));return g?[...g.querySelectorAll('stop')].map(s=>s.getAttribute('stop-color')).filter(Boolean):[]};
 const shapes=[...svg.querySelectorAll('path,rect,circle,ellipse,polygon')].filter(e=>!e.closest('defs,clipPath,mask'));
 const roleOfEl=(e,attr)=>{const v=e.getAttribute(attr);if(!v||v==='none')return null;if(v.startsWith('url(')){const s=stopsOf(v.slice(5,-1));return s.length?role(s[s.length-1]):null}return role(v.toLowerCase()==='white'?'#FFFFFF':v)};
 if(style==='m365'){
  svg.querySelectorAll('[filter]').forEach(e=>e.removeAttribute('filter'));
  shapes.forEach(e=>{for(const a of['fill','stroke']){const r=roleOfEl(e,a);if(!r)continue;e.setAttribute(a,M365[r]||M365[r.split('.')[0]+'.loud']||'#2F95F4');
   if(a==='fill'&&['paper','surface','mid'].includes(r)){e.setAttribute('stroke','#484848');e.setAttribute('stroke-width','2')}}});
 }
 if(style==='grain'){
  svg.querySelectorAll('[filter]').forEach(e=>e.removeAttribute('filter'));
  add(Object.entries(GR).map(([k,[a,b]])=>`<linearGradient id="${p}${k}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')+
   `<filter id="${p}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="7" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/><feBlend in="gi" in2="SourceGraphic" mode="soft-light" result="b"/><feComposite in="b" in2="SourceGraphic" operator="in"/></filter>`);
  shapes.forEach(e=>{for(const a of['fill','stroke']){const r=roleOfEl(e,a);if(!r)continue;const t=GRAIN[r]||'fill3';e.setAttribute(a,t.startsWith('#')?t:`url(#${p}${t})`)}});
  const g=doc.createElementNS(NS,'g');g.setAttribute('filter',`url(#${p}grain)`);[...svg.childNodes].filter(n=>n!==defs).forEach(n=>g.appendChild(n));svg.appendChild(g);
 }
 if(style==='texture'){
  const made={};
  shapes.forEach(e=>{const v=e.getAttribute('fill');const r=roleOfEl(e,'fill');if(!r||!v)return;
   const kind=TEX[r]||TEX[r.split('.')[0]];if(!kind)return;
   const base=v.startsWith('url(')?(stopsOf(v.slice(5,-1)).slice(-1)[0]||'#888'):v;const key=kind+base;
   if(!made[key]){const id=p+'t'+Object.keys(made).length;made[key]=id;const {L}=oklab(base);const ink=L>.75?mix(base,'#000000',.12):mix(base,'#FFFFFF',.28);
    const marks={stripes:`<path d="M-2 2L2 -2M0 12L12 0M10 14L14 10" stroke="${ink}" stroke-width="3"/>`,
     dots:`<circle cx="3" cy="3" r="1.8" fill="${ink}"/><circle cx="9" cy="9" r="1.8" fill="${ink}"/>`,
     grid:`<path d="M0 .75H12M.75 0V12" stroke="${ink}" stroke-width="1.5"/>`,
     stipple:`<circle cx="2" cy="3" r=".9" fill="${ink}"/><circle cx="8" cy="7" r=".9" fill="${ink}"/><circle cx="5" cy="10" r=".7" fill="${ink}"/>`}[kind];
    add(`<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${base}"/>${marks}</pattern>`)}
   e.setAttribute('fill',`url(#${made[key]})`)});
 }
 if(style==='glass'){
  add(`<filter id="${p}bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter>`);
  const bloom=doc.createElementNS(NS,'g');bloom.setAttribute('filter',`url(#${p}bloom)`);bloom.setAttribute('opacity','.55');
  bloom.innerHTML='<circle cx="200" cy="220" r="120" fill="#6E8BFF"/><circle cx="320" cy="300" r="110" fill="#B48CFF"/><circle cx="250" cy="340" r="80" fill="#5FE0D2"/>';
  svg.insertBefore(bloom,svg.firstChild===defs?defs.nextSibling:svg.firstChild);
  shapes.forEach(e=>{const r=roleOfEl(e,'fill');if(!r||r==='white')return;
   if(['paper','surface','mid'].includes(r)){e.setAttribute('fill','#FFFFFF');e.setAttribute('fill-opacity','.5')}
   else e.setAttribute('fill-opacity','.78');
   if(!e.getAttribute('stroke')){e.setAttribute('stroke','#FFFFFF');e.setAttribute('stroke-opacity','.7');e.setAttribute('stroke-width','1.5')}});
 }

 if(style==='aero'){
  const A={white:'#FFFFFF',paper:'#F2F8FD',surface:'#E3F0FA',mid:'#C4DAEE',dark:'#1B4F8A',
   'blue.heavy':'#1560D8','blue.loud':'#2F8CFF','blue.soft':'#79BCFF','blue.pale':'#CFE8FF',
   'purple.heavy':'#3A9A1E','purple.loud':'#62BE2A','purple.soft':'#A8E06A','purple.pale':'#DDF5C4',
   'teal.heavy':'#0092B5','teal.loud':'#19C6E6','teal.soft':'#8BE3F2','teal.pale':'#D2F4FA',
   'warm.heavy':'#D9660B','warm.loud':'#FF9A1F','warm.soft':'#FFC878','warm.pale':'#FFE7C2'};
  const gl={};const gloss=c=>{if(!gl[c]){const id=p+'gl'+Object.keys(gl).length;gl[c]=id;
   add(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${mix(c,'#FFFFFF',.78)}"/><stop offset=".46" stop-color="${mix(c,'#FFFFFF',.34)}"/><stop offset=".5" stop-color="${c}"/><stop offset=".82" stop-color="${mix(c,'#000000',.06)}"/><stop offset="1" stop-color="${mix(c,'#FFFFFF',.4)}"/></linearGradient>`)}return`url(#${gl[c]})`};
  shapes.forEach(e=>{const rf=roleOfEl(e,'fill'),rs=roleOfEl(e,'stroke');
   if(rs)e.setAttribute('stroke',A[rs]||A[rs.split('.')[0]+'.loud']||'#2F8CFF');
   if(!rf)return;const c=A[rf]||A[rf.split('.')[0]+'.loud']||'#2F8CFF';
   e.setAttribute('fill',rf==='white'?c:gloss(c));
   if(['paper','surface','mid'].includes(rf)&&!rs){e.setAttribute('stroke','#86B6E0');e.setAttribute('stroke-width','2.5')}
   else if(rf!=='white'&&!rs){e.setAttribute('stroke',mix(c,'#002850',.35));e.setAttribute('stroke-width','1.6')}});
 }
 if(style==='win95'){
  svg.querySelectorAll('[filter]').forEach(e=>e.removeAttribute('filter'));
  const B=10.24,W={white:'#FFFFFF',paper:'#FFFFFF',surface:'#C0C0C0',mid:'#808080',dark:'#000000',
   'blue.heavy':'#000080','blue.loud':'#0000FF','blue.soft':['#0000FF','#FFFFFF'],'blue.pale':['#C0C0C0','#FFFFFF'],
   'purple.heavy':'#800080','purple.loud':'#800080','purple.soft':['#FF00FF','#FFFFFF'],'purple.pale':['#FF00FF','#FFFFFF'],
   'teal.heavy':'#008080','teal.loud':'#00FFFF','teal.soft':['#00FFFF','#FFFFFF'],'teal.pale':['#00FFFF','#FFFFFF'],
   'warm.heavy':'#800000','warm.loud':'#FF0000','warm.soft':['#FFFF00','#FFFFFF'],'warm.pale':['#FFFF00','#FFFFFF']};
  const dz={};const dith=([a,b])=>{const k=a+b;if(!dz[k]){const id=p+'d'+Object.keys(dz).length;dz[k]=id;
   add(`<pattern id="${id}" width="${2*B}" height="${2*B}" patternUnits="userSpaceOnUse"><rect width="${2*B}" height="${2*B}" fill="${b}"/><rect width="${B}" height="${B}" fill="${a}"/><rect x="${B}" y="${B}" width="${B}" height="${B}" fill="${a}"/></pattern>`)}return`url(#${dz[k]})`};
  const col=r=>{const v=W[r]||W[r.split('.')[0]+'.loud']||'#0000FF';return Array.isArray(v)?dith(v):v};
  shapes.forEach(e=>{const rf=roleOfEl(e,'fill'),rs=roleOfEl(e,'stroke');
   if(rs)e.setAttribute('stroke',Array.isArray(W[rs])?W[rs][0]:(W[rs]||'#000000'));
   if(!rf)return;e.setAttribute('fill',col(rf));
   if(rf!=='white'&&!rs){e.setAttribute('stroke','#000000');e.setAttribute('stroke-width','7');e.setAttribute('stroke-linejoin','miter')}});
  add(`<filter id="${p}px" filterUnits="userSpaceOnUse" x="0" y="0" width="512" height="512" color-interpolation-filters="sRGB"><feFlood x="${B/2-2}" y="${B/2-2}" width="4" height="4"/><feComposite width="${B}" height="${B}"/><feTile result="a"/><feComposite in="SourceGraphic" in2="a" operator="in"/><feMorphology operator="dilate" radius="${B/2}"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer></filter>`);
  const g=doc.createElementNS(NS,'g');g.setAttribute('filter',`url(#${p}px)`);[...svg.childNodes].filter(n=>n!==defs).forEach(n=>g.appendChild(n));svg.appendChild(g);
 }
 if(style==='skeuo'){
  svg.querySelectorAll('[filter]').forEach(e=>e.removeAttribute('filter'));
  add(`<filter id="${p}sk" x="-25%" y="-25%" width="150%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="b"/><feSpecularLighting in="b" surfaceScale="3.5" specularConstant=".8" specularExponent="16" lighting-color="#FFFFFF" result="s"><feDistantLight azimuth="250" elevation="48"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/><feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k2="1" k3=".65" result="lit"/><feDropShadow in="lit" dx="0" dy="5" stdDeviation="5" flood-color="#1A1206" flood-opacity=".38"/></filter>`);
  const gz={};const shade=c=>{if(!gz[c]){const id=p+'sg'+Object.keys(gz).length;gz[c]=id;
   add(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${mix(c,'#FFFFFF',.42)}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${mix(c,'#000000',.28)}"/></linearGradient>`)}return`url(#${gz[c]})`};
  shapes.forEach(e=>{const v=e.getAttribute('fill');const rf=roleOfEl(e,'fill');if(!rf||!v)return;
   let c=v.startsWith('url(')?(stopsOf(v.slice(5,-1)).slice(-1)[0]||'#888888'):v;if(c.toLowerCase()==='white')c='#FFFFFF';
   if(['paper','surface'].includes(rf))c=mix(c,'#F4ECD8',.45);
   e.setAttribute('fill',rf==='white'?c:shade(c));e.setAttribute('filter',`url(#${p}sk)`);
   if(rf!=='white'&&!e.getAttribute('stroke')){e.setAttribute('stroke',mix(c,'#000000',.38));e.setAttribute('stroke-width','1.6');e.setAttribute('stroke-opacity','.7')}});
 }

 if(style==='neon'){
  // Neon blur: modern blurred neon gradients with grain (Mason's refs, 2026-09-26). Each family becomes a
  // glowing two-hue gradient; grey surfaces turn to a faint dark glass with a neon rim; everything sits
  // over a blurred copy of itself for the glow, with soft edges and a film grain on top.
  svg.querySelectorAll('[filter]').forEach(e=>e.removeAttribute('filter'));
  const N={blue:['#00E5FF','#2F5BFF'],purple:['#FF4FD8','#7B2CFF'],teal:['#C6FF3D','#00D9B8'],warm:['#FFC24A','#FF4A2B']};
  const nz={};const neon=(fam,step)=>{const k=fam+step;if(!nz[k]){const id=p+'n'+Object.keys(nz).length;nz[k]=id;let[a,b]=N[fam]||N.blue;
   if(step==='pale'||step==='soft'){a=mix(a,'#FFFFFF',.35);b=mix(b,'#FFFFFF',.25)}
   add(`<radialGradient id="${id}" cx=".32" cy=".28" r=".95"><stop stop-color="${mix(a,'#FFFFFF',.35)}"/><stop offset=".38" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`)}return`url(#${nz[k]})`};
  add(`<linearGradient id="${p}dim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3B4FC4"/><stop offset="1" stop-color="#6A36C9"/></linearGradient>`);
  add(`<linearGradient id="${p}rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#00E5FF"/><stop offset=".55" stop-color="#7B2CFF"/><stop offset="1" stop-color="#FF4FD8"/></linearGradient>`);
  shapes.forEach(e=>{for(const a of['fill','stroke']){const r=roleOfEl(e,a);if(!r)continue;
   if(r==='white'){e.setAttribute(a,'#FFFFFF');continue}
   if(['paper','surface','mid'].includes(r)){
    if(a==='fill'){if(r==='mid'){e.setAttribute('fill',`url(#${p}dim)`);e.setAttribute('fill-opacity','.7')}
     else{e.setAttribute('fill','#FFFFFF');e.setAttribute('fill-opacity',r==='surface'?'.12':'.09')}
     if(!e.getAttribute('stroke')){e.setAttribute('stroke',`url(#${p}rim)`);e.setAttribute('stroke-width','3.5');e.setAttribute('stroke-opacity','.8')}}
    else e.setAttribute(a,`url(#${p}rim)`);continue}
   if(r==='dark'){e.setAttribute(a,'#0A0D1A');continue}
   const [fam,step]=r.split('.');e.setAttribute(a,neon(fam,step))}});
  add(`<filter id="${p}glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="26"/></filter>`+
   `<filter id="${p}soft" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="s"/>`+
   `<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/>`+
   `<feComposite in="g" in2="s" operator="in" result="gi"/><feBlend in="gi" in2="s" mode="overlay" result="b"/><feComposite in="b" in2="s" operator="in"/></filter>`);
  const body=[...svg.childNodes].filter(n=>n!==defs);
  const main=doc.createElementNS(NS,'g');main.setAttribute('filter',`url(#${p}soft)`);body.forEach(n=>main.appendChild(n));
  const glow=main.cloneNode(true);glow.setAttribute('filter',`url(#${p}glow)`);glow.setAttribute('opacity','.85');
  glow.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
  svg.appendChild(glow);svg.appendChild(main);
 }

 if(style==='stipple'){
  // Stipple: pointillist, risograph-bright color that dissolves into dots at the edges (Mason's refs,
  // 2026-09-26: the stippled mountain, the halftone figures, the dotted chair). Colors map by role to a
  // vivid print palette; the piece is blurred, then thresholded against noise so solid cores break into
  // scattered dots toward the edges; white glyphs stay crisp on top.
  svg.querySelectorAll('[filter]').forEach(e=>e.removeAttribute('filter'));
  const S={white:'#FFFFFF',paper:'#FFF4D6',surface:'#FFD83D',mid:'#F59BB6',dark:'#1C1B3F',
   'blue.heavy':'#1B35C9','blue.loud':'#2F5BFF','blue.soft':'#5D8BFF','blue.pale':'#A9C3FF',
   'purple.heavy':'#E0115F','purple.loud':'#FF2E7E','purple.soft':'#FF78A8','purple.pale':'#FFB6CE',
   'teal.heavy':'#0B8A57','teal.loud':'#12B36E','teal.soft':'#5FD39A','teal.pale':'#B4EDCF',
   'warm.heavy':'#F25C05','warm.loud':'#FF8A00','warm.soft':'#FFC700','warm.pale':'#FFE58A'};
  const top=[];
  shapes.forEach(e=>{for(const a of['fill','stroke']){const r=roleOfEl(e,a);if(!r)continue;
   e.setAttribute(a,S[r]||S[r.split('.')[0]+'.loud']||'#2F5BFF');e.removeAttribute(a+'-opacity');
   if(r==='white'&&a==='fill')top.push(e)}});
  add(`<filter id="${p}st" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">`+
   `<feGaussianBlur in="SourceGraphic" stdDeviation="7" result="bl"/>`+
   `<feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="cb"/>`+
   `<feColorMatrix in="cb" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 40 0" result="c1"/>`+
   `<feColorMatrix in="bl" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 40 0" result="c2"/>`+
   `<feMerge result="col"><feMergeNode in="c2"/><feMergeNode in="c1"/></feMerge>`+
   `<feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="1" seed="11" result="nz"/>`+
   `<feColorMatrix in="nz" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.8 0 0 0 -.42" result="na"/>`+
   `<feComposite in="bl" in2="na" operator="arithmetic" k2="1.2" k3="-1" k4="0" result="d"/>`+
   `<feComponentTransfer in="d" result="m"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>`+
   `<feComposite in="col" in2="m" operator="in"/></filter>`);
  const body=[...svg.childNodes].filter(n=>n!==defs);
  const g=doc.createElementNS(NS,'g');g.setAttribute('filter',`url(#${p}st)`);body.forEach(n=>g.appendChild(n));svg.appendChild(g);
  // white glyphs stay crisp above the dots
  const crisp=doc.createElementNS(NS,'g');top.forEach(e=>{const c=e.cloneNode(true);c.removeAttribute('id');let t=e.parentNode,tf=[];while(t&&t!==g&&t!==svg){if(t.getAttribute&&t.getAttribute('transform'))tf.unshift(t.getAttribute('transform'));t=t.parentNode}
   const w=doc.createElementNS(NS,'g');if(tf.length)w.setAttribute('transform',tf.join(' '));w.appendChild(c);crisp.appendChild(w)});
  svg.appendChild(crisp);
 }
 return new XMLSerializer().serializeToString(svg);
}

