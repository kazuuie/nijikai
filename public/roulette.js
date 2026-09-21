export const ORDER = Object.freeze([0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]);
export const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const TAU = Math.PI * 2;
export const STEP = TAU / 37;
export const DURATION = 10500;
export const CAPTURE_PROGRESS = .84;
const BOUNCE_START = .68;
const BOUNCE_FREQUENCY = 80;
export const BOUNCE_CONTACTS = Object.freeze(Array.from({length:Math.floor((1-BOUNCE_START)*BOUNCE_FREQUENCY/Math.PI)},(_,i)=>{
  const progress=BOUNCE_START+(i+1)*Math.PI/BOUNCE_FREQUENCY;
  return Object.freeze({progress,strength:Math.sin(Math.PI*(progress-BOUNCE_START)/(1-BOUNCE_START))});
}));
export function bounceHeight(progress) {
  return progress>BOUNCE_START&&progress<1
    ? Math.abs(Math.sin((progress-BOUNCE_START)*BOUNCE_FREQUENCY))*.16*Math.sin(Math.PI*(progress-BOUNCE_START)/(1-BOUNCE_START)) : 0;
}
export function colorOf(n) { return n === 0 ? 'green' : RED.has(n) ? 'red' : 'black'; }
export const colorNames = {red:'赤',black:'黒',green:'緑'};
export function randomNumber(source = a => crypto.getRandomValues(a)) {
  // Rejection sampling avoids the modulo bias of a 32-bit random integer.
  const limit = Math.floor(2 ** 32 / 37) * 37;
  const value = new Uint32Array(1);
  do { source(value); } while (value[0] >= limit);
  return value[0] % 37;
}
const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp(t); return t*t*(3-2*t); };
const ease = t => 1 - (1-t)**3;
const mod = (v, m) => (v % m + m) % m;
export function createSpin(number, wheelStart, ballStart, front = 0.15) {
  const slot = ORDER.indexOf(number);
  if (slot < 0) throw new Error('Invalid roulette number');
  const wheelEnd = wheelStart + 5*TAU + mod(front+slot*STEP-wheelStart, TAU);
  const captureWheel = wheelStart + (wheelEnd-wheelStart)*ease(CAPTURE_PROGRESS);
  const captureAngle = captureWheel - slot*STEP;
  const ballEnd = captureAngle - TAU * Math.ceil((captureAngle-ballStart)/TAU + 7);
  return {number,slot,wheelStart,wheelEnd,ballStart,ballEnd,captureWheel};
}
export function sampleSpin(spin, progress) {
  const t = clamp(progress);
  const wheel = spin.wheelStart + (spin.wheelEnd-spin.wheelStart)*ease(t);
  const drop = smooth((t-.59)/(CAPTURE_PROGRESS-.59));
  const settling = smooth((t-CAPTURE_PROGRESS)/(1-CAPTURE_PROGRESS));
  let angle = spin.ballStart + (spin.ballEnd-spin.ballStart)*ease(Math.min(1,t/CAPTURE_PROGRESS));
  if (t >= CAPTURE_PROGRESS) angle = spin.ballEnd + wheel-spin.captureWheel + Math.sin((t-CAPTURE_PROGRESS)*110)*.023*(1-settling);
  const bounce = bounceHeight(t);
  return {wheel,angle,radius:4.57+(3.22-4.57)*drop,height:.91+(.46-.91)*drop+bounce,done:t===1};
}
export function pocketAt(wheel, ballAngle) { return ORDER[mod(Math.round((wheel-ballAngle)/STEP),37)]; }
