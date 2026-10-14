// Loads the factory's packed models and readies them for drawing.

import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Clips } from "./animation";
import type { ModelName, Opening } from "./layout";
import { unpackModels } from "./pack";
import { createPartsTexture } from "./shaders";

export const MODELS_URL = "/factory/models.bin";

/**
 * Baked vertex animation: a float texture with frames across; rows are each
 * bone's offset, then each bone's rotation, then one row of pivots by bone,
 * with w set for the bones a layer clip drives.
 */
export interface Animation {
  texture: THREE.DataTexture;
  bones: number;
  clips: Clips;
  /** A clip that plays over some bones on its own clock, like a reload. */
  layer?: string;
}

export interface Model {
  geometry: THREE.BufferGeometry;
  parts: THREE.Texture;
  partCount: number;
  /** Game colours of a belt item, by its `_swatch` attribute. */
  swatches?: string[];
  animation?: Animation;
  /** A building's openings by port name, measured from the game's mesh. */
  openings?: Record<string, Opening>;
  /** The alpha its cutout parts are cut by, through their `_cut` UVs. */
  cutout?: THREE.Texture;
  /** Its glow mask, cutting faces lit in part along it, through `_mask`. */
  glowMask?: THREE.Texture;
  /** The game's colour for what its mask lights; `lamp` for power lamps. */
  glyph?: Glyph;
}

export interface Glyph {
  colour: string;
  lamp: boolean;
  /** Outputs' colour, where the mask is brightest. */
  output?: string;
}

interface BakedAnimation {
  bones: number;
  pivots: number[];
  /** Source frames, the kept ones by index, and their columns. */
  clips: Record<
    string,
    { frames: number; length: number; keys?: number[]; data: string }
  >;
  layer?: { clip: string; mask: number[] };
  /** Each bone's offset scale: clip data is 16-bit, offsets over this range. */
  ranges: number[];
}

function bakeAnimation(baked: BakedAnimation): Animation {
  const { bones } = baked;
  const clips: Clips = {};
  let columns = 0;
  for (const [name, c] of Object.entries(baked.clips)) {
    const keys = c.keys ?? Array.from({ length: c.frames }, (_, f) => f);
    clips[name] = {
      start: columns,
      frames: keys.length,
      length: c.length,
      times: keys.map((f) => (f * c.length) / c.frames),
    };
    columns += keys.length;
  }
  const width = Math.max(columns, bones);
  const height = bones * 2 + 1;
  const data = new Float32Array(width * height * 4);
  for (const [name, c] of Object.entries(baked.clips)) {
    const raw = Uint8Array.from(atob(c.data), (ch) => ch.charCodeAt(0));
    const packed = new Int16Array(raw.buffer);
    const values = Float32Array.from(packed, (v, i) => {
      const k = i % 7;
      const scale = k < 3 ? baked.ranges[Math.floor(i / 7) % bones] : 1;
      return (v / 32767) * scale;
    });
    const start = clips[name].start;
    for (let f = 0; f < clips[name].frames; f++) {
      for (let b = 0; b < bones; b++) {
        const v = (f * bones + b) * 7;
        const offset = (b * width + start + f) * 4;
        data.set([values[v], values[v + 1], values[v + 2], 0], offset);
        const rotation = ((bones + b) * width + start + f) * 4;
        data.set(values.subarray(v + 3, v + 7), rotation);
      }
    }
  }
  for (let b = 0; b < bones; b++) {
    data.set(
      [...baked.pivots.slice(b * 3, b * 3 + 3), baked.layer?.mask[b] ?? 0],
      (bones * 2 * width + b) * 4,
    );
  }
  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.needsUpdate = true;
  return { texture, bones, clips, layer: baked.layer?.clip };
}

function toFloat(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
) {
  const out = new Float32Array(attribute.count * 3);
  for (let i = 0; i < attribute.count; i++) {
    out[i * 3] = attribute.getX(i);
    out[i * 3 + 1] = attribute.getY(i);
    out[i * 3 + 2] = attribute.getZ(i);
  }
  return new THREE.BufferAttribute(out, 3);
}

/** Dequantizes a model into plain metres so shaders can spin parts in place. */
function prepare(scene: THREE.Object3D): Model {
  let mesh: THREE.Mesh | undefined;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  if (!mesh) throw new Error("Factory model has no mesh.");
  const source = mesh.geometry;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", toFloat(source.getAttribute("position")));
  geometry.setAttribute("normal", toFloat(source.getAttribute("normal")));
  geometry.setAttribute("_part", source.getAttribute("_part"));
  const swatch = source.getAttribute("_swatch");
  if (swatch) geometry.setAttribute("_swatch", swatch);
  const bone = source.getAttribute("_bone");
  if (bone) geometry.setAttribute("_bone", bone);
  const cut = source.getAttribute("_cut");
  if (cut) geometry.setAttribute("_cut", cut);
  const mask = source.getAttribute("_mask");
  if (mask) geometry.setAttribute("_mask", mask);
  geometry.setIndex(source.getIndex());
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingSphere();
  const encoded = (mesh.userData.parts as string | undefined) ?? "";
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  return {
    geometry,
    parts: createPartsTexture(bytes),
    partCount: Math.max(1, bytes.length),
    swatches: mesh.userData.palette as string[] | undefined,
    animation: mesh.userData.vat
      ? bakeAnimation(mesh.userData.vat as BakedAnimation)
      : undefined,
    openings: mesh.userData.openings as Record<string, Opening> | undefined,
    cutout: mesh.userData.cutout
      ? maskTexture(mesh.userData.cutout as Mask)
      : undefined,
    glowMask: mesh.userData.glowMask
      ? maskTexture(mesh.userData.glowMask as Mask)
      : undefined,
    glyph: mesh.userData.glyph as Glyph | undefined,
  };
}

/** A one-channel mask as the build ships it: square `size`, or its sides. */
interface Mask {
  size?: number;
  width?: number;
  height?: number;
  data: string;
}

/** A one-channel mask: a decal tile's alpha, or where a glow mask lights. */
function maskTexture({ size, width = size, height = size, data }: Mask) {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const texture = new THREE.DataTexture(
    bytes,
    width,
    height,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export async function loadModels(
  signal?: AbortSignal,
): Promise<Map<ModelName, Model>> {
  const response = await fetch(MODELS_URL, { signal });
  if (!response.ok) throw new Error(`Factory models: ${response.status}`);
  const entries = await unpackModels(
    new Uint8Array(await response.arrayBuffer()),
  );
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const models = new Map<ModelName, Model>();
  for (const [name, data] of entries) {
    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    const gltf = await loader.parseAsync(buffer, "");
    models.set(name as ModelName, prepare(gltf.scene));
  }
  return models;
}
