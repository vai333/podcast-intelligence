// WebGL particle scene for the home page. three.js is imported dynamically so it never loads unless the
// scene actually starts. Positions and normals for the four shapes live in vertex attributes; one uniform
// (uP, 0..3) morphs between them entirely on the GPU, so scrolling stays smooth.
// Each particle is lit like a point on a solid surface (key light, fill, rim), back-facing points are dimmed,
// and a sparse glow pass plus far-away stars give depth. Light theme draws the same cloud like ink on paper.
import { buildShapes, SHAPES, type Cloud, type Shape } from "./shapes";

export interface SceneHandle {
  dispose(): void;
}

const VERT = /* glsl */ `
attribute vec3 p1; attribute vec3 p2; attribute vec3 p3;
attribute vec3 n0; attribute vec3 n1; attribute vec3 n2; attribute vec3 n3;
attribute float aSeed;
uniform float uP; uniform float uTime; uniform float uSize; uniform float uSizeK; uniform float uPixel; uniform float uIntro; uniform float uScan;
varying float vLight; varying float vRim; varying float vAlpha; varying float vScan; varying float vSeed; varying float vStroke; varying float vGuide;
vec3 pickP(int i){ if(i==0) return position; if(i==1) return p1; if(i==2) return p2; return p3; }
vec3 pickN(int i){ if(i==0) return n0; if(i==1) return n1; if(i==2) return n2; return n3; }
void main(){
  float f = floor(uP);
  float t = smoothstep(0.0, 1.0, uP - f);
  int i = int(f); int j = min(i + 1, 3);
  vec3 pos = mix(pickP(i), pickP(j), t);
  vec3 nr = mix(pickN(i), pickN(j), t);
  float albedo = length(nr);
  vec3 n = nr / max(albedo, 1e-4);
  // albedo above 1 marks drawn lines on the guest's head: 1.25 = feature stroke, 1.5 = construction line
  float stroke = smoothstep(1.1, 1.2, albedo) * (1.0 - smoothstep(1.35, 1.45, albedo));
  float guide = smoothstep(1.35, 1.45, albedo);
  albedo = min(albedo, 1.0);

  // while morphing, particles lift off into a swirl of dust and regroup
  float k = sin(3.14159 * t);
  vec3 swirl = vec3(sin(aSeed * 37.0 + uTime * 0.9 + pos.y * 2.0), cos(aSeed * 71.0 + uTime * 1.1 + pos.x * 2.0), sin(aSeed * 53.0 - uTime * 0.8 + pos.z * 2.0));
  pos += swirl * 0.42 * k;
  // tiny idle shimmer so the surface feels alive
  pos += n * 0.006 * sin(uTime * 2.0 + aSeed * 40.0);
  // first appearance: particles fly in from far away
  vec3 far = normalize(vec3(sin(aSeed * 91.0), cos(aSeed * 57.0), sin(aSeed * 23.0 + 1.0))) * (2.5 + aSeed * 4.0);
  pos = mix(pos, far, uIntro);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 vn = normalize(mat3(modelViewMatrix) * n);
  vec3 view = normalize(-mv.xyz);
  float facing = dot(vn, view);
  float key = max(dot(vn, normalize(vec3(-0.5, 0.42, 0.76))), 0.0); // portrait key: front-left, slightly above
  float fill = max(dot(vn, normalize(vec3(0.8, -0.1, 0.45))), 0.0) * 0.18;
  float lit = (0.06 + key * 1.15 + fill) * albedo;
  float rim = pow(1.0 - clamp(facing, 0.0, 1.0), 3.0) * step(0.0, facing + 0.15);

  float flat_ = max(k, uIntro);
  vLight = mix(lit, 0.75, flat_);
  vRim = rim * (1.0 - flat_);
  // lines read like pencil on paper: always bright, whatever the lighting (they still hide on the far side)
  vStroke = stroke * (1.0 - flat_);
  vGuide = guide * (1.0 - flat_);
  vLight = mix(vLight, 1.35, max(vStroke, vGuide));
  vRim *= 1.0 - max(vStroke, vGuide);
  // the far side of a solid is mostly hidden
  float front = mix(0.1, 1.0, smoothstep(-0.25, 0.2, facing));
  // depth cue: farther points are dimmer
  float depth = clamp((-mv.z - 3.6) / 1.8, 0.0, 1.0);
  vAlpha = mix(front, 1.0, flat_) * mix(1.0, 0.55, depth);
  vScan = exp(-pow((pos.y - uScan) / 0.03, 2.0)) * (1.0 - flat_);
  vSeed = aSeed;

  float size = uSize * uSizeK * uPixel * (0.75 + aSeed * 0.5) * (1.0 + 0.9 * k + 1.5 * uIntro) / -mv.z;
#ifdef GLOW
  size *= 5.0;
#endif
  gl_PointSize = clamp(size, 1.0, 64.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uBase; uniform vec3 uShade; uniform vec3 uAccent; uniform float uAlpha; uniform float uInk;
varying float vLight; varying float vRim; varying float vAlpha; varying float vScan; varying float vSeed; varying float vStroke; varying float vGuide;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
#ifdef GLOW
  float a = exp(-d * d * 22.0) * 0.06;
  vec3 c = mix(uBase, uAccent, 0.65) * vLight;
#else
  // crisp disc with a slightly hotter centre
  float a = 1.0 - smoothstep(0.32, 0.5, d);
  float lightC = clamp(vLight, 0.0, 1.4);
  vec3 c = uBase * lightC * (1.0 + 0.25 * (1.0 - d * 2.0));
  c = mix(c, uAccent * 1.15, clamp(vRim * 0.95 + step(vSeed, 0.035) * 0.8, 0.0, 1.0));
  c = mix(c, uAccent * 1.4, vScan * 0.9);
  c = mix(c, uAccent * 1.25, vGuide);
  // light theme: solid ink dots. Shadows are near-black, lit surfaces a warm grey, edges in the accent,
  // so the form reads by tone while every dot stays clearly visible on the pale background.
  vec3 ink = mix(uBase, uShade, clamp(vLight * 0.95, 0.0, 1.0));
  ink = mix(ink, uAccent, clamp(vRim * 0.9 + step(vSeed, 0.035) * 0.8, 0.0, 1.0));
  ink = mix(ink, uAccent, vScan);
  ink = mix(ink, uBase, vStroke);
  ink = mix(ink, uAccent, vGuide);
  c = mix(c, ink, uInk);
  a *= mix(1.0, mix(0.62 + 0.38 * clamp(1.15 - vLight * 0.85, 0.0, 1.0), 1.0, max(vStroke, vGuide)), uInk);
#endif
  gl_FragColor = vec4(c, a * vAlpha * uAlpha);
}`;

/** Generate the shapes in a worker; fall back to the main thread if workers are unavailable. */
function buildShapesAsync(count: number): Promise<Record<Shape, Cloud>> {
  return new Promise((resolve) => {
    try {
      const w = new Worker(new URL("./shapes.worker.ts", import.meta.url));
      w.onmessage = (e: MessageEvent<Record<Shape, Cloud>>) => {
        resolve(e.data);
        w.terminate();
      };
      w.onerror = () => {
        w.terminate();
        resolve(buildShapes(count));
      };
      w.postMessage({ count });
    } catch {
      resolve(buildShapes(count));
    }
  });
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export async function mountScene(canvas: HTMLCanvasElement, getTarget: () => number, count: number): Promise<SceneHandle | null> {
  const [THREE, shapes] = await Promise.all([import("three"), buildShapesAsync(count)]);
  let renderer: InstanceType<typeof THREE.WebGLRenderer>;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null; // no WebGL: the caller falls back to the plain layout
  }
  renderer.setClearColor(0x000000, 0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(shapes[SHAPES[0]].pos, 3));
  SHAPES.forEach((s, i) => {
    if (i > 0) geo.setAttribute(`p${i}`, new THREE.BufferAttribute(shapes[s].pos, 3));
    geo.setAttribute(`n${i}`, new THREE.BufferAttribute(shapes[s].nrm, 3));
  });
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    seeds[i] = x - Math.floor(x);
  }
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const uniforms = {
    uP: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: 5.2 },
    uPixel: { value: 1 },
    uIntro: { value: 1 },
    uScan: { value: -3 },
    uBase: { value: new THREE.Color() },
    uAccent: { value: new THREE.Color() },
    uAlpha: { value: 1 },
    uInk: { value: 0 },
    uShade: { value: new THREE.Color() },
    uSizeK: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, uniforms });
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    defines: { GLOW: 1 },
    uniforms,
  });

  // the glow pass uses every 4th particle (spread evenly, since points are in spatial order)
  const glowGeo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) glowGeo.setAttribute(name, attr);
  const idx = new Uint32Array(Math.floor(count / 4));
  for (let i = 0; i < idx.length; i++) idx[i] = i * 4;
  glowGeo.setIndex(new THREE.BufferAttribute(idx, 1));

  // distant stars for depth
  const STARS = 1400;
  const starPos = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    const u = Math.sin(i * 78.233) * 43758.5453;
    const v = Math.sin(i * 39.425) * 24634.6345;
    const w = Math.sin(i * 11.135) * 12345.678;
    const th = (u - Math.floor(u)) * Math.PI * 2;
    const z = (v - Math.floor(v)) * 2 - 1;
    const rad = 6 + (w - Math.floor(w)) * 8;
    const s = Math.sqrt(1 - z * z);
    starPos.set([Math.cos(th) * s * rad, z * rad * 0.6, Math.sin(th) * s * rad - 4], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, transparent: true, depthWrite: false });

  const applyTheme = () => {
    const dark = document.documentElement.classList.contains("dark");
    uniforms.uAccent.value.set(css("--accent") || "#ff6a2b");
    uniforms.uBase.value.set(dark ? "#f4f1ec" : "#0c0a09");
    uniforms.uShade.value.set("#8f857c");
    uniforms.uAlpha.value = dark ? 0.82 : 0.95;
    // on a pale background dots do not add up into light, so they are drawn larger and opaque
    uniforms.uSizeK.value = dark ? 1 : 1.35;
    uniforms.uInk.value = dark ? 0 : 1;
    mat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.needsUpdate = true;
    glow.visible = dark;
    starMat.color.set(dark ? "#ffffff" : "#44403c");
    starMat.opacity = dark ? 0.35 : 0.45;
  };

  const points = new THREE.Points(geo, mat);
  const glow = new THREE.Points(glowGeo, glowMat);
  const stars = new THREE.Points(starGeo, starMat);
  for (const o of [points, glow, stars]) o.frustumCulled = false;
  applyTheme();
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  const group = new THREE.Group();
  group.add(glow, points);
  const scene = new THREE.Scene();
  scene.add(stars, group);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  let camZ = 4.4;
  const anchor = { x: 0, y: 0 };

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // keep the object fully in view on tall (phone) screens
    camZ = aspect < 0.9 ? 7.4 : 4.4;
    const halfH = camZ * Math.tan((20 * Math.PI) / 180);
    const halfW = halfH * aspect;
    // clear of the text: to the right on wide screens, above it on tall ones
    const wide = aspect >= 1.15;
    anchor.x = wide ? Math.min(halfW * 0.42, 1.55) : 0;
    anchor.y = wide ? -0.05 : halfH * 0.22;
    uniforms.uPixel.value = dpr * (h / 760);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // pointer parallax (desktop only; harmless elsewhere)
  const pointer = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting), { threshold: 0 });
  io.observe(canvas);

  let raf = 0;
  let last = performance.now();
  let time = 0;
  const born = performance.now();
  let p = getTarget();
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!visible) {
      last = now;
      return;
    }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    // ease toward the scroll position so fast flicks still glide
    p += (getTarget() - p) * Math.min(1, dt * 4.5);
    const up = Math.min(Math.max(p, 0), 2.999);
    uniforms.uP.value = up;
    uniforms.uTime.value = time;
    uniforms.uIntro.value = Math.pow(1 - Math.min((now - born) / 2200, 1), 3); // fly-in on first appearance
    uniforms.uScan.value = ((time * 0.55) % 4) - 1.6; // a scan line sweeps up through the object every few seconds
    const morph = Math.sin(Math.PI * (up - Math.floor(up)));

    // gentle sway (keeps the face towards the viewer) plus pointer parallax
    // the guest holds the drawing's three-quarter view (turned towards the text, tipped slightly forward)
    const guestW = Math.max(0, 1 - Math.abs(up - 1) * 1.4);
    const yaw = -0.45 * guestW + Math.sin(time * 0.32) * (0.42 - 0.32 * guestW) + pointer.x * (0.3 - 0.15 * guestW);
    group.rotation.y += (yaw - group.rotation.y) * Math.min(1, dt * 2.5);
    group.rotation.x += (pointer.y * 0.16 + 0.04 + 0.1 * guestW - group.rotation.x) * Math.min(1, dt * 2.5);
    group.position.set(anchor.x, anchor.y, 0);
    stars.rotation.y = time * 0.01 + pointer.x * 0.05;
    camera.position.set(pointer.x * 0.15, 0.05 - pointer.y * 0.08, camZ + morph * 0.5);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      for (const g of [geo, glowGeo, starGeo]) g.dispose();
      for (const m of [mat, glowMat, starMat]) m.dispose();
      renderer.dispose();
    },
  };
}
