// Builds the factory line models from glTF exports of the game's meshes.
//
//   pnpm exec tsx scripts/factory/build.mjs <exportsRoot> <outDir> [--debug <dir>]
//     [--pack <file>]
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
// public/factory/models.bin, with no names from the game. <outDir> holds plain copies for inspection:
// keep it outside the repository.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join as joinPath, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
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
import { HIDDEN, LIT, MODELS } from "./models.mjs";
import { measureOpening } from "./openings.mjs";
import { bakeSkeletal, readPsa, subtree } from "./skeletal.mjs";
import { convertClip, decodeTexture, turn } from "./vat.mjs";

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
  packAt > 0 ? args[packAt + 1] : "public/factory/models.bin",
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
 * Splits off the faces a model's emissive mask lights (sampled at each face's
 * centre through TEXCOORD_0), giving them vertices of their own so they make
 * parts of their own. Returns 1 per vertex of a lit face.
 */
function splitGlow(prim, { mask, channel, dark }, eligible = () => true) {
  const png = decode(readFileSync(joinPath(root, mask)));
  const max = 2 ** png.depth - 1;
  const lit = (u, v) => {
    const wrap = (t) => ((t % 1) + 1) % 1;
    const x = Math.floor(wrap(u) * (png.width - 1));
    const y = Math.floor(wrap(v) * (png.height - 1));
    return png.data[(y * png.width + x) * png.channels + channel] / max > 0.5;
  };
  const uv = prim.getAttribute("TEXCOORD_0");
  const position = prim.getAttribute("POSITION");
  const indices = prim.getIndices();
  const index = Array.from(indices.getArray());
  const count = prim.getAttribute("POSITION").getCount();
  const copies = new Map();
  const e = [];
  for (let t = 0; t < index.length; t += 3) {
    if (!eligible(index[t])) continue;
    let u = 0;
    let v = 0;
    for (let k = 0; k < 3; k++) {
      uv.getElement(index[t + k], e);
      u += e[0] / 3;
      v += e[1] / 3;
    }
    if (!lit(u, v)) continue;
    // Faces the model keeps dark, by their middle, stay with their part.
    if (dark) {
      const middle = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        position.getElement(index[t + k], e);
        for (let c = 0; c < 3; c++) middle[c] += e[c] / 3;
      }
      if (dark(middle)) continue;
    }
    for (let k = 0; k < 3; k++) {
      const from = index[t + k];
      if (!copies.has(from)) copies.set(from, count + copies.size);
      index[t + k] = copies.get(from);
    }
  }
  const sources = [...copies.keys()];
  for (const semantic of prim.listSemantics()) {
    const attribute = prim.getAttribute(semantic);
    const size = attribute.getElementSize();
    const old = attribute.getArray();
    const grown = new old.constructor((count + sources.length) * size);
    grown.set(old);
    sources.forEach((from, i) => {
      grown.set(
        old.subarray(from * size, from * size + size),
        (count + i) * size,
      );
    });
    attribute.setArray(grown);
  }
  indices.setArray(new Uint32Array(index));
  const glow = new Uint8Array(count + sources.length);
  glow.fill(1, count);
  return glow;
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

let total = 0;
const packed = [];
for (const model of MODELS) {
  const { doc, pivots, boneNames } = await readModel(model);
  const docRoot = doc.getRoot();
  const material = doc.createMaterial("paper");

  for (const mesh of docRoot.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (/decal/i.test(prim.getMaterial()?.getName() ?? "")) {
        prim.dispose();
        continue;
      }
      for (const semantic of prim.listSemantics()) {
        const keep =
          semantic === "POSITION" ||
          semantic === "NORMAL" ||
          semantic === "_SRC" ||
          semantic === "_BONE" ||
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
  // Only the static blueprint meshes use the glow mask's textures.
  const animated = new Set(
    model.components.flatMap((c, i) => (c.vat || c.skeletal ? [i] : [])),
  );
  let glow = null;
  if (model.glow) {
    const flags = splitGlow(
      prim,
      model.glow,
      (v) => !animated.has(prim.getAttribute("_SRC").getScalar(v) >> 1),
    );
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
    if (!model.albedo) prim.setAttribute("TEXCOORD_0", null);
    await doc.transform(weld());
    glow = prim.getAttribute("_GLOW").getArray();
  }
  const parts = findParts(prim, glow);
  if (parts.length > 65535) throw new Error(`${model.name}: too many parts`);

  const ids = new Uint16Array(prim.getAttribute("POSITION").getCount());
  const bytes = new Uint8Array(parts.length);
  const debug = [];
  const sources = prim.getAttribute("_SRC");
  const boneOf = prim.getAttribute("_BONE");
  parts.forEach((part, id) => {
    for (const v of part.verts) ids[v] = id;
    const box = {
      id,
      /** Index of the blueprint component the part belongs to. */
      component: sources.getScalar(part.verts[0]) >> 1,
      /** Its material glows in the game. */
      emissive: (sources.getScalar(part.verts[0]) & 1) === 1,
      /** It is one of the faces the game's emissive mask lights. */
      glow: glow?.[part.verts[0]] === 1,
      /** The skinned bone it follows, by the game's name. */
      bone: boneNames?.[boneOf.getScalar(part.verts[0])] ?? null,
      min: part.min.map((v) => +v.toFixed(3)),
      max: part.max.map((v) => +v.toFixed(3)),
    };
    // Glowing faces are the lit accent, whatever else the part would be.
    bytes[id] = box.glow
      ? (model.role(box) & ~7) | (model.glowTone ?? LIT)
      : model.role(box);
    debug.push({ ...box, verts: part.verts.length, byte: bytes[id] });
  });
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
const pack = await packModels(packed, async (bytes) =>
  gzipSync(bytes, { level: 9 }),
);
writeFileSync(packFile, pack);
console.log(
  `models ${(total / 1024).toFixed(0)} KB, packed ${(pack.length / 1024).toFixed(0)} KB → ${packFile}`,
);
