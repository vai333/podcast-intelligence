// Point-cloud shapes for the home page story. Every shape has the same number of points so the scene can
// morph between them. Each point carries a surface normal whose length is its albedo (how bright the surface
// is), so the shader can light the cloud like a solid object. Pure and seeded: deterministic and unit-testable.
import { mulberry32, normal } from "@/lib/data/mock/rng";

export type Shape = "mic" | "guest" | "topics" | "sponsors";
export const SHAPES: Shape[] = ["mic", "guest", "topics", "sponsors"];

export interface Cloud {
  pos: Float32Array;
  /** Unit normal scaled by albedo (0..1). */
  nrm: Float32Array;
}

type V = [number, number, number];
type Rng = () => number;
interface Pt {
  p: V;
  n: V;
}

const TAU = Math.PI * 2;
const len = (v: V) => Math.hypot(v[0], v[1], v[2]) || 1;
const norm = (v: V): V => {
  const l = len(v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const scale = (v: V, s: number): V => [v[0] * s, v[1] * s, v[2] * s];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (r: Rng): V => norm([normal(r), normal(r), normal(r)]);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
/** Point with an outward normal (oriented away from `from`) and albedo. */
const pt = (p: V, n: V, albedo: number, from: V = [0, 0, 0]): Pt => {
  let u = norm(n);
  if (dot(u, sub(p, from)) < 0) u = scale(u, -1);
  return { p, n: scale(u, albedo) };
};
/** Pick an index from weights. */
const pick = (r: Rng, w: number[]) => {
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) <= 0) return i;
  return w.length - 1;
};

/* ------------------------------------------------------------------ */
/* Intro: a studio condenser microphone with sound waves               */
/* ------------------------------------------------------------------ */
function mic(n: number, r: Rng): Pt[] {
  const R = 0.36; // grille radius
  const out: Pt[] = [];
  const Y0 = 0.2; // vertical shift so the whole object is centred
  while (out.length < n) {
    const part = pick(r, [0.34, 0.04, 0.06, 0.25, 0.09, 0.04, 0.18]);
    if (part === 0) {
      // grille: a mesh of rings and meridians over a capsule (cylinder + dome)
      const onRing = r() < 0.55;
      const a = onRing ? r() * TAU : Math.round((r() * TAU) / (TAU / 36)) * (TAU / 36);
      const s = onRing ? Math.round(r() * 26) / 26 : r(); // 0..1 along the capsule profile
      const top = 0.55;
      let p: V;
      let c: V;
      if (s < 0.55) {
        const y = 0.06 + (s / 0.55) * (top - 0.06);
        p = [Math.cos(a) * R, y, Math.sin(a) * R];
        c = [0, y, 0];
      } else {
        const phi = ((s - 0.55) / 0.45) * (Math.PI / 2);
        p = [Math.cos(a) * R * Math.cos(phi), top + R * Math.sin(phi), Math.sin(a) * R * Math.cos(phi)];
        c = [0, top, 0];
      }
      out.push(pt([p[0], p[1] + Y0, p[2]], sub(p, c), 1));
    } else if (part === 1) {
      // diaphragm glimpsed through the grille
      const a = r() * TAU;
      const rad = Math.sqrt(r()) * 0.2;
      out.push(pt([Math.cos(a) * rad, 0.36 + Y0 + Math.sin(a) * rad, 0], [0, 0, 1], 0.55));
    } else if (part === 2) {
      // polished band between grille and body
      const a = r() * TAU;
      const y = -0.02 + r() * 0.08;
      out.push(pt([Math.cos(a) * (R + 0.012), y + Y0, Math.sin(a) * (R + 0.012)], [Math.cos(a), 0, Math.sin(a)], 1));
    } else if (part === 3) {
      // body: slightly tapered cylinder
      const a = r() * TAU;
      const y = -0.92 + r() * 0.9;
      const rad = 0.3 - 0.03 * smooth(-0.02, -0.92, y);
      out.push(pt([Math.cos(a) * rad, y + Y0, Math.sin(a) * rad], [Math.cos(a), 0.03, Math.sin(a)], 0.62));
    } else if (part === 4) {
      // shock mount: a ring around the body, held by two arms
      if (r() < 0.75) {
        const a = r() * TAU;
        const b = r() * TAU;
        const c: V = [Math.cos(a) * 0.5, -0.42, Math.sin(a) * 0.5];
        const p: V = [c[0] + Math.cos(a) * Math.cos(b) * 0.028, c[1] + Math.sin(b) * 0.028, c[2] + Math.sin(a) * Math.cos(b) * 0.028];
        out.push(pt([p[0], p[1] + Y0, p[2]], sub(p, c), 0.85));
      } else {
        const side = r() < 0.5 ? -1 : 1;
        const a = r() * TAU;
        const y = -0.42 - r() * 0.75;
        const c: V = [side * 0.52, y, 0];
        out.push(pt([c[0] + Math.cos(a) * 0.025, y + Y0, Math.sin(a) * 0.025], [Math.cos(a), 0, Math.sin(a)], 0.7, c));
      }
    } else if (part === 5) {
      // stand
      const a = r() * TAU;
      const y = -1.4 + r() * 0.5;
      out.push(pt([Math.cos(a) * 0.05, y + Y0, Math.sin(a) * 0.05], [Math.cos(a), 0, Math.sin(a)], 0.55));
    } else {
      // sound waves: arcs radiating to both sides of the grille, like ((( )))
      const side = r() < 0.5 ? -1 : 1;
      const ring = Math.floor(r() * 3);
      const rad = 0.6 + ring * 0.2 + normal(r) * 0.004;
      const spread = 0.62 - ring * 0.06;
      const a = (r() * 2 - 1) * spread;
      if (r() > 1 - Math.abs(a / spread) ** 3 + 0.05) continue; // thin out towards the tips
      const zc = normal(r) * 0.012;
      const cy = 0.34;
      const p: V = [side * Math.cos(a) * rad, cy + Math.sin(a) * rad + Y0, zc];
      out.push(pt(p, [side * Math.cos(a), Math.sin(a), 0.35], 0.9 - ring * 0.15, [0, cy + Y0, 0]));
    }
  }
  // a little smaller so the stand fits on screen
  return out.map(({ p, n }) => ({ p: scale(p, 0.86), n }));
}

/* ------------------------------------------------------------------ */
/* Guests: a man's head, as in a construction drawing                 */
/* ------------------------------------------------------------------ */
// The head is a signed distance field (SDF): simple 3D primitives blended together. Points are sampled on its
// surface and the SDF gradient gives exact normals.
// Units: the head is about 1.2 tall; x right, y up, z towards the viewer.

const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
/** Smooth union. */
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
/** Smooth subtraction of b from a. */
const ssub = (a: number, b: number, k: number) => -smin(-a, b, k);
/** Ellipsoid (approximate distance). */
const ell = (x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) => {
  const px = x - cx;
  const py = y - cy;
  const pz = z - cz;
  const k0 = len3(px / rx, py / ry, pz / rz);
  const k1 = len3(px / (rx * rx), py / (ry * ry), pz / (rz * rz)) || 1e-9;
  return (k0 * (k0 - 1)) / k1;
};
/** Capsule from a to b whose radius goes from r1 to r2. */
const cap = (x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r1: number, r2: number) => {
  const pax = x - ax;
  const pay = y - ay;
  const paz = z - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const h = clamp01((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - (r1 + (r2 - r1) * h);
};
/** Smooth intersection. */
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

// Modelled on a classic construction drawing of a man's head (Loomis method): a round, bald cranium with
// flattened side planes, a strong brow, open eyelids without pupils, an angular nose, cheekbones and a jaw
// with crisp planes, a defined chin, the ear on the side plane and a neck with its two diagonal muscles.
// Crown y=0.66, brow y=0.04, nose base y=-0.33, chin y=-0.7: a long, lean face with a forward chin.
const EYE_X = 0.168;
const EYE_Y = -0.06;
const EYE_Z = 0.31;
const EYE_R = 0.058;
const SIDE_X = 0.41; // the flattened side plane of the cranium (broad at the temples)

function headSdf(x: number, y: number, z: number): number {
  const ax = Math.abs(x); // the head is symmetric
  // cranium: a ball with its sides sliced flat
  let d = ell(x, y, z, 0, 0.14, -0.08, 0.46, 0.52, 0.55);
  d = smax(d, ax - SIDE_X, 0.1);
  // face mass, with flat front-to-side planes running down from the cheekbones
  let face = ell(x, y, z, 0, -0.32, 0.08, 0.35, 0.38, 0.33);
  face = smax(face, ax * 0.78 + z * 0.63 - 0.41, 0.04);
  d = smin(d, face, 0.1);
  // jaw: a crisp line from the angle of the jaw below the ear to the corners of the chin
  d = smin(d, cap(ax, y, z, 0.35, -0.4, -0.1, 0.11, -0.645, 0.22, 0.065, 0.055), 0.04);
  d = smin(d, ell(x, y, z, 0, -0.63, 0.25, 0.115, 0.07, 0.085), 0.035); // chin, projecting forward
  // cheekbones: a sharp ridge from below the eye towards the ear
  d = smin(d, cap(ax, y, z, 0.2, -0.13, 0.3, 0.36, -0.12, 0.08, 0.04, 0.03), 0.04);
  // brow ridge, meeting at the bridge of the nose
  d = smin(d, cap(ax, y, z, 0.0, 0.045, 0.425, 0.32, 0.035, 0.33, 0.045, 0.03), 0.035);
  // eyes: socket, eyeball, and the upper and lower lids (drawn open, without pupils)
  d = ssub(d, ell(ax, y, z, EYE_X, EYE_Y + 0.01, 0.39, 0.09, 0.055, 0.055), 0.04);
  d = smin(d, len3(ax - EYE_X, y - EYE_Y, z - EYE_Z) - EYE_R, 0.012);
  d = smin(d, ell(ax, y, z, EYE_X, EYE_Y + 0.03, 0.335, 0.072, 0.03, 0.05), 0.01);
  d = smin(d, ell(ax, y, z, EYE_X, EYE_Y - 0.04, 0.33, 0.065, 0.017, 0.045), 0.01);
  // nose: straight bridge, angular tip, nostril wings
  d = smin(d, cap(x, y, z, 0, -0.07, 0.38, 0, -0.29, 0.5, 0.026, 0.042), 0.04);
  d = smin(d, len3(x, y + 0.305, z - 0.475) - 0.05, 0.025);
  d = smin(d, ell(ax, y, z, 0.064, -0.33, 0.41, 0.045, 0.033, 0.045), 0.025);
  // lips, with the line of the mouth cut between them
  d = smin(d, cap(ax, y, z, 0, -0.44, 0.4, 0.1, -0.455, 0.355, 0.024, 0.009), 0.025);
  d = smin(d, cap(ax, y, z, 0, -0.495, 0.39, 0.09, -0.478, 0.35, 0.03, 0.01), 0.025);
  d = ssub(d, cap(ax, y, z, 0, -0.467, 0.44, 0.11, -0.467, 0.365, 0.008, 0.006), 0.012);
  // ears on the side plane, from brow height to the base of the nose, leaning back slightly
  d = smin(d, ell(ax, y, z + 0.22 * (y + 0.15), SIDE_X + 0.03, -0.15, -0.1, 0.04, 0.16, 0.085), 0.035);
  return d;
}

/** Head and neck. The neck has the two muscles running from behind the ears to the collarbone notch, and it
 *  fades out at the bottom. No shoulders. */
function bustSdf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  // set back under the skull, so the jaw and chin stand clear in front of it
  let neck = cap(x, y, z, 0, -0.32, -0.18, 0, -1.05, -0.06, 0.21, 0.24);
  if (y < -0.2) {
    neck = smin(neck, cap(ax, y, z, 0.26, -0.32, -0.22, 0.05, -1.02, 0.15, 0.06, 0.05), 0.05); // neck muscles
    neck = smin(neck, ell(x, y, z, 0, -0.84, 0.13, 0.04, 0.05, 0.035), 0.03); // Adam's apple
  }
  return y > -0.8 ? smin(headSdf(x, y, z), neck, 0.035) : neck;
}

/** Gradient of the field (central differences); its direction is the outward normal. */
const grad = (f: (x: number, y: number, z: number) => number, x: number, y: number, z: number, e = 0.002): V => [
  f(x + e, y, z) - f(x - e, y, z),
  f(x, y + e, z) - f(x, y - e, z),
  f(x, y, z + e) - f(x, y, z - e),
];

/** Buzz cut: a natural hairline a fifth of the way down, slightly receded at the temples, short at the
 *  sides down to the top of the ears and to the nape at the back. The ears stay bare. */
function hairAt(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  const front = 0.42 + 0.06 * smooth(0.1, 0.26, ax);
  const sideLine = 0.03;
  const back = -0.42;
  const line = z > 0.15 ? sideLine + (front - sideLine) * smooth(0.15, 0.32, z) : back + (sideLine - back) * smooth(-0.32, 0.15, z);
  const ear = ax > 0.36 && y < 0.05 && y > -0.34 && z > -0.22 && z < 0.08 ? 0 : 1;
  return smooth(line - 0.025, line + 0.025, y) * ear;
}

/** March from p along dir until the surface is reached. */
function toSurface(p: V, dir: V): V {
  let [x, y, z] = p;
  for (let i = 0; i < 40; i++) {
    const d = bustSdf(x, y, z);
    if (Math.abs(d) < 5e-4) break;
    x += dir[0] * d;
    y += dir[1] * d;
    z += dir[2] * d;
  }
  return [x, y, z];
}

/** The construction lines of the drawing: centre line, brow line and the circle on the side plane. */
function guideLine(r: Rng): V {
  const k = r();
  if (k < 0.4) {
    // centre line: over the crown and down the middle of the face to the chin
    const a = -0.1 + r() * 2.15; // angle from +z, through +y
    const dir: V = [0, Math.sin(a), Math.cos(a)];
    return toSurface(scale(dir, 1.3), scale(dir, -1));
  }
  if (k < 0.75) {
    // brow line: around the head at brow height
    const t = -0.9 + r() * 2.5;
    const dir: V = [Math.sin(t), 0, Math.cos(t)];
    return toSurface([dir[0] * 1.3, 0.04, dir[2] * 1.3], scale(dir, -1));
  }
  // the circle on the right side plane
  const a = r() * TAU;
  return toSurface([1, 0.12 + Math.sin(a) * 0.27, -0.1 + Math.cos(a) * 0.27], [-1, 0, 0]);
}

/** Project a point drawn on the front of the face onto the surface. */
const front = (x: number, y: number): V => toSurface([x, y, 1], [0, 0, -1]);
/** Project a point drawn on the side of the head onto the surface (side = +1 right, -1 left). */
const side = (sgn: number, y: number, z: number): V => toSurface([sgn, y, z], [-sgn, 0, 0]);
/** Project towards a feature from outside, along direction o. */
const from = (q: V, o: V): V => toSurface([q[0] + o[0] * 0.4, q[1] + o[1] * 0.4, q[2] + o[2] * 0.4], scale(o, -1));

/** The feature lines of the drawing, like pencil strokes: brows, eyelids, nose, nostrils, lips, jaw, chin,
 *  ears and the neck muscles. */
function stroke(r: Rng): V {
  const sgn = r() < 0.5 ? -1 : 1;
  const j = () => normal(r) * 0.004; // pencil width
  const k = pick(r, [14, 13, 6, 4, 6, 5, 10, 9, 5, 9, 8, 4]);
  const t = r();
  switch (k) {
    case 0: {
      // eyebrow: a soft arch, thicker towards the middle of the face
      const x = 0.06 + t * 0.26;
      return front(sgn * x, 0.058 + 0.02 * Math.sin(Math.PI * t) - 0.015 * t + normal(r) * 0.009 * (1 - t * 0.5));
    }
    case 1: {
      // upper eyelid: an almond, highest towards the inner corner, the outer corner slightly lower
      const a = t * Math.PI;
      const x = Math.cos(a); // +1 outer corner, -1 inner corner
      return front(sgn * (EYE_X + 0.07 * x), EYE_Y + 0.002 + 0.028 * Math.sin(a) ** 0.8 - 0.006 * x + j());
    }
    case 2: {
      // eyelid crease, following the lid a little higher and fading towards the inner corner
      const a = 0.15 + t * (Math.PI - 0.9);
      return front(sgn * (EYE_X + 0.07 * Math.cos(a)), EYE_Y + 0.022 + 0.026 * Math.sin(a) ** 0.8 + j());
    }
    case 3: {
      // lower eyelid: a light, open stroke under the outer half
      const a = Math.PI + 0.9 + t * (Math.PI - 1.2);
      return front(sgn * (EYE_X + 0.064 * Math.cos(a)), EYE_Y - 0.004 + 0.016 * Math.sin(a) + j());
    }
    case 4:
      // side of the nose bridge
      return front(sgn * (0.033 + t * 0.03) + j(), -0.1 - t * 0.17);
    case 5: {
      // nostril wing
      const a = Math.PI * 0.85 + t * Math.PI * 1.15;
      return front(sgn * (0.064 + 0.04 * Math.cos(a)), -0.335 + 0.032 * Math.sin(a) + j());
    }
    case 6: {
      // mouth line, with the upper lip outline (a gentle bow) and the lower lip edge
      const x = (t * 2 - 1) * 0.115;
      const which = r();
      if (which < 0.5) return front(x, -0.467 + 0.008 * Math.cos((Math.PI * x) / 0.115) + j());
      if (which < 0.78) return front(x * 0.9, -0.425 - 0.02 * (Math.abs(x) / 0.115) ** 1.4 + 0.004 * Math.cos((x / 0.03) * Math.PI) + j());
      return front(x * 0.65, -0.522 + 0.022 * (x / 0.075) ** 2 + j());
    }
    case 7: {
      // jaw line, from below the ear to the chin
      const q: V = [sgn * (0.35 - t * 0.24), -0.4 - t * 0.245, -0.1 + t * 0.32];
      return from(q, norm([sgn * 0.6, -0.75, 0.25]));
    }
    case 8:
      // chin
      return front((t * 2 - 1) * 0.1, -0.68 + 0.02 * (t * 2 - 1) ** 2 + j());
    case 9: {
      // ear rim
      const a = t * TAU;
      const y = -0.15 + 0.15 * Math.sin(a);
      return side(sgn, y, -0.1 - 0.22 * (y + 0.15) + 0.078 * Math.cos(a)); // ear rim
    }
    case 10: {
      // neck muscles, from behind the ear down to the collarbone notch
      const u = 0.12 + t * 0.75;
      const q: V = [sgn * (0.26 - u * 0.21), -0.32 - u * 0.7, -0.22 + u * 0.37];
      return from(q, norm([sgn * 0.55, 0, 0.83]));
    }
    default: {
      // cheek plane: from under the cheekbone, diagonally down towards the corner of the mouth
      return front(sgn * (0.28 - t * 0.11), -0.17 - t * 0.25 + j());
    }
  }
}

// Albedo above 1 marks a line for the shader: 1.25 = feature stroke (bright), 1.5 = construction line (accent).
const STROKE = 1.25;
const GUIDE = 1.5;

function guest(n: number, r: Rng): Pt[] {
  const out: Pt[] = [];
  const S = 1.12; // display scale
  const HY = 0.15; // lift so the head sits in the middle of the frame
  const SHELL = 0.06;
  const strokes = Math.floor(n * 0.12);
  const guides = Math.floor(n * 0.04);
  const put = (p: V, albedo: number, lift = 0) => {
    const g = norm(grad(bustSdf, p[0], p[1], p[2]));
    out.push({ p: [(p[0] + g[0] * lift) * S, (p[1] + g[1] * lift) * S + HY, (p[2] + g[2] * lift) * S], n: scale(g, albedo) });
  };
  while (out.length < n - strokes - guides) {
    // sample near the surface, then project onto it
    let x = (r() * 2 - 1) * 0.55;
    let y = -1.05 + r() * 1.78;
    let z = -0.66 + r() * 1.3;
    if (y < -0.62 && Math.abs(x) > 0.34) continue; // only the neck down there
    // where detail matters most: every point on the face, fewer on the back of the head and the neck
    const keep = y > -0.62 ? (z > 0.1 ? 1 : 0.7) : 0.65 * smooth(-1.05, -0.72, y);
    if (r() > keep) continue;
    const d0 = bustSdf(x, y, z);
    if (Math.abs(d0) > SHELL) continue;
    for (let it = 0, dd = d0; it < 2; it++, dd = bustSdf(x, y, z)) {
      const g = norm(grad(bustSdf, x, y, z));
      x -= g[0] * dd;
      y -= g[1] * dd;
      z -= g[2] * dd;
    }
    if (Math.abs(bustSdf(x, y, z)) > 0.004) continue;
    // an evenly toned face, a little dimmer than the strokes; the eyes slightly darker than the lids
    const onEye = len3(Math.abs(x) - EYE_X, y - EYE_Y, z - EYE_Z) < EYE_R + 0.006;
    const hair = y > -0.45 ? hairAt(x, y, z) : 0;
    if (hair > 0.5) {
      // buzz cut: darker, denser, and a fine fuzz just off the scalp
      put([x, y, z], 0.2, r() * 0.008);
      if (r() < 0.8) put([x, y, z], 0.24, 0.005 + r() * 0.014);
    } else {
      put([x, y, z], onEye ? 0.5 : 0.72 - 0.3 * hair);
    }
  }
  while (out.length < n - guides) {
    const p = stroke(r);
    if (Math.abs(bustSdf(p[0], p[1], p[2])) < 0.003) put(p, STROKE, 0.004);
  }
  while (out.length < n) {
    const p = guideLine(r);
    if (Math.abs(bustSdf(p[0], p[1], p[2])) < 0.003) put(p, GUIDE, 0.006 + normal(r) * 0.0015);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Topics: a network globe of topic clusters                            */
/* ------------------------------------------------------------------ */
function topics(n: number, r: Rng): Pt[] {
  const N = 16;
  const nodes = Array.from({ length: N }, (_, i) => {
    const y = 1 - ((i + 0.5) / N) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    const j = 0.92 + r() * 0.16;
    return { c: [Math.cos(th) * rad * j, y * j, Math.sin(th) * rad * j] as V, size: 0.045 + r() * r() * 0.09 };
  });
  const edges: [number, number][] = [];
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: len(sub(a.c, b.c)) }))
      .filter((x) => x.j > i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 3)
      .forEach((x) => edges.push([i, x.j]));
  });
  const out: Pt[] = [];
  while (out.length < n) {
    const part = pick(r, [0.42, 0.3, 0.2, 0.08]);
    if (part === 0) {
      // topic nodes: solid little spheres, bigger for bigger topics
      const k = pick(r, nodes.map((x) => x.size * x.size));
      const { c, size } = nodes[k];
      const d = unit(r);
      out.push(pt([c[0] + d[0] * size, c[1] + d[1] * size, c[2] + d[2] * size], d, 1));
    } else if (part === 1) {
      // links: great-circle arcs between related topics
      const [i, j] = edges[Math.floor(r() * edges.length)];
      const A = nodes[i].c;
      const B = nodes[j].c;
      const t = r();
      const m: V = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
      const lift = 1 + 0.12 * Math.sin(Math.PI * t);
      const p = scale(norm(m), (len(A) + (len(B) - len(A)) * t) * lift);
      out.push(pt(p, p, 0.75));
    } else if (part === 2) {
      // graticule: faint latitude and longitude lines of the globe
      const d = unit(r);
      const lat = Math.asin(d[1]);
      const lon = Math.atan2(d[2], d[0]);
      const onLat = Math.abs(lat / (Math.PI / 10) - Math.round(lat / (Math.PI / 10))) < 0.03;
      const onLon = Math.abs(lon / (Math.PI / 9) - Math.round(lon / (Math.PI / 9))) < 0.03 * (1 / Math.max(Math.cos(lat), 0.2));
      if (!onLat && !onLon) continue;
      out.push(pt(scale(d, 0.86), d, 0.4));
    } else {
      // signal dust drifting between topics
      const d = unit(r);
      out.push(pt(scale(d, 0.3 + r() * 1.1), d, 0.35));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sponsors: a broadcast beacon with expanding rings                    */
/* ------------------------------------------------------------------ */
function sponsors(n: number, r: Rng): Pt[] {
  const tilt = 1.1;
  const [ct, st] = [Math.cos(tilt), Math.sin(tilt)];
  const tiltV = (v: V): V => [v[0], v[1] * ct - v[2] * st, v[1] * st + v[2] * ct];
  const out: Pt[] = [];
  while (out.length < n) {
    const part = pick(r, [0.6, 0.16, 0.1, 0.14]);
    let p: V;
    let nr: V;
    let albedo = 1;
    if (part === 0) {
      // rings: crisp, with HUD-style dashed segments on some
      const ring = Math.floor(r() * 8);
      const rad = 0.3 + ring * 0.16 + normal(r) * 0.003;
      const a = r() * TAU;
      if (ring % 3 === 1 && Math.sin(a * (12 + ring * 2)) < -0.2) continue;
      if (ring % 3 === 2 && Math.sin(a * 3 + ring) < -0.6) continue;
      p = [Math.cos(a) * rad, 0, Math.sin(a) * rad];
      nr = [Math.cos(a), 0.5, Math.sin(a)];
      albedo = 1 - ring * 0.07;
    } else if (part === 1) {
      // beacon core: a faceted sphere
      const d = unit(r);
      p = scale(d, 0.17);
      nr = d;
    } else if (part === 2) {
      // mast rising out of the core
      const y = r() * 0.95;
      const a = r() * TAU;
      const rad = 0.03 * (1 - y);
      p = [Math.cos(a) * rad, y, Math.sin(a) * rad];
      nr = [Math.cos(a), 0, Math.sin(a)];
      albedo = 0.8;
    } else {
      // radial spokes
      const k = Math.floor(r() * 16);
      const a = (k / 16) * TAU;
      const rad = 0.3 + r() * 1.12;
      p = [Math.cos(a) * rad, normal(r) * 0.004, Math.sin(a) * rad];
      nr = [Math.cos(a), 0.4, Math.sin(a)];
      albedo = 0.55;
    }
    out.push(pt(tiltV(p), tiltV(nr), albedo));
  }
  return out;
}

/* ------------------------------------------------------------------ */

/** Order points along a Morton (Z-order) curve, so point i of one shape sits near point i of the next and
 *  the morph flows instead of scrambling. */
function mortonSort(pts: Pt[]): Pt[] {
  const lo: V = [Infinity, Infinity, Infinity];
  const hi: V = [-Infinity, -Infinity, -Infinity];
  for (const { p } of pts) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p[k]);
      hi[k] = Math.max(hi[k], p[k]);
    }
  }
  const spread = (v: number) => {
    let x = v & 0x3ff;
    x = (x | (x << 16)) & 0x030000ff;
    x = (x | (x << 8)) & 0x0300f00f;
    x = (x | (x << 4)) & 0x030c30c3;
    x = (x | (x << 2)) & 0x09249249;
    return x;
  };
  const q = (v: number, k: number) => Math.floor(((v - lo[k]) / (hi[k] - lo[k] || 1)) * 1023);
  const keyed = pts.map((x) => ({ x, k: spread(q(x.p[0], 0)) | (spread(q(x.p[1], 1)) << 1) | (spread(q(x.p[2], 2)) << 2) }));
  keyed.sort((a, b) => a.k - b.k);
  return keyed.map((e) => e.x);
}

export function buildShapes(count: number, seed = 7): Record<Shape, Cloud> {
  const make = (fn: (n: number, r: Rng) => Pt[], s: number): Cloud => {
    const pts = mortonSort(fn(count, mulberry32(seed + s)).slice(0, count));
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    pts.forEach((x, i) => {
      pos.set(x.p, i * 3);
      nrm.set(x.n, i * 3);
    });
    return { pos, nrm };
  };
  return { mic: make(mic, 1), guest: make(guest, 2), topics: make(topics, 3), sponsors: make(sponsors, 4) };
}
