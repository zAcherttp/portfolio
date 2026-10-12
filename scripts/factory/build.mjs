// Builds the factory line models from glTF exports of the game's meshes.
//
//   pnpm exec tsx scripts/factory/build.mjs <exportsRoot> <outDir> [--debug <dir>]
//
// <exportsRoot> holds FactoryGame/Content/... as written by FModel or a
// CUE4Parse exporter. For every model in models.mjs this places each
// blueprint component mesh in the actor frame, drops decals, UVs, tangents and
// colours, merges everything into one primitive, tags each
// connected piece with a `_PART` id (largest first), bakes one byte per part
// (tone role | flags) into the mesh extras as base64, then quantizes and
// meshopt-compresses into <outDir>/<name>.glb. Belt items also get colour
// swatches from their game texture (see paintSwatches); their UVs then go.
//
// The site gets every model in one scrambled blob, public/factory/models.bin,
// with no names from the game. <outDir> holds plain copies for inspection:
// keep it outside the repository.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join as joinPath, resolve } from "node:path";
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
import { packModels } from "../../components/figures/factory/pack.ts";
import { MODELS } from "./models.mjs";

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

/** Reads every component of a model into one document, in the actor frame. */
async function readModel(model) {
  let doc = null;
  for (const [index, component] of model.components.entries()) {
    const part = await io.read(joinPath(root, component.source));
    part.setLogger(new Logger(Logger.Verbosity.WARN));
    const matrix = componentMatrix(component);
    const buffer = part.getRoot().listBuffers()[0] ?? part.createBuffer();
    for (const mesh of part.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
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
  return doc;
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

/** Union-find over welded positions; returns parts sorted largest first. */
function findParts(prim) {
  const pos = prim.getAttribute("POSITION");
  const idx = prim.getIndices().getArray();
  const n = pos.getCount();
  const canonical = new Int32Array(n);
  const seen = new Map();
  const e = [];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, e);
    const k = e.map((v) => Math.round(v * 2000)).join(",");
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
  const doc = await readModel(model);
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
          (model.albedo && semantic === "TEXCOORD_0");
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
  const parts = findParts(prim);
  if (parts.length > 65535) throw new Error(`${model.name}: too many parts`);

  const ids = new Uint16Array(prim.getAttribute("POSITION").getCount());
  const bytes = new Uint8Array(parts.length);
  const debug = [];
  const sources = prim.getAttribute("_SRC");
  parts.forEach((part, id) => {
    for (const v of part.verts) ids[v] = id;
    const box = {
      id,
      /** Index of the blueprint component the part belongs to. */
      component: sources.getScalar(part.verts[0]) >> 1,
      /** Its material glows in the game. */
      emissive: (sources.getScalar(part.verts[0]) & 1) === 1,
      min: part.min.map((v) => +v.toFixed(3)),
      max: part.max.map((v) => +v.toFixed(3)),
    };
    bytes[id] = model.role(box);
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
  const palette =
    model.albedo || model.tint ? await paintSwatches(doc, model) : null;
  // Nothing from the game's naming goes out.
  for (const node of docRoot.listNodes()) node.setName("");
  for (const scene of docRoot.listScenes()) scene.setName("");
  docRoot.getAsset().generator = "factory";
  mesh.setName(model.name);
  mesh.setExtras({
    parts: Buffer.from(bytes).toString("base64"),
    ...(palette ? { palette } : {}),
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
writeFileSync(packFile, packModels(packed));
console.log(`total ${(total / 1024).toFixed(0)} KB → ${packFile}`);
