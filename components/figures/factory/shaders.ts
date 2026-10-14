// The anatomy look in two passes. The scene pass writes paper tones (one top
// tone, four side shades by how much a face turns toward a horizontal light
// from screen-left; belt items use their game colours, shaded the same way)
// plus a G-buffer of normal and part id. The composite inks outlines where
// the part id changes or depth jumps, and fainter creases where the normal
// turns sharply inside one part.

import * as THREE from "three";
import type { PortVolume } from "./layout";

export interface Palette {
  top: string;
  shades: readonly [string, string, string, string];
  litTop: string;
  litShade: string;
  hi: string;
  mid: string;
  lo: string;
  lit: string;
  /** Inside a port: what belts and items fade into as they go in. */
  deep: string;
  /** What glowing machines give off: the light, and its halftone pools. */
  glow: string;
  /** What a forge gives off: the smelter's slits and their light. */
  forge: string;
  /** Smoke's dots. */
  smoke: string;
  /** Power lamps. */
  power: string;
  /** The pale core of a forge's glow. */
  forgeCore: string;
  /** A weld spark as it leaves the weld, and as it dies. */
  sparkHot: string;
  sparkCool: string;
  /** The seam a building materializes behind as it is placed. */
  build: string;
}

type Rgb = [number, number, number];

/** Raw sRGB triples: the passes write palette values straight to the canvas. */
export function rgb(hex: string): Rgb {
  const value = hex.trim().replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const vec3 = () => ({ value: new THREE.Vector3() });

/** Uniforms every scene material and the composite share by reference. */
/** Stands in for the port table before a scene fills it. */
const NO_PORTS = (() => {
  const t = new THREE.DataTexture(
    new Float32Array(16),
    4,
    1,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  t.needsUpdate = true;
  return t;
})();

/**
 * The scene's port openings as a float texture, one row each:
 * (origin, wall), (outward, rim), (center, half width, floor, top),
 * (top corner radius, bottom corner radius, the light it glows with or -1).
 */
export function createPortTexture(
  ports: readonly (PortVolume & { light?: number })[],
) {
  const rows = Math.max(1, ports.length);
  const data = new Float32Array(rows * 4 * 4);
  ports.forEach((p, i) => {
    data.set(
      [
        ...p.origin,
        p.wall,
        ...p.outward,
        p.rim,
        p.center,
        p.halfWidth,
        p.floor,
        p.top,
        p.radiusTop,
        p.radiusBottom,
        p.light ?? -1,
        0,
      ],
      i * 16,
    );
  });
  const texture = new THREE.DataTexture(
    data,
    4,
    rows,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.needsUpdate = true;
  return texture;
}

/** Lights a scene can hold. */
export const MAX_LIGHTS = 8;
/**
 * Points shadows are seen from, over all lights: each keeps a cube. The
 * scene's fragment stage may sample 16 textures (WebGL 2's least, and what
 * most GPUs give); the parts, animation, port, cutout and glow textures
 * take five, so the cubes get the other eleven. One more and a texture goes
 * unbound, with three.js warning on every draw.
 */
export const MAX_VIEWS = 11;

export function createSharedUniforms() {
  return {
    uDeep: vec3(),
    /** The port table; see createPortTexture. */
    uPorts: { value: NO_PORTS as THREE.Texture },
    /** Port dark: see FactoryLook's portDark, portEdge and portSoft. */
    uPortDark: { value: 0 },
    uPortEdge: { value: 0.5 },
    uPortSoft: { value: 0 },
    uPortRadius: { value: 0 },
    uPortTone: { value: 1 },
    /**
     * Lights, up to MAX_LIGHTS: (position, reach), (an opening's normal
     * and 1, or a sphere's band as sines and 0), (half width, half height,
     * level, sphere radius).
     */
    uLightA: {
      value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()),
    },
    uLightB: {
      value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()),
    },
    uLightC: {
      value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()),
    },
    uLightCount: { value: 0 },
    /** Each light's colour. */
    uLightColour: {
      value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()),
    },
    /**
     * Shadow views, up to MAX_VIEWS: (origin, size of the glow it stands
     * for), the light it belongs to, and the distance over its light's reach
     * to the nearest surface in every direction from it.
     */
    uViewA: {
      value: Array.from({ length: MAX_VIEWS }, () => new THREE.Vector4()),
    },
    uViewLight: { value: Array.from({ length: MAX_VIEWS }, () => -1) },
    uViewCount: { value: 0 },
    uShadows: {
      value: Array.from(
        { length: MAX_VIEWS },
        () => null as THREE.Texture | null,
      ),
    },
    /** Set while drawing a light's shadows: its origin and reach. */
    uShadowPass: { value: 0 },
    /** Set while laying down depth alone, before the shaded pass. */
    uDepthPass: { value: 0 },
    uShadowFrom: { value: new THREE.Vector4() },
    uGlow: vec3(),
    /** The line's power, eased 0–1: glowing openings stay filled while on. */
    uPower: { value: 0 },
    /** Halftone light: most coverage, exposure. */
    uLightCover: { value: 0.6 },
    uLightGain: { value: 20 },
    /** How strongly glyphs and belt lamps show their colour, 0–1. */
    uGlyphLevel: { value: 1 },
    /** Power lamps' colour. */
    uPowerColour: vec3(),
    /** The pale core of a forge's glow. */
    uCoreColour: vec3(),
    /** A forge's orange, that sparks cool through. */
    uForgeColour: vec3(),
    /** A weld spark white-hot at the weld, and its red as it dies. */
    uSparkHot: vec3(),
    uSparkCool: vec3(),
    /** The colour of the seam things materialize behind. */
    uBuildColour: vec3(),
    /** The scene target's size in pixels, and a spark's width in them. */
    uResolution: { value: new THREE.Vector2(1, 1) },
    uSparkWidth: { value: 3 },
    /**
     * The one halftone grid: where its origin falls on the target and its
     * spacing there, in target pixels. See-through floor, light, smoke and
     * fading wires all print on it.
     */
    uHalftoneOrigin: { value: new THREE.Vector2() },
    uHalftoneCell: { value: 6 },
    uHalftoneCover: { value: 0.5 },
    /** The face whose shade ports fade to; the scene sets it to the view's right. */
    uPortFace: { value: new THREE.Vector3(1, 0, 0) },
    uTop: vec3(),
    uS0: vec3(),
    uS1: vec3(),
    uS2: vec3(),
    uS3: vec3(),
    uLitTop: vec3(),
    uLitShade: vec3(),
    uLight: { value: new THREE.Vector2(-1, 0) },
  };
}
export type SharedUniforms = ReturnType<typeof createSharedUniforms>;

export function createCompositeUniforms() {
  return {
    tColor: { value: null as THREE.Texture | null },
    tData: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uDepthRange: { value: 1 },
    /**
     * Smoke's density at the canvas's size, printed as halftone dots over
     * the picture; off while there is none.
     */
    tSmoke: { value: null as THREE.Texture | null },
    uSmokeOn: { value: 0 },
    /** Supersampled pixels across each canvas pixel. */
    uFactor: { value: 1 },
    uSmoke: vec3(),
    uHalftoneOrigin: { value: new THREE.Vector2() },
    uHalftoneCell: { value: 6 },
    uSmokeCover: { value: 0.5 },
    /** Ink width in supersampled pixels. */
    uRadius: { value: 1 },
    /** Strength of creases, and of outlines on base and detail parts, 0–1. */
    uCrease: { value: 1 },
    uDetail: { value: 1 },
    uE0: vec3(),
    uE1: vec3(),
    uE2: vec3(),
    uE3: vec3(),
    uE4: vec3(),
    uFaint: vec3(),
  };
}
export type CompositeUniforms = ReturnType<typeof createCompositeUniforms>;

export function applyPalette(
  palette: Palette,
  shared: SharedUniforms,
  composite: CompositeUniforms,
) {
  const set = (u: { value: THREE.Vector3 }, hex: string) =>
    u.value.set(...rgb(hex));
  set(shared.uTop, palette.top);
  set(shared.uS0, palette.shades[0]);
  set(shared.uS1, palette.shades[1]);
  set(shared.uS2, palette.shades[2]);
  set(shared.uS3, palette.shades[3]);
  set(shared.uLitTop, palette.litTop);
  set(shared.uLitShade, palette.litShade);
  set(shared.uDeep, palette.deep);
  set(shared.uGlow, palette.glow);
  set(shared.uCoreColour, palette.forgeCore);
  set(shared.uForgeColour, palette.forge);
  set(shared.uSparkHot, palette.sparkHot);
  set(shared.uSparkCool, palette.sparkCool);
  set(shared.uBuildColour, palette.build);
  set(composite.uSmoke, palette.smoke);
  set(shared.uPowerColour, palette.power);
  // Edge ink by role: base lo, structure mid, detail lo, subject hi, lit.
  set(composite.uE0, palette.lo);
  set(composite.uE1, palette.mid);
  set(composite.uE2, palette.lo);
  set(composite.uE3, palette.hi);
  set(composite.uE4, palette.lit);
  set(composite.uFaint, palette.lo);
}

const sceneVertex = /* glsl */ `
attribute float _part;
attribute float _swatch;
attribute float _bone;
attribute vec2 _ports;
attribute vec2 _cut;
// Faces the glow mask lights only in part: their mask UVs, then how to draw
// where it leaves them dark (the byte beside plus one, 0 for none; id offset).
attribute vec4 _mask;
// Belts and wires: metres along their run, for laying them out in order.
attribute float _along;
uniform sampler2D uParts;
// The ports this mesh opens onto, by index; -1 for none. Items take theirs
// from their belt, per instance.
uniform vec4 uPortSet;
uniform float uPortsPerInstance;
uniform sampler2D uVat;
uniform float uVatOn, uBones, uFrameA, uFrameB, uFrameMix;
// A layer clip poses the bones marked in the pivot row's w instead.
uniform float uLayerA, uLayerB, uLayerMix;
uniform float uSpin;
uniform float uIdBase;
uniform float uInstanceStride;
uniform float uPartIds;
uniform float uShadowPass;
out vec3 vNormal;
out vec3 vWorld;
flat out vec4 vPorts;
flat out float vId;
flat out float vByte;
flat out float vSwatch;
out vec2 vCut;
out vec2 vMaskUv;
out float vAlong;
flat out vec2 vMask;

vec3 rotate(vec4 q, vec3 v) {
  return v + 2. * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

void main() {
  float byte = floor(texelFetch(uParts, ivec2(int(_part), 0), 0).r * 255. + .5);
  // Hidden parts (flat cards the game textures with alpha) collapse away, and
  // the bodies light comes from cast no shadow of it.
  bool hidden = mod(floor(byte / 16.), 2.) > .5;
  bool emitter = mod(floor(byte / 32.), 2.) > .5;
  if (hidden || (uShadowPass > .5 && emitter)) {
    gl_Position = vec4(2., 2., 2., 1.);
    return;
  }
  vec3 p = position;
  vec3 n = normal;
  // Baked vertex animation: pivot + rotate(q, rest - pivot) + offset.
  if (uVatOn > .5 && _bone < 254.5) {
    int b = int(_bone + .5);
    int bones = int(uBones);
    vec4 pivot = texelFetch(uVat, ivec2(b, bones * 2), 0);
    bool layered = pivot.w > .5;
    int a = int(layered ? uLayerA : uFrameA);
    int c = int(layered ? uLayerB : uFrameB);
    float t = layered ? uLayerMix : uFrameMix;
    vec3 o0 = texelFetch(uVat, ivec2(a, b), 0).xyz;
    vec3 o1 = texelFetch(uVat, ivec2(c, b), 0).xyz;
    vec4 q0 = texelFetch(uVat, ivec2(a, bones + b), 0);
    vec4 q1 = texelFetch(uVat, ivec2(c, bones + b), 0);
    if (dot(q0, q1) < 0.) q1 = -q1;
    vec4 q = normalize(mix(q0, q1, t));
    p = pivot.xyz + rotate(q, p - pivot.xyz) + mix(o0, o1, t);
    n = rotate(q, n);
  }
  if (mod(floor(byte / 8.), 2.) > .5) {
    float c = cos(uSpin), s = sin(uSpin);
    mat2 r = mat2(c, -s, s, c);
    p.xz = r * p.xz;
    n.xz = r * n.xz;
  }
#ifdef USE_INSTANCING
  p = (instanceMatrix * vec4(p, 1.)).xyz;
  n = mat3(instanceMatrix) * n;
#endif
  vNormal = normalize(mat3(modelMatrix) * n);
  vWorld = (modelMatrix * vec4(p, 1.)).xyz;
  vPorts = uPortSet;
#ifdef USE_INSTANCING
  if (uPortsPerInstance > .5) vPorts = vec4(_ports, -1., -1.);
#endif
  vId = uIdBase + float(gl_InstanceID) * uInstanceStride + (uPartIds > .5 ? _part : 0.);
  vByte = byte;
  vSwatch = _swatch;
  vCut = _cut;
  vMaskUv = _mask.xy;
  vAlong = _along;
  vMask = _mask.zw;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.);
}
`;

const sceneFragment = /* glsl */ `
precision highp float;
uniform vec3 uTop, uS0, uS1, uS2, uS3, uLitTop, uLitShade;
uniform vec2 uLight;
uniform float uLit;
// A building that gives off light wakes its accents in its light's colour,
// uGlowColour; the body its light comes from wakes as uEmitter says.
uniform float uGlowAccents;
uniform vec3 uGlowColour;
uniform float uEmitter;
// Power lamps glow in this colour while the line has power.
uniform vec3 uPowerColour;
// A glowing body heats toward uCoreColour at its core, an oval: (centre,
// half length) and (long axis, half width); half length 0 for none.
uniform vec4 uCore;
uniform vec4 uCoreAxis;
uniform vec3 uCoreColour;
uniform float uSwatched;
uniform vec3 uSwatches[4];
uniform float uSeeThrough;
// Lights: (position, reach), (an opening's normal and 1, or the sines of the
// elevations a sphere's light leaves between and 0), (half size, level,
// sphere radius).
uniform vec4 uLightA[${MAX_LIGHTS}], uLightB[${MAX_LIGHTS}], uLightC[${MAX_LIGHTS}];
uniform float uLightCount, uLightCover, uLightGain;
// Shadow views: (origin, size of the glow it stands for), its light, and the
// distance to the nearest surface in every direction from it, over the reach.
uniform vec4 uViewA[${MAX_VIEWS}];
uniform float uViewLight[${MAX_VIEWS}];
uniform float uViewCount;
uniform samplerCube uShadows[${MAX_VIEWS}];
uniform vec3 uLightColour[${MAX_LIGHTS}];
// While drawing a light's shadows: where from, and its reach.
uniform float uShadowPass;
uniform vec4 uShadowFrom;
uniform vec3 uGlow;
// How far the line's power is on, 0–1: a glowing opening's fill follows it.
uniform float uPower;
// Halftone for see-through surfaces: the screen position of the world's
// origin, the dot spacing and the share of each cell a dot covers.
uniform vec2 uHalftoneOrigin;
uniform float uHalftoneCell, uHalftoneCover;
// Role written by see-through surfaces: the ink pass leaves them alone.
const float SEE_THROUGH = 5.;
uniform vec3 uDeep;
uniform sampler2D uPorts;
// Share of an opening's depth that stays fully dark from its back wall, the
// share over which it then clears, and the feather at its sides, metres.
uniform float uPortDark, uPortEdge, uPortSoft;
// Least corner radius, metres, over each opening's measured one.
uniform float uPortRadius;
// What a port's dark fades to: 0 the deep colour, 1 the shade of a face
// turned towards uPortFace, the screen's right, so every opening matches.
uniform float uPortTone;
uniform vec3 uPortFace;

// The scene's flat shade for a surface facing n: top, underside, or one of
// four sides by how it turns to the light.
vec3 toneOf(vec3 n) {
  if (n.y > .55) return uTop;
  if (n.y < -.55) return uS0;
  float lit = (dot(normalize(n.xz), uLight) + 1.) * .5;
  int b = int(clamp(floor(lit * 4.), 0., 3.));
  return b == 0 ? uS0 : b == 1 ? uS1 : b == 2 ? uS2 : uS3;
}
in vec3 vWorld;
flat in vec4 vPorts;

const float PI = 3.14159265;

// The share of a surface's cosine-weighted view of the sky that a glowing
// rectangle fills: its form factor, by Lambert's sum over the edges. With
// the glow's own brightness this is exactly the light that falls there.
float rectFactor(vec3 p, vec3 n, vec3 centre, vec3 right, vec3 up, vec2 size) {
  vec3 v[4];
  v[0] = normalize(centre - right * size.x - up * size.y - p);
  v[1] = normalize(centre + right * size.x - up * size.y - p);
  v[2] = normalize(centre + right * size.x + up * size.y - p);
  v[3] = normalize(centre - right * size.x + up * size.y - p);
  vec3 f = vec3(0.);
  for (int i = 0; i < 4; i++) {
    vec3 a = v[i];
    vec3 b = v[(i + 1) % 4];
    vec3 x = cross(a, b);
    float l = length(x);
    if (l > 1e-6) f += acos(clamp(dot(a, b), -1., 1.)) * x / l;
  }
  f /= 2. * PI;
  // The winding decides the sign; the light comes from the face.
  if (dot(f, centre - p) < 0.) f = -f;
  return max(dot(f, n), 0.);
}

// A glowing sphere's form factor, while it stands clear of the horizon.
float sphereFactor(vec3 p, vec3 n, vec3 centre, float radius) {
  vec3 v = centre - p;
  float d = max(length(v), radius);
  return radius * radius / (d * d) * max(dot(n, v / d), 0.);
}

// Sampler arrays take constant indices only: one branch per view.
float shadowDistance(int i, vec3 dir) {
${Array.from({ length: MAX_VIEWS }, (_, i) => `  if (i == ${i}) return textureLod(uShadows[${i}], dir, 0.).r;`).join("\n")}
  return 1.;
}

// A look k of n around dir, out to radius: a golden-angle spiral.
vec3 around(vec3 dir, vec3 t1, vec3 t2, int k, float n, float radius) {
  float a = float(k) * 2.39996;
  float r = sqrt((float(k) + .5) / n) * radius;
  return dir + (t1 * cos(a) + t2 * sin(a)) * r;
}

// How much of a glow of the given size view i sees past what stands between: a
// shadow as soft as the glow is wide and the blocker is far from p. First
// find how far off the blockers stand, then average looks over the penumbra
// they cast (percentage-closer soft shadows).
float visibility(
  int i,
  vec3 p,
  vec3 n,
  vec3 from,
  float reach,
  float size,
  int blockerLooks,
  int looks
) {
  vec3 d = p + n * .04 - from;
  float dist = length(d);
  vec3 dir = d / dist;
  vec3 t1 = normalize(cross(dir, abs(dir.y) < .9 ? vec3(0., 1., 0.) : vec3(1., 0., 0.)));
  vec3 t2 = cross(dir, t1);
  float own = dist - .03;
  float search = min(size / dist, .6);
  float blocker = 0.;
  float blockers = 0.;
  for (int k = 0; k < blockerLooks; k++) {
    float b = shadowDistance(i, around(dir, t1, t2, k, float(blockerLooks), search)) * reach;
    if (b < own) {
      blocker += b;
      blockers += 1.;
    }
  }
  if (blockers < .5) return 1.;
  blocker /= blockers;
  // The penumbra's width at p, as an angle seen from the light.
  float spread = min(size * (dist - blocker) / (max(blocker, .05) * dist), .6);
  float seen = 0.;
  for (int k = 0; k < looks; k++) {
    seen += step(own, shadowDistance(i, around(dir, t1, t2, k, float(looks), spread)) * reach);
  }
  return seen / float(looks);
}

// How much light falls on a surface at p facing n, 0–1, and its colour: each
// glowing sphere and face by its form factor, and by how much of it p sees,
// from each point its shadows are seen from; exposed by uLightGain so the
// faint far light still prints a few dots. The colour is the lights' own,
// weighted by what each gives.
vec4 lightAt(vec3 p, vec3 n) {
  float total = 0.;
  vec3 colour = vec3(0.);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (float(i) >= uLightCount) break;
    vec4 a = uLightA[i];
    vec4 b = uLightB[i];
    vec4 c = uLightC[i];
    if (c.z <= 0.) continue;
    // Out of reach first: most of the picture is, and it is the cheap test.
    float d = distance(p, a.xyz);
    if (d >= a.w) continue;
    float factor;
    if (b.w > .5) {
      if (dot(p - a.xyz, b.xyz) < .01) continue;
      vec3 right = vec3(-b.z, 0., b.x);
      factor = rectFactor(p, n, a.xyz, right, vec3(0., 1., 0.), c.xy);
    } else {
      // Only out through the housing's band, softened at its edges.
      float up = (p.y - a.y) / max(distance(p, a.xyz), 1e-4);
      float band = smoothstep(b.x - .1, b.x, up) * (1. - smoothstep(b.y, b.y + .1, up));
      factor = sphereFactor(p, n, a.xyz, c.w) * band;
    }
    if (factor <= 1e-4) continue;
    // Past the shadows' reach the light is long faint; let it go gently.
    float fade = 1. - smoothstep(a.w * .75, a.w, d);
    // A light seen from several points averages them, so each needs fewer
    // looks for the same softness.
    float views = 0.;
    for (int v = 0; v < ${MAX_VIEWS}; v++) {
      if (float(v) >= uViewCount) break;
      if (abs(uViewLight[v] - float(i)) < .5) views += 1.;
    }
    int blockerLooks = views > 1.5 ? 4 : 8;
    int looks = views > 1.5 ? 6 : 12;
    float seen = 0.;
    for (int v = 0; v < ${MAX_VIEWS}; v++) {
      if (float(v) >= uViewCount) break;
      if (abs(uViewLight[v] - float(i)) > .5) continue;
      vec4 view = uViewA[v];
      seen += visibility(v, p, n, view.xyz, a.w, view.w, blockerLooks, looks);
    }
    float given = c.z * factor * fade * seen / max(views, 1.);
    total += given;
    colour += uLightColour[i] * given;
  }
  return vec4(colour / max(total, 1e-6), 1. - exp(-total * uLightGain));
}

// Signed distance to a rounded rectangle of the given half size, with corner
// radius top above its middle and bottom below.
float roundBox(vec2 p, vec2 size, float top, float bottom) {
  float r = p.y > 0. ? top : bottom;
  vec2 q = abs(p) - size + r;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
}

// How dark a port's opening is here: inside the opening's measured rounded
// box, feathered at its sides, dark from its flat back wall for uPortDark of
// its depth, then clearing over uPortEdge of it towards the rim.
float portFade(float index) {
  if (index < -.5) return 0.;
  int i = int(index + .5);
  vec4 origin = texelFetch(uPorts, ivec2(0, i), 0);
  vec4 outward = texelFetch(uPorts, ivec2(1, i), 0);
  vec4 box = texelFetch(uPorts, ivec2(2, i), 0);
  vec4 corners = texelFetch(uPorts, ivec2(3, i), 0);
  vec3 r = vWorld - origin.xyz;
  float t = dot(r, outward.xyz);
  if (t < origin.w - .02 || t > outward.w) return 0.;
  vec2 p = vec2(
    dot(r, vec3(-outward.z, 0., outward.x)) - box.x,
    r.y - (box.z + box.w) * .5
  );
  vec2 size = vec2(box.y, (box.w - box.z) * .5);
  float most = min(size.x, size.y);
  float edge = roundBox(
    p,
    size,
    min(max(corners.x, uPortRadius), most),
    min(max(corners.y, uPortRadius), most)
  );
  // Surfaces on the tunnel's walls sit at 0; past them the dark feathers out.
  float inside = 1. - smoothstep(.03, .03 + uPortSoft, edge);
  if (inside <= 0.) return 0.;
  float depth = outward.w - origin.w;
  float clear = origin.w + depth * uPortDark;
  float gone = min(clear + depth * uPortEdge, outward.w);
  return inside * (1. - smoothstep(clear, max(gone, clear + .01), t));
}
in vec3 vNormal;
flat in float vId;
flat in float vByte;
flat in float vSwatch;
in vec2 vCut;
in vec2 vMaskUv;
in float vAlong;
flat in vec2 vMask;
// A decal tile's alpha: cutout parts (role bit 128) show only where it is set.
uniform sampler2D uCutout;
// Placing: everything above the seam's height (x, world metres) is not built
// yet; a band of y metres under it glows in uBuildColour as it materializes.
uniform vec2 uBuild;
uniform float uDepthPass;
// Laying: everything past this many metres along its run is not laid yet.
uniform float uAlong;
// A run that dissolves: from x metres along to y, into ever smaller halftone
// dots, gone at y.
uniform vec2 uFade;
uniform vec3 uBuildColour;
// Where the glow mask lights: faces lit in part glow only there.
uniform sampler2D uGlowMask;
// The game's colour for what that mask lights: w 1 for its accents, 2 for
// its power lamps too; 0 leaves them the palette's.
uniform vec4 uGlyphColour;
uniform float uGlyphLevel;
// Outputs' colour where the mask reads brightest; w 0 for none.
uniform vec4 uGlyphOut;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oData;

vec2 octEncode(vec3 n) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  vec2 s = vec2(n.x >= 0. ? 1. : -1., n.y >= 0. ? 1. : -1.);
  vec2 o = n.z >= 0. ? n.xy : (1. - abs(n.yx)) * s;
  return o * .5 + .5;
}

void main() {
  // Cutout parts are only their tile's opaque bars, in shadows too.
  if (vByte >= 128. && texture(uCutout, vCut).r < .5) discard;
  // Not built yet, in shadows too.
  if (vWorld.y > uBuild.x || vAlong > uAlong) discard;
  // A light's shadows: how far the nearest surface lies, over its reach.
  // See-through surfaces cast none.
  if (uShadowPass > .5) {
    if (uSeeThrough > .5) discard;
    oColor = vec4(distance(vWorld, uShadowFrom.xyz) / uShadowFrom.w, 0., 0., 1.);
    oData = vec4(0.);
    return;
  }
  if (vAlong > uFade.x) {
    float left = 1. - clamp((vAlong - uFade.x) / (uFade.y - uFade.x), 0., 1.);
    vec2 q = (gl_FragCoord.xy - uHalftoneOrigin) / uHalftoneCell;
    q = mat2(.70710678, -.70710678, .70710678, .70710678) * q;
    if (length(fract(q) - .5) > sqrt(.78 * left / 3.14159265)) discard;
  }
  // Faint surfaces print as a halftone: round dots on a grid turned 45°,
  // sized for uHalftoneCover of each cell, anchored to the scene so they pan
  // with it. Only the dots are drawn; the rest shows what lies beneath.
  if (uSeeThrough > .5) {
    vec2 q = (gl_FragCoord.xy - uHalftoneOrigin) / uHalftoneCell;
    q = mat2(.70710678, -.70710678, .70710678, .70710678) * q;
    vec2 cell = fract(q) - .5;
    float radius = sqrt(clamp(uHalftoneCover, 0., .78) / 3.14159265);
    if (length(cell) > radius) discard;
  }
  // Depth first: what is cut away above is all it needs.
  if (uDepthPass > .5) {
    oColor = vec4(0.);
    oData = vec4(0.);
    return;
  }
  // A face the glow mask lights in part is, where it stays dark, the part
  // beside it that it was split from.
  float byte = vByte;
  float part = vId;
  float masked = 1.;
  if (vMask.x > .5) {
    masked = texture(uGlowMask, vMaskUv).r;
    if (masked < .25) {
      byte = vMask.x - 1.;
      part += vMask.y;
    }
  }
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  // Tone class: 0 top, 1 underside, 2–4 sides by how lit they are.
  int b;
  if (n.y > .55) b = 4;
  else if (n.y < -.55) b = 0;
  else {
    float lit = (dot(normalize(n.xz), uLight) + 1.) * .5;
    b = int(clamp(floor(lit * 4.), 0., 3.));
  }
  vec3 c;
  if (uSwatched > .5) {
    // Game colours, shaded by the same classes.
    float shade = b == 4 ? 1. : b == 0 ? .55 : b == 1 ? .66 : b == 2 ? .78 : .9;
    c = uSwatches[int(clamp(vSwatch, 0., 3.))] * shade;
  } else {
    c = b == 4 ? uTop : b == 0 ? uS0 : b == 1 ? uS1 : b == 2 ? uS2 : uS3;
  }
  float role = mod(byte, 8.);
  bool accent = role > 3.5;
  // An accent wakes with its machine: uLit eases between 0 and 1. The body
  // a building's light comes from glows in that light's colour, as uEmitter.
  bool emitter = mod(floor(byte / 32.), 2.) > .5;
  bool lamp = mod(floor(byte / 64.), 2.) > .5;
  // Glyphs, the port indicators in the game's colour, show with power.
  // Only faces read through the mask: other accents keep their own colour.
  bool read = vMask.x > .5;
  bool glyph = read && !lamp && !emitter && uGlyphColour.w > .5;
  float wake = lamp || glyph ? uPower : emitter ? uEmitter : uLit;
  if (accent) {
    vec3 awake = lamp
      ? read && uGlyphColour.w > 1.5 ? uGlyphColour.rgb : uPowerColour
      : glyph
        ? uGlyphOut.w > .5 && masked > .75 ? uGlyphOut.rgb : uGlyphColour.rgb
        : emitter || uGlowAccents > .5
          ? uGlowColour
          : n.y > .55 ? uLitTop : uLitShade;
    if (emitter && uCore.w > 0.) {
      // Deep at the rim, hot through the middle: a saturated body with a
      // pale core.
      vec3 r = vWorld - uCore.xyz;
      float along = dot(r, uCoreAxis.xyz) / uCore.w;
      float across = length(r - uCoreAxis.xyz * dot(r, uCoreAxis.xyz)) / uCoreAxis.w;
      float heat = 1. - smoothstep(0., 1., length(vec2(along, across)));
      awake = mix(awake, uCoreColour, heat);
    }
    // Glyphs, and lamps in their colour, show at the tuned strength.
    bool tuned = glyph || (lamp && read && uGlyphColour.w > 1.5);
    c = mix(c, awake, wake * (tuned ? uGlyphLevel : 1.));
  }
  if (uSeeThrough > .5) role = SEE_THROUGH;
  // Accents glow, so a port's dark never covers them; their upper bits carry
  // how awake they are instead, for the ink pass.
  // A port's opening darkens inward, unless its building glows through it:
  // then it fills with the glow as far as that light is awake.
  float dark = 0.;
  float lit = 0.;
  vec3 fill = vec3(0.);
  for (int k = 0; k < 4; k++) {
    float f = portFade(vPorts[k]);
    if (f <= 0.) continue;
    float light = texelFetch(uPorts, ivec2(3, int(vPorts[k] + .5)), 0).z;
    if (light > -.5 && f * uPower > lit) {
      lit = f * uPower;
      fill = uLightColour[int(light + .5)];
    } else if (light < -.5) dark = max(dark, f);
  }
  // Ink sinks into a glowing opening as it does into a dark one.
  float fade = accent ? wake : max(dark, lit);
  if (!accent) c = mix(c, mix(uDeep, toneOf(uPortFace), uPortTone), dark);
  c = mix(c, fill, lit);
  // Light falling on surfaces prints as halftone dots in its colour, denser
  // where more falls.
  if (uSeeThrough < .5) {
    vec4 falling = lightAt(vWorld, n);
    float light = falling.a * (1. - lit);
    if (light > .01) {
      vec2 q = (gl_FragCoord.xy - uHalftoneOrigin) / uHalftoneCell;
      q = mat2(.70710678, -.70710678, .70710678, .70710678) * q;
      float radius = sqrt(light * clamp(uLightCover, 0., .78) / PI);
      if (length(fract(q) - .5) < radius) c = falling.rgb;
    }
  }
  // The seam glows hottest at its edge and cools into the finished surface.
  float seam = min(uBuild.x - vWorld.y, uAlong - vAlong) / uBuild.y;
  if (seam < 1.) c = mix(c, uBuildColour, (1. - seam) * (1. - seam));
  float id = part + 1.;
  // Role in the low three bits, the port fade above, for the ink pass.
  oColor = vec4(c, (role + 8. * floor(fade * 31. + .5)) / 255.);
  oData = vec4(octEncode(n), floor(id / 256.) / 255., mod(id, 256.) / 255.);
}
`;

export interface SceneMaterialOptions {
  parts: THREE.Texture;
  idBase: number;
  /** Ids each instance takes; 0 for a plain mesh. */
  instanceStride?: number;
  /** Give each part its own id (inks the seams between parts). */
  partIds?: boolean;
  /** Game colours for a belt item, by `_swatch`. */
  swatches?: readonly string[];
  /** Baked vertex animation; the pose comes from uFrameA/B/Mix. */
  animation?: { texture: THREE.Texture; bones: number };
  /** See-through: prints as a halftone of dots and inks nothing. */
  faint?: boolean;
  /** Accents wake in the glow's colour: the building gives off light. */
  glowAccents?: boolean;
  /** The alpha its cutout parts are cut by. */
  cutout?: THREE.Texture;
  /** Where its glow mask lights, for faces it lights in part. */
  glowMask?: THREE.Texture;
  /** The game's colour for what its mask lights. */
  glyph?: { colour: string; lamp: boolean; output?: string };
  /** Ports this mesh opens onto (up to four), by index. */
  ports?: readonly number[];
  /** Items: their ports come per instance, from `_ports`. */
  portsPerInstance?: boolean;
}

/** A seam height above everything: all of it built. */
export const BUILT = 1e6;
/** How far under the seam, in metres, a materializing surface still glows. */
export const BUILD_BAND = 0.6;

/** Stands in for a cutout mask on materials that have none. */
const NO_CUTOUT = (() => {
  const t = new THREE.DataTexture(
    new Uint8Array([255]),
    1,
    1,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  t.needsUpdate = true;
  return t;
})();

/** Stands in for an animation texture on materials that have none. */
const NO_ANIMATION = (() => {
  const t = new THREE.DataTexture(
    new Float32Array(4),
    1,
    1,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  t.needsUpdate = true;
  return t;
})();

export function createSceneMaterial(
  shared: SharedUniforms,
  {
    parts,
    idBase,
    instanceStride = 0,
    partIds = true,
    swatches,
    animation,
    faint = false,
    glowAccents = false,
    cutout,
    glowMask,
    glyph,
    ports = [],
    portsPerInstance = false,
  }: SceneMaterialOptions,
) {
  const colours = Array.from({ length: 4 }, (_, i) => {
    const hex = swatches?.[i] ?? swatches?.[0] ?? "#808080";
    return new THREE.Vector3(...rgb(hex));
  });
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...shared,
      uParts: { value: parts },
      uIdBase: { value: idBase },
      uInstanceStride: { value: instanceStride },
      uPartIds: { value: partIds ? 1 : 0 },
      uSpin: { value: 0 },
      uLit: { value: 0 },
      uGlowAccents: { value: glowAccents ? 1 : 0 },
      uGlowColour: { value: new THREE.Vector3() },
      uCore: { value: new THREE.Vector4() },
      uCutout: { value: cutout ?? NO_CUTOUT },
      uGlowMask: { value: glowMask ?? NO_CUTOUT },
      uGlyphColour: {
        value: glyph
          ? new THREE.Vector4(...rgb(glyph.colour), glyph.lamp ? 2 : 1)
          : new THREE.Vector4(),
      },
      uGlyphOut: {
        value: glyph?.output
          ? new THREE.Vector4(...rgb(glyph.output), 1)
          : new THREE.Vector4(),
      },
      uCoreAxis: { value: new THREE.Vector4() },
      uBuild: { value: new THREE.Vector2(BUILT, BUILD_BAND) },
      uAlong: { value: BUILT },
      uFade: { value: new THREE.Vector2(BUILT, BUILT + 1) },
      uEmitter: { value: 0 },
      uSwatched: { value: swatches ? 1 : 0 },
      uSwatches: { value: colours },
      uVat: { value: animation?.texture ?? NO_ANIMATION },
      uVatOn: { value: animation ? 1 : 0 },
      uBones: { value: animation?.bones ?? 0 },
      uFrameA: { value: 0 },
      uFrameB: { value: 0 },
      uFrameMix: { value: 0 },
      uLayerA: { value: 0 },
      uLayerB: { value: 0 },
      uLayerMix: { value: 0 },
      uSeeThrough: { value: faint ? 1 : 0 },
      uPortSet: {
        value: new THREE.Vector4(...[0, 1, 2, 3].map((k) => ports[k] ?? -1)),
      },
      uPortsPerInstance: { value: portsPerInstance ? 1 : 0 },
    },
    vertexShader: sceneVertex,
    fragmentShader: sceneFragment,
    side: THREE.DoubleSide,
  });
}

/** One byte per part (role | flags) from a model's base64 extras. */
export function createPartsTexture(bytes: Uint8Array) {
  const data = bytes.length > 0 ? bytes : new Uint8Array(1);
  const texture = new THREE.DataTexture(
    data,
    data.length,
    1,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.needsUpdate = true;
  return texture;
}

const compositeVertex = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0., 1.);
}
`;

const compositeFragment = /* glsl */ `
precision highp float;
uniform sampler2D tColor, tData, tDepth, tSmoke;
uniform float uDepthRange;
uniform vec3 uSmoke;
uniform vec2 uHalftoneOrigin;
uniform float uHalftoneCell, uSmokeCover, uSmokeOn, uFactor;
uniform float uRadius, uCrease, uDetail;
uniform vec3 uE0, uE1, uE2, uE3, uE4, uFaint;
layout(location = 0) out vec4 oColor;

vec3 octDecode(vec2 e) {
  e = e * 2. - 1.;
  vec3 n = vec3(e, 1. - abs(e.x) - abs(e.y));
  if (n.z < 0.) {
    vec2 s = vec2(n.x >= 0. ? 1. : -1., n.y >= 0. ? 1. : -1.);
    n.xy = (1. - abs(n.yx)) * s;
  }
  return normalize(n);
}

float idOf(vec4 d) {
  return floor(d.b * 255. + .5) * 256. + floor(d.a * 255. + .5);
}

// Whether smoke prints a dot here: halftone on the scene's grid, the dot as
// big as the smoke is thick.
bool smokeDot(ivec2 p) {
  if (uSmokeOn < .5) return false;
  float density = texelFetch(tSmoke, p / int(uFactor), 0).r;
  if (density <= 0.) return false;
  vec2 q = (gl_FragCoord.xy - uHalftoneOrigin) / uHalftoneCell;
  q = mat2(.70710678, -.70710678, .70710678, .70710678) * q;
  float radius = sqrt(density * clamp(uSmokeCover, 0., .78) / 3.14159265);
  return length(fract(q) - .5) < radius;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 last = textureSize(tData, 0) - 1;
  bool puff = smokeDot(p);
  vec4 d0 = texelFetch(tData, p, 0);
  float id0 = idOf(d0);
  if (id0 < .5) {
    oColor = puff ? vec4(uSmoke, 1.) : vec4(0.);
    return;
  }
  vec4 c = texelFetch(tColor, p, 0);
  float packed = floor(c.a * 255. + .5);
  float role = mod(packed, 8.);
  float level = floor(packed / 8.) / 31.;
  bool accent = role > 3.5 && role < 4.5;
  // Inside a port, ink sinks into the dark with the surface; an accent's
  // level is instead how awake it is.
  float deep = accent ? 0. : level;
  // See-through pixels show their tone and take no ink.
  if (role > 4.5) {
    oColor = vec4(puff ? uSmoke : c.rgb, 1.);
    return;
  }
  vec3 n0 = octDecode(d0.rg);
  float z0 = texelFetch(tDepth, p, 0).x;
  // Ink strength per ring: whole rings count fully, the last one in part, so
  // a width of 1.5 inks edges found one pixel out fully and two out by half.
  float outline = 0., crease = 0.;
  for (int r = 1; r <= 3; r++) {
    float ring = clamp(uRadius - float(r - 1), 0., 1.);
    if (ring <= 0.) break;
    for (int i = 0; i < 4; i++) {
      ivec2 o = (i == 0 ? ivec2(1, 0) : i == 1 ? ivec2(-1, 0) : i == 2 ? ivec2(0, 1) : ivec2(0, -1)) * r;
      ivec2 q = clamp(p + o, ivec2(0), last);
      // Look past see-through pixels, as if they were not there.
      if (mod(floor(texelFetch(tColor, q, 0).a * 255. + .5), 8.) > 4.5) continue;
      vec4 d1 = texelFetch(tData, q, 0);
      float id1 = idOf(d1);
      float z1 = texelFetch(tDepth, q, 0).x;
      if (id1 != id0) {
        // Ink the nearer side only, so each edge keeps its width.
        if (id1 < .5 || z0 <= z1) outline = max(outline, ring);
      } else {
        if (dot(n0, octDecode(d1.rg)) < .82) crease = max(crease, ring);
        if ((z1 - z0) * uDepthRange > .6) outline = max(outline, ring);
      }
    }
  }
  vec3 e = role < .5 ? uE0 : role < 1.5 ? uE1 : role < 2.5 ? uE2 : role < 3.5 ? uE3 : mix(uE1, uE4, level);
  e = mix(e, c.rgb, deep);
  // Footing and small details ink lighter as the picture gets smaller.
  float weight = (role < .5 || (role > 1.5 && role < 2.5)) ? uDetail : 1.;
  vec3 col = c.rgb;
  col = mix(col, role > 3.5 ? mix(e, c.rgb, .45) : mix(uFaint, c.rgb, deep), uCrease * crease);
  col = mix(col, e, weight * outline);
  oColor = vec4(puff ? uSmoke : col, 1.);
}
`;

const downsampleFragment = /* glsl */ `
precision highp float;
uniform sampler2D tInk;
uniform float uFactor;
layout(location = 0) out vec4 oColor;

void main() {
  int f = int(uFactor);
  ivec2 base = ivec2(gl_FragCoord.xy) * f;
  vec4 sum = vec4(0.);
  for (int y = 0; y < 3; y++) {
    if (y >= f) break;
    for (int x = 0; x < 3; x++) {
      if (x >= f) break;
      sum += texelFetch(tInk, base + ivec2(x, y), 0);
    }
  }
  // Empty pixels are (0, 0, 0, 0), so the average is already premultiplied.
  oColor = sum / float(f * f);
}
`;

const smokeVertex = /* glsl */ `
// Each puff is a square facing the camera: centre and width, and opacity.
attribute vec4 aPuff;
attribute float aAlpha;
uniform float uShadowPass;
out vec2 vCorner;
out float vAlpha;
out float vSize;

void main() {
  // Puffs cast no shadow.
  if (uShadowPass > .5 || aAlpha <= 0.) {
    gl_Position = vec4(2., 2., 2., 1.);
    return;
  }
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = aPuff.xyz + (right * position.x + up * position.y) * aPuff.w * .5;
  vCorner = position.xy;
  vAlpha = aAlpha;
  vSize = aPuff.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}
`;

const smokeFragment = /* glsl */ `
precision highp float;
uniform sampler2D tDepth;
uniform float uDepthRange;
// Supersampled pixels across each of this target's.
uniform float uFactor;
in vec2 vCorner;
in float vAlpha;
in float vSize;
layout(location = 0) out vec4 oColor;

void main() {
  // A soft ball, dense through its middle. Where the scene stands close
  // behind it, it thins out instead of cutting off on the surface (a soft
  // particle); where the scene is in front, it is hidden.
  float scene = texelFetch(tDepth, ivec2(gl_FragCoord.xy * uFactor), 0).x;
  float gap = (scene - gl_FragCoord.z) * uDepthRange;
  if (gap <= 0.) discard;
  float r = length(vCorner);
  float density = vAlpha * (1. - smoothstep(.35, 1., r));
  density *= smoothstep(0., vSize * .35, gap);
  // Overlapping puffs keep the thickest (max blending).
  oColor = vec4(density, 0., 0., 1.);
}
`;

const sparkVertex = /* glsl */ `
// Each spark is a streak from its head back along its flight to its tail, a
// few pixels wide on screen whatever the zoom.
attribute vec3 aHead;
attribute vec3 aTail;
attribute float aHeat;
uniform float uShadowPass;
uniform vec2 uResolution;
uniform float uSparkWidth;
out float vHeat;

void main() {
  if (uShadowPass > .5) {
    gl_Position = vec4(2., 2., 2., 1.);
    return;
  }
  vec4 head = projectionMatrix * viewMatrix * vec4(aHead, 1.);
  vec4 tail = projectionMatrix * viewMatrix * vec4(aTail, 1.);
  vec2 a = head.xy / head.w * uResolution;
  vec2 b = tail.xy / tail.w * uResolution;
  vec2 along = b - a;
  float l = length(along);
  vec2 dir = l > 1e-3 ? along / l : vec2(1., 0.);
  vec2 side = vec2(-dir.y, dir.x) * uSparkWidth;
  vec4 p = mix(head, tail, position.x);
  p.xy += side * position.y / uResolution * p.w;
  vHeat = aHeat;
  gl_Position = p;
}
`;

const sparkFragment = /* glsl */ `
precision highp float;
uniform vec3 uSparkHot, uCoreColour, uForgeColour, uSparkCool;
in float vHeat;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oData;

void main() {
  // White-hot as it leaves the weld, cooling through yellow and the forge's
  // orange to red as it dies; light itself, so the ink pass leaves it alone.
  float h = vHeat * 3.;
  vec3 colour = h > 2. ? mix(uCoreColour, uSparkHot, h - 2.)
    : h > 1. ? mix(uForgeColour, uCoreColour, h - 1.)
    : mix(uSparkCool, uForgeColour, h);
  oColor = vec4(colour, 5. / 255.);
  oData = vec4(.5, .5, 1., 1.);
}
`;

/** Weld sparks: streaks drawn straight into the scene, unlit and uninked. */
export function createSparkMaterial(shared: SharedUniforms) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uShadowPass: shared.uShadowPass,
      uResolution: shared.uResolution,
      uSparkWidth: shared.uSparkWidth,
      uSparkHot: shared.uSparkHot,
      uCoreColour: shared.uCoreColour,
      uForgeColour: shared.uForgeColour,
      uSparkCool: shared.uSparkCool,
    },
    vertexShader: sparkVertex,
    fragmentShader: sparkFragment,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Chimney smoke's density, drawn on its own target after the scene and read
 * by the composite, which prints it as halftone dots.
 */
export function createSmokeMaterial(shared: SharedUniforms) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uShadowPass: shared.uShadowPass,
      tDepth: { value: null as THREE.Texture | null },
      uDepthRange: { value: 1 },
      uFactor: { value: 1 },
    },
    vertexShader: smokeVertex,
    fragmentShader: smokeFragment,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
}

/** Holds smoke's density at the canvas's size. */
export function createSmokeTarget(width: number, height: number) {
  return new THREE.WebGLRenderTarget(width, height, {
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
  });
}

/** Averages the supersampled ink down onto the canvas. */
export function createDownsampleMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tInk: { value: null as THREE.Texture | null },
      uFactor: { value: 1 },
    },
    vertexShader: compositeVertex,
    fragmentShader: downsampleFragment,
    depthTest: false,
    depthWrite: false,
    premultipliedAlpha: true,
  });
}

/** Holds the inked picture at the supersampled size. */
export function createInkTarget(width: number, height: number) {
  return new THREE.WebGLRenderTarget(width, height, {
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
  });
}

export function createCompositeMaterial(uniforms: CompositeUniforms) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: compositeVertex,
    fragmentShader: compositeFragment,
    depthTest: false,
    depthWrite: false,
  });
}

/** Colour + G-buffer targets sharing one depth texture. */
export function createSceneTarget(width: number, height: number) {
  return new THREE.WebGLRenderTarget(width, height, {
    count: 2,
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthTexture: new THREE.DepthTexture(width, height),
  });
}
