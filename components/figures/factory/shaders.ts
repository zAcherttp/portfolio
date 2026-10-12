// The anatomy look in two passes. The scene pass writes paper tones (one top
// tone, four side shades by how much a face turns toward a horizontal light
// from screen-left; belt items use their game colours, shaded the same way)
// plus a G-buffer of normal and part id. The composite inks outlines where
// the part id changes or depth jumps, and fainter creases where the normal
// turns sharply inside one part.

import * as THREE from "three";

export interface Palette {
  top: string;
  shades: readonly [string, string, string, string];
  litTop: string;
  litShade: string;
  hi: string;
  mid: string;
  lo: string;
  lit: string;
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
export function createSharedUniforms() {
  return {
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
uniform sampler2D uParts;
uniform float uSpin;
uniform float uIdBase;
uniform float uInstanceStride;
uniform float uPartIds;
out vec3 vNormal;
flat out float vId;
flat out float vByte;
flat out float vSwatch;

void main() {
  float byte = floor(texelFetch(uParts, ivec2(int(_part), 0), 0).r * 255. + .5);
  // Hidden parts (flat cards the game textures with alpha) collapse away.
  if (byte >= 16.) {
    gl_Position = vec4(2., 2., 2., 1.);
    return;
  }
  vec3 p = position;
  vec3 n = normal;
  if (byte >= 8.) {
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
  vId = uIdBase + float(gl_InstanceID) * uInstanceStride + (uPartIds > .5 ? _part : 0.);
  vByte = byte;
  vSwatch = _swatch;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.);
}
`;

const sceneFragment = /* glsl */ `
precision highp float;
uniform vec3 uTop, uS0, uS1, uS2, uS3, uLitTop, uLitShade;
uniform vec2 uLight;
uniform float uLit;
uniform float uSwatched;
uniform vec3 uSwatches[4];
in vec3 vNormal;
flat in float vId;
flat in float vByte;
flat in float vSwatch;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oData;

vec2 octEncode(vec3 n) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  vec2 s = vec2(n.x >= 0. ? 1. : -1., n.y >= 0. ? 1. : -1.);
  vec2 o = n.z >= 0. ? n.xy : (1. - abs(n.yx)) * s;
  return o * .5 + .5;
}

void main() {
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
  float role = mod(vByte, 8.);
  if (role > 3.5) {
    if (uLit > .5) c = n.y > .55 ? uLitTop : uLitShade;
    else role = 1.; // a sleeping accent inks like structure
  }
  float id = vId + 1.;
  oColor = vec4(c, role / 255.);
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
}

export function createSceneMaterial(
  shared: SharedUniforms,
  {
    parts,
    idBase,
    instanceStride = 0,
    partIds = true,
    swatches,
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
      uSwatched: { value: swatches ? 1 : 0 },
      uSwatches: { value: colours },
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
uniform sampler2D tColor, tData, tDepth;
uniform float uDepthRange;
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

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 last = textureSize(tData, 0) - 1;
  vec4 d0 = texelFetch(tData, p, 0);
  float id0 = idOf(d0);
  if (id0 < .5) {
    oColor = vec4(0.);
    return;
  }
  vec4 c = texelFetch(tColor, p, 0);
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
  float role = floor(c.a * 255. + .5);
  vec3 e = role < .5 ? uE0 : role < 1.5 ? uE1 : role < 2.5 ? uE2 : role < 3.5 ? uE3 : uE4;
  // Footing and small details ink lighter as the picture gets smaller.
  float weight = (role < .5 || (role > 1.5 && role < 2.5)) ? uDetail : 1.;
  vec3 col = c.rgb;
  col = mix(col, role > 3.5 ? mix(e, c.rgb, .45) : uFaint, uCrease * crease);
  col = mix(col, e, weight * outline);
  oColor = vec4(col, 1.);
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
