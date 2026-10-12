// Loads the factory's packed models and readies them for drawing.

import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ModelName } from "./layout";
import { unpackModels } from "./pack";
import { createPartsTexture } from "./shaders";

export const MODELS_URL = "/factory/models.bin";

export interface Model {
  geometry: THREE.BufferGeometry;
  parts: THREE.Texture;
  partCount: number;
  /** Game colours of a belt item, by its `_swatch` attribute. */
  swatches?: string[];
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
  };
}

export async function loadModels(
  signal?: AbortSignal,
): Promise<Map<ModelName, Model>> {
  const response = await fetch(MODELS_URL, { signal });
  if (!response.ok) throw new Error(`Factory models: ${response.status}`);
  const entries = unpackModels(new Uint8Array(await response.arrayBuffer()));
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
