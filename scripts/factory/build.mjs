// Builds the factory line models from glTF exports of the game's meshes.
//
//   pnpm exec tsx scripts/factory/build.mjs <exportsRoot> <outDir> [--debug <dir>]
//     [--pack <file>]
//
// The pack's file name carries a hash of its contents in place of "[hash]"
// (by default public/factory/models.[hash].bin), so the site can cache it
// for good; a pack written under public/ also rewrites models-url.ts, the
// generated module that names it, and removes the packs it replaces.
//
// <exportsRoot> holds FactoryGame/Content/... as written by FModel or a
// CUE4Parse exporter. For every model in models.mjs this places each
// blueprint component mesh in the actor frame, drops decals, UVs, tangents and
// colours, merges everything into one primitive, tags each
// connected piece with a `_PART` id (largest first), bakes one byte per part
// (tone role | flags) into the mesh extras as base64, then quantizes and
// meshopt-compresses into <outDir>/<name>.glb. Belt items also get colour
// swatches from their game texture (see paintSwatches); their UVs then go.
// Machines with baked vertex animation (see vat.mjs) get a `_BONE` per vertex
// and their clips, in the actor frame, in the extras; the clip textures come
// from the exporter's `rawtex` output in --vat <dir> (default <exportsRoot>/../vat).
// The miner's skinned parts bake the same way from the exporter's .psa clips
// (see skeletal.mjs).
//
// The site gets every model in one gzipped, scrambled blob,
// public/factory/models.<hash>.bin, with no names from the game. Large masks ride
// beside the models as raw entries ("<model>.glow", "<model>.cutout") that
// the extras name, not as base64 inside the glTF. <outDir> holds plain copies for inspection:
// keep it outside the repository.

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  join as joinPath,
  relative,
  resolve,
  sep,
} from "node:path";
import { gzipSync } from "node:zlib";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  compactPrimitive,
  dedup,
  flatten,
  join,
  mergeDocuments,
  meshopt,
  prune,
  quantize,
  reorder,
  transformPrimitive,
  unweld,
  weld,
} from "@gltf-transform/functions";
import { decode } from "fast-png";
import { MeshoptEncoder } from "meshoptimizer";
import { fromUnrealAxes } from "../../components/figures/factory/game.ts";
import { BUILDINGS } from "../../components/figures/factory/layout.ts";
import { packModels } from "../../components/figures/factory/pack.ts";
import { gather, keyFrames, offsetRanges, packKeys } from "./keys.mjs";
import { CUTOUT, EMITTER, HIDDEN, LIT, MODELS, POWERED } from "./models.mjs";
import { measureOpening } from "./openings.mjs";
import { bakeSkeletal, readPsa, subtree } from "./skeletal.mjs";
import { convertClip, decodeTexture, turn } from "./vat.mjs";

/** The tone role of decal cutouts: small parts, inked lightly. */
const DETAIL_ROLE = 2;
/** The _GLOW value of faces a component's own mask lights. */
const GLOW_EMITTER = 2;
/** The _GLOW value of faces that glow with the line's power instead. */
const GLOW_POWER = 3;
/**
 * A _GLOW bit for faces the mask lights only in part: their glow is decided
 * per pixel, through their UVs in `_MASK`, against the model's mask.
 */
const GLOW_PARTLY = 8;
/** Points sampled across a face, per edge, to tell how much the mask lights. */
const GLOW_SAMPLES = 8;
/** How far past a face's edge, in texels, its mask is still read. */
const GLOW_MARGIN = 0.75;

const args = process.argv.slice(2);
const [root, out] = args;
if (!root || !out || out.startsWith("--")) {
  console.error(
    "usage: pnpm exec tsx scripts/factory/build.mjs <exportsRoot> <outDir> [--debug <dir>] [--pack <file>]",
  );
  process.exit(2);
}
const debugAt = args.indexOf("--debug");
const debugDir = debugAt > 0 ? resolve(args[debugAt + 1]) : null;
const packAt = args.indexOf("--pack");
const packFile = resolve(
  packAt > 0 ? args[packAt + 1] : "public/factory/models.[hash].bin",
);
const vatAt = args.indexOf("--vat");
const vatDir = resolve(
  vatAt > 0 ? args[vatAt + 1] : joinPath(root, "..", "vat"),
);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
if (debugDir) mkdirSync(debugDir, { recursive: true });

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

/** Column-major matrix: scale, turn `yaw` about y, then move by `offset`. */
function componentMatrix({ yaw = 0, offset = [0, 0, 0], scale = 1 }) {
  const c = Math.cos(yaw) * scale;
  const s = Math.sin(yaw) * scale;
  return [c, 0, -s, 0, 0, scale, 0, 0, s, 0, c, 0, ...offset, 1];
}

/** Materials that glow in the game: windows, screens, emissive panels. */
const EMISSIVE = /window|glow|emiss|screen/i;

/** No bone: the vertex is not animated. */
const STATIC_BONE = 255;

/**
 * Bone of each vertex of an animated component (TEXCOORD_2.y, a whole number),
 * and each bone's pivot (TEXCOORD_1.xy, TEXCOORD_2.x) placed like the vertices.
 */
function readBones(prim, component, pivots) {
  const count = prim.getAttribute("POSITION").getCount();
  const bones = new Uint8Array(count).fill(STATIC_BONE);
  const uv1 = prim.getAttribute("TEXCOORD_1");
  const uv2 = prim.getAttribute("TEXCOORD_2");
  if (!component.vat || !uv1 || !uv2) return bones;
  const a = [];
  const b = [];
  for (let i = 0; i < count; i++) {
    uv2.getElement(i, b);
    const bone = Math.round(b[1]);
    if (Math.abs(b[1] - bone) > 0.01 || bone < 0 || bone >= STATIC_BONE)
      continue;
    bones[i] = bone;
    if (!pivots.has(bone)) {
      uv1.getElement(i, a);
      // Unreal (X, Y, Z) metres, then placed where the blueprint puts it.
      const [x, y, z] = turn(
        fromUnrealAxes([a[0], a[1], b[0]]),
        component.yaw ?? 0,
      );
      const [ox, oy, oz] = component.offset ?? [0, 0, 0];
      pivots.set(bone, [x + ox, y + oy, z + oz]);
    }
  }
  return bones;
}

/**
 * The joints of a skinned component that carry vertices, in skin order: the
 * component's bones. Each vertex follows its one joint (the game's are rigid).
 */
function skinnedBones(part) {
  const [skin] = part.getRoot().listSkins();
  if (!skin) throw new Error("A skeletal component needs a skinned mesh.");
  const names = skin.listJoints().map((joint) => joint.getName());
  const used = new Set();
  const joints = [];
  const weights = [];
  for (const mesh of part.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const j = prim.getAttribute("JOINTS_0");
      const w = prim.getAttribute("WEIGHTS_0");
      for (let i = 0; i < j.getCount(); i++) {
        j.getElement(i, joints);
        w.getElement(i, weights);
        used.add(joints[weights.indexOf(Math.max(...weights))]);
      }
    }
  }
  return names.filter((_, i) => used.has(i));
}

/** Bone of each vertex of a skinned component: its heaviest joint, by name. */
function readSkinnedBones(prim, part, boneNames) {
  const names = part.getRoot().listSkins()[0].listJoints();
  const j = prim.getAttribute("JOINTS_0");
  const w = prim.getAttribute("WEIGHTS_0");
  const bones = new Uint8Array(j.getCount()).fill(STATIC_BONE);
  const joints = [];
  const weights = [];
  for (let i = 0; i < j.getCount(); i++) {
    j.getElement(i, joints);
    w.getElement(i, weights);
    const joint = joints[weights.indexOf(Math.max(...weights))];
    bones[i] = boneNames.indexOf(names[joint].getName());
  }
  return bones;
}

/** Reads every component of a model into one document, in the actor frame. */
async function readModel(model) {
  let doc = null;
  const pivots = new Map();
  let boneNames = null;
  for (const [index, component] of model.components.entries()) {
    const part = await io.read(joinPath(root, component.source));
    part.setLogger(new Logger(Logger.Verbosity.WARN));
    const matrix = componentMatrix(component);
    const buffer = part.getRoot().listBuffers()[0] ?? part.createBuffer();
    if (component.skeletal) boneNames = skinnedBones(part);
    for (const mesh of part.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        prim.setAttribute(
          "_BONE",
          part
            .createAccessor()
            .setType("SCALAR")
            .setArray(
              component.skeletal
                ? readSkinnedBones(prim, part, boneNames)
                : readBones(prim, component, pivots),
            )
            .setBuffer(buffer),
        );
        transformPrimitive(prim, matrix);
        // Remember which component every vertex came from, and whether its
        // material glows, for the roles: component * 2 + emissive.
        const count = prim.getAttribute("POSITION").getCount();
        const glows = EMISSIVE.test(prim.getMaterial()?.getName() ?? "");
        prim.setAttribute(
          "_SRC",
          part
            .createAccessor()
            .setType("SCALAR")
            .setArray(new Uint8Array(count).fill(index * 2 + (glows ? 1 : 0)))
            .setBuffer(buffer),
        );
      }
    }
    // The skin is baked into the clips: the mesh stays in its rest pose.
    for (const node of part.getRoot().listNodes()) node.setSkin(null);
    for (const skin of part.getRoot().listSkins()) skin.dispose();
    if (!doc) {
      doc = part;
      continue;
    }
    mergeDocuments(doc, part);
    const [scene, ...extra] = doc.getRoot().listScenes();
    for (const other of extra) {
      for (const node of other.listChildren()) scene.addChild(node);
      other.dispose();
    }
  }
  return { doc, pivots, boneNames };
}

/**
 * A skinned component's clips, baked per bone like the vertex animation, and
 * the bones its layer clip drives instead of the main one.
 */
function bakeSkinnedClips(component, boneNames) {
  const { clips: specs, folder, layer } = component.skeletal;
  const psas = new Map();
  const psa = (name) => {
    if (!psas.has(name)) {
      psas.set(
        name,
        readPsa(readFileSync(joinPath(root, folder, `${name}.psa`))),
      );
    }
    return psas.get(name);
  };
  const clips = {};
  let pivots = [];
  for (const [name, [source, options = {}]] of Object.entries(specs)) {
    const clip = psa(source);
    const baked = bakeSkeletal(clip, {
      use: boneNames,
      yaw: component.yaw ?? 0,
      ...options,
    });
    const first = options.first ?? 0;
    const last = options.last ?? clip.frames - 1;
    clips[name] = {
      frames: baked.frames,
      length: (last - first + 1) / clip.rate,
      data: baked.data,
    };
    const [ox, oy, oz] = component.offset ?? [0, 0, 0];
    pivots = baked.pivots.map(([x, y, z]) => [x + ox, y + oy, z + oz]);
  }
  const result = { bones: boneNames.length, pivots: pivots.flat(), clips };
  if (!layer) return result;
  const bones = psa(specs[layer.clip][0]).bones;
  const inside = subtree(bones, layer.root);
  result.layer = {
    clip: layer.clip,
    mask: boneNames.map((name) =>
      inside.has(bones.findIndex((b) => b.name === name)) ? 1 : 0,
    ),
  };
  return result;
}

/**
 * The opening round each port of a building model, by port name. Parts the
 * drawing hides do not count as walls.
 */
function openingsOf(name, prim, ids, bytes) {
  const spec = Object.values(BUILDINGS).find((b) => b.model === name);
  if (!spec) return null;
  const positions = prim.getAttribute("POSITION").getArray();
  const all = prim.getIndices().getArray();
  const indices = all.filter(
    (_, k) => (bytes[ids[all[k - (k % 3)]]] & HIDDEN) === 0,
  );
  const round = (v) => Math.round(v * 1000) / 1000;
  return Object.fromEntries(
    Object.entries(spec.ports).map(([port, at]) => [
      port,
      Object.fromEntries(
        Object.entries(
          measureOpening(positions, indices, at, spec.inset ?? 0),
        ).map(([k, v]) => [k, round(v)]),
      ),
    ]),
  );
}

/** How far a blended pose may stray at a vertex before a frame is kept. */
const KEY_TOLERANCE = 0.01;

/**
 * Keeps the frames of each clip that matter (see keys.mjs) and packs them for
 * the mesh extras: `keys` are the kept source frames, one column each, stored
 * as 16-bit integers with offsets scaled by each bone's `ranges`.
 */
function reduceClips(vat, prim) {
  if (!vat) return null;
  const reach = new Array(vat.bones).fill(0);
  const position = prim.getAttribute("POSITION");
  const bone = prim.getAttribute("_BONE");
  const p = [];
  for (let i = 0; i < position.getCount(); i++) {
    const b = bone.getScalar(i);
    if (b >= vat.bones) continue;
    position.getElement(i, p);
    const pivot = vat.pivots.slice(b * 3, b * 3 + 3);
    reach[b] = Math.max(reach[b], Math.hypot(...p.map((v, k) => v - pivot[k])));
  }
  const kept = Object.entries(vat.clips).map(([name, clip]) => {
    const keys = keyFrames(clip.data, {
      frames: clip.frames,
      bones: vat.bones,
      reach,
      tolerance: KEY_TOLERANCE,
    });
    return { name, clip, keys, data: gather(clip.data, vat.bones, keys) };
  });
  const ranges = offsetRanges(
    kept.map((k) => k.data),
    vat.bones,
  );
  const clips = {};
  for (const { name, clip, keys, data } of kept) {
    const packed = packKeys(data, vat.bones, ranges);
    clips[name] = {
      frames: clip.frames,
      length: clip.length,
      keys,
      data: Buffer.from(packed.buffer).toString("base64"),
    };
  }
  return { ...vat, ranges, clips };
}

/** A model's clips in the actor frame, before reduction. */
function bakeClips(model, pivots, boneNames) {
  const skinned = model.components.find((c) => c.skeletal);
  if (skinned) return bakeSkinnedClips(skinned, boneNames);
  const component = model.components.find((c) => c.vat);
  if (!component) return null;
  const read = (name) =>
    decodeTexture(
      JSON.parse(readFileSync(joinPath(vatDir, `${name}.json`), "utf8")),
      readFileSync(joinPath(vatDir, `${name}.bin`)),
    );
  const meta = (name) =>
    JSON.parse(readFileSync(joinPath(vatDir, `${name}.json`), "utf8"));
  const clips = {};
  let bones = 0;
  for (const [name, [pos, quat, length]] of Object.entries(
    component.vat.clips,
  )) {
    const { width: frames, height, format } = meta(pos);
    bones = Math.max(bones, height);
    const data = convertClip(read(pos), read(quat), {
      frames,
      bones: height,
      yaw: component.yaw ?? 0,
      ranged: format === "PF_A32B32G32R32F",
    });
    clips[name] = {
      frames,
      length,
      data,
    };
  }
  const pivotList = [];
  for (let bone = 0; bone < bones; bone++)
    pivotList.push(...(pivots.get(bone) ?? [0, 0, 0]));
  return { bones, pivots: pivotList, clips };
}

const hexToRgb = (hex) => {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const rgbToHex = (rgb) =>
  `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/**
 * Colours a belt item from its game texture: each face takes the texture under
 * its corners (times the material tint), and the faces settle into a few
 * swatches by k-means, so a heap of ore keeps its rusty and dark patches. The
 * swatch index goes on every vertex as `_SWATCH`; the colours go in the extras.
 */
async function paintSwatches(doc, model, swatches = 4) {
  await doc.transform(unweld());
  const [prim] = doc.getRoot().listMeshes()[0].listPrimitives();
  const count = prim.getAttribute("POSITION").getCount();
  const uv = prim.getAttribute("TEXCOORD_0");
  const png = model.albedo
    ? decode(readFileSync(joinPath(root, model.albedo)))
    : null;
  const tint = model.tint ? hexToRgb(model.tint) : [1, 1, 1];
  const faces = count / 3;
  const colours = new Float32Array(faces * 3);
  const max = png ? 2 ** png.depth - 1 : 1;
  const e = [];
  for (let f = 0; f < faces; f++) {
    for (let k = 0; k < 3; k++) {
      let rgb = [1, 1, 1];
      if (png && uv) {
        uv.getElement(f * 3 + k, e);
        const wrap = (t) => ((t % 1) + 1) % 1;
        const x = Math.floor(wrap(e[0]) * (png.width - 1));
        const y = Math.floor(wrap(e[1]) * (png.height - 1));
        const o = (y * png.width + x) * png.channels;
        rgb = [png.data[o] / max, png.data[o + 1] / max, png.data[o + 2] / max];
      }
      for (let c = 0; c < 3; c++) colours[f * 3 + c] += (rgb[c] * tint[c]) / 3;
    }
  }
  // k-means, seeded at luminance quantiles. Untextured items are one colour.
  const lum = (f) =>
    0.2126 * colours[f * 3] +
    0.7152 * colours[f * 3 + 1] +
    0.0722 * colours[f * 3 + 2];
  const order = Array.from({ length: faces }, (_, f) => f).sort(
    (a, b) => lum(a) - lum(b),
  );
  const k = png ? Math.max(1, Math.min(swatches, faces)) : 1;
  const centres = Array.from({ length: k }, (_, i) => {
    const f = order[Math.floor(((i + 0.5) / k) * faces)];
    return [colours[f * 3], colours[f * 3 + 1], colours[f * 3 + 2]];
  });
  const assign = new Uint8Array(faces);
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let f = 0; f < faces; f++) {
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, i) => {
        const d =
          (colours[f * 3] - c[0]) ** 2 +
          (colours[f * 3 + 1] - c[1]) ** 2 +
          (colours[f * 3 + 2] - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      assign[f] = best;
      for (let c = 0; c < 3; c++) sums[best][c] += colours[f * 3 + c];
      sums[best][3] += 1;
    }
    sums.forEach((s, i) => {
      if (s[3] > 0) centres[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  const swatch = new Uint8Array(count);
  for (let f = 0; f < faces; f++) swatch.fill(assign[f], f * 3, f * 3 + 3);
  prim.setAttribute(
    "_SWATCH",
    doc
      .createAccessor()
      .setType("SCALAR")
      .setArray(swatch)
      .setBuffer(prim.getAttribute("POSITION").getBuffer()),
  );
  prim.setAttribute("TEXCOORD_0", null);
  await doc.transform(weld());
  return centres.map(rgbToHex);
}

/**
 * Splits off the faces an emissive mask lights (sampled through TEXCOORD_0),
 * giving them vertices of their own so they make parts of their own. Returns
 * `previous` (0 where absent), grown to the new vertex count, with `value`
 * for every vertex of a lit face. A colour test reads each face's centre; a
 * channel mask is sampled across the face, and a face it lights only in part
 * is marked GLOW_PARTLY, to be cut along the mask per pixel at draw time.
 */
function splitGlow(
  prim,
  { mask, channel, test, dark, threshold = 0.5 },
  eligible = () => true,
  value = 1,
  previous = null,
) {
  const png = decode(readFileSync(joinPath(root, mask)));
  const max = 2 ** png.depth - 1;
  // Texels as the shader's nearest, repeating lookup finds them.
  const texel = (x, y) => {
    const tx = ((x % png.width) + png.width) % png.width;
    const ty = ((y % png.height) + png.height) % png.height;
    const at = (ty * png.width + tx) * png.channels;
    // A colour test reads the texel as 0–255 RGB; otherwise one channel.
    if (test) {
      const rgb = [0, 1, 2].map((c) => (png.data[at + c] / max) * 255);
      return test(rgb);
    }
    return png.data[at + channel] / max > threshold;
  };
  const lit = (u, v) =>
    texel(Math.floor(u * png.width), Math.floor(v * png.height));
  // Every texel a face's UVs touch, within a texel's margin, so no stroke of
  // the mask thinner than the sampling grid slips through.
  const scan = (corners) => {
    const p = corners.map(([u, v]) => [u * png.width, v * png.height]);
    const area =
      (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) -
      (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    const edges = [0, 1, 2].map((k) => {
      const [a, b] = [p[k], p[(k + 1) % 3]];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return { a, b, length };
    });
    const inside = (x, y) =>
      edges.every(({ a, b, length }) => {
        const cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        return (Math.sign(area) || 1) * cross >= -GLOW_MARGIN * length;
      });
    const xs = p.map((q) => q[0]);
    const ys = p.map((q) => q[1]);
    let shown = 0;
    let samples = 0;
    for (
      let y = Math.floor(Math.min(...ys) - 1);
      y <= Math.max(...ys) + 1;
      y++
    ) {
      for (
        let x = Math.floor(Math.min(...xs) - 1);
        x <= Math.max(...xs) + 1;
        x++
      ) {
        if (!inside(x + 0.5, y + 0.5)) continue;
        samples += 1;
        if (texel(x, y)) shown += 1;
      }
    }
    return { shown, samples };
  };
  const uv = prim.getAttribute("TEXCOORD_0");
  const position = prim.getAttribute("POSITION");
  const indices = prim.getIndices();
  const index = Array.from(indices.getArray());
  const count = prim.getAttribute("POSITION").getCount();
  const copies = new Map();
  // Faces lit in part get copies of their own: their vertices carry `_MASK`.
  const partly = new Map();
  const e = [];
  const corners = [[], [], []];
  for (let t = 0; t < index.length; t += 3) {
    if (!eligible(index[t])) continue;
    for (let k = 0; k < 3; k++) uv.getElement(index[t + k], corners[k]);
    let shown = 0;
    let samples = 0;
    if (test) {
      const u = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
      const v = (corners[0][1] + corners[1][1] + corners[2][1]) / 3;
      shown = lit(u, v) ? 1 : 0;
      samples = 1;
    } else {
      ({ shown, samples } = scan(corners));
      const n = GLOW_SAMPLES;
      for (let a = 0; a <= n; a++) {
        for (let b = 0; a + b <= n; b++) {
          const [w0, w1] = [a / n, b / n];
          const w2 = 1 - w0 - w1;
          const at = (c) =>
            corners[0][c] * w0 + corners[1][c] * w1 + corners[2][c] * w2;
          if (lit(at(0), at(1))) shown += 1;
          samples += 1;
        }
      }
    }
    if (shown === 0) continue;
    // Faces the model keeps dark, by their middle, stay with their part.
    if (dark) {
      const middle = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        position.getElement(index[t + k], e);
        for (let c = 0; c < 3; c++) middle[c] += e[c] / 3;
      }
      if (dark(middle)) continue;
    }
    // A channel mask is read per pixel on every face it lights: for its
    // shape, its colour, and to tell its glyphs from other accents.
    const these = shown < samples || !test ? partly : copies;
    for (let k = 0; k < 3; k++) {
      const from = index[t + k];
      if (!these.has(from)) {
        these.set(from, count + copies.size + partly.size);
      }
      index[t + k] = these.get(from);
    }
  }
  const sources = [
    ...[...copies].map(([from, to]) => ({ from, to })),
    ...[...partly].map(([from, to]) => ({ from, to, partly: true })),
  ].sort((a, b) => a.to - b.to);
  for (const semantic of prim.listSemantics()) {
    const attribute = prim.getAttribute(semantic);
    const size = attribute.getElementSize();
    const old = attribute.getArray();
    const grown = new old.constructor((count + sources.length) * size);
    grown.set(old);
    for (const { from, to } of sources) {
      grown.set(old.subarray(from * size, from * size + size), to * size);
    }
    attribute.setArray(grown);
  }
  indices.setArray(new Uint32Array(index));
  const glow = new Uint8Array(count + sources.length);
  if (previous) glow.set(previous);
  for (const { to, partly } of sources) {
    glow[to] = value | (partly ? GLOW_PARTLY : 0);
  }
  return glow;
}

/** How far, in texels, an output's square reaches past its bright middle. */
const OUTPUT_RIM = 3;
/** The largest glow mask shipped, in texels a side. */
const GLOW_MASK_MOST = 1024;

/**
 * A model's glow mask as the shader reads it: lit or not, at its threshold.
 * A larger mask is pooled down, a texel lit if any it covers is, so thin
 * strokes stay.
 */
function glowMask({ mask, channel, threshold = 0.5, output }) {
  const png = decode(readFileSync(joinPath(root, mask)));
  const max = 2 ** png.depth - 1;
  const pool = Math.max(
    1,
    Math.ceil(Math.max(png.width, png.height) / GLOW_MASK_MOST),
  );
  const width = Math.ceil(png.width / pool);
  const height = Math.ceil(png.height / pool);
  const out = new Uint8Array(width * height);
  const value = (x, y) =>
    png.data[(y * png.width + x) * png.channels + channel] / max;
  // An output's square fades at its rim through the inputs' level; it stays
  // an output out to OUTPUT_RIM texels from its bright middle.
  const bright = (x, y) => {
    for (let dy = -OUTPUT_RIM; dy <= OUTPUT_RIM; dy++) {
      for (let dx = -OUTPUT_RIM; dx <= OUTPUT_RIM; dx++) {
        const [sx, sy] = [x + dx, y + dy];
        if (sx < 0 || sy < 0 || sx >= png.width || sy >= png.height) continue;
        if (value(sx, sy) > output.threshold) return true;
      }
    }
    return false;
  };
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (value(x, y) <= threshold) continue;
      // Lit at 128; a two-tone mask's outputs at 255.
      const level = output && bright(x, y) ? 255 : 128;
      const at = Math.floor(y / pool) * width + Math.floor(x / pool);
      out[at] = Math.max(out[at], level);
    }
  }
  return { width, height, data: out };
}

/** `_MASK` for faces lit in part: their mask UVs; 0 elsewhere. */
function seedMask(doc, prim, glow) {
  const uv = prim.getAttribute("TEXCOORD_0");
  const mask = new Float32Array(glow.length * 4);
  const e = [];
  for (let v = 0; v < glow.length; v++) {
    if (glow[v] & GLOW_PARTLY) mask.set(uv.getElement(v, e), v * 4);
  }
  return doc
    .createAccessor()
    .setType("VEC4")
    .setArray(mask)
    .setBuffer(prim.getAttribute("POSITION").getBuffer());
}

/**
 * Completes `_MASK` with how to draw where the mask leaves a face dark: as
 * the part beside it that it was split from, by that part's byte plus one
 * (0 for none) and its id less the face's own.
 */
function finishMask(prim, glow, ids, bytes, unlit) {
  const position = prim.getAttribute("POSITION");
  const attribute = prim.getAttribute("_MASK");
  const mask = attribute.getArray();
  const key = (v) =>
    position
      .getElement(v, [])
      .map((c) => Math.round(c * 2000))
      .join(",");
  const plainAt = new Map();
  for (let v = 0; v < glow.length; v++) {
    if ((glow[v] & 7) === 0) plainAt.set(key(v), ids[v]);
  }
  const index = prim.getIndices().getArray();
  for (let t = 0; t < index.length; t += 3) {
    const face = [index[t], index[t + 1], index[t + 2]];
    if (!(glow[face[0]] & GLOW_PARTLY)) continue;
    const own = ids[face[0]];
    const beside = face
      .map((v) => plainAt.get(key(v)))
      .find((id) => id !== undefined);
    const byte = beside === undefined ? unlit(own) : bytes[beside];
    for (const v of face) {
      mask[v * 4 + 2] = byte + 1;
      mask[v * 4 + 3] = (beside ?? own) - own;
    }
  }
  attribute.setArray(mask);
}

/**
 * Union-find over welded positions; returns parts sorted largest first.
 * Vertices flagged in `apart` only join each other.
 */
function findParts(prim, apart = null) {
  const pos = prim.getAttribute("POSITION");
  const idx = prim.getIndices().getArray();
  const n = pos.getCount();
  const canonical = new Int32Array(n);
  const seen = new Map();
  const e = [];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, e);
    const k = `${e.map((v) => Math.round(v * 2000)).join(",")}|${apart?.[i] ?? 0}`;
    if (!seen.has(k)) seen.set(k, i);
    canonical[i] = seen.get(k);
  }
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(canonical[idx[t]]);
    parent[find(canonical[idx[t + 1]])] = a;
    parent[find(canonical[idx[t + 2]])] = a;
  }
  const byRoot = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(canonical[i]);
    let part = byRoot.get(r);
    if (!part) {
      part = { verts: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
      byRoot.set(r, part);
    }
    part.verts.push(i);
    pos.getElement(i, e);
    for (let d = 0; d < 3; d++) {
      part.min[d] = Math.min(part.min[d], e[d]);
      part.max[d] = Math.max(part.max[d], e[d]);
    }
  }
  const extent = (p) => Math.hypot(...p.max.map((v, d) => v - p.min[d]));
  return [...byRoot.values()].sort((a, b) => extent(b) - extent(a));
}

/**
 * Keeps a decal's faces that use one tile of its atlas (a grate, say) and
 * drops the rest. Their UVs, mapped onto the tile, go in `_CUT`; the tile's
 * alpha, as a small mask, cuts the gaps out at draw time.
 */
function keepCutout(doc, prim, { region }) {
  const [u0, v0, u1, v1] = region;
  const uv = prim.getAttribute("TEXCOORD_0");
  const index = prim.getIndices().getArray();
  const kept = [];
  const e = [];
  for (let t = 0; t < index.length; t += 3) {
    let u = 0;
    let v = 0;
    for (let k = 0; k < 3; k++) {
      uv.getElement(index[t + k], e);
      u += e[0] / 3;
      v += e[1] / 3;
    }
    if (u >= u0 && u <= u1 && v >= v0 && v <= v1) {
      kept.push(index[t], index[t + 1], index[t + 2]);
    }
  }
  prim.getIndices().setArray(new Uint32Array(kept));
  compactPrimitive(prim);
  const count = prim.getAttribute("POSITION").getCount();
  const cut = new Float32Array(count * 2);
  const local = prim.getAttribute("TEXCOORD_0");
  for (let i = 0; i < count; i++) {
    local.getElement(i, e);
    cut[i * 2] = (e[0] - u0) / (u1 - u0);
    cut[i * 2 + 1] = (e[1] - v0) / (v1 - v0);
  }
  prim.setAttribute(
    "_CUT",
    doc
      .createAccessor()
      .setType("VEC2")
      .setArray(cut)
      .setBuffer(prim.getAttribute("POSITION").getBuffer()),
  );
  return kept.length / 3;
}

/** A model's cutout tile's alpha, `size` square, from its atlas. */
function cutoutMask({ mask, region, size }) {
  const png = decode(readFileSync(joinPath(root, mask)));
  const [u0, v0, u1, v1] = region;
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = Math.floor((u0 + ((x + 0.5) / size) * (u1 - u0)) * png.width);
      const py = Math.floor((v0 + ((y + 0.5) / size) * (v1 - v0)) * png.height);
      const a = png.data[(py * png.width + px) * png.channels + 3];
      out[y * size + x] = a > 127 ? 255 : 0;
    }
  }
  return { size, data: out };
}

let total = 0;
const packed = [];
/**
 * Raw bytes that ship as their own pack entries, named in the extras that
 * use them: base64 in the glTF's JSON would be parsed and decoded on the
 * page's main thread, and the masks run to megabytes.
 */
const blobs = [];
function blob(entry, { data, ...rest }) {
  blobs.push({ name: entry, data });
  return { ...rest, entry };
}
for (const model of MODELS) {
  const { doc, pivots, boneNames } = await readModel(model);
  const docRoot = doc.getRoot();
  const material = doc.createMaterial("paper");

  for (const mesh of docRoot.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName() ?? "";
      if (/decal/i.test(name)) {
        const tile = model.cutout && /DecalColor/i.test(name);
        if (!tile || keepCutout(doc, prim, model.cutout) === 0) {
          prim.dispose();
          continue;
        }
      } else if (model.cutout) {
        // Every primitive carries _CUT so they join; -1 marks no cutout.
        const count = prim.getAttribute("POSITION").getCount();
        prim.setAttribute(
          "_CUT",
          doc
            .createAccessor()
            .setType("VEC2")
            .setArray(new Float32Array(count * 2).fill(-1))
            .setBuffer(prim.getAttribute("POSITION").getBuffer()),
        );
      }
      for (const semantic of prim.listSemantics()) {
        const keep =
          semantic === "POSITION" ||
          semantic === "NORMAL" ||
          semantic === "_SRC" ||
          semantic === "_BONE" ||
          semantic === "_CUT" ||
          ((model.albedo || model.glow) && semantic === "TEXCOORD_0");
        if (!keep) {
          prim.setAttribute(semantic, null);
        }
      }
      prim.setMaterial(material);
    }
  }
  await doc.transform(
    flatten(),
    dedup(),
    join({ keepNamed: false }),
    prune({ keepAttributes: true }),
    weld(),
  );

  const meshes = docRoot.listMeshes();
  const prims = meshes.flatMap((m) => m.listPrimitives());
  if (meshes.length !== 1 || prims.length !== 1) {
    throw new Error(
      `${model.name}: expected one primitive, got ${prims.length}`,
    );
  }
  const [mesh] = meshes;
  const [prim] = prims;
  // Only the static blueprint meshes use the model's glow mask's textures;
  // an animated component names its own. Faces lit by a component's mask
  // are where the building's light comes from (GLOW_EMITTER).
  const animated = new Set(
    model.components.flatMap((c, i) => (c.vat || c.skeletal ? [i] : [])),
  );
  const componentOf = (v) => prim.getAttribute("_SRC").getScalar(v) >> 1;
  // Decal cutouts read their atlas through TEXCOORD_0, not the glow masks.
  const cutAt = prim.getAttribute("_CUT");
  const plain = (v) => !cutAt || cutAt.getElement(v, [])[0] < 0;
  let glow = null;
  let flags = null;
  if (model.glow) {
    flags = splitGlow(
      prim,
      model.glow,
      (v) => !animated.has(componentOf(v)) && plain(v),
      model.glow.power ? GLOW_POWER : 1,
    );
  }
  for (const [i, component] of model.components.entries()) {
    for (const glowing of [component.glow ?? []].flat()) {
      flags = splitGlow(
        prim,
        glowing,
        (v) => componentOf(v) === i,
        glowing.power ? GLOW_POWER : GLOW_EMITTER,
        flags,
      );
    }
  }
  if (flags) {
    // Carry the flag as an attribute so welding again, once the UVs that
    // split the seams are gone, keeps glowing faces apart.
    prim.setAttribute(
      "_GLOW",
      doc
        .createAccessor()
        .setType("SCALAR")
        .setArray(flags)
        .setBuffer(prim.getAttribute("POSITION").getBuffer()),
    );
    if (flags.some((f) => f & GLOW_PARTLY)) {
      prim.setAttribute("_MASK", seedMask(doc, prim, flags));
    }
    if (!model.albedo) prim.setAttribute("TEXCOORD_0", null);
    await doc.transform(weld());
    glow = prim.getAttribute("_GLOW").getArray();
  }
  const parts = findParts(
    prim,
    glow?.map((g) => g & 7),
  );
  if (parts.length > 65535) throw new Error(`${model.name}: too many parts`);

  const ids = new Uint16Array(prim.getAttribute("POSITION").getCount());
  const bytes = new Uint8Array(parts.length);
  const debug = [];
  /** What each part would be without its glow, for faces lit in part. */
  const unlitBytes = new Uint8Array(parts.length);
  const sources = prim.getAttribute("_SRC");
  const boneOf = prim.getAttribute("_BONE");
  const cutOf = prim.getAttribute("_CUT");
  parts.forEach((part, id) => {
    for (const v of part.verts) ids[v] = id;
    const box = {
      id,
      /** Index of the blueprint component the part belongs to. */
      component: sources.getScalar(part.verts[0]) >> 1,
      /** Its material glows in the game. */
      emissive: (sources.getScalar(part.verts[0]) & 1) === 1,
      /** It is one of the faces the game's emissive mask lights. */
      glow: ((glow?.[part.verts[0]] ?? 0) & 7) > 0,
      /** Its light is the building's own: a component's mask lights it. */
      emitter: ((glow?.[part.verts[0]] ?? 0) & 7) === GLOW_EMITTER,
      /** It glows while the line has power: a power light. */
      power: ((glow?.[part.verts[0]] ?? 0) & 7) === GLOW_POWER,
      /** It is cut from a decal's tile: drawn where the tile is opaque. */
      cutout: (cutOf?.getElement(part.verts[0], [])[0] ?? -1) >= 0,
      /** The skinned bone it follows, by the game's name. */
      bone: boneNames?.[boneOf.getScalar(part.verts[0])] ?? null,
      min: part.min.map((v) => +v.toFixed(3)),
      max: part.max.map((v) => +v.toFixed(3)),
    };
    // Glowing faces are the lit accent, whatever else the part would be.
    bytes[id] = box.glow
      ? (model.role(box) & ~7) |
        LIT |
        (box.emitter ? EMITTER : 0) |
        (box.power ? POWERED : 0)
      : box.cutout
        ? (model.role(box) & ~7) | DETAIL_ROLE | CUTOUT
        : model.role(box);
    debug.push({ ...box, verts: part.verts.length, byte: bytes[id] });
    unlitBytes[id] = model.role(box);
  });
  const masked = Boolean(prim.getAttribute("_MASK"));
  if (masked) {
    finishMask(prim, glow, ids, bytes, (id) => unlitBytes[id]);
  }
  prim.setAttribute(
    "_PART",
    doc
      .createAccessor()
      .setType("SCALAR")
      .setArray(ids)
      .setBuffer(prim.getAttribute("POSITION").getBuffer()),
  );
  prim.setAttribute("_SRC", null);
  prim.setAttribute("_GLOW", null);
  const palette =
    model.albedo || model.tint ? await paintSwatches(doc, model) : null;
  // Nothing from the game's naming goes out.
  for (const node of docRoot.listNodes()) node.setName("");
  for (const scene of docRoot.listScenes()) scene.setName("");
  docRoot.getAsset().generator = "factory";
  mesh.setName(model.name);
  const vat = reduceClips(bakeClips(model, pivots, boneNames), prim);
  const openings = openingsOf(model.name, prim, ids, bytes);
  mesh.setExtras({
    parts: Buffer.from(bytes).toString("base64"),
    ...(palette ? { palette } : {}),
    ...(vat ? { vat } : {}),
    ...(openings ? { openings } : {}),
    ...(model.cutout
      ? { cutout: blob(`${model.name}.cutout`, cutoutMask(model.cutout)) }
      : {}),
    ...(masked && model.glow
      ? { glowMask: blob(`${model.name}.glow`, glowMask(model.glow)) }
      : {}),
    ...(model.glow?.colour
      ? {
          glyph: {
            colour: model.glow.colour,
            lamp: !!model.glow.power,
            ...(model.glow.output ? { output: model.glow.output.colour } : {}),
          },
        }
      : {}),
  });

  await doc.transform(
    reorder({ encoder: MeshoptEncoder }),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 8,
      pattern: /^(POSITION|NORMAL)$/,
    }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  const file = joinPath(outDir, `${model.name}.glb`);
  const glb = await io.writeBinary(doc);
  writeFileSync(file, glb);
  packed.push({ name: model.name, data: glb });
  if (debugDir) {
    writeFileSync(
      joinPath(debugDir, `${model.name}.json`),
      JSON.stringify(debug),
    );
  }
  total += glb.byteLength;
  const tris =
    docRoot.listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
  console.log(
    `${model.name.padEnd(12)} ${String(tris).padStart(6)} tris ${String(parts.length).padStart(4)} parts ${(glb.byteLength / 1024).toFixed(0).padStart(5)} KB`,
  );
}
mkdirSync(resolve(packFile, ".."), { recursive: true });
const pack = await packModels([...packed, ...blobs], async (bytes) =>
  gzipSync(bytes, { level: 9 }),
);
const hash = createHash("sha256").update(pack).digest("hex").slice(0, 10);
const packTo = packFile.replace("[hash]", hash);
if (packTo !== packFile) {
  // The packs this one replaces, by the same pattern.
  const [head, tail] = basename(packFile).split("[hash]");
  for (const old of readdirSync(dirname(packFile))) {
    if (
      old.startsWith(head) &&
      old.endsWith(tail) &&
      old !== basename(packTo)
    ) {
      rmSync(joinPath(dirname(packFile), old));
    }
  }
}
writeFileSync(packTo, pack);
const publicDir = resolve("public");
if (packTo.startsWith(publicDir + sep)) {
  const url = `/${relative(publicDir, packTo).split(sep).join("/")}`;
  writeFileSync(
    resolve("components/figures/factory/models-url.ts"),
    `// Generated by scripts/factory/build.mjs with the model pack: do not edit.\n` +
      `// The name carries a hash of the pack, so it is cached for good.\n` +
      `export const MODELS_URL = ${JSON.stringify(url)};\n`,
  );
}
console.log(
  `models ${(total / 1024).toFixed(0)} KB, packed ${(pack.length / 1024).toFixed(0)} KB → ${packTo}`,
);
