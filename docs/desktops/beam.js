/* Beam: a rainbow glow that rides the border of anything Copilot touches.

   Inspired by libraries.dev/beam, built our own way. Each beam is a conic
   gradient ring masked down to the element's border, plus a blurred copy of
   that ring for the bloom. One animation loop drives every beam and eases
   its speed toward a target, so a beam can speed up while Copilot works or
   surge as you type without the angle ever jumping.

   beam(el, { on, hover, speed, width })  attach a beam (once per element)
   beamOn(el, speed, hold)                show it; hold keeps it on past hover
   beamOff(el)                            fade it out
   beamSpeed(el, speed)                   ease to a new speed (degrees/second)
   beamBoost(el, speed, ms)               a short surge, then back
   beamLap(el, speed)                     one trip around, then fade out */

const BEAM_SET = new Set();
function beam(el, opts = {}) {
  if (el._beam && el._beam.s.isConnected) return el._beam;
  const s = document.createElement('span');
  s.className = 'beam'; s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<i class="ring"></i><span class="bloom"><i class="ring"></i></span>';
  el.appendChild(s);
  const b = el._beam = { el, s, a: Math.random() * 360, v: 0, base: opts.speed || 120, target: 0, on: false, hold: false, lap: null, boost: 0 };
  if (opts.width) s.style.setProperty('--beam-w', opts.width + 'px');
  if (opts.hover && !el._beamHover) {
    el._beamHover = true;
    el.addEventListener('pointerenter', () => { const x = beam(el, opts); if (!x.hold) beamOn(el, x.base * 1.8); });
    el.addEventListener('pointerleave', () => { const x = el._beam; if (x && !x.hold && x.lap == null) beamOff(el); });
  }
  if (opts.on) beamOn(el, b.base, true);
  BEAM_SET.add(b);
  return b;
}
function beamOn(el, speed, hold = false) {
  const b = beam(el); b.on = true; b.hold = b.hold || hold; b.lap = null;
  b.target = speed || b.base; b.s.classList.add('on');
}
function beamOff(el) {
  const b = el._beam; if (!b) return;
  b.on = false; b.hold = false; b.lap = null; b.target = b.base * .5; b.s.classList.remove('on');
}
function beamSpeed(el, speed) { const b = el._beam; if (b) b.target = speed || b.base; }
function beamBoost(el, speed = 640, ms = 450) {
  const b = el._beam; if (!b) return;
  b.boost = speed; clearTimeout(b.boostT); b.boostT = setTimeout(() => { b.boost = 0; }, ms);
}
function beamLap(el, speed = 380) {
  const b = beam(el); b.on = true; b.target = speed; b.v = Math.max(b.v, speed * .6); b.lap = 360;
  b.s.classList.add('on');
}

let beamClock = performance.now();
(function beamTick(now) {
  const dt = Math.min(.05, (now - beamClock) / 1000); beamClock = now;
  for (const b of BEAM_SET) {
    if (!b.s.isConnected) { BEAM_SET.delete(b); continue; }
    const tgt = b.boost || b.target;
    b.v += (tgt - b.v) * Math.min(1, dt * 5);
    const d = b.v * dt; b.a = (b.a + d) % 360;
    if (b.lap != null) { b.lap -= d; if (b.lap <= 0) { const keep = b.hold; beamOff(b.el); if (keep) beamOn(b.el, b.base, true); } }
    b.s.style.setProperty('--beam-a', b.a.toFixed(1) + 'deg');
  }
  requestAnimationFrame(beamTick);
})(beamClock);
